# 검증 리포트 — AX 상자4 (boundary-keeper)

> 실행 저장소: `AX_Lecture`(본진, `C:\Users\hyun0\AX_Lecture`) — 대조 대상: `AI_First_Step`(첫걸음, `C:\Users\hyun0\AI_First_Step`)
> 실행 시점: 2026-07-23. 두 저장소 모두 `git diff`(working tree, 파일 실제 바이트) 기준으로 대조했다 — "미커밋 발견"에 유의.

---

## 임무 1 — 규범 동기화 상태 검사 (boundary-keeper 6단계, 첫 실행)

### 대조 결과
| 파일 | 상태 | 비고 |
|---|---|---|
| `.claude/agents/boundary-keeper.md` | 동일 | 바이트 단위 diff 0. 단, 양쪽 모두 마지막 커밋 대비 미커밋 상태(아래 갭 ① 참고) |
| `.claude/agents/persona-reviewer.md` | 차이(정당) | 본진=페르소나 variant 미이식(실무자 단일 관점), 첫걸음=김주임/박선배/최사장 다중 페르소나 |
| `.claude/agents/qa-runner.md` | 차이(정당) | `?variant=personal`+진단실(본진 고유) vs `?variant=<페르소나키>`(첫걸음) 표본 항목 차이 |
| `.claude/agents/release-manager.md` | 동일 | 바이트 단위 diff 0 |
| `.claude/agents/tone-keeper.md` | 차이(정당, 기록 정밀성 흠) | "배열이 정본" 판정 원칙은 양쪽 동일 확인(1라운드 갭 해소 확인 — 단 첫걸음 쪽은 미커밋, 갭①). 나머지 차이는 본진 전용 경험판 어투 예외 조항(2라운드 반영, 이미 커밋됨) — 첫걸음엔 경험판이 없어 대응 불필요해 정당. 다만 §7 4라운드 기록에 이 항목이 개별 언급되지 않아 기록이 불완전(갭 ④) |
| `docs/UX_원칙.md` | 동일 | 바이트 단위 diff 0 |
| `docs/엔진_경계.md` | 차이(정당, self-referential) | §1~§7 번호 체계·소제목 순서 완전 일치. 본문은 각 저장소가 "이 저장소" 시점으로 서술해 문구가 다르지만 상호 모순 없음 |
| `docs/에이전트_운영.md` | 차이(정당, 경미한 비대칭) | "표준 파이프라인" 코드블록 바이트 단위 동일("규범 동기화 검사" 단계 포함, 갭③ 해소 확인). "하네스와의 관계" 절 둘 다 실제 상태로 갱신됨(갭②·③ 해소 확인). 단 본진에만 "첫걸음판과의 차이" 절이 있음(갭 ③) |
| `tests/aggregate.test.js` | 동일 | 바이트 단위 diff 0 |
| `tests/functions-contract.test.js` | 동일 | 바이트 단위 diff 0 |
| `tests/content-lint.test.js` | 차이(정당, 예외 대상) | 린트 상수는 완전 동일. 실질 차이는 (a) 본진 전용 `slidesPersonal` 검사 블록 (b) 본진에서 도입한 `checkDeck()` 헬퍼 리팩터. 둘 다 `npm test` 통과(본진 86/86, 첫걸음 126/126) — 갭②로 별도 표기 |

### 방치된 갭
- **① 양쪽 저장소 모두 — 4라운드 동기화 변경분이 미커밋 상태**: `git status` 확인 결과, 본진은
  `.claude/agents/boundary-keeper.md`·`docs/엔진_경계.md`·`docs/에이전트_운영.md`·`docs/톤앤매너.md`가,
  첫걸음은 `.claude/agents/boundary-keeper.md`·`.claude/agents/tone-keeper.md`·`docs/엔진_경계.md`·
  `docs/에이전트_운영.md`가 모두 unstaged 상태로 working tree에만 존재한다. 위 "동일"·"정당" 판정은
  **커밋되지 않은 현재 파일 내용** 기준이며, 방치 시 유실 위험. 해소 제안: 본진 먼저 커밋 → 첫걸음
  커밋. 심각도: 중간(수용 가능, 단 조속 커밋 권장).
- **② `tests/content-lint.test.js` — `checkDeck()` 헬퍼 리팩터가 첫걸음에 미이식**: 순수 중복 제거
  리팩터(기능 차이 없음)라 §4 "테스트 골격 동기화" 대상에 더 가깝다. 심각도: 낮음(양쪽 전부 통과,
  수용 가능). 해소 제안: 다음 정리 때 본진→첫걸음 방향으로 이식 권장(급하지 않음).
