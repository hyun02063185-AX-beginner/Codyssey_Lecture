# CC 작업 지시서 — 공용화 병합 (v1.4 마감 · 복제 준비 완료)

> 위치: `Last_Lecture/order/common_병합_v1.4_지시서.md` · 경로는 프로젝트 루트 기준.
> feature/common-core → main 병합, v1.4 태그. 이로써 AX 사이트는 "복제 가능한 본진" 상태가 된다.

---

## 작업 순서

1. **병합**
```bash
git checkout main && git pull
git merge feature/common-core     # 충돌 시 내역 보고, 양쪽 의도 보존
```

2. **main 재검증 (netlify dev)** — 공용화는 회귀 0이 생명이므로 표본을 넓게:
   - [ ] 입장 화면: [입장]+[진단실(해금)]+🎫+🎨, 레이어 2종, 코드 뱃지 전환, `?join=`
   - [ ] 강의 표본(각 상자 1강)·`?variant=personal`·이어보기·핵심훑기·스킨 5종·375px
   - [ ] 진단실 검사 1종 + 제안서 열람
   - [ ] 임시 코드 1개 이벤트 → `course:'ax'` insert 확인 → **테이블 0건 정리**
   - [ ] #/admin: 과정 필터·반 필터·브리핑(0명 결정론적 응답)
   - [ ] `fxLevel` 기본 'full' 상태로 기존 연출 그대로인지
   - [ ] 콘솔 0건, 키 비노출

3. **태그 + push (1회)**
```bash
git tag -a v1.4-common-core -m "v1.4: 공용화 — site-config·course 차원·유틸 재편(B안)·엔진 경계. 사이트 복제 준비 완료"
git push origin main --tags
```
   - feature/common-core 보존, 기존 태그 무변경, 배포는 크레딧 리셋 후.

## 가드레일

- 코드 수정 없음 — 병합·검증·태그만. 발견 문제는 보고만.
- `.env` 미추적·slidesPersonal 무변경.

## 완료 체크리스트

- [ ] 병합(충돌 보고), main 재검증 통과, 테이블 0건 인계
- [ ] v1.4-common-core 태그 + push 1회
