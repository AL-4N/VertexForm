/** plank.js — plank is a HOLD, not reps: graded continuously. */

import { LM } from "../config.js";
import { lineFromHorizontal, relativeSag, headDrop, angleBetween } from "../geometry.js";
import { scorePlank } from "../scoring.js";
import { rankFaults } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];

export default {
  name: "Plank",
  isHold: true,
  /** Timer only runs while you're actually in a plank (body near horizontal). */
  inPosition: (m) => m.incline < 40,
  positionTip: "Get into your plank, side-on to the camera",
  fixes: {
    sag:  (m) => ({ ...m, sag: 0 }),
    pike: (m) => ({ ...m, sag: 0 }),
  },
  repMetric: () => 0,
  deepThreshold: 0,
  shallowThreshold: 0,

  measure(lms, side) {
    return {
      sag: relativeSag(lms, side),
      bodyLine: 180 - angleBetween(P(lms, side, "SHOULDER"), P(lms, side, "HIP"), P(lms, side, "ANKLE")),
      incline: lineFromHorizontal(P(lms, side, "SHOULDER"), P(lms, side, "ANKLE")),
      head: headDrop(lms, side),
      hipY: P(lms, side, "HIP").y,
    };
  },

  grade(m) {
    const straight = scorePlank(m.sag);
    return {
      score: Math.round(straight),
      bars: [{ label: "Straightness", value: straight }],
      stats: [
        { label: "Hip position", value:
            m.sag > 0.03 ? "sagging" : m.sag < -0.03 ? "piked" : "level" },
        { label: "Body line", value: m.bodyLine < 4 ? "straight" : `${m.bodyLine.toFixed(0)}° bend` },
      ],
    };
  },

  detectFaults(m) {
    const found = [];
    if (m.sag > 0.035)       found.push(["sag", 3]);
    else if (m.sag < -0.035) found.push(["pike", 2]);
    if (m.head > 0.12)       found.push(["head", 1]);
    if (m.drift > 0.02)      found.push(["drift", 1]);
    return rankFaults("Plank", found);
  },

  drawIdeal(ctx, lms, side, w, h) {
    const px = (p) => ({ x: p.x * w, y: p.y * h });
    const sh = px(P(lms, side, "SHOULDER"));
    const hip = px(P(lms, side, "HIP"));
    const ank = px(P(lms, side, "ANKLE"));
    const ax = ank.x - sh.x, ay = ank.y - sh.y;
    const t = ((hip.x - sh.x) * ax + (hip.y - sh.y) * ay) / (ax * ax + ay * ay + 1e-6);
    return [sh, { x: sh.x + t * ax, y: sh.y + t * ay }, ank];
  },
};
