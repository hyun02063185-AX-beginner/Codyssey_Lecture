/* =========================================================================
   functions-contract.test.js — netlify/functions 핸들러 계약 테스트
   -------------------------------------------------------------------------
   핸들러를 직접 import·호출한다(네트워크 없음). global.fetch는 매 테스트마다
   스텁으로 교체해 Supabase/Gemini 호출을 전부 차단한다. 테스트별로 서로 다른
   x-nf-client-connection-ip를 써서, 모듈 스코프에 상주하는 레이트리미터
   Map이 테스트 간에 서로를 429로 오염시키지 않게 한다.
   ========================================================================= */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const FN_DIR = path.join(__dirname, "..", "netlify", "functions");
const track = require(path.join(FN_DIR, "track.js"));
const stats = require(path.join(FN_DIR, "stats.js"));
const brief = require(path.join(FN_DIR, "brief.js"));
const codesFn = require(path.join(FN_DIR, "codes.js"));

let ipCounter = 0;
function nextIp() { ipCounter += 1; return `10.0.0.${ipCounter}`; }

function makeEvent({ method = "POST", headers = {}, body = "", query = null } = {}) {
  return {
    httpMethod: method,
    headers: { origin: "http://localhost:8899", "x-nf-client-connection-ip": nextIp(), ...headers },
    body,
    queryStringParameters: query
  };
}

// url로 Supabase(REST /rest/v1/events · /rest/v1/codes)와 Gemini(generativelanguage)를
// 구분해 각기 다른 응답을 준다. /codes는 GET(조회/등록확인)·POST(발급 insert)를 메서드로 나눈다.
function stubFetch({
  supabaseOk = true, supabaseRows = [], supabaseInsertOk = true, geminiText = "브리핑 텍스트",
  codesFound = [], codesInsertOk = true
} = {}) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, opts) => {
    const u = String(url);
    calls.push({ url: u, method: opts && opts.method });
    if (u.includes("generativelanguage")) {
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: geminiText }] } }] }) };
    }
    if (u.includes("/rest/v1/codes")) {
      if (opts && opts.method === "POST") return { ok: codesInsertOk, status: codesInsertOk ? 201 : 500 };
      return { ok: supabaseOk, json: async () => codesFound };
    }
    if (opts && opts.method === "POST") {
      // track.js의 events insert
      return { ok: supabaseInsertOk, status: supabaseInsertOk ? 201 : 500 };
    }
    // stats/brief가 부르는 aggregate.js의 GET 조회
    return { ok: supabaseOk, json: async () => supabaseRows };
  };
  return { calls, restore: () => { global.fetch = original; } };
}

function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; process.env[k] = vars[k]; }
  return Promise.resolve()
    .then(fn)
    .finally(() => { for (const k of Object.keys(vars)) {
      if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k];
    }});
}

/* ---------- track.js ---------- */

test("track — GET → 405", async () => {
  const res = await track.handler(makeEvent({ method: "GET" }));
  assert.equal(res.statusCode, 405);
});

test("track — 미등록 event_type → 400", async () => {
  const body = JSON.stringify({ code: "A반-01", event_type: "not_a_real_type", course: "aifirst" });
  const res = await track.handler(makeEvent({ body }));
  assert.equal(res.statusCode, 400);
});

test("track — 8KB 초과 body → 413", async () => {
  const big = "x".repeat(9 * 1024);
  const body = JSON.stringify({ code: "A반-01", event_type: "session_start", course: "aifirst", payload: { pad: big } });
  const res = await track.handler(makeEvent({ body }));
  assert.equal(res.statusCode, 413);
});

test("track — 코드 길이 위반(1자) → 400", async () => {
  const body = JSON.stringify({ code: "A", event_type: "session_start", course: "aifirst" });
  const res = await track.handler(makeEvent({ body }));
  assert.equal(res.statusCode, 400);
});

test("track — course 형식 위반(대문자·숫자 포함) → 400", async () => {
  const body = JSON.stringify({ code: "A반-01", event_type: "session_start", course: "AiFirst1" });
  const res = await track.handler(makeEvent({ body }));
  assert.equal(res.statusCode, 400);
});

test("track — 식별자 51자 초과 → 400(반코드20+'-'1+이름30=51 상한)", async () => {
  const body = JSON.stringify({ code: "A".repeat(52), event_type: "session_start", course: "aifirst" });
  const res = await track.handler(makeEvent({ body }));
  assert.equal(res.statusCode, 400);
});

