/** splitsquat.js — Bulgarian split squat: a lunge with the back foot up on a
 *  bench. Side-on; it measures the FRONT leg (the lower ankle in frame) and
 *  only counts while the back foot is clearly raised. */
import { LM } from "../config.js";
import { angleBetween, leanFromVertical } from "../geometry.js";
import { scoreSplitSquat, combine } from "../scoring.js";
import { rankFaults, POSITION_CUES } from "../coaching.js";
import { frontSide } from "./lunge.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];
const other = (side) => (side === "LEFT" ? "RIGHT" : "LEFT");
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export default {
  name: "Bulgarian split squat",
  pickSide: frontSide,
  repMetric: (m) => m.knee,
  deepThreshold: 125,
  shallowThreshold: 148,
  minDeepTime: 0.3,
  repSeconds: [0.5, 12],
  bottomBand: 8,
  attemptMin: 12,
  startTip: POSITION_CUES["Bulgarian split squat"],
  fixes: {
    shallow: (m) => ({ ...m, knee: 90 }),
    lean:    (m) => ({ ...m, lean: Math.min(m.lean, 12) }),
  },
  trend: { key: "knee", worse: +1, by: 8 },
  /** A split squat: torso upright-ish and the back foot well off the floor. */
  posture: (m) => Math.min(clamp01((62 - m.lean) / 15), clamp01((m.rearUp - 0.1) / 0.12)),
  guide: null,

  measure(lms, side) {
    const hip = P(lms, side, "HIP"), knee = P(lms, side, "KNEE"), ank = P(lms, side, "ANKLE");
    const rear = lms[LM[`${other(side)}_ANKLE`]];
    const leg = dist(hip, knee) + dist(knee, ank) || 1e-6;
    return {
      knee: angleBetween(hip, knee, ank),
      lean: leanFromVertical(P(lms, side, "SHOULDER"), hip),
      rearUp: (ank.y - rear.y) / leg,             // how high the back foot is, in leg lengths
      hipY: hip.y,
    };
  },

  grade(m) {
    const { depth, posture } = scoreSplitSquat(m.knee, m.lean);
    return {
      score: combine([[depth, 0.65], [posture, 0.35]]),
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
    if (m.knee > 105) found.push(["shallow", m.knee > 120 ? 3 : 2]);
    if (m.lean > 28)  found.push(["lean", 2]);
    return rankFaults("Bulgarian split squat", found);
  },
};
