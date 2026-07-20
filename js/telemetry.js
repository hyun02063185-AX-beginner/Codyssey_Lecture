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
        body: JSON.stringify({ code, event_type, payload: payload || {} })
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

  /* ---------- UI: 입장 화면 코드 입력 + HUD 뱃지 ---------- */
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
    // HUD 뱃지 (방·슬라이드 화면 좌측 — 코드가 있을 때만 생성)
    const hudLeft = document.querySelector(".hud__left");
    if (hudLeft) {
      let b = hudLeft.querySelector(".hud__code");
      if (code) {
        if (!b) { b = document.createElement("span"); b.className = "hud__code"; hudLeft.appendChild(b); }
        b.textContent = "🎫 " + code;
        b.title = "수강 코드 — 학습 현황이 강사에게 전달됩니다";
      } else if (b) { b.remove(); }
    }
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
    clearCode: clearCode,     // #/reset 연동
    refreshUI: refreshUI
  };
})();
