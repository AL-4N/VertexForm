/**
 * cursor.js — the homepage's own pointer: one ring, exactly where the mouse
 * is (moved on every pointer event, no easing, so it never lags or splits
 * into two). Over links and buttons it opens up; over anything marked
 * data-cursor it becomes a filled disc saying what you can do there
 * ("Drag", "Open"). The size changes ease; the position never does. It
 * blends with `difference`, so it reads on any colour.
 *
 * It replaces the system pointer (css), except inside an open popup: popups
 * sit above everything else on the page, where the ring can't follow, so
 * the system pointer comes back there.
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
  document.body.append(ring);
  document.documentElement.classList.add("has-cursor");
  const label = ring.firstElementChild;

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    ring.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    ring.classList.add("on");
    const t = e.target instanceof Element ? e.target : null;
    const area = t?.closest("[data-cursor]");
    const link = !area && t?.closest("a, button, [role=tab], input[type=range], label");
    ring.classList.toggle("is-label", !!area);
    ring.classList.toggle("is-link", !!link);
    if (area && label.textContent !== area.dataset.cursor) label.textContent = area.dataset.cursor;
  }, { passive: true });
  addEventListener("pointerdown", () => ring.classList.add("down"));
  addEventListener("pointerup", () => ring.classList.remove("down"));
  document.addEventListener("pointerleave", () => ring.classList.remove("on"));
}
