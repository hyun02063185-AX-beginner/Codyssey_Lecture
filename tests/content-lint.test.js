/* =========================================================================
   content-lint.test.js — js/data.js 콘텐츠 무결성 린트 (본진판)
   -------------------------------------------------------------------------
   AI_First_Step/tests/content-lint.test.js에서 이식(order/하네스_구축_지시서.md
   §4 "본진 적용"). 판단이 필요 없는 결정론적 구조 검사만 한다("규격"인 장수
   범위·어투·용어 같은 판단은 tone-keeper 서브에이전트 몫).

   사이트별 조정 지점: 본진은 7·8강에 `lec.slidesPersonal`(경험판 — 기본
   slides와 별개의 완전한 대체 덱, `?variant=personal` 전용)이 있어 첫걸음판에
   없던 검사 블록을 추가했다.
   ========================================================================= */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const { CURRICULUM } = require(path.join(ROOT, "js", "data.js"));

/* ---------- 사이트별 조정 상수 (여기만 바꾸면 다른 사이트에도 재사용 가능) ---------- */
const LECTURE_COUNT = 20;
const VALID_SLIDE_TYPES = new Set(["cover", "big", "bullets", "quote", "split", "image", "closing"]);
// 마지막 강(가장 큰 id)도 teaser가 필요한지 — 이 사이트는 20강이 "당신 차례입니다"로
// 실행을 촉구하며 관통 문장을 회수하는 teaser를 갖고 있으므로 true.
const LAST_LECTURE_TEASER_REQUIRED = true;

/* ---------- 슬라이드 1장의 타입별 필수 필드 검사 ---------- */
function checkSlideShape(slide, where, errors) {
  if (!slide || typeof slide !== "object") {
    errors.push(`${where}: 슬라이드가 객체가 아님`);
    return;
  }
  if (!VALID_SLIDE_TYPES.has(slide.type)) {
    errors.push(`${where}: 알 수 없는 type "${slide.type}"`);
    return;
  }
  switch (slide.type) {
    case "cover":
      if (!slide.title) errors.push(`${where}: cover.title 없음`);
      break;
    case "big":
      if (!slide.word) errors.push(`${where}: big.word 없음`);
      break;
    case "bullets":
      if (!slide.title) errors.push(`${where}: bullets.title 없음`);
      if (!Array.isArray(slide.items) || slide.items.length === 0)
        errors.push(`${where}: bullets.items가 비어있거나 배열이 아님`);
      break;
    case "quote":
      if (!slide.text) errors.push(`${where}: quote.text 없음`);
      break;
    case "split":
      if (!slide.title) errors.push(`${where}: split.title 없음`);
      if (!Array.isArray(slide.left) || slide.left.length === 0)
        errors.push(`${where}: split.left가 비어있거나 배열이 아님`);
      if (!Array.isArray(slide.right) || slide.right.length === 0)
        errors.push(`${where}: split.right가 비어있거나 배열이 아님`);
      break;
    case "image":
      if (!slide.src) {
        errors.push(`${where}: image.src 없음`);
      } else {
        const imgPath = path.join(ROOT, slide.src);
        if (!fs.existsSync(imgPath)) errors.push(`${where}: image.src 파일 없음 — ${slide.src}`);
      }
      break;
    case "closing":
      if (!slide.title) errors.push(`${where}: closing.title 없음`);
      break;
  }
}

