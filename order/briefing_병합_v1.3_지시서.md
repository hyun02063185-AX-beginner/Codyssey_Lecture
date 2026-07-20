# CC 작업 지시서 — 브리핑 병합 (v1.3 마감 · LMS 로드맵 완결)

> 위치: `Last_Lecture/order/briefing_병합_v1.3_지시서.md` · 경로는 프로젝트 루트 기준.
> feature/briefing → main 병합, v1.3 태그. 이로써 LMS 3단계 로드맵(수집→대시보드→AI 브리핑) 완결.

---

## 작업 순서

1. **문서 보완 먼저 (feature/briefing에서)**
   - `docs/URL전환_체크리스트.md` 3단계 env 목록에 `AI_API_KEY` 추가 (최종 4종: SUPABASE_URL · SUPABASE_SERVICE_KEY · ADMIN_KEY · AI_API_KEY).
   - 커밋.

2. **병합**
```bash
git checkout main && git pull
git merge feature/briefing        # 충돌 시 내역 보고, 양쪽 의도 보존
```

3. **main 재검증 (netlify dev)**
   - [ ] `#/admin` → [📋 주간 브리핑]: 0명 상태 결정론적 응답(AI 미호출) 확인
   - [ ] 임시 코드 1개로 이벤트 소량 발생 → 브리핑 실생성(형식·사실 일치) → **테이블 다시 0건 정리**
   - [ ] stats·매트릭스·진단 집계 회귀 없음, 수강생 화면 표본 회귀 없음
   - [ ] 키 3종(AI/ADMIN/SUPABASE) 비노출, 콘솔 0건

4. **태그 + push (1회)**
```bash
git tag -a v1.3-ai-briefing -m "v1.3: AI 주간 브리핑 — LMS 로드맵(수집·대시보드·브리핑) 완결"
git push origin main --tags
```
   - feature/briefing 보존, 기존 태그 무변경, 배포는 크레딧 리셋 후.

## 가드레일

- 코드 수정 없음(1의 문서 한 줄 제외) — 병합·검증·태그만. 발견 문제는 보고만.
- `.env` 미추적·slidesPersonal 무변경.

## 완료 체크리스트

- [ ] URL전환_체크리스트 env 4종 완성
- [ ] 병합(충돌 보고), main 재검증 통과, 테이블 0건 인계
- [ ] v1.3-ai-briefing 태그 + push 1회
