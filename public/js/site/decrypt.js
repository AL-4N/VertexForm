/**
 * decrypt.js — small mono labels decode as they come into view (an idea
 * from React Bits' "Decrypted Text", rebuilt in plain JS): every character
 * starts as a random measuring glyph and settles to the real one, left to
 * right, in about half a second. Spaces and punctuation stay put. Screen
 * readers get the real label throughout (aria-label). Once per label;
 * off for reduced motion.
 */

import { reducedMotion } from "../ui/motion.js";

const GLYPHS = "0123456789°±×÷=<>/\\|#%+–";

function run(el) {
  const text = el.textContent;
  if (!text.trim() || el.children.length) return;
  el.setAttribute("aria-label", text);
  const start = performance.now(), dur = 380 + text.length * 22;
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur);
    const settled = Math.floor(k * text.length);
    el.textContent = [...text].map((ch, i) => (i < settled || !/[A-Za-z0-9]/.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
    if (k < 1) requestAnimationFrame(step);
    else { el.textContent = text; el.removeAttribute("aria-label"); }
  };
  requestAnimationFrame(step);
}

export function mountDecrypt(selector = "main .tag, .ex-pop-mini, .lab-mini, .cal-caption, .r3-hud-src, .sec-index span") {
  if (reducedMotion()) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); run(e.target); }
  }, { rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
}
