/** lunge.js — lunge uses the FRONT leg (lower ankle in frame). */

import { LM } from "../config.js";
import { angleBetween, leanFromVertical, kneeTravel } from "../geometry.js";
import { scoreLunge, combine } from "../scoring.js";
import { rankFaults } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];

/** The planted front foot reads lower in frame when you're side-on. */
export function frontSide(lms) {
  return lms[LM.LEFT_ANKLE].y >= lms[LM.RIGHT_ANKLE].y ? "LEFT" : "RIGHT";
}

export default {
  name: "Lunge",
  pickSide: frontSide,
  repMetric: (m) => m.knee,
  deepThreshold: 125,
  shallowThreshold: 155,
  minDeepTime: 0.3,
  repSeconds: [0.5, 12],
  bottomBand: 8,
  attemptMin: 12,
  startTip: "Stand tall, side-on, to start",
  fixes: {
    shallow: (m) => ({ ...m, knee: 92 }),
    tooDeep: (m) => ({ ...m, knee: 92 }),
    lean:    (m) => ({ ...m, lean: Math.min(m.lean, 10) }),
  },
  trend: { key: "knee", worse: +1, by: 8 },
  posture: (m) => Math.max(0, Math.min(1, (62 - m.lean) / 15)),
  guide: "lunge",

  measure(lms, side) {
    return {
      knee: angleBetween(P(lms, side, "HIP"), P(lms, side, "KNEE"), P(lms, side, "ANKLE")),
      lean: leanFromVertical(P(lms, side, "SHOULDER"), P(lms, side, "HIP")),
      kneeTravel: kneeTravel(lms, side),
      hipY: P(lms, side, "HIP").y,
    };
  },

  grade(m) {
    const { depth, posture } = scoreLunge(m.knee, m.lean);
    const score = combine([[depth, 0.55], [posture, 0.45]]);
    return {
      score,
      bars: [
        { label: "Front knee", value: depth },
        { label: "Posture",    value: posture },
      ],
      stats: [
        { label: "Front knee", value: `${m.knee.toFixed(0)}°` },
        { label: "Torso lean", value: `${m.lean.toFixed(0)}°` },
      ],
    };
  },

  detectFaults(m) {
    const found = [];
    if (m.knee > 108)      found.push(["shallow", m.knee > 125 ? 3 : 2]);
    else if (m.knee < 72)  found.push(["tooDeep", 1]);
    if (m.lean > 24)       found.push(["lean", 2]);
    if (m.kneeTravel > 0.60) found.push(["kneeTravel", 2]);
    return rankFaults("Lunge", found);
  },
};
