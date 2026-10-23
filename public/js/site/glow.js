/**
 * glow.js — a soft radial light that follows the pointer behind the page
 * content: green at its heart fading through amber into the navy, so the
 * page brightens a little wherever you point (light falls between and
 * around the cards; they keep their own colour). One fixed layer moved by
 * transform, eased so it drifts after the pointer. Mouse only; off for
 * reduced motion.
 */

import { reducedMotion } from "../ui/motion.js";

export function mountGlow() {
  if (reducedMotion() || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const el = document.createElement("div");
  el.className = "pointer-glow";
  el.setAttribute("aria-hidden", "true");
  document.body.prepend(el);
  let x = innerWidth / 2, y = innerHeight / 3, tx = x, ty = y, raf = 0;
  const step = () => {
    x += (tx - x) * 0.14; y += (ty - y) * 0.14;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(step) : 0;
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    tx = e.clientX; ty = e.clientY;
    el.classList.add("on");
    raf ||= requestAnimationFrame(step);
  }, { passive: true });
  document.addEventListener("pointerleave", () => el.classList.remove("on"));
  step();
}
