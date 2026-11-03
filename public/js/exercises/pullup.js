/** pullup.js — pull-ups, facing the camera. Reps by the elbows (straight in
 *  the hang, bent at the top); the bar isn't tracked, so the wrists stand in
 *  for it and the chin has to clear them. The negative pull-up reuses this
 *  and grades the lowering instead (negative.js). */
import { LM } from "../config.js";
import { angleBetween } from "../geometry.js";
import { scorePullup, combine } from "../scoring.js";
import { rankFaults, POSITION_CUES } from "../coaching.js";

const L = (lms, n) => lms[LM[`LEFT_${n}`]], R = (lms, n) => lms[LM[`RIGHT_${n}`]];

/** Shared by pull-ups and negatives: the more bent elbow, and how far the
 *  chin is over the wrists' line (in torso lengths; + = over). */
export function measurePull(lms) {
  const elbow = Math.min(angleBetween(L(lms, "SHOULDER"), L(lms, "ELBOW"), L(lms, "WRIST")), angleBetween(R(lms, "SHOULDER"), R(lms, "ELBOW"), R(lms, "WRIST")));
  const nose = lms[LM.NOSE], mouthY = (lms[9].y + lms[10].y) / 2;
  const chinY = mouthY + (mouthY - nose.y);             // the chin sits about as far below the mouth as the mouth is below the nose
  const wristY = Math.min(L(lms, "WRIST").y, R(lms, "WRIST").y);
  const shY = (L(lms, "SHOULDER").y + R(lms, "SHOULDER").y) / 2, hipY = (L(lms, "HIP").y + R(lms, "HIP").y) / 2;
  const torso = Math.abs(hipY - shY) || 1e-6;
  return {
    elbow,
    chin: (wristY - chinY) / torso,
    wristsUp: L(lms, "WRIST").y < L(lms, "SHOULDER").y && R(lms, "WRIST").y < R(lms, "SHOULDER").y,   // above the shoulders (at the top the face is above the hands)
    hipY,
    sway: (L(lms, "HIP").x + R(lms, "HIP").x) / 2,
  };
}

export default {
  name: "Pull-up",
  frontFacing: true,
  repMetric: (m) => m.elbow,
  deepThreshold: 100,
  shallowThreshold: 145,
  minDeepTime: 0.1,
  repSeconds: [0.6, 12],
  bottomBand: 8,
  attemptMin: 15,
  startTip: POSITION_CUES["Pull-up"],
  fixes: { halfRep: (m) => ({ ...m, chin: Math.max(m.chin, 0.05), elbow: Math.min(m.elbow, 80) }) },
  trend: { key: "elbow", worse: +1, by: 8 },
  /** Hanging from a bar: both hands above the shoulders. */
  posture: (m) => (m.wristsUp ? 1 : 0),
  floor: false,
  guide: null,

  measure: measurePull,

  grade(m) {
    const { top, pull } = scorePullup(m.chin, m.elbow);
    return {
      score: combine([[top, 0.7], [pull, 0.3]]),
      bars: [
        { label: "Chin over the bar", value: top },
        { label: "Arms bent",         value: pull },
      ],
      stats: [
        { label: "Elbows at the top", value: `${m.elbow.toFixed(0)}°` },
        { label: "Chin", value: m.chin >= 0 ? "over the bar" : "under the bar" },
      ],
    };
  },

  detectFaults(m) {
    const found = [];
    if (m.chin < 0) found.push(["halfRep", 3]);
    return rankFaults("Pull-up", found);
  },
};
