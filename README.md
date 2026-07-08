# 사유의 방 · AX 실무 입문 데모

AX 전문강사 데모데이용 인터랙티브 강의 페이지.
다크 네온/글래스 컨셉, 게이미피케이션이 적용된 20강 커리큘럼 탐험 + 강의 슬라이드.

## 흐름

```
시작 화면(다크) ─[강의실 입장]→ 워프 이펙트 ─→ 사유의 방
   └ 상자 4개(왜·도구·적용·지속) ─클릭→ 카드 5장 부채꼴 전개
        └ 카드 선택 → 인터랙티브 강의 슬라이드 (키보드/버튼/스와이프)
```

게이미피케이션: 열람한 강의는 저장되어(HUD의 "발견한 강의 n/20", 탐험도 %) 상자·카드에 표시됨.
우상단 ↺ 버튼으로 초기화.

## 파일 구조

```
Last_Lecture/
├─ index.html          # 3개 씬(시작·방·슬라이드) 뼈대
├─ curriculum.md       # 20강 커리큘럼 문서
├─ css/style.css       # 다크 네온/글래스 스타일
├─ js/
│  ├─ data.js          # ★ 커리큘럼 + 슬라이드 데이터 (여기에 PPT 내용 입력)
│  ├─ room.js          # 사유의 방 · 상자 · 카드 부채꼴
│  ├─ slides.js        # 슬라이드 엔진
│  └─ main.js          # 씬 전환 · 배경 · 진행도
└─ assets/             # 이미지 넣는 곳
```

## PPT 내용 넣는 법

`js/data.js`에서 각 강의의 `slides` 배열을 채우면 된다. 데모 2강(7·8강)은 예시가 채워져 있다.

지원 슬라이드 타입:

| type | 필드 | 용도 |
|------|------|------|
| `cover` | kicker, title, subtitle | 표지 (title은 `\n`으로 줄바꿈) |
| `big` | word, sub | 대형 키워드 1개 |
| `bullets` | title, subtitle, items[] | 소제목 + 항목 리스트 |
| `quote` | text, by | 인용/한마디 |
| `split` | title, left[], right[] | 좌우 비교 (각 배열 첫 항목=제목) |
| `image` | title, src, caption | 이미지 (`assets/`에 넣고 `src:"assets/파일.png"`) |
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

## GitHub Pages 배포

```bash
git init
git add .
git commit -m "사유의 방: AX 데모 페이지"
git branch -M main
git remote add origin https://github.com/hyun02063185-AX-beginner/Last_Lecture.git
git push -u origin main
```

GitHub 저장소 → Settings → Pages → Branch `main` / `/ (root)` 저장.
잠시 후 `https://hyun02063185-ax-beginner.github.io/Last_Lecture/` 에서 공개된다.

## 조작

- **→ / Space / 클릭**: 다음 슬라이드  ·  **←**: 이전  ·  **Esc**: 방으로  ·  **Home/End**: 처음/끝
- 모바일: 좌우 스와이프
