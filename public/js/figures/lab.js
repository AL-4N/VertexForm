/**
 * lab.js — adjustable versions of each exercise, for the Form Lab.
 *
 * Each entry turns a few slider values into a pose, then the exercise's own
 * measure() scores it with the app's scoring curves. Presets are the common
 * faults a coach would point out. `cue()` returns what the coach would say,
 * as parts the voice has recordings for, and `focus()` the body part it's
 * about (a skeleton key, for the note's arrow).
 */

import { build, blend, poseAt, SEG } from "./rig.js";
import { BY_ID } from "./poses.js";
import { FAULTS, PRAISE } from "../coaching.js";

// Cues are the trainer's own recorded lines (js/coaching.js), so the site
// speaks them in the same natural voice (public/audio) instead of the
// browser's robotic one. fault(ex, key) = that fault's first phrasing.
const fault = (ex, key) => FAULTS[ex][key][2][0];

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

/** Pull the feet back toward the hips by `k` % so the knees bend (an L-sit's bent legs). */
function bendKnees(p, k) {
  const pull = (a) => [a[0] + (p.hip[0] - a[0]) * 0.3 * (k / 100), a[1] + (p.hip[1] - a[1]) * 0.3 * (k / 100)];
  return { ...p, ankleN: pull(p.ankleN), ankleF: pull(p.ankleF) };
}

