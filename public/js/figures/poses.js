/**
 * poses.js — the exercises the hero demo performs.
 *
 * Each exercise has two keyframes (top and bottom of the rep), a timing
 * pattern, and a `measure()` that reads the posed skeleton and scores it with
 * the SAME scoring functions the app uses (js/scoring.js). So the colour the
 * demo figure turns is the colour you would actually earn.
 *
 * Stage units: 600 × 520, ground at y = 470.
 *
 * `good` names the keyframe that shows correct form ("bottom" unless set).
 * Pictograms and the reduced-motion still frame use it.
 */

import { angleAt, thighDepth, leanFromVertical, hipSag } from "./rig.js";
import { scoreSquat, scorePushup, scorePlank, scoreLunge, scoreJack, combine } from "../scoring.js";

export const GROUND = 470;
const STAGE_H = 520;   // used to normalise distances the way the app does

const deg = (n) => `${Math.round(n)}°`;

/* ── Squat ───────────────────────────────────────────── */
const squat = {
  id: "squat", name: "Squat", view: "side",
  timing: [1500, 700, 1100, 800],          // down, hold, up, rest (ms)
  top: {
    view: "side", arms: "fk",
    hip: [296, 258], angTorso: -86, angHead: -86,
    ankleN: [300, GROUND], ankleF: [294, GROUND - 2],
    angFootN: 0, angFootF: 0, bendKneeN: -1, bendKneeF: -1,
    angUpperN: 96, angForeN: 100, angUpperF: 92, angForeF: 96,
  },
  bottom: {
    view: "side", arms: "fk",
    hip: [215.6, 373.5], angTorso: -60, angHead: -64,
    ankleN: [300, GROUND], ankleF: [294, GROUND - 2],
    angFootN: 0, angFootF: 0, bendKneeN: -1, bendKneeF: -1,
    angUpperN: -8, angForeN: -4, angUpperF: -14, angForeF: -8,
  },
  measure(s) {
    const knee = angleAt(s.hip, s.kneeN, s.ankN);
    const depth = thighDepth(s.hip, s.kneeN);
    const lean = leanFromVertical(s.neck, s.hip);
    const { depth: d, posture: p } = scoreSquat(depth, lean);
    return {
      score: combine([[d, 0.55], [p, 0.45]]),
      parts: [["Depth", d], ["Posture", p]],
      raw: { knee, depth, lean },
      rows: [
        ["Knee angle", deg(knee)],
        ["Depth", depth <= 0 ? `${deg(-depth)} below parallel` : `${deg(depth)} above parallel`],
      ],
    };
  },
};

/* ── Push-up ─────────────────────────────────────────── */
const pushup = {
  id: "pushup", name: "Push-up", view: "side",
  timing: [1200, 450, 1000, 650],
  top: {
    view: "side", arms: "ik",
    hip: [332.5, 392.3], angTorso: -15.1, angHead: -6,
    ankleN: [122, 449], ankleF: [126, 448],
    angFootN: 135, angFootF: 135, bendKneeN: -1, bendKneeF: -1,
    handN: [460, GROUND], handF: [454, GROUND - 2], bendElbowN: 1, bendElbowF: 1,
  },
  bottom: {
    view: "side", arms: "ik",
    hip: [338.0, 419.8], angTorso: -7.7, angHead: 2,
    ankleN: [122, 449], ankleF: [126, 448],
    angFootN: 135, angFootF: 135, bendKneeN: -1, bendKneeF: -1,
    handN: [460, GROUND], handF: [454, GROUND - 2], bendElbowN: 1, bendElbowF: 1,
  },
  measure(s) {
    const elbow = angleAt(s.shN, s.elbN, s.wriN);
    const bendOff = 180 - angleAt(s.neck, s.hip, s.ankN);   // body-line break
    const { depth, straight } = scorePushup(elbow, bendOff);
    return {
      score: combine([[depth, 0.55], [straight, 0.45]]),
      parts: [["Depth", depth], ["Body line", straight]],
      raw: { elbow, bendOff },
      rows: [["Elbow angle", deg(elbow)], ["Body line", bendOff < 4 ? "straight" : `${deg(bendOff)} bend`]],
    };
  },
};

