/**
 * replay.test.mjs — replays recordings (tests/fixtures/*.json, made with the
 * ?debug recorder) through the real engine and checks each against the
 * expectations in its sidecar file:
 *
 *   squat-good-5.json  +  squat-good-5.expect.json
 *   { "reps": 5, "minScore": 88 }
 *
 * Expectation keys (all optional except reps or seconds):
 *   reps          exact rep count            repsTolerance  ± allowed (default 0)
 *   seconds       plank: seconds held (± 2)  noReps         true = expect 0 reps (e.g. half reps)
 *   minScore      every rep at least this    maxScore       every rep at most this
 *   faults        fault keys that must be flagged, e.g. ["depth"]
 *   clean         true = no faults on any rep
 *   exercise      override the recording's exercise
 *
 * See RECORDING_GUIDE.md for which clips to record. Run with:  npm test
 */
import fs from "node:fs";
import path from "node:path";
import { Session } from "../public/js/session.js";
import { getExercise } from "../public/js/exercises/index.js";
import { readRecording, Recorder } from "../public/js/recording.js";

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "fixtures");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".expect.json")).sort() : [];
let pass = 0, fail = 0, skipped = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} ${detail}`);
};

/** Replay one recording; returns what the engine made of it. */
export function replay(rec, exerciseName) {
  const ex = getExercise(exerciseName);
  const s = new Session(ex, { mode: "set", target: 90, goal: 0, setReps: 10_000, holdSeconds: 10_000 });
  const reps = [], shallow = [];
  for (const f of rec.frames) {
    const out = s.update(f.lms, rec.aspect, f.t, f.world);
    for (const e of out.events) {
      if (e.type === "rep" || e.type === "segment") reps.push(e);
      if (e.type === "shallow") shallow.push(e);
    }
  }
  return { session: s, reps, shallow, held: s.hold.inPos };
}

/* ── The recording format itself ─────────────────────────── */
{
  const rec = new Recorder({ exercise: "Squat", aspect: 16 / 9, camera: "test", model: "full" });
  const pt = (x) => Array.from({ length: 33 }, (_, i) => ({ x: x + i / 1e5, y: 0.123456789, z: -0.5, visibility: 0.987654 }));
  rec.add(1000, pt(0.5), pt(0.1));
  rec.add(1033.3, null, null);
  const data = JSON.parse(JSON.stringify(rec.toJSON()));
  const back = readRecording(data);
  check("Recorder: times start at 0, rounded to 0.1 ms", back.frames[0].t === 0 && back.frames[1].t === 33.3);
  check("Recorder: coordinates rounded to 4 decimals", back.frames[0].lms[0].y === 0.1235 && back.frames[0].lms[0].visibility === 0.9877);
  check("Recorder: lost frames and world landmarks kept", back.frames[1].lms === null && back.frames[0].world.length === 33);
  check("Recorder: exercise and aspect saved", back.exercise === "Squat" && Math.abs(back.aspect - 1.7778) < 1e-9);
  let threw = false;
  try { readRecording({ frames: [] }); } catch { threw = true; }
  check("Recorder: other JSON files are rejected", threw);
}

for (const file of files) {
  const expPath = path.join(dir, file.replace(/\.json$/, ".expect.json"));
  if (!fs.existsSync(expPath)) { skipped++; console.log(`SKIP  ${file} (no ${path.basename(expPath)})`); continue; }
  const exp = JSON.parse(fs.readFileSync(expPath, "utf8"));
  let rec;
  try { rec = readRecording(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"))); }
  catch (err) { check(`${file}: readable recording`, false, err.message); continue; }
  const name = exp.exercise ?? rec.exercise;
  if (!getExercise(name)) { check(`${file}: known exercise`, false, name); continue; }

  const r = replay(rec, name);
  const scores = r.reps.map((e) => e.score);
  const faults = new Set(r.reps.flatMap((e) => (e.faults ?? []).map((f) => f.key)));
  const info = `reps=${scores.length} scores=[${scores.join(",")}] faults=[${[...faults].join(",")}] no-reps=${r.shallow.length}`;

  if (exp.seconds != null) check(`${file}: held ~${exp.seconds} s`, Math.abs(r.held - exp.seconds) <= 2, `held ${r.held.toFixed(1)} s`);
  if (exp.reps != null) {
    const tol = exp.repsTolerance ?? 0;
    check(`${file}: ${exp.reps} reps${tol ? ` ±${tol}` : ""}`, Math.abs(scores.length - exp.reps) <= tol, info);
  }
  if (exp.noReps) check(`${file}: no reps counted`, scores.length === 0, info);
  if (exp.minScore != null && scores.length) check(`${file}: every rep ≥ ${exp.minScore}`, Math.min(...scores) >= exp.minScore, info);
  if (exp.maxScore != null && scores.length) check(`${file}: every rep ≤ ${exp.maxScore}`, Math.max(...scores) <= exp.maxScore, info);
  for (const k of exp.faults ?? []) check(`${file}: flags "${k}"`, faults.has(k), info);
  if (exp.clean) check(`${file}: no faults`, faults.size === 0, info);
}

if (!files.length) console.log("No recordings in tests/fixtures yet (see RECORDING_GUIDE.md).");
console.log(`\n${fail ? `${fail} replay check(s) FAILED` : "All replay checks pass"} (${pass} passed, ${files.length} recording${files.length === 1 ? "" : "s"}${skipped ? `, ${skipped} without expectations` : ""})`);
process.exit(fail ? 1 : 0);
