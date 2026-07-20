/* =========================================================================
   stats — 강사 대시보드 조회 함수 (LMS 2단계)
   -------------------------------------------------------------------------
   admin.js(#/admin) → 이 함수 → Supabase events 조회 → 서버에서 집계 →
   요약 JSON만 응답. 원본 이벤트 나열은 절대 반환하지 않는다.
   · GET만 허용. 헤더 x-admin-key를 env ADMIN_KEY와 비교(불일치 401).
   · 의존성 0 (REST fetch 직접 호출).
   ========================================================================= */
"use strict";

const MAX_ROWS = 5000;
const RATE_LIMIT = 20;              // 같은 IP 분당 20회(키 무차별 대입 방어)
const rate = new Map();

const LIT_AXES = ["이해", "활용", "검증", "안전"];

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

// 원본 이벤트 목록(코드별, created_at.desc 순서 유지) → 코드별 요약 1건으로 집계
function summarizeStudent(code, events) {
  let level = 1;
  const completed = new Set();
  let lastSeen = null;
  const diagnosis = {};   // kind → scores (desc 순서라 처음 만나는 것이 최신)
  let proposal = false;

  for (const e of events) {
    if (!lastSeen || e.created_at > lastSeen) lastSeen = e.created_at;
    const p = e.payload || {};
    if (e.event_type === "lecture_complete") {
      if (p.lectureId != null) completed.add(p.lectureId);
      if (typeof p.level === "number") level = Math.max(level, p.level);
    } else if (e.event_type === "run_complete") {
      if (typeof p.newLevel === "number") level = Math.max(level, p.newLevel);
    } else if (e.event_type === "diagnosis_result") {
      if (p.kind && !diagnosis[p.kind]) diagnosis[p.kind] = p.scores || {};
    } else if (e.event_type === "proposal_created") {
      proposal = true;
    }
  }

  return {
    code,
    completedLectures: [...completed].sort((a, b) => a - b),
    level,
    lastSeen,
    diagnosis,
    proposal
  };
}

function aggregate(students) {
  const lectureCompletion = {};
  const litSum = { 이해: 0, 활용: 0, 검증: 0, 안전: 0 };
  let litN = 0, natSum = 0, natN = 0, tacSum = 0, tacN = 0;

  for (const s of students) {
    s.completedLectures.forEach(id => { lectureCompletion[id] = (lectureCompletion[id] || 0) + 1; });
    const lit = s.diagnosis.literacy;
    if (lit && lit.areas) {
      let ok = true;
      LIT_AXES.forEach(k => { if (typeof lit.areas[k] !== "number") ok = false; });
      if (ok) { LIT_AXES.forEach(k => { litSum[k] += lit.areas[k]; }); litN++; }
    }
    const nat = s.diagnosis.native;
    if (nat && typeof nat.total === "number") { natSum += nat.total; natN++; }
    const tac = s.diagnosis.tacit;
    if (tac && typeof tac.total === "number") { tacSum += tac.total; tacN++; }
  }

  const literacy = litN ? {} : null;
  if (literacy) LIT_AXES.forEach(k => { literacy[k] = Math.round((litSum[k] / litN) * 10) / 10; });

  return {
    studentCount: students.length,
    lectureCompletion,
    diagnosisAverages: {
      literacy,
      native: natN ? Math.round(natSum / natN) : null,
      tacit: tacN ? Math.round(tacSum / tacN) : null
    },
    // 조직 건강검진(3-1)은 1단계 수집 이벤트 화이트리스트에 없어 항상 비어 있다(3단계 예고).
    checkupAverage: {}
  };
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

  let rows;
  try {
    const res = await fetch(
      url.replace(/\/$/, "") + "/rest/v1/events?select=code,event_type,payload,created_at&order=created_at.desc&limit=" + MAX_ROWS,
      { headers: { apikey: key, Authorization: "Bearer " + key } }
    );
    if (!res.ok) return { statusCode: 502, headers: cors };
    rows = await res.json();
  } catch (e) {
    return { statusCode: 502, headers: cors };
  }
  const truncated = rows.length >= MAX_ROWS;

  const classPrefix = (event.queryStringParameters && event.queryStringParameters.class) || "";

  const byCode = new Map();
  for (const r of rows) {
    if (classPrefix && !String(r.code || "").startsWith(classPrefix)) continue;
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code).push(r);
  }

  const students = [...byCode.entries()]
    .map(([code, evs]) => summarizeStudent(code, evs))
    .sort((a, b) => String(b.lastSeen || "").localeCompare(String(a.lastSeen || "")));

  const body = {
    generatedAt: new Date().toISOString(),
    students,
    aggregate: aggregate(students),
    truncated
  };

  return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(body) };
};
