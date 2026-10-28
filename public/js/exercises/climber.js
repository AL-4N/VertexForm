/** climber.js — mountain climbers: from a high plank, drive a knee to the
 *  chest and back, fast. Side-on; it counts the knee nearest the camera (the
 *  far leg is hidden behind it). The body line runs from the shoulder to the
 *  far ankle, the leg that stays back while the near one drives. */
import { LM } from "../config.js";
import { angleBetween, lineFromHorizontal, relativeSag } from "../geometry.js";
import { combine, scoreClimber } from "../scoring.js";
import { rankFaults, POSITION_CUES } from "../coaching.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];
const clamp01 = (x) => Math.max(0, Math.min(1, x));

const other = (side) => (side === "LEFT" ? "RIGHT" : "LEFT");

export default {
  name: "Mountain climber",
  repMetric: (m) => m.hip,
  deepThreshold: 100,
  shallowThreshold: 145,
  minDeepTime: 0.04,
  repSeconds: [0.25, 4],
  bottomBand: 10,
  attemptMin: 15,
  startTip: POSITION_CUES["Mountain climber"],
  fixes: {
    drive: (m) => ({ ...m, hip: Math.min(m.hip, 75) }),
    sag:  (m) => ({ ...m, lineBreak: 0 }),
    pike: (m) => ({ ...m, lineBreak: 0 }),
  },
  trend: { key: "hip", worse: +1, by: 10 },
  posture: (m) => clamp01((55 - m.incline) / 15),
  floor: true,
  guide: null,

  measure(lms, side) {
    const sh = P(lms, side, "SHOULDER"), hip = P(lms, side, "HIP"), knee = P(lms, side, "KNEE");
    const far = lms[LM[`${other(side)}_ANKLE`]];
    // How far the hips break from the shoulder–far-ankle line: + sagging, − piked.
    const bend = 180 - angleBetween(sh, hip, far);
    const cross = (far.x - sh.x) * (hip.y - sh.y) - (far.y - sh.y) * (hip.x - sh.x);
    const below = (far.x - sh.x) * cross < 0 ? -1 : 1;
    return {
      hip: angleBetween(sh, hip, knee),
      lineBreak: bend * below,
      incline: lineFromHorizontal(sh, far),
      hipY: hip.y,
    };
  },
  grade(m) {
    const { drive, line } = scoreClimber(m.hip, m.lineBreak);
    return {
      score: combine([[drive, 0.6], [line, 0.4]]),
      bars: [
        { label: "Knee drive", value: drive },
        { label: "Body line",  value: line },
      ],
      stats: [
        { label: "Hip angle at the drive", value: `${m.hip.toFixed(0)}°` },
        { label: "Body line", value: Math.abs(m.lineBreak) < 6 ? "straight" : `${Math.abs(m.lineBreak).toFixed(0)}° ${m.lineBreak > 0 ? "sag" : "pike"}` },
      ],
    };
  },
  detectFaults(m) {
    const found = [];
    if (m.hip > 85) found.push(["drive", 2]);           // the knee stopped short of the chest
    if (m.lineBreak > 11) found.push(["sag", 3]);
    else if (m.lineBreak < -11) found.push(["pike", 2]);
    return rankFaults("Mountain climber", found);
  },
};
