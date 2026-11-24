/**
 * rail.js — the side rail on wide screens: a ruler down the left edge with
 * one labelled tick per section. The markup is in index.html (so the page
 * never flashes the header links first); this only drives the fill. It's
 * its own column (the page shifts over to make room), so section
 * backgrounds never run underneath it.
 *
 * On the hero it rests on the first tick (that item is lit from the first
 * frame; see index.html). Then it grows continuously as you scroll: between two sections it's
 * the same fraction of the way between their ticks, so it reaches a tick
 * exactly as that section becomes current (nav-spy.js lights the label at
 * the same line, 40% down the screen). After the last linked section it
 * runs on to the end of the ruler as you reach the bottom of the page.
 * The drawn position eases toward that target every frame (exponential
 * follow), so even a fast flick glides instead of jumping. The marker
 * rides the end of the fill.
 *
 * At rest it's a thin strip (css/site.css); it pops out when pointed at or
 * focused, and on its own for a moment (.peek) when you arrive at a new
 * section, so you see where you are, then tucks away again.
 *
 * Below 1400px wide there's no room beside the content, so the CSS keeps
 * the header nav instead (and this does nothing while the rail is hidden).
 * Section positions come from scroll-progress.js; the ruler's own ticks are
 * measured only when the page is (s.version), not every frame.
 */

import { onScroll } from "./scroll-progress.js";

const FOLLOW_MS = 110;   // smoothing time constant: lower = snappier

export function mountRail() {
  const rail = document.querySelector(".rail");
  if (!rail) return;
  const inner = rail.querySelector(".rail-inner");
  const fill = rail.querySelector(".rail-fill");
  const marker = rail.querySelector(".rail-marker");
  const links = [...rail.querySelectorAll("a[href^='#']")];
  const sections = links.map((a) => document.getElementById(a.hash.slice(1)));
  if (!inner || !links.length || sections.some((s) => !s)) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const wide = matchMedia("(min-width: 1400px)");      // same breakpoint as css/site.css

  let H = 1, ticks = [], version = -1;
  links.forEach((a, i) => a.style.setProperty("--i", String(i)));   // labels slide in one after another
  // Arriving at a new section: pop out for a moment to show where you are.
  let current = -2, peekT = 0;
  const peek = (i) => {
    if (i === current) return;
    const first = current === -2;
    current = i;
    if (first || i < 0 || reduce.matches) return;      // not on load, not on the hero
    rail.classList.add("peek");
    clearTimeout(peekT);
    peekT = setTimeout(() => rail.classList.remove("peek"), 1500);
  };

  /** Where the fill should end (px down the ruler) for scroll state s. */
  function target(s) {
    if (s.version !== version) {
      version = s.version;
      H = inner.offsetHeight || 1;
      ticks = links.map((a) => a.offsetTop + a.offsetHeight / 2);
    }
    const line = s.y + s.vh * 0.4;                              // nav-spy's "current" line
    const tops = sections.map((el) => s.sections[el.id]?.top ?? 0);
    const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

    // Before the first section (the hero): rest on the first tick.
    if (line < tops[0]) return ticks[0];
    for (let i = 0; i < tops.length - 1; i++) {
      if (line < tops[i + 1]) return lerp(ticks[i], ticks[i + 1], (line - tops[i]) / (tops[i + 1] - tops[i]));
    }
    // After the last: on to the end of the ruler by the bottom of the page.
    const end = s.max + s.vh * 0.4;                             // the page's height less 60% of the screen
    return lerp(ticks.at(-1), H, (line - tops.at(-1)) / Math.max(1, end - tops.at(-1)));
  }

  let shown = null, goal = 0, raf = 0, last = 0;

  const paint = (y) => {
    fill.style.transform = `scaleY(${(y / H).toFixed(4)})`;
    marker.style.transform = `translateY(${y.toFixed(2)}px)`;
  };

  function frame(now) {
    raf = 0;
    const dt = Math.min(64, last ? now - last : 16);
    last = now;
    if (shown == null || reduce.matches) shown = goal;
    else shown += (goal - shown) * (1 - Math.exp(-dt / FOLLOW_MS));
    if (Math.abs(goal - shown) < 0.15) shown = goal;
    paint(shown);
    if (shown !== goal) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  let lastVh = 0;
  onScroll((s) => {
    if (!wide.matches) return;                         // narrow screen: no rail
    if (s.vh !== lastVh) { lastVh = s.vh; shown = null; }   // resized: jump, don't glide
    goal = target(s);
    const line = s.y + s.vh * 0.4;
    peek(sections.reduce((n, el, i) => ((s.sections[el.id]?.top ?? Infinity) <= line ? i : n), -1));
    if (!raf) raf = requestAnimationFrame(frame);
  });
}
