# 검증 리포트 — AX 상자3 (qa-runner)

**대상**: `AX_Lecture` 저장소, 상자3 "적용"(`CURRICULUM.boxes[2]`, id: `apply`) — 11~15강, netlify dev를 포트 8893(오프라인 모드)으로 별도 기동해 검증. variant 없음(11~15강 모두 `slidesPersonal`/`slidesVariants` 미보유) 확인됨.

| 항목 | 결과 | 비고/재현 절차 |
|---|---|---|
| npm test | ✅ | `npm test` → `tests 86 / pass 86 / fail 0`. 11~15강 각각 "기본 slides 구조·타입·필수필드·teaser 유효" 3종(slides/slidesPersonal/slidesVariants) 모두 통과. |
| 린트 원복 확인 | ✅ | `tests/content-lint.test.js:80` `checkDeck(deck, label, errors, { requireTeaser, strictLastClosing = true })` — 기본값 `true`(마지막 슬라이드=closing) 확정. 11~15강은 `slidesPersonal` 자체가 없어 이 완화 분기(`strictLastClosing=false`)가 적용될 대상도 아니며, 순수 `slides` 배열 전부가 기본 규칙(마지막 슬라이드가 closing 타입)을 만족해 통과. |
| 렌더 | ✅ | localStorage 초기화 후 `#/lecture/{11..15}/0` 진입. DOM 슬라이드 개수가 data.js와 일치(11:13, 12:12, 13:13, 14:12, 15:14), `body.innerText`에 `undefined` 문자열 0건. |
| 도식 로드·확대 | ✅ (단, 아래 참고) | 상자3에서 실제 `type:'image'` 슬라이드는 **11강(index3, `assets/diagram-draft-loop.svg`)과 15강(index3, `assets/diagram-workflow-anatomy.svg`)** 2개뿐 — 12강엔 image 타입 슬라이드가 없음(지시문의 "11·12강"과 실제 데이터가 다름, 아래 참고 참조). 두 SVG 모두 `naturalWidth:267`로 정상 로드(`complete:true`), `img.s-img` 클릭 → `.img-zoom` `show` 클래스 부여, `zimg.src`가 해당 asset 경로로 정확히 세팅됨을 확인. |
| 티저 체인 | ✅ | 정적 데이터 대조: 10강 closing `teaser`(다음 상자: 적용) → 11(다음 강: 마케팅·콘텐츠) → 12(다음 강: 데이터 정리와 분석) → 13(다음 강: 이메일·커뮤니케이션 자동화) → 14(다음 강: 업무 워크플로우 설계) → 15(다음 상자: 지속 — 자산 보호부터) → 16강 제목("조직 자산과 데이터 보호")까지 끊김 없이 일치. |
| 이어보기 | ✅ | 11(idx3)/13(idx6)/15(idx3) 슬라이드 방문 후 `#/box/2` 카드 목록에서 각각 "▶ 이어보기 4/13", "▶ 이어보기 7/13", "▶ 이어보기 4/14" 정상 표시. idx0에서만 본 12·14강은 이어보기 표시 없이 "✓ 열람함"만 표시(기대 동작). |
| 핵심 훑기 | ✅ | `#toc-btn` 클릭 → 패널 오픈 → `#toc-core`("⚡ 핵심 훑기") 클릭 → `#toc-list`에 11강 big("가장 힘든 건 '첫 줄'이다") · quote("AI가 못 쓰는 글은 없다…") · closing("백지 대신 초안에서") 텍스트가 정상 노출. 이어보기 배지("▶ 4/13")도 목록에 함께 표시됨. |
| 스킨 전수 | ✅ | Lv 게이팅 우회 위해 `localStorage['ax_room_level_v1']='5'` 설정 후 재로드(`App.Level.n===5`, PC 기준 5종 전부 해금 조건 충족). `App.Skin.set()`으로 sayu·paper·neon·pixel·blueprint 순차 전환, `document.documentElement.dataset.skin` 모두 정확히 반영, 전환 중 콘솔 에러 0건, `body.scrollWidth>innerWidth` 전부 false. |
| 375px | ✅ | `resize_window(mobile, 375x812)` 후 11~15강 각 대표 슬라이드(커버/이미지/일반 슬라이드) 및 상자3 카드 목록(`#/box/2`)에서 `document.body.scrollWidth === window.innerWidth === 375`(오버플로 없음). |
| 콘솔 0 | ✅ | 렌더·이어보기·핵심 훑기·스킨 전환(5종)·375px 리사이즈 전 과정에서 `read_console_messages` 에러/경고 0건. |
| 텔레메트리 | (해당없음/이번엔 미실행) | `.env`에 `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` 존재는 확인했으나(서버 부팅 로그에 "Injected .env file env vars" 표시), 이번 지시문(상자3 기능 회귀)에 텔레메트리 항목이 포함돼 있지 않아 실행하지 않음. |
| ?variant=personal | (해당없음, 지시대로 확인) | 지시문 명시대로 "이 상자엔 variant 없음" — 11~15강 전부 `slidesPersonal` 미보유 재확인(구조 검사 통과 로그 및 `js/data.js` 771~1021행 직접 열람으로 image 슬라이드 2건 외 `type:'image'`/variant 관련 필드 부재 확인). 07·08강 전용 기능이라 상자3 범위 밖. |
| ?join= | (해당없음, 이번 범위 아님) | 상자3 기능 회귀 지시 항목에 미포함 — 미실행. |
| #/admin | (해당없음, 이번 범위 아님) | 상자3 기능 회귀 지시 항목에 미포함 — 미실행. |
| 진단실 | (해당없음, 이번 범위 아님) | 상자3 기능 회귀 지시 항목에 미포함 — 미실행. |
| 키 비노출 | ✅ | ADMIN_KEY·SUPABASE_SERVICE_KEY·AI_API_KEY 등 `.env` 원문 값은 이 보고서 어디에도 기재하지 않음(서버 로그에서 변수명만 확인, 값은 미조회). |

