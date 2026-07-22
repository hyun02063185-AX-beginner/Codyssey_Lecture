/* =========================================================================
   aggregate.test.js — netlify/functions/_shared/aggregate.js 단위 테스트
   -------------------------------------------------------------------------
   고정 픽스처(가짜 이벤트)로 순수 함수(summarizeStudent·aggregate)를 검증하고,
   fetchAggregatedData는 global.fetch를 스텁으로 대체해 네트워크 없이 검증한다.
   이벤트 배열은 실제 Supabase 쿼리(order=created_at.desc)와 동일하게
   "최신이 먼저" 순서로 픽스처를 구성한다 — summarizeStudent의 재검사 갱신
   로직(첫 발견 = 최신)이 이 순서를 전제로 하기 때문.
   ========================================================================= */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { summarizeStudent, aggregate, fetchAggregatedData } =
  require(path.join(__dirname, "..", "netlify", "functions", "_shared", "aggregate.js"));

/* ---------- summarizeStudent ---------- */

test("summarizeStudent — completedLectures 유니크·정렬 집계", () => {
  const events = [
    { created_at: "2026-07-20T09:00:00Z", event_type: "lecture_complete", payload: { lectureId: 3, level: 1 }, course: "aifirst" },
    { created_at: "2026-07-19T09:00:00Z", event_type: "lecture_complete", payload: { lectureId: 1, level: 1 }, course: "aifirst" },
    { created_at: "2026-07-19T09:30:00Z", event_type: "lecture_complete", payload: { lectureId: 1, level: 1 }, course: "aifirst" }, // 중복
    { created_at: "2026-07-20T10:00:00Z", event_type: "lecture_complete", payload: { lectureId: 2, level: 1 }, course: "aifirst" }
  ];
  const s = summarizeStudent("A반-01", events);
  assert.deepEqual(s.completedLectures, [1, 2, 3]); // 유니크 + 오름차순
});

test("summarizeStudent — lastSeen은 입력 순서와 무관하게 최댓값", () => {
  const events = [
    { created_at: "2026-07-18T00:00:00Z", event_type: "session_start", payload: {}, course: "aifirst" },
    { created_at: "2026-07-22T00:00:00Z", event_type: "session_start", payload: {}, course: "aifirst" }, // 배열상 중간이지만 최신
    { created_at: "2026-07-20T00:00:00Z", event_type: "session_start", payload: {}, course: "aifirst" }
  ];
  const s = summarizeStudent("A반-02", events);
  assert.equal(s.lastSeen, "2026-07-22T00:00:00Z");
});

test("summarizeStudent — diagnosis/checkup은 재검사해도 최신(desc 첫 발견) 결과만 반영", () => {
  // desc 순서: 최신이 배열 앞쪽
  const events = [
    { created_at: "2026-07-22T00:00:00Z", event_type: "diagnosis_result", payload: { kind: "literacy", scores: { areas: { 이해: 9, 활용: 9, 검증: 9, 안전: 9 } } }, course: "aifirst" },
    { created_at: "2026-07-15T00:00:00Z", event_type: "diagnosis_result", payload: { kind: "literacy", scores: { areas: { 이해: 3, 활용: 3, 검증: 3, 안전: 3 } } }, course: "aifirst" },
    { created_at: "2026-07-22T01:00:00Z", event_type: "checkup_result", payload: { scores: { 방향: 8, 데이터: 8, 사람: 8, 규칙: 8, 분위기: 8 }, lowest: "데이터" }, course: "aifirst" },
    { created_at: "2026-07-10T00:00:00Z", event_type: "checkup_result", payload: { scores: { 방향: 2, 데이터: 2, 사람: 2, 규칙: 2, 분위기: 2 }, lowest: "방향" }, course: "aifirst" }
  ];
  const s = summarizeStudent("A반-03", events);
  assert.equal(s.diagnosis.literacy.areas.이해, 9, "재검사 전 옛 결과(3)가 아니라 최신 결과(9)여야 함");
  assert.equal(s.checkup.lowest, "데이터", "checkup도 최신 결과여야 함");
});

test("summarizeStudent — level은 lecture_complete/run_complete 중 최댓값", () => {
  const events = [
    { created_at: "2026-07-20T00:00:00Z", event_type: "lecture_complete", payload: { lectureId: 5, level: 2 }, course: "aifirst" },
    { created_at: "2026-07-21T00:00:00Z", event_type: "run_complete", payload: { newLevel: 3 }, course: "aifirst" },
    { created_at: "2026-07-19T00:00:00Z", event_type: "lecture_complete", payload: { lectureId: 1, level: 1 }, course: "aifirst" }
  ];
  const s = summarizeStudent("A반-04", events);
  assert.equal(s.level, 3);
});

test("summarizeStudent — proposal_created가 있으면 proposal=true", () => {
  const s1 = summarizeStudent("A반-05", [{ created_at: "2026-07-20T00:00:00Z", event_type: "proposal_created", payload: { hasAll: true }, course: "aifirst" }]);
  assert.equal(s1.proposal, true);
  const s2 = summarizeStudent("A반-06", [{ created_at: "2026-07-20T00:00:00Z", event_type: "session_start", payload: {}, course: "aifirst" }]);
  assert.equal(s2.proposal, false);
});

/* ---------- aggregate ---------- */

