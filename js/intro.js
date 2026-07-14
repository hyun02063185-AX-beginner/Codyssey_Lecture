/* =========================================================================
   intro.js — 시작 인트로 화면보호기 (4분할 → 테마 전체화면 → 강의실 입장)
   · 통합 파티클 엔진: requestAnimationFrame 루프 하나로 활성 캔버스만 그림.
   · 테마 = config (INTRO_THEMES). 추가/삭제 쉽게 배열로 관리.
   · UI 스킨(5종)·data-skin·기존 씬 로직과 완전히 별개. 입장은 App.Router.go('start') 재사용.
   ========================================================================= */
(function () {
  "use strict";

  const scene = document.getElementById("scene-intro");
  if (!scene) return;
  const gridEl = document.getElementById("intro-grid");
  const fullEl = document.getElementById("intro-full");
  const fullCv = document.getElementById("intro-full-cv");
  const backBtn = document.getElementById("intro-back");
  const enterHint = document.getElementById("intro-enter");
  const cells = [...gridEl.querySelectorAll(".intro-cell")];

  // 기기 모드: 모바일(수강자)=별똥별 고정·테마선택 없음 / PC(시연)=저장 테마 + 테마 고르기
  const IS_MOBILE = (typeof window.__isMobile === "boolean") ? window.__isMobile
    : !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  const INTRO_KEY = "ax_intro_theme";
  // [B] 코드 고정 기본 인트로 테마 — 저장값·?theme= 가 없을 때 모두에게 적용된다.
  //   ★향후 DB 필요한 서비스로 발전하면, 이 값을 서버/DB 설정에서 받아오도록 교체할 것.
  //   (star=별똥별 · sakura=벚꽃 · fireworks=불꽃놀이 · snow=함박눈)
  const DEFAULT_INTRO_THEME = "star";
  function loadTheme() {
    try { const t = localStorage.getItem(INTRO_KEY); if (INTRO_THEMES.indexOf(t) >= 0) return t; } catch (e) {}
    return DEFAULT_INTRO_THEME;
  }
  function saveTheme(t) { try { localStorage.setItem(INTRO_KEY, t); } catch (e) {} }

  const REDUCE = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- 유틸 ---------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a.toFixed(3) + ")";
  }
  // 함박눈용 부드러운 스프라이트(한 번만 렌더 → drawImage로 저비용 blur)
  const snowSprite = (function () {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.45, "rgba(226,240,255,0.55)");
    grd.addColorStop(1, "rgba(226,240,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
    return c;
  })();

  /* =====================================================================
     테마 정의 — 각 테마: { key, label, bg, create(w,h,quality), frame(inst) }
     quality: 'preview'(4분할, 입자↓) | 'full'(전체화면, 풀 품질)
     ===================================================================== */
  const THEMES = {
    /* ① 별똥별 */
    star: {
      bg: "#0A0A14",
      create(w, h, q) {
        const scale = q === "full" ? 1 : 0.5;
        const n = Math.round(Math.min(240, (w * h) / 6500) * scale);
        const stars = Array.from({ length: n }, () => ({
          x: Math.random() * w, y: Math.random() * h,
          r: Math.random() * 1.3 + 0.3, a: Math.random() * 6.28,
          tw: Math.random() * 0.03 + 0.005, dy: Math.random() * 0.12 + 0.02
        }));
        return { stars, shooters: [], q };
      },
      frame(inst) {
        const { ctx, w, h, st } = inst;
        ctx.fillStyle = this.bg; ctx.fillRect(0, 0, w, h);
        for (const s of st.stars) {
          s.a += s.tw; const al = 0.35 + Math.abs(Math.sin(s.a)) * 0.65;
          s.y += s.dy * 0.6; if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
          ctx.beginPath(); ctx.fillStyle = "rgba(224,197,138," + al.toFixed(3) + ")";
          ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
        }
        const maxSh = st.q === "full" ? 2 : 1;
        const prob = st.q === "full" ? 0.02 : 0.008;
        if (st.shooters.length < maxSh && Math.random() < prob) {
          const sp = rand(4, 7), ang = Math.PI * (0.15 + Math.random() * 0.12);
          st.shooters.push({
            x: Math.random() * w * 0.85, y: Math.random() * h * 0.3,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            len: rand(10, 18), life: 60, max: 60
          });
        }
        for (const sh of st.shooters) {
          sh.x += sh.vx; sh.y += sh.vy; sh.life--;
          const tx = sh.x - sh.vx * sh.len, ty = sh.y - sh.vy * sh.len;
          const a = Math.max(0, sh.life / sh.max * 1.3);
          const g = ctx.createLinearGradient(sh.x, sh.y, tx, ty);
          g.addColorStop(0, "rgba(255,240,210," + (0.9 * a).toFixed(3) + ")");
          g.addColorStop(1, "rgba(255,240,210,0)");
          ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.beginPath(); ctx.fillStyle = "rgba(255,250,232," + a.toFixed(3) + ")";
          ctx.arc(sh.x, sh.y, 1.7, 0, 6.283); ctx.fill();
        }
        st.shooters = st.shooters.filter(s => s.life > 0 && s.x < w + 40 && s.y < h + 40);
      }
    },

    /* ② 벚꽃 */
    sakura: {
      bg: "#1A1420",
      cols: ["#F7C8D6", "#F4A6C0", "#F9D5E0", "#EFB4CC"],
      create(w, h, q) {
        const scale = q === "full" ? 1 : 0.5;
        const n = Math.round(Math.min(150, (w * h) / 13000) * scale);
        const cols = this.cols;
        const p = Array.from({ length: n }, () => ({
          x: Math.random() * w, y: Math.random() * h,
          s: rand(4, 9), rot: Math.random() * 6.28, rs: (Math.random() - 0.5) * 0.05,
          amp: rand(0.3, 1.1), ph: Math.random() * 6.28,
          vy: rand(0.35, 0.85), drift: (Math.random() - 0.5) * 0.2,
          c: cols[(Math.random() * cols.length) | 0]
        }));
        return { p };
      },
      frame(inst) {
        const { ctx, w, h, st } = inst;
        ctx.fillStyle = this.bg; ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 0.9;
        for (const f of st.p) {
          f.ph += 0.03; f.rot += f.rs;
          f.x += Math.sin(f.ph) * f.amp + f.drift; f.y += f.vy;
          if (f.y > h + 8) { f.y = -8; f.x = Math.random() * w; }
          if (f.x < -12) f.x = w + 12; else if (f.x > w + 12) f.x = -12;
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
          ctx.fillStyle = f.c;
          ctx.beginPath(); ctx.ellipse(0, 0, f.s, f.s * 0.55, 0, 0, 6.283); ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    },

    /* ③ 불꽃놀이 — 은은하되 또렷하게(글로우 포함) */
    fireworks: {
      bg: "#0A0A14",
      cols: ["#FFD24A", "#4AD6E0", "#F58CC0", "#7DE08C", "#C39BFF"],
      create(w, h, q) {
        return { rockets: [], sparks: [], q, timer: rand(15, 45), inited: false };
      },
      frame(inst) {
        const { ctx, w, h, st } = inst;
        if (!st.inited) { ctx.fillStyle = this.bg; ctx.fillRect(0, 0, w, h); st.inited = true; }
        else { ctx.fillStyle = "rgba(10,10,20,0.18)"; ctx.fillRect(0, 0, w, h); } // 잔상(빛 궤적)
        const maxRockets = st.q === "full" ? 3 : 1;
        st.timer--;
        if (st.timer <= 0 && st.rockets.length < maxRockets) {
          const col = this.cols[(Math.random() * this.cols.length) | 0];
          st.rockets.push({
            x: w * (0.18 + Math.random() * 0.64), y: h,
            vy: -(h * 0.013 + Math.random() * h * 0.005),
            targetY: h * (0.18 + Math.random() * 0.3), col
          });
          st.timer = (st.q === "full" ? 42 : 95) + Math.random() * 50;
        }
        for (const r of st.rockets) {
          r.y += r.vy; r.vy *= 0.99;
          ctx.globalAlpha = 0.85; ctx.fillStyle = r.col;
          ctx.beginPath(); ctx.arc(r.x, r.y, 2.2, 0, 6.283); ctx.fill();
          ctx.globalAlpha = 0.22;
          ctx.beginPath(); ctx.arc(r.x, r.y, 5.2, 0, 6.283); ctx.fill();
          if (r.y <= r.targetY || r.vy > -0.7) {
            const N = st.q === "full" ? 72 : 34;
            const base = rand(2.0, 3.6);
            for (let i = 0; i < N; i++) {
              const a = (i / N) * 6.283, sp = base * (0.5 + Math.random());
              st.sparks.push({
                x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: rand(55, 95), max: 95, r: rand(1.7, 3.1), col: r.col
              });
            }
            r.dead = true;
          }
        }
        st.rockets = st.rockets.filter(r => !r.dead);
        for (const s of st.sparks) {
          s.vy += 0.028; s.vx *= 0.986; s.vy *= 0.986;
          s.x += s.vx; s.y += s.vy; s.life--;
          const a = Math.max(0, s.life / s.max);
          ctx.fillStyle = s.col;
          ctx.globalAlpha = a * 0.25;                       // 글로우
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.2, 0, 6.283); ctx.fill();
          ctx.globalAlpha = a;                              // 코어
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
        st.sparks = st.sparks.filter(s => s.life > 0);
      }
    },

    /* ④ 함박눈 */
    snow: {
      bg: "#0B1626",
      create(w, h, q) {
        const scale = q === "full" ? 1 : 0.5;
        const n = Math.round(Math.min(160, (w * h) / 9000) * scale);
        const p = Array.from({ length: n }, () => {
          const r = rand(1.8, 5.5);
          return {
            x: Math.random() * w, y: Math.random() * h, r,
            vy: r * 0.12 + 0.15, amp: rand(0.2, 1.0),
            ph: Math.random() * 6.28, al: rand(0.4, 0.9)
          };
        });
        return { p };
      },
      frame(inst) {
        const { ctx, w, h, st } = inst;
        ctx.fillStyle = this.bg; ctx.fillRect(0, 0, w, h);
        for (const f of st.p) {
          f.ph += 0.01; f.x += Math.sin(f.ph) * f.amp * 0.4; f.y += f.vy;
          if (f.y > h + 6) { f.y = -6; f.x = Math.random() * w; }
          if (f.x < -8) f.x = w + 8; else if (f.x > w + 8) f.x = -8;
          ctx.globalAlpha = f.al;
          const d = f.r * 4;              // 스프라이트 = 코어보다 넓은 부드러운 헤일로
          ctx.drawImage(snowSprite, f.x - d / 2, f.y - d / 2, d, d);
        }
        ctx.globalAlpha = 1;
      }
    }
  };

  // 4분할 순서/구성 — 여기 배열만 바꾸면 테마 추가/삭제 가능
  const INTRO_THEMES = ["star", "sakura", "fireworks", "snow"];

  /* =====================================================================
     엔진 — 인스턴스(캔버스) 목록을 단일 rAF 루프로 그림
     ===================================================================== */
  function makeInst(canvas, theme, quality) {
    return { canvas, ctx: canvas.getContext("2d"), theme, quality, w: 0, h: 0, st: null };
  }
  const gridInsts = cells.map(c => makeInst(c.querySelector(".intro-cell__cv"), c.dataset.theme, "preview"));
  const fullInst = makeInst(fullCv, INTRO_THEMES[0], "full");

  function sizeInst(inst, cw, ch) {
    cw = Math.max(1, Math.round(cw)); ch = Math.max(1, Math.round(ch));
    inst.canvas.width = Math.round(cw * DPR); inst.canvas.height = Math.round(ch * DPR);
    inst.w = cw; inst.h = ch;                       // 좌표는 CSS px로 통일
    inst.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function seed(inst) {
    inst.st = THEMES[inst.theme].create(inst.w, inst.h, inst.quality);
  }

  let running = false, rafId = null, mode = "grid", lastTheme = loadTheme(), hintTimer = 0;
  const activeInsts = () => (mode === "grid" ? gridInsts : [fullInst]);

  function drawOnce() {
    for (const inst of activeInsts()) {
      if (inst.st && inst.w > 1) THEMES[inst.theme].frame(inst);
    }
  }
  function tick() {
    if (!running) { rafId = null; return; }
    drawOnce();
    rafId = requestAnimationFrame(tick);
  }
  function start() {
    if (REDUCE) { drawOnce(); return; }            // 모션 최소화: 1프레임 정적 렌더
    if (running) return;
    running = true;
    if (!rafId) rafId = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ---------- 4분할 준비 ---------- */
  let gridReady = false;
  function ensureGrid(force) {
    gridInsts.forEach((inst, i) => {
      const rect = cells[i].getBoundingClientRect();
      if (force || !inst.st || inst.w !== Math.round(rect.width)) {
        sizeInst(inst, rect.width, rect.height);
        seed(inst);
      }
    });
    gridReady = true;
  }

  /* ---------- 전체화면 인트로를 바로 띄운다(부팅·재진입 기본) ----------
     PC=저장 테마 / 모바일=별똥별 고정. 그리드(테마 선택)는 PC에서 '테마 고르기'로만 진입. */
  function showFull(theme) {
    if (INTRO_THEMES.indexOf(theme) < 0) theme = DEFAULT_INTRO_THEME;
    lastTheme = theme;
    fullInst.theme = theme;
    sizeInst(fullInst, window.innerWidth, window.innerHeight);
    seed(fullInst);
    mode = "full";
    fullEl.dataset.theme = theme;                     // 현재 인트로 테마(디버그·검증용)
    fullEl.hidden = false;
    fullEl.style.transition = "none";
    fullEl.style.transformOrigin = "top left";
    fullEl.style.transform = "translate(0,0) scale(1,1)";
    fullEl.style.opacity = "1";
    gridEl.classList.add("is-hiding");
    if (backBtn) backBtn.hidden = IS_MOBILE;          // 모바일=테마 선택 없음
    enterHint.classList.remove("show");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => enterHint.classList.add("show"), 2200);
    start();
  }

  /* ---------- 선택 → 전체화면 확장 ---------- */
  function expand(cell) {
    const theme = cell.dataset.theme;
    lastTheme = theme;
    saveTheme(theme);                                 // 선택한 테마 유지(다음 접속에도 적용)
    const r = cell.getBoundingClientRect();
    const sr = scene.getBoundingClientRect();

    fullInst.theme = theme;
    sizeInst(fullInst, window.innerWidth, window.innerHeight);   // 항상 풀 사이즈로 렌더
    seed(fullInst);
    mode = "full";

    fullEl.hidden = false;
    fullEl.style.transformOrigin = "top left";
    fullEl.style.transition = "none";
    const sx = r.width / sr.width, sy = r.height / sr.height;
    fullEl.style.transform =
      "translate(" + (r.left - sr.left) + "px," + (r.top - sr.top) + "px) scale(" + sx + "," + sy + ")";
    fullEl.style.opacity = "1";
    // 클릭한 칸에서 전체화면으로 부드럽게 확장
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fullEl.style.transition = "transform .55s cubic-bezier(.2,.8,.2,1)";
      fullEl.style.transform = "translate(0,0) scale(1,1)";
    }));
    gridEl.classList.add("is-hiding");

    enterHint.classList.remove("show");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => enterHint.classList.add("show"), 2200);

    start();
    try { fullEl.focus({ preventScroll: true }); } catch (e) { fullEl.focus(); }
  }

  /* ---------- 전체화면 → 4분할 복귀 ---------- */
  function collapse() {
    mode = "grid";
    clearTimeout(hintTimer);
    enterHint.classList.remove("show");
    gridEl.classList.remove("is-hiding");
    fullEl.style.transition = "opacity .35s ease";
    fullEl.style.opacity = "0";
    setTimeout(() => { fullEl.hidden = true; fullEl.style.opacity = "1"; }, 360);
    ensureGrid(true);
    start();
    const c = cells.find(c => c.dataset.theme === lastTheme);
    if (c) try { c.focus({ preventScroll: true }); } catch (e) {}
  }

  /* ---------- 클릭 → 강의실 입장 (기존 씬/워프 재사용) ---------- */
  function enter() {
    if (window.App && App.Router) App.Router.go("start");
  }

  /* ---------- 이벤트 ---------- */
  cells.forEach(cell => {
    cell.addEventListener("click", () => { if (mode === "grid") expand(cell); });
  });
  // 4분할 방향키 이동 (2x2)
  gridEl.addEventListener("keydown", (e) => {
    const i = cells.indexOf(document.activeElement);
    if (i < 0) return;
    let t = -1;
    if (e.key === "ArrowRight") t = i % 2 === 0 ? i + 1 : i;
    else if (e.key === "ArrowLeft") t = i % 2 === 1 ? i - 1 : i;
    else if (e.key === "ArrowDown") t = i < 2 ? i + 2 : i;
    else if (e.key === "ArrowUp") t = i >= 2 ? i - 2 : i;
    if (t >= 0 && t < cells.length && t !== i) { e.preventDefault(); cells[t].focus(); }
  });
  // 전체화면: 아무 곳 클릭 → 입장 / Esc → 4분할
  fullEl.addEventListener("click", enter);
  fullEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enter(); }
    else if (e.key === "Escape") { e.preventDefault(); collapse(); }
  });
  backBtn.addEventListener("click", (e) => { e.stopPropagation(); collapse(); });

  /* ---------- 라우트/가시성/리사이즈 생명주기 ---------- */
  function isIntro() {
    return !window.App || !App.Router || App.Router.parse().name === "intro";
  }
  function syncRoute() {
    if (isIntro()) {
      // 인트로 진입 = 전체화면 테마부터. PC·모바일 공통으로 저장된 테마(없으면 별똥별)를 쓴다.
      // → PC에서 고른 테마가 같은 기기의 모바일 모드에도 그대로 적용된다.
      showFull(loadTheme());
    } else {
      stop();
      fullEl.hidden = true; fullEl.style.opacity = "1";
      gridEl.classList.remove("is-hiding");
      clearTimeout(hintTimer); enterHint.classList.remove("show");
    }
  }
  window.addEventListener("hashchange", syncRoute);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (isIntro()) start();
  });
  let rz = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (mode === "grid") ensureGrid(true);
      else { sizeInst(fullInst, window.innerWidth, window.innerHeight); seed(fullInst); }
    }, 150);
  });

  /* ---------- 부트 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    // 공유 링크/QR로 인트로 테마 지정 (예: ...?theme=sakura) → 저장 후 이후에도 유지.
    // 기기 간 localStorage는 공유되지 않으므로, 학생 폰의 테마는 이 파라미터로만 일괄 지정 가능.
    const um = location.search.match(/[?&]theme=([a-z]+)/i);
    if (um && INTRO_THEMES.indexOf(um[1]) >= 0) saveTheme(um[1]);
    ensureGrid(true);
    syncRoute();
  });
})();
