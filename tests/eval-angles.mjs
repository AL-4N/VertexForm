/**
 * eval-angles.mjs — which angle source is more accurate and steadier:
 * 2D (aspect-corrected image landmarks), 3D (MediaPipe worldLandmarks), or
 * the blend session.js uses (tracking.worldWeight)?
 *
 *   node tests/eval-angles.mjs
 *
 * 1. Simulator: a squat / push-up held at the bottom, seen side-on and
 *    turned 15° and 30°, with webcam-like 2D jitter and MediaPipe-like
 *    world-landmark noise (depth noisier than x/y). Reports bias (mean
 *    error vs the true angle) and jitter (frame-to-frame spread).
 * 2. Real recordings: every tests/fixtures/*.json made with the ?debug
 *    recorder. No ground truth there, so it reports jitter while you hold
 *    still, and how far 2D and 3D disagree.
 *
 * The simulator's world-landmark noise (1 cm x/y, 3 cm depth) is an
 * assumption; rerun this once real recordings exist and adjust
 * worldWeight() if they disagree.
 */
import fs from "node:fs";
import path from "node:path";
import { repStream, W, H } from "./helpers/synth.mjs";
import { aspectCorrect } from "../public/js/session.js";
import { worldAngles, worldWeight, fuseAngles } from "../public/js/tracking.js";
import { getExercise } from "../public/js/exercises/index.js";
import { median, mean, stdev } from "../public/js/geometry.js";
import { LandmarkSmoother, SMOOTHING } from "../public/js/filters.js";

const ASPECT = W / H;
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1).padStart(6) : "   n/a");

function framesAtBottom(id, top, bottom, rotate) {
  // One slow rep with a long hold at the bottom; keep only the held frames.
  const out = [];
  for (const f of repStream(id, top, bottom, { reps: 1, timing: [0.8, 3, 0.8, 0.4], rotate, noisePx: 2, world: { noiseXY: 0.01, noiseZ: 0.03 }, seed: 5 })) {
    if (f.k === 1 && f.lms) out.push(f);
  }
  return out;
}

function evaluate(label, exName, key, id, top, bottom) {
  const ex = getExercise(exName);
  const truth = (() => {
    const [f] = framesAtBottom(id, top, bottom, 0).slice(-1);
    const clean = [...repStream(id, top, bottom, { reps: 1, timing: [0.8, 3, 0.8, 0.4], noisePx: 0, seed: 5 })].find((x) => x.k === 1);
    return ex.measure(aspectCorrect(clean.lms, ASPECT), "LEFT")[key];
  })();
  console.log(`\n${label} — true ${key} angle ${truth.toFixed(1)}°`);
  console.log("  turned   source     bias°  jitter°   (bias = mean error, jitter = spread frame to frame)");
  for (const rot of [0, 15, 30]) {
    const frames = framesAtBottom(id, top, bottom, rot);
    const sm = new LandmarkSmoother(SMOOTHING.measure), smw = new LandmarkSmoother(SMOOTHING.measure);
    const rows = { "2D": [], "3D": [], "blend": [], "2D+1€": [], "3D+1€": [], "blend+1€": [] };
    for (const f of frames) {
      const l = aspectCorrect(f.lms, ASPECT);
      const m2 = ex.measure(l, "LEFT")[key];
      const w3 = worldAngles(f.world, "LEFT")[key];
      const ls = aspectCorrect(sm.apply(f.lms, f.t), ASPECT);
      const facing = Math.hypot(l[11].x - l[12].x, l[11].y - l[12].y) / Math.hypot((l[11].x + l[12].x) / 2 - (l[23].x + l[24].x) / 2, (l[11].y + l[12].y) / 2 - (l[23].y + l[24].y) / 2);
      rows["2D"].push(m2);
      rows["3D"].push(w3);
      rows["blend"].push(fuseAngles({ [key]: m2 }, { [key]: w3 }, worldWeight(facing))[key]);
      const s2 = ex.measure(ls, "LEFT")[key], s3 = worldAngles(smw.apply(f.world, f.t), "LEFT")[key];
      rows["2D+1€"].push(s2);
      rows["3D+1€"].push(s3);
      rows["blend+1€"].push(fuseAngles({ [key]: s2 }, { [key]: s3 }, worldWeight(facing))[key]);
    }
    for (const [src, vals] of Object.entries(rows)) {
      const diffs = vals.slice(1).map((v, i) => v - vals[i]);
      console.log(`  ${String(rot).padStart(3)}°    ${src.padEnd(8)} ${f1(mean(vals) - truth)}  ${f1(stdev(diffs))}`);
    }
  }
}

evaluate("Squat, held at the bottom", "Squat", "knee", "squat", { depth: -8, lean: 5 }, { depth: 100, lean: 25 });
evaluate("Push-up, held at the bottom", "Push-up", "elbow", "pushup", { depth: 0, hips: 0 }, { depth: 100, hips: 0 });

/* ── Real recordings ─────────────────────────────────────── */
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "fixtures");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".expect.json")) : [];
console.log(`\nReal recordings in tests/fixtures: ${files.length}`);
for (const file of files) {
  const rec = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const ex = getExercise(rec.exercise);
  const key = { "Squat": "knee", "Lunge": "knee", "Push-up": "elbow", "Plank": "bodyLine" }[rec.exercise];
  if (!ex || !key || !rec.frames?.some((f) => f.world)) { console.log(`  ${file}: skipped (no 3D data or no angle to compare)`); continue; }
  const two = [], three = [];
  for (const f of rec.frames) {
    if (!f.lms || !f.world) continue;
    const l = aspectCorrect(f.lms, rec.aspect);
    const side = (l[23].visibility ?? 0) >= (l[24].visibility ?? 0) ? "LEFT" : "RIGHT";
    two.push(ex.measure(l, side)[key]);
    three.push(worldAngles(f.world, side)[key]);
  }
  const jit = (v) => stdev(v.slice(1).map((x, i) => x - v[i]));
  const gap = median(two.map((v, i) => Math.abs(v - three[i])));
  console.log(`  ${file}: ${key} jitter 2D ${jit(two).toFixed(2)}°  3D ${jit(three).toFixed(2)}°  · median 2D↔3D gap ${gap.toFixed(1)}°`);
}
