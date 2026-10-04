/**
 * scoring.js — calibrated scoring curves.
 *
 * These are the SAME functions used by live practice and by set analysis,
 * so the two modes can never disagree.
 *
 * Calibration targets (verified against synthetic geometry):
 *   perfect parallel squat, 20° lean .......... 98-100
 *   deep + upright (textbook) ................. 98-100
 *   half squat ................................ ~75
 *   quarter squat ............................. ~53
 *   parallel but folded over 45° .............. ~82
 *   standing straight in lunge mode ........... ~45
 *
 * Each curve has a "grace band" of full marks, then a linear fall-off.
 */

/**
 * @param depthDeg thigh angle above parallel (0 = parallel, negative = deeper)
 * @param lean     torso degrees from vertical (real squats lean 15-30°)
 */
export function scoreSquat(depthDeg, lean) {
  const depth = depthDeg <= 6 ? 100 : Math.max(0, 100 - (depthDeg - 6) * 2.4);
  const posture =
    lean <= 27 ? 100 :
    lean <= 42 ? 100 - (lean - 27) * 2.5 :
                 Math.max(0, 62.5 - (lean - 42) * 3.5);
  return { depth, posture };
}

export function scorePushup(elbow, bodyLine) {
  const depth    = elbow    <= 92 ? 100 : Math.max(0, 100 - (elbow - 92) * 1.8);
  const straight = bodyLine <= 9  ? 100 : Math.max(0, 100 - (bodyLine - 9) * 5.5);
  return { depth, straight };
}

export function scorePlank(sag) {
  const a = Math.abs(sag);
  return a < 0.022 ? 100 : Math.max(0, 100 - (a - 0.022) * 550);
}

export function scoreLunge(knee, lean) {
  const depth = (knee >= 80 && knee <= 102)
    ? 100
    : Math.max(0, 100 - Math.min(Math.abs(knee - 80), Math.abs(knee - 102)) * 2.2);
  const posture = lean <= 16 ? 100 : Math.max(0, 100 - (lean - 16) * 3.2);
  return { depth, posture };
}

export function scoreJack(peakExtension) {
  return peakExtension > 0.18 ? 100 : Math.max(0, (peakExtension / 0.18) * 100);
}

/** Steadiness at the bottom of a rep — bouncing scores low. */
export function scoreControl(series) {
  if (series.length < 2) return 100;
  const m = series.reduce((a, b) => a + b, 0) / series.length;
  const sd = Math.sqrt(series.reduce((a, v) => a + (v - m) ** 2, 0) / series.length);
  return Math.max(0, 100 - sd * 1100);
}

/** Weighted blend helper: combine([[value, weight], ...]) → 0..100 */
export function combine(pairs) {
  const total = pairs.reduce((a, [, w]) => a + w, 0) || 1;
  return Math.round(pairs.reduce((a, [v, w]) => a + v * w, 0) / total);
}
