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
  // 식별자 = `{반코드}-{이름}`(order/코드방식_서버설정_지시서.md A) — 반코드 최대 20자 +
  // '-' 1자 + 이름 최대 30자 = 51자가 이론상 최댓값이라 상한을 20→51로 완화.
  if (code.length < 2 || code.length > 51)   return { statusCode: 400, headers: cors };
  if (!EVENT_TYPES.has(type))                return { statusCode: 400, headers: cors };
  if (!/^[a-z]{2,20}$/.test(course))         return { statusCode: 400, headers: cors };
  const payload = (data.payload && typeof data.payload === "object") ? data.payload : {};

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { statusCode: 500, headers: cors };   // env 미설정 = 수집 전체 중단
  const base = url.replace(/\/$/, "") + "/rest/v1";
  const sbHeaders = { "apikey": key, "Authorization": "Bearer " + key };

  try {
    // 등록된 반코드로 시작하는 식별자만 수집(order/코드방식_서버설정_지시서.md A-2 — 반코드+
    // 이름 방식으로 개편되며 exact match에서 접두(prefix) match로 변경). 미등록 반코드는
    // 유령 데이터이므로 조용히 무시한다(204, 에러 아님 — 수강생 UX에 벽을 만들지 않는다).
    // PostgREST로 "컬럼값+구분자가 식별자의 접두인지"를 직접 필터링할 수 없어, 그 과정의
    // 등록 반코드 전체를 가져와 여기서 판정한다(이름에 하이픈이 섞여 있어도 안전하게 —
    // 접두 일치하는 반코드가 하나라도 있으면 통과).
    const codesRes = await fetch(
      base + "/codes?course=eq." + encodeURIComponent(course) + "&select=code",
      { headers: sbHeaders }
    );
    if (!codesRes.ok) return { statusCode: 502, headers: cors };
    const registered = await codesRes.json();
    const matched = registered.some(function (r) { return code.indexOf(r.code + "-") === 0; });
    if (!matched) return { statusCode: 204, headers: cors };

    const res = await fetch(base + "/events", {
      method: "POST",
      headers: { ...sbHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ code: code, event_type: type, payload: payload, course: course })
    });
    if (!res.ok) return { statusCode: 502, headers: cors };
    return { statusCode: 204, headers: cors };
  } catch (e) {
    return { statusCode: 502, headers: cors };
  }
};
