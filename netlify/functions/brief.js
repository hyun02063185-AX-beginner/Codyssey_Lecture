/* =========================================================================
   brief — AI 주간 브리핑 함수 (LMS 3단계)
   -------------------------------------------------------------------------
   admin.js(#/admin, 📋 주간 브리핑 버튼) → 이 함수 → 집계(stats와 공유 모듈)
   → 프롬프트 삽입 → Gemini 호출 → 텍스트만 반환.
   · POST만 허용. 헤더 x-admin-key를 env ADMIN_KEY와 비교(불일치 401).
   · 호출 주체는 강사(ADMIN_KEY 인증 뒤)뿐 — 비용·남용 리스크 최소.
   · 17강 원칙(사람 확인 지점)을 제품이 실천: 이 함수는 텍스트를 "반환"할 뿐,
     그 무엇도 자동 발송·자동 실행하지 않는다. 화면 표시·복사는 admin.js의 몫.
   ========================================================================= */
"use strict";

const { fetchAggregatedData } = require("./_shared/aggregate");

const RATE_LIMIT = 5;               // 같은 IP 분당 5회 — 브리핑은 잦을 이유가 없다
const rate = new Map();

// 확인일 2026-07 · 공식 문서(ai.google.dev/api/generate-content) 기준 Gemini
// 무료 티어 표준 모델. 바뀌면 이 상수만 갱신하면 된다.
const GEMINI_MODEL = "gemini-3.5-flash";
const TEMPERATURE = 0.3;            // 보고서형 — 낮게
const MAX_OUTPUT_TOKENS = 1000;

const SYSTEM_PROMPT = `당신은 AX(AI 전환) 교육 과정의 강의 운영을 돕는 조교입니다.
아래 수강 데이터(JSON)를 근거로 강사를 위한 주간 브리핑을 작성하세요.

원칙:
- 데이터에 있는 사실만 말합니다. 데이터에 없는 것을 추측하거나 지어내지 마세요.
- 수강생 코드는 그대로 표기합니다 (예: A반-03).
- 수치를 근거로 들되, 해석은 간결하게. 전체 500자 이내.
- 커리큘럼 참조: 20강 구성은 상자1 왜(01~05: 태도·검증·프롬프트·질문),
  상자2 도구(06~10: 지형도·지식검색·에이전트·자동화·스택),
  상자3 적용(11~15: 문서·콘텐츠·데이터·소통·워크플로우),
  상자4 지속(16~20: 보호·확인지점·리스크·문화·로드맵).
- 진단 최약축 권장 강의: 이해→01·06강, 활용→04·05강, 검증→03강, 안전→16강.

출력 형식 (각 섹션 2~3문장, 해당 데이터 없으면 섹션 생략):
## 이번 주 요약
(활동 수강생 수, 진행 흐름, 눈에 띄는 변화)
## ⚠ 개입 필요
(7일+ 미활동·정체 수강생 코드와 권장 조치 — 없으면 "없음")
## 팀 진단 해석
(리터러시 최약축/네이티브 분포/암묵지·건강검진에서 다음 세션 권장 1가지)
## 콘텐츠 신호
(완료 인원이 급감하는 강의 구간이 있으면 지적 — 없으면 생략)
## 다음 주 한 가지
(강사가 할 가장 값어치 있는 행동 1가지)`;

function corsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
  const ok = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
             /^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin);
  const h = { "Vary": "Origin" };
  if (ok) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
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

// 집계 결과에서 브리핑 프롬프트에 필요한 필드만 추려 슬림하게(원본 이벤트·
// 불필요 필드 제외 — 토큰 절약 + 프롬프트 명료성).
function buildUserMessage(data) {
  const today = String(data.generatedAt || "").slice(0, 10);
  const slim = {
    studentCount: data.aggregate.studentCount,
    students: data.students.map(s => ({
      code: s.code, completedLectures: s.completedLectures.length, level: s.level, lastSeen: s.lastSeen
    })),
    lectureCompletion: data.aggregate.lectureCompletion,
    diagnosisAverages: data.aggregate.diagnosisAverages,
    checkupAverage: data.aggregate.checkupAverage
  };
  return "기준일: " + today + "\n수강 데이터:\n" + JSON.stringify(slim);
}

/* =====================================================================
   AI 제공자 어댑터 — 지금은 Gemini. 이 함수만 교체하면 다른 제공자로 전환.
   ===================================================================== */
