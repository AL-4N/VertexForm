/**
 * tracking.js — making raw pose landmarks trustworthy (pure, no DOM).
 *
 * MediaPipe is good, but on a webcam it still glitches: a knee jumps onto
 * the other leg for a frame, a wrist vanishes behind the body, the "best
 * visible side" flickers. These helpers clean that up before anything is
 * measured, so session.js only ever grades frames that make physical sense.
 *
 *   boneLengths / boneGlitch   reject frames where a bone suddenly changes length
 *   Calibrator                 2 s "stand still": your bone lengths + your top angle
 *   SideTracker                pick the better-seen side, without flip-flopping
 *   GapFiller                  bridge a joint hidden for ≤ 200 ms, else drop the frame
 *   framingCheck / lightingHint  "step back", "move left", "too dark"
 *   worldAngles / worldWeight  angles from MediaPipe's 3D world landmarks, and
 *                              how much to trust them over the 2D ones
 */

import { LM } from "./config.js";
import { median } from "./geometry.js";

const P = (lms, side, name) => lms[LM[`${side}_${name}`]];
const len = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y, (a.z3 ?? 0) - (b.z3 ?? 0)) : 0);

/* ── Bone lengths ─────────────────────────────────────────── */

const BONES = {
  thigh:    ["HIP", "KNEE"],
  shin:     ["KNEE", "ANKLE"],
  upperArm: ["SHOULDER", "ELBOW"],
  forearm:  ["ELBOW", "WRIST"],
  torso:    ["SHOULDER", "HIP"],
};

/**
 * Bone lengths for one side (or the mean of both, for front-facing
 * exercises), in the landmarks' own units. Pass aspect-corrected landmarks
 * so x and y use the same unit.
 */
export function boneLengths(lms, side) {
  const out = {};
  for (const [bone, [a, b]] of Object.entries(BONES)) {
    out[bone] = side === "BOTH"
      ? (len(P(lms, "LEFT", a), P(lms, "LEFT", b)) + len(P(lms, "RIGHT", a), P(lms, "RIGHT", b))) / 2
      : len(P(lms, side, a), P(lms, side, b));
  }
  return out;
}

/**
 * Has a bone changed length by more than `tol` versus the reference?
 * Moving toward or away from the camera scales every bone together, so
 * each bone is compared after dividing out the overall (median) scale.
 * @returns { glitch, worst: bone name or null, ratio }
 */
export function boneGlitch(cur, ref, tol = 0.25) {
  const ratios = Object.keys(BONES)
    .filter((k) => cur[k] > 1e-4 && ref?.[k] > 1e-4)
    .map((k) => [k, cur[k] / ref[k]]);
  if (ratios.length < 3) return { glitch: false, worst: null, ratio: 1 };
  const scale = median(ratios.map(([, r]) => r));
  let worst = null, worstDev = 0, worstRatio = 1;
  for (const [k, r] of ratios) {
    const dev = Math.abs(r / scale - 1);
    if (dev > worstDev) { worstDev = dev; worst = k; worstRatio = r / scale; }
  }
  return { glitch: worstDev > tol, worst: worstDev > tol ? worst : null, ratio: worstRatio };
}

/** Median of each bone across a list of boneLengths() results. */
export function medianBones(list) {
  const out = {};
  for (const k of Object.keys(BONES)) out[k] = median(list.map((b) => b[k]).filter((v) => v > 0));
  return out;
}

/* ── Calibration ──────────────────────────────────────────── */

const STILL_JOINTS = ["SHOULDER", "HIP", "KNEE", "ANKLE", "WRIST"];

/**
 * Collects frames while you hold still in the start position, then reports
 * your bone lengths and your real "top" value of the rep metric (e.g. the
 * knee angle you actually reach when standing, which is rarely exactly 180°).
 *
 * Non-blocking: feed it frames whenever you're at the top; it finishes once
 * it has `seconds` of stillness in total (movement restarts the clock).
 */
