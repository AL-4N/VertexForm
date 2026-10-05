/**
 * jumpingjack.js — a motion, not a held shape, so there's no ideal overlay.
 * Each rep is graded on how far the hands get overhead and how wide the feet
 * go at the top of the jump. Reps are counted from arm height.
 *
 * Arm height is measured in TORSO LENGTHS (wrist above shoulder ÷ shoulder→hip)
 * so it doesn't depend on how far you stand from the camera, then mapped onto
 * the scoring curve's frame units (1 torso ≈ 0.2 frame heights).
 */

import { LM } from "../config.js";
import { scoreJack } from "../scoring.js";
import { rankFaults } from "../coaching.js";
import { median } from "../geometry.js";

const TORSO_TO_FRAME = 0.2;

export default {
  name: "Jumping Jack",
  noIdeal: true,
  noTempo: true,                     // too quick for a "down… 2… up" metronome
  frontFacing: true,
  repMetric: (m) => -m.armRaise,     // negated so "deep" = arms UP
  deepThreshold: -0.10,              // hands ~half a torso above the shoulders
  shallowThreshold: 0.05,            // hands back below the shoulders
  startMargin: 0.03,
  minDeepTime: 0.08,                 // jacks are quick
  repSeconds: [0.2, 4],
  bottomBand: 0.05,
  attemptMin: 0.12,
  startTip: "Face the camera, arms by your sides",
  fixes: {
    extension: (m) => ({ ...m, armRaise: Math.max(m.armRaise, 0.2) }),
    feet:      (m) => ({ ...m, legSpread: Math.max(m.legSpread, 1.7) }),
  },
  trend: { key: "armRaise", worse: -1, by: 0.05 },
  posture: () => 1,               // facing the camera is checked separately
  guide: "arms",

  measure(lms) {
    const lsh = lms[LM.LEFT_SHOULDER], rsh = lms[LM.RIGHT_SHOULDER];
    const wrist = (lms[LM.LEFT_WRIST].y + lms[LM.RIGHT_WRIST].y) / 2;
    const shoulder = (lsh.y + rsh.y) / 2;
    const hip = (lms[LM.LEFT_HIP].y + lms[LM.RIGHT_HIP].y) / 2;
    const torso = Math.abs(hip - shoulder) || 1e-6;
    const ankleSpread = Math.abs(lms[LM.LEFT_ANKLE].x - lms[LM.RIGHT_ANKLE].x);
    const shoulderWidth = Math.abs(lsh.x - rsh.x) + 1e-6;
    return {
      armRaise: ((shoulder - wrist) / torso) * TORSO_TO_FRAME,   // + when hands are above shoulders
      legSpread: ankleSpread / shoulderWidth,
      hipY: hip,
    };
  },

  /** Arms: the frames near the top of the jump. Feet: the widest point of the rep. */
  summarize(windowFrames, repFrames) {
    return {
      armRaise: median(windowFrames.map((m) => m.armRaise)),
      legSpread: Math.max(...repFrames.map((m) => m.legSpread)),
      hipY: median(windowFrames.map((m) => m.hipY)),
    };
  },

  grade(m) {
    const extension = scoreJack(m.armRaise);
    const legs = Math.min(100, (m.legSpread / 1.6) * 100);
    const score = Math.round(extension * 0.7 + legs * 0.3);
    return {
      score,
      bars: [
        { label: "Arm extension", value: extension },
        { label: "Leg spread",    value: legs },
      ],
      stats: [
        { label: "Arms overhead", value: m.armRaise > 0.18 ? "full" : "partial" },
        { label: "Feet", value: m.legSpread > 1.6 ? "wide" : "narrow" },
      ],
    };
  },

  detectFaults(m) {
    const found = [];
    if (m.armRaise < 0.18) found.push(["extension", 3]);
    if (m.legSpread < 1.4) found.push(["feet", 2]);
    return rankFaults("Jumping Jack", found);
  },
};
