# CC 작업 지시서 — 대시보드 보완 + main 병합 (v1.2 마감)

> 위치: `Last_Lecture/order/dashboard_보완_병합_v1.2_지시서.md` · 경로는 프로젝트 루트 기준.
> **feature/dashboard에서 보완 3건 → 검증 → main 병합 → v1.2 태그.** 권장 모델: 높음(보완이 소규모).

---

## ① 보완 1 — `checkup_result` 이벤트 추가 (집계 공백 해소)

2단계 검증에서 확인된 공백: 조직 건강검진(진단실 기록실) 결과가 수집되지 않아 `checkupAverage`가 항상 비어 있음. 팀 평균 5축은 조직 진단의 핵심이므로 수집한다.

- **프론트 훅**: 조직 건강검진 완료(레이더 생성) 시점에 `checkup_result` 이벤트 전송 — payload `{ scores: {방향, 데이터, 사람, 규칙, 분위기}, lowest: "규칙" }`. 기존 diagnosis_result 훅과 동일 패턴(코드 있을 때만·fail-silent·재검사 시 재전송 허용 — stats가 최신만 취함).
- **track 함수**: 화이트리스트에 `checkup_result` 추가.
- **stats 함수**: 코드별 최신 checkup 반영 + `aggregate.checkupAverage` 실계산.
- **대시보드**: 이미 있는 "조직 건강검진 평균 5축 레이더" 슬롯이 데이터를 받으면 렌더되는지 확인(빈 슬롯 → 실렌더 전환).
- 치트시트 이벤트 목록에 추가.

## ② 보완 2 — 테스트 데이터 정리

- Supabase events에서 검증용 잔여 데이터 삭제: 인코딩 깨진 행, `A반-테스트07` 등 이전 세션 테스트 코드, 이번 검증 코드(A반-01/02·B반-01) 전부.
- 방법: SQL Editor에서 delete(실행 전 `select count(*)`로 대상 확인 → 삭제 → 0건 확인). 실행한 SQL을 보고에 기재.
- 이후 ①의 검증용 데이터는 새로 넣고, **검증 끝나면 다시 정리**(운영 시작 시 테이블은 깨끗한 상태).

## ③ 보완 3 — 문서 갱신

- `docs/URL전환_체크리스트.md` 3단계에 `ADMIN_KEY` 추가(Netlify env 등록 항목: SUPABASE_URL·SUPABASE_SERVICE_KEY·ADMIN_KEY).
- 치트시트: ①의 이벤트 추가 반영 확인.

## ④ 검증 (feature/dashboard, netlify dev)

- [ ] 코드 입장 → 조직 건강검진 완료 → Supabase에 `checkup_result` insert(scores 5축 온전).
- [ ] `#/admin`: checkupAverage 실값 + 5축 레이더 렌더(수기 평균 대조 1회).
- [ ] 재검사 시 최신값으로 갱신(stats 최신 취득 확인).
- [ ] 기존 이벤트 5종·대시보드 기존 섹션 회귀 없음, 콘솔 0건.
- [ ] 검증 데이터 정리 → events 테이블 0건.

## ⑤ 병합·태그·push

```bash
git checkout main && git pull
git merge feature/dashboard        # 충돌 시 내역 보고 후 양쪽 의도 보존
# main에서 핵심 재검증: #/admin 진입·stats 응답·수강생 화면 회귀 표본
git tag -a v1.2-dashboard -m "v1.2: 강사 대시보드(#/admin) + checkup 수집 완성"
git push origin main --tags        # push 1회, 배포는 크레딧 리셋 후
```

- feature/dashboard 보존, 기존 태그 무변경.

## 가드레일

- 보완 ①은 기존 훅 패턴 복제 수준으로 최소 구현 — 판정·검사 로직 자체 수정 금지.
- `.env` 미추적 유지, 키 비노출 유지, slidesPersonal 무변경.

## 완료 체크리스트

- [ ] checkup_result 수집→집계→레이더 전체 연결
- [ ] 테스트 데이터 정리(SQL 보고, 최종 0건)
- [ ] 문서 2종 갱신
- [ ] main 병합 + v1.2-dashboard 태그 + push 1회
