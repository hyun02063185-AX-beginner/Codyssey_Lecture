/* =========================================================================
   main.js — 씬 매니저 · 배경 캔버스 · 진행도(게이미피케이션) 상태
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- 진행도 상태 (localStorage 저장) ---------- */
  const STORE_KEY = "ax_room_progress_v1";
  const Progress = {
    seen: new Set(),
    load() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) this.seen = new Set(JSON.parse(raw));
      } catch (e) { /* localStorage 불가 환경이면 세션 메모리로만 동작 */ }
    },
    save() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify([...this.seen])); }
      catch (e) {}
    },
    mark(id) { this.seen.add(id); this.save(); App.updateHUD(); },
    has(id) { return this.seen.has(id); },
    count() { return this.seen.size; },
    reset() { this.seen.clear(); this.save(); App.updateHUD(); }
  };

  /* ---------- FX 속도 배율 — sayu(사유의 방)는 명상적으로 2배 느리게 ---------- */
  // CSS 전환/애니메이션은 style.css의 sayu 블록에서, JS setTimeout류는 이 배율로 맞춘다.
  const fxScale = () => (document.documentElement.dataset.skin === "sayu" ? 2 : 1);
  window.__fxScale = fxScale;   // room.js 등에서 재사용

  /* ---------- 스킨(테마) — 진행도와 별도 키(axRoomSkin) ---------- */
  const SKIN_KEY = "axRoomSkin";
  const SKINS = ["paper", "neon", "pixel", "blueprint", "sayu"];
  const Skin = {
    current: "paper",
    load() {
      let s = null;
      try { s = localStorage.getItem(SKIN_KEY); } catch (e) { /* localStorage 불가 */ }
      this.set(SKINS.includes(s) ? s : "paper", false);   // 저장값 없으면 기본 paper
    },
    set(name, persist) {
      if (!SKINS.includes(name)) name = "paper";
      this.current = name;
      document.documentElement.dataset.skin = name;
      if (persist !== false) { try { localStorage.setItem(SKIN_KEY, name); } catch (e) {} }
      if (window.__bgSetSkin) window.__bgSetSkin(name);   // 배경 캔버스도 스킨 인식
      syncPicker();
    }
  };
  function syncPicker() {
    document.querySelectorAll(".skin-opt").forEach(b =>
      b.setAttribute("aria-pressed", b.dataset.skin === Skin.current ? "true" : "false"));
  }
  function initSkinPicker() {
    document.querySelectorAll(".skin-opt").forEach(btn =>
      btn.addEventListener("click", () => Skin.set(btn.dataset.skin, true)));
    syncPicker();
  }

  /* ---------- 씬 전환 ---------- */
  const scenes = {
    start: document.getElementById("scene-start"),
    room: document.getElementById("scene-room"),
    slides: document.getElementById("scene-slides")
  };
  function goScene(name) {
    Object.values(scenes).forEach(s => s.classList.remove("is-active"));
    scenes[name].classList.add("is-active");
  }

  /* ---------- HUD 갱신 ---------- */
  const TOTAL = CURRICULUM.boxes.reduce((n, b) => n + b.lectures.length, 0);
  function updateHUD() {
    const c = Progress.count();
    const pct = Math.round((c / TOTAL) * 100);
    const found = document.getElementById("found-count");
    const fill = document.getElementById("xp-fill");
    const pctEl = document.getElementById("xp-pct");
    if (found) found.textContent = c;
    if (fill) fill.style.width = pct + "%";
    if (pctEl) pctEl.textContent = pct;
    // 상자 내 완료 점 갱신
    if (window.refreshBoxDots) window.refreshBoxDots();
  }

  /* ---------- 전역 네임스페이스 ---------- */
  const App = window.App = {
    Progress, Skin, goScene, updateHUD, TOTAL,
    accent: "#22d3ee"
  };
  window.Progress = Progress;

  /* ---------- 입장 버튼 → 워프 → 방 ---------- */
  function initStart() {
    const btn = document.getElementById("enter-btn");
    const warp = document.getElementById("warp");
    btn.addEventListener("click", () => {
      const k = fxScale();          // sayu면 워프/전환도 2배 느리게
      warp.classList.remove("go");
      void warp.offsetWidth;        // reflow로 애니메이션 리셋
      warp.classList.add("go");
      btn.disabled = true;
      setTimeout(() => goScene("room"), 620 * k);   // 화면이 하얗게 뜬 순간 전환
      setTimeout(() => { window.revealBoxes && window.revealBoxes(); }, 780 * k);
      setTimeout(() => { btn.disabled = false; }, 1300 * k);
    });
  }

  /* ---------- 진행도 초기화 버튼 ---------- */
  function initReset() {
    const btn = document.getElementById("reset-progress");
    if (btn) btn.addEventListener("click", () => {
      Progress.reset();
      if (window.refreshCardsSeen) window.refreshCardsSeen();
    });
  }

  /* ---------- 배경: 별 + 흐르는 성운 ---------- */
  function initBackground() {
    const canvas = document.getElementById("bg-canvas");
    const ctx = canvas.getContext("2d");
    const DPR = window.devicePixelRatio || 1;
    let w, h, stars = [], dust = [];
    let bgSkin = "paper";
    // 스킨 전환 시 배경 표현을 바꾼다 (네온=별+성운, 픽셀=도트 별, sayu=따뜻한 별빛, paper/blueprint=비움)
    window.__bgSetSkin = function (s) { bgSkin = s; };
    function resize() {
      w = canvas.width = window.innerWidth * DPR;
      h = canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      const count = Math.min(180, Math.floor((w * h) / 26000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.5 * DPR + 0.3,
        a: Math.random(), tw: Math.random() * 0.02 + 0.004,
        dy: (Math.random() * 0.12 + 0.02) * DPR
      }));
      dust = Array.from({ length: 5 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: (Math.random() * 260 + 180) * DPR,
        hue: Math.random() > 0.5 ? "34,211,238" : "168,85,247",
        dx: (Math.random() - 0.5) * 0.12 * DPR,
        dy: (Math.random() - 0.5) * 0.12 * DPR
      }));
    }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      if (bgSkin === "neon") {
        // 성운 구름 (네온 전용 — 밝은 배경 위에 어두운 성운이 뜨는 것을 방지)
        dust.forEach(d => {
          d.x += d.dx; d.y += d.dy;
          if (d.x < -d.r) d.x = w + d.r; if (d.x > w + d.r) d.x = -d.r;
          if (d.y < -d.r) d.y = h + d.r; if (d.y > h + d.r) d.y = -d.r;
          const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
          g.addColorStop(0, `rgba(${d.hue},0.06)`);
          g.addColorStop(1, `rgba(${d.hue},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
        });
        // 별
        stars.forEach(s => {
          s.a += s.tw; const alpha = 0.35 + Math.abs(Math.sin(s.a)) * 0.65;
          s.y += s.dy; if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
          ctx.beginPath();
          ctx.fillStyle = `rgba(200,225,255,${alpha})`;
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (bgSkin === "pixel") {
        // 성운 끄고, 도트 별 몇 개만 (형광 그린 사각 픽셀)
        stars.forEach(s => {
          s.a += s.tw; const alpha = 0.25 + Math.abs(Math.sin(s.a)) * 0.4;
          s.y += s.dy; if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
          ctx.fillStyle = `rgba(88,227,107,${alpha})`;
          const px = 2 * DPR;
          ctx.fillRect(Math.round(s.x / px) * px, Math.round(s.y / px) * px, px, px);
        });
      } else if (bgSkin === "sayu") {
        // 사유의 방 — 차가운 성운 끄고, 별이 내리는 천장:
        // 따뜻한 골드 별빛을 성기게(약 1/3), 아주 느리고 은은하게(번쩍임 없음)
        stars.forEach((s, i) => {
          if (i % 3 !== 0) return;                              // 밀도 낮게
          s.a += s.tw * 0.4;                                    // 아주 느린 반짝임
          const alpha = 0.12 + Math.abs(Math.sin(s.a)) * 0.32;  // 낮은 투명도
          s.y += s.dy * 0.35;                                   // 아주 느리게 내려온다
          if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
          ctx.beginPath();
          ctx.fillStyle = `rgba(224,197,138,${alpha})`;         // #E0C58A 별빛 골드
          ctx.arc(s.x, s.y, s.r * 0.9, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      // paper · blueprint: 캔버스 비움(그리드/여백이 배경 역할)
      requestAnimationFrame(frame);
    }
    window.addEventListener("resize", resize);
    resize(); frame();
  }

  /* ---------- 부트 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    Progress.load();
    initBackground();               // __bgSetSkin 준비 후
    initSkinPicker();               // 선택기 버튼 이벤트
    Skin.load();                    // 저장된 스킨 반영(없으면 paper) + 배경 통지
    initStart();
    initReset();
    App.updateHUD = updateHUD;      // room.js가 참조하도록 확정
    window.buildRoom && window.buildRoom();   // 상자 생성
    window.initSlides && window.initSlides(); // 슬라이드 엔진 초기화
    updateHUD();
  });
})();