export class Calibrator {
  constructor({ seconds = 1.5, stillTol = 0.05 } = {}) {
    this.seconds = seconds;
    this.stillTol = stillTol;     // max joint movement over 0.5 s, in torso lengths
    this.reset();
  }

  reset() {
    this.frames = [];             // last 0.5 s: { t, pts }
    this.kept = [];               // the current still stretch: { bones, metric }
    this.stillS = 0;
    this.stillNow = 0;
    this.lastT = null;
    this.result = null;
  }

  get progress() { return this.result ? 1 : Math.min(1, this.stillS / this.seconds); }

  /** Seconds you've been holding still right now (keeps counting after calibration). */
  get stillFor() { return this.stillNow; }

  /**
   * @param lms    aspect-corrected landmarks
   * @param side   "LEFT" | "RIGHT" | "BOTH"
   * @param metric the exercise's rep metric for this frame
   * @param t      ms
   * @returns the result once complete ({ bones, topMetric }), else null
   */
  update(lms, side, metric, t) {
    const s = side === "BOTH" ? "LEFT" : side;
    const pts = STILL_JOINTS.map((n) => P(lms, s, n));
    const bones = boneLengths(lms, side);
    const torso = bones.torso || 1e-3;
    const dt = this.lastT == null ? 0 : Math.min(0.25, (t - this.lastT) / 1000);
    this.lastT = t;

    // Movement: the farthest any key joint moved over the last ~0.5 s.
    this.frames.push({ t, pts });
    while (this.frames.length && t - this.frames[0].t > 500) this.frames.shift();
    const first = this.frames[0];
    const moved = Math.max(...pts.map((p, i) => (p && first.pts[i] ? Math.hypot(p.x - first.pts[i].x, p.y - first.pts[i].y) : 0))) / torso;

    if (moved > this.stillTol) {
      this.stillNow = 0;
      if (!this.result) { this.stillS = 0; this.kept = []; }
      return this.result;
    }
    this.stillNow += dt;
    if (this.result) return this.result;
    this.kept.push({ bones, metric });
    this.stillS += dt;
    if (this.stillS >= this.seconds && this.kept.length >= 5) {
      this.result = {
        bones: medianBones(this.kept.map((f) => f.bones)),
        topMetric: median(this.kept.map((f) => f.metric)),
      };
    }
    return this.result;
  }
}

/**
 * Personalised "rep finished" threshold: the exercise's default, but never
 * so close to your real top position that you can't reach it (a knee that
 * reads 158° when you stand straight would never pass a 160° threshold).
 * Stays at least `minGap` above the deep threshold so reps still make sense.
 */
export function personalShallow(ex, topMetric) {
  if (topMetric == null || !Number.isFinite(topMetric)) return ex.shallowThreshold;
  const margin = ex.topMargin ?? 6;
  const minGap = ex.minRange ?? 12;
  return Math.max(ex.deepThreshold + minGap, Math.min(ex.shallowThreshold, topMetric - margin));
}

/* ── Side selection with hysteresis ───────────────────────── */

/**
 * Picks LEFT or RIGHT from per-side scores (higher = better). Switches only
 * after the other side has been clearly better (by `margin`) for `holdMs`
 * straight, so the measured leg doesn't flip frame to frame.
 */
export class SideTracker {
  constructor({ holdMs = 500, margin = 0.15 } = {}) {
    this.holdMs = holdMs;
    this.margin = margin;
    this.side = null;
    this.since = null;
    this.switches = 0;
  }

  update(scores, t) {
    const best = scores.LEFT >= scores.RIGHT ? "LEFT" : "RIGHT";
    if (this.side == null) { this.side = best; return this.side; }
    const other = this.side === "LEFT" ? "RIGHT" : "LEFT";
    if (scores[other] > scores[this.side] + this.margin) {
      this.since ??= t;
      if (t - this.since >= this.holdMs) {
        this.side = other;
        this.since = null;
        this.switches++;
      }
    } else {
      this.since = null;
    }
    return this.side;
  }
}

