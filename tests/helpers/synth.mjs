/**
 * synth.mjs — simulated webcam pose data for testing the session engine.
 *
 * Poses the site's stick-figure rig (realistic limb proportions, IK-solved
 * joints), then converts it into exactly what MediaPipe hands the app: 33
 * landmarks with x/y normalised to a 1280×720 frame and a visibility score.
 * Optional pixel jitter and dropped frames make it behave like a real camera.
 */

import { build } from "../../public/js/figures/rig.js";
import { LAB } from "../../public/js/figures/lab.js";

export const W = 1280, H = 720;
const K = 1.2;                         // rig units → pixels
const toPx = ([x, y]) => [340 + x * K, 50 + y * K];

/** Seeded RNG so test runs are repeatable. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function gauss(r) {
  const u = Math.max(1e-9, r()), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Skeleton → 33 MediaPipe-style landmarks.
 * opts: noisePx, rand, view ("side" | "front" | "frontForSide"), farVis
 */
export function toLandmarks(s, { noisePx = 0, rand = Math.random, farVis = 0.7 } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
  const put = (i, p, vis = 0.95) => {
    const [px, py] = toPx(p);
    lm[i] = {
      x: (px + gauss(rand) * noisePx) / W,
      y: (py + gauss(rand) * noisePx) / H,
      z: 0, visibility: vis,
    };
  };

  if (s.front) {
    // Facing the camera: the figure's right side is on screen-left (unmirrored).
    // The rig's shoulders are narrow; widen them to human proportions.
    const off = (p, dx) => [p[0] + dx, p[1]];
    // Human arms are ~1.15× torso length; the rig's are shorter. Stretch them.
    const arm = (sh, p) => [sh[0] + (p[0] - sh[0]) * 1.35, sh[1] + (p[1] - sh[1]) * 1.35];
    s = { ...s, elbN: arm(s.shN, s.elbN), wriN: arm(s.shN, s.wriN), elbF: arm(s.shF, s.elbF), wriF: arm(s.shF, s.wriF) };
    put(12, off(s.shN, -13)); put(11, off(s.shF, 13));
    put(14, off(s.elbN, -13)); put(13, off(s.elbF, 13));
    put(16, off(s.wriN, -13)); put(15, off(s.wriF, 13));
    [18, 20, 22].forEach((i) => put(i, off(s.wriN, -13)));
    [17, 19, 21].forEach((i) => put(i, off(s.wriF, 13)));
    put(24, s.hpN); put(23, s.hpF);
    put(26, s.kneeN); put(25, s.kneeF);
    put(28, s.ankN); put(27, s.ankF);
    put(30, s.ankN); put(29, s.ankF);
    put(32, s.toeN); put(31, s.toeF);
    const h = s.head;
    put(0, [h[0], h[1] + 4]);
    [1, 2, 3].forEach((i, k) => put(i, [h[0] + 4 + k * 3, h[1] - 3]));
    [4, 5, 6].forEach((i, k) => put(i, [h[0] - 4 - k * 3, h[1] - 3]));
    put(7, [h[0] + 15, h[1]]); put(8, [h[0] - 15, h[1]]);
    put(9, [h[0] + 6, h[1] + 9]); put(10, [h[0] - 6, h[1] + 9]);
  } else {
    // Side-on, facing +x. Near side = LEFT (well seen), far side = RIGHT (occluded).
    put(11, s.neck); put(12, s.neck, farVis);
    put(13, s.elbN); put(14, s.elbF, farVis);
    put(15, s.wriN); put(16, s.wriF, farVis);
    [17, 19, 21].forEach((i) => put(i, s.wriN));
    [18, 20, 22].forEach((i) => put(i, s.wriF, farVis));
    put(23, s.hip); put(24, s.hip, farVis);
    put(25, s.kneeN); put(26, s.kneeF, farVis);
    put(27, s.ankN); put(28, s.ankF, farVis);
    put(29, s.ankN); put(30, s.ankF, farVis);
    put(31, s.toeN); put(32, s.toeF, farVis);
    const h = s.head, dir = s.neck[0] <= s.head[0] ? 1 : 1;
    put(0, [h[0] + 14 * dir, h[1] + 2]);
    [1, 2, 3, 4, 5, 6].forEach((i) => put(i, [h[0] + 9 * dir, h[1] - 4], i > 3 ? farVis : 0.95));
    put(7, [h[0] - 2, h[1]]); put(8, [h[0] - 2, h[1]], farVis);
    put(9, [h[0] + 10, h[1] + 9]); put(10, [h[0] + 10, h[1] + 9], farVis);
  }
  return lm;
}

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/**
 * A stream of frames for `reps` repetitions moving between two slider
 * settings of a Form Lab exercise (top ↔ bottom), like a person doing reps.
 *   timing: [down, hold, up, rest] seconds
 */
export function* repStream(id, top, bottom, {
  reps = 5, timing = [1.0, 0.4, 1.0, 0.6], fps = 30, noisePx = 2, dropRate = 0,
  seed = 7, startBottom = false, lead = 0.8, view,
} = {}) {
  const rand = rng(seed);
  const lab = LAB[id];
  const [dn, hold, up, rest] = timing;
  const cycle = dn + hold + up + rest;
  const total = lead + reps * cycle + 1.0;
  const dtMs = 1000 / fps;
  for (let t = 0; t <= total * 1000; t += dtMs) {
    const sec = t / 1000;
    let k;                                     // 0 = top, 1 = bottom
    if (sec < lead) k = startBottom ? 1 : 0;
    else {
      const c = (sec - lead) % cycle, n = Math.floor((sec - lead) / cycle);
      if (n >= reps) k = 0;
      else k = c < dn ? ease(c / dn) : c < dn + hold ? 1 : c < dn + hold + up ? 1 - ease((c - dn - hold) / up) : 0;
    }
    const v = {};
    for (const key of Object.keys(top)) v[key] = top[key] + (bottom[key] - top[key]) * k;
    const s = build(lab.pose(v));
    if (view === "front" && !s.front) s.front = false;
    const lms = rand() < dropRate ? null : toLandmarks(s, { noisePx, rand });
    yield { t, lms };
  }
}

/** A plank (or any static pose) held for `seconds`. */
export function* holdStream(id, v, { seconds = 32, fps = 30, noisePx = 2, seed = 3, lead = 0.5 } = {}) {
  const rand = rng(seed);
  const s = build(LAB[id].pose(v));
  for (let t = 0; t <= (seconds + lead) * 1000; t += 1000 / fps) {
    yield { t, lms: toLandmarks(s, { noisePx, rand }) };
  }
}

/** Front-facing version of a side-view exercise: what the app sees if you face the camera. */
export function faceCamera(lms) {
  // Spread the left/right landmarks apart horizontally like a real front view.
  return lms.map((p, i) => {
    const left = [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31].includes(i);
    const right = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32].includes(i);
    const dx = left ? 0.06 : right ? -0.06 : 0;
    return { ...p, x: p.x + dx, visibility: 0.95 };
  });
}
