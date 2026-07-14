/* =========================================================================
   slides.js — 인터랙티브 강의 슬라이드 엔진
   ========================================================================= */
(function () {
  "use strict";

  const stage = document.getElementById("slide-stage");
  const dotsEl = document.getElementById("slide-dots");
  const counter = document.getElementById("slide-counter");
  const nameEl = document.getElementById("slide-lecture-name");
  const progressFill = document.getElementById("slide-progress-fill");
  const prevBtn = document.getElementById("slide-prev");
  const nextBtn = document.getElementById("slide-next");
  const exitBtn = document.getElementById("slide-exit");

  let current = 0;
  let slides = [];
  let activeLecture = null;

  /* ---------- 다음 강의 찾기 (마지막 슬라이드 → 다음 강의로 이어보기) ---------- */
  function nextLecture() {
    if (!activeLecture) return null;
    const all = [];
    CURRICULUM.boxes.forEach(b => b.lectures.forEach(l => all.push(l)));
    const idx = all.findIndex(l => l.id === activeLecture.id);
    return (idx >= 0 && idx < all.length - 1) ? all[idx + 1] : null;
  }

  /* ---------- 슬라이드 HTML 렌더 ---------- */
  function renderSlide(s, lecture) {
    switch (s.type) {
      case "cover":
        return `<div class="slide">
          ${lecture ? `<span class="s-cover-wm">${String(lecture.id).padStart(2, "0")}</span>` : ""}
          <div class="s-kicker">${s.kicker || ""}</div>
          <h2 class="s-cover-title">${esc(s.title)}</h2>
          ${s.subtitle ? `<p class="s-cover-sub">${esc(s.subtitle)}</p>` : ""}
        </div>`;
      case "big":
        return `<div class="slide" style="align-items:flex-start">
          <h2 class="s-big">${esc(s.word)}</h2>
          ${s.sub ? `<p class="s-big-sub">${esc(s.sub)}</p>` : ""}
        </div>`;
      case "bullets":
        return `<div class="slide">
          <h3 class="s-title">${esc(s.title)}</h3>
          ${s.subtitle ? `<p class="s-sub">${esc(s.subtitle)}</p>` : ""}
          <ul class="s-list">${(s.items || []).map((it, i) =>
            `<li style="animation-delay:${0.15 + i * 0.13}s">${esc(it)}</li>`).join("")}</ul>
        </div>`;
      case "quote":
        return `<div class="slide">
          <p class="s-quote">${esc(s.text)}</p>
          ${s.by ? `<p class="s-quote-by">${esc(s.by)}</p>` : ""}
        </div>`;
      case "split":
        return `<div class="slide">
          <h3 class="s-title">${esc(s.title)}</h3>
          <div class="s-split">
            <div class="s-col"><h4>${esc((s.left || [])[0] || "")}</h4>
              <ul>${(s.left || []).slice(1).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
            <div class="s-col"><h4>${esc((s.right || [])[0] || "")}</h4>
              <ul>${(s.right || []).slice(1).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
          </div>
        </div>`;
      case "image":
        return `<div class="slide" style="align-items:center;text-align:center">
          ${s.title ? `<h3 class="s-title" style="margin-bottom:20px">${esc(s.title)}</h3>` : ""}
          <img class="s-img${s.diagram ? " s-img--diagram" : ""}" src="${s.src}" alt="${esc(s.title || s.caption || "")}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <div class="s-img-fallback" style="display:none">이미지를 <code>assets/</code>에 넣고 경로를 지정하세요<br>(${esc(s.src || "")})</div>
          ${s.caption ? `<p class="s-img-cap">${esc(s.caption)}</p>` : ""}
          <span class="s-img-hint">＋ 크게 · － 원래대로</span>
        </div>`;
      case "closing":
        return `<div class="slide">
          <h2 class="s-closing-title">${esc(s.title)}</h2>
          ${s.teaser ? `<div class="s-teaser">${esc(s.teaser)}</div>` : ""}
        </div>`;
      default:
        return `<div class="slide"><p class="s-cover-sub">알 수 없는 슬라이드 타입: ${esc(s.type)}</p></div>`;
    }
  }

  function esc(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- 강의 열기 (라우터가 lecture 라우트에서 호출) ---------- */
  function openLecture(lecture, box, slideIndex) {
    activeLecture = lecture;
    slides = lecture.slides || [];
    current = Math.max(0, Math.min(slideIndex || 0, slides.length - 1));

    nameEl.textContent = `${String(lecture.id).padStart(2, "0")}강 · ${lecture.title}`;
    // 강조색(--accent)은 상자 인덱스만 넘기고, 실제 색은 CSS에서 스킨 팔레트로 매핑한다
    // → 방의 상자색과 슬라이드 강조색이 스킨에 상관없이 항상 일치한다
    if (box) document.documentElement.dataset.slideBox = String(CURRICULUM.boxes.indexOf(box));

    // 렌더
    stage.innerHTML = slides.map(s => renderSlide(s, lecture)).join("");
    dotsEl.innerHTML = slides.map((_, i) =>
      `<i data-i="${i}" class="${i === 0 ? "active" : ""}"></i>`).join("");
    dotsEl.querySelectorAll("i").forEach(d =>
      d.addEventListener("click", () => show(Number(d.dataset.i))));

    App.goScene("slides");
    show(current);   // 완료 표시는 마지막 슬라이드까지 봐야 켜진다(show에서 처리)
  }

  /* ---------- 슬라이드 전환 ---------- */
  function show(i) {
    if (i < 0 || i >= slides.length) return;
    closeZoom();               // 슬라이드 바뀌면 확대 상태는 해제
    current = i;
    const cards = stage.querySelectorAll(".slide");
    cards.forEach((c, idx) => c.classList.toggle("is-active", idx === i));

    counter.textContent = `${i + 1} / ${slides.length}`;
    progressFill.style.width = ((i + 1) / slides.length * 100) + "%";
    dotsEl.querySelectorAll("i").forEach((d, idx) => d.classList.toggle("active", idx === i));
    prevBtn.disabled = i === 0;
    // 마지막 슬라이드: 다음 강의가 있으면 "다음 강의 ▶"로 이어보기, 없으면(20강) 비활성
    if (i === slides.length - 1) {
      const nl = nextLecture();
      nextBtn.disabled = !nl;
      nextBtn.textContent = nl ? "다음 강의 ▶" : "다음 ▶";
      nextBtn.classList.toggle("next-lecture", !!nl);
    } else {
      nextBtn.disabled = false;
      nextBtn.textContent = "다음 ▶";
      nextBtn.classList.remove("next-lecture");
    }

    // 마지막 슬라이드까지 도달하면 그때 '완료'로 표시 (끝까지 들어야 점이 켜진다)
    if (activeLecture && i === slides.length - 1) Progress.mark(activeLecture.id);

    // 슬라이드 위치를 URL에 반영(히스토리 미적립) → 뒤로가기 한 번이면 카드 리스트로
    if (activeLecture) App.Router.replace("lecture/" + activeLecture.id + "/" + i);
    revealChrome();   // 슬라이드 바뀔 때 네비를 잠깐 보여줬다 숨김
  }
  const next = () => {
    if (current === slides.length - 1) {          // 마지막 슬라이드 → 다음 강의로
      const nl = nextLecture();
      if (nl) App.Router.go("lecture/" + nl.id);
      return;
    }
    show(current + 1);
  };
  const prev = () => show(current - 1);

  /* ---------- 크롬(상단바·하단 네비) 자동 숨김 ----------
     전체 화면을 슬라이드에 내어주고, 상·하단 근처로 마우스가 가면(또는 슬라이드 전환 시)
     잠깐 살아났다가 사라진다. 터치 기기는 hover가 없으니 항상 표시. */
  const scene = document.getElementById("scene-slides");
  const topbar = document.querySelector(".slide-topbar");
  const nav = document.querySelector(".slide-nav");
  const coarse = window.matchMedia && window.matchMedia("(hover: none)").matches;
  let hideTimer = null;

  function setChrome(on) {
    topbar.classList.toggle("show", on);
    nav.classList.toggle("show", on);
  }
  function revealChrome() {
    if (coarse) { setChrome(true); return; }   // 터치: 항상 표시
    setChrome(true);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => setChrome(false), 2000);
  }
  function initChrome() {
    if (coarse) { setChrome(true); return; }    // 터치 기기는 상시 노출
    scene.addEventListener("mousemove", (e) => {
      const H = window.innerHeight;
      const nearEdge = e.clientY < H * 0.16 || e.clientY > H * 0.84;
      if (nearEdge) {
        setChrome(true);
        clearTimeout(hideTimer);
      } else {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setChrome(false), 1400);
      }
    });
    // 크롬 위에 커서가 있으면 유지
    [topbar, nav].forEach(el => {
      el.addEventListener("mouseenter", () => { setChrome(true); clearTimeout(hideTimer); });
      el.addEventListener("mouseleave", () => { clearTimeout(hideTimer); hideTimer = setTimeout(() => setChrome(false), 1200); });
    });
  }

  /* ---------- 이미지 전체화면 확대 ('+' 크게 · '-' 원래대로) ---------- */
  const imgZoom = document.createElement("div");
  imgZoom.className = "img-zoom";
  imgZoom.innerHTML = `<img alt=""><span class="img-zoom__hint">－ 또는 Esc 로 닫기</span>`;
  document.body.appendChild(imgZoom);
  imgZoom.addEventListener("click", closeZoom);
  let zoomOpen = false;

  function currentImg() {
    const s = stage.querySelector(".slide.is-active");
    const img = s && s.querySelector("img.s-img");
    return (img && getComputedStyle(img).display !== "none") ? img : null;
  }
  function openZoom() {
    const img = currentImg();
    if (!img) return;                       // 이미지 슬라이드가 아니면 무시
    imgZoom.querySelector("img").src = img.currentSrc || img.src;
    imgZoom.classList.add("show");
    zoomOpen = true;
  }
  function closeZoom() {
    imgZoom.classList.remove("show");
    zoomOpen = false;
  }

  /* ---------- 네비게이션 ---------- */
  function initSlides() {
    initChrome();
    nextBtn.addEventListener("click", next);
    prevBtn.addEventListener("click", prev);
    exitBtn.addEventListener("click", () => App.Router.back());

    document.addEventListener("keydown", (e) => {
      if (!scene.classList.contains("is-active")) return;
      // 이미지 확대 토글 ('+'는 Shift+= 또는 숫자패드 +, '='도 허용 / 브라우저 줌(Ctrl/⌘)은 건드리지 않음)
      if ((e.key === "+" || e.key === "=") && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openZoom(); return; }
      if ((e.key === "-" || e.key === "_") && !e.ctrlKey && !e.metaKey) { e.preventDefault(); closeZoom(); return; }
      if (zoomOpen) {                       // 확대 중엔 Esc로만 닫고, 방향키 등은 무시(확대가 남지 않게)
        if (e.key === "Escape") { e.preventDefault(); closeZoom(); }
        return;
      }
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === "Escape") App.Router.back();
      else if (e.key === "Home") show(0);
      else if (e.key === "End") show(slides.length - 1);
    });

    // 이미지 클릭 → '+'와 동일하게 전체화면 확대
    stage.addEventListener("click", (e) => {
      const img = e.target.closest && e.target.closest("img.s-img");
      if (img && getComputedStyle(img).display !== "none") openZoom();
    });

    // 스와이프(모바일)
    let sx = 0;
    stage.addEventListener("touchstart", e => sx = e.touches[0].clientX, { passive: true });
    stage.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    }, { passive: true });
  }

  window.openLecture = openLecture;
  window.initSlides = initSlides;
})();
