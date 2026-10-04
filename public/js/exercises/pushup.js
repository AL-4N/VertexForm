/** pushup.js — push-up measurement, scoring, faults, ideal overlay. */

import { LM } from "../config.js";
import { angleBetween, relativeSag, headDrop } from "../geometry.js";
import { scorePushup, combine } from "../scoring.js";
import { rankFaults } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];

export default {
  name: "Push-up",
  repMetric: (m) => m.elbow,
  deepThreshold: 110,
  shallowThreshold: 150,
  minDeepTime: 0.15,
  bottomBand: 8,
  attemptMin: 12,
  startTip: "Get into the top of a push-up, side-on",

  measure(lms, side) {
    return {
      elbow: angleBetween(P(lms, side, "SHOULDER"), P(lms, side, "ELBOW"), P(lms, side, "WRIST")),
      // How far the body BREAKS at the hips (0 = straight line), not how
      // tilted it is relative to the floor — push-ups are naturally inclined.
      bodyLine: 180 - angleBetween(P(lms, side, "SHOULDER"), P(lms, side, "HIP"), P(lms, side, "ANKLE")),
      sag: relativeSag(lms, side),
      head: headDrop(lms, side),
      hipY: P(lms, side, "HIP").y,
    };
  },

  grade(m) {
    const { depth, straight } = scorePushup(m.elbow, m.bodyLine);
    const score = combine([[depth, 0.55], [straight, 0.45]]);
    return {
      score,
      bars: [
        { label: "Depth",     value: depth },
        { label: "Body line", value: straight },
      ],
      stats: [
        { label: "Elbow at bottom", value: `${m.elbow.toFixed(0)}°` },
        { label: "Body line",       value: m.bodyLine < 4 ? "straight" : `${m.bodyLine.toFixed(0)}° bend at the hips` },
      ],
    };
  },

  detectFaults(m) {
    const found = [];
    if (m.elbow > 100)   found.push(["depth", m.elbow > 120 ? 3 : 2]);
    if (m.sag > 0.035)   found.push(["sag", 3]);
    else if (m.sag < -0.035) found.push(["pike", 2]);
    if (m.head > 0.10)   found.push(["head", 1]);
    if (m.duration && m.duration < 0.9) found.push(["tempo", 1]);
    return rankFaults("Push-up", found);
  },

  /** Ideal: a perfectly straight shoulder→hip→ankle line. */
  drawIdeal(ctx, lms, side, w, h) {
    const px = (p) => ({ x: p.x * w, y: p.y * h });
    const sh = px(P(lms, side, "SHOULDER"));
    const hip = px(P(lms, side, "HIP"));
    const ank = px(P(lms, side, "ANKLE"));
    const ax = ank.x - sh.x, ay = ank.y - sh.y;
    const t = ((hip.x - sh.x) * ax + (hip.y - sh.y) * ay) / (ax * ax + ay * ay + 1e-6);
    const idealHip = { x: sh.x + t * ax, y: sh.y + t * ay };
    return [sh, idealHip, ank];
  },
};
