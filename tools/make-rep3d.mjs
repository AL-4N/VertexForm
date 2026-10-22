/**
 * make-rep3d.mjs — writes public/data/rep3d.json, the 3D clips behind the
 * homepage (the 3D hero, the "How it works" story, the exercise popups and
 * the 3D view: js/figures/scene3d.js).   node tools/make-rep3d.mjs
 *
 * Each clip is a simulated person (tests/helpers/synth.mjs) with MediaPipe-
 * style 3D world landmarks. The scores are not typed in: every clip is run
 * through the real Session engine here, exactly as the trainer would, and
 * the rep (or hold segment) times and scores it reports are saved with it.
 * tests/rep3d.test.mjs replays the clips again and checks they still match.
 *
 * Format 2: world points as whole millimetres (x, y, z per kept joint),
 * hips at the origin, y down, z away from the camera, every 2nd frame.
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
  { id: "full",   label: "Full depth",   exercise: "Squat",        lab: "squat",  top: { depth: -8, lean: 5 }, bottom: { depth: 100, lean: 25 } },
  { id: "half",   label: "Half squat",   exercise: "Squat",        lab: "squat",  top: { depth: -8, lean: 5 }, bottom: { depth: 55, lean: 20 } },
  { id: "pushup", label: "Push-up",      exercise: "Push-up",      lab: "pushup", top: { depth: 0, hips: 0 },  bottom: { depth: 100, hips: 0 } },
  { id: "plank",  label: "Plank",        exercise: "Plank",        lab: "plank",  top: { hips: 0 },            bottom: { hips: 0 } },
  { id: "lunge",  label: "Lunge",        exercise: "Lunge",        lab: "lunge",  top: { depth: 0, lean: 5 },  bottom: { depth: 100, lean: 5 } },
  { id: "jack",   label: "Jumping jack", exercise: "Jumping Jack", lab: "jack",   top: { arms: 0, feet: 0 },   bottom: { arms: 100, feet: 100 },
    opts: { reps: 4, timing: [0.35, 0.1, 0.35, 0.15], view: "front" } },
];
const WORLD = { noiseXY: 0.004, noiseZ: 0.01 };

/**
 * A front-facing figure from the simulator is flat (no depth at all). Give
 * the face and feet the little depth a real body has, so it doesn't look
 * like cardboard when turned. Display only: the engine never sees this
 * (front-facing exercises are graded from the 2D picture).
 */
function rounded(world) {
  const z = { 0: -0.09, 7: 0.03, 8: 0.03, 29: 0.04, 30: 0.04, 31: -0.12, 32: -0.12 };
  return world.map((p, i) => (z[i] ? { ...p, z: p.z + z[i] } : p));
}

/** Frames of one clip: what the camera would hand the engine. */
export const framesOf = (c) => [...repStream(c.lab, c.top, c.bottom, { reps: 3, world: WORLD, seed: 11, ...c.opts })];

/** Run a clip through the real engine; rep / hold-segment events with the time they fired. */
export function score(c, frames = framesOf(c)) {
  const s = new Session(getExercise(c.exercise), { mode: "set", target: 90, goal: 0, setReps: 10_000, holdSeconds: 10_000 });
  const reps = [];
  const plain = (a) => a && a.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }));
  for (const f of frames) {
    const out = s.update(plain(f.lms), W / H, f.t, plain(f.world));
    for (const e of out.events) {
      if (e.type === "rep" || e.type === "segment") reps.push({ t: Math.round(f.t), score: e.score, faults: (e.faults ?? []).map((x) => x.key) });
    }
  }
  return reps;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mm = (v) => Math.round(v * 1000);
  const out = { format: "vertexform-rep3d", version: 2, source: "simulated person (tests/helpers/synth.mjs), scored by js/session.js", keep: KEEP, fps: 30 / STEP, clips: [] };
  for (const c of CLIPS) {
    const frames = framesOf(c);
    const reps = score(c, frames);
    const kept = frames.filter((_, i) => i % STEP === 0);
    const front = c.opts?.view === "front";
    out.clips.push({
      id: c.id, label: c.label, exercise: c.exercise, kind: c.exercise === "Plank" ? "hold" : "reps", front, reps,
      t: kept.map((f) => Math.round(f.t)),
      w: kept.map((f) => (front ? rounded(f.world) : f.world)).map((w) => KEEP.flatMap((i) => [mm(w[i].x), mm(w[i].y), mm(w[i].z)])),
    });
    console.log(c.id.padEnd(7), kept.length, "frames, reps", reps.map((r) => r.score + (r.faults.length ? `(${r.faults})` : "")).join(" "));
  }
  const file = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public", "data", "rep3d.json");
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(file, (fs.statSync(file).size / 1024).toFixed(1), "KB");
}
