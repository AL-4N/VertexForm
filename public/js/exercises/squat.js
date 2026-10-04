/**
 * squat.js — squat measurement, scoring, faults, and ideal overlay.
 *
 * Every exercise module exports the same shape:
 *   name, repMetric, deepThreshold, shallowThreshold,
 *   measure(lms, side), grade(m), detectFaults(m), drawIdeal(ctx, lms, side, w, h)
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

  /**
   * Ideal squat: shin near-vertical, thigh parallel to the ground,
   * torso ~15° forward. Anchored to the user's ankle and scaled to their
   * own limb lengths, so it's a target for THEIR body.
   */
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

    const r10 = 10 * Math.PI / 180, r15 = 15 * Math.PI / 180;
    const iAnkle = { ...ankle };
    const iKnee  = { x: iAnkle.x + facing * shin * Math.sin(r10),
                     y: iAnkle.y - shin * Math.cos(r10) };
    const iHip   = { x: iKnee.x - facing * thigh * 0.95,
                     y: iKnee.y - thigh * 0.15 };
    const iSh    = { x: iHip.x + facing * torso * Math.sin(r15),
                     y: iHip.y - torso * Math.cos(r15) };
    return [iAnkle, iKnee, iHip, iSh];
  },
};
