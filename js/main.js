/* =========================================================================
   main.js — 씬 매니저 · 배경 캔버스 · 진행도(게이미피케이션) 상태
   ========================================================================= */
(function () {
  "use strict";

  // ★[테스트/시연] true면 "마지막 강(20강)"을 끝까지 봤을 때 전체 완주로 처리.
  //   → 20강만 반복해 들으면 완주→업그레이드(Lv1→Lv2→…)를 빠르게 테스트할 수 있다.
  //   다른 강의는 평소처럼 한 강씩만 발견된다. 실제 배포 전에는 false 로 되돌릴 것.
  const TEST_FILL_ALL = false;   // ★배포용: 20강 전부 봐야 완주

  /* ---------- 기기 모드: 모바일(수강자) vs PC(시연) ----------
     ?view=mobile / ?view=pc 로 강제 지정 가능(한 기기에서 두 모드 확인용). */
  const IS_MOBILE = (function () {
    const m = location.search.match(/[?&]view=(mobile|pc)/);
    if (m) return m[1] === "mobile";
    return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  })();
  window.__isMobile = IS_MOBILE;   // intro.js 등에서 공유

  /* ---------- 콘텐츠 variant — 경험판 스위치 ----------
     ?variant=personal → 7·8강처럼 slidesPersonal이 있는 강의는 경험판으로 렌더(slides.js가 분기).
     해시 라우팅은 search를 건드리지 않으므로 세션 동안 자연 유지.
     localStorage에 저장하지 않는다 — 링크로만 제어(평소 배포 링크는 항상 범용판). */
  const VARIANT_PERSONAL = /[?&]variant=personal(?:&|$)/.test(location.search);
  window.__variantPersonal = VARIANT_PERSONAL;   // slides.js 로드 분기에서 참조

  /* ---------- 스킨 해금 순서 (Lv 포상) ----------
     모바일: 5종 전부 · PC: Lv1 사유의 방 → Lv2 +페이퍼 → Lv3 +네온 → Lv4 +픽셀 → Lv5 +블루프린트 */
  const SKIN_ORDER = ["sayu", "paper", "neon", "pixel", "blueprint"];
  function skinUnlockCount() {
    if (IS_MOBILE) return SKIN_ORDER.length;                       // 모바일=전부
    return Math.max(1, Math.min(SKIN_ORDER.length, Level.n));      // PC=Lv별(Lv0→1)
  }
  function isSkinUnlocked(name) {
    return SKIN_ORDER.slice(0, skinUnlockCount()).indexOf(name) >= 0;
  }

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
    mark(id) {
      const was = this.seen.size;
      this.seen.add(id);
      // 테스트 모드: 마지막 강(20강)을 끝까지 보면 전체 완주 처리
      if (TEST_FILL_ALL && id === LAST_LECTURE_ID) {
        CURRICULUM.boxes.forEach(b => b.lectures.forEach(l => this.seen.add(l.id)));
      }
      this.save(); App.updateHUD();
      window.Telemetry && Telemetry.lectureComplete(id);   // 수집 훅(코드 입력자만 전송)
      if (was < TOTAL && this.seen.size === TOTAL) celebrateCompletion();  // 완주 순간
    },
    has(id) { return this.seen.has(id); },
    count() { return this.seen.size; },
    reset() { this.seen.clear(); this.save(); Resume.reset(); App.updateHUD(); }
  };

  /* ---------- 이어보기 — 강의별 마지막 슬라이드 위치 (localStorage) ----------
     저장: 슬라이드 이동마다 · 복원: 슬라이드 번호 없이 강의 진입 시
     해제: 그 강을 끝까지 보면(완료) 다음번엔 처음부터 · 진행도 초기화 시 전체 삭제 */
  const RESUME_KEY = "ax_room_resume_v1";
  const Resume = {
    map: {},
    load() { try { this.map = JSON.parse(localStorage.getItem(RESUME_KEY)) || {}; } catch (e) { this.map = {}; } },
    save() { try { localStorage.setItem(RESUME_KEY, JSON.stringify(this.map)); } catch (e) {} },
    get(id) { const v = this.map[id]; return Number.isInteger(v) && v > 0 ? v : 0; },
    set(id, i) { if (this.map[id] !== i) { this.map[id] = i; this.save(); } },
    clear(id) { if (id in this.map) { delete this.map[id]; this.save(); } },
    reset() { this.map = {}; try { localStorage.removeItem(RESUME_KEY); } catch (e) {} }
  };

  /* ---------- 회독 레벨(게이미피케이션) — 완주할수록 사유가 깊어진다 ---------- */
  const LEVEL_KEY = "ax_room_level_v1";
  const MAX_LEVEL = 5;
  // Lv1~5 칭호 (수정 쉬움): 훑기 → 파기 → 곱씹기 → 실천 → 통찰
  const RANKS = ["", "Wanderer", "Explorer", "Thinker", "Practitioner", "Visionary"];
  const Level = {
    n: 1,                                        // Lv1부터 시작(뱃지 처음부터 표시)
    load() { try { const v = parseInt(localStorage.getItem(LEVEL_KEY), 10); if (!isNaN(v)) this.n = Math.min(MAX_LEVEL, Math.max(1, v)); } catch (e) {} },
    save() { try { localStorage.setItem(LEVEL_KEY, String(this.n)); } catch (e) {} },
    up() { if (this.n < MAX_LEVEL) { this.n++; this.save(); return true; } return false; },
    label() { return this.n >= 1 ? "Lv" + this.n + " · " + RANKS[this.n] : ""; }
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
      if (!isSkinUnlocked(name)) name = "sayu";   // 아직 해금 안 된 스킨이면 사유의 방으로
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
  // 스킨 잠금 상태 갱신(해금=선택 가능 / 미해금=🔒 회색·비활성). Lv 오르면 다시 호출.
  function refreshSkinLocks() {
    document.querySelectorAll(".skin-opt").forEach(btn => {
      const locked = !isSkinUnlocked(btn.dataset.skin);
      btn.classList.toggle("locked", locked);
      btn.setAttribute("aria-disabled", locked ? "true" : "false");
      // 해금 조건을 hover 없이도 보이게 — 잠긴 스킨엔 "LvN" 뱃지 상시 표시(CSS ::after)
      const lv = "Lv" + (SKIN_ORDER.indexOf(btn.dataset.skin) + 1);
      if (locked) btn.dataset.unlock = lv; else delete btn.dataset.unlock;
      if (!IS_MOBILE) btn.title = locked ? lv + " 달성 시 해금" : "";
    });
  }
  function initSkinPicker() {
    document.querySelectorAll(".skin-opt").forEach(btn =>
      btn.addEventListener("click", () => {
        if (!isSkinUnlocked(btn.dataset.skin)) return;   // 잠긴 스킨은 무시(포상 전)
        Skin.set(btn.dataset.skin, true);
      }));
    refreshSkinLocks();
    syncPicker();
  }

  /* ---------- 씬 전환 ---------- */
  const scenes = {
    intro: document.getElementById("scene-intro"),
    start: document.getElementById("scene-start"),
    room: document.getElementById("scene-room"),
    slides: document.getElementById("scene-slides"),
    practice: document.getElementById("scene-practice")
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
        case "start":    return { name: "start" };
        case "reset":    return { name: "reset" };
        case "practice": return { name: "practice" };
        case "room":    return { name: "room" };
        case "box":     return { name: "box", box: Number(parts[1]) || 0 };
        case "lecture": return { name: "lecture", id: Number(parts[1]),
                                 slide: parts[2] != null ? Number(parts[2]) : null };  // null=명시 없음(이어보기 대상)
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
        case "reset": {                       // #/reset → Lv·진행도 초기화 후 인트로로
          try { localStorage.removeItem(LEVEL_KEY); localStorage.removeItem(STORE_KEY); localStorage.removeItem(RESUME_KEY); localStorage.removeItem("ax_server_session"); } catch (e) {}
          if (window.Telemetry) Telemetry.clearCode();   // 수강 코드도 함께 초기화
          Level.n = 1; Level.save();          // Lv1부터 다시 시작
          Progress.seen.clear(); Progress.save();
          refreshSkinLocks(); Skin.set("sayu", true); updateHUD();
          if (window.refreshCardsSeen) window.refreshCardsSeen();
          Router.replace("");                 // 해시를 인트로로(히스토리 미적립)
          Router.handle();                    // 인트로 렌더
          return;
        }
        case "intro":
          bgIntro(); goScene("intro"); break;
        case "start":
          bgSkin(); goScene("start"); if (window.refreshPracticeDoor) window.refreshPracticeDoor(); break;
        case "practice":
          bgSkin(); goScene("practice"); if (window.openPractice) window.openPractice(); break;
        case "room":
          bgSkin(); goScene("room"); showBoxes(); break;
        case "box":
          bgSkin(); goScene("room"); showBoxes(); window.dealFan && window.dealFan(r.box); break;
        case "lecture": {
          const f = findLecture(r.id);
          if (!f) { Router.go("room"); return; }
          bgSkin(); goScene("slides");
          // 슬라이드 번호가 URL에 없으면 이어보기 위치에서, 있으면 그 위치에서
          window.openLecture && window.openLecture(f.lecture, f.box,
            r.slide != null ? r.slide : Resume.get(r.id));
          break;
        }
      }
    }
  };

  /* ---------- HUD 갱신 ---------- */
  const TOTAL = CURRICULUM.boxes.reduce((n, b) => n + b.lectures.length, 0);
  const LAST_LECTURE_ID = (() => {                 // 마지막 강의 id (= 20강)
    const b = CURRICULUM.boxes[CURRICULUM.boxes.length - 1];
    return b.lectures[b.lectures.length - 1].id;
  })();
  function updateHUD() {
    const c = Progress.count();
    const pct = Math.round((c / TOTAL) * 100);
    const found = document.getElementById("found-count");
    const fill = document.getElementById("xp-fill");
    const pctEl = document.getElementById("xp-pct");
    if (found) found.textContent = c;
    if (fill) fill.style.width = pct + "%";
    if (pctEl) pctEl.textContent = pct;
    // 랭크 뱃지 (Lv2 · 탐험가) — 1회 이상 완주해야 표시
    const rank = document.getElementById("hud-rank");
    if (rank) { const l = Level.label(); rank.textContent = l; rank.hidden = !l; }
    // 상태 버튼: 초기화(↺) ↔ 업그레이드 ↔ 통달
    updateStateButton(c);
    // 상자 내 완료 점 갱신
    if (window.refreshBoxDots) window.refreshBoxDots();
  }
  function updateStateButton(c) {
    const btn = document.getElementById("reset-progress");
    if (!btn) return;
    btn.classList.remove("is-upgrade", "is-mastered");
    if (Level.n >= MAX_LEVEL) {                          // Lv5 통달 — 완주 여부와 무관하게 표시
      btn.textContent = "✦ 통달"; btn.title = "통달 — 최고 경지";
      btn.classList.add("is-mastered");
    } else if (c >= TOTAL) {                             // 20/20 · Lv<5 → 업그레이드
      btn.textContent = "⬆ 업그레이드"; btn.title = "다음 단계로 (진행도 초기화)";
      btn.classList.add("is-upgrade");
    } else {
      btn.textContent = "↺"; btn.title = "진행도 초기화";
    }
  }

  /* ---------- 완주 축하 연출 + 업그레이드 ---------- */
  let burstRaf = null;
  // 현재 레벨에 맞춰 오버레이 내용을 채운다(통달=Lv5 도달 시 업그레이드 버튼 숨김)
  function renderCelebrate() {
    const mastered = Level.n >= MAX_LEVEL;          // Lv5 = 통달(최고 경지)
    const titleEl = document.getElementById("celebrate-title");
    const subEl = document.getElementById("celebrate-sub");
    const upBtn = document.getElementById("celebrate-up");
    if (mastered) {
      titleEl.textContent = "깊은 깨달음에 도달하셨습니다.";
      subEl.textContent = "Lv" + MAX_LEVEL + " · " + RANKS[MAX_LEVEL] + " · 통달 — 최고 경지에 이르렀습니다";
      if (upBtn) upBtn.hidden = true;
    } else {
      const next = Level.n + 1;
      titleEl.textContent = "훌륭히 완주하셨습니다.";
      subEl.textContent = "20강 완주 · 업그레이드하면 Lv" + next + " · " + RANKS[next] + (next >= MAX_LEVEL ? " (통달)" : "");
      if (upBtn) upBtn.hidden = false;
    }
  }
  function celebrateCompletion() {
    const el = document.getElementById("celebrate");
    if (!el) return;
    renderCelebrate();
    el.hidden = false;
    void el.offsetWidth;                 // reflow로 트랜지션 확실히 발동(백그라운드 탭 rAF 스로틀 무관)
    el.classList.add("show");
    runBurst();
  }
  function closeCelebrate() {
    const el = document.getElementById("celebrate");
    if (!el) return;
    el.classList.remove("show");
    setTimeout(() => { el.hidden = true; }, 400);
    if (burstRaf) { cancelAnimationFrame(burstRaf); burstRaf = null; }
    const cv = document.getElementById("celebrate-cv");
    if (cv) { const c = cv.getContext("2d"); if (c) c.clearRect(0, 0, cv.width, cv.height); }
  }
  function doUpgrade() {
    if (!Level.up()) return;
    window.Telemetry && Telemetry.runComplete(Level.n);  // 수집 훅: 20강 완주(업그레이드)
    Progress.reset();                                   // 새 회독 시작(발견도 0) + updateHUD
    if (window.refreshCardsSeen) window.refreshCardsSeen();
    refreshSkinLocks();                                 // PC: 새 Lv에서 스킨 해금 반영
    const rank = document.getElementById("hud-rank");   // 뱃지 등장 강조
    if (rank) { rank.classList.remove("pop"); void rank.offsetWidth; rank.classList.add("pop"); }
    if (Level.n >= MAX_LEVEL) {
      renderCelebrate();   // Lv5(통달) 도달 → 오버레이를 통달 메시지로 전환(닫지 않고 유지)
      runBurst();
    } else {
      closeCelebrate();
    }
  }
  function runBurst() {
    const cv = document.getElementById("celebrate-cv");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.width = window.innerWidth * DPR, H = cv.height = window.innerHeight * DPR;
    cv.style.width = window.innerWidth + "px"; cv.style.height = window.innerHeight + "px";
    const cx = W / 2, cy = H * 0.4;
    const cols = ["#E0C58A", "#F2C15E", "#FFE9B0", "#D98E6B"];
    let ps = [], frames = 0, launches = 0;
    function launch() {
      const bx = cx + (Math.random() - 0.5) * W * 0.55, by = cy + (Math.random() - 0.5) * H * 0.28;
      const col = cols[(Math.random() * cols.length) | 0], n = 42;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283, sp = (Math.random() * 3 + 1.6) * DPR;
        ps.push({ x: bx, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 60 + Math.random() * 45, max: 105, r: (Math.random() * 2 + 1.5) * DPR, col });
      }
    }
    launch();
    function frame() {
      ctx.clearRect(0, 0, W, H); frames++;
      if (frames % 20 === 0 && launches < 5) { launch(); launches++; }
      for (const p of ps) {
        p.vy += 0.045 * DPR; p.vx *= 0.99; p.vy *= 0.99; p.x += p.vx; p.y += p.vy; p.life--;
        const al = Math.max(0, p.life / p.max);
        ctx.globalAlpha = al; ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ps = ps.filter(p => p.life > 0);
      if (frames < 220 || ps.length) burstRaf = requestAnimationFrame(frame);
      else { burstRaf = null; ctx.clearRect(0, 0, W, H); }
    }
    if (burstRaf) cancelAnimationFrame(burstRaf);
    burstRaf = requestAnimationFrame(frame);
  }

  /* ---------- 전역 네임스페이스 ---------- */
  const App = window.App = {
    Progress, Skin, goScene, updateHUD, TOTAL, Router, findLecture,
    Level,                       // 실습실(practice.js)이 Lv를 읽기만 (수정 안 함)
    Resume,                      // 이어보기 — slides.js가 저장, room.js가 카드 표시
    accent: "#22d3ee"
  };
  window.Progress = Progress;

  /* ---------- 인트로 상호작용은 intro.js(4테마 화면보호기)가 담당 ---------- */

  /* ---------- 입장 버튼 → 워프 → 방(라우터 push) ---------- */
  function initStart() {
    const btn = document.getElementById("enter-btn");
    const warp = document.getElementById("warp");
    btn.addEventListener("click", () => {
      window.Immersive && window.Immersive.request();   // 워프 시작 = 몰입 구간(방·상자·슬라이드) 진입점
      const k = fxScale();          // sayu면 워프/전환도 2배 느리게
      warp.classList.remove("go");
      void warp.offsetWidth;        // reflow로 애니메이션 리셋
      warp.classList.add("go");
      btn.disabled = true;
      setTimeout(() => Router.go("room"), 820 * k);   // 원이 화면을 가득 덮은 뒤 방으로
      setTimeout(() => { btn.disabled = false; }, 1800 * k);
    });
  }

  /* ---------- 상태 버튼(초기화 ↔ 업그레이드) + 완주 오버레이 ---------- */
  function initStateButton() {
    const btn = document.getElementById("reset-progress");
    if (btn) btn.addEventListener("click", () => {
      const c = Progress.count();
      if (Level.n >= MAX_LEVEL) celebrateCompletion();            // 통달 → 축하 재생
      else if (c >= TOTAL) doUpgrade();                           // 완주 → 승급
      else { Progress.reset(); if (window.refreshCardsSeen) window.refreshCardsSeen(); }
    });
    const up = document.getElementById("celebrate-up");
    if (up) up.addEventListener("click", doUpgrade);
    const close = document.getElementById("celebrate-close");
    if (close) close.addEventListener("click", closeCelebrate);
    const cel = document.getElementById("celebrate");
    if (cel) cel.addEventListener("click", (e) => { if (e.target === cel) closeCelebrate(); });
  }

  /* ---------- 방 → 입장 화면 링크 ---------- */
  function initRoomNav() {
    const btn = document.getElementById("to-start");
    if (btn) btn.addEventListener("click", () => {
      window.Immersive && window.Immersive.exit();   // 몰입 구간을 벗어남 → 즉시 해제
      Router.go("start");
    });
  }

  /* ---------- 전체 목차 · 핵심 훑기 ----------
     HUD ☰ → 20강 한 화면(완료✓·이어보기▶·DEMO), 강의 클릭 = 바로 이동(이어보기 반영).
     ⚡핵심 훑기 = 각 강의 big·quote·closing 문장만 펼침, 문장 클릭 = 그 슬라이드로 점프. */
  let tocCore = false;
  const tocEsc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function tocKeyLines(lec) {
    const out = [];
    (lec.slides || []).forEach((s, i) => {
      if (s.type === "big" && s.word) out.push({ i, t: s.word });
      else if (s.type === "quote" && s.text) out.push({ i, t: s.text });
      else if (s.type === "closing" && s.title) out.push({ i, t: s.title });
    });
    return out;
  }
  function renderToc() {
    const list = document.getElementById("toc-list");
    if (!list) return;
    list.innerHTML = CURRICULUM.boxes.map((box, bi) => `
      <section class="toc__sec" style="--toc-accent:${box.accent}">
        <h3 class="toc__sec-t">상자 ${bi + 1} · ${tocEsc(box.name)} <span>${tocEsc(box.theme)}</span></h3>
        ${box.lectures.map(lec => {
          const resume = Resume.get(lec.id);
          return `<div class="toc__lec">
            <button class="toc__lec-btn" data-lec="${lec.id}">
              <span class="toc__no">${String(lec.id).padStart(2, "0")}</span>
              <span class="toc__t">${tocEsc(lec.title)}</span>
              ${lec.demo ? '<span class="toc__demo">DEMO</span>' : ""}
              ${resume > 0 ? `<span class="toc__resume">▶ ${resume + 1}/${(lec.slides || []).length}</span>` : ""}
              ${Progress.has(lec.id) ? '<span class="toc__done">✓</span>' : ""}
            </button>
            ${tocCore ? `<ul class="toc__lines">${tocKeyLines(lec).map(k =>
              `<li><button data-lec="${lec.id}" data-slide="${k.i}">${tocEsc(k.t).replace(/\n/g, " ")}</button></li>`).join("")}</ul>` : ""}
          </div>`;
        }).join("")}
      </section>`).join("");
    list.querySelectorAll("button[data-lec]").forEach(b => b.addEventListener("click", () => {
      closeToc();
      const s = b.dataset.slide;
      Router.go("lecture/" + b.dataset.lec + (s != null && s !== "" ? "/" + s : ""));
    }));
  }
  function openToc()  { const el = document.getElementById("toc"); if (!el) return; renderToc(); el.hidden = false; }
  function closeToc() { const el = document.getElementById("toc"); if (el) el.hidden = true; }
  function initToc() {
    const el = document.getElementById("toc");
    if (!el) return;
    const btn = document.getElementById("toc-btn");
    if (btn) btn.addEventListener("click", openToc);
    document.getElementById("toc-close").addEventListener("click", closeToc);
    const core = document.getElementById("toc-core");
    core.addEventListener("click", () => {
      tocCore = !tocCore;
      core.setAttribute("aria-pressed", String(tocCore));
      core.classList.toggle("on", tocCore);
      renderToc();
    });
    el.addEventListener("click", (e) => { if (e.target === el) closeToc(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.hidden) closeToc(); });
  }

  /* ---------- 배경: 별 + 흐르는 성운 ---------- */
  function initBackground() {
    const canvas = document.getElementById("bg-canvas");
    const ctx = canvas.getContext("2d");
    const DPR = window.devicePixelRatio || 1;
    // 모바일(터치)에서는 배경을 애니메이션하지 않고 별밭을 한 번만 그린다(정적).
    // → 확대 오버레이와 겹칠 때의 렌더 아티팩트 방지 + 배터리·성능 개선.
    const STATIC_BG = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
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
    window.__bgSetSkin = function (s) { bgSkin = s; if (STATIC_BG) draw(); };  // 모바일: 스킨 바뀌면 정적 프레임 1회 다시 그림
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
      if (STATIC_BG) draw();                 // 모바일: 리사이즈/회전 후 정적 프레임 1회
    }
    function draw() {
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
    }
    function loop() { draw(); requestAnimationFrame(loop); }
    window.addEventListener("resize", resize);
    resize();
    if (STATIC_BG) draw(); else loop();      // 모바일=정적 1프레임 · 데스크톱=애니메이션 루프
  }

  /* ---------- 부트 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    Progress.load();
    Level.load();                   // 회독 레벨 복원 (스킨 해금이 Lv에 의존 → 먼저)
    Resume.load();                  // 이어보기 위치 복원
    initBackground();               // __bgSetSkin 준비 후
    initSkinPicker();               // 선택기 버튼 이벤트 + 잠금 표시
    Skin.load();                    // 저장된 스킨 반영(잠겼으면 사유의 방으로) + 배경 통지
    // ★[테스트] 서버 재시작(세션 토큰 변경) 시 완주/레벨 초기화 → 서버 띄울 때마다 완주 기능 테스트.
    //   단순 새로고침은 토큰이 그대로라 유지. (server_session.txt 는 serve.py 가 재시작마다 갱신)
    if (TEST_FILL_ALL) {
      fetch("server_session.txt", { cache: "no-store" })
        .then(r => (r.ok ? r.text() : null))
        .then(id => {
          if (!id) return;
          id = id.trim();
          if (localStorage.getItem("ax_server_session") !== id) {
            Progress.seen.clear(); Progress.save();
            Level.n = 0; Level.save();
            try { localStorage.setItem("ax_server_session", id); } catch (e) {}
            updateHUD();
          }
        }).catch(() => {});
    }
    initStart();
    initStateButton();
    initRoomNav();
    initToc();
    // 경험판(personal) 모드 표시 — HUD 좌측에 아주 작은 "P" 뱃지 (강사 확인용, 기본 모드엔 없음)
    if (VARIANT_PERSONAL) {
      const hudLeft = document.querySelector(".hud__left");
      if (hudLeft) {
        const b = document.createElement("span");
        b.className = "hud__vp"; b.textContent = "P"; b.title = "경험판(personal) 모드";
        hudLeft.appendChild(b);
      }
    }
    App.updateHUD = updateHUD;      // room.js가 참조하도록 확정
    window.buildRoom && window.buildRoom();   // 상자 생성
    window.initSlides && window.initSlides(); // 슬라이드 엔진 초기화
    updateHUD();
    // 라우터 기동: 현재 해시에 맞는 씬 렌더 + 뒤로/앞으로 대응
    window.addEventListener("hashchange", Router.handle);
    Router.handle();
  });
})();
