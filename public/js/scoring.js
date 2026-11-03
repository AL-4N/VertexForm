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

/** Pike push-up: depth is the elbow (head toward the floor); "hips" is how
 *  well the hips stay piked high (the shoulder–hip–ankle angle; ~90° is a
 *  good pike, 135° has dropped toward a plain push-up). */
export function scorePike(elbow, hip) {
  const depth = elbow <= 95 ? 100 : Math.max(0, 100 - (elbow - 95) * 1.8);
  const hips  = hip   <= 105 ? 100 : Math.max(0, 100 - (hip - 105) * 2.2);
  return { depth, hips };
}

/** Hollow hold: 135–160° at the hip is the hollow; flatter is the easy
 *  version (legs and shoulders sinking), sharper is a jackknife. */
export function scoreHollow(hip) {
  return hip > 160 ? Math.max(0, 100 - (hip - 160) * 4) : hip < 135 ? Math.max(0, 100 - (135 - hip) * 3) : 100;
}

/** Mountain climber: knee drive (the near hip's angle at the deepest point)
 *  and how far the hips break from the shoulder–back-ankle line. */
export function scoreClimber(hip, lineBreak) {
  const drive = hip <= 80 ? 100 : Math.max(0, 100 - (hip - 80) * 2);
  const line = Math.abs(lineBreak) <= 8 ? 100 : Math.max(0, 100 - (Math.abs(lineBreak) - 8) * 5);   // like the push-up's body line
  return { drive, line };
}

/** Bulgarian split squat: the front knee to about 90° (a little deeper is
 *  fine with the back foot up) and an upright torso, allowing a slight lean. */
export function scoreSplitSquat(knee, lean) {
  const depth = knee >= 75 && knee <= 100 ? 100 : Math.max(0, 100 - Math.min(Math.abs(knee - 75), Math.abs(knee - 100)) * 2.8);
  const posture = lean <= 20 ? 100 : Math.max(0, 100 - (lean - 20) * 3);
  return { depth, posture };
}

/** Pistol squat: depth like a squat (hip to knee height) and the free foot
 *  kept clear of the floor (lift: its height in leg lengths). */
export function scorePistol(depth, lift) {
  const d = depth <= 0 ? 100 : Math.max(0, 100 - depth * 1.5);
  const freeLeg = lift >= 0.15 ? 100 : Math.max(0, (lift / 0.15) * 100);
  return { depth: d, freeLeg };
}

/** Dips: elbow to 90° or below at the bottom (shoulders level with the elbows). */
export function scoreDip(elbow) {
  return { depth: elbow <= 92 ? 100 : Math.max(0, 100 - (elbow - 92) * 1.8), lockout: null };
}

/** Pull-up: the chin clears the bar (chin height over the wrists, in torso
 *  lengths; 0 = level) and the arms bend properly at the top. */
export function scorePullup(chin, elbow) {
  const top = chin >= 0.02 ? 100 : Math.max(0, 100 - (0.02 - chin) * 330);
  const pull = elbow <= 95 ? 100 : Math.max(0, 100 - (elbow - 95) * 2);
  return { top, pull };
}

/** Negative pull-up: the lowering. 3 s or more is full marks; a drop in a
 *  second is an F. */
export const scoreLowering = (s) => (s >= 3 ? 100 : Math.max(0, 100 - (3 - s) * 35));

/** Australian row: the chest up to the bar (elbow bent at the top) and the
 *  body kept in one line, like a push-up's. */
export function scoreRow(elbow, bendOff) {
  const pull = elbow <= 90 ? 100 : Math.max(0, 100 - (elbow - 90) * 2);
  const line = bendOff <= 8 ? 100 : Math.max(0, 100 - (bendOff - 8) * 5);
  return { pull, line };
}

/** L-sit: legs held at hip height (lift: the feet's height over the hips, in
 *  leg lengths; level is 0) and straight (the knee). */
export function scoreLSit(hipAngle, lift, knee) {
  const legs = lift >= -0.04 ? 100 : Math.max(0, 100 - (-0.04 - lift) * 520);
  const straight = knee >= 165 ? 100 : Math.max(0, 100 - (165 - knee) * 3);
  return { legs, straight };
}

/** V-sit: the feet raised well above the hips (lift a third of a leg length
 *  or more). Measured by the feet, not the hip angle: leaning back alone
 *  closes the angle without lifting the legs. */
export function scoreVSit(hipAngle, lift, knee) {
  const legs = lift >= 0.33 ? 100 : Math.max(0, 100 - (0.33 - lift) * 200);
  const straight = knee >= 165 ? 100 : Math.max(0, 100 - (165 - knee) * 3);
  return { legs, straight };
}

/** Dead hang: straight arms (the more bent elbow). */
export const scoreHang = (elbow) => (elbow >= 165 ? 100 : Math.max(0, 100 - (165 - elbow) * 3));

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
