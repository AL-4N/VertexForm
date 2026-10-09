/**
 * repclips.js — rep replays: the skeleton of each rep, kept so you can
 * watch it back (pure logic, no DOM; tests/repclips.test.mjs).
 *
 * While you train, a RepBuffer keeps the last few seconds of smoothed
 * landmarks. When a rep (or a plank's 5-second stretch) is scored, the
 * frames from its start to its end become a clip. A clip stores only the
 * 15 joints the skeleton needs, packed small (x and y as 16-bit numbers,
 * visibility as 8-bit): about 7 KB for a 3-second rep. Clips live in
 * IndexedDB (js/replay-store.js).
 *
 * Saved clips are kept until you delete them. Unsaved ones are deleted for
 * good KEEP_DAYS after their set, and only the newest MAX_UNSAVED are kept.
 */

import { LM } from "./config.js";

export const KEEP_DAYS = 7;
export const MAX_UNSAVED = 150;
const DAY = 86400000;

/** The joints a clip keeps, in order. Index into this list = joint id. */
export const JOINTS = [
  LM.NOSE,
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST,
  LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
  LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX,
];
const J = Object.fromEntries(JOINTS.map((lm, i) => [lm, i]));
const SIDE = {
  L: { sh: J[LM.LEFT_SHOULDER], el: J[LM.LEFT_ELBOW], wr: J[LM.LEFT_WRIST], hip: J[LM.LEFT_HIP], kn: J[LM.LEFT_KNEE], an: J[LM.LEFT_ANKLE], ft: J[LM.LEFT_FOOT_INDEX] },
  R: { sh: J[LM.RIGHT_SHOULDER], el: J[LM.RIGHT_ELBOW], wr: J[LM.RIGHT_WRIST], hip: J[LM.RIGHT_HIP], kn: J[LM.RIGHT_KNEE], an: J[LM.RIGHT_ANKLE], ft: J[LM.RIGHT_FOOT_INDEX] },
};
export { SIDE };

/** Bones to draw, per side, as joint-id chains. */
export const chains = (s) => [[s.sh, s.el, s.wr], [s.sh, s.hip, s.kn, s.an, s.ft]];

/**
 * The angle the replay reads out, per exercise: the joint at the middle of
 * [a, b, c], and which side to read ("near" = the side the camera sees
 * best; "min"/"max" = whichever side's angle is smaller/larger).
 */
export const KEY_ANGLE = {
  "Squat":        { name: "Knee angle",  a: "hip", b: "kn", c: "an", pick: "near", deepest: "min" },
  "Lunge":        { name: "Front knee",  a: "hip", b: "kn", c: "an", pick: "min",  deepest: "min" },
  "Push-up":      { name: "Elbow angle", a: "sh",  b: "el", c: "wr", pick: "near", deepest: "min" },
  "Plank":        { name: "Body line",   a: "sh",  b: "hip", c: "an", pick: "near", deepest: "min" },
  "Jumping Jack": { name: "Arm raise",   a: "hip", b: "sh", c: "wr", pick: "max",  deepest: "max" },
};

const q16 = (v) => Math.max(0, Math.min(65535, Math.round(((v + 0.25) / 1.5) * 65535)));   // covers −0.25..1.25
const u16 = (n) => (n / 65535) * 1.5 - 0.25;

/** One frame's joints, packed. Null if there's no pose. */
export function packFrame(lms) {
  if (!lms) return null;
  const xy = new Uint16Array(JOINTS.length * 2), vis = new Uint8Array(JOINTS.length);
  JOINTS.forEach((lm, i) => {
    const p = lms[lm];
    xy[i * 2] = q16(p?.x ?? 0); xy[i * 2 + 1] = q16(p?.y ?? 0);
    vis[i] = Math.round(Math.max(0, Math.min(1, p?.visibility ?? 1)) * 255);
  });
  return { xy, vis };
}

/** The last few seconds of frames, to cut clips from. */
export class RepBuffer {
  constructor(seconds = 14) { this.keepMs = seconds * 1000; this.frames = []; }
  push(t, lms) {
    const f = packFrame(lms);
    if (f) this.frames.push({ t, ...f });
    while (this.frames.length && t - this.frames[0].t > this.keepMs) this.frames.shift();
  }
  /** Frames with t0 ≤ t ≤ t1. */
  slice(t0, t1) { return this.frames.filter((f) => f.t >= t0 && f.t <= t1); }
  clear() { this.frames = []; }
}

/**
 * A clip from buffered frames. meta: { id, setId, exercise, index, score,
 * faults, date (ISO), aspect (w/h), mirror }. Null if too few frames.
 */
export function makeClip(frames, meta) {
  if (frames.length < 4) return null;
  const n = frames.length, k = JOINTS.length;
  const t = new Float32Array(n), xy = new Uint16Array(n * k * 2), vis = new Uint8Array(n * k);
  frames.forEach((f, i) => {
    t[i] = f.t - frames[0].t;
    xy.set(f.xy, i * k * 2);
    vis.set(f.vis, i * k);
  });
  return { saved: false, ...meta, n, t, xy, vis };
}

