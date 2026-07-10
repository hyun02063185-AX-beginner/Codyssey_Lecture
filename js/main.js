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
    current: "sayu",
    load() {
      let s = null;
      try { s = localStorage.getItem(SKIN_KEY); } catch (e) { /* localStorage 불가 */ }
      this.set(SKINS.includes(s) ? s : "sayu", false);   // 저장값 없으면 기본 사유의 방
    },
    set(name, persist) {
      if (!SKINS.includes(name)) name = "sayu";
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
    intro: document.getElementById("scene-intro"),
    start: document.getElementById("scene-start"),
    room: document.getElementById("scene-room"),
    slides: document.getElementById("scene-slides")
  };
  function goScene(name) {
    Object.values(scenes).forEach(s => s.classList.remove("is-active"));
    if (scenes[name]) scenes[name].classList.add("is-active");
  }

  /* ---------- 강의 찾기 (id → {lecture, box, boxIndex}) ---------- */
  function findLecture(id) {
    for (let bi = 0; bi < CURRICULUM.boxes.length; bi++) {
      const box = CURRICULUM.boxes[bi];
      const lec = box.lectures.find(l => l.id === id);
      if (lec) return { lecture: lec, box, boxIndex: bi };
    }
    return null;
  }

  /* ---------- 배경 모드 헬퍼 ----------
     인트로는 전용 캔버스(intro.js)가 4테마를 그리므로, 공용 배경 캔버스는 비운다("blank"). */
  function bgIntro() { if (window.__bgSetSkin) window.__bgSetSkin("blank"); }
  function bgSkin()  { if (window.__bgSetSkin) window.__bgSetSkin(Skin.current); }

  /* ---------- 상자 등장(첫 진입만 스태거, 재방문은 즉시) ---------- */
  let boxesShown = false;
  function showBoxes() {
    const boxesEl = document.getElementById("boxes");
    if (!boxesEl) return;
    if (!boxesShown && window.revealBoxes) { window.revealBoxes(); boxesShown = true; }
    else { [...boxesEl.children].forEach(el => el.classList.add("reveal")); }
  }

  /* ---------- 해시 라우터 ----------
     주소를 나눠 브라우저 뒤로가기가 씬 단위로 동작하게 한다.
     #/(빈값)=인트로 · #/start=입장 · #/room=상자 · #/box/{i}=카드 · #/lecture/{id}[/{slide}]=슬라이드 */
  const Router = {
    parse() {
      const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
      if (!parts.length) return { name: "intro" };
      switch (parts[0]) {
        case "start":   return { name: "start" };
        case "room":    return { name: "room" };
        case "box":     return { name: "box", box: Number(parts[1]) || 0 };
        case "lecture": return { name: "lecture", id: Number(parts[1]),
                                 slide: parts[2] != null ? Number(parts[2]) : 0 };
        default:        return { name: "intro" };
      }
    },
    go(path)      { location.hash = "#/" + path; },            // 히스토리 적립(push)
    replace(path) { history.replaceState(null, "", "#/" + path); }, // 미적립(슬라이드 내부 이동용)
    back()        { history.back(); },
    handle() {
      const r = Router.parse();
      document.documentElement.dataset.route = r.name;                  // CSS 배경 전환용(인트로=밤하늘)
      if (r.name !== "box") window.closeFanDOM && window.closeFanDOM();  // 상자 라우트 외에는 부채꼴 닫기
      switch (r.name) {
        case "intro":
          bgIntro(); goScene("intro"); break;
        case "start":
          bgSkin(); goScene("start"); break;
        case "room":
          bgSkin(); goScene("room"); showBoxes(); break;
        case "box":
          bgSkin(); goScene("room"); showBoxes(); window.dealFan && window.dealFan(r.box); break;
        case "lecture": {
          const f = findLecture(r.id);
          if (!f) { Router.go("room"); return; }
          bgSkin(); goScene("slides");
          window.openLecture && window.openLecture(f.lecture, f.box, r.slide || 0);
          break;
        }
      }
    }
  };

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
    Progress, Skin, goScene, updateHUD, TOTAL, Router, findLecture,
    accent: "#22d3ee"
  };
  window.Progress = Progress;

  /* ---------- 인트로 상호작용은 intro.js(4테마 화면보호기)가 담당 ---------- */

  /* ---------- 입장 버튼 → 워프 → 방(라우터 push) ---------- */
  function initStart() {
    const btn = document.getElementById("enter-btn");
    const warp = document.getElementById("warp");
    btn.addEventListener("click", () => {
      const k = fxScale();          // sayu면 워프/전환도 2배 느리게
      warp.classList.remove("go");
      void warp.offsetWidth;        // reflow로 애니메이션 리셋
      warp.classList.add("go");
      btn.disabled = true;
      setTimeout(() => Router.go("room"), 820 * k);   // 원이 화면을 가득 덮은 뒤 방으로
      setTimeout(() => { btn.disabled = false; }, 1800 * k);
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

  /* ---------- 방 → 입장 화면 링크 ---------- */
  function initRoomNav() {
    const btn = document.getElementById("to-start");
    if (btn) btn.addEventListener("click", () => Router.go("start"));
  }

  /* ---------- 배경: 별 + 흐르는 성운 ---------- */
  function initBackground() {
    const canvas = document.getElementById("bg-canvas");
    const ctx = canvas.getContext("2d");
    const DPR = window.devicePixelRatio || 1;
    let w, h, stars = [], dust = [], shooters = [];
    let bgSkin = "paper";
    /* 별똥별(인트로 전용) */
    function spawnShooter() {
      const speed = (Math.random() * 4 + 6) * DPR;
      const ang = Math.PI * (0.16 + Math.random() * 0.14);   // 우하향 대각선
      shooters.push({
        x: Math.random() * w * 0.85, y: Math.random() * h * 0.35,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        len: 9 + Math.random() * 9, life: 60, maxLife: 60
      });
    }
    function drawShooters() {
      if (shooters.length < 3 && Math.random() < 0.02) spawnShooter();
      shooters.forEach(sh => {
        sh.x += sh.vx; sh.y += sh.vy; sh.life--;
        const tx = sh.x - sh.vx * sh.len, ty = sh.y - sh.vy * sh.len;
        const a = Math.max(0, Math.min(1, sh.life / sh.maxLife * 1.4));
        const g = ctx.createLinearGradient(sh.x, sh.y, tx, ty);
        g.addColorStop(0, `rgba(255,240,210,${0.9 * a})`);
        g.addColorStop(1, "rgba(255,240,210,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 2 * DPR; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.beginPath(); ctx.fillStyle = `rgba(255,250,232,${a})`;
        ctx.arc(sh.x, sh.y, 1.7 * DPR, 0, Math.PI * 2); ctx.fill();
      });
      shooters = shooters.filter(s => s.life > 0 && s.x < w + 60 && s.y < h + 60);
    }
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
        // 포근한 파스텔 픽셀이 성기게·느리게 떠다닌다 (밝은 크림 배경에 은은히)
        const cols = ["206,109,124", "122,107,176", "62,142,142", "121,153,106"]; // 로즈·라벤더·틸·세이지
        stars.forEach((s, i) => {
          if (i % 2 !== 0) return;                              // 성기게
          s.a += s.tw * 0.5;
          const alpha = 0.05 + Math.abs(Math.sin(s.a)) * 0.10;  // 아주 옅게
          s.y += s.dy * 0.4;                                    // 느리게
          if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
          ctx.fillStyle = `rgba(${cols[i % cols.length]},${alpha})`;
          const px = 3 * DPR;
          ctx.fillRect(Math.round(s.x / px) * px, Math.round(s.y / px) * px, px, px);
        });
      } else if (bgSkin === "sayu" || bgSkin === "intro") {
        // 사유의 방 / 인트로 — 차가운 성운은 끄되, 별빛은 네온만큼 밝게:
        // 밝기·밀도·반짝임은 네온과 동일, 색만 따뜻한 골드 / 낙하만 차분하게
        stars.forEach(s => {
          s.a += s.tw; const alpha = 0.35 + Math.abs(Math.sin(s.a)) * 0.65;
          s.y += s.dy * 0.6; if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
          ctx.beginPath();
          ctx.fillStyle = `rgba(224,197,138,${alpha})`;         // #E0C58A 별빛 골드
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        });
        if (bgSkin === "intro") drawShooters();   // 인트로에서만 별똥별
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
    Skin.load();                    // 저장된 스킨 반영(없으면 sayu) + 배경 통지
    initStart();
    initReset();
    initRoomNav();
    App.updateHUD = updateHUD;      // room.js가 참조하도록 확정
    window.buildRoom && window.buildRoom();   // 상자 생성
    window.initSlides && window.initSlides(); // 슬라이드 엔진 초기화
    updateHUD();
    // 라우터 기동: 현재 해시에 맞는 씬 렌더 + 뒤로/앞으로 대응
    window.addEventListener("hashchange", Router.handle);
    Router.handle();
  });
})();
