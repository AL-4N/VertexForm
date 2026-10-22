/**
 * make-rep3d.mjs — writes public/data/rep3d.json, the clips behind the
 * homepage's 3D rep viewer (js/site/rep3d.js).   node tools/make-rep3d.mjs
 *
 * Each clip is a simulated person (tests/helpers/synth.mjs) with MediaPipe-
 * style 3D world landmarks. The scores are not typed in: every clip is run
 * through the real Session engine here, exactly as the trainer would, and
 * the rep times and scores it reports are saved with the clip.
 * tests/rep3d.test.mjs replays the clips again and checks they still match.
 */
import fs from "node:fs";
import path from "node:path";
import { repStream, W, H } from "../tests/helpers/synth.mjs";
import { Session } from "../public/js/session.js";
import { getExercise } from "../public/js/exercises/index.js";

// MediaPipe indices kept for drawing: nose, ears, shoulders, elbows, wrists,
// hips, knees, ankles, heels, toes.
export const KEEP = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const STEP = 2;                                  // keep every 2nd frame (15 fps): the viewer interpolates

export const CLIPS = [
  { id: "full", label: "Full depth", exercise: "Squat", top: { depth: -8, lean: 5 }, bottom: { depth: 100, lean: 25 } },
  { id: "half", label: "Half squat", exercise: "Squat", top: { depth: -8, lean: 5 }, bottom: { depth: 55, lean: 20 } },
];
const WORLD = { noiseXY: 0.004, noiseZ: 0.01 };

/** Frames of one clip: what the camera would hand the engine. */
export const framesOf = (c) => [...repStream("squat", c.top, c.bottom, { reps: 3, world: WORLD, seed: 11 })];

/** Run a clip through the real engine; rep events with the time they fired. */
export function score(c, frames = framesOf(c)) {
  const s = new Session(getExercise(c.exercise), { mode: "set", target: 90, goal: 0, setReps: 10_000, holdSeconds: 10_000 });
  const reps = [];
  for (const f of frames) {
    const plain = (a) => a && a.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }));
    const out = s.update(plain(f.lms), W / H, f.t, plain(f.world));
    for (const e of out.events) if (e.type === "rep") reps.push({ t: Math.round(f.t), score: e.score, faults: (e.faults ?? []).map((x) => x.key) });
  }
  return reps;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const out = { format: "vertexform-rep3d", version: 1, source: "simulated person (tests/helpers/synth.mjs), scored by js/session.js", keep: KEEP, fps: 30 / STEP, clips: [] };
  for (const c of CLIPS) {
    const frames = framesOf(c);
    const reps = score(c, frames);
    const kept = frames.filter((_, i) => i % STEP === 0);
    out.clips.push({
      id: c.id, label: c.label, exercise: c.exercise, reps,
      t: kept.map((f) => Math.round(f.t)),
      // [x, y, z] per kept joint, metres, hips at the origin, y down.
      w: kept.map((f) => KEEP.flatMap((i) => [r3(f.world[i].x), r3(f.world[i].y), r3(f.world[i].z)])),
    });
    console.log(c.id, kept.length, "frames, reps", JSON.stringify(reps));
  }
  const file = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public", "data", "rep3d.json");
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(file, (fs.statSync(file).size / 1024).toFixed(1), "KB");
}
