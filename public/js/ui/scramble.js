/**
 * scramble.js — text that decodes: every letter and digit starts as a
 * random measuring glyph (digits, °, ±, ×…) and settles to the real one,
 * left to right, with a soft blur that clears as it settles. Works on the
 * text inside any element and leaves its child elements (icons, arrows,
 * split words) where they are. Screen readers keep the real text
 * (aria-label while it runs). Used by the homepage (site/decrypt.js) and
 * the trainer (screen labels). Reduced motion: nothing happens.
 */

import { reducedMotion } from "./motion.js";

const GLYPHS = "0123456789°±×÷=<>/\\|#%+–";
const running = new WeakMap();

function textNodes(el) {
  const out = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue.trim()) out.push(n);
  return out;
}

/** Decode el's text. speed: ms per character (plus a base); blur: px at the start. */
export function scramble(el, { speed = 22, base = 360, blur = 3 } = {}) {
  if (!el || reducedMotion()) return;
  running.get(el)?.();                        // restart cleanly if it's already going
  const nodes = textNodes(el);
  if (!nodes.length) return;
  const real = nodes.map((n) => n.nodeValue);
  const total = real.reduce((a, t) => a + t.length, 0);
  const label = el.getAttribute("aria-label");
  if (label == null) el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
  // Hold the element's width: random glyphs are narrower or wider than the
  // real letters, and a button shouldn't twitch while its label decodes.
  const keep = { width: el.style.width, whiteSpace: el.style.whiteSpace, overflow: el.style.overflow };
  const one = el.getClientRects().length === 1 && el.getBoundingClientRect().height < 80;   // one line: hold it exactly
  if (one && getComputedStyle(el).display !== "inline") {
    Object.assign(el.style, { width: `${el.getBoundingClientRect().width}px`, whiteSpace: "nowrap", overflow: "hidden" });
  }
  const start = performance.now(), dur = base + total * speed;
  let raf = 0;
  const finish = () => {
    cancelAnimationFrame(raf);
    nodes.forEach((n, i) => { n.nodeValue = real[i]; });
    if (label == null) el.removeAttribute("aria-label");
    el.style.filter = "";
    Object.assign(el.style, keep);
    running.delete(el);
  };
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur);
    let settled = Math.floor(k * total);
    nodes.forEach((n, i) => {
      const t = real[i];
      n.nodeValue = [...t].map((ch) => (settled-- > 0 || !/[A-Za-z0-9]/.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
    });
    el.style.filter = blur && k < 1 ? `blur(${(blur * (1 - k)).toFixed(2)}px)` : "";
    if (k < 1) raf = requestAnimationFrame(step);
    else finish();
  };
  running.set(el, finish);
  raf = requestAnimationFrame(step);
}

/** Scramble each element the first time it comes on screen. */
export function scrambleOnView(elements, opts) {
  if (reducedMotion()) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); scramble(e.target, opts); }
  }, { rootMargin: "0px 0px -8% 0px" });
  elements.forEach((el) => io.observe(el));
}

/** Scramble a control's label each time the pointer comes onto it. */
export function scrambleOnHover(elements) {
  if (reducedMotion() || !matchMedia("(hover: hover)").matches) return;
  elements.forEach((el) => el.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") scramble(el, { speed: 14, base: 220, blur: 0 });
  }));
}
