/* =========================================================================
   codes — 수강 코드 발급/조회 함수 (LMS 운영 기초)
   -------------------------------------------------------------------------
   admin.js(#/admin, 코드 발급 도구) → 이 함수 → Supabase codes 테이블.
   · GET: 발급된 반 목록 조회(반 이름·과정·인원·발급일만 — 개별 코드 나열 안 함).
   · POST: 반 단위 코드 일괄 발급. 헤더 x-admin-key를 env ADMIN_KEY와 비교(불일치 401).
     같은 (course, batch)로 이미 발급된 코드가 있으면 새로 만들지 않고 기존 코드를
     그대로 반환한다(재발급 안전 — 중복 클릭·재시도로 코드가 늘어나지 않음).
   · 이름·연락처 등 개인정보는 다루지 않는다 — code 문자열만.
   · 의존성 0 (REST fetch 직접 호출).
   ========================================================================= */
"use strict";

const RATE_LIMIT = 20;              // 같은 IP 분당 20회(키 무차별 대입 방어)
const rate = new Map();
const MAX_COUNT = 99;
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

function pad2(n) { return String(n).padStart(2, "0"); }

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

  let course, batch, count;
  if (event.httpMethod === "POST") {
    // 입력 형식 검증을 SUPABASE 환경변수 확인보다 먼저 — 잘못된 요청은 외부 호출 없이 바로 400.
    const raw = event.body || "";
    if (raw.length > 2048) return { statusCode: 413, headers: cors };
    let data;
    try { data = JSON.parse(raw); } catch (e) { return json(400, cors, { error: "잘못된 요청 본문" }); }

    course = String(data.course || "").trim();
    batch = String(data.batch || "").trim();
    count = Number(data.count);
    if (!COURSE_RE.test(course)) return json(400, cors, { error: "과정 값이 올바르지 않습니다" });
    if (!batch || batch.length > 20 || BATCH_BAD_CHARS_RE.test(batch)) {
      return json(400, cors, { error: "반 이름이 올바르지 않습니다(1~20자, 특수문자 일부 제외)" });
    }
    if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
      return json(400, cors, { error: "인원수는 1~" + MAX_COUNT + " 사이여야 합니다" });
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
    const byBatch = new Map();   // "course|batch" → { course, batch, count, createdAt(최초 발급일) }
    rows.forEach(r => {
      const k = r.course + "|" + r.batch;
      const cur = byBatch.get(k);
      if (!cur) byBatch.set(k, { course: r.course, batch: r.batch, count: 1, createdAt: r.created_at });
      else cur.count += 1;
    });
    return json(200, cors, { batches: [...byBatch.values()] });
  }

  // POST — 발급
  try {
    const existRes = await fetch(
      base + "/codes?course=eq." + encodeURIComponent(course) + "&batch=eq." + encodeURIComponent(batch) +
      "&select=code&order=code.asc",
      { headers: sbHeaders }
    );
    if (!existRes.ok) return { statusCode: 502, headers: cors };
    const existing = await existRes.json();
    if (existing.length > 0) {
      return json(200, cors, { course, batch, codes: existing.map(r => r.code), created: false });
    }

    const codes = Array.from({ length: count }, (_, i) => batch + "-" + pad2(i + 1));
    const insertRes = await fetch(base + "/codes", {
      method: "POST",
      headers: { ...sbHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify(codes.map(code => ({ code, course, batch })))
    });
    if (!insertRes.ok) return { statusCode: 502, headers: cors };
    return json(200, cors, { course, batch, codes, created: true });
  } catch (e) {
    return { statusCode: 502, headers: cors };
  }
};
