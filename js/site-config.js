/* =========================================================================
   site-config.js — 이 사이트를 정의하는 단 하나의 파일
   -------------------------------------------------------------------------
   이 저장소를 복제해 새 사이트(예: "AI 첫걸음")를 만들 때, 원칙적으로
   이 파일 + data.js(콘텐츠) + assets/(도식) 만 바꾸면 된다.
   docs/엔진_경계.md 참고. CURRICULUM(data.js)과 같은 방식으로 최상단
   const 선언 — 다른 스크립트에서 SITE_CONFIG로 바로 참조한다.
   ========================================================================= */
const SITE_CONFIG = {
  course: "ax",                      // LMS 과정 식별자 — Supabase events.course, stats/brief ?course= 필터

  siteName: "사유의 방",              // 브랜드명. <title>·HUD 로고·슬라이드 나가기 버튼 등에 쓰인다
  siteSubtitle: "AX 실무 입문",       // <title> 조합: `${siteSubtitle} · ${siteName}`
  courseLabel: "AX",                 // 완주 축하 오버레이 등 짧은 배지에 쓰는 과정 약칭

  // {N}은 런타임에 실제 강의 총수(TOTAL, data.js에서 계산)로 치환된다.
  kicker: "AI TRANSFORMATION · {N}강",     // 입장 화면 상단 킥커
  tagline: "생각의 순서를 바꾸는 {N}강의 여정", // 입장 화면 부제
  enterHint: "클릭하여 사유의 방으로 입장합니다", // 입장 버튼 아래 안내

  defaultSkin: "sayu",               // 저장된 스킨이 없을 때 기본값 + Lv1에서 유일하게 해금된 스킨
  availableSkins: ["sayu", "paper", "neon", "pixel", "blueprint"],
  // ↑ 순서가 곧 PC 해금 순서(Lv1→2→3→4→5). defaultSkin은 반드시 0번째와 일치해야 한다.

  introThemes: ["star", "sakura", "fireworks", "snow"],
  // ↑ intro.js의 렌더 로직(THEMES)에 이미 정의된 테마 중 실제 노출할 것만 골라 담는다.
  //   주의: index.html의 #intro-grid 4분할 버튼은 아직 정적 마크업이라, 테마 개수를
  //   바꾸려면(예: 3개로 축소) index.html도 함께 수정해야 한다 — docs/엔진_경계.md 참고.

  fxLevel: "full",                   // 'full' | 'calm' — calm은 폭죽·워프·상자 등장연출을 페이드로 대체
  practiceRoom: true,                // 진단실(3층 스테이션) 노출 여부. false면 입장 화면에서 완전히 숨김

  finalMessage: "사람이 방향, AI가 초안"   // 진단실 제안서 완성 화면 등에 반복 노출되는 핵심 문구
};
