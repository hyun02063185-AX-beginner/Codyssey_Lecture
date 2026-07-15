/* =========================================================================
   practice.js — 실습실 v3 목업 (산출물형 · 조직 진단)
   · 문제풀이 없음. 완료 = "무언가 만들어져 저장됨". 실제 AI 호출 없음.
   · 기존 씬/스킨/Lv 로직 미변경. Lv는 읽기만. 별도 localStorage 키군 axp_*.
   · 라우터가 #/practice 에서 openPractice() 호출.
   ========================================================================= */
(function () {
  "use strict";
  const scene = document.getElementById("scene-practice");
  if (!scene) return;

  const PKEY = "axp_progress";   // 완료 스테이션 id 배열
  const OKEY = "axp_out";        // 산출물 { id: value }
  const UNLOCK_ALL = /[?&]unlock=1/.test(location.search);

  function loadDone() { try { const a = JSON.parse(localStorage.getItem(PKEY)); return new Set(Array.isArray(a) ? a : []); } catch (e) { return new Set(); } }
  function loadOut() { try { return JSON.parse(localStorage.getItem(OKEY)) || {}; } catch (e) { return {}; } }
  let done = loadDone(), out = loadOut();
  const saveDone = () => { try { localStorage.setItem(PKEY, JSON.stringify([...done])); } catch (e) {} };
  const saveOut = () => { try { localStorage.setItem(OKEY, JSON.stringify(out)); } catch (e) {} };
  const getOut = id => out[id];
  const setOut = (id, v) => { out[id] = v; saveOut(); };

  function curLevel() {
    try { if (window.App && App.Level) return App.Level.n; } catch (e) {}
    const v = parseInt(localStorage.getItem("ax_room_level_v1"), 10);
    return isNaN(v) ? 1 : v;
  }
  const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? (d || 0) : n; };

  /* =====================================================================
     층 · 스테이션 (12개 · 산출물형)
     ===================================================================== */
  const FLOORS = [
    { n: 1, title: "AI 손에 익히기", sub: "개인 스킬" },
    { n: 2, title: "내 일 진단하기", sub: "나의 업무 분석" },
    { n: 3, title: "우리 조직 진단하기", sub: "조직 진단 · 기회 발굴" }
  ];
  const STATIONS = [
    { id: "1-1", floor: 1, type: "mission", icon: "💬", title: "첫 대화 워밍업", tag: "같은 질문 3번 → 무엇이 달랐나 1줄", outLabel: "관찰 기록" },
    { id: "1-2", floor: 1, type: "app", icon: "🛠️", title: "프롬프트 공방", tag: "막연 → 내 버전으로 구체화 (04강)", outLabel: "나의 개선 프롬프트" },
    { id: "1-3", floor: 1, type: "mission", icon: "🧵", title: "꼬리물기 대화", tag: "5턴 이상 다듬어 최고 결과 저장", outLabel: "최고 결과 프롬프트" },
    { id: "1-4", floor: 1, type: "app", icon: "✅", title: "나의 검증 체크리스트", tag: "내 업무에서 반드시 검증할 것 (03강)", outLabel: "검증 항목 3가지" },
    { id: "2-1", floor: 2, type: "app", icon: "📋", title: "업무 인벤토리", tag: "내 업무를 표로 — 진단의 출발점", outLabel: "내 업무 표" },
    { id: "2-2", floor: 2, type: "app", icon: "🧭", title: "찾기/만들기 매핑", tag: "각 업무를 찾기·만들기·반복·판단으로 (07·08·09강)", outLabel: "업무-도구 매핑" },
    { id: "2-3", floor: 2, type: "mission", icon: "🧪", title: "파일럿 실험", tag: "후보 1개를 실제 AI로 — 시간·품질 비교", outLabel: "비교 기록" },
    { id: "2-4", floor: 2, type: "app", icon: "⏱️", title: "나의 시간 계산", tag: "AI로 절반이 되면 — 월 절감 시간 (15강)", outLabel: "월 절감 시간" },
    { id: "3-1", floor: 3, type: "app", icon: "🩺", title: "우리 조직 AX 건강검진", tag: "5차원 자가진단 → 레이더 차트", outLabel: "조직 진단 차트" },
    { id: "3-2", floor: 3, type: "app", icon: "🧱", title: "걸림돌 찾기", tag: "가장 짧은 다리 → 1순위 과제", outLabel: "1순위 과제" },
    { id: "3-3", floor: 3, type: "app", icon: "📐", title: "첫 파일럿 설계", tag: "이전 산출물로 자동 채운 기획서", outLabel: "파일럿 기획서" },
    { id: "3-4", floor: 3, type: "app", icon: "🎓", title: "나의 AX 제안서", tag: "산출물 조립 → 한 장 제안서 (수료)", outLabel: "최종 제안서" }
  ];
  const TOTAL_ST = STATIONS.length;
  const stById = id => STATIONS.find(s => s.id === id);
  const floorStations = n => STATIONS.filter(s => s.floor === n);
  const floorDone = n => floorStations(n).every(s => done.has(s.id));
  const floorDoneCount = n => floorStations(n).filter(s => done.has(s.id)).length;
  function floorUnlocked(n) {
    if (UNLOCK_ALL) return true;
    if (n === 1) return curLevel() >= 2;
    return floorDone(n - 1);
  }
  const unlockReason = n => n === 1 ? "Lv.2 달성 시 해금" : (n - 1) + "층 전부 완료 시 해금";

  /* 인벤토리(2-1) 후보 = 반복 && 규칙뚜렷 && 업무명 있음 */
  function inventoryRows() { const r = getOut("2-1"); return Array.isArray(r) ? r : []; }
  function candidateRows() { return inventoryRows().filter(r => r.name && r.repeat && r.rule); }

  /* =====================================================================
     메인 화면
     ===================================================================== */
  let activeFloor = 1;
  function firstUnlockedFloor() { for (const f of FLOORS) if (floorUnlocked(f.n)) return f.n; return 1; }

  function render() {
    scene.innerHTML = `
      <header class="pr-top">
        <button class="pr-exit" id="pr-exit">← 입장 화면</button>
        <span class="pr-title">실습실 <span class="pr-title__sub">AI 사용 → 우리 조직 AX 도입 킷</span></span>
        <span class="pr-progress">완료 <b>${done.size}</b> / ${TOTAL_ST}${UNLOCK_ALL ? ' · <span class="pr-dev">unlock</span>' : ''}</span>
      </header>
      <div class="pr-inner">
        <div class="pr-floors">${FLOORS.map(floorTab).join("")}</div>
        <div class="pr-stage" id="pr-stage">${floorView(activeFloor)}</div>
      </div>`;
    document.getElementById("pr-exit").addEventListener("click", () => App.Router.go("start"));
    scene.querySelectorAll(".pr-floor-tab").forEach(t => t.addEventListener("click", () => { const n = +t.dataset.floor; if (floorUnlocked(n)) { activeFloor = n; refreshStage(); } }));
    bindCards();
  }
  function refreshStage() {
    const st = document.getElementById("pr-stage"); if (st) st.innerHTML = floorView(activeFloor);
    scene.querySelectorAll(".pr-floor-tab").forEach(t => t.classList.toggle("active", +t.dataset.floor === activeFloor));
    bindCards();
  }
  function floorTab(f) {
    const un = floorUnlocked(f.n), dc = floorDoneCount(f.n), tot = floorStations(f.n).length;
    return `<button class="pr-floor-tab ${f.n === activeFloor ? "active" : ""} ${un ? "" : "locked"}" data-floor="${f.n}">
      <span class="pr-floor-n">${f.n}층</span><span class="pr-floor-t">${esc(f.title)}</span>
      <span class="pr-floor-s">${un ? esc(f.sub) : "🔒 " + esc(unlockReason(f.n))}</span>
      ${un ? `<span class="pr-floor-bar"><i style="width:${tot ? Math.round(dc / tot * 100) : 0}%"></i></span><span class="pr-floor-c">${dc}/${tot}</span>` : ""}
    </button>`;
  }
  function floorView(n) {
    const f = FLOORS.find(x => x.n === n);
    if (!floorUnlocked(n)) return `<div class="pr-locked-note">🔒 ${esc(f.title)} — ${esc(unlockReason(n))}<br><span>${n === 1 ? "강의를 한 번 완주하면(Lv.2) 열립니다." : "이전 층을 모두 완료하면 열립니다."}</span></div>`;
    return `<p class="pr-floor-head">${n}층 · 「${esc(f.title)}」 <span>${esc(f.sub)}</span></p>
      <div class="pr-cards">${floorStations(n).map(card).join("")}</div>`;
  }
  function card(s) {
    const d = done.has(s.id);
    return `<button class="pr-card ${d ? "done" : ""}" data-id="${s.id}">
      <span class="pr-card-ic">${s.icon}</span>
      <span class="pr-card-body">
        <span class="pr-card-t">${esc(s.title)} ${d ? '<em class="pr-chk">✓</em>' : ""}</span>
        <span class="pr-card-tag">${esc(s.tag)}</span>
        ${d ? `<span class="pr-card-view">📄 ${esc(s.outLabel)} 보기 · 수정</span>` : ""}
      </span>
      <span class="pr-badge pr-badge--${s.type}">${s.type === "app" ? "앱 내" : "미션"}</span>
    </button>`;
  }
  function bindCards() { scene.querySelectorAll(".pr-card").forEach(c => c.addEventListener("click", () => openStation(c.dataset.id))); }

  /* =====================================================================
     패널
     ===================================================================== */
  const panel = document.createElement("div");
  panel.className = "pr-panel"; panel.id = "pr-panel"; panel.hidden = true;
  panel.innerHTML = `<div class="pr-panel__box"><button class="pr-panel__x" id="pr-panel-x">✕</button><div class="pr-panel__inner" id="pr-panel-inner"></div></div>`;
  document.body.appendChild(panel);
  const inner = panel.querySelector("#pr-panel-inner");
  panel.querySelector("#pr-panel-x").addEventListener("click", closePanel);
  panel.addEventListener("click", e => { if (e.target === panel) closePanel(); });
  document.addEventListener("keydown", e => { if (!panel.hidden && e.key === "Escape") closePanel(); });
  function openPanel() { panel.hidden = false; void panel.offsetWidth; panel.classList.add("show"); panel.querySelector(".pr-panel__box").scrollTop = 0; }
  function closePanel() { panel.classList.remove("show"); setTimeout(() => { panel.hidden = true; }, 240); }

  function openStation(id) {
    const s = stById(id);
    const badge = `<span class="pr-badge pr-badge--${s.type}">${s.type === "app" ? "앱 내 · 산출물" : "미션 · 실제 AI"}</span>`;
    inner.innerHTML = `<div class="pr-ph"><span class="pr-ph-ic">${s.icon}</span><span><span class="pr-ph-t">${esc(s.title)}</span> ${badge}</span></div><div class="pr-pb" id="pr-pb">${BUILD[id] ? BUILD[id](s) : "<p>준비 중</p>"}</div>`;
    if (WIRE[id]) WIRE[id](s);
    openPanel();
  }

  /* 저장 푸터 + 완료 처리 */
  function saveFooter(id, opts) {
    opts = opts || {};
    return `<div class="pr-reflect">
      <button class="pr-done-btn" id="pr-save" ${opts.ready ? "" : "disabled"}>${done.has(id) ? "수정 저장 ✓" : (opts.label || "저장하고 완료")}</button>
      <p class="pr-done-hint" id="pr-save-hint">${opts.hint || ""}</p></div>`;
  }
  function gateSave(on, hint) { const b = inner.querySelector("#pr-save"); if (b) b.disabled = !on; const h = inner.querySelector("#pr-save-hint"); if (h && hint != null) h.textContent = hint; }
  function onSave(fn) { const b = inner.querySelector("#pr-save"); if (b) b.addEventListener("click", fn); }
  function finish(id, output) {
    const s = stById(id), wasFloorDone = floorDone(s.floor), first = !done.has(id);
    if (output !== undefined) setOut(id, output);
    done.add(id); saveDone();
    if (id === "3-4" || done.size === TOTAL_ST) { closePanel(); setTimeout(showGraduation, 260); render(); return; }
    closePanel();
    if (first && !wasFloorDone && floorDone(s.floor) && s.floor < 3) setTimeout(() => floorUnlockToast(s.floor + 1), 260);
    render();
  }

  /* 미션 공통(순서 카드) */
  function missionSteps(steps) {
    return `<ol class="pr-steps">${steps.map((st, i) => `<li><span class="pr-step-n">${i + 1}</span><span class="pr-step-b">${esc(st.t)}
      ${st.p ? `<span class="pr-prompt"><code>${esc(st.p)}</code><button class="pr-copy" data-copy="${encodeURIComponent(st.p)}">복사</button></span>` : ""}</span></li>`).join("")}</ol>`;
  }
  function bindCopy() { inner.querySelectorAll(".pr-copy").forEach(b => b.addEventListener("click", () => { try { navigator.clipboard.writeText(decodeURIComponent(b.dataset.copy)); } catch (e) {} const o = b.textContent; b.textContent = "복사됨 ✓"; setTimeout(() => b.textContent = o, 1200); })); }

  /* =====================================================================
     스테이션 빌더/와이어
     ===================================================================== */
  const BUILD = {}, WIRE = {};

  /* ---- 1-1 첫 대화 워밍업 (미션) ---- */
  BUILD["1-1"] = s => `<p class="pr-goal">🎯 같은 질문을 3번 보내, AI가 매번 다르게 답하는 걸 확인한다.</p>
    <p class="pr-sec">실제 AI를 열고 — 순서대로</p>
    ${missionSteps([{ t: "ChatGPT·Claude·Gemini 중 아무거나 연다." }, { t: "새 대화로 아래를 3번 보낸다.", p: "우리 회사 소개문 한 단락 써줘" }, { t: "세 답을 비교한다." }])}
    <p class="pr-sec">돌아와서 · 관찰 기록</p>
    <div class="pr-field"><label>세 답에서 무엇이 달랐나요? (1줄)</label>
      <input class="pr-input pr-input--edit" id="in-1-1" placeholder="예: 강조점·길이·말투가 매번 달랐다" value="${esc(getOut('1-1') || '')}"></div>
    ${saveFooter("1-1", { hint: "관찰을 한 줄 적으면 완료돼요." })}`;
  WIRE["1-1"] = () => { bindCopy(); const i = inner.querySelector("#in-1-1"); const c = () => gateSave(!!i.value.trim(), ""); i.addEventListener("input", c); c(); onSave(() => finish("1-1", i.value.trim())); };

  /* ---- 1-2 프롬프트 공방 (앱내, 내 버전 저장) ---- */
  BUILD["1-2"] = s => `<p class="pr-goal">🎯 막연한 요청을 <b>내 버전</b>으로 구체화한다. (정답 없음 — 자기 프롬프트가 산출물)</p>
    <div class="pr-btnrow"><button class="pr-run" id="c-vague">막연하게 보내기</button></div>
    <div class="pr-out" id="c-vague-out"></div>
    <p class="pr-sec">내 프롬프트로 고쳐쓰기 <span style="font-weight:400;text-transform:none;color:var(--ink-dim)">— 대상·역할·톤·형식·분량을 더해요</span></p>
    <div class="pr-field"><textarea class="pr-reflect-in" id="in-1-2" rows="3" placeholder="예: 2030 직장인 대상, 친근한 말투로, SNS용 홍보문구 3개, 각 20자 이내">${esc(getOut('1-2') || '신제품 홍보문구 써줘')}</textarea></div>
    <div class="pr-btnrow"><button class="pr-run pr-run--good" id="c-spec">이 프롬프트로 보내보기(예시 결과)</button></div>
    <div class="pr-out" id="c-spec-out"></div>
    ${saveFooter("1-2", { ready: true, label: "이 프롬프트 저장하고 완료", hint: "고친 프롬프트가 저장됩니다." })}`;
  WIRE["1-2"] = () => {
    const vout = inner.querySelector("#c-vague-out"), sout = inner.querySelector("#c-spec-out"), ta = inner.querySelector("#in-1-2");
    inner.querySelector("#c-vague").addEventListener("click", () => { vout.innerHTML = `<div class="pr-res pr-res--bad"><span class="pr-res-tag">막연하게 → 뻔한 답</span><p>“새로운 혁신을 만나보세요! 최고의 기술과 특별한 경험으로 일상을 바꿔드립니다. 지금 바로 만나보세요.”</p></div>`; });
    inner.querySelector("#c-spec").addEventListener("click", () => { sout.innerHTML = `<div class="pr-res pr-res--good"><span class="pr-res-tag">구체적으로 → 바로 쓸 만한 답 (예시)</span><p>① 퇴근길, 손안의 여유<br>② 바쁜 하루의 쉼표<br>③ 오늘도 수고한 나에게</p></div>`; });
    onSave(() => { const v = ta.value.trim(); if (!v) { gateSave(false, "프롬프트를 입력해 주세요."); return; } finish("1-2", v); });
  };

  /* ---- 1-3 꼬리물기 (미션) ---- */
  BUILD["1-3"] = s => `<p class="pr-goal">🎯 한 번에 끝내지 말고, 5턴 이상 이어 다듬어 <b>가장 좋은 결과</b>를 남긴다.</p>
    <p class="pr-sec">실제 AI를 열고 — 이어서 요청</p>
    ${missionSteps([{ t: "초안을 하나 받는다.", p: "신입 환영 메일 초안 써줘" }, { t: "계속 이어서 다듬는다(5턴 이상).", p: "더 짧게 → 표로 → 우리 팀장 톤으로 → 따뜻하게 → 이모지 빼고" }])}
    <p class="pr-sec">돌아와서 · 최고 결과 저장</p>
    <div class="pr-field"><label>가장 좋았던 최종 프롬프트(또는 시퀀스)를 붙여넣기</label>
      <textarea class="pr-reflect-in" id="in-1-3" rows="3" placeholder="예: '신입 환영 메일을 3문장, 따뜻한 팀장 톤, 이모지 없이'">${esc(getOut('1-3') || '')}</textarea></div>
    ${saveFooter("1-3", { hint: "최종 프롬프트를 붙여넣으면 완료돼요." })}`;
  WIRE["1-3"] = () => { bindCopy(); const i = inner.querySelector("#in-1-3"); const c = () => gateSave(!!i.value.trim(), ""); i.addEventListener("input", c); c(); onSave(() => finish("1-3", i.value.trim())); };

  /* ---- 1-4 나의 검증 체크리스트 (앱내, 작성) ---- */
  BUILD["1-4"] = s => {
    const saved = getOut("1-4") || ["", "", ""];
    return `<p class="pr-goal">🎯 내 업무에서 <b>반드시 검증할 것</b>을 3가지 적어, 나만의 체크리스트를 만든다.</p>
      <div class="pr-two">
        <div class="pr-half"><p class="pr-sec">검증 습관 4가지 (03강)</p>
          <ul class="pr-mini">
            <li>출처를 물어 직접 확인</li><li>같은 질문 다르게 두 번</li>
            <li>숫자·인용은 원자료로 대조</li><li>“모르면 모른다고 해” 먼저 지시</li></ul></div>
        <div class="pr-half"><p class="pr-sec">내 업무에서 반드시 검증할 것</p>
          ${[0, 1, 2].map(i => `<div class="pr-field"><input class="pr-input pr-input--edit" data-ck="${i}" placeholder="${i === 0 ? '예: 보고서에 들어가는 매출 수치' : '검증 항목 ' + (i + 1)}" value="${esc(saved[i] || '')}"></div>`).join("")}</div>
      </div>
      ${saveFooter("1-4", { hint: "최소 1가지를 적으면 완료돼요 (3가지 권장)." })}`;
  };
  WIRE["1-4"] = () => {
    const ins = [...inner.querySelectorAll("[data-ck]")];
    const vals = () => ins.map(i => i.value.trim());
    const c = () => gateSave(vals().some(v => v), "");
    ins.forEach(i => i.addEventListener("input", c)); c();
    onSave(() => finish("1-4", vals()));
  };

  /* ---- 2-1 업무 인벤토리 (편집형 표) ---- */
  function invSeed() { return [{ name: "주간 실적 보고서 작성", per: 1, min: 90, repeat: true, rule: true }, { name: "고객 문의 회신", per: 10, min: 15, repeat: true, rule: false }]; }
  BUILD["2-1"] = s => {
    const rows = inventoryRows().length ? inventoryRows() : invSeed();
    return `<p class="pr-goal">🎯 내 업무를 표로 적는다 — 이 표가 2·3층 진단의 <b>출발점</b>이 된다. (5~8행 권장)</p>
      <div class="axp-tablewrap"><table class="axp-table" id="inv-t">
        <thead><tr><th>업무명</th><th>주당<br>횟수</th><th>1회<br>소요분</th><th>반복적?</th><th>규칙<br>뚜렷?</th><th></th></tr></thead>
        <tbody id="inv-body">${rows.map(invRow).join("")}</tbody></table></div>
      <div class="pr-btnrow"><button class="pr-run" id="inv-add">+ 행 추가</button></div>
      <p class="pr-note">📌 <b>반복적</b>이고 <b>규칙이 뚜렷</b>한 업무(하이라이트)는 <b>AI 적용 후보</b> — 2·4번 실습에서 씁니다.</p>
      ${saveFooter("2-1", { ready: true, hint: "업무명 1개 이상이면 저장됩니다." })}`;
  };
  function invRow(r) {
    r = r || { name: "", per: "", min: "", repeat: false, rule: false };
    const cand = r.repeat && r.rule && r.name;
    return `<tr class="${cand ? "cand" : ""}">
      <td><input class="axp-in" data-f="name" value="${esc(r.name || '')}" placeholder="업무명">${cand ? '<span class="axp-cand">AI 후보</span>' : ''}</td>
      <td><input class="axp-in axp-in--n" data-f="per" type="number" min="0" value="${r.per === '' || r.per == null ? '' : r.per}"></td>
      <td><input class="axp-in axp-in--n" data-f="min" type="number" min="0" value="${r.min === '' || r.min == null ? '' : r.min}"></td>
      <td><button class="axp-tg ${r.repeat ? 'on' : ''}" data-f="repeat">${r.repeat ? 'O' : '—'}</button></td>
      <td><button class="axp-tg ${r.rule ? 'on' : ''}" data-f="rule">${r.rule ? 'O' : '—'}</button></td>
      <td><button class="axp-del" title="삭제">✕</button></td></tr>`;
  }
  WIRE["2-1"] = () => {
    const body = inner.querySelector("#inv-body");
    function readRows() {
      return [...body.querySelectorAll("tr")].map(tr => ({
        name: tr.querySelector('[data-f="name"]').value.trim(),
        per: num(tr.querySelector('[data-f="per"]').value, ""), min: num(tr.querySelector('[data-f="min"]').value, ""),
        repeat: tr.querySelector('[data-f="repeat"]').classList.contains("on"),
        rule: tr.querySelector('[data-f="rule"]').classList.contains("on")
      }));
    }
    function refreshRow(tr) {
      const name = tr.querySelector('[data-f="name"]').value.trim();
      const cand = tr.querySelector('[data-f="repeat"]').classList.contains("on") && tr.querySelector('[data-f="rule"]').classList.contains("on") && name;
      tr.classList.toggle("cand", !!cand);
      let b = tr.querySelector(".axp-cand");
      if (cand && !b) { b = document.createElement("span"); b.className = "axp-cand"; b.textContent = "AI 후보"; tr.querySelector('[data-f="name"]').after(b); }
      else if (!cand && b) b.remove();
    }
    function bindRow(tr) {
      tr.querySelectorAll(".axp-tg").forEach(tg => tg.addEventListener("click", () => { tg.classList.toggle("on"); tg.textContent = tg.classList.contains("on") ? "O" : "—"; refreshRow(tr); }));
      tr.querySelector('[data-f="name"]').addEventListener("input", () => refreshRow(tr));
      tr.querySelector(".axp-del").addEventListener("click", () => { if (body.querySelectorAll("tr").length > 1) tr.remove(); else tr.querySelectorAll(".axp-in").forEach(i => i.value = ""); });
    }
    body.querySelectorAll("tr").forEach(bindRow);
    inner.querySelector("#inv-add").addEventListener("click", () => { const t = document.createElement("template"); t.innerHTML = invRow().trim(); const tr = t.content.firstChild; body.appendChild(tr); bindRow(tr); });
    onSave(() => { const rows = readRows().filter(r => r.name); if (!rows.length) { gateSave(false, "업무명을 1개 이상 적어 주세요."); return; } finish("2-1", rows); });
  };

  /* ---- 2-2 찾기/만들기 매핑 ---- */
  const MAP_LABELS = [{ k: "find", t: "찾기", tip: "이미 있는 자료를 꺼내기 — 지식검색/RAG (07강)" }, { k: "make", t: "만들기", tip: "없던 걸 생성 — 방향은 사람이 (08강)" }, { k: "auto", t: "반복", tip: "정해진 순서 반복 — 자동화 (09강)" }, { k: "human", t: "판단", tip: "가치·책임 판단 — 사람 몫" }];
  BUILD["2-2"] = s => {
    const rows = inventoryRows().filter(r => r.name);
    if (!rows.length) return `<p class="pr-goal">🎯 내 업무를 도구 유형으로 분류한다.</p><div class="pr-locked-note">먼저 <b>2-1 업무 인벤토리</b>를 작성하세요.<br><span>업무 목록이 있어야 분류할 수 있어요.</span></div>${saveFooter("2-2", { hint: "2-1을 먼저 작성해야 해요." })}`;
    const saved = getOut("2-2") || {};
    return `<p class="pr-goal">🎯 각 업무를 <b>찾기 · 만들기 · 반복 · 판단</b>으로 분류한다. (라벨에 마우스를 올리면 근거)</p>
      <div class="axp-map" id="map-list">${rows.map((r, i) => `<div class="axp-map-row" data-i="${i}" data-name="${esc(r.name)}">
        <span class="axp-map-t">${esc(r.name)}</span>
        <span class="axp-map-btns">${MAP_LABELS.map(l => `<button data-k="${l.k}" title="${esc(l.tip)}" class="${saved[r.name] === l.k ? 'sel' : ''}">${l.t}</button>`).join("")}</span>
      </div>`).join("")}</div>
      ${saveFooter("2-2", { hint: "모든 업무를 분류하면 완료돼요." })}`;
  };
  WIRE["2-2"] = () => {
    const list = inner.querySelector("#map-list"); if (!list) return;
    const rows = [...list.querySelectorAll(".axp-map-row")];
    const picked = Object.assign({}, getOut("2-2") || {});
    function check() { gateSave(rows.every(r => picked[r.dataset.name]), rows.every(r => picked[r.dataset.name]) ? "" : "모든 업무를 분류하면 완료돼요."); }
    rows.forEach(r => r.querySelectorAll("[data-k]").forEach(b => b.addEventListener("click", () => { picked[r.dataset.name] = b.dataset.k; r.querySelectorAll("[data-k]").forEach(x => x.classList.remove("sel")); b.classList.add("sel"); check(); })));
    check();
    onSave(() => finish("2-2", picked));
  };

  /* ---- 2-3 파일럿 실험 (미션) ---- */
  BUILD["2-3"] = s => {
    const cands = candidateRows();
    const saved = getOut("2-3") || {};
    const opts = cands.length ? cands.map(r => `<option ${saved.task === r.name ? "selected" : ""}>${esc(r.name)}</option>`).join("") : `<option value="">(2-1에 'AI 후보' 업무가 없어요)</option>`;
    return `<p class="pr-goal">🎯 후보 업무 1개를 실제 AI로 해보고, 기존 방식과 비교 기록을 남긴다.</p>
      <div class="pr-field"><label>실험할 업무 (2-1의 AI 후보)</label><select class="pr-input pr-input--edit" id="p3-task">${opts}</select></div>
      <p class="pr-sec">실제 AI로 그 업무의 일부를 수행한 뒤 — 기록</p>
      <div class="pr-field"><label>걸린 시간(분)</label><input class="pr-input pr-input--edit" id="p3-time" type="number" min="0" value="${saved.time || ''}"></div>
      <div class="pr-field"><label>품질 소감 1줄</label><input class="pr-input pr-input--edit" id="p3-q" placeholder="예: 초안은 80% 쓸 만, 톤만 손봄" value="${esc(saved.q || '')}"></div>
      <div class="pr-field"><label>검증에서 발견한 것 1줄 (03강)</label><input class="pr-input pr-input--edit" id="p3-f" placeholder="예: 숫자 하나가 틀려 원자료로 고침" value="${esc(saved.f || '')}"></div>
      ${saveFooter("2-3", { hint: "시간과 소감을 적으면 완료돼요." })}`;
  };
  WIRE["2-3"] = () => {
    const task = inner.querySelector("#p3-task"), t = inner.querySelector("#p3-time"), q = inner.querySelector("#p3-q"), f = inner.querySelector("#p3-f");
    const c = () => gateSave(!!(t.value.trim() && q.value.trim()), "");
    [t, q, f].forEach(x => x.addEventListener("input", c)); c();
    onSave(() => finish("2-3", { task: task.value, time: num(t.value, 0), q: q.value.trim(), f: f.value.trim() }));
  };

  /* ---- 2-4 나의 시간 계산 ---- */
  BUILD["2-4"] = s => {
    const cands = candidateRows();
    const baseMin = cands.reduce((a, r) => a + num(r.per) * num(r.min), 0);   // 주당 후보 총 소요(분)
    const saved = getOut("2-4") || { pct: 50 };
    return `<p class="pr-goal">🎯 AI 후보 업무의 시간을 줄이면 — <b>월 절감 시간</b>이 얼마인지 계산한다. (경영진 설득 숫자 · 15강)</p>
      ${cands.length ? `<p class="pr-note">2-1의 AI 후보 ${cands.length}건 · 주당 총 <b>${Math.round(baseMin)}분</b> (${(baseMin / 60).toFixed(1)}시간)</p>` : `<div class="pr-locked-note">먼저 <b>2-1</b>에서 'AI 후보' 업무(반복·규칙 뚜렷)를 만들어 주세요.</div>`}
      <div class="pr-field"><label>AI로 이만큼 줄어든다면 — <b id="p4-pctl">${saved.pct}%</b></label>
        <input type="range" class="axp-slider" id="p4-pct" min="30" max="70" step="5" value="${saved.pct}"></div>
      <div class="axp-big" id="p4-big"></div>
      ${saveFooter("2-4", { ready: cands.length > 0, hint: cands.length ? "슬라이더를 정하고 저장하세요." : "2-1을 먼저 작성해야 해요." })}`;
  };
  WIRE["2-4"] = () => {
    const cands = candidateRows(), baseMin = cands.reduce((a, r) => a + num(r.per) * num(r.min), 0);
    const sl = inner.querySelector("#p4-pct"), lab = inner.querySelector("#p4-pctl"), big = inner.querySelector("#p4-big");
    function calc() {
      const pct = +sl.value; lab.textContent = pct + "%";
      const savedMin = baseMin * (pct / 100) * 4.33;             // 월(4.33주) 절감 분
      const hrs = savedMin / 60, days = hrs / 8;
      big.innerHTML = `<span class="axp-big-n">월 ${hrs.toFixed(1)}시간</span><span class="axp-big-s">= 하루 일과 ${days.toFixed(1)}일치 절감</span>`;
      return { pct, savedHrs: +hrs.toFixed(1), days: +days.toFixed(1) };
    }
    let cur = calc();
    sl.addEventListener("input", () => { cur = calc(); });
    onSave(() => finish("2-4", cur));
  };

  /* ---- 3-1 조직 건강검진 (레이더) ---- */
  const AXES = [
    { k: "dir", t: "방향", q: "AI로 뭘 하려는지 말할 수 있는 사람이 있다" },
    { k: "data", t: "데이터", q: "업무 자료가 찾을 수 있게 정리돼 있다" },
    { k: "people", t: "사람", q: "새 도구를 먼저 시도하는 동료가 있다" },
    { k: "rule", t: "규칙", q: "AI에 뭘 넣으면 안 되는지 이야기된 적 있다" },
    { k: "mood", t: "분위기", q: "실패해도 탓하지 않는다" }
  ];
  BUILD["3-1"] = s => {
    const saved = getOut("3-1") || {};
    return `<p class="pr-goal">🎯 우리 조직을 5차원으로 자가진단한다. <b>정답 없음</b> — 지금 우리 모습을 그려보는 것.</p>
      <div class="axp-checkup">
        <div class="axp-sliders">${AXES.map((a, i) => `<div class="axp-srow"><label>${a.t} <span>— ${esc(a.q)}</span></label>
          <input type="range" class="axp-slider" data-ax="${i}" min="1" max="5" step="1" value="${saved[a.k] || 3}"><b class="axp-sval" data-v="${i}">${saved[a.k] || 3}</b></div>`).join("")}</div>
        <div class="axp-radar-wrap"><canvas id="radar-cv" width="300" height="300"></canvas><p class="axp-lowaxis" id="radar-low"></p></div>
      </div>
      ${saveFooter("3-1", { ready: true, hint: "슬라이더로 지금 상태를 그린 뒤 저장하세요." })}`;
  };
  WIRE["3-1"] = () => {
    const sliders = [...inner.querySelectorAll("[data-ax]")], cv = inner.querySelector("#radar-cv"), low = inner.querySelector("#radar-low");
    function scores() { return sliders.map(s => +s.value); }
    function draw() {
      const sc = scores();
      sliders.forEach((s, i) => inner.querySelector(`[data-v="${i}"]`).textContent = s.value);
      drawRadar(cv, sc, AXES.map(a => a.t));
      const min = Math.min(...sc), idx = sc.indexOf(min);
      low.innerHTML = `우리 조직의 <b>가장 짧은 다리</b> — ${AXES[idx].t} (${min}점)`;
    }
    sliders.forEach(s => s.addEventListener("input", draw)); draw();
    onSave(() => { const sc = scores(); const o = {}; AXES.forEach((a, i) => o[a.k] = sc[i]); const idx = sc.indexOf(Math.min(...sc)); o.low = AXES[idx].k; o.lowT = AXES[idx].t; finish("3-1", o); });
  };
  function radarColor() { try { const c = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(); return c || "#E0C58A"; } catch (e) { return "#E0C58A"; } }
  function drawRadar(cv, sc, labels) {
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2 + 4, N = 5;
    const R = Math.min(W, H) / 2 - 26;   // 라벨 여백 확보(캔버스 크기에 맞춰 축소)
    ctx.clearRect(0, 0, W, H);
    const ink = "rgba(160,150,135,.5)", accent = radarColor();
    const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    for (let g = 1; g <= 5; g++) { ctx.beginPath(); for (let i = 0; i < N; i++) { const [x, y] = pt(i, R * g / 5); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.strokeStyle = "rgba(160,150,135,.18)"; ctx.stroke(); }
    for (let i = 0; i < N; i++) { const [x, y] = pt(i, R); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.strokeStyle = ink; ctx.globalAlpha = .35; ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.beginPath(); for (let i = 0; i < N; i++) { const [x, y] = pt(i, R * sc[i] / 5); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath();
    ctx.fillStyle = accent + "44"; ctx.fill(); ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < N; i++) { const [x, y] = pt(i, R * sc[i] / 5); ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.28); ctx.fillStyle = accent; ctx.fill(); }
    ctx.fillStyle = "rgba(200,190,175,.9)"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
    for (let i = 0; i < N; i++) { const [x, y] = pt(i, R + 16); ctx.fillText(labels[i], x, y + 4); }
  }

  /* ---- 3-2 걸림돌 찾기 ---- */
  const CAUSES = {
    dir: ["방향을 말하는 사람이 없다", "말은 있는데 공유가 안 된다", "위에서만 알고 실무는 모른다"],
    data: ["자료가 흩어져 있다", "어디 있는지 아무도 모른다", "정리할 사람/시간이 없다"],
    people: ["먼저 써보는 사람이 없다", "관심은 있는데 시간이 없다", "혼자 쓰고 공유 안 한다"],
    rule: ["규칙이 아예 없다", "있는데 아무도 모른다", "너무 엄격해서 안 쓴다"],
    mood: ["실패하면 탓하는 분위기", "‘AI 쓰면 게으르다’는 눈치", "위에서 쓰라고만 한다"]
  };
  BUILD["3-2"] = s => {
    const ck = getOut("3-1");
    if (!ck || !ck.low) return `<p class="pr-goal">🎯 가장 약한 축의 원인을 짚어 첫 과제를 정한다.</p><div class="pr-locked-note">먼저 <b>3-1 조직 건강검진</b>을 해주세요.<br><span>가장 짧은 다리를 알아야 걸림돌을 찾을 수 있어요.</span></div>${saveFooter("3-2", { hint: "3-1을 먼저 해주세요." })}`;
    const saved = getOut("3-2") || {};
    return `<p class="pr-goal">🎯 가장 짧은 다리 <b>「${esc(ck.lowT)}」</b>가 왜 낮을까? 원인을 골라 첫 과제를 정한다.</p>
      <p class="pr-sec">왜 낮을까요? (해당되는 것)</p>
      <div class="pr-btnrow pr-btnrow--wrap" id="c2-list">${(CAUSES[ck.low] || []).map(c => `<button class="pr-opt ${saved.cause === c ? 'right' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="pr-field"><label>덧붙일 한 줄 (선택)</label><input class="pr-input pr-input--edit" id="c2-note" placeholder="우리 상황을 한 줄로" value="${esc(saved.note || '')}"></div>
      ${saveFooter("3-2", { hint: "원인을 하나 고르면 완료돼요." })}`;
  };
  WIRE["3-2"] = () => {
    const ck = getOut("3-1"); if (!ck || !ck.low) return;
    let cause = (getOut("3-2") || {}).cause || null;
    const note = inner.querySelector("#c2-note");
    inner.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => { cause = b.dataset.c; inner.querySelectorAll("[data-c]").forEach(x => x.classList.remove("right")); b.classList.add("right"); gateSave(true, ""); }));
    gateSave(!!cause, cause ? "" : "원인을 하나 고르면 완료돼요.");
    onSave(() => finish("3-2", { axis: ck.lowT, cause: cause, note: note.value.trim() }));
  };

  /* ---- 3-3 첫 파일럿 설계 ---- */
  BUILD["3-3"] = s => {
    const saved = getOut("3-3") || {};
    const cand = candidateRows()[0], p3 = getOut("2-3") || {}, p4 = getOut("2-4") || {}, c2 = getOut("3-2") || {};
    const what = saved.what || p3.task || (cand && cand.name) || "";
    const measure = saved.measure || (p4.savedHrs ? "월 " + p4.savedHrs + "시간 절감" : "");
    const obstacle = saved.obstacle || (c2.axis ? c2.axis + " — " + (c2.cause || "") : "");
    return `<p class="pr-goal">🎯 이전 산출물을 모아 <b>한 장짜리 파일럿 기획서</b>를 만든다. (자동 채움 · 수정 가능)</p>
      <div class="pr-field"><label>무엇을 (파일럿 업무)</label><input class="pr-input pr-input--edit" id="f-what" value="${esc(what)}" placeholder="예: 주간 실적 보고서 초안"></div>
      <div class="pr-field"><label>누구와</label><input class="pr-input pr-input--edit" id="f-who" value="${esc(saved.who || '')}" placeholder="예: 우리 팀 김대리"></div>
      <div class="pr-field"><label>어디서 멈추고 (사람 확인 지점 · 17강)</label><input class="pr-input pr-input--edit" id="f-gate" value="${esc(saved.gate || '')}" placeholder="예: 발송 직전 내가 최종 확인"></div>
      <div class="pr-field"><label>무엇으로 측정 (절감 시간)</label><input class="pr-input pr-input--edit" id="f-measure" value="${esc(measure)}" placeholder="예: 월 X시간"></div>
      <div class="pr-field"><label>걸림돌 대비 (3-2 과제)</label><input class="pr-input pr-input--edit" id="f-obs" value="${esc(obstacle)}" placeholder="예: 규칙 — 없어서 먼저 최소 가이드 합의"></div>
      ${saveFooter("3-3", { hint: "무엇을·누구와만 채워도 완료돼요." })}`;
  };
  WIRE["3-3"] = () => {
    const what = inner.querySelector("#f-what"), who = inner.querySelector("#f-who");
    const c = () => gateSave(!!(what.value.trim() && who.value.trim()), "");
    [what, who].forEach(x => x.addEventListener("input", c)); c();
    onSave(() => finish("3-3", { what: what.value.trim(), who: who.value.trim(), gate: inner.querySelector("#f-gate").value.trim(), measure: inner.querySelector("#f-measure").value.trim(), obstacle: inner.querySelector("#f-obs").value.trim() }));
  };

  /* ---- 3-4 나의 AX 제안서 (조립 · 복사 · 인쇄 · 수료) ---- */
  BUILD["3-4"] = s => {
    const doneAll = done.size >= TOTAL_ST - (done.has("3-4") ? 0 : 1);   // 3-4 제외 11개 완료면 수료 가능
    return `<p class="pr-goal">🎯 지금까지의 산출물을 <b>한 장</b>으로 조립한다 — 우리 팀에 가져갈 제안서.</p>
      <div class="pr-btnrow"><button class="pr-run" id="pr-copy-all">📋 텍스트 복사</button><button class="pr-run" id="pr-print">🖨️ 인쇄</button></div>
      <div id="axp-proposal" class="axp-proposal">${proposalHTML()}</div>
      <div class="pr-reflect">
        <button class="pr-done-btn" id="pr-save" ${doneAll ? "" : "disabled"}>${done.has("3-4") ? "수료 완료 ✓ · 다시 보기" : "수료하기"}</button>
        <p class="pr-done-hint">${doneAll ? "12개 실습을 마쳤어요. 수료할 수 있습니다." : "나머지 실습을 완료하면 수료할 수 있어요. (지금도 열람·복사·인쇄는 가능)"}</p></div>`;
  };
  function proposalHTML() {
    const inv = inventoryRows(), cand = inv.filter(r => r.repeat && r.rule && r.name);
    const map = getOut("2-2") || {}, p4 = getOut("2-4"), ck = getOut("3-1"), c2 = getOut("3-2"), f = getOut("3-3"), chk = getOut("1-4");
    const slot = (label, html) => `<div class="axp-slot"><h4>${label}</h4>${html || '<p class="axp-empty">아직 작성 전</p>'}</div>`;
    const chkHtml = chk && chk.some(x => x) ? `<ul>${chk.filter(x => x).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
    const candHtml = cand.length ? `<ul>${cand.map(r => `<li>${esc(r.name)} <span class="axp-dim">(주 ${r.per}회·${r.min}분)</span></li>`).join("")}</ul>` : "";
    const mapHtml = Object.keys(map).length ? `<ul>${Object.keys(map).map(k => `<li>${esc(k)} → <b>${MAP_LABELS.find(l => l.k === map[k]) ? MAP_LABELS.find(l => l.k === map[k]).t : map[k]}</b></li>`).join("")}</ul>` : "";
    const timeHtml = p4 && p4.savedHrs ? `<p class="axp-big-n">월 ${p4.savedHrs}시간</p><p class="axp-dim">하루 일과 ${p4.days}일치</p>` : "";
    const ckHtml = ck && ck.lowT ? `<canvas id="prop-radar" width="220" height="200"></canvas><p class="axp-dim">가장 짧은 다리: <b>${esc(ck.lowT)}</b></p>` : "";
    const c2Html = c2 && c2.cause ? `<p><b>${esc(c2.axis)}</b> — ${esc(c2.cause)}${c2.note ? " · " + esc(c2.note) : ""}</p>` : "";
    const fHtml = f && f.what ? `<ul><li>무엇을: ${esc(f.what)}</li><li>누구와: ${esc(f.who || '')}</li>${f.gate ? `<li>확인 지점: ${esc(f.gate)}</li>` : ""}${f.measure ? `<li>측정: ${esc(f.measure)}</li>` : ""}${f.obstacle ? `<li>걸림돌 대비: ${esc(f.obstacle)}</li>` : ""}</ul>` : "";
    return `<div class="axp-prop-head"><h3>우리 팀에 가져갈 한 장</h3><p class="axp-dim">사람이 방향, AI가 초안</p></div>
      <div class="axp-prop-grid">
        ${slot("① 검증 원칙 (1-4)", chkHtml)}
        ${slot("② AI 적용 후보 업무 (2-1)", candHtml)}
        ${slot("③ 업무-도구 매핑 (2-2)", mapHtml)}
        ${slot("④ 기대 절감 시간 (2-4)", timeHtml)}
        ${slot("⑤ 조직 진단 (3-1)", ckHtml)}
        ${slot("⑥ 첫 걸림돌 (3-2)", c2Html)}
        ${slot("⑦ 파일럿 기획 (3-3)", fHtml)}
      </div>`;
  }
  WIRE["3-4"] = () => {
    // 제안서 안 레이더 다시 그림
    const ck = getOut("3-1"), rc = inner.querySelector("#prop-radar");
    if (ck && rc) { const sc = AXES.map(a => ck[a.k] || 3); drawRadar(Object.assign(rc, { width: 220, height: 200 }), sc, AXES.map(a => a.t)); }
    inner.querySelector("#pr-copy-all").addEventListener("click", () => {
      const txt = proposalText(); try { navigator.clipboard.writeText(txt); } catch (e) {}
      const b = inner.querySelector("#pr-copy-all"), o = b.textContent; b.textContent = "복사됨 ✓"; setTimeout(() => b.textContent = o, 1400);
    });
    inner.querySelector("#pr-print").addEventListener("click", () => { document.body.classList.add("axp-printing"); window.print(); setTimeout(() => document.body.classList.remove("axp-printing"), 500); });
    const save = inner.querySelector("#pr-save");
    if (save && !save.disabled) save.addEventListener("click", () => finish("3-4", { done: true }));
    else if (save) save.addEventListener("click", () => {});   // disabled인 경우 no-op
  };
  function proposalText() {
    const inv = inventoryRows(), cand = inv.filter(r => r.repeat && r.rule && r.name);
    const map = getOut("2-2") || {}, p4 = getOut("2-4"), ck = getOut("3-1"), c2 = getOut("3-2"), f = getOut("3-3"), chk = getOut("1-4");
    let L = ["[우리 팀에 가져갈 한 장 · AX 제안]", ""];
    if (chk && chk.some(x => x)) L.push("■ 검증 원칙: " + chk.filter(x => x).join(" / "));
    if (cand.length) L.push("■ AI 적용 후보: " + cand.map(r => `${r.name}(주${r.per}회·${r.min}분)`).join(", "));
    if (Object.keys(map).length) L.push("■ 매핑: " + Object.keys(map).map(k => `${k}→${(MAP_LABELS.find(l => l.k === map[k]) || {}).t || map[k]}`).join(", "));
    if (p4 && p4.savedHrs) L.push(`■ 기대 절감: 월 ${p4.savedHrs}시간 (하루 ${p4.days}일치)`);
    if (ck && ck.lowT) L.push(`■ 조직 진단: 가장 짧은 다리 = ${ck.lowT}`);
    if (c2 && c2.cause) L.push(`■ 첫 걸림돌: ${c2.axis} — ${c2.cause}${c2.note ? " · " + c2.note : ""}`);
    if (f && f.what) L.push(`■ 파일럿: ${f.what} / 누구와 ${f.who || '-'}${f.gate ? " / 확인 " + f.gate : ""}${f.measure ? " / 측정 " + f.measure : ""}`);
    L.push("", "사람이 방향, AI가 초안.");
    return L.join("\n");
  }

  /* =====================================================================
     토스트 · 수료
     ===================================================================== */
  function floorUnlockToast(n) {
    const f = FLOORS.find(x => x.n === n); if (!f) return;
    const t = document.createElement("div"); t.className = "pr-toast";
    t.innerHTML = `🔓 <b>${n}층 해금!</b> 「${esc(f.title)}」`;
    document.body.appendChild(t); void t.offsetWidth; t.classList.add("show");
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 2500);
  }
  function showGraduation() {
    const g = document.createElement("div"); g.className = "pr-grad";
    g.innerHTML = `<div class="pr-grad__box"><p class="pr-grad__k">실습실 · 수료</p><h2 class="pr-grad__t">우리 조직 AX 도입 킷, 완성.</h2>
      <p class="pr-grad__s">검증 원칙부터 파일럿 기획까지 — 한 장으로 정리됐습니다.<br>사람이 방향, AI가 초안.</p>
      <button class="pr-grad__btn" id="pr-grad-close">닫기</button></div>`;
    document.body.appendChild(g); void g.offsetWidth; g.classList.add("show");
    g.querySelector("#pr-grad-close").addEventListener("click", () => { g.classList.remove("show"); setTimeout(() => g.remove(), 300); });
  }

  /* =====================================================================
     진입점
     ===================================================================== */
  function openPractice() { done = loadDone(); out = loadOut(); activeFloor = firstUnlockedFloor(); render(); }
  window.openPractice = openPractice;

  function initPracticeDoor() {
    const door = document.getElementById("practice-door"); if (!door) return;
    const un = UNLOCK_ALL || curLevel() >= 2;
    door.classList.toggle("locked", !un);
    const st = door.querySelector(".pdoor-state");
    if (st) st.textContent = un ? "3층 · 12실습 · 우리 조직 AX 도입 킷" : "🔒 강의 1회 완주(Lv.2) 시 열림";
    if (!door.dataset.bound) {
      door.dataset.bound = "1";
      door.addEventListener("click", () => { if (UNLOCK_ALL || curLevel() >= 2) App.Router.go("practice"); else { door.classList.remove("shake"); void door.offsetWidth; door.classList.add("shake"); } });
    }
  }
  document.addEventListener("DOMContentLoaded", initPracticeDoor);
  window.refreshPracticeDoor = initPracticeDoor;
})();