/* ── Plank (a hold: drifts into a sag, then corrects) ── */
const plank = {
  id: "plank", name: "Plank", view: "side",
  good: "top",                             // the clean line is "top"; "bottom" is the sag fault
  timing: [1300, 1100, 900, 2200],         // sag in, hold sag, recover, hold clean
  top: {   // clean line
    view: "side", arms: "ik",
    hip: [308.6, 424.7], angTorso: -6.4, angHead: -2,
    ankleN: [92, 449], ankleF: [96, 448],
    angFootN: 135, angFootF: 135, bendKneeN: -1, bendKneeF: -1,
    handN: [494, GROUND - 2], handF: [488, GROUND - 4], bendElbowN: 1, bendElbowF: 1,
  },
  bottom: {   // hips sagging
    view: "side", arms: "ik",
    hip: [309.5, 454], angTorso: -18.5, angHead: -6,
    ankleN: [92, 449], ankleF: [96, 448],
    angFootN: 135, angFootF: 135, bendKneeN: -1, bendKneeF: -1,
    handN: [494, GROUND - 2], handF: [488, GROUND - 4], bendElbowN: 1, bendElbowF: 1,
  },
  measure(s) {
    // A plank fills a landscape camera frame side to side, so on this stage
    // the equivalent frame is ~300 units tall (the app normalises by frame height).
    const sag = hipSag(s.neck, s.hip, s.ankN) / 300;
    const bend = 180 - angleAt(s.neck, s.hip, s.ankN);
    return {
      score: Math.round(scorePlank(sag)),
      parts: [["Body line", scorePlank(sag)]],
      raw: { sag, bend },
      rows: [["Body line", bend < 4 ? "straight" : `${deg(bend)} bend`],
             ["Hips", sag > 0.03 ? "sagging" : sag < -0.03 ? "piked" : "level"]],
    };
  },
};

/* ── Lunge ───────────────────────────────────────────── */
const lunge = {
  id: "lunge", name: "Lunge", view: "side",
  timing: [1400, 650, 1100, 750],
  top: {
    view: "side", arms: "fk",
    hip: [260, 286], angTorso: -89, angHead: -89,
    ankleN: [370, GROUND], ankleF: [130, 449],
    angFootN: 0, angFootF: 50, bendKneeN: -1, bendKneeF: -1,
    angUpperN: 112, angForeN: 38, angUpperF: 118, angForeF: 48,
  },
  bottom: {
    view: "side", arms: "fk",
    hip: [262, 352], angTorso: -87, angHead: -87,
    ankleN: [370, GROUND], ankleF: [130, 449],
    angFootN: 0, angFootF: 50, bendKneeN: -1, bendKneeF: -1,
    angUpperN: 112, angForeN: 38, angUpperF: 118, angForeF: 48,
  },
  measure(s) {
    const knee = angleAt(s.hip, s.kneeN, s.ankN);
    const lean = leanFromVertical(s.neck, s.hip);
    const { depth, posture } = scoreLunge(knee, lean);
    return {
      score: combine([[depth, 0.55], [posture, 0.45]]),
      parts: [["Depth", depth], ["Posture", posture]],
      raw: { knee, lean },
      rows: [["Front knee", deg(knee)], ["Torso lean", deg(lean)]],
    };
  },
};

/* ── Jumping jack (front view) ───────────────────────── */
const jack = {
  id: "jack", name: "Jumping jack", view: "front",
  timing: [420, 160, 420, 260],
  top: {   // arms down, feet together
    view: "front", arms: "fk",
    hip: [300, 256], angTorso: -90, angHead: -90,
    ankleN: [283, GROUND], ankleF: [317, GROUND],
    angFootN: 180, angFootF: 0, bendKneeN: 1, bendKneeF: -1,
    angUpperN: 100, angForeN: 96, angUpperF: 80, angForeF: 84,
  },
  bottom: {   // arms overhead, feet wide
    view: "front", arms: "fk",
    hip: [300, 266], angTorso: -90, angHead: -90,
    ankleN: [230, GROUND], ankleF: [370, GROUND],
    angFootN: 180, angFootF: 0, bendKneeN: 1, bendKneeF: -1,
    angUpperN: -125, angForeN: -108, angUpperF: -55, angForeF: -72,
  },
  measure(s) {
    const raise = ((s.shN[1] + s.shF[1]) / 2 - (s.wriN[1] + s.wriF[1]) / 2) / STAGE_H;
    const spread = Math.abs(s.ankF[0] - s.ankN[0]) / Math.abs(s.shF[0] - s.shN[0]);
    const ext = scoreJack(raise);
    const legs = Math.min(100, (spread / 1.6) * 100);
    return {
      score: Math.round(ext * 0.7 + legs * 0.3),
      parts: [["Arms", ext], ["Feet", legs]],
      raw: { raise, spread },
      rows: [["Arms", raise > 0.18 ? "fully overhead" : raise > 0 ? "above shoulders" : "down"],
             ["Feet", spread > 1.6 ? "wide" : "together"]],
    };
  },
};

export const EXERCISES = [squat, pushup, plank, lunge, jack];
export const BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