test("track — 부분 일치(반코드 뒤에 '-' 없이 이어짐) → 204·insert 없음(오탐 방지)", async () => {
  await withEnv({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "test-key" }, async () => {
    // "A반"이 등록돼 있어도 "A반부-누구"는 "A반-"로 시작하지 않으므로 매칭돼선 안 된다.
    const stub = stubFetch({ codesFound: [{ code: "A반" }] });
    try {
      const body = JSON.stringify({ code: "A반부-누구", event_type: "session_start", course: "aifirst" });
      const res = await track.handler(makeEvent({ body }));
      assert.equal(res.statusCode, 204);
      assert.equal(stub.calls.length, 1, "접두 불일치라 events insert가 호출되면 안 됨");
    } finally { stub.restore(); }
  });
});

test("track — 등록된 반코드로 시작하는 식별자 → 204(codes 조회 후 events insert 호출 확인)", async () => {
  await withEnv({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "test-key" }, async () => {
    // 반코드+이름 방식(order/코드방식_서버설정_지시서.md A) — codes 테이블엔 반코드("A반")만
    // 등록돼 있고, 식별자("A반-김철수")는 접두 일치로 판정된다(exact match 아님).
    const stub = stubFetch({ codesFound: [{ code: "A반" }] });
    try {
      const body = JSON.stringify({ code: "A반-김철수", event_type: "session_start", course: "aifirst", payload: { skin: "office" } });
      const res = await track.handler(makeEvent({ body }));
      assert.equal(res.statusCode, 204);
      assert.equal(stub.calls.length, 2, "codes 조회 1회 + events insert 1회");
      assert.match(stub.calls[0].url, /\/rest\/v1\/codes/);
      assert.match(stub.calls[1].url, /\/rest\/v1\/events/);
    } finally { stub.restore(); }
  });
});

test("track — 미등록 코드 → 204·events insert 없음(유령 데이터 차단)", async () => {
  await withEnv({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "test-key" }, async () => {
    const stub = stubFetch({ codesFound: [] });   // codes 테이블에 없음
    try {
      const body = JSON.stringify({ code: "유령-99", event_type: "session_start", course: "aifirst" });
      const res = await track.handler(makeEvent({ body }));
      assert.equal(res.statusCode, 204, "미등록 코드도 에러 없이 조용히 무시(수강생 UX엔 벽 없음)");
      assert.equal(stub.calls.length, 1, "codes 조회만 하고 events insert는 호출되지 않아야 함");
      assert.match(stub.calls[0].url, /\/rest\/v1\/codes/);
    } finally { stub.restore(); }
  });
});

/* ---------- stats.js ---------- */

test("stats — 키 없음 → 401", async () => {
  await withEnv({ ADMIN_KEY: "secret-key" }, async () => {
    const res = await stats.handler(makeEvent({ method: "GET", body: "" }));
    assert.equal(res.statusCode, 401);
  });
});

test("stats — 키 불일치 → 401", async () => {
  await withEnv({ ADMIN_KEY: "secret-key" }, async () => {
    const res = await stats.handler(makeEvent({ method: "GET", headers: { "x-admin-key": "wrong" } }));
    assert.equal(res.statusCode, 401);
  });
});

test("stats — 정상 키 → 스텁 데이터 기반 200 정상 응답", async () => {
  await withEnv({ ADMIN_KEY: "secret-key", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "test-key" }, async () => {
    const rows = [
      { code: "A반-01", event_type: "lecture_complete", payload: { lectureId: 1, level: 1 }, created_at: "2026-07-20T00:00:00Z", course: "aifirst" }
    ];
    const stub = stubFetch({ supabaseRows: rows });
    try {
      const res = await stats.handler(makeEvent({ method: "GET", headers: { "x-admin-key": "secret-key" }, query: { course: "aifirst" } }));
      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.aggregate.studentCount, 1);
    } finally { stub.restore(); }
  });
});

/* ---------- brief.js ---------- */

test("brief — 키 없음/불일치 → 401", async () => {
  await withEnv({ ADMIN_KEY: "secret-key" }, async () => {
    const res1 = await brief.handler(makeEvent({ method: "POST" }));
    assert.equal(res1.statusCode, 401);
    const res2 = await brief.handler(makeEvent({ method: "POST", headers: { "x-admin-key": "wrong" } }));
    assert.equal(res2.statusCode, 401);
  });
});

test("brief — 0명일 때 AI 스텁이 호출되지 않음(결정론적 방어)", async () => {
  await withEnv({ ADMIN_KEY: "secret-key", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "test-key", AI_API_KEY: "gemini-test-key" }, async () => {
    const stub = stubFetch({ supabaseRows: [] }); // 0명
    try {
      const res = await brief.handler(makeEvent({ method: "POST", headers: { "x-admin-key": "secret-key" }, query: { course: "aifirst" } }));
      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.studentCount, 0);
      assert.ok(!stub.calls.some(c => c.url.includes("generativelanguage")), "0명인데 Gemini가 호출됨 — 환각 방어 회귀");
    } finally { stub.restore(); }
  });
});

