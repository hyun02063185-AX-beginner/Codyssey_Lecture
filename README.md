# 비전공자를 위한 기초공사 · 미션 1, 대체 뭘 한 거지

Codyssey 미션 1(개발 워크스테이션 구축)에서 실습한 내용을 시스템 프로그래밍
관점으로 정리한 인터랙티브 강의 슬라이드 페이지.
다크 네온/글래스 컨셉, 게이미피케이션이 적용된 16강 커리큘럼 탐험 + 강의 슬라이드.

## 흐름

```
시작 화면(다크) ─[강의실 입장]→ 워프 이펙트 ─→ 방
   └ 상자 4개(시작·기본·컨테이너·정리) ─클릭→ 카드 부채꼴 전개
        └ 카드 선택 → 인터랙티브 강의 슬라이드 (키보드/버튼/스와이프)
```

게이미피케이션: 열람한 강의는 저장되어(HUD의 "발견한 강의 n/16", 탐험도 %) 상자·카드에 표시됨.
우상단 ↺ 버튼으로 초기화.

## 파일 구조

```
Codyssey_Lecture/
├─ index.html          # 4개 씬(인트로·시작·방·슬라이드) 뼈대
├─ curriculum.md        # 커리큘럼 문서
├─ css/style.css        # 다크 네온/글래스 스타일
├─ js/
│  ├─ site-config.js    # ★ 사이트 이름·문구·스킨 기본값 (이 사이트를 정의하는 단일 설정)
│  ├─ data.js            # ★ 커리큘럼 + 슬라이드 데이터
│  ├─ room.js            # 방 · 상자 · 카드 부채꼴
│  ├─ slides.js          # 슬라이드 엔진
│  ├─ main.js             # 씬 전환 · 배경 · 진행도
│  ├─ intro.js             # 인트로(화면보호기) 테마
│  ├─ telemetry.js         # 수강 코드 + 학습 이벤트 수집 (선택 기능)
│  └─ admin.js              # 강사 대시보드 #/admin (선택 기능)
└─ assets/               # 이미지(도식 SVG 등) 넣는 곳
```

## 슬라이드 내용 넣는 법

`js/data.js`에서 각 강의의 `slides` 배열을 채우면 된다.

지원 슬라이드 타입:

| type | 필드 | 용도 |
|------|------|------|
| `cover` | kicker, title, subtitle | 표지 (title은 `\n`으로 줄바꿈) |
| `big` | word, sub | 대형 키워드 1개 |
| `bullets` | title, subtitle, items[] | 소제목 + 항목 리스트 |
| `quote` | text, by | 인용/한마디 (by는 선택 — 없으면 생략) |
| `split` | title, left[], right[] | 좌우 비교 (각 배열 첫 항목=제목) |
| `image` | title, src, caption, diagram | 이미지 (`assets/`에 넣고 `src:"assets/파일.svg"`) |
| `closing` | title, teaser | 마무리 + 다음 강 티저 |

## 실행

정적 사이트라 별도 빌드가 없다. 로컬에서 열 때는 서버로 여는 것을 권장:

```bash
# 프로젝트 폴더에서
python -m http.server 8000
# → http://localhost:8000 접속
```

> `index.html`을 파일로 바로 열어도 대부분 동작하지만, 일부 브라우저는 로컬 파일 보안정책으로
> 폰트/이미지가 제한될 수 있어 로컬 서버 사용을 권장.

테스트(동선·콘텐츠 검증):

```bash
npm test
```

## GitHub Pages 배포

```bash
git add .
git commit -m "비전공자를 위한 기초공사: 미션 1 강의 슬라이드"
git push
```

GitHub 저장소 → Settings → Pages → Branch `main` / `/ (root)` 저장.

## 조작

- **→ / Space / 클릭**: 다음 슬라이드  ·  **←**: 이전  ·  **Esc**: 방으로  ·  **Home/End**: 처음/끝
- 모바일: 좌우 스와이프
