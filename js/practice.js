/* =========================================================================
   practice.js — 실습실 v2 목업 (3층 구조 · 스테이션 13개)
   · 기존 씬/스킨/Lv 로직 미변경. Lv는 읽기만. 실습 기록은 별도 키(axPractice_v1).
   · 라우터가 #/practice 에서 openPractice() 호출.
   ========================================================================= */
(function () {
  "use strict";
  const scene = document.getElementById("scene-practice");
  if (!scene) return;

  const PKEY = "axPractice_v1";        // 완료 스테이션 id 배열
  const NKEY = "axPracticeNotes_v1";   // 회고 {id: text}
  const UNLOCK_ALL = /[?&]unlock=1/.test(location.search);   // 개발/판단용 전체 해금

  /* ---------- 저장(별도 키) ---------- */
  function loadDone() { try { const a = JSON.parse(localStorage.getItem(PKEY)); return new Set(Array.isArray(a) ? a : []); } catch (e) { return new Set(); } }
  function loadNotes() { try { return JSON.parse(localStorage.getItem(NKEY)) || {}; } catch (e) { return {}; } }
  let done = loadDone();
  let notes = loadNotes();
  const saveDone = () => { try { localStorage.setItem(PKEY, JSON.stringify([...done])); } catch (e) {} };
  const saveNotes = () => { try { localStorage.setItem(NKEY, JSON.stringify(notes)); } catch (e) {} };

  // Lv는 읽기만 (App.Level 있으면 사용, 없으면 localStorage 직접)
  function curLevel() {
    try { if (window.App && App.Level) return App.Level.n; } catch (e) {}
    const v = parseInt(localStorage.getItem("ax_room_level_v1"), 10);
    return isNaN(v) ? 1 : v;
  }

  const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* =====================================================================
     층 · 스테이션 데이터
     ===================================================================== */
  const FLOORS = [
    { n: 1, title: "손에 익히기", sub: "AI와 대화하는 법" },
    { n: 2, title: "일에 붙이기", sub: "내 업무에 적용" },
    { n: 3, title: "AX로 건너가기", sub: "방식의 재구성" }
  ];

  const STATIONS = [
    /* ---- 1층 ---- */
    { id: "1-1", floor: 1, type: "mission", icon: "💬", title: "첫 대화 워밍업",
      tag: "같은 질문을 3번 다르게 — 매번 다른 답을 직접 확인",
      mission: {
        goal: "같은 질문을 3번 보내, AI가 매번 다르게 답하는 걸 직접 확인한다.",
        steps: [
          { t: "ChatGPT · Claude · Gemini 중 아무거나 연다." },
          { t: "아래 프롬프트를 3번 연달아 보낸다.", p: "우리 회사 소개문 한 단락 써줘" },
          { t: "세 답을 나란히 비교한다 — 무엇이 달라졌나?" }
        ],
        checks: ["세 답이 서로 달랐다", "왜 다른지 이해했다(정답을 꺼내는 게 아니라 '생성'하니까)"]
      } },
    { id: "1-2", floor: 1, type: "app", icon: "🛠️", title: "프롬프트 공방",
      tag: "막연 → 구체, 결과 차이 체감 (04강)", kind: "compare" },
    { id: "1-3", floor: 1, type: "mission", icon: "🧵", title: "꼬리물기 대화",
      tag: "5턴 이상 이어가며 다듬기 — AI는 대화 상대",
      mission: {
        goal: "한 번에 끝내지 말고, 답을 5턴 이상 이어서 다듬어본다.",
        steps: [
          { t: "아무 주제로 초안을 하나 받는다.", p: "신입 환영 메일 초안 써줘" },
          { t: "다음처럼 계속 이어서 요청한다(5턴 이상).", p: "더 짧게 → 표로 → 초등학생에게 설명하듯 → 더 따뜻하게 → 이모지 빼고" },
          { t: "처음 답과 마지막 답을 비교한다." }
        ],
        checks: ["5턴 이상 이어갔다", "처음보다 마지막 답이 더 좋아졌다"]
      } },
    { id: "1-4", floor: 1, type: "app", icon: "🔍", title: "환각 탐정",
      tag: "그럴듯한 오답 찾기 + 출처 확인 습관 (03강)", kind: "quiz",
      quiz: {
        intro: "AI가 쓴 것처럼 보이는 아래 문단에 <b>근거 없는 '환각'</b>이 하나 숨어 있다. 어디일까?",
        lines: [
          "인공지능은 1956년 다트머스 회의에서 처음 학문 분야로 제안되었다.",
          "2022년 공개된 ChatGPT는 두 달 만에 월 사용자 1억 명을 넘었다.",
          "한국은 2024년 세계 최초로 'AI 국민 의무교육법'을 통과시켜 전 국민이 연 40시간 AI 교육을 이수한다.",
          "생성형 AI는 사실을 검색하는 게 아니라 그럴듯한 다음 말을 만든다."
        ],
        options: [0, 1, 2, 3],
        answer: 2,
        why: "3번은 존재하지 않는 법·통계입니다. 문장은 매끄럽지만 사실이 아닌 <b>환각</b>이에요. 실제 AI에게도 <b>“그 출처 알려줘”</b>를 습관처럼 요구하세요.",
        hint: "매끄럽지만 '너무 구체적인 통계·최초 기록'을 의심해 보세요.",
        mission: "실제 AI에게 위 문단을 주고 “틀린 문장과 그 근거를 알려줘”라고 물어보세요."
      } },

    /* ---- 2층 ---- */
    { id: "2-1", floor: 2, type: "app", icon: "📝", title: "요약 조수",
      tag: "샘플 회의록 3줄 요약 → 원본 대조 (11강)", kind: "summarize",
      summarize: {
        source: [
          "[주간 마케팅 회의 · 6/10]",
          "· 신제품 A 출시일을 6/28 → 7/5로 1주 연기(디자인 검수 지연).",
          "· 인스타 광고 예산 이번 달 300만 원 집행, 김대리 담당.",
          "· 사전예약 페이지는 6/20까지 오픈(개발 이수석).",
          "· 인플루언서 협업 3건 중 2건 확정, 나머지는 다음 주 결정.",
          "· 다음 회의 6/17 10시."
        ],
        summary3: [
          "출시일 7/5로 1주 연기(디자인 검수).",
          "광고 300만 원 집행(김대리) · 사전예약 6/20 오픈(이수석).",
          "인플루언서 2/3 확정, 나머지 다음 주 결정."
        ],
        table: [
          ["항목", "내용", "담당", "기한"],
          ["출시 연기", "6/28 → 7/5", "-", "7/5"],
          ["인스타 광고", "300만 원 집행", "김대리", "이번 달"],
          ["사전예약 오픈", "페이지 오픈", "이수석", "6/20"],
          ["인플루언서", "2/3 확정", "-", "다음 주"]
        ],
        note: "숫자·기한(300만 원, 7/5, 6/20)은 <b>반드시 원본과 대조</b>하세요 — 요약은 빠뜨리거나 바꿀 수 있습니다."
      } },
    { id: "2-2", floor: 2, type: "mission", icon: "📎", title: "파일 먹이기",
      tag: 'PDF/이미지 올려 "이 표에서 찾아줘"',
      mission: {
        goal: "문서를 직접 업로드해, AI가 '내 파일'을 근거로 답하게 해본다.",
        steps: [
          { t: "아무 PDF나 표 스크린샷을 채팅창에 업로드한다." },
          { t: "그 파일에 대해 구체적으로 묻는다.", p: "이 문서에서 '반품 규정' 부분만 찾아 3줄로 정리해줘" },
          { t: "답이 실제 문서 내용과 맞는지 원본과 대조한다." }
        ],
        checks: ["파일 기반 답을 받았다", "답이 실제 문서 내용과 일치하는지 확인했다"],
        warn: "회사 기밀·고객 개인정보가 든 파일은 넣지 마세요. 무료 도구는 입력이 학습에 쓰일 수 있습니다 (16강)."
      } },
    { id: "2-3", floor: 2, type: "mission", icon: "🏭", title: "초안 공장",
      tag: "같은 내용을 메일·공지·메신저 3톤으로 (12강)",
      mission: {
        goal: "한 가지 내용을 채널·톤을 바꿔 여러 버전으로 뽑아본다.",
        steps: [
          { t: "전할 내용을 한 줄로 정한다.", p: "다음 주 수요일 사내 시스템 점검으로 오전 서비스 중단" },
          { t: "세 톤으로 요청한다.", p: "위 내용을 ① 정중한 대외 메일 ② 사내 공지(간결) ③ 메신저 단톡용(친근) 3가지 버전으로 써줘" },
          { t: "톤 차이를 확인한다 — 방향은 내가, 변주는 AI가." }
        ],
        checks: ["3버전을 받았다", "채널별 톤 차이가 분명했다"]
      } },
    { id: "2-4", floor: 2, type: "app", icon: "🧐", title: "역할 지정",
      tag: '"깐깐한 상사처럼 비판해줘" — AI를 검토자로', kind: "critique",
      critique: {
        draft: "[기획 초안] 2030 직장인을 위한 ‘점심 명상’ 앱. 하루 10분, 알림을 보내 명상을 유도하고 스트레스를 낮춘다. 무료로 배포해 사용자를 모은 뒤 프리미엄으로 전환한다.",
        points: [
          "‘하루 10분 알림’ — 이미 알림 피로가 큰 직장인에게 또 다른 알림은 이탈 요인. 왜 우리 알림만 볼까?",
          "‘무료 → 프리미엄’ 전환 근거가 없음. 무엇이 유료를 정당화하나? 명상 앱은 이미 레드오션.",
          "‘점심시간 명상’의 실제 수요·상황 검증이 없음 — 사무실에서 눈 감고 10분이 현실적인가?"
        ],
        note: "AI는 그냥 두면 칭찬만 합니다. <b>“깐깐한 상사/투자자처럼 약점을 짚어줘”</b>라고 역할을 주면 검토자로 바뀝니다."
      } },
    { id: "2-5", floor: 2, type: "mission", icon: "📊", title: "데이터 질문",
      tag: "샘플 표 붙여넣고 추세·이상치 묻기 + 검산 (13강)",
      mission: {
        goal: "표를 그대로 붙여넣고, 함수 없이 '말'로 분석시켜 본다.",
        steps: [
          { t: "아래 샘플 표를 복사해 채팅창에 붙여넣는다.", copy: "월,매출(만원)\n1월,1200\n2월,1350\n3월,1280\n4월,1900\n5월,1420\n6월,1510" },
          { t: "분석을 요청한다.", p: "이 표에서 추세와 이상치를 찾아주고, 이상치로 의심되는 달의 이유 가설 3개를 제시해줘" },
          { t: "AI가 짚은 숫자 하나를 직접 검산한다(예: 평균)." }
        ],
        checks: ["이상치(4월) 관련 답을 받았다", "숫자 하나를 직접 검산했다"]
      } },

    /* ---- 3층 ---- */
    { id: "3-1", floor: 3, type: "mission", icon: "📐", title: "나만의 지시서",
      tag: "자주 하는 업무 1개 → 재사용 프롬프트 템플릿으로",
      mission: {
        goal: "매번 새로 쓰지 말고, 자주 하는 업무를 '빈칸 템플릿'으로 만들어 저장한다.",
        steps: [
          { t: "자주 하는 업무 1개를 고른다 (예: 주간 보고, 고객 회신)." },
          { t: "빈칸이 있는 재사용 템플릿으로 정리한다.", p: "[상황]을 위한 [결과물]을 만들어줘. 대상: [누구]. 톤: [톤]. 형식: [형식], [분량] 이내. 꼭 포함: [핵심]. 빼기: [금지]" },
          { t: "메모장/노션에 저장하고 다음에 괄호만 바꿔 쓴다." }
        ],
        checks: ["재사용 템플릿을 저장했다", "다음 주에 또 쓸 수 있는 형태다"]
      } },
    { id: "3-2", floor: 3, type: "app", icon: "🧭", title: "찾기 vs 만들기",
      tag: "업무 카드를 지식검색/생성으로 분류 (07강)", kind: "classify",
      classify: {
        intro: "각 업무는 <b>이미 있는 걸 찾는 일(지식검색)</b>일까, <b>없던 걸 만드는 일(생성)</b>일까?",
        items: [
          { t: "작년 유사 캠페인 사례 찾기", a: "find" },
          { t: "신제품 새 슬로건 만들기", a: "make" },
          { t: "취업규칙에서 연차 규정 조항 찾기", a: "find" },
          { t: "내년 신사업 콘셉트 제안", a: "make" }
        ],
        why: "‘찾기’는 조직에 쌓인 자료를 근거로 꺼내는 일(RAG가 강함), ‘만들기’는 방향을 사람이 잡아야 하는 창작입니다. 섞으면 ‘그럴듯한 짜깁기’가 나와요."
      } },
    { id: "3-3", floor: 3, type: "app", icon: "🪓", title: "내 업무 해부",
      tag: "업무를 단계로 쪼개 [사람/AI/자동화] 라벨 + 확인 지점 (15·17강)", kind: "dissect",
      dissect: {
        job: "예시 업무 — “주간 보고서 작성”",
        steps: [
          { t: "각 팀 채널·시트에서 실적 데이터 모으기", rec: "auto", recLabel: "자동화" },
          { t: "숫자 정리 · 지난주 대비 추세 분석", rec: "ai", recLabel: "AI" },
          { t: "‘무엇을 강조할지’ 방향 판단", rec: "human", recLabel: "사람" },
          { t: "초안 작성 → 다듬기", rec: "ai", recLabel: "AI" }
        ],
        options: [
          { k: "human", label: "사람" }, { k: "ai", label: "AI" }, { k: "auto", label: "자동화" }
        ],
        gate: "이 흐름에서 ‘사람 확인 지점’은 어디가 가장 중요할까?",
        gateOptions: ["데이터 모으기 직후", "방향 판단 단계", "초안이 나온 뒤 발송 직전"],
        gateAnswer: 2,
        gateWhy: "되돌리기 어려운 <b>‘발송 직전’</b>에 사람 확인을 두는 게 핵심(17강). 판단·방향도 사람 몫이지만, 사고가 커지는 건 자동 발송 지점입니다."
      } },
    { id: "3-4", floor: 3, type: "app", icon: "🎓", title: "나의 첫 AX 선언",
      tag: "회고 모아보기 + \"이번 주 한 가지\" → 수료", kind: "declare" }
  ];

  const APP_STATIONS = STATIONS.filter(s => s.type === "app").length;
  const TOTAL_ST = STATIONS.length;

  function floorStations(n) { return STATIONS.filter(s => s.floor === n); }
  function floorDone(n) { return floorStations(n).every(s => done.has(s.id)); }
  function floorDoneCount(n) { return floorStations(n).filter(s => done.has(s.id)).length; }
  function floorUnlocked(n) {
    if (UNLOCK_ALL) return true;
    if (n === 1) return curLevel() >= 2;
    return floorDone(n - 1);
  }
  function unlockReason(n) {
    if (n === 1) return "Lv.2 달성 시 해금";
    return (n - 1) + "층 전부 완료 시 해금";
  }
  function stationById(id) { return STATIONS.find(s => s.id === id); }

  /* =====================================================================
     실습실 메인 화면 렌더
     ===================================================================== */
  let activeFloor = 1;
  function firstUnlockedFloor() {
    for (const f of FLOORS) if (floorUnlocked(f.n)) return f.n;
    return 1;
  }

  function render() {
    const totalDone = done.size;
    scene.innerHTML = `
      <header class="pr-top">
        <button class="pr-exit" id="pr-exit">← 입장 화면</button>
        <span class="pr-title">실습실 <span class="pr-title__sub">AI 사용 → AX 징검다리</span></span>
        <span class="pr-progress">완료 <b>${totalDone}</b> / ${TOTAL_ST}${UNLOCK_ALL ? ' · <span class="pr-dev">unlock</span>' : ''}</span>
      </header>
      <div class="pr-inner">
        <div class="pr-floors" role="tablist">
          ${FLOORS.map(f => floorTab(f)).join("")}
        </div>
        <div class="pr-stage" id="pr-stage">${floorView(activeFloor)}</div>
      </div>`;
    document.getElementById("pr-exit").addEventListener("click", () => App.Router.go("start"));
    scene.querySelectorAll(".pr-floor-tab").forEach(t =>
      t.addEventListener("click", () => { const n = +t.dataset.floor; if (floorUnlocked(n)) { activeFloor = n; refreshStage(); } }));
    bindStationCards();
  }
  function refreshStage() {
    const stage = document.getElementById("pr-stage");
    if (stage) stage.innerHTML = floorView(activeFloor);
    scene.querySelectorAll(".pr-floor-tab").forEach(t => {
      const n = +t.dataset.floor;
      t.classList.toggle("active", n === activeFloor);
    });
    bindStationCards();
  }

  function floorTab(f) {
    const unlocked = floorUnlocked(f.n);
    const dc = floorDoneCount(f.n), tot = floorStations(f.n).length;
    return `<button class="pr-floor-tab ${f.n === activeFloor ? "active" : ""} ${unlocked ? "" : "locked"}" data-floor="${f.n}" ${unlocked ? "" : 'aria-disabled="true"'}>
      <span class="pr-floor-n">${f.n}층</span>
      <span class="pr-floor-t">${esc(f.title)}</span>
      <span class="pr-floor-s">${unlocked ? esc(f.sub) : "🔒 " + esc(unlockReason(f.n))}</span>
      ${unlocked ? `<span class="pr-floor-bar"><i style="width:${tot ? Math.round(dc / tot * 100) : 0}%"></i></span><span class="pr-floor-c">${dc}/${tot}</span>` : ""}
    </button>`;
  }

  function floorView(n) {
    const f = FLOORS.find(x => x.n === n);
    if (!floorUnlocked(n)) {
      return `<div class="pr-locked-note">🔒 ${esc(f.title)} — ${esc(unlockReason(n))}<br><span>${n === 1 ? "강의를 한 번 완주하면(Lv.2) 열립니다." : "이전 층을 모두 완료하면 열립니다."}</span></div>`;
    }
    return `<p class="pr-floor-head">${n}층 · 「${esc(f.title)}」 <span>${esc(f.sub)}</span></p>
      <div class="pr-cards">${floorStations(n).map(stationCard).join("")}</div>`;
  }

  function stationCard(s) {
    const isDone = done.has(s.id);
    return `<button class="pr-card ${isDone ? "done" : ""}" data-id="${s.id}">
      <span class="pr-card-ic">${s.icon}</span>
      <span class="pr-card-body">
        <span class="pr-card-t">${esc(s.title)} ${isDone ? '<em class="pr-chk">✓</em>' : ""}</span>
        <span class="pr-card-tag">${esc(s.tag)}</span>
      </span>
      <span class="pr-badge pr-badge--${s.type}">${s.type === "app" ? "앱 내" : "미션"}</span>
    </button>`;
  }
  function bindStationCards() {
    scene.querySelectorAll(".pr-card").forEach(c =>
      c.addEventListener("click", () => openStation(c.dataset.id)));
  }

  /* =====================================================================
     스테이션 패널(오버레이)
     ===================================================================== */
  const panel = document.createElement("div");
  panel.className = "pr-panel"; panel.id = "pr-panel"; panel.hidden = true;
  panel.innerHTML = `<div class="pr-panel__box" role="dialog" aria-modal="true">
      <button class="pr-panel__x" id="pr-panel-x" aria-label="닫기">✕</button>
      <div class="pr-panel__inner" id="pr-panel-inner"></div>
    </div>`;
  document.body.appendChild(panel);
  const panelInner = panel.querySelector("#pr-panel-inner");
  panel.querySelector("#pr-panel-x").addEventListener("click", closePanel);
  panel.addEventListener("click", e => { if (e.target === panel) closePanel(); });
  document.addEventListener("keydown", e => { if (!panel.hidden && e.key === "Escape") closePanel(); });

  function openPanel() { panel.hidden = false; void panel.offsetWidth; panel.classList.add("show"); }
  function closePanel() { panel.classList.remove("show"); setTimeout(() => { panel.hidden = true; }, 260); }

  let curStation = null;
  function openStation(id) {
    const s = stationById(id);
    if (!s) return;
    curStation = s;
    const badge = `<span class="pr-badge pr-badge--${s.type}">${s.type === "app" ? "앱 내 실습" : "미션 · 실제 AI"}</span>`;
    let body;
    if (s.type === "mission") body = renderMission(s);
    else body = renderApp(s);
    panelInner.innerHTML = `<div class="pr-ph">
        <span class="pr-ph-ic">${s.icon}</span>
        <span><span class="pr-ph-t">${esc(s.title)}</span> ${badge}</span>
      </div>
      <div class="pr-pb">${body}</div>`;
    wirePanel(s);
    openPanel();
  }

  /* ---------- 회고 + 완료 공통 푸터 ---------- */
  function reflectFooter(s, opts) {
    opts = opts || {};
    const note = notes[s.id] || "";
    const gateNote = opts.gateReady === false;
    const reflect = opts.noReflect ? "" :
      `<label class="pr-reflect-l">한 줄 회고 — <b>내 업무 중 이걸 쓸 곳은?</b></label>
       <textarea class="pr-reflect-in" id="pr-note" rows="2" placeholder="예: 매주 쓰는 정기보고 초안에 써보기">${esc(note)}</textarea>`;
    return `<div class="pr-reflect">
        ${reflect}
        <button class="pr-done-btn" id="pr-done" ${gateNote ? "disabled" : ""}>${done.has(s.id) ? "완료됨 ✓ · 다시 저장" : (s.kind === "declare" ? "선언하고 수료하기" : "완료")}</button>
        ${opts.hint ? `<p class="pr-done-hint" id="pr-done-hint">${opts.hint}</p>` : ""}
      </div>`;
  }
  function wireReflectFooter(s) {
    const btn = panelInner.querySelector("#pr-done");
    if (!btn) return;
    btn.addEventListener("click", () => {
      let val = "";
      if (s.kind === "declare") {
        const one = panelInner.querySelector("#decl-one");
        if (one && one.value.trim()) val = "이번 주 한 가지 — " + one.value.trim();
      } else {
        const ta = panelInner.querySelector("#pr-note");
        if (ta) val = ta.value.trim();
      }
      if (val) { notes[s.id] = val; saveNotes(); }   // 빈 값으로 덮어쓰지 않음
      completeStation(s);
    });
  }
  function setDoneEnabled(on, hintText) {
    const btn = panelInner.querySelector("#pr-done");
    if (btn) btn.disabled = !on;
    const h = panelInner.querySelector("#pr-done-hint");
    if (h && hintText != null) h.textContent = hintText;
  }

  function completeStation(s) {
    const wasFloorDone = floorDone(s.floor);
    const first = !done.has(s.id);
    done.add(s.id); saveDone();
    closePanel();
    // 3-4 수료 스테이션이거나 전체 완료면 수료 연출
    if (s.id === "3-4" || done.size === TOTAL_ST) { setTimeout(() => showGraduation(), 280); render(); return; }
    // 층 완료 순간 → 다음 층 해금 연출
    if (first && !wasFloorDone && floorDone(s.floor) && s.floor < 3) {
      setTimeout(() => floorUnlockToast(s.floor + 1), 280);
    }
    render();
  }

  /* =====================================================================
     미션 카드 렌더
     ===================================================================== */
  function renderMission(s) {
    const m = s.mission;
    const steps = m.steps.map((st, i) => `
      <li>
        <span class="pr-step-n">${i + 1}</span>
        <span class="pr-step-b">${esc(st.t)}
          ${st.p ? `<span class="pr-prompt"><code>${esc(st.p)}</code><button class="pr-copy" data-copy="${encodeURIComponent(st.p)}">복사</button></span>` : ""}
          ${st.copy ? `<span class="pr-prompt pr-prompt--data"><code>${esc(st.copy)}</code><button class="pr-copy" data-copy="${encodeURIComponent(st.copy)}">복사</button></span>` : ""}
        </span>
      </li>`).join("");
    const checks = m.checks.map((c, i) => `<label class="pr-check"><input type="checkbox" data-chk="${i}"><span>${esc(c)}</span></label>`).join("");
    return `<p class="pr-goal">🎯 ${esc(m.goal)}</p>
      ${m.warn ? `<p class="pr-warn">⚠️ ${esc(m.warn)}</p>` : ""}
      <p class="pr-sec">실제 AI를 열고 — 순서대로</p>
      <ol class="pr-steps">${steps}</ol>
      <p class="pr-sec">돌아와서 · 자가 체크</p>
      <div class="pr-checks">${checks}</div>
      ${reflectFooter(s, { gateReady: false, hint: "체크리스트를 모두 확인하면 완료할 수 있어요." })}`;
  }

  /* =====================================================================
     앱 내 canned 렌더 (kind별)
     ===================================================================== */
  function renderApp(s) {
    switch (s.kind) {
      case "compare": return appCompare(s);
      case "quiz": return appQuiz(s);
      case "summarize": return appSummarize(s);
      case "critique": return appCritique(s);
      case "classify": return appClassify(s);
      case "dissect": return appDissect(s);
      case "declare": return appDeclare(s);
      default: return "<p>준비 중</p>";
    }
  }

  // 1-2 프롬프트 공방
  function appCompare(s) {
    return `<p class="pr-goal">🎯 같은 요청도 <b>구체적으로</b> 주면 결과가 확 달라진다.</p>
      <div class="pr-field"><label>보낼 프롬프트</label><div class="pr-input" id="cmp-starter">신제품 홍보문구 써줘</div></div>
      <div class="pr-btnrow">
        <button class="pr-run" data-cmp="vague">막연하게 보내기</button>
        <button class="pr-run pr-run--good" data-cmp="spec">구체적으로 보내기 <span>(대상·톤·형식 지정)</span></button>
      </div>
      <div class="pr-out" id="cmp-out"></div>
      ${reflectFooter(s, { gateReady: false, hint: "두 결과를 모두 눌러 비교하면 완료할 수 있어요." })}`;
  }
  // 1-4 / (quiz 공통)
  function appQuiz(s) {
    const q = s.quiz;
    return `<p class="pr-goal">🎯 ${q.intro}</p>
      <div class="pr-lines">${q.lines.map((l, i) => `<p class="pr-line"><b>${i + 1}.</b> ${esc(l)}</p>`).join("")}</div>
      <div class="pr-btnrow pr-btnrow--wrap" id="quiz-opts">
        ${q.options.map(o => `<button class="pr-opt" data-opt="${o}">${o + 1}번</button>`).join("")}
      </div>
      <div class="pr-out" id="quiz-out"></div>
      ${reflectFooter(s, { gateReady: false, hint: "정답을 맞히면 완료할 수 있어요." })}`;
  }
  // 2-1 요약 조수
  function appSummarize(s) {
    const d = s.summarize;
    return `<p class="pr-goal">🎯 긴 회의록을 AI로 요약하고, <b>원본과 대조</b>하는 습관.</p>
      <div class="pr-field"><label>샘플 회의록</label><div class="pr-source">${d.source.map(l => `<div>${esc(l)}</div>`).join("")}</div></div>
      <div class="pr-btnrow">
        <button class="pr-run" data-sum="3">3줄로 요약</button>
        <button class="pr-run" data-sum="table">표로 정리</button>
      </div>
      <div class="pr-out" id="sum-out"></div>
      ${reflectFooter(s, { gateReady: false, hint: "요약을 한 번 실행하면 완료할 수 있어요." })}`;
  }
  // 2-4 역할 지정
  function appCritique(s) {
    const c = s.critique;
    return `<p class="pr-goal">🎯 칭찬만 하는 AI에게 <b>역할</b>을 줘서 검토자로 바꾼다.</p>
      <div class="pr-field"><label>내 기획 초안</label><div class="pr-source">${esc(c.draft)}</div></div>
      <div class="pr-btnrow"><button class="pr-run pr-run--good" data-crit="1">🧐 깐깐한 상사로 검토시키기</button></div>
      <div class="pr-out" id="crit-out"></div>
      ${reflectFooter(s, { gateReady: false, hint: "검토를 실행하면 완료할 수 있어요." })}`;
  }
  // 3-2 찾기 vs 만들기
  function appClassify(s) {
    const c = s.classify;
    return `<p class="pr-goal">🎯 ${c.intro}</p>
      <div class="pr-classify" id="cls-list">
        ${c.items.map((it, i) => `<div class="pr-cls-row" data-i="${i}">
          <span class="pr-cls-t">${esc(it.t)}</span>
          <span class="pr-cls-btns">
            <button data-pick="find">찾기</button><button data-pick="make">만들기</button>
          </span>
          <span class="pr-cls-mark"></span>
        </div>`).join("")}
      </div>
      <div class="pr-out" id="cls-out"></div>
      ${reflectFooter(s, { gateReady: false, hint: "4개를 모두 분류하면 완료할 수 있어요." })}`;
  }
  // 3-3 내 업무 해부
  function appDissect(s) {
    const d = s.dissect;
    return `<p class="pr-goal">🎯 ${esc(d.job)} — 각 단계를 누가 맡을지 라벨을 붙여본다.</p>
      <div class="pr-dissect" id="dis-list">
        ${d.steps.map((st, i) => `<div class="pr-dis-row" data-i="${i}">
          <span class="pr-dis-n">${i + 1}</span>
          <span class="pr-dis-t">${esc(st.t)}</span>
          <span class="pr-dis-btns">${d.options.map(o => `<button data-pick="${o.k}">${o.label}</button>`).join("")}</span>
        </div>`).join("")}
      </div>
      <div class="pr-out" id="dis-rec" hidden></div>
      <div class="pr-gate" id="dis-gate" hidden>
        <p class="pr-sec">${esc(d.gate)}</p>
        <div class="pr-btnrow pr-btnrow--wrap">${d.gateOptions.map((g, i) => `<button class="pr-opt" data-gate="${i}">${esc(g)}</button>`).join("")}</div>
        <div class="pr-out" id="dis-gate-out"></div>
      </div>
      ${reflectFooter(s, { gateReady: false, hint: "단계 라벨과 확인 지점을 모두 정하면 완료할 수 있어요." })}`;
  }
  // 3-4 나의 첫 AX 선언
  function appDeclare(s) {
    const list = STATIONS.filter(x => notes[x.id] && notes[x.id].trim());
    const notesHtml = list.length
      ? list.map(x => `<li><b>${esc(x.title)}</b> — ${esc(notes[x.id])}</li>`).join("")
      : `<li class="pr-empty">아직 저장된 회고가 없어요. 다른 실습에서 '한 줄 회고'를 남겨보세요.</li>`;
    return `<p class="pr-goal">🎯 지금까지의 회고를 모아 보고, <b>이번 주 한 가지</b>를 선언한다.</p>
      <p class="pr-sec">내가 남긴 회고 (${list.length})</p>
      <ul class="pr-notelist">${notesHtml}</ul>
      <div class="pr-field"><label>이번 주에 시작할 한 가지</label>
        <input class="pr-input pr-input--edit" id="decl-one" placeholder="예: 매주 월요일 정기보고 초안을 AI로 먼저 만든다"></div>
      ${reflectFooter(s, { gateReady: false, noReflect: true, hint: "이번 주 한 가지를 적으면 수료할 수 있어요." })}`;
  }

  /* =====================================================================
     패널 인터랙션 바인딩
     ===================================================================== */
  function wirePanel(s) {
    // 공통: 복사 버튼
    panelInner.querySelectorAll(".pr-copy").forEach(b =>
      b.addEventListener("click", () => {
        const txt = decodeURIComponent(b.dataset.copy);
        try { navigator.clipboard.writeText(txt); } catch (e) {}
        const old = b.textContent; b.textContent = "복사됨 ✓"; setTimeout(() => b.textContent = old, 1200);
      }));

    if (s.type === "mission") { wireMission(s); wireReflectFooter(s); return; }
    switch (s.kind) {
      case "compare": wireCompare(s); break;
      case "quiz": wireQuiz(s); break;
      case "summarize": wireSummarize(s); break;
      case "critique": wireCritique(s); break;
      case "classify": wireClassify(s); break;
      case "dissect": wireDissect(s); break;
      case "declare": wireDeclare(s); break;
    }
    wireReflectFooter(s);
  }

  function wireMission(s) {
    const boxes = panelInner.querySelectorAll('input[data-chk]');
    const check = () => setDoneEnabled([...boxes].every(b => b.checked), [...boxes].every(b => b.checked) ? "" : "체크리스트를 모두 확인하면 완료할 수 있어요.");
    boxes.forEach(b => b.addEventListener("change", check));
    if (done.has(s.id)) { boxes.forEach(b => b.checked = true); }
    check();
  }

  function wireCompare(s) {
    const seen = new Set();
    const out = panelInner.querySelector("#cmp-out");
    const R = {
      vague: `<div class="pr-res pr-res--bad"><span class="pr-res-tag">막연하게</span><p>“새로운 혁신을 만나보세요! 최고의 기술과 특별한 경험으로 당신의 일상을 바꿔드립니다. 지금 바로 만나보세요.”</p><small>→ 누구에게나 할 수 있는, 뻔하고 밋밋한 답</small></div>`,
      spec: `<div class="pr-res pr-res--good"><span class="pr-res-tag">구체적으로 <em>(2030 직장인·친근·20자 3개)</em></span><p>① 퇴근길, 손안의 여유<br>② 바쁜 하루의 쉼표<br>③ 오늘도 수고한 나에게</p><small>→ 대상·톤·형식을 주니 바로 쓸 만한 답</small></div>`
    };
    panelInner.querySelectorAll("[data-cmp]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.cmp; b.classList.add("used");
      if (!seen.has(k)) { seen.add(k); out.insertAdjacentHTML(k === "spec" ? "beforeend" : "afterbegin", R[k]); }
      if (seen.size === 2) setDoneEnabled(true, "두 결과의 차이가 보이나요? 회고를 남기고 완료하세요.");
    }));
    if (done.has(s.id)) { out.innerHTML = R.vague + R.spec; setDoneEnabled(true, ""); }
  }

  function wireQuiz(s) {
    const q = s.quiz, out = panelInner.querySelector("#quiz-out");
    panelInner.querySelectorAll(".pr-opt").forEach(b => b.addEventListener("click", () => {
      const pick = +b.dataset.opt;
      panelInner.querySelectorAll(".pr-opt").forEach(x => x.classList.remove("wrong"));
      if (pick === q.answer) {
        panelInner.querySelectorAll(".pr-opt").forEach(x => x.disabled = true);
        b.classList.add("right");
        out.innerHTML = `<div class="pr-res pr-res--good"><b>정답!</b> ${q.why}</div><p class="pr-mission-link">🔗 미션: ${esc(q.mission)}</p>`;
        setDoneEnabled(true, "회고를 남기고 완료하세요.");
      } else {
        b.classList.add("wrong");
        out.innerHTML = `<div class="pr-res pr-res--bad">다시 — ${esc(q.hint)}</div>`;
      }
    }));
    if (done.has(s.id)) { out.innerHTML = `<div class="pr-res pr-res--good"><b>정답!</b> ${q.why}</div>`; setDoneEnabled(true, ""); }
  }

  function wireSummarize(s) {
    const d = s.summarize, out = panelInner.querySelector("#sum-out");
    const three = `<div class="pr-res pr-res--good"><span class="pr-res-tag">3줄 요약</span><p>${d.summary3.map(x => "• " + esc(x)).join("<br>")}</p></div>`;
    const table = `<div class="pr-res pr-res--good"><span class="pr-res-tag">표로 정리</span><table class="pr-table">${d.table.map((row, i) => `<tr>${row.map(c => i === 0 ? `<th>${esc(c)}</th>` : `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
    const note = `<p class="pr-note">📌 ${d.note}</p>`;
    panelInner.querySelectorAll("[data-sum]").forEach(b => b.addEventListener("click", () => {
      out.innerHTML = (b.dataset.sum === "3" ? three : table) + note;
      setDoneEnabled(true, "원본과 대조했나요? 회고 남기고 완료하세요.");
    }));
    if (done.has(s.id)) { out.innerHTML = three + note; setDoneEnabled(true, ""); }
  }

  function wireCritique(s) {
    const c = s.critique, out = panelInner.querySelector("#crit-out");
    const html = `<div class="pr-res pr-res--good"><span class="pr-res-tag">🧐 깐깐한 상사의 검토</span><ol class="pr-crit">${c.points.map(p => `<li>${esc(p)}</li>`).join("")}</ol></div><p class="pr-note">📌 ${c.note}</p>`;
    panelInner.querySelectorAll("[data-crit]").forEach(b => b.addEventListener("click", () => {
      out.innerHTML = html; b.classList.add("used"); setDoneEnabled(true, "회고 남기고 완료하세요.");
    }));
    if (done.has(s.id)) { out.innerHTML = html; setDoneEnabled(true, ""); }
  }

  function wireClassify(s) {
    const c = s.classify, out = panelInner.querySelector("#cls-out");
    const picked = {};
    function check() {
      const all = c.items.every((_, i) => picked[i]);
      if (all) {
        const ok = c.items.every((it, i) => picked[i] === it.a);
        out.innerHTML = `<div class="pr-res pr-res--${ok ? "good" : "bad"}">${ok ? "전부 맞았어요! " : "다시 볼까요 — 표시된 정답을 확인하세요. "}${esc(c.why)}</div>`;
        setDoneEnabled(true, "회고 남기고 완료하세요.");
      }
    }
    panelInner.querySelectorAll(".pr-cls-row").forEach(row => {
      const i = +row.dataset.i;
      row.querySelectorAll("[data-pick]").forEach(btn => btn.addEventListener("click", () => {
        picked[i] = btn.dataset.pick;
        row.querySelectorAll("[data-pick]").forEach(x => x.classList.remove("sel", "ok", "no"));
        btn.classList.add("sel");
        const correct = c.items[i].a;
        const mark = row.querySelector(".pr-cls-mark");
        if (btn.dataset.pick === correct) { btn.classList.add("ok"); mark.textContent = "✓"; mark.className = "pr-cls-mark ok"; }
        else { btn.classList.add("no"); mark.textContent = "정답: " + (correct === "find" ? "찾기" : "만들기"); mark.className = "pr-cls-mark no"; }
        check();
      }));
    });
  }

  function wireDissect(s) {
    const d = s.dissect, rec = panelInner.querySelector("#dis-rec"), gate = panelInner.querySelector("#dis-gate"), gout = panelInner.querySelector("#dis-gate-out");
    const picked = {}; let gatePicked = null;
    function maybeShowRec() {
      if (!d.steps.every((_, i) => picked[i])) return;
      rec.hidden = false;
      rec.innerHTML = `<div class="pr-res pr-res--good"><span class="pr-res-tag">권장안 비교</span><ul class="pr-reclist">${d.steps.map((st, i) => `<li>${i + 1}. ${esc(st.t)} → 내 선택 <b>${label(picked[i])}</b> · 권장 <b class="rec">${esc(st.recLabel)}</b></li>`).join("")}</ul></div>`;
      gate.hidden = false;
    }
    function label(k) { const o = d.options.find(o => o.k === k); return o ? o.label : k; }
    panelInner.querySelectorAll(".pr-dis-row").forEach(row => {
      const i = +row.dataset.i;
      row.querySelectorAll("[data-pick]").forEach(btn => btn.addEventListener("click", () => {
        picked[i] = btn.dataset.pick;
        row.querySelectorAll("[data-pick]").forEach(x => x.classList.remove("sel"));
        btn.classList.add("sel");
        maybeShowRec();
      }));
    });
    panelInner.querySelectorAll("[data-gate]").forEach(btn => btn.addEventListener("click", () => {
      gatePicked = +btn.dataset.gate;
      panelInner.querySelectorAll("[data-gate]").forEach(x => x.classList.remove("right", "wrong"));
      if (gatePicked === d.gateAnswer) { btn.classList.add("right"); gout.innerHTML = `<div class="pr-res pr-res--good"><b>맞아요.</b> ${d.gateWhy}</div>`; setDoneEnabled(true, "회고 남기고 완료하세요."); }
      else { btn.classList.add("wrong"); gout.innerHTML = `<div class="pr-res pr-res--bad">되돌리기 어려운 지점을 다시 생각해보세요.</div>`; }
    }));
    if (done.has(s.id)) { setDoneEnabled(true, ""); }
  }

  function wireDeclare(s) {
    const inp = panelInner.querySelector("#decl-one");
    const check = () => setDoneEnabled(!!(inp && inp.value.trim()), "");
    if (inp) {
      if (notes[s.id]) inp.value = String(notes[s.id]).replace(/^이번 주 한 가지 — /, "");  // 이전 선언 복원
      inp.addEventListener("input", check);
    }
    check();
    // 저장은 wireReflectFooter(declare 분기)가 담당 — 선언값을 notes[3-4]로 저장
  }

  /* =====================================================================
     해금 토스트 · 수료 연출
     ===================================================================== */
  function floorUnlockToast(n) {
    const f = FLOORS.find(x => x.n === n); if (!f) return;
    const t = document.createElement("div");
    t.className = "pr-toast";
    t.innerHTML = `🔓 <b>${n}층 해금!</b> 「${esc(f.title)}」 — ${esc(f.sub)}`;
    document.body.appendChild(t);
    void t.offsetWidth; t.classList.add("show");
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 2600);
  }
  function showGraduation() {
    const g = document.createElement("div");
    g.className = "pr-grad"; g.hidden = false;
    const one = notes["3-4"] ? notes["3-4"].replace(/^이번 주 한 가지 — /, "") : "";
    g.innerHTML = `<div class="pr-grad__box">
        <p class="pr-grad__k">실습실 · 수료</p>
        <h2 class="pr-grad__t">첫 AX, 선언했습니다.</h2>
        ${one ? `<p class="pr-grad__one">“${esc(one)}”</p>` : ""}
        <p class="pr-grad__s">사람이 방향, AI가 초안 — 그 방향은 당신이 잡습니다.</p>
        <button class="pr-grad__btn" id="pr-grad-close">닫기</button>
      </div>`;
    document.body.appendChild(g);
    void g.offsetWidth; g.classList.add("show");
    g.querySelector("#pr-grad-close").addEventListener("click", () => { g.classList.remove("show"); setTimeout(() => g.remove(), 300); });
  }

  /* =====================================================================
     진입점 — 라우터가 호출
     ===================================================================== */
  function openPractice() {
    done = loadDone(); notes = loadNotes();     // 최신 반영
    activeFloor = firstUnlockedFloor();
    render();
  }
  window.openPractice = openPractice;

  // 입장 화면의 [실습실 입장] 문 상태/클릭 (main.js가 씬 소유, 여기서 문만 제어)
  function initPracticeDoor() {
    const door = document.getElementById("practice-door");
    if (!door) return;
    const unlocked = UNLOCK_ALL || curLevel() >= 2;
    door.classList.toggle("locked", !unlocked);
    const lb = door.querySelector(".pdoor-state");
    if (lb) lb.textContent = unlocked ? "3층 · 13개 실습 · AX 징검다리" : "🔒 강의 1회 완주(Lv.2) 시 열림";
    door.addEventListener("click", () => {
      if (UNLOCK_ALL || curLevel() >= 2) App.Router.go("practice");
      else { door.classList.remove("shake"); void door.offsetWidth; door.classList.add("shake"); }
    });
  }
  document.addEventListener("DOMContentLoaded", initPracticeDoor);
  window.refreshPracticeDoor = initPracticeDoor;
})();
