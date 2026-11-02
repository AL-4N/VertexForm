/** dips.js — dips on parallel bars. Side-on; reps by the elbow (straight at
 *  the top, about 90° at the bottom). The bars aren't tracked: hands below the
 *  shoulders and near the hips stand in for them. */
import { LM } from "../config.js";
import { angleBetween, leanFromVertical } from "../geometry.js";
import { scoreDip } from "../scoring.js";
import { rankFaults, POSITION_CUES } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default {
  name: "Dips",
  repMetric: (m) => m.elbow,
  deepThreshold: 110,
  shallowThreshold: 145,
  minDeepTime: 0.12,
  repSeconds: [0.4, 10],
  bottomBand: 8,
  attemptMin: 12,
  startTip: POSITION_CUES["Dips"],
  fixes: { depth: (m) => ({ ...m, elbow: Math.min(m.elbow, 88) }) },
  trend: { key: "elbow", worse: +1, by: 8 },
  /** On the bars: torso upright-ish, hands below the shoulders and up near the hips. */
  posture: (m) => Math.min(clamp01((55 - m.lean) / 15), m.handsOnBars),
  guide: null,

  measure(lms, side) {
    const sh = P(lms, side, "SHOULDER"), hip = P(lms, side, "HIP"), wr = P(lms, side, "WRIST");
    const torso = Math.hypot(sh.x - hip.x, sh.y - hip.y) || 1e-6;
    // Hands between the shoulders and a little below the hips = pressing on bars.
    const handsOnBars = wr.y > sh.y && wr.y < hip.y + 0.25 * torso ? 1 : 0;
    return {
      elbow: angleBetween(sh, P(lms, side, "ELBOW"), wr),
      lean: leanFromVertical(sh, hip),
      handsOnBars,
      hipY: hip.y,
    };
  },

  grade(m) {
    const { depth } = scoreDip(m.elbow);
    return {
      score: Math.round(depth),
      bars: [{ label: "Depth", value: depth }],
      stats: [{ label: "Elbow at the bottom", value: `${m.elbow.toFixed(0)}°` }],
    };
  },

  detectFaults(m) {
    const found = [];
    if (m.elbow > 100) found.push(["depth", m.elbow > 118 ? 3 : 2]);
    if (m.duration && m.duration < 0.8) found.push(["tempo", 1]);
    return rankFaults("Dips", found);
  },
};