test("aggregate — lectureCompletion 인원 집계(코드별 요약을 입력으로)", () => {
  const students = [
    { code: "A-01", completedLectures: [1, 2], level: 1, lastSeen: "t1", diagnosis: {}, checkup: null },
    { code: "A-02", completedLectures: [1], level: 1, lastSeen: "t2", diagnosis: {}, checkup: null },
    { code: "A-03", completedLectures: [1, 2, 3], level: 1, lastSeen: "t3", diagnosis: {}, checkup: null }
  ];
  const agg = aggregate(students);
  assert.equal(agg.studentCount, 3);
  assert.deepEqual(agg.lectureCompletion, { 1: 3, 2: 2, 3: 1 });
});

test("aggregate — diagnosisAverages·checkupAverage 수치가 수기 계산값과 일치", () => {
  const students = [
    { code: "A-01", completedLectures: [], level: 1, lastSeen: "t1",
      diagnosis: { literacy: { areas: { 이해: 8, 활용: 6, 검증: 4, 안전: 10 } }, native: { total: 70 }, tacit: { total: 20 } },
      checkup: { scores: { 방향: 5, 데이터: 5, 사람: 5, 규칙: 5, 분위기: 5 }, lowest: "방향" } },
    { code: "A-02", completedLectures: [], level: 1, lastSeen: "t2",
      diagnosis: { literacy: { areas: { 이해: 4, 활용: 4, 검증: 4, 안전: 4 } }, native: { total: 50 }, tacit: { total: 40 } },
      checkup: { scores: { 방향: 3, 데이터: 3, 사람: 3, 규칙: 3, 분위기: 3 }, lowest: "데이터" } }
  ];
  const agg = aggregate(students);
  // 이해: (8+4)/2=6, 활용: (6+4)/2=5, 검증: (4+4)/2=4, 안전: (10+4)/2=7
  assert.deepEqual(agg.diagnosisAverages.literacy, { 이해: 6, 활용: 5, 검증: 4, 안전: 7 });
  assert.equal(agg.diagnosisAverages.native, 60); // (70+50)/2
  assert.equal(agg.diagnosisAverages.tacit, 30);  // (20+40)/2
  assert.deepEqual(agg.checkupAverage, { 방향: 4, 데이터: 4, 사람: 4, 규칙: 4, 분위기: 4 }); // (5+3)/2 각 축
});

test("aggregate — 빈 배열(0명) 시 안전한 기본 구조 반환", () => {
  const agg = aggregate([]);
  assert.equal(agg.studentCount, 0);
  assert.deepEqual(agg.lectureCompletion, {});
  assert.equal(agg.diagnosisAverages.literacy, null);
  assert.equal(agg.diagnosisAverages.native, null);
  assert.equal(agg.diagnosisAverages.tacit, null);
  assert.deepEqual(agg.checkupAverage, {});
});

/* ---------- fetchAggregatedData (global.fetch 스텁) ---------- */

function stubFetchOnce(rows) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, json: async () => rows };
  };
  return { calls, restore: () => { global.fetch = original; } };
}

test("fetchAggregatedData — class(접두어) 필터가 교차 포함 없이 정확히 걸러냄", async () => {
  const rows = [
    { code: "A반-01", event_type: "lecture_complete", payload: { lectureId: 1 }, created_at: "2026-07-20T00:00:00Z", course: "aifirst" },
    { code: "B반-01", event_type: "lecture_complete", payload: { lectureId: 1 }, created_at: "2026-07-20T00:00:00Z", course: "aifirst" },
    { code: "A반-02", event_type: "lecture_complete", payload: { lectureId: 2 }, created_at: "2026-07-20T00:00:00Z", course: "aifirst" }
  ];
  const stub = stubFetchOnce(rows);
  try {
    const data = await fetchAggregatedData({ supabaseUrl: "https://x.supabase.co", supabaseKey: "k", classPrefix: "A반", course: "" });
    assert.equal(data.students.length, 2);
    assert.ok(data.students.every(s => s.code.startsWith("A반")), "B반이 섞여 들어옴");
  } finally { stub.restore(); }
});

test("fetchAggregatedData — course 필터가 요청 URL에 반영됨", async () => {
  const stub = stubFetchOnce([]);
  try {
    await fetchAggregatedData({ supabaseUrl: "https://x.supabase.co", supabaseKey: "k", classPrefix: "", course: "aifirst" });
    assert.match(stub.calls[0].url, /course=eq\.aifirst/);
  } finally { stub.restore(); }
});

test("fetchAggregatedData — course 미지정 시 URL에 course 필터 없음(전체 과정)", async () => {
  const stub = stubFetchOnce([]);
  try {
    await fetchAggregatedData({ supabaseUrl: "https://x.supabase.co", supabaseKey: "k", classPrefix: "", course: "" });
    assert.doesNotMatch(stub.calls[0].url, /course=eq\./);
  } finally { stub.restore(); }
});

test("fetchAggregatedData — 빈 배열 응답 시 안전한 기본 구조(0명)", async () => {
  const stub = stubFetchOnce([]);
  try {
    const data = await fetchAggregatedData({ supabaseUrl: "https://x.supabase.co", supabaseKey: "k", classPrefix: "", course: "" });
    assert.equal(data.aggregate.studentCount, 0);
    assert.equal(data.students.length, 0);
    assert.equal(data.truncated, false);
  } finally { stub.restore(); }
});
