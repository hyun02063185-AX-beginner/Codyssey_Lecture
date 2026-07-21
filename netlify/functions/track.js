/* =========================================================================
   track — 학습 이벤트 수집 함수 (LMS 1단계)
   -------------------------------------------------------------------------
   프론트(telemetry.js) → 이 함수 → Supabase events 테이블 insert.
   · 의존성 0 (supabase-js 대신 REST fetch 직접 호출 — 정적 프로젝트 유지)
   · service_role 키는 환경변수(SUPABASE_URL / SUPABASE_SERVICE_KEY)로만 —
     프론트/저장소에 절대 노출되지 않는다.
   · 응답은 204(성공) 또는 4xx/5xx(본문 최소 — 내부 정보 비노출).
   ========================================================================= */
"use strict";

const EVENT_TYPES = new Set([
  "session_start", "lecture_complete", "run_complete",
  "diagnosis_result", "proposal_created", "checkup_result"
]);
const MAX_BODY = 8 * 1024;          // 8KB
const RATE_LIMIT = 30;              // 같은 IP 분당 30회
const rate = new Map();             // ip → { n, windowStart }  (인스턴스 메모리 — 1단계엔 충분)

function corsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
  const ok = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
             /^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin);
  const h = { "Vary": "Origin" };
  if (ok) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return h;
}

function tooMany(ip) {
  const now = Date.now();
  const slot = rate.get(ip);
  if (!slot || now - slot.windowStart > 60000) { rate.set(ip, { n: 1, windowStart: now }); return false; }
  slot.n += 1;
  if (rate.size > 5000) rate.clear();          // 메모리 폭주 방지(러프해도 충분)
  return slot.n > RATE_LIMIT;
}

exports.handler = async function (event) {
  const cors = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: cors };

  const ip = (event.headers && (event.headers["x-nf-client-connection-ip"] ||
              (event.headers["x-forwarded-for"] || "").split(",")[0].trim())) || "unknown";
  if (tooMany(ip)) return { statusCode: 429, headers: cors };

  const raw = event.body || "";
  if (raw.length > MAX_BODY) return { statusCode: 413, headers: cors };

  let data;
  try { data = JSON.parse(raw); } catch (e) { return { statusCode: 400, headers: cors }; }

  const code = String(data.code || "").replace(/\s+/g, "");
  const type = String(data.event_type || "");
  const course = String(data.course || "");
  if (code.length < 2 || code.length > 20)   return { statusCode: 400, headers: cors };
  if (!EVENT_TYPES.has(type))                return { statusCode: 400, headers: cors };
  if (!/^[a-z]{2,20}$/.test(course))         return { statusCode: 400, headers: cors };
  const payload = (data.payload && typeof data.payload === "object") ? data.payload : {};

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { statusCode: 500, headers: cors };   // env 미설정 = 수집 전체 중단

  try {
    const res = await fetch(url.replace(/\/$/, "") + "/rest/v1/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ code: code, event_type: type, payload: payload, course: course })
    });
    if (!res.ok) return { statusCode: 502, headers: cors };
    return { statusCode: 204, headers: cors };
  } catch (e) {
    return { statusCode: 502, headers: cors };
  }
};
