/** hang.js — dead hang: a HOLD hanging from a bar, arms straight, body
 *  still. Facing the camera. The bar isn't tracked: the wrists stand in for
 *  it (both above the head). Steadiness watches the hips swinging sideways. */
import { LM } from "../config.js";
import { angleBetween, lineFromHorizontal, relativeSag } from "../geometry.js";
import { scoreHang } from "../scoring.js";
import { rankFaults } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default {
  name: "Dead hang",
  isHold: true,
  frontFacing: true,
  inPosition: (m) => m.wristsUp && m.elbow > 140,
  positionText: "Hang from a bar facing the camera, arms straight",
  posture: (m) => (m.wristsUp ? 1 : 0),
  floor: false,
  guide: null,
  fixes: {},
  repMetric: () => 0, deepThreshold: 0, shallowThreshold: 0,

  measure(lms) {
    const L = (n) => lms[LM[`LEFT_${n}`]], R = (n) => lms[LM[`RIGHT_${n}`]];
    const elbow = Math.min(angleBetween(L("SHOULDER"), L("ELBOW"), L("WRIST")), angleBetween(R("SHOULDER"), R("ELBOW"), R("WRIST")));
    const nose = lms[LM.NOSE];
    return {
      elbow,
      wristsUp: L("WRIST").y < nose.y && R("WRIST").y < nose.y,
      hipY: (L("HIP").y + R("HIP").y) / 2,
      sway: (L("HIP").x + R("HIP").x) / 2,     // a hang swings sideways
    };
  },
  grade(m) {
    const arms = scoreHang(m.elbow);
    return {
      score: Math.round(arms),
      bars: [{ label: "Straight arms", value: arms }],
      stats: [{ label: "Elbows", value: `${m.elbow.toFixed(0)}°` }],
    };
  },
  detectFaults(m) {
    return rankFaults("Dead hang", m.drift > 0.02 ? [["drift", 1]] : []);
  },
};