/** Default side score: how well the camera sees that side's hip, knee and shoulder. */
export const visibilityScore = (lms, side) =>
  ["HIP", "KNEE", "SHOULDER", "ANKLE"].reduce((a, n) => a + (P(lms, side, n)?.visibility ?? 0), 0) / 4;

/* ── Occlusion: bridge short gaps ─────────────────────────── */

/**
 * For the joints an exercise measures: if one drops out of view, reuse its
 * last good position (nudged along its last velocity) for up to `maxGapMs`.
 * Longer than that, the frame is dropped instead of measuring garbage.
 */
export class GapFiller {
  constructor({ maxGapMs = 200, minVis = 0.5 } = {}) {
    this.maxGapMs = maxGapMs;
    this.minVis = minVis;
    this.last = new Map();       // index → { x, y, z, t, vx, vy }
    this.filledFrames = 0;
  }

  reset() { this.last.clear(); }

  /**
   * @param lms  landmarks (any units)
   * @param ids  landmark indices that must be trustworthy
   * @returns { lms, filled: [ids], dropped: bool }
   */
  apply(lms, ids, t) {
    const out = lms.slice();
    const filled = [];
    let dropped = false;
    for (const i of ids) {
      const p = lms[i];
      const prev = this.last.get(i);
      if (p && (p.visibility ?? 1) >= this.minVis) {
        const dt = prev ? (t - prev.t) / 1000 : 0;
        const vx = prev && dt > 0 && dt < 0.2 ? (p.x - prev.x) / dt : 0;
        const vy = prev && dt > 0 && dt < 0.2 ? (p.y - prev.y) / dt : 0;
        this.last.set(i, { x: p.x, y: p.y, z: p.z ?? 0, t, vx, vy });
        continue;
      }
      if (prev && t - prev.t <= this.maxGapMs) {
        // Half the last velocity: enough to follow the motion, too little to overshoot.
        const dt = (t - prev.t) / 1000;
        out[i] = { x: prev.x + prev.vx * dt * 0.5, y: prev.y + prev.vy * dt * 0.5, z: prev.z, visibility: this.minVis };
        filled.push(i);
      } else {
        dropped = true;
      }
    }
    if (filled.length) this.filledFrames++;
    return { lms: out, filled, dropped };
  }
}

/** Landmark indices an exercise needs on one side. */
export function keyJointIds(names, side) {
  const sides = side === "BOTH" ? ["LEFT", "RIGHT"] : [side];
  return sides.flatMap((s) => names.map((n) => LM[`${s}_${n}`]));
}

/* ── Framing and lighting ─────────────────────────────────── */

const BODY_IDS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];

/**
 * Is the whole body in the picture, with some margin? Works on raw
 * (normalised 0..1) landmarks, in DISPLAY coordinates (mirrored if the
 * picture is mirrored), so "move left" means left on the screen you see.
 * @returns { ok, hint, box: {x0,y0,x1,y1} | null }
 */
export function framingCheck(lms, { mirror = true, margin = 0.03, minVis = 0.5 } = {}) {
  if (!lms) return { ok: false, hint: "Step into the frame", box: null };
  const vis = (i) => (lms[i]?.visibility ?? 0) >= minVis;
  const pts = BODY_IDS.filter(vis).map((i) => ({ x: mirror ? 1 - lms[i].x : lms[i].x, y: lms[i].y }));
  if (pts.length < 6) return { ok: false, hint: "Step into the frame", box: null };

  const box = {
    x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)),
  };
  // The head reaches above the nose; leave room for it.
  if (vis(0)) box.y0 -= Math.max(0.03, (box.y1 - box.y0) * 0.06);

  const feetSeen = [27, 28].some(vis);
  const headSeen = vis(0) || [11, 12].some(vis);
  const cutTop = !headSeen || box.y0 < margin;
  const cutBottom = !feetSeen || box.y1 > 1 - margin;
  const cutLeft = box.x0 < margin;
  const cutRight = box.x1 > 1 - margin;
  const tall = box.y1 - box.y0, wide = box.x1 - box.x0;

  // Directions are as seen on the screen: clear when you're side-on (where
  // "your left" would mean forward or back) and right for either mirroring.
  let hint = null;
  if ((cutTop && cutBottom) || (cutLeft && cutRight)) hint = "Step back so I can see you head to toe";
  else if (cutBottom) hint = "Feet are cut off: lower the camera or tilt it down";
  else if (cutTop) hint = "Head is cut off: raise the camera or tilt it up";
  else if (cutLeft) hint = "Move a step to the right (as you see it on screen)";
  else if (cutRight) hint = "Move a step to the left (as you see it on screen)";
  else if (Math.max(tall, wide) < 0.35) hint = "Step a little closer";
  return { ok: !hint, hint, box };
}

