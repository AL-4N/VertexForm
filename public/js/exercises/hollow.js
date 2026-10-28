/** hollow.js — hollow hold: a HOLD lying on your back, shoulders and legs
 *  lifted off the floor, the body a shallow banana. Side-on. In position
 *  only while both ends are up; graded on the body's shape (the hip angle). */
import { LM } from "../config.js";
import { angleBetween, lineFromHorizontal, relativeSag } from "../geometry.js";
import { scoreHollow } from "../scoring.js";
import { rankFaults } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default {
  name: "Hollow hold",
  isHold: true,
  /** Lying (the shoulder-to-ankle line near level) with both ends lifted. */
  inPosition: (m) => m.incline < 35 && m.shLift > 0.12 && m.legLift > 0.12,
  positionText: "Lie on your back, side-on, then lift your shoulders and legs",
  posture: (m) => clamp01((50 - m.incline) / 15),
  floor: true,
  guide: null,
  fixes: {},
  repMetric: () => 0, deepThreshold: 0, shallowThreshold: 0,

  measure(lms, side) {
    const sh = P(lms, side, "SHOULDER"), hip = P(lms, side, "HIP"), ank = P(lms, side, "ANKLE");
    const torso = Math.hypot(sh.x - hip.x, sh.y - hip.y) || 1e-6, leg = Math.hypot(ank.x - hip.x, ank.y - hip.y) || 1e-6;
    return {
      hip: angleBetween(sh, hip, ank),
      shLift: (hip.y - sh.y) / torso,          // how far the shoulders are off the floor, in torso lengths
      legLift: (hip.y - ank.y) / leg,          // the same for the feet, in leg lengths
      incline: lineFromHorizontal(sh, ank),
      hipY: hip.y,
    };
  },
  grade(m) {
    const shape = scoreHollow(m.hip);
    return {
      score: Math.round(shape),
      bars: [{ label: "Body shape", value: shape }],
      stats: [
        { label: "Hip angle", value: `${m.hip.toFixed(0)}°` },
        { label: "Shape", value: m.hip > 160 ? "too flat" : m.hip < 135 ? "folded" : "hollow" },
      ],
    };
  },
  detectFaults(m) {
    return rankFaults("Hollow hold", m.drift > 0.02 ? [["drift", 1]] : []);
  },
};
