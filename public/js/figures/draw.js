/**
 * draw.js — turns a posed skeleton (from rig.build) into SVG markup.
 *
 * Everything is styled inline so the same figure works on the marketing site,
 * in the app, and in exported images without any CSS. The hero demo has its
 * own optimised renderer (site/stage.js); everything else uses this one.
 */

import { GROUND } from "./poses.js";

export const P = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const f = (n) => n.toFixed(1);

/** Bounding box around a skeleton, with padding, always including the floor. */
export function bounds(s, pad = 30) {
  const pts = Object.values(s).filter(Array.isArray);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
  const y0 = Math.min(...ys) - pad - 19, y1 = Math.max(GROUND + 12, Math.max(...ys) + pad);
  return { x0, y0, w: x1 - x0, h: y1 - y0, x1, y1 };
}

/** SVG arc of radius r at joint b, swept from a toward c. */
export function arcPath(a, b, c, r = 30) {
  const a1 = Math.atan2(a[1] - b[1], a[0] - b[0]);
  const a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let d = a2 - a1;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  return {
    d: `M${f(b[0] + r * Math.cos(a1))} ${f(b[1] + r * Math.sin(a1))} ` +
       `A${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${f(b[0] + r * Math.cos(a2))} ${f(b[1] + r * Math.sin(a2))}`,
    // A point just outside the arc's middle, for a label.
    mid: [b[0] + (r + 26) * Math.cos(a1 + d / 2), b[1] + (r + 26) * Math.sin(a1 + d / 2)],
  };
}

/** The joints the trainer tracks, as dots (used to illustrate "it finds you"). */
export function keypoints(s) {
  const base = s.front
    ? [s.shN, s.shF, s.elbN, s.elbF, s.wriN, s.wriF, s.hpN, s.hpF, s.kneeN, s.kneeF, s.ankN, s.ankF, s.toeN, s.toeF]
    : [s.neck, s.elbN, s.wriN, s.elbF, s.wriF, s.hip, s.kneeN, s.ankN, s.toeN, s.kneeF, s.ankF, s.toeF];
  // A few face points around the head.
  const h = s.head;
  return [...base, [h[0] - 7, h[1] - 4], [h[0] + 7, h[1] - 4], [h[0], h[1] + 4], [h[0] - 12, h[1] + 2], [h[0] + 12, h[1] + 2]];
}

/**
 * Figure markup (no <svg> wrapper).
 * opts: color, width, headFill, joints (bool), arc ([a,b,c]), arcLabel,
 *       guide ([p1,p2]), floor ({x0,x1}), farOpacity
 */
export function figureMarkup(s, opts = {}) {
  const c = opts.color ?? "#2ee59d";
  const w = opts.width ?? 7;
  const far = opts.farOpacity ?? 0.38;
  const line = (arr, extra = "") =>
    `<polyline points="${arr.map(P).join(" ")}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

  let out = "";
  if (opts.floor) {
    out += `<line x1="${f(opts.floor.x0)}" y1="${GROUND}" x2="${f(opts.floor.x1)}" y2="${GROUND}" stroke="${opts.floorColor ?? "#2e3a63"}" stroke-width="2"/>`;
  }
  if (opts.guide) {
    const [a, b] = opts.guide;
    out += `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${opts.guideColor ?? "#2ee59d"}" stroke-width="2.5" stroke-dasharray="7 8" opacity=".6"/>`;
  }

  if (s.front) {
    out += line([s.hpF, s.kneeF, s.ankF, s.toeF]) + line([s.hpN, s.kneeN, s.ankN, s.toeN]);
    out += line([s.shF, s.elbF, s.wriF]) + line([s.shN, s.elbN, s.wriN]);
    out += line([s.shN, s.shF]) + line([s.hpN, s.hpF, s.hip, s.neck]);
  } else {
    out += `<g opacity="${far}">${line([s.hip, s.kneeF, s.ankF, s.toeF])}${line([s.neck, s.elbF, s.wriF])}</g>`;
    out += line([s.hip, s.neck]) + line([s.hip, s.kneeN, s.ankN, s.toeN]) + line([s.neck, s.elbN, s.wriN]);
  }
  out += `<circle cx="${f(s.head[0])}" cy="${f(s.head[1])}" r="19" fill="${opts.headFill ?? "#0d1326"}" stroke="${c}" stroke-width="${w * 0.86}"/>`;

  if (opts.joints) {
    const pts = keypoints(s), r = opts.jointR ?? 5.5;
    // The last five points are on the face: draw those smaller.
    out += pts.map((p, i) => `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${i >= pts.length - 5 ? r * 0.45 : r}" fill="${opts.jointColor ?? "#fff"}"/>`).join("");
  }
  if (opts.arc) {
    const [a, b, cc] = opts.arc;
    const { d, mid } = arcPath(a, b, cc, opts.arcR ?? 30);
    out += `<path d="${d}" fill="none" stroke="#fff" stroke-width="2.5" opacity=".85"/>`;
    if (opts.arcLabel) {
      out += `<text x="${f(mid[0])}" y="${f(mid[1] + 7)}" text-anchor="middle" font-family="Unbounded, system-ui, sans-serif" font-weight="700" font-size="21" fill="#fff">${opts.arcLabel}</text>`;
    }
  }
  return out;
}

/** A complete standalone <svg> for a skeleton, auto-fitted. */
export function figureSVG(s, opts = {}) {
  const b = opts.box ?? bounds(s, opts.pad ?? 30);
  const inner = figureMarkup(s, { floor: { x0: b.x0, x1: b.x1 }, ...opts });
  const label = opts.label ? ` role="img" aria-label="${opts.label}"` : ` aria-hidden="true"`;
  return `<svg viewBox="${f(b.x0)} ${f(b.y0)} ${f(b.w)} ${f(b.h)}"${label}>${inner}${opts.extra ?? ""}</svg>`;
}
