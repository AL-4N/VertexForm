/**
 * annotate.js — drawing-board marks over a stick figure (site only).
 *
 *   angleMark   a protractor at a joint: thin arc, a tick every 10° (longer
 *               every 30°), and the measured angle in a boxed mono label
 *   levelLine   a dashed reference line with a small label ("parallel")
 *   offsetMark  a dimension line from a point to a target line, with end
 *               ticks and a label (how far the hips sit off the body line)
 *   coachNote   a handwritten note with a hand-drawn arrow to a body part
 *
 * All return SVG markup strings in the figure's own coordinates. Styling is
 * in css/site.css (.vf-dim, .vf-note) so the fonts follow the site's tokens.
 */

const f = (n) => n.toFixed(1);
const DEG = 180 / Math.PI;

/** Angle at b between a and c, in degrees (0..180). */
export function jointAngle(a, b, c) {
  const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
  const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * DEG;
}

export function angleMark(a, b, c, { r = 34, label } = {}) {
  const a1 = Math.atan2(a[1] - b[1], a[0] - b[0]);
  let d = Math.atan2(c[1] - b[1], c[0] - b[0]) - a1;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  const at = (ang, rad) => [b[0] + rad * Math.cos(ang), b[1] + rad * Math.sin(ang)];
  const p0 = at(a1, r), p1 = at(a1 + d, r);

  let ticks = "";
  const span = Math.abs(d) * DEG;
  for (let k = 0; k <= span + 0.01; k += 10) {
    const ang = a1 + Math.sign(d) * (k / DEG);
    const long = k % 30 === 0;
    const q0 = at(ang, r + 2), q1 = at(ang, r + (long ? 10 : 6));
    ticks += `M${f(q0[0])} ${f(q0[1])}L${f(q1[0])} ${f(q1[1])}`;
  }

  const text = label ?? `${Math.round(jointAngle(a, b, c))}°`;
  const mid = a1 + d / 2;
  const lead0 = at(mid, r + 12), lead1 = at(mid, r + 30);
  // Box centred past the leader's end, pushed out along the bisector.
  const w = 12 + text.length * 9.6, h = 24;
  const cx = lead1[0] + Math.cos(mid) * (w / 2), cy = lead1[1] + Math.sin(mid) * (h / 2);
  return `<g class="vf-dim">
    <path class="vf-dim-arc" d="M${f(p0[0])} ${f(p0[1])}A${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${f(p1[0])} ${f(p1[1])}"/>
    <path class="vf-dim-tick" d="${ticks}"/>
    <path class="vf-dim-lead" d="M${f(lead0[0])} ${f(lead0[1])}L${f(lead1[0])} ${f(lead1[1])}"/>
    <rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${h}"/>
    <text x="${f(cx)}" y="${f(cy + 5.5)}" text-anchor="middle">${text}</text>
  </g>`;
}

export function levelLine(y, x0, x1, label) {
  return `<g class="vf-dim vf-dim-level">
    <path class="vf-dim-ref" d="M${f(x0)} ${f(y)}H${f(x1)}"/>
    ${label ? `<text class="vf-dim-small" x="${f(x1)}" y="${f(y - 7)}" text-anchor="end">${label}</text>` : ""}
  </g>`;
}

/** Dimension from point p to the line a→b (drawn only if it's long enough to read). */
export function offsetMark(p, a, b, label) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len);
  const q = [a[0] + t * dx, a[1] + t * dy];
  const dist = Math.hypot(p[0] - q[0], p[1] - q[1]);
  if (dist < 9) return "";
  const nx = -dy / len * 7, ny = dx / len * 7;                // end ticks run along the line
  const side = p[0] <= q[0] ? -1 : 1;
  return `<g class="vf-dim">
    <path class="vf-dim-lead" d="M${f(q[0])} ${f(q[1])}L${f(p[0])} ${f(p[1])}"/>
    <path class="vf-dim-tick" d="M${f(q[0] - nx)} ${f(q[1] - ny)}L${f(q[0] + nx)} ${f(q[1] + ny)}M${f(p[0] - nx)} ${f(p[1] - ny)}L${f(p[0] + nx)} ${f(p[1] + ny)}"/>
    ${boxedLabel((p[0] + q[0]) / 2 + side * 14, (p[1] + q[1]) / 2, label, side)}
  </g>`;
}

/** A small boxed label whose near edge sits at x (side −1: box to the left). */
function boxedLabel(x, y, text, side) {
  const w = 12 + text.length * 7.4, h = 20, x0 = side < 0 ? x - w : x;
  return `<rect x="${f(x0)}" y="${f(y - h / 2)}" width="${f(w)}" height="${h}"/>
    <text class="vf-dim-small" x="${f(x0 + w / 2)}" y="${f(y + 4)}" text-anchor="middle">${text}</text>`;
}