async function callAI(systemPrompt, userMessage, apiKey) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
    GEMINI_MODEL + ":generateContent?key=" + encodeURIComponent(apiKey);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: TEMPERATURE, maxOutputTokens: MAX_OUTPUT_TOKENS,
        // gemini-3.x는 기본적으로 내부 추론(thinking)에 출력 토큰 예산을 먼저 쓴다(실측: thoughtsTokenCount
        // 수백 토큰 소모 → 정작 답변은 잘림). 이 작업은 정해진 형식의 보고서 생성이라 추론이 필요 없어
        // "minimal"로 최소화(완전 비활성은 3.x에서 불가 — 공식 문서 명시).
        thinkingConfig: { thinkingLevel: "minimal" }
      }
    })
  });
  if (!res.ok) { const e = new Error("gemini http " + res.status); e.upstream = true; throw e; }
  const data = await res.json();
  const text = data && data.candidates && data.candidates[0] &&
    data.candidates[0].content && data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
  if (!text) { const e = new Error("gemini empty response"); e.upstream = true; throw e; }
  return text.trim();
}

/* ---- Anthropic로 교체하려면(예시, 미사용) ----
async function callAI(systemPrompt, userMessage, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-opus-4-8", max_tokens: MAX_OUTPUT_TOKENS, temperature: TEMPERATURE,
      system: systemPrompt, messages: [{ role: "user", content: userMessage }]
    })
  });
  if (!res.ok) throw new Error("anthropic http " + res.status);
  const data = await res.json();
  return data.content[0].text.trim();
}
---- OpenAI로 교체하려면(예시, 미사용) ----
async function callAI(systemPrompt, userMessage, apiKey) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-mini", temperature: TEMPERATURE, max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }]
    })
  });
  if (!res.ok) throw new Error("openai http " + res.status);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}
===================================================================== */

exports.handler = async function (event) {
  const cors = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: cors };

  const ip = (event.headers && (event.headers["x-nf-client-connection-ip"] ||
              (event.headers["x-forwarded-for"] || "").split(",")[0].trim())) || "unknown";
  if (tooMany(ip)) return { statusCode: 429, headers: cors };

  const adminKey = process.env.ADMIN_KEY;
  const given = event.headers && (event.headers["x-admin-key"] || event.headers["X-Admin-Key"]);
  if (!adminKey || !given || given !== adminKey) {
    return { statusCode: 401, headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "키가 올바르지 않습니다" }) };
  }

  const aiKey = process.env.AI_API_KEY;
  if (!aiKey) {
    return { statusCode: 500, headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "AI_API_KEY가 설정되지 않았습니다 — Netlify 환경변수를 확인해주세요." }) };
  }
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supaUrl || !supaKey) return { statusCode: 500, headers: cors };

  const classPrefix = (event.queryStringParameters && event.queryStringParameters.class) || "";
  const course = (event.queryStringParameters && event.queryStringParameters.course) || "";   // 없으면 전체 과정

  let data;
  try {
    data = await fetchAggregatedData({ supabaseUrl: supaUrl, supabaseKey: supaKey, classPrefix, course });
  } catch (e) {
    return { statusCode: 502, headers: cors };
  }

  // 수강생 0명 — AI를 부르지 않고 결정론적으로 응답한다.
  // (환각으로 가짜 수강생을 지어낼 여지 자체를 코드 레벨에서 차단 + 비용 절약)
  if (data.aggregate.studentCount === 0) {
    const scope = classPrefix ? '"' + classPrefix + '" 반' : (course ? '"' + course + '" 과정' : "");
    const empty = "## 이번 주 요약\n" + (scope ? scope + "의" : "아직") + " 수집된 수강 데이터가 없습니다.";
    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ text: empty, generatedAt: data.generatedAt, classFilter: classPrefix || null, courseFilter: course || null, studentCount: 0 }) };
  }

  let text;
  try {
    text = await callAI(SYSTEM_PROMPT, buildUserMessage(data), aiKey);
  } catch (e) {
    return { statusCode: 502, headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "브리핑 생성 실패 — 잠시 후 재시도" }) };
  }

  return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({ text, generatedAt: data.generatedAt, classFilter: classPrefix || null, courseFilter: course || null, studentCount: data.aggregate.studentCount }) };
};
