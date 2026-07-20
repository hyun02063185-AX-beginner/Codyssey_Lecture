# CC 작업 지시서 — feature/lms → main 병합 (v1.1 마감)

> 위치: `Last_Lecture/order/lms_병합_v1.1_지시서.md` · 경로는 프로젝트 루트 기준.
> 목적: 검증 완료된 [LMS 1단계 수집 + 입장 화면 다이어트 + 문서 3종]을 main에 병합해 v1.1로 닫는다.
> 다음 작업(2단계 대시보드)은 병합 후 **새 브랜치**에서 시작한다.

---

## 작업 순서

1. **사전 확인**
```bash
git checkout feature/lms && git status     # 미커밋 변경 없어야 함
git log --oneline main..feature/lms        # 병합될 커밋 목록 확인·보고
```

2. **병합**
```bash
git checkout main && git pull
git merge feature/lms
```
- 충돌 시: main 쪽에 lms 이후 변경이 없었으므로 fast-forward 예상. 충돌이 나면 내역을 보고하고 양쪽 의도 보존 원칙으로 해소.

3. **병합 후 전체 검증 (main, 로컬)** — `netlify dev`(함수 포함)로:
- [ ] 입장 화면: [강의실 입장]+⚙️, 레이어(스킨·코드·초기화), `?join=` 동작
- [ ] 진단실 Lv2 점진 노출 + `?unlock=1`
- [ ] 코드 입장 → session_start가 Supabase에 insert (실확인)
- [ ] 강의 완료 이벤트·중복 방어, fail-silent(정적 서버 8000에서도 무오류)
- [ ] 회귀: 20강 렌더 표본(각 상자 1강)·`?variant=personal`·이어보기·`#/reset`·스킨 5종·375px
- [ ] docs 3종(UX_원칙·URL전환_체크리스트·치트시트 갱신분) main에 존재
- [ ] 콘솔 0건

4. **태그 + push (1회)**
```bash
git tag -a v1.1-lms-foundation -m "v1.1: LMS 수집 기반(코드 입장·이벤트 5종·track 함수) + 입장 화면 다이어트 + UX 원칙"
git push origin main --tags
```
- (배포는 크레딧 리셋 후 — push만. 기존 태그들 무변경.)

5. **다음 작업 준비**
```bash
git checkout -b feature/dashboard    # 생성만, 작업은 다음 지시서에서
git checkout main                    # main으로 복귀해 종료
```
- feature/lms 브랜치는 보존(삭제 안 함).

---

## 가드레일

- 코드 수정 없음 — 병합·검증·태그만. 검증 중 발견한 문제는 보고만(수정은 별도 지시).
- `.env` 미추적 상태 유지 확인(`git status`).
- slidesPersonal·기존 태그 무변경.

## 완료 체크리스트

- [ ] 병합 커밋 목록 보고, 충돌 여부 보고
- [ ] main 전체 검증 통과(위 목록), 콘솔 0건
- [ ] v1.1-lms-foundation 태그 + push 1회
- [ ] feature/dashboard 생성(빈 브랜치), feature/lms 보존
