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

// url로 Supabase(REST /rest/v1/events)와 Gemini(generativelanguage)를 구분해 각기 다른 응답을 준다.
function stubFetch({ supabaseOk = true, supabaseRows = [], supabaseInsertOk = true, geminiText = "브리핑 텍스트" } = {}) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push({ url: String(url), method: opts && opts.method });
    if (String(url).includes("generativelanguage")) {
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: geminiText }] } }] }) };
    }
    if (opts && opts.method === "POST") {
      // track.js의 insert
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

test("track — 정상 POST → 204(스텁 insert 호출 확인)", async () => {
  await withEnv({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "test-key" }, async () => {
    const stub = stubFetch();
    try {
      const body = JSON.stringify({ code: "A반-01", event_type: "session_start", course: "aifirst", payload: { skin: "office" } });
      const res = await track.handler(makeEvent({ body }));
      assert.equal(res.statusCode, 204);
      assert.equal(stub.calls.length, 1, "Supabase insert가 정확히 1회 호출돼야 함");
      assert.match(stub.calls[0].url, /\/rest\/v1\/events/);
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
