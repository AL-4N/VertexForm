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

  /** Ideal: vertical front shin, thigh ~horizontal, upright torso. */
  drawIdeal(ctx, lms, side, w, h) {
    const px = (p) => ({ x: p.x * w, y: p.y * h });
    const hip = px(P(lms, side, "HIP"));
    const knee = px(P(lms, side, "KNEE"));
    const ankle = px(P(lms, side, "ANKLE"));
    const sh = px(P(lms, side, "SHOULDER"));

    const thigh = Math.hypot(hip.x - knee.x, hip.y - knee.y);
    const shin  = Math.hypot(knee.x - ankle.x, knee.y - ankle.y);
    const torso = Math.hypot(sh.x - hip.x, sh.y - hip.y);
    const facing = sh.x >= hip.x ? 1 : -1;
    const r10 = 10 * Math.PI / 180;

    const iAnkle = { ...ankle };
    const iKnee  = { x: iAnkle.x, y: iAnkle.y - shin };          // vertical shin
    const iHip   = { x: iKnee.x - facing * thigh * 0.9,
                     y: iKnee.y - thigh * 0.1 };
    const iSh    = { x: iHip.x + facing * torso * Math.sin(r10),
                     y: iHip.y - torso * Math.cos(r10) };
    return [iAnkle, iKnee, iHip, iSh];
  },
};
