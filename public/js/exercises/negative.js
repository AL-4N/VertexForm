/** negative.js — negative pull-ups: jump or step up to the top, chin over the
 *  bar, then lower slowly to the hang. The pull-up's measurements; graded on
 *  how long the lowering takes (3 s or more) and on starting from the top. */
import { scorePullup, scoreLowering, combine } from "../scoring.js";
import { rankFaults, POSITION_CUES } from "../coaching.js";
import pullup, { measurePull } from "./pullup.js";

export default {
  ...pullup,
  name: "Negative pull-up",
  repSeconds: [1.2, 16],
  shallowThreshold: 158,          // the lowering ends at straight arms, so its timing covers all of it
  bottomBand: 3,                  // ...and starts as soon as you leave the top
  startTip: POSITION_CUES["Negative pull-up"],
  fixes: {
    fast:    (m) => ({ ...m, phases: { ...(m.phases ?? {}), up: Math.max(m.phases?.up ?? 0, 3.2) } }),
    halfRep: (m) => ({ ...m, chin: Math.max(m.chin, 0.05) }),
  },
  trend: null,
  measure: measurePull,

  /** `m.phases.up` (the session's timing of the way back down to the hang) is
   *  the lowering; live frames have none yet and grade the top position only. */
  grade(m) {
    const lowerS = m.phases?.up;
    const lowering = lowerS == null ? 100 : scoreLowering(lowerS);
    const { top } = scorePullup(m.chin, m.elbow);
    return {
      score: combine([[lowering, 0.7], [top, 0.3]]),
      bars: [
        { label: "Slow lowering",     value: lowering },
        { label: "Chin over the bar", value: top },
      ],
      stats: [
        { label: "Lowering", value: lowerS == null ? "–" : `${lowerS.toFixed(1)} s` },
        { label: "Chin at the top", value: m.chin >= 0 ? "over the bar" : "under the bar" },
      ],
    };
  },

  detectFaults(m) {
    const found = [];
    if (m.phases?.up != null && m.phases.up < 2.5) found.push(["fast", 3]);
    if (m.chin < 0) found.push(["halfRep", 2]);
    return rankFaults("Negative pull-up", found);
  },
};
