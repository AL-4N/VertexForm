/**
 * cursor.js — a measuring ring that follows the pointer.
 *
 * It replaces the system pointer on the homepage: a small dot sits exactly
 * where you point (so clicks stay precise) and a ring trails it, eased so
 * it settles like a needle. Over links and buttons the ring opens up; over
 * anything marked data-cursor it becomes a filled disc saying what you can
 * do there ("Drag", "Open"). It blends with `difference`, so it reads on
 * any colour. Popups sit above everything else on the page, where the ring
 * can't follow, so inside an open popup the system pointer comes back.
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
  const dot = document.createElement("div");
  dot.className = "cursor-dot";
  dot.setAttribute("aria-hidden", "true");
  document.body.append(ring, dot);
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
    dot.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    if (!shown) { x = tx; y = ty; shown = true; ring.classList.add("on"); dot.classList.add("on"); }
    const t = e.target instanceof Element ? e.target : null;
    const area = t?.closest("[data-cursor]");
    const link = !area && t?.closest("a, button, [role=tab], input[type=range], label");
    ring.classList.toggle("is-label", !!area);
    dot.classList.toggle("is-label", !!area);
    ring.classList.toggle("is-link", !!link);
    if (area) label.textContent = area.dataset.cursor;
    raf ||= requestAnimationFrame(tick);
  }, { passive: true });
  addEventListener("pointerdown", () => ring.classList.add("down"));
  addEventListener("pointerup", () => ring.classList.remove("down"));
  document.addEventListener("pointerleave", () => { ring.classList.remove("on"); dot.classList.remove("on"); shown = false; });
}
