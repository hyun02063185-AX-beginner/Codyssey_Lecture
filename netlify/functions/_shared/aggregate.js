/* =========================================================================
   _shared/aggregate.js — Supabase events → 코드별 요약·팀 집계 (공유 모듈)
   -------------------------------------------------------------------------
   stats.js와 brief.js가 이 모듈 하나를 공유한다(집계 로직 이중 구현 금지).
   Netlify Functions는 netlify/functions/ 바로 아래의 .js만 개별 함수로
   배포한다 — _shared/ 하위는 일반 require 대상일 뿐 별도 엔드포인트가
   되지 않는다.
   ========================================================================= */
"use strict";

const MAX_ROWS = 5000;
const LIT_AXES = ["이해", "활용", "검증", "안전"];
const CHK_AXES = ["방향", "데이터", "사람", "규칙", "분위기"];

// 원본 이벤트 목록(코드별, created_at.desc 순서 유지) → 코드별 요약 1건으로 집계
function summarizeStudent(code, events) {
  let level = 1;
  const completed = new Set();
  let lastSeen = null;
  const diagnosis = {};   // kind → scores (desc 순서라 처음 만나는 것이 최신)
  let checkup = null;     // { scores, lowest } — 재검사해도 desc 순서상 처음 만나는 것이 최신
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
    } else if (e.event_type === "checkup_result") {
      if (!checkup) checkup = { scores: p.scores || {}, lowest: p.lowest || "" };
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
    checkup,
    proposal
  };
}

function aggregate(students) {
  const lectureCompletion = {};
  const litSum = { 이해: 0, 활용: 0, 검증: 0, 안전: 0 };
  const chkSum = { 방향: 0, 데이터: 0, 사람: 0, 규칙: 0, 분위기: 0 };
  let litN = 0, natSum = 0, natN = 0, tacSum = 0, tacN = 0, chkN = 0;

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
    const chk = s.checkup;
    if (chk && chk.scores) {
      let ok = true;
      CHK_AXES.forEach(k => { if (typeof chk.scores[k] !== "number") ok = false; });
      if (ok) { CHK_AXES.forEach(k => { chkSum[k] += chk.scores[k]; }); chkN++; }
    }
  }

  const literacy = litN ? {} : null;
  if (literacy) LIT_AXES.forEach(k => { literacy[k] = Math.round((litSum[k] / litN) * 10) / 10; });
  const checkupAverage = {};
  if (chkN) CHK_AXES.forEach(k => { checkupAverage[k] = Math.round((chkSum[k] / chkN) * 10) / 10; });

  return {
    studentCount: students.length,
    lectureCompletion,
    diagnosisAverages: {
      literacy,
      native: natN ? Math.round(natSum / natN) : null,
      tacit: tacN ? Math.round(tacSum / tacN) : null
    },
    checkupAverage   // 응답자 없으면 {} — 호출부가 "아직 데이터 없음"으로 표시
  };
}

// Supabase 조회 + 코드별 그룹핑 + 요약 + 팀 집계까지 한 번에.
// stats.js·brief.js 둘 다 이 함수 하나만 부르면 된다.
async function fetchAggregatedData({ supabaseUrl, supabaseKey, classPrefix }) {
  const res = await fetch(
    supabaseUrl.replace(/\/$/, "") + "/rest/v1/events?select=code,event_type,payload,created_at&order=created_at.desc&limit=" + MAX_ROWS,
    { headers: { apikey: supabaseKey, Authorization: "Bearer " + supabaseKey } }
  );
  if (!res.ok) { const e = new Error("supabase fetch failed"); e.upstream = true; throw e; }
  const rows = await res.json();
  const truncated = rows.length >= MAX_ROWS;

  const byCode = new Map();
  for (const r of rows) {
    if (classPrefix && !String(r.code || "").startsWith(classPrefix)) continue;
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code).push(r);
  }

  const students = [...byCode.entries()]
    .map(([code, evs]) => summarizeStudent(code, evs))
    .sort((a, b) => String(b.lastSeen || "").localeCompare(String(a.lastSeen || "")));

  return {
    generatedAt: new Date().toISOString(),
    students,
    aggregate: aggregate(students),
    truncated
  };
}

module.exports = { MAX_ROWS, LIT_AXES, CHK_AXES, summarizeStudent, aggregate, fetchAggregatedData };
