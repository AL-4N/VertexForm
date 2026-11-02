/** pistol.js — pistol squat: a squat on one leg, the other held out in front
 *  and off the floor. Side-on; it measures the STANDING leg (the lower
 *  ankle in frame) and watches the free foot's height. */
import { LM } from "../config.js";
import { angleBetween, leanFromVertical, thighAngleDeg } from "../geometry.js";
import { scorePistol, combine } from "../scoring.js";
import { rankFaults, POSITION_CUES } from "../coaching.js";
import { frontSide } from "./lunge.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];
const other = (side) => (side === "LEFT" ? "RIGHT" : "LEFT");
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export default {
  name: "Pistol squat",
  pickSide: frontSide,
  repMetric: (m) => m.knee,
  deepThreshold: 100,
  shallowThreshold: 142,
  minDeepTime: 0.2,
  repSeconds: [0.6, 14],
  bottomBand: 8,
  attemptMin: 14,
  startTip: POSITION_CUES["Pistol squat"],
  fixes: {
    depth:    (m) => ({ ...m, depthDeg: Math.min(m.depthDeg, -2) }),
    footDown: (m) => ({ ...m, lift: Math.max(m.lift, 0.3) }),
  },
  trend: { key: "depthDeg", worse: +1, by: 6 },
  /** On one leg: the free foot clear of the floor. */
  posture: (m) => clamp01((m.lift - 0.04) / 0.08),
  guide: null,

  measure(lms, side) {
    const hip = P(lms, side, "HIP"), knee = P(lms, side, "KNEE"), ank = P(lms, side, "ANKLE");
    const free = lms[LM[`${other(side)}_ANKLE`]];
    const leg = dist(hip, knee) + dist(knee, ank) || 1e-6;
    return {
      knee: angleBetween(hip, knee, ank),
      depthDeg: thighAngleDeg(hip, knee),
      lift: (ank.y - free.y) / leg,               // the free foot's height, in leg lengths
      lean: leanFromVertical(P(lms, side, "SHOULDER"), hip),
      hipY: hip.y,
    };
  },

  grade(m) {
    const { depth, freeLeg } = scorePistol(m.depthDeg, m.lift);
    return {
      score: combine([[depth, 0.7], [freeLeg, 0.3]]),
      bars: [
        { label: "Depth",       value: depth },
        { label: "Free leg up", value: freeLeg },
      ],
      stats: [
        { label: "Standing knee", value: `${m.knee.toFixed(0)}°` },
        { label: "Depth", value: m.depthDeg <= 0 ? `${(-m.depthDeg).toFixed(0)}° below parallel` : `${m.depthDeg.toFixed(0)}° above parallel` },
      ],
    };
  },

  detectFaults(m) {
    const found = [];
    if (m.depthDeg > 8) found.push(["depth", m.depthDeg > 25 ? 3 : 2]);
    if (m.lift < 0.1)   found.push(["footDown", 3]);
    return rankFaults("Pistol squat", found);
  },
};
