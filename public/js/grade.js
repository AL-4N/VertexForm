/**
 * grade.js — the VertexForm grading gradient.
 *
 * One scale, used everywhere a score is shown: the live skeleton, rep chips,
 * results, stats, and the brand itself. F is coral, A is green, and every
 * score in between gets its exact colour on that line.
 */

export const GRADE_STOPS = [
  [0,   "#ff4d6d"],   // F
  [55,  "#ff7a45"],
  [70,  "#ffbe3d"],   // C
  [85,  "#c6ef4e"],   // B
  [100, "#2ee59d"],   // A
];

/** CSS linear-gradient of the full scale, left (F) to right (A). */
export const GRADE_GRADIENT =
  `linear-gradient(90deg, ${GRADE_STOPS.map(([s, c]) => `${c} ${s}%`).join(", ")})`;

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (rgb) =>
  "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Exact colour for a 0..100 score, interpolated along the scale. */
export function gradeColor(score) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  for (let i = 1; i < GRADE_STOPS.length; i++) {
    const [s1, c1] = GRADE_STOPS[i];
    const [s0, c0] = GRADE_STOPS[i - 1];
    if (s <= s1) {
      const t = (s - s0) / (s1 - s0 || 1);
      const a = hexToRgb(c0), b = hexToRgb(c1);
      return rgbToHex(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return GRADE_STOPS[GRADE_STOPS.length - 1][1];
}

/**
 * Letter grade. `plus: true` adds "A+" for 95 and up (the trainer's top
 * target); the website keeps plain letters.
 */
export const gradeLetter = (s, { plus = false } = {}) =>
  plus && s >= 95 ? "A+" : s >= 90 ? "A" : s >= 80 ? "B" : s >= 70 ? "C" : s >= 60 ? "D" : "F";