/** A frame's joints as {x, y, v}, with x scaled by the aspect ratio so angles are true. */
export function framePoints(clip, i) {
  const k = JOINTS.length, out = new Array(k);
  for (let j = 0; j < k; j++) {
    const x = u16(clip.xy[(i * k + j) * 2]), y = u16(clip.xy[(i * k + j) * 2 + 1]);
    out[j] = { x: (clip.mirror ? 1 - x : x) * clip.aspect, y, v: clip.vis[i * k + j] / 255 };
  }
  return out;
}

/** The side the camera saw best across the clip ("L" or "R"). */
export function nearSide(clip) {
  const k = JOINTS.length;
  let l = 0, r = 0;
  for (let i = 0; i < clip.n; i++) {
    for (const key of ["sh", "hip", "kn", "an"]) { l += clip.vis[i * k + SIDE.L[key]]; r += clip.vis[i * k + SIDE.R[key]]; }
  }
  return l >= r ? "L" : "R";
}

function angle(a, b, c) {
  const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y];
  const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / ((Math.hypot(...v1) * Math.hypot(...v2)) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** The exercise's key angle at frame i: { deg, at: [a, b, c] joint ids }, or null. */
export function keyAngle(clip, i, near = nearSide(clip)) {
  const spec = KEY_ANGLE[clip.exercise];
  if (!spec) return null;
  const pts = framePoints(clip, i);
  const read = (s) => ({ deg: angle(pts[SIDE[s][spec.a]], pts[SIDE[s][spec.b]], pts[SIDE[s][spec.c]]), at: [SIDE[s][spec.a], SIDE[s][spec.b], SIDE[s][spec.c]] });
  if (spec.pick === "near") return read(near);
  const L = read("L"), R = read("R");
  return (spec.pick === "min" ? L.deg <= R.deg : L.deg >= R.deg) ? L : R;
}

/** The frame where the rep is deepest (smallest knee/elbow angle; widest for jacks). */
export function deepestFrame(clip) {
  const spec = KEY_ANGLE[clip.exercise];
  if (!spec) return Math.floor(clip.n / 2);
  const near = nearSide(clip);
  let best = 0, bestDeg = null;
  for (let i = 0; i < clip.n; i++) {
    const d = keyAngle(clip, i, near).deg;
    if (bestDeg == null || (spec.deepest === "min" ? d < bestDeg : d > bestDeg)) { bestDeg = d; best = i; }
  }
  return best;
}

/** A box around every frame of the clip (aspect-scaled units). */
export function clipBounds(clip) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < clip.n; i++) {
    for (const p of framePoints(clip, i)) {
      if (p.v < 0.3) continue;
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: clip.aspect, y1: 1 };
  return { x0, y0, x1, y1 };
}

/* ── Keeping and deleting ───────────────────────────────── */

/** Whole days left before an unsaved clip is deleted (0 = today); null if saved. */
export function daysLeft(clip, now = Date.now()) {
  if (clip.saved) return null;
  return Math.max(0, Math.ceil((Date.parse(clip.date) + KEEP_DAYS * DAY - now) / DAY));
}

/** Ids to delete for good: unsaved clips past KEEP_DAYS, then the oldest beyond MAX_UNSAVED. */
export function expiredIds(clips, now = Date.now()) {
  const unsaved = clips.filter((c) => !c.saved).sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.index - a.index);
  const out = new Set();
  unsaved.forEach((c, i) => {
    if (now - Date.parse(c.date) >= KEEP_DAYS * DAY || i >= MAX_UNSAVED) out.add(c.id);
  });
  return [...out];
}

/** Best and worst rep of a set (indexes into `clips`); worst is null if they're the same. */
export function bestAndWorst(clips) {
  if (!clips.length) return { best: null, worst: null };
  let best = 0, worst = 0;
  clips.forEach((c, i) => {
    if (c.score > clips[best].score) best = i;
    if (c.score < clips[worst].score) worst = i;
  });
  return { best, worst: clips[worst].score === clips[best].score ? null : worst };
}

/* ── Comparing two reps in step ─────────────────────────── */
// Reps rarely take the same time, so two are lined up by phase: they start
// together, reach their deepest point together, and finish together.
// Progress 0..0.5 is the way down, 0.5 the bottom, 0.5..1 the way up.

/** Where frame i sits in the rep, 0..1. */
export function phaseProgress(clip, i, deep = deepestFrame(clip)) {
  const t = clip.t, end = t[clip.n - 1], td = t[deep];
  if (i <= deep) return td > 0 ? 0.5 * (t[i] / td) : 0.5;
  return end > td ? 0.5 + 0.5 * ((t[i] - td) / (end - td)) : 1;
}

/** The frame of a clip at progress p (0..1), lined up by phase. */
export function frameAtProgress(clip, p, deep = deepestFrame(clip)) {
  const t = clip.t, end = t[clip.n - 1], td = t[deep];
  const ms = p <= 0.5 ? td * (p / 0.5) : td + (end - td) * ((p - 0.5) / 0.5);
  let k = 0;
  while (k < clip.n - 1 && t[k + 1] <= ms) k++;
  return k;
}

/** Which way the person faces in the clip (+1 right, −1 left), from foot direction. */
export function facingDir(clip, near = nearSide(clip)) {
  const p = framePoints(clip, 0), s = SIDE[near];
  return p[s.ft].x >= p[s.an].x ? 1 : -1;
}
