/* =========================================================================
   admin.js — LMS 2단계: 강사 대시보드 (#/admin)
   -------------------------------------------------------------------------
   · main.js의 씬/라우터를 전혀 건드리지 않는 완전 독립 모듈.
     해시가 #/admin 이면 전체화면 오버레이로 렌더하고, 아니면 숨긴다
     (그 사이 main.js는 평소대로 자기 라우팅을 계속한다 — 뒤에서 무해하게).
   · 조회 전용. 원본 이벤트는 절대 받지 않는다 — 서버(stats.js)가 집계한
     요약 JSON만 그린다. ADMIN_KEY는 하드코딩하지 않고, 사용자가 입력한
     값을 매 요청 헤더에 실어 서버에서만 검증한다.
   ========================================================================= */
(function () {
  "use strict";

  const KEY_STORAGE = "ax_admin_key";     // sessionStorage — 브라우저 닫으면 만료
  const ENDPOINT = "/.netlify/functions/stats";
  const LIT_AXES = ["이해", "활용", "검증", "안전"];
  const AXIS_LECTURE = { 검증: "03강", 활용: "04·05강", 이해: "01·06강", 안전: "16강" };
  const NAT_TYPES = ["신중한 전통파", "실용적 병행파", "AI 네이티브"];
  const TAC_VERDICTS = ["개방형", "혼합형", "금고형"];

  const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const isAdminRoute = () => /^#\/admin\b/.test(location.hash);

  const root = document.createElement("div");
  root.id = "admin-root";
  root.className = "admin-root";
  root.hidden = true;
  document.body.appendChild(root);

  function getKey()      { try { return sessionStorage.getItem(KEY_STORAGE) || ""; } catch (e) { return ""; } }
  function setKey(k)     { try { sessionStorage.setItem(KEY_STORAGE, k); } catch (e) {} }
  function clearKey()    { try { sessionStorage.removeItem(KEY_STORAGE); } catch (e) {} }

  async function fetchStats(key, classFilter) {
    const qs = classFilter ? ("?class=" + encodeURIComponent(classFilter)) : "";
    const res = await fetch(ENDPOINT + qs, { headers: { "x-admin-key": key } });
    if (!res.ok) { const e = new Error("stats fetch failed"); e.code = res.status; throw e; }
    return res.json();
  }

  /* =====================================================================
     게이트 — 키 입력
     ===================================================================== */
  function renderGate(errMsg) {
    root.innerHTML =
      '<div class="admin-gate">' +
        '<button class="admin-gate__exit" id="admin-gate-exit" aria-label="닫기">✕</button>' +
        '<div class="admin-gate__box">' +
          '<p class="admin-gate__kicker">강사 전용</p>' +
          '<h1 class="admin-gate__title">사유의 방 · 대시보드</h1>' +
          '<input id="admin-key-input" class="admin-gate__input" type="password" placeholder="접속 키" autocomplete="off" />' +
          '<button id="admin-key-go" class="admin-gate__btn" type="button">입장</button>' +
          (errMsg ? '<p class="admin-gate__err">' + esc(errMsg) + '</p>' : '') +
        '</div>' +
      '</div>';
    const input = root.querySelector("#admin-key-input");
    const go = () => tryEnter(input.value.trim());
    root.querySelector("#admin-key-go").addEventListener("click", go);
    input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    root.querySelector("#admin-gate-exit").addEventListener("click", () => { location.hash = "#/"; });
    input.focus();
  }

  async function tryEnter(key) {
    if (!key) return;
    const btn = root.querySelector("#admin-key-go");
    if (btn) { btn.disabled = true; btn.textContent = "확인 중…"; }
    try {
      const data = await fetchStats(key, "");
      setKey(key);
      renderDashboard(data, key);
    } catch (e) {
      clearKey();
      renderGate(e.code === 401 ? "키가 올바르지 않습니다" : "서버에 연결할 수 없습니다");
    }
  }

  /* =====================================================================
     대시보드
     ===================================================================== */
  const state = { key: "", full: null, view: null, currentClass: "" };

  function classPrefixes(students) {
    const set = new Set();
    students.forEach(s => { const m = /^([^-]+)-/.exec(s.code); if (m) set.add(m[1]); });
    return [...set].sort();
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return iso; }
  }
  function isStale(iso, nowIso) {
    if (!iso) return false;
    const days = (new Date(nowIso) - new Date(iso)) / 86400000;
    return days > 7;
  }
  function isToday(iso, nowIso) {
    if (!iso) return false;
    try { return new Date(iso).toDateString() === new Date(nowIso).toDateString(); } catch (e) { return false; }
  }
  function avgCompletionPct(students) {
    if (!students.length) return 0;
    const sum = students.reduce((a, s) => a + s.completedLectures.length, 0);
    return Math.round((sum / students.length) / 20 * 100);
  }
  function boxAccent(lectureId) {
    try {
      const bi = Math.min(3, Math.floor((lectureId - 1) / 5));
      return (window.CURRICULUM && CURRICULUM.boxes[bi] && CURRICULUM.boxes[bi].accent) || FALLBACK_ACCENTS[bi];
    } catch (e) { return FALLBACK_ACCENTS[0]; }
  }
  const FALLBACK_ACCENTS = ["#3E8E8E", "#7A6BB0", "#CE6D7C", "#79996A"];

  async function renderDashboard(fullData, key) {
    state.key = key; state.full = fullData; state.view = fullData; state.currentClass = "";
    paintDashboard();
  }

  function summaryCard(label, value) {
    return '<div class="admin-card"><span class="admin-card__v">' + esc(value) + '</span><span class="admin-card__l">' + esc(label) + '</span></div>';
  }

  function matrixHTML(d) {
    const lectures = Array.from({ length: 20 }, (_, i) => i + 1);
    const total = d.students.length || 1;
    const head = lectures.map(id => {
      const c = d.aggregate.lectureCompletion[id] || 0;
      const pct = Math.round(c / total * 100);
      return '<th class="admin-mx__th" style="--bx:' + boxAccent(id) + '">' +
        '<span class="admin-mx__no">' + String(id).padStart(2, "0") + '</span>' +
        '<span class="admin-mx__bar"><i style="height:' + pct + '%"></i></span>' +
        '<span class="admin-mx__cnt">' + c + '</span></th>';
    }).join("");
    const rows = d.students.map(s => {
      const cells = lectures.map(id => {
        const done = s.completedLectures.indexOf(id) >= 0;
        return '<td class="admin-mx__td' + (done ? ' is-done' : '') + '" style="--bx:' + boxAccent(id) + '">' + (done ? "●" : "") + '</td>';
      }).join("");
      const stale = isStale(s.lastSeen, d.generatedAt);
      return '<tr class="admin-mx__row" data-code="' + esc(s.code) + '">' +
        '<td class="admin-mx__code">' + (stale ? '<span class="admin-mx__warn" title="7일 이상 활동 없음">⚠</span> ' : '') + esc(s.code) + '</td>' +
        cells +
        '<td class="admin-mx__meta">' + s.completedLectures.length + '/20</td>' +
        '<td class="admin-mx__meta">Lv' + s.level + '</td>' +
        '<td class="admin-mx__meta admin-mx__meta--last">' + fmtTime(s.lastSeen) + '</td>' +
        '</tr>';
    }).join("");
    if (!d.students.length) return '<p class="admin-empty">아직 데이터가 없습니다.</p>';
    return '<div class="admin-mx-wrap"><table class="admin-mx">' +
      '<thead><tr><th class="admin-mx__code admin-mx__code--h">수강생</th>' + head +
      '<th class="admin-mx__meta">완료</th><th class="admin-mx__meta">Lv</th><th class="admin-mx__meta admin-mx__meta--last">최근 활동</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  function literacyCard(d) {
    const lit = d.aggregate.diagnosisAverages.literacy;
    if (!lit) return emptyDiagCard("리터러시 평균", "아직 데이터 없음");
    let low = LIT_AXES[0];
    LIT_AXES.forEach(k => { if (lit[k] < lit[low]) low = k; });
    return '<div class="admin-diag-card">' +
      '<h3 class="admin-diag-card__t">리터러시 평균 (4축)</h3>' +
      '<canvas id="admin-radar-lit" width="220" height="200" class="admin-radar-cv"></canvas>' +
      '<p class="admin-diag-card__note">팀 최약축: <b>' + esc(low) + '</b> → <b>' + esc(AXIS_LECTURE[low]) + '</b> 복습 권장</p>' +
      '</div>';
  }
  function nativeCard(d) {
    const avg = d.aggregate.diagnosisAverages.native;
    if (avg == null) return emptyDiagCard("네이티브 지수", "아직 데이터 없음");
    const dist = { "신중한 전통파": 0, "실용적 병행파": 0, "AI 네이티브": 0 };
    d.students.forEach(s => { const t = s.diagnosis.native; if (t && t.type != null && dist.hasOwnProperty(t.type)) dist[t.type]++; });
    return '<div class="admin-diag-card">' +
      '<h3 class="admin-diag-card__t">네이티브 지수 평균</h3>' +
      '<div class="admin-gauge-row"><span class="admin-gauge-n">' + avg + '</span><span class="admin-gauge-max">/ 100</span></div>' +
      '<div class="exam-gauge"><i style="width:' + avg + '%"></i></div>' +
      '<ul class="admin-dist">' + NAT_TYPES.map(t => '<li>' + esc(t) + ' <b>' + dist[t] + '</b>명</li>').join("") + '</ul>' +
      '</div>';
  }
  function tacitCard(d) {
    const avg = d.aggregate.diagnosisAverages.tacit;
    if (avg == null) return emptyDiagCard("암묵지 위험도", "아직 데이터 없음");
    const dist = { "개방형": 0, "혼합형": 0, "금고형": 0 };
    d.students.forEach(s => { const t = s.diagnosis.tacit; if (t && t.verdict != null && dist.hasOwnProperty(t.verdict)) dist[t.verdict]++; });
    const pct = Math.round((avg - 7) / 28 * 100);
    return '<div class="admin-diag-card">' +
      '<h3 class="admin-diag-card__t">암묵지 평균 위험도</h3>' +
      '<div class="admin-gauge-row"><span class="admin-gauge-n">' + avg + '</span><span class="admin-gauge-max">/ 35</span></div>' +
      '<div class="exam-gauge exam-gauge--risk"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>' +
      '<ul class="admin-dist">' + TAC_VERDICTS.map(v => '<li>' + esc(v) + ' <b>' + dist[v] + '</b>명</li>').join("") + '</ul>' +
      '</div>';
  }
  function checkupCard() {
    return emptyDiagCard("조직 건강검진 평균 (5축)", "아직 데이터 없음 — 3단계에서 수집 예정");
  }
  function emptyDiagCard(title, msg) {
    return '<div class="admin-diag-card admin-diag-card--empty"><h3 class="admin-diag-card__t">' + esc(title) + '</h3>' +
      '<p class="admin-empty">' + esc(msg) + '</p></div>';
  }

  function paintDashboard() {
    const d = state.view;
    const prefixes = classPrefixes(state.full.students);
    root.innerHTML =
      '<div class="admin-dash">' +
        '<header class="admin-head">' +
          '<div class="admin-head__l">' +
            '<span class="admin-head__title">🗂 강사 대시보드</span>' +
            '<span class="admin-head__gen">생성 ' + fmtTime(d.generatedAt) +
              (d.truncated ? ' · <b class="admin-warn">일부만 표시(5000건 초과)</b>' : '') + '</span>' +
          '</div>' +
          '<div class="admin-head__r">' +
            '<select id="admin-class" class="admin-select">' +
              '<option value="">전체 (' + state.full.aggregate.studentCount + '명)</option>' +
              prefixes.map(p => '<option value="' + esc(p) + '"' + (state.currentClass === p ? ' selected' : '') + '>' + esc(p) + '</option>').join("") +
            '</select>' +
            '<button id="admin-refresh" class="admin-btn" type="button">↻ 새로고침</button>' +
            '<button id="admin-exit" class="admin-btn admin-btn--ghost" type="button">✕ 닫기</button>' +
          '</div>' +
        '</header>' +

        '<section class="admin-summary">' +
          summaryCard("수강생 수", d.aggregate.studentCount + "명") +
          summaryCard("평균 완주율", avgCompletionPct(d.students) + "%") +
          summaryCard("오늘 활동", d.students.filter(s => isToday(s.lastSeen, d.generatedAt)).length + "명") +
        '</section>' +

        '<section class="admin-sec">' +
          '<h2 class="admin-sec__t">진행 매트릭스</h2>' +
          matrixHTML(d) +
        '</section>' +

        '<section class="admin-sec">' +
          '<h2 class="admin-sec__t">진단 집계</h2>' +
          '<div class="admin-diag-grid">' + literacyCard(d) + nativeCard(d) + tacitCard(d) + checkupCard(d) + '</div>' +
        '</section>' +
      '</div>' +

      '<div id="admin-detail" class="admin-layer" hidden>' +
        '<div class="admin-layer__backdrop" id="admin-detail-backdrop"></div>' +
        '<div class="admin-layer__sheet" role="dialog" aria-modal="true" aria-label="수강생 상세">' +
          '<header class="admin-layer__head"><span class="admin-layer__title" id="admin-detail-title"></span>' +
            '<button id="admin-detail-close" class="admin-layer__x" aria-label="닫기">✕</button></header>' +
          '<div class="admin-layer__body" id="admin-detail-body"></div>' +
        '</div>' +
      '</div>';

    bindDashboard();
    if (d.aggregate.diagnosisAverages.literacy) {
      const cv = root.querySelector("#admin-radar-lit");
      const lit = d.aggregate.diagnosisAverages.literacy;
      drawRadarMini(cv, LIT_AXES.map(k => lit[k]), LIT_AXES, 5);
    }
  }

  function bindDashboard() {
    const sel = root.querySelector("#admin-class");
    sel.addEventListener("change", async () => {
      const cls = sel.value;
      sel.disabled = true;
      try {
        const data = cls ? await fetchStats(state.key, cls) : state.full;
        state.currentClass = cls; state.view = data;
        paintDashboard();
      } catch (e) {
        if (e.code === 401) { clearKey(); renderGate("키가 만료되었습니다. 다시 입력해주세요."); }
      }
    });
    root.querySelector("#admin-refresh").addEventListener("click", async () => {
      const btn = root.querySelector("#admin-refresh");
      btn.disabled = true; btn.textContent = "불러오는 중…";
      try {
        const full = await fetchStats(state.key, "");
        state.full = full;
        state.view = state.currentClass ? await fetchStats(state.key, state.currentClass) : full;
        paintDashboard();
      } catch (e) {
        if (e.code === 401) { clearKey(); renderGate("키가 만료되었습니다. 다시 입력해주세요."); }
        else { btn.disabled = false; btn.textContent = "↻ 새로고침"; }
      }
    });
    root.querySelector("#admin-exit").addEventListener("click", () => { location.hash = "#/"; });

    root.querySelectorAll(".admin-mx__row").forEach(row => {
      row.addEventListener("click", () => openDetail(row.dataset.code));
    });
    const layer = root.querySelector("#admin-detail");
    root.querySelector("#admin-detail-close").addEventListener("click", () => closeDetail());
    root.querySelector("#admin-detail-backdrop").addEventListener("click", () => closeDetail());
  }
  function closeDetail() {
    const layer = root.querySelector("#admin-detail");
    if (!layer || layer.hidden) return;
    layer.classList.remove("show");
    setTimeout(() => { layer.hidden = true; }, 220);
  }
  // ESC는 대시보드가 다시 그려져도(새로고침·반 필터) 중복 등록되지 않게 모듈 초기화 시 1회만 바인딩.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isAdminRoute() && !root.hidden) closeDetail();
  });

  function openDetail(code) {
    const s = state.view.students.find(x => x.code === code);
    if (!s) return;
    root.querySelector("#admin-detail-title").textContent = code;
    const parts = [];
    parts.push('<div class="admin-detail-row"><span>레벨</span><b>Lv' + s.level + '</b></div>');
    parts.push('<div class="admin-detail-row"><span>최근 활동</span><b>' + fmtTime(s.lastSeen) + '</b></div>');
    parts.push('<div class="admin-detail-row"><span>완료 강의</span><b>' + s.completedLectures.length + '/20</b></div>');
    parts.push('<div class="admin-detail-chips">' + (s.completedLectures.map(id => '<span class="admin-chip">' + String(id).padStart(2, "0") + '강</span>').join("") || '<span class="admin-empty">없음</span>') + '</div>');
    parts.push('<div class="admin-detail-row"><span>제안서</span><b>' + (s.proposal ? "완성 ✓" : "미완성") + '</b></div>');

    const lit = s.diagnosis.literacy;
    parts.push('<h4 class="admin-detail-h">AI 리터러시</h4>' + (lit ?
      '<p class="admin-detail-line">' + esc(lit.level || "") + ' · ' + (lit.total != null ? lit.total + "/40" : "") + ' · 최약축 ' + esc(lit.low || "-") + '</p>' :
      '<p class="admin-empty">미응시</p>'));
    const nat = s.diagnosis.native;
    parts.push('<h4 class="admin-detail-h">AI 네이티브 지수</h4>' + (nat ?
      '<p class="admin-detail-line">' + esc(nat.type || "") + ' · ' + (nat.total != null ? nat.total + "/100" : "") + '</p>' :
      '<p class="admin-empty">미응시</p>'));
    const tac = s.diagnosis.tacit;
    parts.push('<h4 class="admin-detail-h">암묵지 검사</h4>' + (tac ?
      '<p class="admin-detail-line">' + esc(tac.verdict || "") + ' · 위험도 ' + (tac.total != null ? tac.total + "/35" : "") +
      (tac.locks && tac.locks.length ? '<br>🔐 ' + tac.locks.map(esc).join(" · ") : '') + '</p>' :
      '<p class="admin-empty">미응시</p>'));

    root.querySelector("#admin-detail-body").innerHTML = parts.join("");
    const layer = root.querySelector("#admin-detail");
    layer.hidden = false;
    void layer.offsetWidth;
    layer.classList.add("show");
  }

  /* =====================================================================
     리터러시 4축 레이더 — 진단실(practice.js) drawRadar와 같은 기법을
     이 화면 전용으로 다시 그린다(학생 화면 파일은 건드리지 않기 위함).
     ===================================================================== */
  function accentColor() {
    try { return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#E0C58A"; }
    catch (e) { return "#E0C58A"; }
  }
  function drawRadarMini(cv, scores, labels, maxVal) {
    if (!cv) return;
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2 + 4, N = scores.length;
    const R = Math.min(W, H) / 2 - 26;
    ctx.clearRect(0, 0, W, H);
    const ink = "rgba(160,150,135,.5)", accent = accentColor();
    const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    for (let g = 1; g <= 5; g++) {
      ctx.beginPath();
      for (let i = 0; i < N; i++) { const [x, y] = pt(i, R * g / 5); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.strokeStyle = "rgba(160,150,135,.18)"; ctx.stroke();
    }
    for (let i = 0; i < N; i++) {
      const [x, y] = pt(i, R);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
      ctx.strokeStyle = ink; ctx.globalAlpha = .35; ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    for (let i = 0; i < N; i++) { const v = Math.max(0, Math.min(scores[i], maxVal)); const [x, y] = pt(i, R * v / maxVal); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
    ctx.fillStyle = accent + "44"; ctx.fill(); ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < N; i++) {
      const v = Math.max(0, Math.min(scores[i], maxVal)); const [x, y] = pt(i, R * v / maxVal);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.28); ctx.fillStyle = accent; ctx.fill();
    }
    ctx.fillStyle = "rgba(200,190,175,.9)"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
    for (let i = 0; i < N; i++) { const [x, y] = pt(i, R + 16); ctx.fillText(labels[i], x, y + 4); }
  }

  /* =====================================================================
     라우팅 — #/admin 이면 오버레이 표시, 아니면 숨김(main.js는 그대로 둔다)
     ===================================================================== */
  function route() {
    if (!isAdminRoute()) { root.hidden = true; return; }
    root.hidden = false;
    if (root.innerHTML) return;   // 이미 렌더된 상태 유지(게이트든 대시보드든)
    const key = getKey();
    if (key) tryEnter(key); else renderGate();
  }
  window.addEventListener("hashchange", route);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", route);
  else route();
})();
