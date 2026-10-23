/**
 * tilt.js — cards lean toward the pointer, like a card held in the hand:
 * up to 6° each way in perspective, with a soft sheen that follows the
 * pointer across the card (--mx / --my feed the ::after highlight in
 * site.css), and they settle back when the pointer leaves. GSAP's quickTo
 * keeps it smooth. Mouse only; off for reduced motion or without GSAP.
 */

import { reducedMotion } from "../ui/motion.js";

export function mountTilt(selector = ".ex-card, .mode, .cue, .panel") {
  const { gsap } = window;
  if (!gsap || reducedMotion() || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  for (const el of document.querySelectorAll(selector)) {
    el.classList.add("tilt");
    const rx = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3.out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3.out" });
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      ry((x - 0.5) * 12); rx((0.5 - y) * 10);
      el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    });
    el.addEventListener("pointerleave", () => { rx(0); ry(0); });
  }
}
