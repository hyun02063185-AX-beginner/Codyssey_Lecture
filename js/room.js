/* =========================================================================
   room.js — 사유의 방: 상자 4개 · 카드 부채꼴 전개
   ========================================================================= */
(function () {
  "use strict";

  const boxesEl = document.getElementById("boxes");
  const fanOverlay = document.getElementById("fan-overlay");
  const fanCardsEl = document.getElementById("fan-cards");
  const fanTitle = document.getElementById("fan-title");
  const fanClose = document.getElementById("fan-close");
  const roomGuide = document.getElementById("room-guide");

  let currentBox = null;

  // sayu(사유의 방)는 명상적으로 모든 타이밍 2배 (main.js와 공유)
  const fxScale = () => (window.__fxScale ? window.__fxScale() : 1);

  /* ---------- 상자 생성 ---------- */
  function buildRoom() {
    boxesEl.innerHTML = "";
    CURRICULUM.boxes.forEach((box, i) => {
      const el = document.createElement("div");
      el.className = "box";
      el.style.setProperty("--box-accent", box.accent);
      el.dataset.boxIndex = i;
      el.innerHTML = `
        <div>
          <div class="box__num">상자 ${String(i + 1).padStart(2, "0")} · ${box.name}</div>
          <div class="box__name">${box.name}</div>
          <div class="box__theme">${box.theme}</div>
          <div class="box__dots">${box.lectures.map(l =>
            `<i data-lec="${l.id}" class="${Progress.has(l.id) ? "done" : ""}"></i>`).join("")}</div>
        </div>
        <div class="box__footer">
          <span class="box__count">강의 ${box.lectures.length}개</span>
          <span class="box__open">열기 →</span>
        </div>`;
      el.addEventListener("click", () => App.Router.go("box/" + i));  // 라우터 push → 뒤로가기로 방 복귀
      boxesEl.appendChild(el);
    });
  }

  /* ---------- 상자 등장 애니메이션 (입장 직후) ---------- */
  function revealBoxes() {
    const k = fxScale();
    [...boxesEl.children].forEach((el, i) => {
      setTimeout(() => el.classList.add("reveal"), i * 120 * k);
    });
  }

  /* ---------- 완료 점 갱신 ---------- */
  function refreshBoxDots() {
    document.querySelectorAll(".box__dots i").forEach(dot => {
      const id = Number(dot.dataset.lec);
      dot.classList.toggle("done", Progress.has(id));
    });
  }

  /* ---------- 카드 부채꼴 전개 (라우터가 box 라우트에서 호출) ---------- */
  function dealFan(boxIndex) {
    // 같은 상자로 이미 열려 있으면 애니메이션 재시작 방지
    if (fanOverlay.classList.contains("is-open") && currentBox === boxIndex) return;
    currentBox = boxIndex;
    const box = CURRICULUM.boxes[boxIndex];
    fanTitle.textContent = `상자 ${boxIndex + 1} · 「${box.name}」 — ${box.theme}`;
    fanCardsEl.innerHTML = "";

    const n = box.lectures.length;
    const spread = 40;                      // 전체 부채꼴 각도 — 옆 카드 기울기를 줄여 제목 가독성↑
    const step = n > 1 ? spread / (n - 1) : 0;
    const start = -spread / 2;

    box.lectures.forEach((lec, i) => {
      const angle = start + step * i;
      const card = document.createElement("div");
      card.className = "card" + (Progress.has(lec.id) ? " seen" : "");
      card.style.setProperty("--card-accent", box.accent);
      card.dataset.lec = lec.id;
      card.dataset.box = currentBox;        // 스킨별 역할색 매핑용(예: sayu)
      // 접근성: 카드 자체가 버튼
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${lec.id}강 ${lec.title} — 강의실 입장`);
      card.innerHTML = `
        ${lec.demo ? `<span class="card__badge">DEMO</span>` : ""}
        <div class="card__no">${String(lec.id).padStart(2, "0")}강</div>
        <div class="card__title">${lec.title}</div>
        <div class="card__tag">${lec.tagline}</div>
        <span class="card__seen">✓ 열람함</span>`;

      // 부채꼴 최종 배치 (딜 완료 시 적용)
      const finalTransform = `rotate(${angle}deg) translateY(-46px)`;
      // 호버: 각도는 유지한 채 살짝만 떠오른다 → 커서에서 도망가지 않게
      const hoverTransform = `rotate(${angle}deg) translateY(-70px) scale(1.05)`;
      card.dataset.final = finalTransform;
      card.style.zIndex = i + 1;

      const lift = () => {
        if (!card.classList.contains("dealt")) return;   // 딜 도중엔 반응 안 함
        card.style.transform = hoverTransform;
        card.style.zIndex = 40;
      };
      const drop = () => {
        if (!card.classList.contains("dealt")) return;
        card.style.transform = finalTransform;
        card.style.zIndex = i + 1;
      };
      card.addEventListener("mouseenter", lift);
      card.addEventListener("mouseleave", drop);
      card.addEventListener("focus", lift);
      card.addEventListener("blur", drop);
      card.addEventListener("click", () => selectCard(lec, box));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectCard(lec, box);
        }
      });

      fanCardsEl.appendChild(card);
    });

    fanOverlay.classList.add("is-open");
    // 딜링: 아래 중앙에서 모였다가 → 부채꼴로 펼쳐진 뒤 정착(그 후 가만히 멈춤)
    const k = fxScale();
    requestAnimationFrame(() => {
      [...fanCardsEl.children].forEach((card, i) => {
        card.style.transform = "rotate(0deg) translateY(120px) scale(.9)";
        setTimeout(() => {
          card.classList.add("dealt");           // dealt → pointer-events:auto (CSS)
          card.style.transform = card.dataset.final;
        }, (40 + i * 60) * k);
      });
    });
  }

  // 부채꼴 DOM만 닫는다(히스토리 조작 없음) — 라우터가 box 외 라우트에서 호출
  function closeFanDOM() {
    fanOverlay.classList.remove("is-open");
    currentBox = null;
  }

  /* ---------- 카드 선택 → 강의 슬라이드(라우터 push) ---------- */
  function selectCard(lec, box) {
    App.Router.go("lecture/" + lec.id);   // handle()이 부채꼴 닫고 슬라이드로 전환
  }

  /* ---------- 카드 열람 표시 갱신 ---------- */
  function refreshCardsSeen() {
    document.querySelectorAll(".card").forEach(card => {
      const id = Number(card.dataset.lec);
      card.classList.toggle("seen", Progress.has(id));
    });
  }

  // 닫기/바깥클릭/Esc → 상자 페이지(방)로 복귀
  //   history.back()이 아니라 명시적으로 #/room 으로 간다: 강의를 연속으로 본 뒤엔
  //   히스토리 뒤로가기가 직전 강의로 가버리기 때문(상자 닫기 = 방으로 나가기).
  fanClose.addEventListener("click", () => App.Router.go("room"));
  fanOverlay.addEventListener("click", (e) => { if (e.target === fanOverlay) App.Router.go("room"); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && fanOverlay.classList.contains("is-open")) App.Router.go("room");
  });

  /* ---------- 전역 노출 ---------- */
  window.buildRoom = buildRoom;
  window.revealBoxes = revealBoxes;
  window.refreshBoxDots = refreshBoxDots;
  window.refreshCardsSeen = refreshCardsSeen;
  window.dealFan = dealFan;
  window.closeFanDOM = closeFanDOM;
})();
