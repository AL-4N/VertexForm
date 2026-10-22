/**
 * magnet.js — primary buttons lean toward the pointer (an idea from React
 * Bits' "Magnet", rebuilt with GSAP's quickTo): within reach of a button it
 * drifts a quarter of the way to the pointer, and springs back with a
 * little wobble when the pointer leaves. Mouse only; off for reduced motion
 * or without GSAP.
 */

import { reducedMotion } from "../ui/motion.js";

const REACH = 70;      // px around the button that pulls it

export function mountMagnets(selector = ".btn-grad, .btn-dark, .ex-open") {
  const { gsap } = window;
  if (!gsap || reducedMotion() || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const items = [...document.querySelectorAll(selector)].map((el) => ({
    el,
    x: gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" }),
    y: gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" }),
    on: false,
  }));
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    for (const m of items) {
      const r = m.el.getBoundingClientRect();
      if (!r.width) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const near = Math.abs(dx) < r.width / 2 + REACH && Math.abs(dy) < r.height / 2 + REACH;
      if (near) { m.on = true; m.x(dx * 0.25); m.y(dy * 0.3); }
      else if (m.on) {
        m.on = false;
        gsap.to(m.el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)", overwrite: true });
      }
    }
  }, { passive: true });
}
