/* =========================================================================
   telemetry.js — 수강 코드 + 학습 이벤트 수집 (LMS 1단계)
   -------------------------------------------------------------------------
   · 코드를 입력한 사용자만 전송. 코드가 없으면 네트워크 요청 자체가 없다.
   · localStorage가 여전히 UX의 원본 — 전송은 부가(telemetry).
     서버/함수가 없거나 죽어도 학습 경험은 그대로(fail-silent, console.debug만).
   · 엔진은 이 파일을 몰라도 된다: main.js/practice.js의 완료 지점에
     `window.Telemetry && Telemetry.xxx()` 훅 한 줄씩만 꽂혀 있다.
   ========================================================================= */
(function () {
  "use strict";

  const CODE_KEY = "ax_student_code";
  const ENDPOINT = "/.netlify/functions/track";

  /* ---------- 수강 코드 + 이름 (order/코드방식_서버설정_지시서.md A) ----------
     저장 식별자 = `{반코드}-{이름}` — code 저장 자리는 그대로 두고 합성 문자열만 넣는다
     (시스템 구조 변경 최소화). 반코드는 강사가 #/admin에서 발급한 값, 이름은 학생이 직접
     입력 — 이름 외 개인정보는 어떤 필드로도 수집하지 않는다. */
  function getCode() {
    try { return localStorage.getItem(CODE_KEY) || ""; } catch (e) { return ""; }
  }
  // 전각 영숫자·기호(U+FF01~FF5E)를 반각으로, 전각 공백(U+3000)을 일반 공백으로 —
  // 오타 계열 중 자동 교정 가능한 것만(order/LMS_운영기초_지시서.md ②). 등록 여부 검증은
  // 하지 않는다(코드 목록 노출 방지 — 서버 track.js가 조용히 판정).
  function normalizeCode(raw) {
    const c = String(raw || "")
      .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/　/g, " ")
      .trim()
      .replace(/\s+/g, "");
    return (c.length >= 2 && c.length <= 20) ? c : null;
  }
  // 이름은 내부 공백도 제거한다("김 철수" → "김철수", 지시서 A-1) — 반코드와 합성해 한
  // 식별자 문자열로 만들 때 공백이 있으면 여러 토큰처럼 보여 혼란을 줄 수 있어서다.
  function normalizeName(raw) {
    const n = String(raw || "")
      .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/[\s　]+/g, "");
    return (n.length >= 1 && n.length <= 30) ? n : null;
  }
  function setCode(rawCode, rawName) {
    const code = normalizeCode(rawCode);
    const name = normalizeName(rawName);
    if (!code || !name) return false;
    const identifier = code + "-" + name;
    try { localStorage.setItem(CODE_KEY, identifier); } catch (e) {}
    refreshUI();
    sessionStart();          // 등록 즉시 세션 시작 1건
    // ?join= 링크로 들어와 방금 등록했다면 — 레이어 닫고 바로 강의실 입장 가능하게
    if (joinedViaLink) { joinedViaLink = false; window.CodeLayer && window.CodeLayer.close(); }
    return true;
  }
  function clearCode() {
    try { localStorage.removeItem(CODE_KEY); } catch (e) {}
    try { sessionStorage.removeItem("ax_session_sent"); } catch (e) {}
    refreshUI();
  }

  /* ---------- 전송 (fail-silent) ---------- */
  const sentOnce = new Set();   // 세션 내 중복 방어 (lecture_complete 등)
  function send(event_type, payload) {
    const code = getCode();
    if (!code) return;                       // 코드 없으면 수집 없음 — 요청 자체가 없다
    try {
      fetch(ENDPOINT, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, event_type, payload: payload || {}, course: SITE_CONFIG.course })
      }).catch(function (e) { console.debug("[telemetry] skip:", e && e.message); });
    } catch (e) { console.debug("[telemetry] skip:", e && e.message); }
  }

  /* ---------- 이벤트 5종 ---------- */
  function sessionStart() {
    if (!getCode()) return;
    try { if (sessionStorage.getItem("ax_session_sent")) return; sessionStorage.setItem("ax_session_sent", "1"); } catch (e) {}
    send("session_start", {
      skin: document.documentElement.dataset.skin || "",
      viewMode: window.__isMobile ? "mobile" : "pc"
    });
  }
  function lectureComplete(lectureId) {
    const k = "lec:" + lectureId;
    if (sentOnce.has(k)) return;             // 같은 강의 완료는 세션 내 1회
    sentOnce.add(k);
    let level = 1;
    try { if (window.App && App.Level) level = App.Level.n; } catch (e) {}
    send("lecture_complete", { lectureId: lectureId, level: level });
  }
  function runComplete(newLevel) {
    send("run_complete", { newLevel: newLevel });
  }
  const KIND = { lit: "literacy", nat: "native", tac: "tacit" };
  function diagnosis(examId, scores) {
    send("diagnosis_result", { kind: KIND[examId] || examId, scores: scores || {} });
  }
  function proposal(hasAll) {
    const k = "proposal";
    if (sentOnce.has(k)) return;
    sentOnce.add(k);
    send("proposal_created", { hasAll: !!hasAll });
  }
  function checkup(scores, lowest) {
    send("checkup_result", { scores: scores || {}, lowest: lowest || "" });
  }

  /* ---------- UI: 입장 화면 코드 입력 + 🎫 아이콘↔뱃지 전환 ---------- */
  // 코드 미등록 = 🎫 아이콘 / 등록 = 같은 자리에 코드 텍스트 뱃지("A반-07")로 바뀐다.
  // HUD 쪽 뱃지는 두지 않는다(중복 표시 방지 — 입장 화면 쪽으로 일원화).
  function renderCodeBtn(code) {
    const btn = document.getElementById("code-btn");
    if (!btn) return;
    btn.innerHTML = "";
    const icon = document.createElement("span");
    icon.className = "util-fab__icon";
    icon.textContent = "🎫";
    btn.appendChild(icon);
    if (code) {
      const text = document.createElement("span");
      text.className = "util-fab__code-text";
      text.textContent = code;
      btn.appendChild(text);
      btn.classList.add("has-code");
      btn.title = "수강 코드 — 학습 현황이 강사에게 전달됩니다";
    } else {
      btn.classList.remove("has-code");
      btn.removeAttribute("title");
    }
  }
  function refreshUI() {
    const code = getCode();
    const form = document.getElementById("scode-form");
    const active = document.getElementById("scode-active");
    const cur = document.getElementById("scode-current");
    if (form && active) {
      form.hidden = !!code;
      active.hidden = !code;
      if (cur) cur.textContent = code;
    }
    renderCodeBtn(code);
  }
  /* ---------- 강의용 입장 링크 ?join=반코드 ----------
     🎫 내 정보 레이어를 자동으로 열고 코드칸에 반코드를 채운 뒤 이름칸에 포커스한다 —
     수강생은 이름만 입력하면 된다. 이미 코드가 저장돼 있으면(재방문) 조용히 무시(동일). */
  let joinedViaLink = false;
  function applyJoinLink() {
    if (getCode()) return;
    const m = location.search.match(/[?&]join=([^&]+)/);
    if (!m) return;
    let prefix;
    try { prefix = decodeURIComponent(m[1]); } catch (e) { prefix = m[1]; }
    prefix = prefix.trim();
    if (!prefix) return;
    const codeInput = document.getElementById("scode-code-input");
    const nameInput = document.getElementById("scode-name-input");
    if (!codeInput || !nameInput) return;
    codeInput.value = prefix;
    joinedViaLink = true;
    window.CodeLayer && window.CodeLayer.open();
    nameInput.focus();
  }

  /* ---------- 히든코드 (강사 전용, order/히든코드_지시서.md) ----------
     🎫 코드 입력칸에 "무대뒤."로 시작하는 값을 넣으면 명령으로 처리한다 — 수강 코드로
     저장하지 않고 텔레메트리도 전송하지 않는다(코드 칸에서만 인식, 이름 칸 상태는 무관 —
     비어 있어도 동작). 실패(미등록·비가용 명령)는 아무 반응도 없다 — 존재를 숨긴다.
     기존 URL 방식(?unlock=1 등)은 당분간 병행 유지(치트시트에 함께 기재). */
  const HIDDEN_PREFIX = "무대뒤.";
  function siteHasVariantPersonal() {
    // 경험판(slidesPersonal) 보유 여부를 데이터로 직접 판정 — 사이트별 SITE_CONFIG 플래그를
    // 새로 만들 필요 없이 자동으로 맞는 사이트에서만 켜진다(본진=true, 첫걸음=false).
    try { return CURRICULUM.boxes.some(b => b.lectures.some(l => l.slidesPersonal)); } catch (e) { return false; }
  }
  function hiddenToast(msg) {
    const t = document.createElement("div");
    t.className = "hidden-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    void t.offsetWidth;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 400); }, 2400);
  }
  function hiddenPanel(lines) {
    const t = document.createElement("div");
    t.className = "hidden-toast hidden-toast--panel";
    lines.forEach(function (line) {
      const row = document.createElement("div");
      row.textContent = line;
      t.appendChild(row);
    });
    document.body.appendChild(t);
    void t.offsetWidth;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 400); }, 4200);
  }
  function closeCodeLayerThen(fn) { window.CodeLayer && window.CodeLayer.close(); fn(); }
  function reloadSoon() { setTimeout(function () { location.reload(); }, 500); }

  const HIDDEN_COMMANDS = [
    {
      label: "스킨", available: () => true, match: v => v === "스킨",
      run: () => closeCodeLayerThen(() => {
        window.App && App.cheatSkinUnlock && App.cheatSkinUnlock(true);
        hiddenToast("🎬 무대 뒤: 스킨 전체 해금");
      })
    },
    {
      label: "잠금", available: () => true, match: v => v === "잠금",
      run: () => closeCodeLayerThen(() => {
        window.App && App.cheatSkinUnlock && App.cheatSkinUnlock(false);
        hiddenToast("🎬 무대 뒤: 스킨 해금 원복");
      })
    },
    {
      label: "진단실", available: () => SITE_CONFIG.practiceRoom !== false, match: v => v === "진단실",
      run: () => closeCodeLayerThen(() => {
        try { localStorage.setItem("ax_cheat_practice_unlock", "1"); } catch (e) {}
        hiddenToast("🎬 무대 뒤: 진단실 해금");
        reloadSoon();
      })
    },
    {
      label: "초기화", available: () => true, match: v => v === "초기화",
      run: () => {
        window.CodeLayer && window.CodeLayer.close();
        if (confirm("레벨·진행도·이어보기·수강 코드를 모두 초기화할까요?")) location.hash = "#/reset";
      }
    },
    {
      label: "경험판", available: () => siteHasVariantPersonal(), match: v => v === "경험판",
      run: () => closeCodeLayerThen(() => {
        let on;
        try {
          on = localStorage.getItem("ax_cheat_variant_personal") !== "1";
          if (on) localStorage.setItem("ax_cheat_variant_personal", "1");
          else localStorage.removeItem("ax_cheat_variant_personal");
        } catch (e) { on = false; }
        hiddenToast("🎬 무대 뒤: 경험판 " + (on ? "켜짐" : "꺼짐"));
        reloadSoon();
      })
    },
    {
      label: "테마", available: () => true, match: v => v === "테마",
      run: () => {
        window.CodeLayer && window.CodeLayer.close();
        const openPicker = () => { window.IntroTheme && window.IntroTheme.openPicker(); };
        if (location.hash && location.hash !== "#/") { location.hash = "#/"; setTimeout(openPicker, 60); }
        else openPicker();
      }
    },
    {
      label: "레벨.1~" + ((window.App && App.maxLevel) || 3), available: () => true,
      match: v => /^레벨\.[0-9]+$/.test(v),
      run: v => closeCodeLayerThen(() => {
        const n = parseInt(v.split(".")[1], 10);
        window.App && App.cheatSetLevel && App.cheatSetLevel(n);
        hiddenToast("🎬 무대 뒤: Lv" + n + " 설정");
      })
    },
    {
      label: "관리", available: () => true, match: v => v === "관리",
      run: () => { window.CodeLayer && window.CodeLayer.close(); location.hash = "#/admin"; }
    },
    {
      label: "목록", available: () => true, match: v => v === "목록",
      run: () => closeCodeLayerThen(() => {
        const names = HIDDEN_COMMANDS.filter(c => c.available()).map(c => HIDDEN_PREFIX + c.label);
        hiddenPanel(["🎬 사용 가능한 명령"].concat(names));
      })
    }
  ];
  function tryHiddenCommand(raw) {
    if (raw.indexOf(HIDDEN_PREFIX) !== 0) return false;
    const v = raw.slice(HIDDEN_PREFIX.length).trim();
    const cmd = HIDDEN_COMMANDS.find(c => c.available() && c.match(v));
    if (cmd) cmd.run(v);
    return true;   // 접두어가 맞으면 성공/실패 여부와 무관하게 "히든코드 시도"로 처리(수강 코드로 새지 않게)
  }

  function initUI() {
    const codeInput = document.getElementById("scode-code-input");
    const nameInput = document.getElementById("scode-name-input");
    const setBtn = document.getElementById("scode-set");
    const clearBtn = document.getElementById("scode-clear");
    if (setBtn && codeInput && nameInput) {
      const submit = function () {
        const raw = codeInput.value;
        if (tryHiddenCommand(raw)) { codeInput.value = ""; nameInput.value = ""; return; }
        if (!setCode(raw, nameInput.value)) {
          const badInput = normalizeCode(raw) ? nameInput : codeInput;
          badInput.classList.add("scode__input--bad");
          setTimeout(function () { badInput.classList.remove("scode__input--bad"); }, 900);
        } else { codeInput.value = ""; nameInput.value = ""; }
      };
      setBtn.addEventListener("click", submit);
      codeInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
      nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    }
    if (clearBtn) clearBtn.addEventListener("click", clearCode);
    refreshUI();
    applyJoinLink();
    sessionStart();   // 이미 코드가 저장된 재방문자 — 세션당 1회
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initUI);
  else initUI();

  /* ---------- 엔진 훅용 공개 API ---------- */
  window.Telemetry = {
    lectureComplete: lectureComplete,
    runComplete: runComplete,
    diagnosis: diagnosis,
    proposal: proposal,
    checkup: checkup,
    clearCode: clearCode,     // #/reset 연동
    refreshUI: refreshUI
  };
})();