export const LAB = {
  squat: {
    sliders: [
      { key: "depth", label: "Depth", min: 0, max: 100, lo: "Standing", hi: "Parallel" },
      { key: "lean", label: "Torso lean", min: 0, max: 60, lo: "Upright", hi: "Folded" },
    ],
    presets: [
      { name: "Good rep", v: { depth: 100, lean: 25 } },
      { name: "Half squat", v: { depth: 62, lean: 20 } },          // 76, the half squat in the scoring tests
      { name: "Folded forward", v: { depth: 100, lean: 42 } },     // 83, the folded-forward squat in the scoring tests
      { name: "Quarter squat", v: { depth: 39, lean: 12 } },       // 54, the quarter squat in the scoring tests
    ],
    pose: (v) => withLean(blend(BY_ID.squat.top, BY_ID.squat.bottom, v.depth / 100), v.lean),
    arc: (s) => [s.hip, s.kneeN, s.ankN],
    cue(v, m) {
      const [[, depth], [, posture]] = m.parts;
      if (depth >= 90 && posture >= 90) return [PRAISE.Coach[3]];                    // "Textbook."
      return [depth <= posture ? fault("Squat", "depth") : fault("Squat", "lean")];
    },
    focus(v, m) {
      const [[, depth], [, posture]] = m.parts;
      return depth >= 90 && posture >= 90 ? "hip" : depth <= posture ? "hip" : "neck";
    },
  },

  // Side plank, hollow hold, mountain climber, dead hang: used by the simulator only.
  side_plank: {
    sliders: [{ key: "hips", label: "Hips", min: -40, max: 40, lo: "Too high", hi: "Dropping" }],
    presets: [{ name: "Good hold", v: { hips: 0 } }],
    pose: (v) => shiftHip(BY_ID.side_plank.top, v.hips),
    guide: () => null, cue: () => [], focus: () => "hip",
  },
  hollow: {
    sliders: [{ key: "lift", label: "Lift", min: 0, max: 100, lo: "Flat", hi: "Hollow" }],
    presets: [{ name: "Good hold", v: { lift: 100 } }],
    pose: (v) => blend(BY_ID.hollow.bottom, BY_ID.hollow.top, v.lift / 100),
    guide: () => null, cue: () => [], focus: () => "hip",
  },
  climber: {
    sliders: [
      { key: "depth", label: "Knee drive", min: 0, max: 100, lo: "Leg back", hi: "Knee to chest" },
      { key: "hips", label: "Hips", min: -40, max: 40, lo: "Piked", hi: "Sagging" },
    ],
    presets: [{ name: "Good rep", v: { depth: 100, hips: 0 } }],
    pose: (v) => shiftHip(poseAt(BY_ID.climber, v.depth / 100), v.hips),
    guide: () => null, cue: () => [], focus: () => "hip",
  },
  hang: {
    sliders: [{ key: "bend", label: "Elbows", min: 0, max: 100, lo: "Straight", hi: "Bent" }],
    presets: [{ name: "Good hold", v: { bend: 0 } }],
    pose: (v) => blend(BY_ID.hang.top, { ...BY_ID.hang.top, angUpperN: -150, angForeN: -95, angUpperF: -30, angForeF: -85 }, v.bend / 100),
    guide: () => null, cue: () => [], focus: () => "elbN",
  },
  // Bulgarian split squat, pistol squat, dips: the simulator's (tests/helpers/synth.mjs); not on the homepage.
  split_squat: {
    sliders: [
      { key: "depth", label: "Depth", min: 0, max: 100, lo: "Standing", hi: "Knee at 90°" },
      { key: "lean", label: "Torso lean", min: 0, max: 45, lo: "Upright", hi: "Leaning" },
    ],
    presets: [{ name: "Good rep", v: { depth: 100, lean: 8 } }],
    pose: (v) => withLean(blend(BY_ID.split_squat.top, BY_ID.split_squat.bottom, v.depth / 100), v.lean),
    guide: () => null, cue: () => [], focus: () => "kneeN",
  },
  pistol: {
    sliders: [
      { key: "depth", label: "Depth", min: 0, max: 100, lo: "Standing", hi: "Hip below knee" },
      { key: "foot", label: "Free foot", min: 0, max: 100, lo: "Held up", hi: "On the floor" },
    ],
    presets: [{ name: "Good rep", v: { depth: 100, foot: 0 } }],
    pose: (v) => {
      const p = blend(BY_ID.pistol.top, BY_ID.pistol.bottom, v.depth / 100);
      const k = v.foot / 100;                                        // the free foot lowered toward the floor
      return { ...p, ankleF: [p.ankleF[0] - 60 * k, p.ankleF[1] + (466 - p.ankleF[1]) * k] };
    },
    guide: () => null, cue: () => [], focus: () => "hip",
  },
  dips: {
    sliders: [{ key: "depth", label: "Depth", min: 0, max: 100, lo: "Arms locked", hi: "Elbows at 90°" }],
    presets: [{ name: "Good rep", v: { depth: 100 } }],
    pose: (v) => blend(BY_ID.dips.top, BY_ID.dips.bottom, v.depth / 100),
    guide: () => null, cue: () => [], focus: () => "elbN",
  },
  pullup: {
    sliders: [{ key: "depth", label: "Pull", min: 0, max: 100, lo: "Dead hang", hi: "Chin over the bar" }],
    presets: [{ name: "Good rep", v: { depth: 100 } }],
    pose: (v) => blend(BY_ID.pullup.top, BY_ID.pullup.bottom, v.depth / 100),
    guide: () => null, cue: () => [], focus: () => "head",
  },
  negative: {
    sliders: [{ key: "depth", label: "Height", min: 0, max: 100, lo: "Dead hang", hi: "Chin over the bar" }],
    presets: [{ name: "Top", v: { depth: 100 } }],
    pose: (v) => blend(BY_ID.negative.top, BY_ID.negative.bottom, v.depth / 100),
    guide: () => null, cue: () => [], focus: () => "head",
  },
  row: {
    sliders: [
      { key: "depth", label: "Pull", min: 0, max: 100, lo: "Arms straight", hi: "Chest to the bar" },
      { key: "hips", label: "Hips", min: -30, max: 40, lo: "Piked", hi: "Sagging" },
    ],
    presets: [{ name: "Good rep", v: { depth: 100, hips: 0 } }],
    pose: (v) => shiftHip(blend(BY_ID.row.top, BY_ID.row.bottom, v.depth / 100), v.hips),
    guide: () => null, cue: () => [], focus: () => "hip",
  },
  lsit: {
    sliders: [{ key: "legs", label: "Legs", min: 0, max: 100, lo: "Level", hi: "Dropped" }, { key: "bend", label: "Knees", min: 0, max: 100, lo: "Straight", hi: "Bent" }],
    presets: [{ name: "Good hold", v: { legs: 0, bend: 0 } }],
    pose: (v) => bendKnees(blend(BY_ID.lsit.top, BY_ID.lsit.bottom, v.legs / 100), v.bend),
    guide: () => null, cue: () => [], focus: () => "ankN",
  },
  vsit: {
    sliders: [{ key: "legs", label: "Legs", min: 0, max: 100, lo: "High", hi: "Level" }, { key: "bend", label: "Knees", min: 0, max: 100, lo: "Straight", hi: "Bent" }],
    presets: [{ name: "Good hold", v: { legs: 0, bend: 0 } }],
    pose: (v) => bendKnees(blend(BY_ID.vsit.top, BY_ID.vsit.bottom, v.legs / 100), v.bend),
    guide: () => null, cue: () => [], focus: () => "ankN",
  },
  // Pike push-up: used by the simulator (tests/helpers/synth.mjs); not on the homepage.
  pike: {
    sliders: [
      { key: "depth", label: "Depth", min: 0, max: 100, lo: "Arms locked", hi: "Head low" },
      { key: "hips", label: "Hips", min: 0, max: 100, lo: "Piked high", hi: "Dropped" },
    ],
    presets: [
      { name: "Good rep", v: { depth: 100, hips: 0 } },
      { name: "Hips dropped", v: { depth: 100, hips: 100 } },
    ],
    pose: (v) => blend(
      blend(BY_ID.pike.top, BY_ID.pike.bottom, v.depth / 100),
      blend(BY_ID.pike.lowTop, BY_ID.pike.lowBottom, v.depth / 100), v.hips / 100),
    arc: (s) => [s.shN, s.elbN, s.wriN],
    guide: () => null,
    cue: () => [],
    focus: () => "elbN",
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
      if (depth >= 90 && line >= 90) return [PRAISE.Coach[2]];                       // "Solid, keep that form."
      if (depth <= line) return [fault("Push-up", "depth")];
      return [fault("Push-up", v.hips > 0 ? "sag" : "pike")];
    },
    focus(v, m) {
      const [[, depth], [, line]] = m.parts;
      return (depth >= 90 && line >= 90) || depth <= line ? "elbN" : "hip";
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
      if (m.score >= 90) return [PRAISE.Coach[1]];                                   // "That's the standard."
      return [fault("Plank", v.hips > 0 ? "sag" : "pike")];
    },
    focus: () => "hip",
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
      if (depth >= 90 && posture >= 90) return [PRAISE.Chill[1]];                    // "Smooth rep."
      return [fault("Lunge", depth <= posture ? "shallow" : "lean")];
    },
    focus(v, m) {
      const [[, depth], [, posture]] = m.parts;
      return (depth >= 90 && posture >= 90) || depth <= posture ? "kneeF" : "neck";
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
      if (arms >= 90 && feet >= 90) return [PRAISE.Chill[4]];                        // "Good one."
      return [fault("Jumping Jack", arms <= feet ? "extension" : "feet")];
    },
    arc: (s) => [s.hpN, s.shN, s.wriN],
    focus(v, m) {
      const [[, arms], [, feet]] = m.parts;
      return (arms >= 90 && feet >= 90) || arms <= feet ? "wriN" : "ankN";
    },
  },
};

/** Pose, measure and describe one setting of an exercise. */
export function evaluate(id, v) {
  const lab = LAB[id];
  const s = build(lab.pose(v));
  const m = BY_ID[id].measure(s);
  const parts = lab.cue(v, m);
  return { s, m, cue: asText(parts), parts, focus: lab.focus(v, m) };
}

/** Parts as one line of text: each a sentence ("Go lower, …" → "Go lower, ….") */
export const asText = (parts) => parts.map((p) => (/[.!?]$/.test(p) ? p : `${p}.`)).join(" ");
