/* =========================================================================
   site-config.js — 이 사이트를 정의하는 단 하나의 파일
   -------------------------------------------------------------------------
   이 저장소를 복제해 새 사이트(예: "AI 첫걸음")를 만들 때, 원칙적으로
   이 파일 + data.js(콘텐츠) + assets/(도식) 만 바꾸면 된다.
   docs/엔진_경계.md 참고. CURRICULUM(data.js)과 같은 방식으로 최상단
   const 선언 — 다른 스크립트에서 SITE_CONFIG로 바로 참조한다.
   ========================================================================= */
const SITE_CONFIG = {
  course: "codyssey-m1",             // LMS 과정 식별자 — Supabase events.course, stats/brief ?course= 필터

  siteName: "비전공자를 위한 기초공사",   // 브랜드명. <title>·HUD 로고·슬라이드 나가기 버튼 등에 쓰인다
  siteSubtitle: "미션 1, 대체 뭘 한 거지", // <title> 조합: `${siteSubtitle} · ${siteName}`
  courseLabel: "미션 1",              // 완주 축하 오버레이 등 짧은 배지에 쓰는 과정 약칭

  // {N}은 런타임에 실제 강의 총수(TOTAL, data.js에서 계산)로 치환된다.
  kicker: "SYSTEM PROGRAMMING · {N}강",        // 입장 화면 상단 킥커
  tagline: "터미널부터 GitHub까지, {N}강의 기록", // 입장 화면 부제
  enterHint: "클릭하여 비전공자를 위한 기초공사로 입장합니다", // 입장 버튼 아래 안내

  defaultSkin: "sayu",               // 저장된 스킨이 없을 때 기본값
  availableSkins: ["sayu", "pixel", "neon", "blueprint"],
  // ↑ 페이퍼는 이 사이트에서 제외(첫걸음 전용, 코드는 유지). defaultSkin은 반드시 이 배열에 포함돼야 한다.
  maxLevel: 3,                       // 회독 레벨 상한(게이미피케이션_Lv3_지시서 ②)
  rankTitles: ["", "Wanderer", "Thinker", "Visionary"],   // Lv1~3 칭호(기존 5단계 중 1·중간·최종 선별)
  skinUnlockLevel: { sayu: 1, pixel: 1, neon: 2, blueprint: 3 },   // 스킨별 해금 Lv(PC 기준, 명시 안 하면 배열 순서로 폴백. skinGating=false면 미사용)
  skinGating: false,                 // Lv 관계없이 모든 스킨을 처음부터 전부 사용 가능

  introThemes: ["star", "sakura", "fireworks", "snow"],
  // ↑ intro.js의 렌더 로직(THEMES)에 이미 정의된 테마 중 실제 노출할 것만 골라 담는다.
  //   주의: index.html의 #intro-grid 4분할 버튼은 아직 정적 마크업이라, 테마 개수를
  //   바꾸려면(예: 3개로 축소) index.html도 함께 수정해야 한다 — docs/엔진_경계.md 참고.

  fxLevel: "full"                    // 'full' | 'calm' — calm은 폭죽·워프·상자 등장연출을 페이드로 대체
};
