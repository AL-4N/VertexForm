/**
 * tracking.test.mjs — the landmark clean-up layer (js/filters.js, js/tracking.js):
 * One Euro smoothing, calibration, personalised thresholds, side hysteresis,
 * occlusion gap-filling, bone-length glitch rejection, framing and lighting
 * hints, and the 2D/3D angle blend. Run with:  npm test
 */
import { OneEuro, LandmarkSmoother, SMOOTHING } from "../public/js/filters.js";
import {
  boneLengths, boneGlitch, Calibrator, personalShallow, SideTracker, GapFiller,
  keyJointIds, framingCheck, lightingHint, worldAngles, worldWeight, fuseAngles,
} from "../public/js/tracking.js";
import { aspectCorrect } from "../public/js/session.js";
import { getExercise } from "../public/js/exercises/index.js";
import { stdev, mean } from "../public/js/geometry.js";
import { holdStream, repStream, rng, W, H } from "./helpers/synth.mjs";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(52)} ${detail}`);
};
const ASPECT = W / H;

/* ── One Euro filter ─────────────────────────────────────── */
console.log("One Euro filter");
{
  const r = rng(3);
  const noisy = [], smooth = [];
  const f = new OneEuro(SMOOTHING.measure);
  for (let i = 0; i < 90; i++) {
    const v = 0.5 + (r() - 0.5) * 0.01;          // a still joint with ±0.5% jitter
    noisy.push(v); smooth.push(f.filter(v, i / 30));
  }
  const jit = (a) => stdev(a.slice(31).map((v, i) => v - a[30 + i]));
  check("Still joint: jitter cut by at least 3×", jit(smooth) < jit(noisy) / 3, `${jit(noisy).toFixed(4)} → ${jit(smooth).toFixed(4)}`);

  const g = new OneEuro(SMOOTHING.measure);
  let lagAt = null;
  for (let i = 0; i <= 30; i++) {                  // moves 0 → 0.6 in 1 s (a brisk squat)
    const t = i / 30, v = 0.6 * t, out = g.filter(v, t);
    if (i === 30) lagAt = v - out;
  }
  check("Moving joint: lags < 0.03 frame (≈ 30 ms)", lagAt < 0.03, `lag ${lagAt.toFixed(4)}`);

  const h = new OneEuro(SMOOTHING.measure);
  h.filter(0.2, 0); h.filter(0.2, 1 / 30);
  check("Repeated timestamp doesn't divide by zero", Number.isFinite(h.filter(0.3, 1 / 30)));

  const sm = new LandmarkSmoother(SMOOTHING.measure);
  sm.apply([{ x: 0.1, y: 0.1, z: 0, visibility: 1 }], 0);
  const after = sm.apply([{ x: 0.9, y: 0.9, z: 0, visibility: 0.4 }], 2000);
  check("Long gap restarts the smoother (no drift from stale data)", after[0].x === 0.9 && after[0].visibility === 0.4);
}

/* ── Bones and glitches ─────────────────────────────────── */
console.log("\nBone lengths and glitches");
const frames = [...holdStream("squat", { depth: -8, lean: 5 }, { seconds: 3, noisePx: 1 })];
const lms0 = aspectCorrect(frames[10].lms, ASPECT);
const ref = boneLengths(lms0, "LEFT");
check("Bone lengths are all positive", Object.values(ref).every((v) => v > 0), JSON.stringify(Object.fromEntries(Object.entries(ref).map(([k, v]) => [k, +v.toFixed(3)]))));
{
  const scaled = Object.fromEntries(Object.entries(ref).map(([k, v]) => [k, v * 1.4]));
  check("Stepping closer (all bones 40% longer) is NOT a glitch", !boneGlitch(scaled, ref).glitch);
  const bad = { ...ref, shin: ref.shin * 1.6 };
  const g = boneGlitch(bad, ref);
  check("Shin suddenly 60% longer IS a glitch", g.glitch && g.worst === "shin", JSON.stringify(g));
  check("A 15% wobble is tolerated", !boneGlitch({ ...ref, thigh: ref.thigh * 1.15 }, ref).glitch);
  check("Too few bones to judge: no verdict", !boneGlitch({ thigh: 1 }, { thigh: 2 }).glitch);
}

/* ── Calibration ─────────────────────────────────────────── */
console.log("\nCalibration");
{
  const ex = getExercise("Squat");
  const c = new Calibrator();
  let res = null;
  for (const f of frames) {
    const l = aspectCorrect(f.lms, ASPECT);
    res = c.update(l, "LEFT", ex.repMetric(ex.measure(l, "LEFT")), f.t) ?? res;
  }
  check("Standing still 3 s calibrates", !!res && c.progress === 1, res ? `top knee ${res.topMetric.toFixed(1)}°` : "");
  check("Calibrated bones match the body", res && Math.abs(res.bones.thigh / ref.thigh - 1) < 0.05);

  const c2 = new Calibrator();
  let done = null;
  for (const f of repStream("squat", { depth: -8, lean: 5 }, { depth: 100, lean: 25 }, { reps: 3, lead: 0.2, timing: [0.8, 0.2, 0.8, 0.2] })) {
    const l = aspectCorrect(f.lms, ASPECT);
    done = c2.update(l, "LEFT", 0, f.t) ?? done;
  }
  check("Constant movement never calibrates", !done, `progress ${c2.progress.toFixed(2)}`);

  check("Personal threshold: low standing angle lowers 'top'", personalShallow(ex, 150) === 144, String(personalShallow(ex, 150)));
  check("Personal threshold: normal standing keeps default", personalShallow(ex, 176) === ex.shallowThreshold);
  check("Personal threshold: never too close to 'deep'", personalShallow(ex, 120) === ex.deepThreshold + 12);
  check("Personal threshold: no calibration keeps default", personalShallow(ex, null) === ex.shallowThreshold);
}

/* ── Side hysteresis ─────────────────────────────────────── */
console.log("\nSide selection");
{
  const s = new SideTracker();
  const seq = [];
  // LEFT clearly better, then RIGHT better for 3 frames (100 ms), then LEFT again.
  for (let i = 0; i < 30; i++) {
    const t = i * 33;
    const sc = i >= 10 && i < 13 ? { LEFT: 0.5, RIGHT: 0.9 } : { LEFT: 0.9, RIGHT: 0.6 };
    seq.push(s.update(sc, t));
  }
  check("Brief flip (100 ms) doesn't switch sides", seq.every((x) => x === "LEFT") && s.switches === 0);
  for (let i = 30; i < 60; i++) s.update({ LEFT: 0.5, RIGHT: 0.9 }, i * 33);
  check("Other side clearly better for 1 s does switch", s.side === "RIGHT" && s.switches === 1);
  const s2 = new SideTracker();
  s2.update({ LEFT: 0.8, RIGHT: 0.7 }, 0);
  for (let i = 1; i < 60; i++) s2.update({ LEFT: 0.75, RIGHT: 0.85 }, i * 33);
  check("Only slightly better never switches", s2.side === "LEFT");
}

/* ── Occlusion gaps ──────────────────────────────────────── */
console.log("\nOcclusion");
{
  const gf = new GapFiller();
  const ids = keyJointIds(["KNEE"], "LEFT");
  const knee = ids[0];
  const mk = (x, vis) => { const a = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })); a[knee] = { x, y: 0.6, z: 0, visibility: vis }; return a; };
  gf.apply(mk(0.40, 0.9), ids, 0);
  gf.apply(mk(0.41, 0.9), ids, 33);
  const r1 = gf.apply(mk(0.9, 0.1), ids, 100);
  check("Hidden 67 ms: bridged near the last position", !r1.dropped && r1.filled.length === 1 && Math.abs(r1.lms[knee].x - 0.41) < 0.02, `x=${r1.lms[knee].x.toFixed(3)}`);
  const r2 = gf.apply(mk(0.9, 0.1), ids, 250);
  check("Hidden 217 ms: frame dropped", r2.dropped);
  const r3 = gf.apply(mk(0.42, 0.95), ids, 300);
  check("Back in view: used as-is", !r3.dropped && !r3.filled.length && r3.lms[knee].x === 0.42);
  check("Front-facing exercises check both sides", keyJointIds(["HIP"], "BOTH").length === 2);
}

/* ── Framing + lighting ──────────────────────────────────── */
console.log("\nFraming and lighting");
{
  const body = (dx = 0, dy = 0, scale = 1) => Array.from({ length: 33 }, (_, i) => {
    const y = 0.15 + (i / 32) * 0.7;
    return { x: 0.5 + dx + (i % 2 ? 0.05 : -0.05) * scale, y: 0.5 + (y - 0.5) * scale + dy, z: 0, visibility: 0.95 };
  });
  check("Whole body inside: OK", framingCheck(body()).ok);
  check("Nobody: 'Step into the frame'", framingCheck(null).hint === "Step into the frame");
  check("Too big for the frame: 'Step back'", /Step back/.test(framingCheck(body(0, 0, 1.6)).hint));
  check("Feet cut off: lower / tilt down", /Feet are cut off/.test(framingCheck(body(0, 0.2)).hint));
  check("Head cut off: raise / tilt up", /Head is cut off/.test(framingCheck(body(0, -0.2)).hint));
  // Raw x = 0.03 is the LEFT of the camera image, the RIGHT of a mirrored screen.
  check("Cut off at screen right (mirrored): move left on screen", /to the left/.test(framingCheck(body(-0.47), { mirror: true }).hint));
  check("Same, unmirrored (screen left): move right on screen", /to the right/.test(framingCheck(body(-0.47), { mirror: false }).hint));
  check("Tiny in the frame: 'Step a little closer'", /closer/.test(framingCheck(body(0, 0, 0.4)).hint));
  check("Dark frame: lighting hint", /too dark/.test(lightingHint(25)));
  check("Normal light: no hint", lightingHint(110) === null);
}

/* ── 2D vs 3D angles ─────────────────────────────────────── */
console.log("\n2D and 3D angles");
{
  const ex = getExercise("Push-up");
  const truth = (() => {
    const f = [...repStream("pushup", { depth: 0, hips: 0 }, { depth: 100, hips: 0 }, { reps: 1, noisePx: 0, timing: [0.5, 1, 0.5, 0.3] })].find((x) => x.k === 1);
    return ex.measure(aspectCorrect(f.lms, ASPECT), "LEFT").elbow;
  })();
  const turned = [...repStream("pushup", { depth: 0, hips: 0 }, { depth: 100, hips: 0 }, { reps: 1, noisePx: 0, rotate: 30, world: { noiseXY: 0, noiseZ: 0 }, timing: [0.5, 1, 0.5, 0.3] })].find((x) => x.k === 1);
  const l = aspectCorrect(turned.lms, ASPECT);
  const a2 = ex.measure(l, "LEFT").elbow, a3 = worldAngles(turned.world, "LEFT").elbow;
  check("Turned 30°: 3D elbow angle stays true", Math.abs(a3 - truth) < 1, `true ${truth.toFixed(1)} 3D ${a3.toFixed(1)}`);
  check("Turned 30°: 2D elbow angle reads too straight", a2 - truth > 4, `2D ${a2.toFixed(1)}`);
  check("Side-on: 3D weight is 0", worldWeight(0.1) === 0);
  check("Turned: 3D weight rises, capped at 0.5", worldWeight(0.4) > 0.4 && worldWeight(0.9) === 0.5);
  check("Blend sits between 2D and 3D", (() => { const b = fuseAngles({ elbow: 100 }, { elbow: 80 }, 0.25).elbow; return b === 95; })());
  check("No 3D data: 2D unchanged", fuseAngles({ knee: 90 }, null, 0.5).knee === 90);
}

console.log(`\n${fail ? `${fail} tracking check(s) FAILED` : "All tracking checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
