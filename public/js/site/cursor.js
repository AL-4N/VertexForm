/**
 * cursor.js — a measuring ring that follows the pointer.
 *
 * A small ring trails the pointer (eased, so it settles like a needle).
 * Over links and buttons it opens up; over anything marked data-cursor it
 * becomes a filled disc saying what you can do there ("Drag", "Open").
 * It blends with `difference`, so it reads on dark and on paper alike.
 * The system pointer stays visible everywhere except over data-cursor
 * areas, where the disc replaces it.
 *
 * Mouse and trackpad only; not on touch, and not with reduced motion.
 */

import { reducedMotion } from "../ui/motion.js";

export function mountCursor() {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches || reducedMotion()) return;
  const ring = document.createElement("div");
  ring.className = "cursor";
  ring.setAttribute("aria-hidden", "true");
  ring.innerHTML = `<span class="cursor-label"></span>`;
  document.body.appendChild(ring);
  document.documentElement.classList.add("has-cursor");
  const label = ring.firstElementChild;

  let x = -100, y = -100, tx = -100, ty = -100, raf = 0, last = 0, shown = false;
  const tick = (now) => {
    const dt = last ? Math.min(50, now - last) : 16;
    last = now;
    const k = 1 - Math.pow(0.00002, dt / 1000);
    x += (tx - x) * k; y += (ty - y) * k;
    ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    raf = Math.hypot(tx - x, ty - y) > 0.2 ? requestAnimationFrame(tick) : 0;
    if (!raf) last = 0;
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    tx = e.clientX; ty = e.clientY;
    if (!shown) { x = tx; y = ty; shown = true; ring.classList.add("on"); }
    const t = e.target instanceof Element ? e.target : null;
    const area = t?.closest("[data-cursor]");
    const link = !area && t?.closest("a, button, [role=tab], input[type=range], label");
    ring.classList.toggle("is-label", !!area);
    ring.classList.toggle("is-link", !!link);
    if (area) label.textContent = area.dataset.cursor;
    raf ||= requestAnimationFrame(tick);
  }, { passive: true });
  addEventListener("pointerdown", () => ring.classList.add("down"));
  addEventListener("pointerup", () => ring.classList.remove("down"));
  document.addEventListener("pointerleave", () => { ring.classList.remove("on"); shown = false; });
}
