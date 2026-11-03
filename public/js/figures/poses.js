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

import { angleAt, thighDepth, leanFromVertical, hipSag, SEG } from "./rig.js";
import { scoreSquat, scorePushup, scorePike, scorePlank, scoreLunge, scoreJack, scoreHollow, scoreClimber, scoreHang, scoreSplitSquat, scorePistol, scoreDip, scorePullup, scoreRow, scoreLSit, scoreVSit, combine } from "../scoring.js";

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

/* ── Pike push-up (hips high, head lowers toward the floor) ── */
// Hip angle ~90° top and bottom; the bottom bends the elbows to ~58°.
// lowTop / lowBottom: the same rep with the hips dropped (~133°), the fault.
const PIKE_BASE = {
  view: "side", arms: "ik", angFootN: 135, angFootF: 135, bendKneeN: -1, bendKneeF: -1,
  handN: [449, GROUND], handF: [443, GROUND - 2], bendElbowN: 1, bendElbowF: 1,   // arms near locked at the top
};
const pike = {
  id: "pike", name: "Pike push-up", view: "side",
  timing: [1200, 400, 1000, 700],
  top:       { ...PIKE_BASE, hip: [300, 285],   angTorso: 40, angHead: 62, ankleN: [163, 449], ankleF: [167, 448] },
  bottom:    { ...PIKE_BASE, hip: [334, 314],   angTorso: 52, angHead: 66, ankleN: [163, 449], ankleF: [167, 448] },
  lowTop:    { ...PIKE_BASE, hip: [273.5, 336], angTorso: 15, angHead: 40, ankleN: [92, 449],  ankleF: [96, 448] },
  lowBottom: { ...PIKE_BASE, hip: [295.4, 362], angTorso: 25, angHead: 50, ankleN: [100, 449], ankleF: [104, 448] },
  measure(s) {
    const elbow = angleAt(s.shN, s.elbN, s.wriN);
    const hip = angleAt(s.neck, s.hip, s.ankN);
    const { depth, hips } = scorePike(elbow, hip);
    return {
      score: combine([[depth, 0.6], [hips, 0.4]]),
      parts: [["Depth", depth], ["Hips high", hips]],
      raw: { elbow, hip },
      rows: [["Elbow angle", deg(elbow)], ["Hip angle", deg(hip)]],
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

/* ── Side plank (forearm, top arm up; a hold that sags, then corrects) ── */
const sidePlank = {
  id: "side_plank", name: "Side plank", view: "side",
  good: "top",
  timing: [1300, 1100, 900, 2200],
  top: {
    view: "side", arms: "ik",
    hip: [335, 420], angTorso: -9.2, angHead: -9,
    ankleN: [120, 455], ankleF: [124, 452],
    angFootN: 135, angFootF: 135, bendKneeN: 1, bendKneeF: 1,
    handN: [519, GROUND - 2], handF: [470, 290], bendElbowN: -1, bendElbowF: 1,
  },
  bottom: null,          // set below: the top with the hips dropped
  measure: (s) => plank.measure(s),
};

/* ── Hollow hold (on the back; a hold that sinks flat, then lifts) ── */
const hollow = {
  id: "hollow", name: "Hollow hold", view: "side",
  good: "top",
  timing: [1300, 1000, 900, 2200],
  top: {   // the hollow: shoulders and legs off the floor
    view: "side", arms: "fk",
    hip: [300, 456], angTorso: -15, angHead: -15,
    ankleN: [97, 384], ankleF: [101, 386],
    angFootN: 200, angFootF: 200, bendKneeN: 1, bendKneeF: 1,
    angUpperN: -10, angForeN: -5, angUpperF: -12, angForeF: -7,
  },
  bottom: {   // sinking flat
    view: "side", arms: "fk",
    hip: [300, 458], angTorso: -5, angHead: -6,
    ankleN: [84, 440], ankleF: [88, 441],
    angFootN: 190, angFootF: 190, bendKneeN: 1, bendKneeF: 1,
    angUpperN: -2, angForeN: 0, angUpperF: -4, angForeF: -2,
  },
  measure(s) {
    const hip = angleAt(s.neck, s.hip, s.ankN);
    const shape = scoreHollow(hip);
    return { score: Math.round(shape), parts: [["Body shape", shape]], raw: { hip }, rows: [["Hip angle", deg(hip)]] };
  },
};

/* ── Mountain climber (high plank; the near knee drives to the chest) ── */
const climber = {
  id: "climber", name: "Mountain climber", view: "side",
  timing: [380, 120, 380, 260],
  top: { ...pushup.top, footLift: true },
  // Mid-drive the hips lift as the knee passes under them (rig.js poseAt),
  // or the knee would have to go through the floor.
  mid: { ...pushup.top, footLift: true, hip: [332, 350], angTorso: 3.5, angHead: 8, ankleN: [250, 446], bendKneeN: -1 },
  bottom: { ...pushup.top, footLift: true, ankleN: [330, 463], bendKneeN: -1 },   // knee forward under the chest
  measure(s) {
    const hip = angleAt(s.neck, s.hip, s.kneeN);
    const lineBreak = 180 - angleAt(s.neck, s.hip, s.ankF);
    const { drive, line } = scoreClimber(hip, lineBreak);
    return {
      score: combine([[drive, 0.6], [line, 0.4]]),
      parts: [["Knee drive", drive], ["Body line", line]],
      raw: { hip, lineBreak },
      rows: [["Hip angle", deg(hip)], ["Body line", lineBreak < 6 ? "straight" : `${deg(lineBreak)} bend`]],
    };
  },
};

/* ── Dead hang (front view, from a bar above the frame) ── */
const HANG = {
  view: "front", arms: "fk",
  hip: [300, 200], angTorso: -90, angHead: -90,
  ankleN: [287, 417], ankleF: [313, 417],                    // straight down from each hip
  angFootN: 96, angFootF: 84, bendKneeN: -1, bendKneeF: -1,
  angUpperN: -97, angForeN: -94, angUpperF: -83, angForeF: -86,
};
const hang = {
  id: "hang", name: "Dead hang", view: "front",
  good: "top",
  timing: [1400, 900, 1400, 1800],
  top: HANG,
  bottom: { ...HANG, hip: [306, 200], ankleN: [295, 417], ankleF: [321, 417] },   // a small sideways sway
  measure(s) {
    const elbow = Math.min(angleAt(s.shN, s.elbN, s.wriN), angleAt(s.shF, s.elbF, s.wriF));
    const arms = scoreHang(elbow);
    return { score: Math.round(arms), parts: [["Straight arms", arms]], raw: { elbow }, rows: [["Elbows", deg(elbow)]] };
  },
};

sidePlank.bottom = { ...sidePlank.top, hip: [335, 446], angTorso: -19.8, angHead: -17 };   // hips drop, shoulder stays over the elbow

/* ── Bulgarian split squat (side view, back foot up on a bench) ── */
const BENCH_TOP = 372;                                   // a knee-high bench behind
const splitSquat = {
  id: "split_squat", name: "Bulgarian split squat", view: "side",
  timing: [1400, 650, 1100, 750],
  prop: { bench: [116, 180, BENCH_TOP] },               // x0, x1, top: drawn under the back foot
  top: {
    view: "side", arms: "fk",
    hip: [262, 287], angTorso: -86, angHead: -86,
    ankleN: [372, GROUND], ankleF: [150, BENCH_TOP - 6],
    angFootN: 0, angFootF: 160, bendKneeN: -1, bendKneeF: -1,
    angUpperN: 104, angForeN: 64, angUpperF: 110, angForeF: 70,
  },
  bottom: {
    view: "side", arms: "fk",
    hip: [266, 364], angTorso: -80, angHead: -82,
    ankleN: [372, GROUND], ankleF: [150, BENCH_TOP - 6],
    angFootN: 0, angFootF: 160, bendKneeN: -1, bendKneeF: -1,
    angUpperN: 100, angForeN: 60, angUpperF: 106, angForeF: 66,
  },
  measure(s) {
    const knee = angleAt(s.hip, s.kneeN, s.ankN);
    const lean = leanFromVertical(s.neck, s.hip);
    const { depth, posture } = scoreSplitSquat(knee, lean);
    return {
      score: combine([[depth, 0.65], [posture, 0.35]]),
      parts: [["Depth", depth], ["Posture", posture]],
      raw: { knee, lean },
      rows: [["Front knee", deg(knee)], ["Torso lean", deg(lean)]],
    };
  },
};

/* ── Pistol squat (side view, on one leg, the other held out in front) ── */
const pistol = {
  id: "pistol", name: "Pistol squat", view: "side",
  timing: [1700, 600, 1300, 900],
  top: {
    view: "side", arms: "fk",
    hip: [292, 259], angTorso: -86, angHead: -86,
    ankleN: [300, GROUND], ankleF: [488, 352],
    angFootN: 0, angFootF: -50, bendKneeN: -1, bendKneeF: -1,
    angUpperN: -6, angForeN: -4, angUpperF: -10, angForeF: -8,
  },
  bottom: {
    view: "side", arms: "fk",
    hip: [238, 398], angTorso: -48, angHead: -40,
    ankleN: [300, GROUND], ankleF: [450, 384],
    angFootN: 0, angFootF: -70, bendKneeN: -1, bendKneeF: -1,
    angUpperN: -4, angForeN: -2, angUpperF: -8, angForeF: -6,
  },
  measure(s) {
    const knee = angleAt(s.hip, s.kneeN, s.ankN);
    const depth = thighDepth(s.hip, s.kneeN);
    const lift = (s.ankN[1] - s.ankF[1]) / (SEG.thigh + SEG.shin);   // the free foot's height, in leg lengths
    const { depth: d, freeLeg } = scorePistol(depth, lift);
    return {
      score: combine([[d, 0.7], [freeLeg, 0.3]]),
      parts: [["Depth", d], ["Free leg up", freeLeg]],
      raw: { knee, depth, lift },
      rows: [["Standing knee", deg(knee)], ["Depth", depth <= 0 ? `${deg(-depth)} below parallel` : `${deg(depth)} above parallel`]],
    };
  },
};

/* ── Dips (side view, on parallel bars at hip height) ── */
const BARS = [300, 212];
const dips = {
  id: "dips", name: "Dips", view: "side",
  timing: [1200, 400, 1000, 700],
  prop: { bars: BARS },
  top: {
    view: "side", arms: "ik",
    hip: [293, 234], angTorso: -88, angHead: -88,
    ankleN: [232, 418], ankleF: [226, 414],
    angFootN: 110, angFootF: 110, bendKneeN: -1, bendKneeF: -1,
    handN: BARS, handF: [BARS[0] - 4, BARS[1] - 2], bendElbowN: -1, bendElbowF: -1,
  },
  bottom: {
    view: "side", arms: "ik",
    hip: [250, 268], angTorso: -76, angHead: -72,
    ankleN: [188, 436], ankleF: [182, 432],
    angFootN: 110, angFootF: 110, bendKneeN: -1, bendKneeF: -1,
    handN: BARS, handF: [BARS[0] - 4, BARS[1] - 2], bendElbowN: -1, bendElbowF: -1,
  },
  measure(s) {
    const elbow = angleAt(s.shN, s.elbN, s.wriN);
    const drop = (s.shN[1] - s.elbN[1]) / STAGE_H;            // + = shoulder below the elbow
    const { depth, lockout } = scoreDip(elbow);
    return {
      score: Math.round(depth),
      parts: [["Depth", depth]],
      raw: { elbow, drop, lockout },
      rows: [["Elbow at the bottom", deg(elbow)]],
    };
  },
};

/* ── Pull-up (front view, under a bar near the top of the frame) ── */
const BAR_Y = 46;
const pullup = {
  id: "pullup", name: "Pull-up", view: "front",
  timing: [900, 450, 1100, 900],
  prop: { overhead: [214, 386, BAR_Y] },
  ground: false,                                          // the feet hang free: no floor line
  top: {   // the hang: arms straight up to the bar, feet hanging
    view: "front", arms: "ik",
    hip: [300, 288], angTorso: -90, angHead: -90,
    ankleN: [292, 503], ankleF: [308, 503],
    angFootN: 100, angFootF: 80, bendKneeN: -1, bendKneeF: -1,
    handN: [262, BAR_Y], handF: [338, BAR_Y], bendElbowN: -1, bendElbowF: 1,
  },
  bottom: {   // chin over the bar: elbows bent out to the sides
    view: "front", arms: "ik",
    hip: [300, 188], angTorso: -90, angHead: -90,
    ankleN: [292, 403], ankleF: [308, 403],
    angFootN: 100, angFootF: 80, bendKneeN: -1, bendKneeF: -1,
    handN: [262, BAR_Y], handF: [338, BAR_Y], bendElbowN: -1, bendElbowF: 1,
  },
  measure(s) {
    const elbow = Math.min(angleAt(s.shN, s.elbN, s.wriN), angleAt(s.shF, s.elbF, s.wriF));
    const chin = (Math.min(s.wriN[1], s.wriF[1]) - (s.head[1] + 19)) / SEG.torso;   // chin height over the bar, in torso lengths
    const { top, pull } = scorePullup(chin, elbow);
    return {
      score: combine([[top, 0.7], [pull, 0.3]]),
      parts: [["Chin over the bar", top], ["Arms bent", pull]],
      raw: { elbow, chin },
      rows: [["Elbows", deg(elbow)], ["Chin", chin >= 0 ? "over the bar" : "under the bar"]],
    };
  },
};
/* A negative: jump to the top, then lower slowly back to the hang (3 s or more). */
const negative = {
  ...pullup, id: "negative", name: "Negative pull-up", timing: [500, 600, 3300, 1100],
  // Graded on the lowering (timed by the trainer, not visible in one pose) and the start at the top.
  measure(s) {
    const m = pullup.measure(s);
    return { ...m, score: Math.round(combine([[100, 0.7], [m.parts[0][1], 0.3]])), parts: [["Slow lowering", 100], m.parts[0]] };
  },
};

/* ── Australian row (side view, lying under a bar at waist height) ── */
const ROW_BAR = [250, 290];
const row = {
  id: "row", name: "Australian row", view: "side",
  timing: [1000, 400, 1200, 700],
  prop: { bars: ROW_BAR },
  top: {   // arms straight, hanging under the bar, heels on the floor
    view: "side", arms: "ik",
    hip: [380, 426], angTorso: -169, angHead: -169,
    ankleN: [589, 463], ankleF: [585, 461],
    angFootN: -70, angFootF: -70, bendKneeN: -1, bendKneeF: -1,
    handN: ROW_BAR, handF: [ROW_BAR[0] + 2, ROW_BAR[1] - 1], bendElbowN: 1, bendElbowF: 1,   // elbows drive back toward the feet
  },
  bottom: {   // chest up to the bar, body still in one line
    view: "side", arms: "ik",
    hip: [384, 399], angTorso: -162, angHead: -162,
    ankleN: [589, 463], ankleF: [585, 461],
    angFootN: -70, angFootF: -70, bendKneeN: -1, bendKneeF: -1,
    handN: ROW_BAR, handF: [ROW_BAR[0] + 2, ROW_BAR[1] - 1], bendElbowN: 1, bendElbowF: 1,   // elbows drive back toward the feet
  },
  measure(s) {
    const elbow = angleAt(s.shN, s.elbN, s.wriN);
    const bendOff = 180 - angleAt(s.neck, s.hip, s.ankN);
    const { pull, line } = scoreRow(elbow, bendOff);
    return {
      score: combine([[pull, 0.6], [line, 0.4]]),
      parts: [["Pull", pull], ["Body line", line]],
      raw: { elbow, bendOff },
      rows: [["Elbow at the top", deg(elbow)], ["Body line", bendOff < 6 ? "straight" : `${deg(bendOff)} bend`]],
    };
  },
};

/* ── L-sit and V-sit (side view, hands on low parallettes beside the hips) ── */
const PARALLETTES = [300, 404];
const SIT_ARMS = { arms: "ik", handN: PARALLETTES, handF: [PARALLETTES[0] - 3, PARALLETTES[1] - 1], bendElbowN: 1, bendElbowF: 1 };
function sitMeasure(scoreFn, legsLabel) {
  return (s) => {
    const hipAngle = angleAt(s.neck, s.hip, s.ankN);
    const knee = angleAt(s.hip, s.kneeN, s.ankN);
    const lift = (s.hip[1] - s.ankN[1]) / (SEG.thigh + SEG.shin);       // + = feet above the hips, in leg lengths
    const { legs, straight } = scoreFn(hipAngle, lift, knee);
    return {
      score: combine([[legs, 0.7], [straight, 0.3]]),
      parts: [[legsLabel, legs], ["Straight legs", straight]],
      raw: { hipAngle, lift, knee },
      rows: [["Hip angle", deg(hipAngle)], ["Knees", deg(knee)]],
    };
  };
}
const lsit = {
  id: "lsit", name: "L-sit", view: "side", good: "top",
  timing: [1600, 1200, 1600, 1400],
  prop: { parallettes: PARALLETTES },
  top: {   // legs straight out at hip height
    view: "side", ...SIT_ARMS,
    hip: [284, 424], angTorso: -85, angHead: -86,
    ankleN: [500, 419], ankleF: [496, 417],
    angFootN: -20, angFootF: -20, bendKneeN: -1, bendKneeF: -1,
  },
  bottom: {   // the legs sinking toward the floor
    view: "side", ...SIT_ARMS,
    hip: [284, 424], angTorso: -85, angHead: -86,
    ankleN: [488, 466], ankleF: [484, 464],
    angFootN: 10, angFootF: 10, bendKneeN: -1, bendKneeF: -1,
  },
  measure: sitMeasure(scoreLSit, "Legs level"),
};
const vsit = {
  id: "vsit", name: "V-sit", view: "side", good: "top",
  timing: [1600, 1200, 1600, 1400],
  prop: { parallettes: PARALLETTES },
  top: {   // leaning back, legs raised well above the hips
    view: "side", ...SIT_ARMS,
    hip: [280, 420], angTorso: -70, angHead: -68,
    ankleN: [446, 281], ankleF: [442, 279],
    angFootN: -60, angFootF: -60, bendKneeN: -1, bendKneeF: -1,
  },
  bottom: {   // legs down to level: an L-sit, not a V
    view: "side", ...SIT_ARMS,
    hip: [280, 420], angTorso: -70, angHead: -68,
    ankleN: [496, 412], ankleF: [492, 410],
    angFootN: -20, angFootF: -20, bendKneeN: -1, bendKneeF: -1,
  },
  measure: sitMeasure(scoreVSit, "Legs high"),
};

export const EXERCISES = [squat, pushup, plank, lunge, jack, pike, sidePlank, hollow, climber, hang, splitSquat, pistol, dips, pullup, negative, row, lsit, vsit];
export const BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
