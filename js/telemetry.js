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

  /* ---------- 수강 코드 ---------- */
  function getCode() {
    try { return localStorage.getItem(CODE_KEY) || ""; } catch (e) { return ""; }
  }
  function normalize(raw) {
    const c = String(raw || "").replace(/\s+/g, "");
    return (c.length >= 2 && c.length <= 20) ? c : null;
  }
  function setCode(raw) {
    const c = normalize(raw);
    if (!c) return false;
    try { localStorage.setItem(CODE_KEY, c); } catch (e) {}
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
  /* ---------- 강의용 입장 링크 ?join=반이름 ----------
     🎫 내 정보 레이어를 자동으로 열고 입력란에 "반이름-"을 채워, 수강생은 번호만 입력하면 된다.
     이미 코드가 저장돼 있으면(재방문) 조용히 무시 — 재입력을 강요하지 않는다. */
  let joinedViaLink = false;
  function applyJoinLink() {
    if (getCode()) return;
    const m = location.search.match(/[?&]join=([^&]+)/);
    if (!m) return;
    let prefix;
    try { prefix = decodeURIComponent(m[1]); } catch (e) { prefix = m[1]; }
    prefix = prefix.trim();
    if (!prefix) return;
    const input = document.getElementById("scode-input");
    if (!input) return;
    input.value = prefix + "-";
    joinedViaLink = true;
    window.CodeLayer && window.CodeLayer.open();
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
  }

  function initUI() {
    const input = document.getElementById("scode-input");
    const setBtn = document.getElementById("scode-set");
    const clearBtn = document.getElementById("scode-clear");
    if (setBtn && input) {
      const submit = function () {
        if (!setCode(input.value)) {
          input.classList.add("scode__input--bad");
          setTimeout(function () { input.classList.remove("scode__input--bad"); }, 900);
        } else { input.value = ""; }
      };
      setBtn.addEventListener("click", submit);
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
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
