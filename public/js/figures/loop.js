/**
 * loop.js — a small looping demo of one exercise done well, coloured by its
 * live score. Used on the app's setup screen ("what a good rep looks like").
 * Returns a stop() function. Pauses itself while its host is hidden.
 */

import { build, blend } from "./rig.js";
import { BY_ID } from "./poses.js";
import { figureMarkup, bounds } from "./draw.js";
import { gradeColor } from "../grade.js";

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const ARCS = {
  squat: (s) => [s.hip, s.kneeN, s.ankN],
  lunge: (s) => [s.hip, s.kneeN, s.ankN],
  pushup: (s) => [s.shN, s.elbN, s.wriN],
};

export function mountLoop(host, id) {
  const ex = BY_ID[id];
  if (!host || !ex) return () => {};

  // Frame both ends of the rep so the figure never leaves the box.
  const a = bounds(build(ex.top), 26), b = bounds(build(ex.bottom), 26);
  const x0 = Math.min(a.x0, b.x0), y0 = Math.min(a.y0, b.y0);
  const x1 = Math.max(a.x1, b.x1), y1 = Math.max(a.y1, b.y1);
  host.innerHTML = `<svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}" role="img" aria-label="Animated stick figure doing a ${ex.name.toLowerCase()} with good form"><g></g></svg>`;
  const g = host.querySelector("g");

  let shown = 0;
  const draw = (t) => {
    const s = build(blend(ex.top, ex.bottom, t));
    const m = ex.measure(s);
    shown += (m.score - shown) * 0.12;
    g.innerHTML = figureMarkup(s, {
      color: gradeColor(shown), floor: { x0: x0 + 6, x1: x1 - 6 }, arc: ARCS[id]?.(s),
      guide: id === "plank" ? [s.neck, s.ankN] : null, guideColor: "#eef1fb",
    });
  };

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    shown = 100;
    draw(ex.good === "top" ? 0 : 1);
    return () => {};
  }

  const [dn, hold, up, rest] = ex.timing;
  const total = dn + hold + up + rest;
  const start = performance.now();
  let raf = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (!host.isConnected || host.offsetParent === null) return;   // screen hidden
    const p = (now - start) % total;
    draw(p < dn ? ease(p / dn) : p < dn + hold ? 1 : p < dn + hold + up ? 1 - ease((p - dn - hold) / up) : 0);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
