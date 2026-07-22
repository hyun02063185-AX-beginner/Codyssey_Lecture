# 검증 리포트 — AX 상자2 (qa-runner)

**대상**: `C:\Users\hyun0\AX_Lecture` (본진), netlify dev를 포트 8896에서 offline 모드로 기동
**범위**: 상자2(06~10강, `CURRICULUM.boxes` 중 `id:"tools"`) 기능 회귀 + variant 검증
**사전 확인**: 세션 시작 시 파일 수정 없음(Edit/Write 도구 미사용), 종료 시 `git status`로 재확인 — 작업 중 어떤 파일도 변경되지 않음

| 항목 | 결과 | 비고 |
|---|---|---|
| npm test | ✅ | `node --test` 86개 전부 pass (tests 86, pass 86, fail 0) |
| 06~10강 전 슬라이드 렌더 | ✅ | localStorage 초기화 후 `#/lecture/6~10` 진입, `get_page_text`로 각 강 전체 슬라이드(13~17장) 텍스트 확인 — undefined·빈 슬라이드·깨진 렌더 없음. 슬라이드 수: 06=14, 07=17, 08=17, 09=13, 10=13 (js/data.js와 일치) |
| 07·08강 도식(SVG) 로드/줌 | ✅ | 참조되는 SVG 13개(범용 5개 + 경험판 8개) 전부 `assets/`에 존재, `naturalWidth>0 && complete:true`로 로드 확인. 이미지 클릭 시 `.img-zoom.show` 오버레이 정상 동작 (7강 slide4·5, 8강 slide4, 경험판 7강 slide3·5, 8강 slide2·6·8·12·15 전수 확인) |
| variant — 기본 URL | ✅ | `#/lecture/7`, `#/lecture/8` → 범용판(slides) 렌더, 각 17장 (`1/17` 카운터 확인) |
| variant — `?variant=personal` | ✅ | `?variant=personal#/lecture/7` → 14장(`slidesPersonal`), `?variant=personal#/lecture/8` → 16장. `window.__variantPersonal===true`, HUD에 `.hud__vp`(텍스트 "P", title="경험판(personal) 모드") 요소 존재 확인 |
| variant — 이어보기 방어 처리 | ✅ | 아래 재현 절차 참고. 범용판 17장 중 16번째(index 15)까지 보고 나간 뒤 경험판(14장)으로 재진입 시 인덱스가 13으로 클램프되어 에러 없이 정상 진입(`14/14`로 표시) |
| 티저 체인 (5→6→7→8→9→10→11) | ✅ | 각 강 closing.teaser 텍스트 확인: 5강("다음 상자: 도구")→6강("다음 강: 지식검색 RAG")→7강("다음 강: AI 에이전트 입문")→8강("다음 강: 자동화 도구")→9강("다음 강: 나만의 AI 도구 스택")→10강("다음 상자: 적용 — 문서·보고서 자동화부터")→11강(문서·보고서 자동화). 끊김 없음 |
| 5개 스킨 전환(sayu·paper·neon·pixel·blueprint) | ✅ | `ax_room_level_v1=5`로 게이팅 해제 후 `.skin-opt` 5개 전부 unlocked 확인, 순차 클릭 시 `document.documentElement.dataset.skin` 정상 반영, 룸/슬라이드 화면 양쪽에서 콘솔 에러 0건 |
| 375px 오버플로 | ✅ | mobile 프리셋(375×812)에서 룸·06~10강 슬라이드·이미지 줌 오버레이 전부 `document.body.scrollWidth === window.innerWidth`(375) 확인, 가로 스크롤 없음 |
| 핵심 훑기(TOC) | ✅ | `#toc-btn`→`#toc-core` 토글 후 `#toc-list`에 20개 강 전체의 big/quote/closing 문구 노출 확인(예: 07강 "100 < 10", "없는 건 찾을 수 없다", "지식검색은 조직의 기억을 꺼낸다" / 08강 "프롬프트랑 뭐가 다르지?", "멈출 줄 아는 AI가 일을 잘하는 AI다" 등). 이 화면에서 이어보기 칩("▶ 5/17")도 함께 정상 노출 |
| 콘솔 에러 | ✅ 0건 | 전 과정(렌더·zoom·variant 전환·스킨 전환·375px·TOC·이어보기)에서 `read_console_messages` 결과 항상 "No console logs". 단, 테스터가 `dealFan('tools')`를 직접(문자열 인자로) 호출해 의도적으로 유발한 TypeError 1건 있었음 — 이는 정상 UI 플로우(`#/box/1` 해시 이동)로 재현되지 않는 **테스터 자신의 오사용**이며 실제 버그 아님(아래 참고) |

