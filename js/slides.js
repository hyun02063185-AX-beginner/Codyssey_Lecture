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
          <img class="s-img" src="${s.src}" alt="${esc(s.title || "")}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <div class="s-img-fallback" style="display:none">이미지를 <code>assets/</code>에 넣고 경로를 지정하세요<br>(${esc(s.src || "")})</div>
          ${s.caption ? `<p class="s-img-cap">${esc(s.caption)}</p>` : ""}
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

  /* ---------- 강의 열기 ---------- */
  function openLecture(lecture, box) {
    activeLecture = lecture;
    slides = lecture.slides || [];
    current = 0;

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
    show(0);   // 완료 표시는 마지막 슬라이드까지 봐야 켜진다(show에서 처리)
  }

  /* ---------- 슬라이드 전환 ---------- */
  function show(i) {
    if (i < 0 || i >= slides.length) return;
    current = i;
    const cards = stage.querySelectorAll(".slide");
    cards.forEach((c, idx) => c.classList.toggle("is-active", idx === i));

    counter.textContent = `${i + 1} / ${slides.length}`;
    progressFill.style.width = ((i + 1) / slides.length * 100) + "%";
    dotsEl.querySelectorAll("i").forEach((d, idx) => d.classList.toggle("active", idx === i));
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === slides.length - 1;

    // 마지막 슬라이드까지 도달하면 그때 '완료'로 표시 (끝까지 들어야 점이 켜진다)
    if (activeLecture && i === slides.length - 1) Progress.mark(activeLecture.id);
  }
  const next = () => show(current + 1);
  const prev = () => show(current - 1);

  /* ---------- 네비게이션 ---------- */
  function initSlides() {
    nextBtn.addEventListener("click", next);
    prevBtn.addEventListener("click", prev);
    exitBtn.addEventListener("click", () => App.goScene("room"));

    document.addEventListener("keydown", (e) => {
      if (!document.getElementById("scene-slides").classList.contains("is-active")) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === "Escape") App.goScene("room");
      else if (e.key === "Home") show(0);
      else if (e.key === "End") show(slides.length - 1);
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
