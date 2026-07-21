/* =========================================================================
   stats — 강사 대시보드 조회 함수 (LMS 2단계)
   -------------------------------------------------------------------------
   admin.js(#/admin) → 이 함수 → Supabase events 조회 → 서버에서 집계 →
   요약 JSON만 응답. 원본 이벤트 나열은 절대 반환하지 않는다.
   · GET만 허용. 헤더 x-admin-key를 env ADMIN_KEY와 비교(불일치 401).
   · 집계 로직은 _shared/aggregate.js — brief.js와 공유(이중 구현 금지).
   · 의존성 0 (REST fetch 직접 호출).
   ========================================================================= */
"use strict";

const { fetchAggregatedData } = require("./_shared/aggregate");

const RATE_LIMIT = 20;              // 같은 IP 분당 20회(키 무차별 대입 방어)
const rate = new Map();

function corsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
  const ok = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
             /^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin);
  const h = { "Vary": "Origin" };
  if (ok) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    h["Access-Control-Allow-Headers"] = "x-admin-key";
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

exports.handler = async function (event) {
  const cors = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "GET")     return { statusCode: 405, headers: cors };

  const ip = (event.headers && (event.headers["x-nf-client-connection-ip"] ||
              (event.headers["x-forwarded-for"] || "").split(",")[0].trim())) || "unknown";
  if (tooMany(ip)) return { statusCode: 429, headers: cors };

  const adminKey = process.env.ADMIN_KEY;
  const given = event.headers && (event.headers["x-admin-key"] || event.headers["X-Admin-Key"]);
  if (!adminKey || !given || given !== adminKey) {
    return { statusCode: 401, headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "키가 올바르지 않습니다" }) };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { statusCode: 500, headers: cors };

  const classPrefix = (event.queryStringParameters && event.queryStringParameters.class) || "";
  const course = (event.queryStringParameters && event.queryStringParameters.course) || "";   // 없으면 전체 과정

  let data;
  try {
    data = await fetchAggregatedData({ supabaseUrl: url, supabaseKey: key, classPrefix, course });
  } catch (e) {
    return { statusCode: 502, headers: cors };
  }

  return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(data) };
};
