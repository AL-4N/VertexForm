/** sit.js — L-sit and V-sit: HOLDS, side-on, hands pressing down beside the
 *  hips (floor or parallettes), legs straight out in front. The L-sit keeps
 *  the feet at hip height; the V-sit lifts them well above it. Both watch
 *  the knees stay straight. */
import { LM } from "../config.js";
import { angleBetween } from "../geometry.js";
import { scoreLSit, scoreVSit, combine } from "../scoring.js";
import { rankFaults, POSITION_CUES } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function measure(lms, side) {
  const sh = P(lms, side, "SHOULDER"), hip = P(lms, side, "HIP"), knee = P(lms, side, "KNEE"), ank = P(lms, side, "ANKLE"), wr = P(lms, side, "WRIST");
  const leg = dist(hip, knee) + dist(knee, ank) || 1e-6, torso = dist(sh, hip) || 1e-6;
  return {
    hipAngle: angleBetween(sh, hip, ank),
    lift: (hip.y - ank.y) / leg,                       // + = feet above the hips, in leg lengths
    knee: angleBetween(hip, knee, ank),
    // Hands pressing down beside the hips, legs reaching out in front.
    support: wr.y > sh.y && Math.abs(wr.y - hip.y) < 0.45 * torso,
    reach: Math.abs(ank.x - hip.x) / leg,
    hipY: hip.y,
  };
}

function make(name, scoreFn, legsLabel, legsLow) {
  return {
    name,
    isHold: true,
    inPosition: (m) => m.support && m.reach > 0.45 && m.lift > -0.3,
    positionTip: POSITION_CUES[name],
    posture: (m) => (m.support ? 1 : 0),
    floor: true,
    guide: null,
    fixes: {
      legsLow:    (m) => ({ ...m, lift: Math.max(m.lift, 0.4) }),
      bentKnees:  (m) => ({ ...m, knee: Math.max(m.knee, 172) }),
    },
    repMetric: () => 0, deepThreshold: 0, shallowThreshold: 0,
    measure,
    grade(m) {
      const { legs, straight } = scoreFn(m.hipAngle, m.lift, m.knee);
      return {
        score: combine([[legs, 0.7], [straight, 0.3]]),
        bars: [{ label: legsLabel, value: legs }, { label: "Straight legs", value: straight }],
        stats: [
          { label: "Feet", value: m.lift >= 0 ? "above the hips" : "below the hips" },
          { label: "Knees", value: `${m.knee.toFixed(0)}°` },
        ],
      };
    },
    detectFaults(m) {
      const found = [];
      if (legsLow(m)) found.push(["legsLow", 3]);
      if (m.knee < 158) found.push(["bentKnees", 2]);
      if (m.drift > 0.02) found.push(["drift", 1]);
      return rankFaults(name, found);
    },
  };
}

export const lsit = make("L-sit", scoreLSit, "Legs level", (m) => m.lift < -0.08);
export const vsit = make("V-sit", scoreVSit, "Legs high", (m) => m.lift < 0.25);