/** Mean frame brightness (0..255) → a hint if it's too dark to track well. */
export function lightingHint(luma) {
  if (luma == null) return null;
  if (luma < 40) return "It's too dark: turn on a light in front of you";
  return null;
}

/* ── 3D world landmarks ───────────────────────────────────── */

/**
 * Angles from MediaPipe's worldLandmarks (metres, hip-centred). These don't
 * shrink when you turn away from a perfect side view, which 2D angles do,
 * but their depth axis is the model's guess and is noticeably noisier.
 */
export function worldAngles(world, side) {
  if (!world) return null;
  const W = (n) => {
    const p = P(world, side, n);
    return p ? { x: p.x, y: p.y, z3: p.z ?? 0 } : null;
  };
  const a3 = (a, b, c) => {
    if (!a || !b || !c) return NaN;
    const u = [a.x - b.x, a.y - b.y, a.z3 - b.z3], v = [c.x - b.x, c.y - b.y, c.z3 - b.z3];
    const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const m = Math.hypot(...u) * Math.hypot(...v) + 1e-9;
    return (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI;
  };
  const sh = W("SHOULDER"), hip = W("HIP"), knee = W("KNEE"), ank = W("ANKLE");
  const elb = W("ELBOW"), wri = W("WRIST");
  // Lean: torso vs the camera's vertical axis (y), in full 3D.
  const lean = sh && hip
    ? (Math.atan2(Math.hypot(sh.x - hip.x, sh.z3 - hip.z3), Math.abs(sh.y - hip.y)) * 180) / Math.PI
    : NaN;
  return {
    knee: a3(hip, knee, ank),
    elbow: a3(sh, elb, wri),
    bodyLine: 180 - a3(sh, hip, ank),
    lean,
  };
}

/**
 * How much to trust the 3D angle over the 2D one (0 = 2D only).
 *
 * The choice, and why: a camera that sees you exactly side-on measures
 * knee, elbow, hip-line and torso angles almost perfectly in 2D (after
 * aspect correction) — they lie in the picture plane. MediaPipe's 3D world
 * landmarks have the same angles without that requirement, but their depth
 * is inferred and adds several degrees of frame-to-frame noise
 * (tests/eval-angles.mjs measures both). So: pure 2D when you're side-on,
 * and up to a 50/50 blend as you turn toward the camera, where 2D angles
 * start reading too straight.
 *
 * @param facing  shoulder width / torso length (≈0.1 side-on, ≈0.5 facing)
 */
export function worldWeight(facing) {
  if (facing == null || !Number.isFinite(facing)) return 0;
  return Math.max(0, Math.min(0.5, (facing - 0.15) / 0.5));
}

/** Blend 2D measurements with 3D ones for the keys both have. */
export function fuseAngles(m, w3, weight) {
  if (!w3 || weight <= 0) return m;
  const out = { ...m };
  for (const k of ["knee", "elbow", "bodyLine", "lean"]) {
    if (typeof m[k] === "number" && Number.isFinite(w3[k])) out[k] = m[k] * (1 - weight) + w3[k] * weight;
  }
  return out;
}