// 완전한 슬라이드 배열(기본 slides 또는 slidesPersonal 경험판) 하나를 통째로 검사.
// strictLastClosing=false면 "closing이 배열 어딘가에 존재"만 요구한다 — 실측 결과, 경험판
// (slidesPersonal)은 강사 라이브 강의용이라 정식 closing 뒤에 [부록] 참고 도식 슬라이드가
// 붙는 경우가 있었다(예: 8강 경험판 마지막 = 도구층위 부록 이미지, closing은 그 앞).
// 이는 콘텐츠 결함이 아니라 두 덱 종류의 의도된 구조 차이로 판단해 규칙을 그에 맞게 나눴다
// (콘텐츠는 고치지 않음 — order/하네스_구축_지시서.md 가드레일).
function checkDeck(deck, label, errors, { requireTeaser, strictLastClosing = true }) {
  if (!Array.isArray(deck) || deck.length === 0) {
    errors.push(`${label}: 비어있거나 배열이 아님`);
    return;
  }
  if (deck[0].type !== "cover") errors.push(`${label}: 첫 슬라이드가 cover 아님`);
  const last = deck[deck.length - 1];
  const closingSlide = strictLastClosing ? (last.type === "closing" ? last : null) : deck.find(s => s.type === "closing");
  if (strictLastClosing && last.type !== "closing") {
    errors.push(`${label}: 마지막 슬라이드가 closing 아님`);
  } else if (!strictLastClosing && !closingSlide) {
    errors.push(`${label}: closing 슬라이드가 배열 안에 하나도 없음`);
  }
  deck.forEach((s, i) => checkSlideShape(s, `${label} #${i}`, errors));
  if (requireTeaser && closingSlide && !(closingSlide.teaser && closingSlide.teaser.trim().length > 0)) {
    errors.push(`${label}: closing.teaser 없음`);
  }
}

test("CURRICULUM.boxes 안 강의 수 = " + LECTURE_COUNT, () => {
  const total = CURRICULUM.boxes.reduce((n, box) => n + box.lectures.length, 0);
  assert.equal(total, LECTURE_COUNT);
});

test("각 강 id는 1.." + LECTURE_COUNT + " 범위에서 중복 없이 등장", () => {
  const ids = [];
  CURRICULUM.boxes.forEach(box => box.lectures.forEach(lec => ids.push(lec.id)));
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, "중복 id 존재: " + JSON.stringify(ids));
  for (let i = 1; i <= LECTURE_COUNT; i++) assert.ok(unique.has(i), `id ${i} 누락`);
});

CURRICULUM.boxes.forEach((box, bi) => {
  box.lectures.forEach(lec => {
    const label = `구역${bi + 1}·${lec.id}강(${lec.title})`;
    const isLastLecture = lec.id === LECTURE_COUNT;
    const requireTeaser = !(isLastLecture && !LAST_LECTURE_TEASER_REQUIRED);

    test(`${label} — 기본 slides 구조·타입·필수필드·teaser 유효`, () => {
      const errors = [];
      checkDeck(lec.slides, label, errors, { requireTeaser });
      assert.deepEqual(errors, [], errors.join("\n"));
    });

    test(`${label} — slidesPersonal(경험판, 있으면) 구조 유효`, () => {
      if (!lec.slidesPersonal) return;
      const errors = [];
      checkDeck(lec.slidesPersonal, `${label}: slidesPersonal`, errors, { requireTeaser: false, strictLastClosing: false });
      assert.deepEqual(errors, [], errors.join("\n"));
    });

    test(`${label} — slidesVariants(있으면, 페르소나 오버라이드) 유효`, () => {
      if (!lec.slidesVariants) return;
      const errors = [];
      Object.entries(lec.slidesVariants).forEach(([personaKey, overrideMap]) => {
        Object.entries(overrideMap).forEach(([idxStr, overrideSlide]) => {
          const idx = Number(idxStr);
          if (!Number.isInteger(idx) || idx < 0 || idx >= lec.slides.length) {
            errors.push(`${label}: slidesVariants.${personaKey}의 인덱스 ${idxStr}가 기본판 범위(0..${lec.slides.length - 1}) 밖`);
            return;
          }
          checkSlideShape(overrideSlide, `${label}: slidesVariants.${personaKey}[${idx}]`, errors);
        });
      });
      assert.deepEqual(errors, [], errors.join("\n"));
    });
  });
});
