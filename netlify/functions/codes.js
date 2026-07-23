/* =========================================================================
   codes — 반 코드 발급/조회 함수 (LMS 운영 기초 → 반 코드+이름 방식 개편)
   -------------------------------------------------------------------------
   admin.js(#/admin, 코드 발급 도구) → 이 함수 → Supabase codes 테이블.
   · GET: 발급된 반 목록 조회(과정·반 코드·발급일).
   · POST: 반 코드 1개 등록. 헤더 x-admin-key를 env ADMIN_KEY와 비교(불일치 401).
     같은 (course, batch)로 이미 발급된 코드가 있으면 새로 만들지 않고 기존 코드를
     그대로 반환한다(재발급 안전 — 중복 클릭·재시도로 늘어나지 않음).
   · 반 코드 1개 = codes 테이블 1행(개정: order/코드방식_서버설정_지시서.md A-3 — 개인별
     코드 다수 발급에서 반 코드 1개로 단순화. 개별 식별은 이제 학생이 직접 입력하는 이름으로
     한다 — track.js가 `{반코드}-{이름}` 식별자에서 접두 일치를 판정, §A-2 참고).
   · 이름·연락처 등 개인정보는 다루지 않는다 — code 문자열만.
   · 의존성 0 (REST fetch 직접 호출).
   ========================================================================= */
"use strict";

const RATE_LIMIT = 20;              // 같은 IP 분당 20회(키 무차별 대입 방어)
const rate = new Map();
const COURSE_RE = /^[a-z]{2,20}$/;
const BATCH_BAD_CHARS_RE = /[,()*"'\\\r\n\t]/;   // PostgREST 필터 구문·인젝션에 쓰일 수 있는 문자만 차단

function corsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
  const ok = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
             /^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin);
  const h = { "Vary": "Origin" };
  if (ok) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "x-admin-key, Content-Type";
  }
  return h;
}

function tooMany(ip) {
  const now = Date.now();
  const slot = rate.get(ip);
  if (!slot || now - slot.windowStart > 60000) { rate.set(ip, { n: 1, windowStart: now }); return false; }
  slot.n += 1;
  if (rate.size > 5000) rate.clear();
  return slot.n > RATE_LIMIT;
}

function json(statusCode, headers, body) {
  return { statusCode, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

exports.handler = async function (event) {
  const cors = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return { statusCode: 405, headers: cors };

  const ip = (event.headers && (event.headers["x-nf-client-connection-ip"] ||
              (event.headers["x-forwarded-for"] || "").split(",")[0].trim())) || "unknown";
  if (tooMany(ip)) return { statusCode: 429, headers: cors };

  const adminKey = process.env.ADMIN_KEY;
  const given = event.headers && (event.headers["x-admin-key"] || event.headers["X-Admin-Key"]);
  if (!adminKey || !given || given !== adminKey) {
    return json(401, cors, { error: "키가 올바르지 않습니다" });
  }

  let course, batch;
  if (event.httpMethod === "POST") {
    // 입력 형식 검증을 SUPABASE 환경변수 확인보다 먼저 — 잘못된 요청은 외부 호출 없이 바로 400.
    const raw = event.body || "";
    if (raw.length > 2048) return { statusCode: 413, headers: cors };
    let data;
    try { data = JSON.parse(raw); } catch (e) { return json(400, cors, { error: "잘못된 요청 본문" }); }

    course = String(data.course || "").trim();
    batch = String(data.batch || "").trim();
    if (!COURSE_RE.test(course)) return json(400, cors, { error: "과정 값이 올바르지 않습니다" });
    if (!batch || batch.length > 20 || BATCH_BAD_CHARS_RE.test(batch)) {
      return json(400, cors, { error: "반 코드가 올바르지 않습니다(1~20자, 특수문자 일부 제외)" });
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { statusCode: 500, headers: cors };
  const base = url.replace(/\/$/, "") + "/rest/v1";
  const sbHeaders = { "apikey": key, "Authorization": "Bearer " + key };

  if (event.httpMethod === "GET") {
    const qCourse = (event.queryStringParameters && event.queryStringParameters.course) || "";
    let qs = "select=course,batch,code,created_at&order=created_at.asc";
    if (qCourse) qs += "&course=eq." + encodeURIComponent(qCourse);
    let rows;
    try {
      const res = await fetch(base + "/codes?" + qs, { headers: sbHeaders });
      if (!res.ok) return { statusCode: 502, headers: cors };
      rows = await res.json();
    } catch (e) {
      return { statusCode: 502, headers: cors };
    }
    // 반 코드는 1행 = 1반이라 그대로 나열(개인별 발급 시절의 "묶어 세기"가 더는 필요 없음).
    const batches = rows.map(r => ({ course: r.course, batch: r.batch, code: r.code, createdAt: r.created_at }));
    return json(200, cors, { batches });
  }

  // POST — 발급
  try {
    const existRes = await fetch(
      base + "/codes?course=eq." + encodeURIComponent(course) + "&batch=eq." + encodeURIComponent(batch) +
      "&select=code&limit=1",
      { headers: sbHeaders }
    );
    if (!existRes.ok) return { statusCode: 502, headers: cors };
    const existing = await existRes.json();
    if (existing.length > 0) {
      return json(200, cors, { course, batch, code: existing[0].code, created: false });
    }

    const insertRes = await fetch(base + "/codes", {
      method: "POST",
      headers: { ...sbHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify([{ code: batch, course, batch }])
    });
    if (!insertRes.ok) return { statusCode: 502, headers: cors };
    return json(200, cors, { course, batch, code: batch, created: true });
  } catch (e) {
    return { statusCode: 502, headers: cors };
  }
};