test("brief — 수강생 있으면 AI 스텁 호출되고 텍스트가 응답에 반영됨", async () => {
  await withEnv({ ADMIN_KEY: "secret-key", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "test-key", AI_API_KEY: "gemini-test-key" }, async () => {
    const rows = [
      { code: "A반-01", event_type: "lecture_complete", payload: { lectureId: 1, level: 1 }, created_at: "2026-07-20T00:00:00Z", course: "aifirst" }
    ];
    const stub = stubFetch({ supabaseRows: rows, geminiText: "## 이번 주 요약\n테스트 브리핑입니다." });
    try {
      const res = await brief.handler(makeEvent({ method: "POST", headers: { "x-admin-key": "secret-key" }, query: { course: "aifirst" } }));
      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.text, "## 이번 주 요약\n테스트 브리핑입니다.");
      assert.ok(stub.calls.some(c => c.url.includes("generativelanguage")), "1명 이상인데 Gemini가 호출되지 않음");
    } finally { stub.restore(); }
  });
});

/* ---------- codes.js ---------- */

test("codes — GET 키 없음 → 401", async () => {
  await withEnv({ ADMIN_KEY: "secret-key" }, async () => {
    const res = await codesFn.handler(makeEvent({ method: "GET" }));
    assert.equal(res.statusCode, 401);
  });
});

test("codes — POST 키 불일치 → 401", async () => {
  await withEnv({ ADMIN_KEY: "secret-key" }, async () => {
    const res = await codesFn.handler(makeEvent({ method: "POST", headers: { "x-admin-key": "wrong" } }));
    assert.equal(res.statusCode, 401);
  });
});

test("codes — POST 잘못된 course → 400", async () => {
  await withEnv({ ADMIN_KEY: "secret-key" }, async () => {
    const body = JSON.stringify({ course: "AX1", batch: "A반" });
    const res = await codesFn.handler(makeEvent({ method: "POST", headers: { "x-admin-key": "secret-key" }, body }));
    assert.equal(res.statusCode, 400);
  });
});

test("codes — POST 빈 batch → 400", async () => {
  await withEnv({ ADMIN_KEY: "secret-key" }, async () => {
    const body = JSON.stringify({ course: "ax", batch: "  " });
    const res = await codesFn.handler(makeEvent({ method: "POST", headers: { "x-admin-key": "secret-key" }, body }));
    assert.equal(res.statusCode, 400);
  });
});

test("codes — POST 신규 발급 → 반 코드 1행 생성·insert 호출·created:true", async () => {
  await withEnv({ ADMIN_KEY: "secret-key", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "test-key" }, async () => {
    const stub = stubFetch({ codesFound: [] });   // 기존 발급 없음
    try {
      const body = JSON.stringify({ course: "ax", batch: "A반" });
      const res = await codesFn.handler(makeEvent({ method: "POST", headers: { "x-admin-key": "secret-key" }, body }));
      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.created, true);
      assert.equal(data.code, "A반");
      assert.equal(stub.calls.length, 2, "기존 조회 1회 + insert 1회");
      assert.equal(stub.calls[1].method, "POST");
    } finally { stub.restore(); }
  });
});

test("codes — POST 이미 발급된 반 재요청 → insert 없이 기존 반 코드 그대로 반환(재발급 안전)", async () => {
  await withEnv({ ADMIN_KEY: "secret-key", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "test-key" }, async () => {
    const stub = stubFetch({ codesFound: [{ code: "A반" }] });
    try {
      const body = JSON.stringify({ course: "ax", batch: "A반" });
      const res = await codesFn.handler(makeEvent({ method: "POST", headers: { "x-admin-key": "secret-key" }, body }));
      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.created, false);
      assert.equal(data.code, "A반");
      assert.equal(stub.calls.length, 1, "기존 조회만 하고 insert는 호출되지 않아야 함(중복 방지)");
    } finally { stub.restore(); }
  });
});

test("codes — GET 목록 조회 → 반 코드별로 나열", async () => {
  await withEnv({ ADMIN_KEY: "secret-key", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "test-key" }, async () => {
    const rows = [
      { course: "aifirst", batch: "A반", code: "A반", created_at: "2026-07-20T00:00:00Z" },
      { course: "aifirst", batch: "B반", code: "B반", created_at: "2026-07-20T00:05:00Z" }
    ];
    const stub = stubFetch({ codesFound: rows });
    try {
      const res = await codesFn.handler(makeEvent({ method: "GET", headers: { "x-admin-key": "secret-key" }, query: { course: "aifirst" } }));
      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.deepEqual(data.batches, [
        { course: "aifirst", batch: "A반", code: "A반", createdAt: "2026-07-20T00:00:00Z" },
        { course: "aifirst", batch: "B반", code: "B반", createdAt: "2026-07-20T00:05:00Z" }
      ]);
    } finally { stub.restore(); }
  });
});
