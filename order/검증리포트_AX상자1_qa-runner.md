# 검증 리포트 — AX 상자1 (qa-runner)

**대상:** AX_Lecture 로컬 저장소 (`C:\Users\hyun0\AX_Lecture`), `netlify-cli dev --port 8897 --no-open --offline`
**검증 범위:** 상자1(`CURRICULUM.boxes[0]`, id:"why") — 01~05강
**환경:** localStorage 초기화 후 진입, PC 뷰포트(1280×720) 기본, 스킨/375px 검증은 `Lv=5`(localStorage `ax_room_level_v1`)로 게이팅 해제 후 진행

| 항목 | 결과 | 비고/재현 절차 |
|---|---|---|
| npm test | ✅ | `node --test` 실행 → tests 86, pass 86, fail 0 (전체 스위트, 상자1 관련 3개 케이스 포함: `구역1·1강~5강 — 기본 slides 구조·타입·필수필드·teaser 유효` 등) |
| 렌더(01~05강 전 슬라이드) | ✅ | localStorage.clear() 후 `#/lecture/1`~`#/lecture/5` 순회. `get_page_text`로 전체 텍스트 추출 → `js/data.js` 원문과 일치. `body.innerText.includes('undefined')`/`'NaN'` 전부 false. 슬라이드 수도 데이터와 일치(1강 14장, 2강 13장, 3강 15장, 4강 14장, 5강 13장) |
| 도식 로드·확대(zoom) | ✅ | 01강 `diagram-ax-stairs.svg`, 02강 `diagram-fallen-barriers.svg`, 03강 `diagram-next-word.svg`, 04강 `diagram-prompt-4.svg` 전부 `naturalWidth>0`(267)로 정상 로드 확인. 01강에서 `+`키(`openZoom`) → `.img-zoom`에 `show` 클래스 부여·`img.src` 정확히 세팅됨, `-`키(`closeZoom`)로 정상 해제됨. (5강은 데이터상 image 슬라이드 없음 — 정상, 티저 체인만 있음) |
| 티저 체인 | ✅ | 01강 closing: `"...(다음 강: 왜 지금인가)"` → 02강 title "왜 지금인가" 일치. 02→03("AI를 대하는 태도"), 03→04("프롬프트의 기초"), 04→05("좋은 질문이 좋은 답을 만든다") 각각 title 일치. 05강 closing: `"...(다음 상자: 도구 — 생성형 AI 지형도)"` → 상자2 이름 "도구" + 06강 title "생성형 AI 지형도"와 일치. UI(`#/lecture/1`, `#/lecture/5`)에서도 동일 문구 렌더링 확인 |
| 이어보기(resume) | ✅ | 02강 슬라이드 6/13에서 `Esc`로 카드 목록 이탈 → 카드에 `▶ 이어보기 6/13` 표시 확인(01강도 중간 이탈 시 `▶ 이어보기 4/14` 표시). `#/lecture/2` 재진입 시 `scene-slides` 내부 카운터가 즉시 `6 / 13`으로 복귀 |
| 핵심 훑기 | ✅ | `#toc-btn` 클릭 → `#toc-core`(`⚡ 핵심 훑기`) 클릭 시 `aria-pressed="true"`로 전환, `#toc-list`에 01~05강 각각 big/quote/closing 발췌 문구(`AX ≠ AI 도구 도입`, `AX는 AI 프로젝트가 아니라...`, `사람이 방향, AI가 초안`, `AX는 도구가 아니라 방식이다` 등) 정상 표시 + resume 마커(`▶ 4/14`, `▶ 6/13`)도 함께 노출 |
| 스킨 전수 | ✅ | `Lv=5`로 게이팅 해제 후 `App.Skin.set()`으로 sayu·paper·neon·pixel·blueprint 5종 순차 적용 → `document.documentElement.dataset.skin` 각각 정확히 반영, 전환 중 콘솔 에러 0건 |
| 375px 오버플로 | ✅ | `resize_window(mobile, 375×812)` 후 (a) 5개 스킨 전환 상태에서 02강 슬라이드, (b) 01강 image(도식) 슬라이드, (c) 상자1 카드 목록(`#/box/0`) 각각 `document.body.scrollWidth(375) > window.innerWidth(375)` → 전부 false |
| 콘솔 0 | ✅ | 인트로 진입→테마 선택→상자1 카드 진입→01~05강 순회→zoom 열기/닫기→resume→TOC 훑기→스킨 5종 전환→375px 리사이즈, 전 과정에서 `read_console_messages` 결과 "No console logs"(에러/경고 0건) |
| 텔레메트리 | (해당없음) | 이번 검증 범위(상자1 기능 회귀)에는 텔레메트리 검증이 요청 항목에 없어 생략함. 참고로 `.env`에 `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`는 존재(dev 서버 부팅 로그에 "Injected .env file env vars" 확인됨)하나 값은 노출하지 않음 |
| ?variant=personal | (해당없음) | 요청 범위 밖(7·8강 전용 항목이며 상자1은 07·08강 미포함) — 미검증 |
| ?join= | (해당없음) | 요청 범위 밖 — 미검증 |
| #/admin | (해당없음) | 요청 범위 밖 — 미검증 |
| 진단실 | (해당없음) | 요청 범위 밖(상자1 한정 회귀 검증) — 미검증 |
| 키 비노출 | ✅ | 본 보고서 어디에도 `.env`의 `SUPABASE_SERVICE_KEY`/`ADMIN_KEY`/`AI_API_KEY`/`SUPABASE_URL` 원문 값을 기재하지 않음(존재 여부만 언급) |

## ❌ 항목 재현 절차
해당 없음 — 상자1(01~05강) 범위에서 실패 항목 없음.

## 부가 메모
- 테스트 중 발견한 사소한 함정(버그 아님): `location.hash` 를 JS로 세팅한 직후 같은 스크립트 실행문 안에서 곧바로 DOM을 읽으면 `hashchange` 처리가 비동기라 이전 화면 내용이 잡힐 수 있음(테스트 하네스의 타이밍 이슈일 뿐, 앱 동작 자체는 정상). 별도 `javascript_exec` 호출로 나누어 재확인해 문제없음을 검증함.
- dev 서버는 `.claude/launch.json`을 수정하지 않고 Bash로 직접 `npx netlify-cli dev --port 8897 --no-open --offline`를 백그라운드 실행하는 방식으로 띄웠음(기존 launch.json에는 다른 프로젝트(Last_Lecture) 설정이 섞여 있어 "수정 절대 금지" 원칙에 따라 손대지 않음).
- 작업 종료 후 프로세스 트리를 강제 종료하고 `Get-NetTCPConnection -LocalPort 8897 -State Listen`으로 리스너 없음을 재확인함(포트 점유 없음).

**관련 경로**
- `C:\Users\hyun0\AX_Lecture\js\data.js` (상자1·01~05강 slides 데이터, closing.teaser)
- `C:\Users\hyun0\AX_Lecture\js\main.js` (Router, Skin/Level 로직, resume)
- `C:\Users\hyun0\AX_Lecture\js\slides.js` (image 슬라이드 렌더 + zoom 로직, 라인 67-83, 257-341)
- `C:\Users\hyun0\AX_Lecture\js\site-config.js` (availableSkins 정의)
- `C:\Users\hyun0\AX_Lecture\assets\diagram-ax-stairs.svg`, `diagram-fallen-barriers.svg`, `diagram-next-word.svg`, `diagram-prompt-4.svg`
- `C:\Users\hyun0\AX_Lecture\tests` (npm test 대상, 86개 케이스)
