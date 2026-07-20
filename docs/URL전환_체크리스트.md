# 로컬 → 공개 URL 전환 체크리스트

> 지금은 로컬(`feature/lms`) 중심 운영. 실제로 공개 URL에 반영할 때 빠뜨리지 않도록 순서대로.

---

1. **Netlify 크레딧 확인**(매월 리셋) → Deploys 탭에서 지연·실패 배포 정리.

2. **`feature/lms` → `main` 병합**(검토 후) → `main` push는 **1회**로 모아서.

3. **Netlify 환경변수 등록**: `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `ADMIN_KEY` / `AI_API_KEY` — 로컬 `.env`와 **동일한 값**.
   (Site configuration → Environment variables. 값은 절대 커밋하지 말 것 — env에만.)

4. 배포 완료 후 **공개 URL에서 함수 동작 확인**:
   - 코드 입장(또는 `?join=`) → Supabase **Table Editor**의 `events`에 `session_start` 1건 insert 확인.
   - `/#/admin` → 접속 키로 대시보드 진입 확인(`stats` 함수 동작).
   - 대시보드 **[📋 주간 브리핑]** 클릭 → 정상 생성 확인(`brief` 함수·Gemini 호출 동작).

5. **CORS 확인**: `netlify/functions/track.js`·`stats.js`·`brief.js`의 허용 도메인 정규식에 실제 배포 도메인이
   포함되는지(현재는 `*.netlify.app` + localhost 패턴 — 커스텀 도메인을 쓰면 세 파일 모두 코드에서 패턴 추가 필요).

6. **공개 URL 전 동선 검증**(시크릿 창 권장):
   - 입장 화면 개편 상태(주인공 버튼 + ⚙️만, 진단실은 Lv2부터)
   - ⚙️ 설정 레이어(스킨·수강 코드·초기화) 동작
   - `?join=반이름` 자동 오픈·접두어 채움·저장 후 닫힘
   - 진단실 해금(`?unlock=1`)
   - 스킨 5종, 모바일 **실기기**에서 확인
   - `/#/admin` 대시보드(강사 PC에서, 수강생 화면엔 진입 버튼이 없음을 재확인)

7. **QR 재생성**: `?join=반이름` 포함 링크로 (예: `https://<배포주소>/?join=A반#/start`).

8. **레이트 리밋·이벤트 적재 정상 확인** 후, `docs/운영자_치트시트.md`의 URL들을 배포 주소로 갱신.

---

## 참고

- 정적 사이트 + 서버 함수 조합이라 **빌드 설정은 없음**(`netlify.toml`에 `publish = "."`, `functions = "netlify/functions"`만 지정).
- 함수/env가 없어도 학습 화면 자체는 100% 정상 동작(fail-silent 설계) — 전환이 실패해도 서비스 중단은 없다.
