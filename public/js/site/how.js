/**
 * how.js — one small figure per "How it works" step, all the same squat at
 * the bottom of a rep, so the four pictures read as one sequence:
 * tracked points → measured angle → graded → spoken cue.
 */

import { build, blend, angleAt } from "../figures/rig.js";
import { BY_ID } from "../figures/poses.js";
import { figureMarkup, bounds } from "../figures/draw.js";
import { gradeColor, gradeLetter } from "../grade.js";

const f = (n) => n.toFixed(1);

export function renderHow(root = document) {
  const hosts = root.querySelectorAll("[data-howfig]");
  if (!hosts.length) return;

  const ex = BY_ID.squat;
  const s = build(blend(ex.top, ex.bottom, 0.94));
  const m = ex.measure(s);
  const score = Math.round(m.score);
  const knee = Math.round(angleAt(s.hip, s.kneeN, s.ankN));

  // One frame for all four, with room above the head for the badge/bubble.
  const b = bounds(s, 30);
  const box = { x0: b.x0 - 40, y0: b.y0 - 70, x1: b.x1 + 40, y1: b.y1 };
  box.w = box.x1 - box.x0; box.h = box.y1 - box.y0;
  const floor = { x0: box.x0 + 10, x1: box.x1 - 10 };
  const dim = "#46527c";
  const head = s.head;

  const scenes = {
    1: figureMarkup(s, { color: dim, width: 6, floor, joints: true, jointR: 6.5, jointColor: "#c6ef4e" }),
    2: figureMarkup(s, { color: "#a6aecb", width: 6, floor, arc: [s.hip, s.kneeN, s.ankN], arcR: 34, arcLabel: `${knee}°` }) +
       `<line x1="${f(s.kneeN[0] - 150)}" y1="${f(s.kneeN[1])}" x2="${f(s.kneeN[0] + 12)}" y2="${f(s.kneeN[1])}" stroke="#ffbe3d" stroke-width="2.5" stroke-dasharray="6 7"/>`,
    3: figureMarkup(s, { color: gradeColor(score), floor }) + badge(head, score),
    4: figureMarkup(s, { color: gradeColor(score), floor }) + bubble(head, "Good depth!"),
  };

  hosts.forEach((host) => {
    const n = host.dataset.howfig;
    host.innerHTML = `<svg viewBox="${f(box.x0)} ${f(box.y0)} ${f(box.w)} ${f(box.h)}" aria-hidden="true">${scenes[n] ?? ""}</svg>`;
  });

  function badge(h, sc) {
    const x = h[0] - 150, y = h[1] - 62, c = gradeColor(sc);
    return `<g><rect x="${f(x)}" y="${f(y)}" width="118" height="54" rx="27" fill="#121a32" stroke="${c}" stroke-width="3"/>
      <text x="${f(x + 59)}" y="${f(y + 37)}" text-anchor="middle" font-family="Unbounded, system-ui, sans-serif" font-weight="800" font-size="27" fill="${c}">${sc} ${gradeLetter(sc)}</text></g>`;
  }

  function bubble(h, text) {
    const w = 196, x = h[0] - w - 20, y = h[1] - 76;
    return `<g><rect x="${f(x)}" y="${f(y)}" width="${w}" height="56" rx="22" fill="#eef1fb"/>
      <path d="M${f(x + w - 52)} ${f(y + 54)} L${f(x + w - 24)} ${f(y + 54)} L${f(x + w + 4)} ${f(y + 76)} Z" fill="#eef1fb"/>
      <text x="${f(x + w / 2)}" y="${f(y + 36)}" text-anchor="middle" font-family="Unbounded, system-ui, sans-serif" font-weight="700" font-size="21" fill="#090d1c">${text}</text></g>`;
  }
}
