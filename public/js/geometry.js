/**
 * geometry.js — pure measurement math.
 * Direct port of the verified Python engine. No DOM, no side effects,
 * which makes every function here unit-testable on its own.
 *
 * Landmark objects are {x, y, z, visibility} with x/y normalised 0..1,
 * and y growing DOWNWARD (0 = top of frame) — same as MediaPipe.
 */

import { LM, VIS_THRESHOLD } from "./config.js";
import { gradeColor } from "./grade.js";

/** Angle at point B formed by A-B-C, in degrees (0..180). */
export function angleBetween(a, b, c) {
  const bax = a.x - b.x, bay = a.y - b.y;
  const bcx = c.x - b.x, bcy = c.y - b.y;
  const dot = bax * bcx + bay * bcy;
  const mag = Math.hypot(bax, bay) * Math.hypot(bcx, bcy) + 1e-6;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

/** Degrees the top→bottom line deviates from vertical. 0 = perfectly upright. */
export function leanFromVertical(top, bottom) {
  const dx = Math.abs(top.x - bottom.x);
  const dy = Math.abs(top.y - bottom.y);
  return Math.atan2(dx, dy) * 180 / Math.PI;
}

/** Degrees a line sits off horizontal. 0 = perfectly flat. */
export function lineFromHorizontal(p1, p2) {
  const dx = Math.abs(p2.x - p1.x) + 1e-6;
  const dy = p2.y - p1.y;
  return Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
}

/**
 * Thigh angle relative to the ground, in degrees.
 *   0  = thigh parallel to the ground (a "parallel" squat)
 *   +  = hip ABOVE the knee (shallower than parallel)
 *   -  = hip BELOW the knee (deeper than parallel)
 *
 * This is the true coaching meaning of "parallel". Comparing raw landmark
 * heights instead is biased, because MediaPipe's hip point sits at the joint
 * centre — noticeably higher than the hip crease.
 */
export function thighAngleDeg(hip, knee) {
  const dy = hip.y - knee.y;                 // + = hip lower on screen = deeper
  const dx = Math.abs(hip.x - knee.x) + 1e-6;
  return Math.atan2(-dy, dx) * 180 / Math.PI;
}

/** How far the hip sits off the shoulder→ankle line. + = sagging, − = piked. */
export function signedBodySag(lms, side) {
  const sh  = lms[LM[`${side}_SHOULDER`]];
  const hip = lms[LM[`${side}_HIP`]];
  const ank = lms[LM[`${side}_ANKLE`]];
  const ax = ank.x - sh.x, ay = ank.y - sh.y;
  const hx = hip.x - sh.x, hy = hip.y - sh.y;
  const t  = (hx * ax + hy * ay) / (ax * ax + ay * ay + 1e-6);
  const projY = sh.y + t * ay;
  return hip.y - projY;
}

/**
 * Sag relative to body length, rescaled to "a plank that fills a 16:9 frame"
 * (shoulder→ankle ≈ 1.3 frame heights) so the scoring curves calibrated in
 * frame units still apply. Unlike raw sag, this doesn't change with how far
 * you are from the camera.
 */
export const SAG_REF_BODY = 1.3;
export function relativeSag(lms, side) {
  const sh  = lms[LM[`${side}_SHOULDER`]];
  const ank = lms[LM[`${side}_ANKLE`]];
  const body = Math.hypot(ank.x - sh.x, ank.y - sh.y) || 1e-6;
  return (signedBodySag(lms, side) / body) * SAG_REF_BODY;
}

/** Nose position relative to the shoulder — proxy for craning the neck down. */
export function headDrop(lms, side) {
  const nose = lms[LM.NOSE];
  const sh   = lms[LM[`${side}_SHOULDER`]];
  if (!nose || !sh) return 0;
  return nose.y - sh.y;
}

/** Forward knee travel past the ankle, as a fraction of shin length. */
export function kneeTravel(lms, side) {
  const knee = lms[LM[`${side}_KNEE`]];
  const ank  = lms[LM[`${side}_ANKLE`]];
  const shin = Math.hypot(knee.x - ank.x, knee.y - ank.y);
  if (shin < 1e-4) return 0;
  return Math.abs(knee.x - ank.x) / shin;
}

/** Whichever body side the camera can see best. */
export function detectSide(lms) {
  const score = (s) =>
    (lms[LM[`${s}_HIP`]]?.visibility ?? 0) +
    (lms[LM[`${s}_KNEE`]]?.visibility ?? 0) +
    (lms[LM[`${s}_SHOULDER`]]?.visibility ?? 0);
  return score("LEFT") >= score("RIGHT") ? "LEFT" : "RIGHT";
}

/** Mean visibility of the joints that matter, 0..1. */
export function trackingQuality(lms, side) {
  const names = ["SHOULDER", "HIP", "KNEE", "ANKLE", "ELBOW"];
  const vals = names
    .map((n) => lms[LM[`${side}_${n}`]]?.visibility)
    .filter((v) => typeof v === "number");
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function isTrusted(lms, side) {
  return trackingQuality(lms, side) >= VIS_THRESHOLD;
}

/* ── Series helpers ─────────────────────────────────────── */

export const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const mean = (arr) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

export const stdev = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
};

/**
 * Indices of the frames within `frac` of the extreme — i.e. the "held" part
 * at the bottom of a rep. Scoring the median across this window instead of a
 * single frame is what makes results stable against pose jitter.
 */
export function bottomWindow(values, mode = "max", frac = 0.03) {
  if (!values.length) return [];
  const ext = mode === "max" ? Math.max(...values) : Math.min(...values);
  const idxs = [];
  values.forEach((v, i) => {
    if (mode === "max" ? v >= ext - frac : v <= ext + frac) idxs.push(i);
  });
  return idxs.length ? idxs : [values.indexOf(ext)];
}

/** Moving-average smoothing over a list of landmark arrays. */
export function smoothSeries(frames, win = 5) {
  if (frames.length < 3) return frames;
  const half = win >> 1;
  return frames.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(frames.length, i + half + 1);
    const slice = frames.slice(lo, hi);
    return frames[i].map((_, j) => ({
      x: mean(slice.map((f) => f[j].x)),
      y: mean(slice.map((f) => f[j].y)),
      z: mean(slice.map((f) => f[j].z ?? 0)),
      visibility: mean(slice.map((f) => f[j].visibility ?? 0)),
    }));
  });
}

export const gradeLetter = (s) =>
  s >= 90 ? "A" : s >= 80 ? "B" : s >= 70 ? "C" : s >= 60 ? "D" : "F";

/** Colour for a score: its exact spot on the coral→green grade scale (js/grade.js). */
export const gradeVar = (s) => gradeColor(s);
