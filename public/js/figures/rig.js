/**
 * rig.js — a 2D stick-figure rig for the marketing site.
 *
 * A pose is described by WHERE THINGS ARE PLANTED, not by every joint:
 *   - hip position and torso angle
 *   - ankle targets (and, for push-ups/planks, hand targets)
 * Knees and elbows are then solved with two-bone inverse kinematics. That
 * keeps limb lengths rigid and keeps planted feet and hands from sliding while
 * the figure moves — the two things that make a stick figure look wrong.
 *
 * Angles are absolute, in degrees, in SVG space: 0 = right, 90 = down.
 */

export const SEG = {
  torso: 132, neck: 40, head: 19,
  thigh: 112, shin: 106, foot: 28,
  upper: 58, fore: 54,
  shoulderHalf: 22, hipHalf: 13,   // front-view widths
};

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const add = (p, len, angDeg) => [p[0] + len * Math.cos(rad(angDeg)), p[1] + len * Math.sin(rad(angDeg))];

/**
 * Two-bone IK. Returns the middle joint (knee/elbow).
 * bend = -1 or +1 picks which side the joint folds toward.
 * Targets out of reach are approached as far as the limb allows.
 */
export function solveIK(root, target, L1, L2, bend) {
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const d = Math.max(Math.abs(L1 - L2) + 1e-3, Math.min(L1 + L2 - 1e-3, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  return add(root, L1, deg(base + bend * a));
}

/** End point actually reached by a two-bone limb (equals target when reachable). */
function reach(joint, target, L2) {
  const ang = deg(Math.atan2(target[1] - joint[1], target[0] - joint[0]));
  return add(joint, L2, ang);
}

/* ── Interpolation ─────────────────────────────────────── */

const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => {
  let d = ((b - a + 540) % 360) - 180;          // shortest way round
  return a + d * t;
};

/** Blend two pose descriptions. Angle fields interpolate the short way. */
export function blend(A, B, t) {
  const out = {};
  for (const k of Object.keys(A)) {
    const a = A[k], b = B[k];
    if (Array.isArray(a)) out[k] = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    else if (typeof a === "number") out[k] = k.startsWith("ang") ? lerpAngle(a, b, t) : lerp(a, b, t);
    else out[k] = a;
  }
  return out;
}

/* ── Build a full skeleton from a pose description ───────────
   Pose fields (side view):
     hip, angTorso, angHead,
     ankleN, ankleF, angFootN, angFootF, bendKneeN, bendKneeF,
     arms: "fk" -> angUpperN, angForeN, angUpperF, angForeF
           "ik" -> handN, handF, bendElbowN, bendElbowF
     view: "side" | "front"                                       */
export function build(p) {
  const front = p.view === "front";
  const hip = p.hip;
  const neck = add(hip, SEG.torso, p.angTorso);
  const head = add(neck, SEG.neck, p.angHead);

  // Front view spreads shoulders and hips; side view stacks them.
  const shN = front ? [neck[0] - SEG.shoulderHalf, neck[1]] : neck;
  const shF = front ? [neck[0] + SEG.shoulderHalf, neck[1]] : neck;
  const hpN = front ? [hip[0] - SEG.hipHalf, hip[1]] : hip;
  const hpF = front ? [hip[0] + SEG.hipHalf, hip[1]] : hip;

  const kneeN = solveIK(hpN, p.ankleN, SEG.thigh, SEG.shin, p.bendKneeN ?? -1);
  const kneeF = solveIK(hpF, p.ankleF, SEG.thigh, SEG.shin, p.bendKneeF ?? -1);
  const ankN = reach(kneeN, p.ankleN, SEG.shin);
  const ankF = reach(kneeF, p.ankleF, SEG.shin);
  const toeN = add(ankN, SEG.foot, p.angFootN);
  const toeF = add(ankF, SEG.foot, p.angFootF);

  let elbN, elbF, wriN, wriF;
  if (p.arms === "ik") {
    elbN = solveIK(shN, p.handN, SEG.upper, SEG.fore, p.bendElbowN ?? 1);
    elbF = solveIK(shF, p.handF, SEG.upper, SEG.fore, p.bendElbowF ?? 1);
    wriN = reach(elbN, p.handN, SEG.fore);
    wriF = reach(elbF, p.handF, SEG.fore);
  } else {
    elbN = add(shN, SEG.upper, p.angUpperN);
    elbF = add(shF, SEG.upper, p.angUpperF);
    wriN = add(elbN, SEG.fore, p.angForeN);
    wriF = add(elbF, SEG.fore, p.angForeF);
  }

  return {
    front, hip, neck, head, shN, shF, hpN, hpF,
    kneeN, kneeF, ankN, ankF, toeN, toeF,
    elbN, elbF, wriN, wriF,
  };
}

/* ── Measurements in rig space ─────────────────────────── */

export function angleAt(a, b, c) {
  const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
  const m = Math.hypot(...v1) * Math.hypot(...v2) || 1;
  return deg(Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / m))));
}

/** Thigh vs the ground: 0 = parallel, + = hip above knee, − = below. */
export function thighDepth(hip, knee) {
  return deg(Math.atan2(knee[1] - hip[1], Math.abs(knee[0] - hip[0]) || 1e-6));
}

/** Torso lean from vertical. */
export function leanFromVertical(top, bottom) {
  return deg(Math.atan2(Math.abs(top[0] - bottom[0]), Math.abs(top[1] - bottom[1]) || 1e-6));
}

/** Signed distance of the hip below the shoulder→ankle line (+ = sagging). */
export function hipSag(shoulder, hip, ankle) {
  const ax = ankle[0] - shoulder[0], ay = ankle[1] - shoulder[1];
  const t = ((hip[0] - shoulder[0]) * ax + (hip[1] - shoulder[1]) * ay) / (ax * ax + ay * ay || 1);
  return hip[1] - (shoulder[1] + t * ay);
}
