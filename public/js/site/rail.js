/**
 * rail.js — the side rail on wide screens: a ruler down the left edge with
 * one labelled tick per section. The markup is in index.html (so the page
 * never flashes the header links first); this only drives the fill. It's
 * its own column (the page shifts over to make room), so section
 * backgrounds never run underneath it.
 *
 * The fill grows continuously as you scroll: between two sections it's
 * the same fraction of the way between their ticks, so it reaches a tick
 * exactly as that section becomes current (nav-spy.js lights the label at
 * the same line, 40% down the screen). After the last linked section it
 * runs on to the end of the ruler as you reach the bottom of the page.
 * The drawn position eases toward that target every frame (exponential
 * follow), so even a fast flick glides instead of jumping. The marker
 * rides the end of the fill.
 *
 * Below 1400px wide there's no room beside the content, so the CSS keeps
 * the header nav instead (and this does nothing while the rail is hidden).
 */

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

  /** Where the fill should end (px down the ruler) for the current scroll. */
  function target() {
    const H = inner.offsetHeight;
    const ticks = links.map((a) => a.offsetTop + a.offsetHeight / 2);
    const line = scrollY + innerHeight * 0.4;                  // nav-spy's "current" line
    const tops = sections.map((s) => s.getBoundingClientRect().top + scrollY);
    const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

    // Before the first section: from the top of the ruler to its first tick.
    const start = innerHeight * 0.4;
    if (line < tops[0]) return lerp(0, ticks[0], (line - start) / Math.max(1, tops[0] - start));
    for (let i = 0; i < tops.length - 1; i++) {
      if (line < tops[i + 1]) return lerp(ticks[i], ticks[i + 1], (line - tops[i]) / (tops[i + 1] - tops[i]));
    }
    // After the last: on to the end of the ruler by the bottom of the page.
    const end = document.documentElement.scrollHeight - innerHeight * 0.6;
    return lerp(ticks.at(-1), H, (line - tops.at(-1)) / Math.max(1, end - tops.at(-1)));
  }

  let shown = null, goal = 0, raf = 0, last = 0;

  const paint = (y) => {
    const H = inner.offsetHeight || 1;
    fill.style.transform = `scaleY(${(y / H).toFixed(4)})`;
    marker.style.transform = `translateY(${y.toFixed(2)}px)`;
    marker.classList.toggle("on", y > 0.5);
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

  const update = () => {
    if (!wide.matches) return;                         // narrow screen: no rail
    goal = target();
    if (!raf) raf = requestAnimationFrame(frame);
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", () => { shown = null; update(); });
  addEventListener("load", update);     // fonts and figures can shift section positions
  update();
}