## 참고 — 실제 버그 아님(테스터 오사용, 재현 불가 확인됨)

`window.dealFan('tools')`처럼 `room.js`의 `dealFan(boxIndex)`에 문자열 id를 직접 넘겨 호출하면 `TypeError: Cannot read properties of undefined (reading 'name')`가 발생합니다(`js/room.js:67`, `box.name` 참조 시 `CURRICULUM.boxes['tools']`가 `undefined`이기 때문 — 이 함수는 정수 인덱스를 기대함). 정상 UI 경로인 해시 이동 `#/box/1`으로 같은 상자(도구, index=1)를 열었을 때는 콘솔 에러 없이 정상 동작했습니다. 내부 함수를 콘솔에서 직접 호출할 때만 발생하는 인자 타입 불일치이며, 실사용 경로에서는 재현되지 않습니다.

## variant 이어보기 방어 테스트 — 재현 절차

1. `localStorage.clear()`로 초기화
2. `#/lecture/7/15`로 이동 (범용판 17장 중 16번째, 0-based index 15) → 카운터 `16 / 17` 확인, `localStorage.getItem('ax_room_resume_v1')` → `{"7":15}` 저장 확인
3. `?variant=personal#/lecture/7` (슬라이드 번호 없이, "이어보기 위치에서 진입")로 이동
   - 라우터 로직(`js/main.js`): URL에 슬라이드 번호가 없으면 `Resume.get(7)`(=15)를 `openLecture`에 전달
   - `openLecture`(`js/slides.js:153`): `current = Math.max(0, Math.min(slideIndex || 0, slides.length - 1))` → `slides`는 경험판(14장, index 0~13) → `Math.min(15, 13) = 13`으로 클램프
4. 기대: 에러 없이 경험판 마지막 슬라이드(14/14)로 진입, URL 해시가 `#/lecture/7/13`으로 자동 보정
5. 실제: 정확히 기대대로 동작 — 콘솔 에러 0건, 카운터 `14 / 14` 표시, 해시 `?variant=personal#/lecture/7/13`으로 정상 치환됨

## 사용한 도구 명령 (참고용 재현 스니펫)

```js
// 클램프 검증
localStorage.clear();
location.href = 'http://localhost:8896/#/lecture/7/15';
// → counter "16 / 17", localStorage['ax_room_resume_v1'] === '{"7":15}'

location.href = 'http://localhost:8896/?variant=personal#/lecture/7';
// → counter "14 / 14", location.hash === '#/lecture/7/13' (자동 클램프, 에러 없음)
```

## 종료 처리

- 작업 종료 후 `localStorage.clear()`로 브라우저 상태 초기화
- netlify dev 프로세스(PID 20700, `netlify-cli dev --port 8896 --no-open --offline`) 및 부모 npx 프로세스(PID 23036) 종료, `netstat`으로 8896·3999(정적 서버 내부 포트) 모두 리스닝 해제 확인
- `.claude/launch.json`은 수정하지 않았으며, 저장소 파일도 이번 세션 동안 전혀 변경하지 않음(`git status`로 재확인 — 시작 시점부터 있던 `js/data.js` 미스테이지 변경 및 `order/` 미추적 파일만 그대로 남아 있음, 본 작업과 무관)

## 관련 파일 경로

- `C:\Users\hyun0\AX_Lecture\js\data.js` — 06~10강 slides/slidesPersonal/closing.teaser 정의
- `C:\Users\hyun0\AX_Lecture\js\slides.js` — variant 분기(151~152행), 이어보기 인덱스 클램프(153행), 이미지 줌(257~316행)
- `C:\Users\hyun0\AX_Lecture\js\main.js` — VARIANT_PERSONAL 플래그(21~26행), Resume 저장/조회(72~84행), HUD "P" 뱃지(701~709행), 스킨 게이팅(29~39행)
- `C:\Users\hyun0\AX_Lecture\js\room.js` — 카드 이어보기 칩/열람 표시(78~94행), `dealFan(boxIndex)`(62~67행)
- `C:\Users\hyun0\AX_Lecture\assets\` — 06~08강 참조 SVG 13개 전체 존재 확인