- **③ `docs/에이전트_운영.md` — "차이" 섹션 비대칭**: 본진엔 "첫걸음판과의 차이" 절이 있는데 첫걸음엔
  대응 절이 없음. 기능 영향 없음. 심각도: 낮음(수용 가능). 해소 제안: 첫걸음에 "본진판과의 차이" 절
  추가하면 대칭 완성.
- **④ `.claude/agents/tone-keeper.md` — 경험판 예외 조항이 §7 4라운드 기록에 미기재**: 내용 자체는
  정당한 divergence로 판단되나(§2 경험판 조항과 상호 참조 정합 확인), "전수 대조"를 표방한 4라운드
  기록에서 이 항목만 빠짐. 심각도: 낮음(실질 결함 아님, 기록 정밀성 문제 — 수용 가능).

### 이식 이력 기록 제안 문안
- (양쪽 `docs/엔진_경계.md` §7에 공통) "2026-07-23 — 규범 동기화 상태 검사 최초 실행(boundary-keeper
  6단계, diff 무관 전수 대조): 4라운드에서 '해소'로 기록한 갭 재대조 결과 실제로 양쪽에서 diff 0 또는
  정합 확인. 단 미커밋 상태로 발견돼 커밋 권고. 추가로 경미한 갭 3건 발견(checkDeck 리팩터 미이식,
  에이전트_운영.md 차이 섹션 비대칭, tone-keeper.md 경험판 예외 §7 미기재) — 전부 심각도 낮음,
  다음 정리 때 반영 권장."

---

## 임무 2 — 상자4(16~20강) 자산 분류 확인

### 분류표
| 파일/영역 | 분류 | 비고 |
|---|---|---|
| `js/data.js`의 `CURRICULUM.boxes[id="sustain"]` 구조(16~20강) | 사이트 고유(§2) | "커리큘럼 콘텐츠 — 전량 교체 대상"에 정확히 해당. `slidesVariants`/`slidesPersonal` 둘 다 없음(사용자 전제와 일치) |
| `assets/diagram-data-gate.svg`(16강) | 사이트 고유(§2) | 파일 실존 확인, `npm test` 86/86으로 이미 보증됨 |
| `assets/diagram-ax-roadmap.svg`(20강) | 사이트 고유(§2) | 상동 |
| 17강("사람 확인 지점 설계") | 해당 자산 없음 | 이미지/도식 슬라이드가 아예 없다 — `split` 텍스트 슬라이드로 대체. 사용자가 제시한 "16·17강 도식" 전제는 실제와 다름 |
| 18강·19강 | 해당 자산 없음 | 이미지 슬라이드 없음(bullets/quote/big/split만 사용) — 상자4 전체 61장 중 `image` 타입은 단 2장(16·20강)뿐 |

### 백포트 후보
- 없음.

### 경계 침범
- 침범 없음. 공유 엔진 파일에 `diagram-data-gate`·`diagram-ax-roadmap`·`sustain` 문자열 전수 검색 결과 0건.

### 공유 규범 동기화
- 해당 없음(자산 분류 확인이라 §4 대상 아님). §3 신규 애매 항목도 없음(box4는 §2 규칙이 깔끔하게 들어맞는 사례).

### 이식 이력 기록 제안 문안
- 필요 없음.

---

### 참고 — 확인 과정에서 나온 부수 발견 (범위 밖, 참고용)
- `AX_Lecture`의 `js/data.js`에 상자4와 무관한 미커밋 변경(12강 "자기표절" 문구 수정)이 있음 — 이번
  라운드 ②(12강 인용 오류 교정)로 이미 authorized된 작업, 범위 밖이라 이 임무에서 판단하지 않음.

### 관련 파일 경로
- `C:\Users\hyun0\AX_Lecture\.claude\agents\boundary-keeper.md`, `docs\엔진_경계.md`, `docs\에이전트_운영.md`, `.claude\agents\tone-keeper.md`, `tests\content-lint.test.js`
- `C:\Users\hyun0\AX_Lecture\js\data.js`(1025행 `id: "sustain"` 이하 16~20강)
- `C:\Users\hyun0\AX_Lecture\assets\diagram-data-gate.svg`, `diagram-ax-roadmap.svg`
- `C:\Users\hyun0\AI_First_Step\.claude\agents\boundary-keeper.md` / `tone-keeper.md` / `persona-reviewer.md` / `qa-runner.md`
- `C:\Users\hyun0\AI_First_Step\docs\엔진_경계.md`, `docs\에이전트_운영.md`, `tests\content-lint.test.js`