/* ── Coach's note ──────────────────────────────────────── */

const LINE_H = 25, CHAR_W = 9.6;

/** Break a sentence into lines of about `max` characters. */
export function wrap(text, max = 18) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > max) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

const overlap = (a, b) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Where the note goes: a spot inside the view (corners, or just beside the
 * figure level with the target) that overlaps the figure and anything in
 * `avoid` least, nearest the target on a tie.
 */
function place(box, view, pts, target, avoid = []) {
  const pad = 14, m = 18, reach = 40;             // reach: room for the arrow
  const fx0 = Math.min(...pts.map((p) => p[0])) - pad, fx1 = Math.max(...pts.map((p) => p[0])) + pad;
  const fy0 = Math.min(...pts.map((p) => p[1])) - 30, fy1 = Math.max(...pts.map((p) => p[1])) + pad;
  const fig = { x: fx0, y: fy0, w: fx1 - fx0, h: fy1 - fy0 };
  const xs = [view.x + m, view.x + view.w - box.w - m, fx0 - box.w - reach, fx1 + reach];
  const ys = [view.y + m, view.y + view.h * 0.3, target[1] - box.h / 2, target[1] - box.h - reach];
  let best = null;
  for (const x of xs) for (const y of ys) {
    const here = { x, y, w: box.w, h: box.h };
    const inside = x >= view.x + 4 && y >= view.y + 4 && x + box.w <= view.x + view.w - 4 && y + box.h <= view.y + view.h - 4;
    if (!inside) continue;
    const hits = overlap(here, fig) + avoid.reduce((n, r) => n + overlap(here, r), 0);
    const cost = hits * 10 + Math.hypot(x + box.w / 2 - target[0], y + box.h / 2 - target[1]);
    if (!best || cost < best.cost) best = { x, y, cost };
  }
  return best ?? { x: view.x + m, y: view.y + m };
}

/**
 * opts: view {x,y,w,h} (the SVG viewBox), pts (the figure's points, to keep
 * clear of), avoid (more rects to keep clear of, e.g. a score overlaid on
 * the picture), tone ("good" | "fix"), write (pen it in line by line, then
 * draw the arrow; pass it only when the note is new, or it replays).
 */
export function coachNote(target, text, { view, pts, avoid, tone = "fix", write = false }) {
  const lines = wrap(text);
  const box = { w: Math.max(...lines.map((l) => l.length)) * CHAR_W, h: lines.length * LINE_H };
  const { x, y } = place(box, view, pts, target, avoid);
  const leftSide = x + box.w / 2 < target[0];

  // Arrow from the note's near edge to just short of the target, bowed like
  // a quick pen stroke, with an open arrowhead.
  const s0 = [leftSide ? x + box.w + 6 : x - 6, y + box.h * 0.55];
  const gap = 16, dx = target[0] - s0[0], dy = target[1] - s0[1], dl = Math.hypot(dx, dy) || 1;
  const e = [target[0] - (dx / dl) * gap, target[1] - (dy / dl) * gap];
  const bow = Math.min(60, dl * 0.28) * (leftSide ? -1 : 1);
  const c1 = [(s0[0] + e[0]) / 2 + (-dy / dl) * bow, (s0[1] + e[1]) / 2 + (dx / dl) * bow];
  const ang = Math.atan2(e[1] - c1[1], e[0] - c1[0]);
  const head = (da) => `${f(e[0] - 13 * Math.cos(ang + da))} ${f(e[1] - 13 * Math.sin(ang + da))}`;

  // One <text> per line, so `write` can pen them in one after another
  // (css/marks.css): each line's time scales with its length, then the arrow.
  let at = 0;
  const texts = lines.map((l, i) => {
    const dur = Math.max(0.28, l.length * 0.032), delay = at;
    at += dur + 0.06;
    return `<text x="${f(x)}" y="${f(y + 18 + i * LINE_H)}" transform="rotate(-3 ${f(x)} ${f(y)})" style="--d:${dur.toFixed(2)}s;--t:${delay.toFixed(2)}s">${l}</text>`;
  }).join("");
  return `<g class="vf-note vf-note-${tone}${write ? " vf-note-write" : ""}">
    <path class="vf-note-arrow" pathLength="1" style="--t:${at.toFixed(2)}s" d="M${f(s0[0])} ${f(s0[1])}Q${f(c1[0])} ${f(c1[1])} ${f(e[0])} ${f(e[1])}M${head(0.45)}L${f(e[0])} ${f(e[1])}L${head(-0.45)}"/>
    ${texts}
  </g>`;
}