## 참고 (실패 아님, 지시문과 실데이터 차이)

지시문에 "도식 로드 및 확대(zoom) — 11·12강이 참조하는 image 타입 슬라이드"라고 되어 있으나, `C:\Users\hyun0\AX_Lecture\js\data.js`를 직접 확인한 결과 상자3(11~15강)에서 `type: 'image'` 슬라이드는 **11강**(`assets/diagram-draft-loop.svg`, 774~783행)과 **15강**(`assets/diagram-workflow-anatomy.svg`, 967~1020행 중 978행)뿐이고, **12강에는 image 타입 슬라이드가 없음**(split·bullets·big·quote·closing으로만 구성). 실제 존재하는 2개(11·15강) 도식 모두 정상 로드·확대 동작을 확인했다. 12강에 도식이 빠진 것 자체가 버그인지 여부는 판단하기 애매함(원래 기획상 12강은 이미지 슬라이드 없이 설계됐을 수 있음) — 사용자 확인 필요.

## 환경/절차 메모

- netlify dev는 `.claude/launch.json` 수정 없이 `npx netlify-cli dev --port 8893 --no-open --offline`로 별도 기동(cwd: `C:\Users\hyun0\AX_Lecture`). 서버 로그: `Local dev server ready: http://localhost:8893`.
- 검증 완료 후 포트 8893 리스닝 PID(34608, 자식 29804 포함)를 `taskkill /F /T`로 종료, `netstat`으로 포트 미점유 재확인 완료.
- 브라우저 패널이 사용자 쪽에 표시되지 않아(`screenshot` 타임아웃) 시각 확인은 생략하고 전 과정을 DOM/콘솔/네트워크 기반(`javascript_tool`, `get_page_text`, `read_page`, `read_console_messages`)으로 대체 확인함.
- 주요 참조 파일: `C:\Users\hyun0\AX_Lecture\js\data.js`(771~1021행, 상자3 강의 데이터), `C:\Users\hyun0\AX_Lecture\js\slides.js`(image 렌더링·zoom 로직), `C:\Users\hyun0\AX_Lecture\js\main.js`(라우팅·Level·Skin 게이팅), `C:\Users\hyun0\AX_Lecture\tests\content-lint.test.js`(strictLastClosing 기본값).

수정은 수행하지 않았으며, 위 발견 사항(12강 image 슬라이드 부재)에 대한 후속 조치 여부는 사용자 판단이 필요합니다.
