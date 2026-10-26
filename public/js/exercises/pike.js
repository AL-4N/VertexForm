/** pike.js — pike push-up: hips high in an upside-down V, head lowers toward the floor. */

import { LM } from "../config.js";
import { angleBetween, lineFromHorizontal } from "../geometry.js";
import { scorePike, combine } from "../scoring.js";
import { rankFaults } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default {
  name: "Pike push-up",
  repMetric: (m) => m.elbow,
  deepThreshold: 110,
  shallowThreshold: 150,
  minDeepTime: 0.15,
  repSeconds: [0.4, 10],
  bottomBand: 8,
  attemptMin: 12,
  startTip: "Hands and feet on the floor, hips high, side-on",
  fixes: {
    depth:   (m) => ({ ...m, elbow: Math.min(m.elbow, 90) }),
    hipsLow: (m) => ({ ...m, hip: Math.min(m.hip, 95) }),
  },
  trend: { key: "elbow", worse: +1, by: 8 },
  /** In position: roughly horizontal shoulder-to-ankle line AND the hips
   *  folded (a plain push-up, hips straight, isn't a pike). */
  posture: (m) => Math.min(clamp01((60 - m.incline) / 15), clamp01((150 - m.hip) / 20)),
  floor: true,
  guide: null,                       // no ideal-line guide: better none than a wrong one

  measure(lms, side) {
    return {
      elbow: angleBetween(P(lms, side, "SHOULDER"), P(lms, side, "ELBOW"), P(lms, side, "WRIST")),
      hip: angleBetween(P(lms, side, "SHOULDER"), P(lms, side, "HIP"), P(lms, side, "ANKLE")),
      hipY: P(lms, side, "HIP").y,
      incline: lineFromHorizontal(P(lms, side, "SHOULDER"), P(lms, side, "ANKLE")),
    };
  },

  grade(m) {
    const { depth, hips } = scorePike(m.elbow, m.hip);
    return {
      score: combine([[depth, 0.6], [hips, 0.4]]),
      bars: [
        { label: "Depth",     value: depth },
        { label: "Hips high", value: hips },
      ],
      stats: [
        { label: "Elbow at bottom", value: `${m.elbow.toFixed(0)}°` },
        { label: "Hip angle",       value: `${m.hip.toFixed(0)}°` },
      ],
    };
  },

  detectFaults(m) {
    const found = [];
    if (m.elbow > 100) found.push(["depth", m.elbow > 120 ? 3 : 2]);
    if (m.hip > 115)   found.push(["hipsLow", 3]);
    if (m.duration && m.duration < 0.9) found.push(["tempo", 1]);
    return rankFaults("Pike push-up", found);
  },
};
