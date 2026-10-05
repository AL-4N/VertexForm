/**
 * squat.js — squat measurement, scoring, faults, and ideal overlay.
 *
 * Every exercise module exports the same shape:
 *   name, repMetric, deepThreshold, shallowThreshold,
 *   measure(lms, side), grade(m), detectFaults(m), posture(m), fixes, guide (see js/guide.js)
 */

import { LM } from "../config.js";
import { angleBetween, leanFromVertical, thighAngleDeg, kneeTravel } from "../geometry.js";
import { scoreSquat, scoreControl, combine } from "../scoring.js";
import { rankFaults } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];

export default {
  name: "Squat",

  /** Value used to detect rep phase: knee angle (smaller = deeper). */
  repMetric: (m) => m.knee,
  deepThreshold: 130,        // knee angle below this = in the bottom of the rep
  shallowThreshold: 152,     // back above this = rep finished (no full lockout needed)
  minDeepTime: 0.25,
  repSeconds: [0.5, 12],    // shorter = a twitch, longer = not one rep (grinders still fit)         // seconds that must be spent below deepThreshold
  bottomBand: 8,             // score frames within 8° of the deepest point
  attemptMin: 12,            // dipped this far without going deep = "too shallow"
  startTip: "Stand tall, side-on, to start",
  // For the coach: the measurements as they'd be with one fault fixed (to
  // estimate how many points fixing it is worth), and the depth signal to
  // watch for fatigue (higher depthDeg = shallower).
  fixes: {
    depth: (m) => ({ ...m, depthDeg: Math.min(m.depthDeg, 0) }),
    lean:  (m) => ({ ...m, lean: Math.min(m.lean, 25) }),
  },
  trend: { key: "depthDeg", worse: +1, by: 6 },
  /** Does the body look like a squat at all? Upright-ish torso (0..1). */
  posture: (m) => Math.max(0, Math.min(1, (72 - m.lean) / 15)),
  guide: "squat",

  measure(lms, side) {
    const hip = P(lms, side, "HIP");
    const knee = P(lms, side, "KNEE");
    const ankle = P(lms, side, "ANKLE");
    const shoulder = P(lms, side, "SHOULDER");
    return {
      knee: angleBetween(hip, knee, ankle),
      lean: leanFromVertical(shoulder, hip),
      depthDeg: thighAngleDeg(hip, knee),
      kneeTravel: kneeTravel(lms, side),
      hipY: hip.y,
    };
  },

  /** @returns {score, bars:[{label,value}]} */
  grade(m, series = []) {
    const { depth, posture } = scoreSquat(m.depthDeg, m.lean);
    const control = series.length ? scoreControl(series) : 100;
    const score = combine([[depth, 0.45], [posture, 0.35], [control, 0.20]]);
    return {
      score,
      bars: [
        { label: "Depth",   value: depth },
        { label: "Posture", value: posture },
        { label: "Control", value: control },
      ],
      stats: [
        { label: "Depth", value: m.depthDeg <= 0
            ? `${Math.abs(m.depthDeg).toFixed(0)}° below parallel`
            : `${m.depthDeg.toFixed(0)}° above parallel` },
        { label: "Forward lean", value: `${m.lean.toFixed(0)}°` },
        { label: "Knee angle",   value: `${m.knee.toFixed(0)}°` },
      ],
    };
  },

  detectFaults(m) {
    const found = [];
    if (m.depthDeg > 6)        found.push(["depth", m.depthDeg > 15 ? 3 : 2]);
    if (m.lean > 42)           found.push(["lean", 3]);
    else if (m.lean > 32)      found.push(["lean", 2]);
    if (m.kneeTravel > 0.55)   found.push(["kneeTravel", 2]);
    if (m.bounce)              found.push(["bounce", 2]);   // rebounded out of the bottom
    if (m.duration && m.duration < 1.0) found.push(["tempo", 1]);
    return rankFaults("Squat", found);
  },
};
