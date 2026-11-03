/** row.js — Australian rows: lying under a bar at about waist height, heels
 *  on the floor, pull the chest to the bar. Side-on; reps by the elbow, and
 *  the body has to stay in one line from shoulders to ankles. */
import { LM } from "../config.js";
import { angleBetween, lineFromHorizontal } from "../geometry.js";
import { scoreRow, combine } from "../scoring.js";
import { rankFaults, POSITION_CUES } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default {
  name: "Australian row",
  repMetric: (m) => m.elbow,
  deepThreshold: 110,
  shallowThreshold: 145,
  minDeepTime: 0.12,
  repSeconds: [0.5, 10],
  bottomBand: 8,
  attemptMin: 12,
  startTip: POSITION_CUES["Australian row"],
  fixes: {
    short: (m) => ({ ...m, elbow: Math.min(m.elbow, 85) }),
    sag:   (m) => ({ ...m, lineBreak: 0 }),
  },
  trend: { key: "elbow", worse: +1, by: 8 },
  /** Under the bar: body well off vertical and the hands up above the shoulders. */
  posture: (m) => Math.min(clamp01((60 - m.incline) / 15), m.handsUp ? 1 : 0),
  floor: true,
  guide: null,

  measure(lms, side) {
    const sh = P(lms, side, "SHOULDER"), hip = P(lms, side, "HIP"), ank = P(lms, side, "ANKLE");
    // How far the hips break from the shoulder–ankle line: + sagging toward the floor.
    const bend = 180 - angleBetween(sh, hip, ank);
    const lineY = sh.y + (ank.y - sh.y) * ((hip.x - sh.x) / ((ank.x - sh.x) || 1e-6));
    return {
      elbow: angleBetween(sh, P(lms, side, "ELBOW"), P(lms, side, "WRIST")),
      lineBreak: hip.y > lineY ? bend : -bend,
      incline: lineFromHorizontal(sh, ank),
      handsUp: P(lms, side, "WRIST").y < sh.y,
      hipY: hip.y,
    };
  },

  grade(m) {
    const { pull, line } = scoreRow(m.elbow, Math.abs(m.lineBreak));
    return {
      score: combine([[pull, 0.6], [line, 0.4]]),
      bars: [
        { label: "Chest to the bar", value: pull },
        { label: "Body line",        value: line },
      ],
      stats: [
        { label: "Elbow at the top", value: `${m.elbow.toFixed(0)}°` },
        { label: "Body line", value: Math.abs(m.lineBreak) < 6 ? "straight" : `${Math.abs(m.lineBreak).toFixed(0)}° ${m.lineBreak > 0 ? "sag" : "pike"}` },
      ],
    };
  },

  detectFaults(m) {
    const found = [];
    if (m.elbow > 100) found.push(["short", m.elbow > 118 ? 3 : 2]);
    if (m.lineBreak > 11) found.push(["sag", 3]);
    return rankFaults("Australian row", found);
  },
};
