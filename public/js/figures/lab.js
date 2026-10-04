/**
 * lab.js — adjustable versions of each exercise, for the Form Lab and the
 * "Spot the better rep" game.
 *
 * Each entry turns a few slider values into a pose, then the exercise's own
 * measure() scores it with the app's scoring curves. Presets are the common
 * faults a coach would point out. `cue()` returns what the coach would say.
 */

import { build, blend, SEG } from "./rig.js";
import { BY_ID } from "./poses.js";

const rad = (d) => (d * Math.PI) / 180;

/** Set the torso's lean from vertical (forward = toward the toes, +x). */
function withLean(p, lean) {
  const ang = -90 + lean;
  return { ...p, angTorso: ang, angHead: ang - 4 };
}

/** Move the hip up (−) or down (+) while the shoulders stay roughly put. */
function shiftHip(p, dy) {
  const neck = [p.hip[0] + SEG.torso * Math.cos(rad(p.angTorso)), p.hip[1] + SEG.torso * Math.sin(rad(p.angTorso))];
  const hip = [p.hip[0], p.hip[1] + dy];
  const ang = (Math.atan2(neck[1] - hip[1], neck[0] - hip[0]) * 180) / Math.PI;
  return { ...p, hip, angTorso: ang, angHead: ang + (p.angHead - p.angTorso) };
}

const ARM_KEYS = ["angUpperN", "angForeN", "angUpperF", "angForeF"];

export const LAB = {
  squat: {
    sliders: [
      { key: "depth", label: "Depth", min: 0, max: 100, lo: "Standing", hi: "Parallel" },
      { key: "lean", label: "Torso lean", min: 0, max: 60, lo: "Upright", hi: "Folded" },
    ],
    presets: [
      { name: "Good rep", v: { depth: 100, lean: 25 } },
      { name: "Half squat", v: { depth: 55, lean: 20 } },
      { name: "Folded forward", v: { depth: 100, lean: 52 } },
      { name: "Quarter squat", v: { depth: 30, lean: 12 } },
    ],
    pose: (v) => withLean(blend(BY_ID.squat.top, BY_ID.squat.bottom, v.depth / 100), v.lean),
    arc: (s) => [s.hip, s.kneeN, s.ankN],
    cue(v, m) {
      const [[, depth], [, posture]] = m.parts;
      if (depth >= 90 && posture >= 90) return "Clean rep. Thighs at parallel, chest proud.";
      return depth <= posture
        ? "Sit deeper: get your thighs down to parallel."
        : "Chest up. You're folding over your knees.";
    },
  },

  pushup: {
    sliders: [
      { key: "depth", label: "Depth", min: 0, max: 100, lo: "Arms locked", hi: "Chest low" },
      { key: "hips", label: "Hips", min: -40, max: 40, lo: "Piked", hi: "Sagging" },
    ],
    presets: [
      { name: "Good rep", v: { depth: 100, hips: 0 } },
      { name: "Half rep", v: { depth: 40, hips: 0 } },
      { name: "Sagging hips", v: { depth: 100, hips: 28 } },
      { name: "Piked", v: { depth: 100, hips: -32 } },
    ],
    pose: (v) => shiftHip(blend(BY_ID.pushup.top, BY_ID.pushup.bottom, v.depth / 100), v.hips),
    arc: (s) => [s.shN, s.elbN, s.wriN],
    guide: (s) => [s.neck, s.ankN],
    cue(v, m) {
      const [[, depth], [, line]] = m.parts;
      if (depth >= 90 && line >= 90) return "Clean rep. Full depth, one straight line.";
      if (depth <= line) return "Go lower: elbows to about 90°.";
      return v.hips > 0 ? "Squeeze your glutes. Your hips are sagging." : "Drop your hips into one straight line.";
    },
  },

  plank: {
    sliders: [
      { key: "hips", label: "Hips", min: -40, max: 40, lo: "Piked", hi: "Sagging" },
    ],
    presets: [
      { name: "Good hold", v: { hips: 0 } },
      { name: "Sagging", v: { hips: 28 } },
      { name: "Piked", v: { hips: -34 } },
    ],
    pose: (v) => shiftHip(BY_ID.plank.top, v.hips),
    guide: (s) => [s.neck, s.ankN],
    cue(v, m) {
      if (m.score >= 90) return "Solid. Shoulders, hips and ankles in one line.";
      return v.hips > 0 ? "Brace your core and lift your hips." : "Lower your hips until your body is flat.";
    },
  },

  lunge: {
    sliders: [
      { key: "depth", label: "Depth", min: 0, max: 100, lo: "Standing", hi: "Knee at 90°" },
      { key: "lean", label: "Torso lean", min: 0, max: 45, lo: "Upright", hi: "Leaning" },
    ],
    presets: [
      { name: "Good rep", v: { depth: 100, lean: 5 } },
      { name: "Too shallow", v: { depth: 35, lean: 5 } },
      { name: "Leaning over", v: { depth: 100, lean: 34 } },
    ],
    pose: (v) => withLean(blend(BY_ID.lunge.top, BY_ID.lunge.bottom, v.depth / 100), v.lean),
    arc: (s) => [s.hip, s.kneeN, s.ankN],
    cue(v, m) {
      const [[, depth], [, posture]] = m.parts;
      if (depth >= 90 && posture >= 90) return "Clean rep. Front knee at 90°, torso tall.";
      return depth <= posture ? "Drop your back knee toward the floor." : "Stay tall. Don't lean over your front leg.";
    },
  },

  jack: {
    sliders: [
      { key: "arms", label: "Arms", min: 0, max: 100, lo: "Down", hi: "Overhead" },
      { key: "feet", label: "Feet", min: 0, max: 100, lo: "Together", hi: "Wide" },
    ],
    presets: [
      { name: "Full jack", v: { arms: 100, feet: 100 } },
      { name: "Short arms", v: { arms: 72, feet: 100 } },
      { name: "Lazy feet", v: { arms: 100, feet: 0 } },
    ],
    pose(v) {
      const { top, bottom } = BY_ID.jack;
      const legs = blend(top, bottom, v.feet / 100);
      const arms = blend(top, bottom, v.arms / 100);
      for (const k of ARM_KEYS) legs[k] = arms[k];
      return legs;
    },
    cue(v, m) {
      const [[, arms], [, feet]] = m.parts;
      if (arms >= 90 && feet >= 90) return "Full range. Hands overhead, feet wide.";
      return arms <= feet ? "Reach all the way overhead." : "Jump your feet out wider.";
    },
  },
};

export const LAB_ORDER = ["squat", "pushup", "plank", "lunge", "jack"];

/** Pose, measure and describe one setting of an exercise. */
export function evaluate(id, v) {
  const lab = LAB[id];
  const s = build(lab.pose(v));
  const m = BY_ID[id].measure(s);
  return { s, m, cue: lab.cue(v, m) };
}
