/**
 * guide.js — the ideal "good rep" guide, as geometry (pure, tested).
 *
 * Built from YOUR limb lengths (calibrated, else measured this frame),
 * anchored where you're planted (your ankle; for floor exercises your
 * shoulder→ankle line), and pointed the way you face — from the facing vote
 * in tracking.js, never guessed from a single frame. No confident facing,
 * no guide: better none than a backwards one.
 *
 * Everything is in camera-image pixels (unmirrored). mirrorGuide() flips a
 * guide for a mirrored picture, so it always matches the video.
 *
 *   squat / lunge   target pose at the bottom (ankle → knee → hip → shoulder),
 *                   a "parallel" depth line at knee height, and a torso-lean
 *                   wedge (green zone = good lean)
 *   push-up / plank a straight shoulder → ankle target line with a tolerance band
 *   jumping jack    arm-height target markers above the shoulders
 */

import { LM } from "./config.js";

const rad = (d) => (d * Math.PI) / 180;
const P = (lms, side, n) => lms[LM[`${side}_${n}`]];

/** Pixel point from a normalised landmark. */
const px = (p, w, h) => ({ x: p.x * w, y: p.y * h });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Per-exercise target shape: shin angle from vertical, thigh angle above horizontal, torso lean range. */
const TARGET = {
  squat: { shin: 15, thigh: 0, lean: 25, wedge: [0, 32] },
  lunge: { shin: 0, thigh: 4, lean: 6, wedge: [0, 16] },
};

/**
 * @param kind     "squat" | "lunge" | "line" | "arms"  (exercise.guide)
 * @param lms      raw normalised landmarks (smoothed)
 * @param o        { side, facing: +1 | -1, facingConfidence, w, h, bones (aspect-corrected units, optional), minConfidence }
 * @returns guide geometry, or null when there's nothing trustworthy to draw
 */
export function buildGuide(kind, lms, { side, facing, facingConfidence = 1, w, h, bones = null, minConfidence = 0.35 }) {
  if (!lms || !kind) return null;
  const head = headZone(lms, side, w, h);

  if (kind === "arms") {
    const ls = px(lms[LM.LEFT_SHOULDER], w, h), rs = px(lms[LM.RIGHT_SHOULDER], w, h);
    const lh = px(lms[LM.LEFT_HIP], w, h), rh = px(lms[LM.RIGHT_HIP], w, h);
    const torso = dist({ x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }, { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 });
    // Hands ~0.9 torso lengths above the shoulders scores full marks (jumpingjack.js).
    const y = Math.min(ls.y, rs.y) - torso * 0.9;
    const spread = Math.abs(ls.x - rs.x) * 0.7;
    return { kind, markers: [{ x: Math.min(ls.x, rs.x) - spread, y }, { x: Math.max(ls.x, rs.x) + spread, y }], head };
  }

  if (!(facing === 1 || facing === -1) || facingConfidence < minConfidence) return null;

  const sh = px(P(lms, side, "SHOULDER"), w, h), hip = px(P(lms, side, "HIP"), w, h);
  const knee = px(P(lms, side, "KNEE"), w, h), ank = px(P(lms, side, "ANKLE"), w, h);

  if (kind === "line") {
    // Straight shoulder → ankle, with a band ±3.5% of body length (where sag/pike faults start).
    const body = dist(sh, ank);
    const t = ((hip.x - sh.x) * (ank.x - sh.x) + (hip.y - sh.y) * (ank.y - sh.y)) / (body * body || 1);
    const idealHip = { x: sh.x + t * (ank.x - sh.x), y: sh.y + t * (ank.y - sh.y) };
    return { kind, line: [sh, ank], idealHip, band: body * 0.035, head };
  }

  const tg = TARGET[kind];
  if (!tg) return null;
  // Limb lengths in pixels: calibrated (frame heights → × h), else this frame's.
  const L = (bone, a, b) => (bones?.[bone] ? bones[bone] * h : dist(a, b));
  const shin = L("shin", knee, ank), thigh = L("thigh", hip, knee), torso = L("torso", sh, hip);

  const f = facing;
  const iAnk = { ...ank };
  const iKnee = { x: iAnk.x + f * shin * Math.sin(rad(tg.shin)), y: iAnk.y - shin * Math.cos(rad(tg.shin)) };
  const iHip = { x: iKnee.x - f * thigh * Math.cos(rad(tg.thigh)), y: iKnee.y - thigh * Math.sin(rad(tg.thigh)) };
  const iSh = { x: iHip.x + f * torso * Math.sin(rad(tg.lean)), y: iHip.y - torso * Math.cos(rad(tg.lean)) };

  // "Parallel": hips at knee height. A line through your knee, reaching back to where the hips go.
  const depth = { y: knee.y, x0: knee.x - f * thigh * 1.25, x1: knee.x + f * thigh * 0.15 };
  // Lean wedge at your hip: from upright to the most lean that still scores well.
  const a = (deg) => Math.atan2(-Math.cos(rad(deg)), f * Math.sin(rad(deg)));
  const wedge = { x: hip.x, y: hip.y, r: torso * 0.72, a0: a(tg.wedge[0]), a1: a(tg.wedge[1]) };

  return { kind, chain: [iAnk, iKnee, iHip, iSh], depth, wedge, head };
}

/** A circle around the head the guide must never draw over. */
function headZone(lms, side, w, h) {
  const nose = lms[LM.NOSE];
  if (!nose || (nose.visibility ?? 1) < 0.3) return null;
  const sh = px(P(lms, side, "SHOULDER"), w, h);
  const c = px(nose, w, h);
  return { x: c.x, y: c.y, r: Math.max(dist(c, sh) * 0.75, h * 0.06) };
}

/** The same guide for a mirrored picture (x → w − x; wedge angles reflected). */
export function mirrorGuide(g, w) {
  if (!g) return g;
  const m = (p) => (p ? { ...p, x: w - p.x } : p);
  const out = { ...g, head: g.head && m(g.head) };
  if (g.chain) out.chain = g.chain.map(m);
  if (g.line) out.line = g.line.map(m);
  if (g.idealHip) out.idealHip = m(g.idealHip);
  if (g.markers) out.markers = g.markers.map(m);
  if (g.depth) out.depth = { y: g.depth.y, x0: w - g.depth.x0, x1: w - g.depth.x1 };
  if (g.wedge) out.wedge = { ...g.wedge, x: w - g.wedge.x, a0: Math.PI - g.wedge.a0, a1: Math.PI - g.wedge.a1 };
  return out;
}

/**
 * How visible the guide is (0..1) through a rep: fades in on the way down,
 * holds at the bottom, fades out on the way up. `progress` 0 = top, 1 = depth.
 */
export function guideAlpha(progress) {
  const p = Math.max(0, Math.min(1, progress * 1.5));
  return p * p * (3 - 2 * p);
}
