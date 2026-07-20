# CC 작업 지시서 — LMS 1단계: 수강생 코드 + 데이터 수집 (Supabase)

> 위치: `Last_Lecture/order/LMS_1단계_수집_지시서.md` · 경로는 프로젝트 루트 기준.
> **브랜치 `feature/lms`에서 작업** (처음 생기는 서버 코드 — main의 실서비스 v1 보호).
> 개발·검증은 로컬 중심(`netlify dev`). push는 해도 되나 Netlify 배포는 크레딧 리셋 후.

---

## 목표

강사가 수강 현황을 볼 수 있도록, **개인 브라우저에 갇힌 데이터가 서버로 흐르는 첫 관**을 만든다.

```
[수강생: 코드 입장] → [학습·진단 이벤트 발생] → [Netlify Function /track] → [Supabase]
```

- 이번 범위 = **수집까지만.** 조회 화면(대시보드)은 2단계.
- 설계 원칙: **localStorage가 여전히 UX의 원본** — 서버 전송은 부가(telemetry). 서버가 죽어도 학습 경험은 1도 달라지지 않는다(fail-silent).

---

## 0. 사람이 먼저 할 일 (사용자 직접 — CC가 대신하지 않음)

1. **Supabase 가입·프로젝트 생성** — supabase.com, 무료 티어, 리전은 가까운 곳.
2. **테이블 생성** — Supabase SQL Editor에서 (CC가 아래 SQL을 정확한 최종본으로 다듬어 별도 파일 `docs/supabase_setup.sql`로도 제공할 것):

```sql
create table events (
  id bigint generated always as identity primary key,
  code text not null,              -- 수강생 코드 (예: A반-07)
  event_type text not null,        -- lecture_complete / diagnosis_result / session_start ...
  payload jsonb,                   -- 이벤트 상세 (강의 id, 진단 점수 JSON 등)
  created_at timestamptz default now()
);
-- RLS 활성화(외부 직접 접근 차단; 쓰기는 서버 함수의 service key로만)
alter table events enable row level security;
```

3. **키 2개 확보** — Project URL, `service_role` 키 (Settings → API).
4. **키 등록** — Netlify 환경변수 `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` + 로컬 개발용 `.env` 파일(같은 키). **`.env`는 .gitignore에 반드시 추가**(CC가 확인).

> 🔒 service_role 키는 절대 프론트/저장소에 넣지 않는다. 함수(서버)에서만.

---

## 1. 수강생 코드 입장 (프론트)

- **입장 화면에 "수강 코드" 입력(선택 사항)** — 작게, 기존 흐름을 막지 않게. 코드 없이 입장하면 지금과 100% 동일(수집 없음, 익명 개인 사용).
- 코드 입력 시: 간단 검증(2~20자, 공백 제거) → localStorage(`ax_student_code`) 저장 → HUD 구석에 작게 표시(예: "A반-07").
- 코드 변경/제거 UI(작게) 포함. `#/reset`은 코드도 함께 초기화.
- **수집 안내 한 줄(투명성, 16강 원칙)**: 코드 입력 영역에 "코드를 입력하면 학습 진행 상황이 강사에게 전달됩니다" 고정 문구.

## 2. 이벤트 수집 (프론트 훅)

코드가 **있을 때만** 전송. 이벤트 최소 세트:

| event_type | 발생 시점 | payload |
|---|---|---|
| `session_start` | 코드 입장 직후 (세션당 1회) | { skin, viewMode } |
| `lecture_complete` | 강의 마지막 슬라이드 도달(기존 완료 판정 시점) | { lectureId, level } |
| `run_complete` | 20강 완주(업그레이드) | { newLevel } |
| `diagnosis_result` | 진단실 검사 완료 시(3종 각각) | { kind: literacy/native/tacit, scores(JSON) } |
| `proposal_created` | 제안서 최초 완성 | { hasAll: bool } |

- 전송: `fetch('/.netlify/functions/track', {method:'POST', body: JSON.stringify({code, event_type, payload})})`.
- **fail-silent**: 실패 시 콘솔 debug만, 재시도 큐 없음(1단계 단순화), UX 영향 0. 로컬 `python http.server`(함수 없음)에서도 조용히 무시되는지 확인.
- 중복 방어: 같은 강의 완료 이벤트는 세션 내 1회만(간단 플래그).

## 3. Netlify Function `track` (서버)

- `netlify/functions/track.js` (+ `netlify.toml` functions 설정 없으면 추가).
- POST만 허용. 입력 검증: code(2~20자)·event_type(위 화이트리스트)·payload 크기 상한(8KB).
- Supabase REST(`/rest/v1/events`)로 insert — 헤더에 service key(env). supabase-js 설치보다 **fetch 직접 호출 권장**(의존성 최소, 정적 프로젝트 유지).
- CORS: 자기 도메인(+localhost) 허용. 간단 레이트 리밋(같은 IP 분당 30회 초과 시 429 — 메모리 기반이면 충분).
- 응답은 204(본문 없음). 오류도 4xx/5xx만 — 상세 내부정보 노출 금지.

## 4. 로컬 개발·검증

```bash
git checkout -b feature/lms
netlify dev            # 함수 포함 로컬 (.env 자동 로드)
```

- [ ] 코드 없이: 기존과 완전 동일, 네트워크 요청 0.
- [ ] 코드 입장: session_start 1건이 Supabase events에 실제 insert (Supabase Table Editor에서 육안 확인).
- [ ] 강의 1개 완주 → lecture_complete 1건(payload에 lectureId). 재진입 반복 시 중복 없음.
- [ ] 진단 검사 1종 완료 → diagnosis_result 1건(scores JSON 온전).
- [ ] 함수 없이(`python http.server`) 구동 → 조용히 무시, 콘솔 에러 0(경고/디버그 수준만).
- [ ] 잘못된 요청(GET, 미등록 event_type, 8KB 초과) → 4xx.
- [ ] 프론트 소스·네트워크 탭에 Supabase 키 노출 없음.
- [ ] `.env`가 git 추적에 없음(`git status`).

## 5. 문서화

- `docs/운영자_치트시트.md`에 추가: 수강 코드 발급 규칙 제안(예: `반이름-번호`), 수집되는 이벤트 목록, Supabase에서 데이터 눈으로 보는 법(Table Editor 경로), 끄는 법(코드 없이 쓰면 수집 없음 / env 키 제거 시 전체 중단).
- `docs/supabase_setup.sql` — 0번의 최종 SQL.

---

## 가드레일

- **feature/lms에서만 작업**, main 무변경. 커밋은 브랜치에 쌓고 push 가능(배포는 어차피 크레딧 리셋 후).
- 콘텐츠(data.js 슬라이드)·엔진·진단실 로직 변경 최소화 — 기존 완료 판정/검사 완료 지점에 **훅만 꽂는다**(판정 로직 수정 금지).
- 수집은 코드 입력자만 — 코드 없는 사용자는 요청 자체가 없어야 함.
- 키는 env에만. `.env` gitignore 필수.

## 완료 체크리스트

- [ ] 코드 입장 UI(선택적) + 안내 문구 + HUD 표시 + 변경/제거
- [ ] 이벤트 훅 5종(fail-silent, 중복 방어)
- [ ] Function track(검증·CORS·레이트 리밋·키 비노출)
- [ ] docs 2종(치트시트 갱신 + setup.sql)
- [ ] 검증 목록 전부 통과, `.env` 미추적, feature/lms 커밋
