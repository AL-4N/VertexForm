/**
 * ticker.js — strips of real facts that slide sideways as you scroll.
 *
 * They don't run on their own (nothing loops for decoration): each row's
 * position comes from how far down the page you are, alternate rows going
 * opposite ways, and a fast scroll leans the letters a little (skew from
 * the scroll speed, easing back upright when you stop). Every fact on them
 * is true of the app (see index.html). Screen readers skip them: the same
 * facts are in the page's text. Reduced motion: they sit still.
 */

import { reducedMotion } from "../ui/motion.js";

export function mountTickers() {
  const rows = [...document.querySelectorAll("[data-ticker]")];
  if (!rows.length) return;
  // Repeat each row's items until a row is well over twice the screen wide.
  for (const row of rows) {
    const track = row.querySelector(".ticker-track");
    const items = [...track.children];
    // One full set, including the gap that follows it, is how far a row can slide before it repeats.
    const unit = track.scrollWidth + parseFloat(getComputedStyle(track).columnGap || "0");
    while (track.scrollWidth < innerWidth * 2.5 + unit) items.forEach((i) => track.appendChild(i.cloneNode(true)));
    row.dataset.unit = String(unit || 1);
  }
  if (reducedMotion()) return;

  let lastY = scrollY, skew = 0, raf = 0, lastT = performance.now();
  const frame = (now) => {
    raf = 0;
    const dt = Math.max(1, now - lastT); lastT = now;
    const v = (scrollY - lastY) / dt; lastY = scrollY;      // px per ms
    skew += (Math.max(-12, Math.min(12, v * -5)) - skew) * 0.18;
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (r.bottom < -50 || r.top > innerHeight + 50) continue;
      const unit = Number(row.dataset.unit), dir = row.dataset.ticker === "right" ? 1 : -1;
      const x = ((scrollY * 0.45 * dir) % unit + unit) % unit;
      row.firstElementChild.style.transform = `translate3d(${-x}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
      // Fast scrolls smear the strip sideways a little (cleared when still).
      const b = Math.min(4, Math.abs(skew) * 0.5);
      row.firstElementChild.style.filter = b > 0.2 ? `blur(${b.toFixed(1)}px)` : "";
    }
    if (Math.abs(skew) > 0.05) raf = requestAnimationFrame(frame);
  };
  addEventListener("scroll", () => { raf ||= requestAnimationFrame(frame); }, { passive: true });
  frame(performance.now());
}
