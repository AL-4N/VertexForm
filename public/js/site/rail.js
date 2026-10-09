/**
 * rail.js — the side rail on wide screens: a ruler down the left edge with
 * one labelled tick per section. The markup is in index.html (so the page
 * never flashes the header links first); this only moves the marker. It's
 * its own column (the page shifts over to make room), so section
 * backgrounds never run underneath it. nav-spy.js
 * marks the current section; the marker glides to it with a vertical
 * motion blur, and the ruler fills down to it.
 *
 * Below 1400px wide there's no room beside the content, so the CSS keeps
 * the header nav instead.
 */

import { slide, EASE } from "../ui/motion.js";

export function mountRail() {
  const rail = document.querySelector(".rail");
  if (!rail) return;

  const inner = rail.querySelector(".rail-inner");
  const fill = rail.querySelector(".rail-fill");
  const marker = rail.querySelector(".rail-marker");
  let markerY = null;

  // nav-spy.js says which section is current (or none, in the hero). The
  // ruler fills down to that section's tick.
  let currentHash = null;
  addEventListener("resize", () => { markerY = null; place(currentHash); });
  document.addEventListener("vf:section", (e) => place(e.detail));

  function place(hash) {
    currentHash = hash;
    const link = hash ? rail.querySelector(`a[href="${hash}"]`) : null;
    marker.classList.toggle("on", !!link);
    if (!link) { fill.style.transform = "scaleY(0)"; return; }
    const y = link.offsetTop + link.offsetHeight / 2;
    fill.style.transform = `scaleY(${(y / inner.offsetHeight).toFixed(4)})`;
    const from = markerY ?? y;
    markerY = y;
    slide(marker, { from: [0, from], to: [0, y], duration: from === y ? 0 : 380, ease: EASE.out, strength: 0.9, maxBlur: 10, keep: true });
  }
}
