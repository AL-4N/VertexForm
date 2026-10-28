/** sideplank.js — side plank: a HOLD on one forearm, hips up in one line.
 *  Facing the camera, the body is a diagonal line in the picture, the same
 *  geometry the plank grades (and the shoulders stack, so the facing check
 *  reads it as side-on). */
import { LM } from "../config.js";
import { angleBetween, lineFromHorizontal, relativeSag } from "../geometry.js";
import { rankFaults, POSITION_CUES } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
import { scorePlank } from "../scoring.js";

export default {
  name: "Side plank",
  isHold: true,
  inPosition: (m) => m.incline < 40,
  positionTip: POSITION_CUES["Side plank"],
  posture: (m) => clamp01((55 - m.incline) / 15),
  floor: true,
  guide: "line",
  fixes: { sag: (m) => ({ ...m, sag: 0 }), pike: (m) => ({ ...m, sag: 0 }) },
  repMetric: () => 0, deepThreshold: 0, shallowThreshold: 0,

  measure(lms, side) {
    return {
      sag: relativeSag(lms, side),
      bodyLine: 180 - angleBetween(P(lms, side, "SHOULDER"), P(lms, side, "HIP"), P(lms, side, "ANKLE")),
      incline: lineFromHorizontal(P(lms, side, "SHOULDER"), P(lms, side, "ANKLE")),
      hipY: P(lms, side, "HIP").y,
    };
  },
  grade(m) {
    const straight = scorePlank(m.sag);
    return {
      score: Math.round(straight),
      bars: [{ label: "Hips in line", value: straight }],
      stats: [
        { label: "Hips", value: m.sag > 0.03 ? "dropping" : m.sag < -0.03 ? "too high" : "in line" },
        { label: "Body line", value: m.bodyLine < 4 ? "straight" : `${m.bodyLine.toFixed(0)}° bend` },
      ],
    };
  },
  detectFaults(m) {
    const found = [];
    if (m.sag > 0.035) found.push(["sag", 3]);
    else if (m.sag < -0.035) found.push(["pike", 2]);
    if (m.drift > 0.02) found.push(["drift", 1]);
    return rankFaults("Side plank", found);
  },
};
