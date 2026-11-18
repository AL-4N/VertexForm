/**
 * progress.js — a hairline under the header that fills with the go gradient
 * as you read down the page, its tip a small glowing bead. Where the side
 * rail shows (1400 px and up) the rail does this job, so it hides.
 *
 * One transform per frame, only while the page is scrolling; it eases toward
 * the scroll position (scroll-progress.js's overall value) so a jump (a nav
 * link, the End key) glides instead of snapping. Reduced motion: it follows
 * exactly, no easing.
 */

import { reducedMotion } from "../ui/motion.js";
import { onScroll } from "./scroll-progress.js";

export function mountProgress(nav = document.querySelector(".nav")) {
  if (!nav) return;
  const bar = document.createElement("div");
  bar.className = "nav-progress";
  bar.setAttribute("aria-hidden", "true");
  bar.innerHTML = "<i></i><b></b>";
  nav.appendChild(bar);
  const fill = bar.firstElementChild, bead = bar.lastElementChild;

  let shown = 0, raf = 0, g = 0, width = 0;
  const frame = () => {
    shown = reducedMotion() ? g : shown + (g - shown) * 0.2;
    if (Math.abs(g - shown) < 0.0005) shown = g;
    fill.style.transform = `scaleX(${shown.toFixed(4)})`;
    // The bead stays inside the bar, so it never pokes past the edge of a phone screen.
    bead.style.transform = `translateX(${(shown * (width - 6)).toFixed(1)}px)`;
    bar.classList.toggle("moving", shown !== g);
    raf = shown !== g ? requestAnimationFrame(frame) : 0;
  };
  let version = -1;
  onScroll((s) => {
    if (s.version !== version) { version = s.version; width = bar.clientWidth; }   // the bar's width changes only when the page is measured again
    g = s.overall;
    raf ||= requestAnimationFrame(frame);
  });
}
