# 검증 리포트 — AX 상자4 (qa-runner)

**대상**: `C:\Users\hyun0\AX_Lecture` (본진), CURRICULUM.boxes 중 `id:"sustain"` (16~20강, 상자4 "지속"), variant 없음
**dev 서버**: `npx netlify-cli dev --port 8892 --no-open --offline` (작업 디렉터리 `AX_Lecture`, `.claude/launch.json` 미수정) — 검증 종료 후 프로세스(PID 34392) 정상 종료, 8892·3999 포트 LISTENING 없음 확인

| 항목 | 결과 | 비고/재현 절차 |
|---|---|---|
| npm test | ✅ | `npm test` → `tests 86 / pass 86 / fail 0` |
| 렌더(16~20강 전 슬라이드) | ✅ | localStorage.clear() 후 진입. 16~20강 전체(12+12+12+12+13=61슬라이드)를 `#/lecture/{id}/{i}` 순회 스캔 — `undefined`/`NaN`/`[object Object]`/빈 텍스트/이미지 미로딩 0건 |
| 도식 로드 및 확대(zoom) | ✅ | 실제 image 타입 슬라이드는 **16강·20강** 2개뿐(아래 "참고" 참조). 16강 `assets/diagram-data-gate.svg`(naturalWidth 267, complete true), 20강 `assets/diagram-ax-roadmap.svg`(동일) 모두 로드 확인. 이미지 클릭 → `.img-zoom`에 `show` 클래스 부여·확대 오버레이 정상 동작 확인 |
| 티저 체인 | ✅ | 15강 closing: `"...(다음 상자: 지속 — 자산 보호부터)"` → 16강 주제(조직 자산과 데이터 보호)와 일치. 16→17("사람 확인 지점 설계"), 17→18("AI 리스크와 윤리"), 18→19("팀에 AX 문화 심기"), 19→20("AX 로드맵 그리기") 모두 teaser 텍스트가 다음 강 제목과 정확히 대응. 20강 closing은 `"이제, 당신 차례입니다"` — 다음 강 예고 없이 과정 전체 마무리 문구로 확인(마지막 강 정상) |
| 이어보기 | ✅ | `#/lecture/16/5` 진입(6/12장) 후 `#/box/3` 카드 목록 확인 → 16강 카드에 `▶ 이어보기 6/12` 배지 정상 표시 |
| 핵심 훑기 | ✅ | `#toc-btn` → `#toc-core` → `#toc-list`에 16강 big, 18강 quote, 20강 closing 텍스트 모두 포함 확인 |
| 스킨 전수 | ✅ | Lv5까지 올린 뒤 sayu·paper·neon·pixel·blueprint 5종 전부 정상 전환, 375px에서 16~20강 × 스킨 조합 오버플로 0건 |
| 375px | ✅ | `resize_window(mobile)` 후 16~20강 대표 슬라이드 × 스킨 5종 + `#/box/3`·`#/room` 모두 오버플로 없음 |
| 콘솔 0 | ✅ | 전 과정(렌더, zoom, resume, TOC, 스킨 전수, 375px, 완주·업그레이드 4라운드) 누적 0건 |
| 텔레메트리 | (해당없음/미실행) | 지시 범위 외. 완주 시뮬레이션 중 수강 코드 미등록 상태라 네트워크 요청 자체 미발생 |
| ?variant=personal | (해당없음) | "variant 없음" — 미실행 |
| ?join= / #/admin / 진단실 | (해당없음) | 지시 범위 외 — 미실행 |
| **20강 완주 → 축하 연출 → 레벨업** | ✅ | 아래 "재현 절차" 참조 — 정상 동작 확인 |
| 키 비노출 | ✅ | `.env` 값 원문 미기록 |

## 참고 (사용자 지시 전제와 실제 데이터 차이)

지시문에는 "16·17강이 참조하는 image 타입 슬라이드"라고 되어 있으나, `js/data.js`를 실제로 확인한 결과 상자4에서 `type: 'image'`인 슬라이드는 **16강**(`diagram-data-gate.svg`)과 **20강**(`diagram-ax-roadmap.svg`) 두 곳뿐입니다. 17강은 `split` 타입("두 가지 안전 설계")으로 도식 이미지가 없습니다. 검증은 실제로 image 타입인 16강·20강 기준으로 수행했습니다(둘 다 정상).

## 20강 완주 → 축하 연출 → 레벨업 재현 절차 (상세)

**메커니즘**: `js/main.js`의 `Progress.mark(id)`가 `this.seen.size === TOTAL`(20)이 되는 순간 `celebrateCompletion()`을 자동 호출한다(`TEST_FILL_ALL` 디버그 플래그는 `false`로 정상 배포 상태 확인됨 — 이 플래그를 켜지 않고 20개 강 전부를 개별 `mark()` 하는 정석 경로로 재현). 각 강의 슬라이드 `show(i)`가 마지막 슬라이드에 도달하면 `Progress.mark(activeLecture.id)`가 호출되므로, 실사용에서는 20개 강을 각각 끝까지 넘기면 동일하게 트리거된다.

1. `localStorage.clear()` 후 페이지 로드(`App.Level.n === 1` 확인).
2. 브라우저 콘솔에서 20개 강 전부 완료 처리:
   ```js
   for (let id = 1; id <= 20; id++) App.Progress.mark(id);
   ```
3. 20번째 `mark()` 호출 시점에 `App.Progress.count() === App.TOTAL(20)`이 되며 `#celebrate` 오버레이가 자동으로 뜸.
   - 확인 결과: `celebrate.hidden = false`, `.show` 클래스 부여, `#celebrate-title` = `"훌륭히 완주하셨습니다."`, `#celebrate-sub` = `"20강 완주 · 업그레이드하면 Lv2 · Explorer"`, `#celebrate-up` 버튼 표시.
4. `#celebrate-up` 클릭(`doUpgrade()` 실행):
   - `App.Level.n` : 1 → **2** 로 실제 증가(HUD `#hud-rank` 텍스트가 `"Lv2 · Explorer"`로 즉시 갱신됨을 확인).
   - `Progress.reset()`이 함께 호출되어 발견도(seen)가 0으로 초기화(새 회독 시작 — 정상 설계).
5. **Lv별 문구 분기 확인**(추가 검증): 3회 더 반복해 Lv3→Lv4→Lv5까지 순차 확인.
   - Lv2→3, Lv3→4, Lv4→5 도달 시 매번 정확한 다음 등급명으로 갱신됨.
   - **Lv5(MAX_LEVEL) 도달 시**: 문구가 `"깊은 깨달음에 도달하셨습니다."` / `"통달 — 최고 경지에 이르렀습니다"`로 전환되고 `#celebrate-up` 버튼이 `hidden=true`로 숨겨짐 — 정상 동작.
6. 전 과정에서 콘솔 에러/경고 0건.

## 결론

상자4(16~20강) 범위의 회귀 항목 전부 정상(✅). ❌ 항목 없음. `npm test` 86/86 통과. 코드 수정은 수행하지 않았으며, 검증에 사용한 dev 서버는 종료하여 포트 점유가 남지 않았습니다.
