/**
 * tones.js — the page changes colour as you move through it.
 *
 * Every section says which tone it is (data-tone="dark" | "paper" | "sage").
 * Whichever section is under the middle of the screen sets body[data-tone];
 * the CSS turns that into the page background and text colours, and since
 * those are registered custom properties (@property in site.css) the whole
 * page blends from one tone to the next instead of jumping at a hard edge.
 * Cards, figures and the 3D views keep their own dark colours throughout.
 * Where the sections are comes from scroll-progress.js (no measuring here).
 */

import { onScroll, sectionAt } from "./scroll-progress.js";

export function mountTones() {
  onScroll((s) => {
    const at = sectionAt(s, 0.5, (b) => b.el.dataset.tone)
      ?? (s.y < 10 ? s.list.find((b) => b.el.dataset.tone) : s.list.findLast((b) => b.el.dataset.tone));
    const tone = at?.el.dataset.tone;
    if (tone && document.body.dataset.tone !== tone) document.body.dataset.tone = tone;
  });
}
