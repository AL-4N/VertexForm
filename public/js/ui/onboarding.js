/**
 * onboarding.js — three quick cards on how to set up the camera. Shown the
 * first time the trainer opens; re-openable from Settings.
 *
 * The cards are a sliding carousel with motion blur (js/ui/motion.js):
 * Next / Back, swipe or drag, or the arrow keys.
 */

import { $, $$ } from "./components.js";
import { slide, settle, EASE } from "./motion.js";

export function showOnboarding(onDone = () => {}) {
  const dlg = $("#onboarding");
  if (!dlg || dlg.open) return;
  const box = $(".onb-cards", dlg);
  const cards = $$(".onb-card", dlg), dots = $$(".onb-dots span", dlg);
  let i = 0;

  const ui = () => {
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
    $("#onb-back").hidden = i === 0;
    $("#onb-next").textContent = i === cards.length - 1 ? "Got it" : "Next";
    $("#onb-skip").hidden = i === cards.length - 1;
  };

  /** Slide from card i to card `to`; `fromX` = where a drag left the current card. */
  const go = (to, fromX = 0) => {
    if (to < 0 || to >= cards.length || to === i) {           // nowhere to go: spring back
      if (fromX) slide(cards[i], { from: [fromX, 0], to: [0, 0], duration: 320, ease: EASE.outBack });
      return;
    }
    const dir = to > i ? 1 : -1, w = box.clientWidth;
    const out = cards[i], inn = cards[to];
    cards.forEach((c) => { settle(c); c.hidden = c !== out && c !== inn; });
    slide(out, { from: [fromX, 0], to: [-dir * w, 0], opacity: [1, 0.2], duration: 360, ease: EASE.inOut, strength: 0.7, maxBlur: 26, keep: true })
      .then(() => { if (cards[i] !== out) { out.hidden = true; out.style.transform = ""; out.style.opacity = ""; } });
    slide(inn, { from: [dir * w, 0], to: [0, 0], opacity: [0.2, 1], duration: 420, ease: EASE.out, strength: 0.7, maxBlur: 26 });
    i = to;
    ui();
  };

  const close = () => { dlg.close(); onDone(); };
  $("#onb-next").onclick = () => (i < cards.length - 1 ? go(i + 1) : close());
  $("#onb-back").onclick = () => go(i - 1);
  $("#onb-skip").onclick = close;
  dlg.oncancel = () => onDone();         // Esc
  dlg.onkeydown = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
  };

  // Swipe / drag: the card follows your finger, then slides on (or springs back).
  let startX = null, dx = 0;
  box.onpointerdown = (e) => { startX = e.clientX; dx = 0; settle(cards[i]); box.setPointerCapture(e.pointerId); };
  box.onpointermove = (e) => {
    if (startX == null) return;
    dx = e.clientX - startX;
    const edge = (dx > 0 && i === 0) || (dx < 0 && i === cards.length - 1);
    cards[i].style.transform = `translateX(${edge ? dx * 0.3 : dx}px)`;
  };
  box.onpointerup = box.onpointercancel = () => {
    if (startX == null) return;
    startX = null;
    const offset = new DOMMatrix(getComputedStyle(cards[i]).transform).m41;
    if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1), offset);
    else if (dx) slide(cards[i], { from: [offset, 0], to: [0, 0], duration: 300, ease: EASE.outBack });
  };

  cards.forEach((c, k) => { c.hidden = k !== 0; c.style.transform = ""; c.style.opacity = ""; });
  ui();
  dlg.showModal();
  slide(dlg, { from: [0, 48], to: [0, 0], opacity: [0, 1], duration: 440, ease: EASE.outBack });
  $("#onb-next").focus();
}
