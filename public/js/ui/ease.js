/**
 * ease.js — every motion curve in VertexForm, named after the standard
 * easing graphs (easings.net): in / out / inOut × sine, quad, cubic, quart,
 * quint, expo, circ, back. Pick a curve by what the motion does:
 *
 *   outCubic / outQuart   things arriving and settling (most UI)
 *   outExpo               fast arrivals that land softly (reveals, fly-ins)
 *   outBack / outBackSoft lands with an overshoot (pops, stamps; soft for small things)
 *   inCubic / inQuart     things leaving, picking up speed
 *   inOutCubic            travel from A to B (morphs, glides, panels)
 *   inOutSine             gentle back-and-forth (pulses, breathing)
 *   linear                only for constant motion: spinners, timers, live meters
 *
 * CURVE gives the CSS string for the Web Animations API and inline styles;
 * the same curves are CSS custom properties (--ease-out-cubic …) in
 * css/theme.css and css/site.css (tests/ease.test.mjs keeps them equal);
 * ease gives the exact functions for per-frame code. Pure: no DOM.
 */

/** Control points [x1, y1, x2, y2], from easings.net. */
export const BEZIER = {
  inSine: [0.12, 0, 0.39, 0], outSine: [0.61, 1, 0.88, 1], inOutSine: [0.37, 0, 0.63, 1],
  inQuad: [0.11, 0, 0.5, 0], outQuad: [0.5, 1, 0.89, 1], inOutQuad: [0.45, 0, 0.55, 1],
  inCubic: [0.32, 0, 0.67, 0], outCubic: [0.33, 1, 0.68, 1], inOutCubic: [0.65, 0, 0.35, 1],
  inQuart: [0.5, 0, 0.75, 0], outQuart: [0.25, 1, 0.5, 1], inOutQuart: [0.76, 0, 0.24, 1],
  inQuint: [0.64, 0, 0.78, 0], outQuint: [0.22, 1, 0.36, 1], inOutQuint: [0.83, 0, 0.17, 1],
  inExpo: [0.7, 0, 0.84, 0], outExpo: [0.16, 1, 0.3, 1], inOutExpo: [0.87, 0, 0.13, 1],
  inCirc: [0.55, 0, 1, 0.45], outCirc: [0, 0.55, 0.45, 1], inOutCirc: [0.85, 0, 0.15, 1],
  inBack: [0.36, 0, 0.66, -0.56], outBack: [0.34, 1.56, 0.64, 1], inOutBack: [0.68, -0.6, 0.32, 1.6],
  outBackSoft: [0.34, 1.3, 0.64, 1],        // a smaller overshoot, for small things
};

const num = (v) => String(v).replace(/^0\./, ".").replace(/^-0\./, "-.");
/** CSS timing functions: CURVE.outCubic === "cubic-bezier(.33,1,.68,1)". */
export const CURVE = Object.fromEntries(Object.entries(BEZIER).map(([k, v]) => [k, `cubic-bezier(${v.map(num).join(",")})`]));
CURVE.linear = "linear";

/** The CSS custom property for a curve: cssVar("outCubic") === "--ease-out-cubic". */
export const cssVar = (name) => `--ease-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

const c1 = 1.70158, c2 = c1 * 1.525, c3 = c1 + 1, s1 = 1.2, s3 = s1 + 1;
/** The exact curves as functions of t in 0..1 (easings.net formulas). */
export const ease = {
  linear: (t) => t,
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inQuart: (t) => t ** 4,
  outQuart: (t) => 1 - (1 - t) ** 4,
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  inQuint: (t) => t ** 5,
  outQuint: (t) => 1 - (1 - t) ** 5,
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
  inExpo: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOutExpo: (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  inCirc: (t) => 1 - Math.sqrt(1 - t * t),
  outCirc: (t) => Math.sqrt(1 - (t - 1) ** 2),
  inOutCirc: (t) => (t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2),
  inBack: (t) => c3 * t ** 3 - c1 * t * t,
  outBack: (t) => 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2,
  inOutBack: (t) => (t < 0.5 ? ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2 : ((2 * t - 2) ** 2 * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2),
  outBackSoft: (t) => 1 + s3 * (t - 1) ** 3 + s1 * (t - 1) ** 2,
};

/** The block of CSS custom properties, for the stylesheets (and the test). */
export const cssBlock = () => Object.keys(BEZIER).map((k) => `  ${cssVar(k)}: ${CURVE[k]};`).join("\n");
