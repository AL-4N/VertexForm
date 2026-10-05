/**
 * session.test.mjs — end-to-end checks of the live analysis engine.
 *
 * Simulated people (tests/helpers/synth.mjs) do sets of every exercise, with
 * good form and with common faults, at different frame rates, with camera
 * jitter and dropped frames. Each check asserts what a coach would expect:
 * the right rep count, a fair score, and the right fault called out.
 *
 * Run: npm test   (or: node tests/session.test.mjs)
 */

import { Session } from "../public/js/session.js";
import { getExercise } from "../public/js/exercises/index.js";
import { repStream, holdStream, faceCamera, turnAround, W, H } from "./helpers/synth.mjs";

const easeIO = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

const ASPECT = W / H;
let passed = 0, failed = 0;

function run(exName, stream, opts = {}, mapLms = (x) => x) {
  const s = new Session(getExercise(exName), { mode: "set", target: 90, goal: 1, setReps: 5, ...opts });
  const events = [], states = new Set();
  for (const f of stream) {
    const out = s.update(f.lms ? mapLms(f.lms) : null, ASPECT, f.t, f.world ?? null);
    states.add(out.state);
    events.push(...out.events);
    if (s.done) break;
  }
  const reps = events.filter((e) => e.type === "rep" || e.type === "segment");
  const faults = new Set(reps.flatMap((e) => (e.faults ?? []).map((f) => f.key)));
  return {
    session: s, reps, scores: reps.map((e) => e.score), faults, states,
    shallow: events.filter((e) => e.type === "shallow").length,
    done: s.done,
    min: Math.min(...reps.map((e) => e.score)), max: Math.max(...reps.map((e) => e.score)),
  };
}

function check(name, cond, detail) {
  if (cond) { passed++; console.log(`PASS  ${name.padEnd(46)} ${detail}`); }
  else      { failed++; console.log(`FAIL  ${name.padEnd(46)} ${detail}`); }
}
const fmt = (r) => `reps=${r.reps.length} scores=[${r.scores.join(",")}] faults=[${[...r.faults].join(",")}] shallow=${r.shallow}`;

const STAND = { depth: -8, lean: 5 };       // standing tall, knees straight

/* ── Squat ─────────────────────────────────────────────── */
let r = run("Squat", repStream("squat", STAND, { depth: 100, lean: 25 }));
check("Squat: 5 good reps all score A", r.reps.length === 5 && r.min >= 90 && r.done, fmt(r));
check("Squat: good reps raise no faults", r.faults.size === 0, fmt(r));

r = run("Squat", repStream("squat", STAND, { depth: 55, lean: 20 }));
check("Squat: half squats score C/D, flagged for depth", r.reps.length === 5 && r.max < 80 && r.min >= 60 && r.faults.has("depth"), fmt(r));

r = run("Squat", repStream("squat", STAND, { depth: 100, lean: 52 }));
check("Squat: folding forward flagged as lean", r.reps.length === 5 && r.max < 85 && r.faults.has("lean"), fmt(r));

r = run("Squat", repStream("squat", STAND, { depth: 6, lean: 8 }));
check("Squat: tiny dips are 'no rep', not counted", r.reps.length === 0 && r.shallow >= 4, fmt(r));

r = run("Squat", repStream("squat", STAND, { depth: 100, lean: 25 }, { timing: [0.35, 0.05, 0.35, 0.3] }));
check("Squat: rushed reps still count, flagged tempo", r.reps.length === 5 && r.faults.has("tempo"), fmt(r));

r = run("Squat", repStream("squat", STAND, { depth: 100, lean: 25 }, { fps: 12, noisePx: 4, dropRate: 0.05, seed: 11 }));
check("Squat: 12 fps + jitter + dropped frames", r.reps.length === 5 && r.min >= 88, fmt(r));

r = run("Squat", repStream("squat", STAND, { depth: 100, lean: 25 }, { startBottom: true, lead: 2 }));
check("Squat: starting in the hole doesn't fake a rep", r.reps.length === 5, fmt(r));

r = run("Squat", repStream("squat", STAND, { depth: 100, lean: 25 }), {}, faceCamera);
check("Squat: facing the camera asks you to turn", r.reps.length === 0 && r.states.has("turn"), fmt(r));

r = run("Squat", repStream("squat", STAND, { depth: 100, lean: 25 }), {}, (l) => l.map((p) => ({ ...p, visibility: 0.2 })));
check("Squat: body out of frame asks you to step back", r.reps.length === 0 && r.states.has("partial"), fmt(r));

/* ── Practice mode ─────────────────────────────────────── */
{
  // Two half squats, then good ones: practice (goal 3 at A) should stop after 3 good reps.
  const s = new Session(getExercise("Squat"), { mode: "practice", target: 90, goal: 3, setReps: 5 });
  const feed = (stream) => { for (const f of stream) { s.update(f.lms, ASPECT, f.t + offset); if (s.done) break; } };
  let offset = 0;
  feed(repStream("squat", STAND, { depth: 55, lean: 20 }, { reps: 2 }));
  offset = 1e6;
  feed(repStream("squat", STAND, { depth: 100, lean: 25 }, { reps: 6 }));
  check("Practice: stops after 3 good reps", s.done && s.goodReps === 3 && s.reps.length === 5,
        `reps=[${s.reps.join(",")}] good=${s.goodReps}`);
}

/* ── Push-up ───────────────────────────────────────────── */
r = run("Push-up", repStream("pushup", { depth: 0, hips: 0 }, { depth: 100, hips: 0 }));
check("Push-up: 5 good reps all score A", r.reps.length === 5 && r.min >= 90, fmt(r));

r = run("Push-up", repStream("pushup", { depth: 0, hips: 24 }, { depth: 100, hips: 28 }));
check("Push-up: sagging hips flagged, ~C", r.reps.length === 5 && r.max < 85 && r.faults.has("sag"), fmt(r));

r = run("Push-up", repStream("pushup", { depth: 0, hips: -30 }, { depth: 100, hips: -32 }));
check("Push-up: piked hips flagged", r.reps.length === 5 && r.max < 85 && r.faults.has("pike"), fmt(r));

r = run("Push-up", repStream("pushup", { depth: 0, hips: 0 }, { depth: 40, hips: 0 }));
check("Push-up: half reps are 'no rep'", r.reps.length === 0 && r.shallow >= 4, fmt(r));

/* ── Lunge ─────────────────────────────────────────────── */
r = run("Lunge", repStream("lunge", { depth: 0, lean: 3 }, { depth: 100, lean: 5 }));
check("Lunge: 5 good reps all score A", r.reps.length === 5 && r.min >= 90, fmt(r));

r = run("Lunge", repStream("lunge", { depth: 0, lean: 10 }, { depth: 100, lean: 34 }));
check("Lunge: leaning over flagged", r.reps.length === 5 && r.max < 85 && r.faults.has("lean"), fmt(r));

r = run("Lunge", repStream("lunge", { depth: 0, lean: 3 }, { depth: 35, lean: 5 }));
check("Lunge: shallow lunges are 'no rep'", r.reps.length === 0 && r.shallow >= 4, fmt(r));

/* ── Jumping jack ──────────────────────────────────────── */
const JACK_T = { timing: [0.3, 0.08, 0.3, 0.1], reps: 8 };
r = run("Jumping Jack", repStream("jack", { arms: 0, feet: 0 }, { arms: 100, feet: 100 }, JACK_T), { setReps: 8 });
check("Jumping jack: 8 fast full reps all A", r.reps.length === 8 && r.min >= 90, fmt(r));

r = run("Jumping Jack", repStream("jack", { arms: 0, feet: 0 }, { arms: 100, feet: 10 }, JACK_T), { setReps: 8 });
check("Jumping jack: lazy feet flagged", r.reps.length === 8 && r.max < 90 && r.faults.has("feet"), fmt(r));

r = run("Jumping Jack", repStream("jack", { arms: 0, feet: 0 }, { arms: 100, feet: 100 }, { ...JACK_T, fps: 15, noisePx: 3 }), { setReps: 8 });
check("Jumping jack: still counts every rep at 15 fps", r.reps.length === 8, fmt(r));

/* ── Plank ─────────────────────────────────────────────── */
r = run("Plank", holdStream("plank", { hips: 0 }));
check("Plank: 30 s set, straight body, all A", r.done && r.reps.length === 6 && r.min >= 90, fmt(r));

r = run("Plank", holdStream("plank", { hips: 28 }));
check("Plank: sagging hold scores low, flagged sag", r.done && r.max < 70 && r.faults.has("sag"), fmt(r));

r = run("Plank", holdStream("plank", { hips: 0 }, { seconds: 15 }), { mode: "practice", goal: 1 });
check("Plank practice: 10 s at target finishes", r.done, fmt(r));

/* ── Tracking glitches, side flips, occlusion, turning ── */
const GOOD_SQUAT = [STAND, { depth: 100, lean: 25 }];
{
  // Every ~1.3 s the ankle jumps 25% of the frame for two frames (a classic MediaPipe swap).
  const glitch = (f) => {
    if (f.i % 40 < 2 && f.i > 30) f.lms[27] = { ...f.lms[27], x: f.lms[27].x + 0.25, y: f.lms[27].y - 0.15 };
    return f;
  };
  r = run("Squat", repStream("squat", ...GOOD_SQUAT, { mutate: glitch }));
  check("Glitches: bone-length spikes are rejected", r.reps.length === 5 && r.min >= 90 && r.session.glitches > 0,
        `${fmt(r)} glitches=${r.session.glitches}`);

  // The far side looks better for 100 ms bursts: the measured side must not flip.
  const flip = (f) => {
    if (f.i % 20 < 3 && f.i > 20) f.lms = f.lms.map((p, j) => ({ ...p, visibility: j % 2 === 1 && j >= 11 ? 0.55 : j >= 11 ? 0.99 : p.visibility }));
    return f;
  };
  r = run("Squat", repStream("squat", ...GOOD_SQUAT, { mutate: flip }));
  check("Side flips: brief flickers don't switch legs", r.reps.length === 5 && r.min >= 90 && r.session.sides.switches === 0,
        `${fmt(r)} switches=${r.session.sides.switches}`);

  // The knee is hidden for 4 frames (133 ms) every 25 frames: bridged, reps unaffected.
  const hideKnee = (f) => {
    if (f.i % 25 < 4 && f.i > 25) f.lms[25] = { ...f.lms[25], visibility: 0.1 };
    return f;
  };
  r = run("Squat", repStream("squat", ...GOOD_SQUAT, { mutate: hideKnee }));
  check("Occlusion: short gaps bridged", r.reps.length === 5 && r.min >= 90 && r.session.gaps.filledFrames > 0,
        `${fmt(r)} filled=${r.session.gaps.filledFrames}`);

  // Hidden for 1 s mid-set: frames dropped, no garbage reps, the set still completes.
  const longHide = (f) => {
    if (f.t > 3500 && f.t < 4500) f.lms[25] = { ...f.lms[25], visibility: 0.1 };
    return f;
  };
  r = run("Squat", repStream("squat", ...GOOD_SQUAT, { reps: 6, mutate: longHide }));
  check("Occlusion: long gap drops frames, no fake reps", r.states.has("occluded") && r.reps.length === 5 && r.min >= 88, fmt(r));

  // Turned 30° from side-on, with 3D world landmarks: still counted and graded fairly.
  r = run("Squat", repStream("squat", ...GOOD_SQUAT, { rotate: 30, world: { noiseXY: 0.01, noiseZ: 0.03 } }));
  check("Turned 30° with 3D data: squats still A", r.reps.length === 5 && r.min >= 90 && r.session.w3 > 0, `${fmt(r)} w3=${r.session.w3.toFixed(2)}`);
  r = run("Push-up", repStream("pushup", { depth: 0, hips: 0 }, { depth: 100, hips: 0 }, { rotate: 30, world: { noiseXY: 0.01, noiseZ: 0.03 } }));
  check("Turned 30° with 3D data: push-ups still A", r.reps.length === 5 && r.min >= 90, fmt(r));
}

/* ── Rep robustness (phase 3) ─────────────────────────── */
{
  // Slow grinder: 1.5 s down, then a 4 s fight up with a sticking point.
  const grind = (c) => {
    if (c < 1.5) return easeIO(c / 1.5);
    if (c < 1.9) return 1;
    if (c < 5.9) {
      const u = (c - 1.9) / 4;
      const g = u < 0.3 ? 0.4 * (u / 0.3) : u < 0.7 ? 0.4 + 0.05 * ((u - 0.3) / 0.4) : 0.45 + 0.55 * ((u - 0.7) / 0.3);
      return 1 - g;
    }
    return 0;
  };
  r = run("Squat", repStream("squat", ...GOOD_SQUAT, { timing: [1.5, 0.4, 4.0, 0.6], profile: grind }));
  check("Slow grinders (6 s reps, sticking point) count", r.reps.length === 5 && r.min >= 88, fmt(r));

  // Double bounce at the bottom: up half-way, back down, then stand.
  const bounce = (c) => {
    if (c < 1.0) return easeIO(c);
    if (c < 2.2) { const u = c - 1.0; return u < 0.3 ? 1 : u < 0.6 ? 1 - 0.55 * easeIO((u - 0.3) / 0.3) : u < 0.9 ? 0.45 + 0.55 * easeIO((u - 0.6) / 0.3) : 1; }
    if (c < 3.2) return 1 - easeIO(c - 2.2);
    return 0;
  };
  r = run("Squat", repStream("squat", ...GOOD_SQUAT, { timing: [1.0, 1.2, 1.0, 0.6], profile: bounce }));
  check("Double bounce at the bottom counts once", r.reps.length === 5 && r.shallow === 0, fmt(r));

  // Resting 8 s at the top after rep 2: clock pauses, nothing counts, resumes.
  const s = new Session(getExercise("Squat"), { mode: "set", target: 90, goal: 1, setReps: 5 });
  const ev = [];
  for (const f of repStream("squat", ...GOOD_SQUAT, { rests: { afterRep: 2, seconds: 8 } })) {
    ev.push(...s.update(f.lms, ASPECT, f.t).events);
    if (s.done) break;
  }
  const res = s.results();
  check("Resting mid-set: detected, then resumes", ev.some((e) => e.type === "rest-start") && ev.some((e) => e.type === "rest-end") && s.reps.length === 5,
        `reps=${s.reps.length} rest=${res.restSeconds}s active=${res.activeSeconds}s`);
  check("Resting mid-set: set clock paused", res.restSeconds >= 3 && res.activeSeconds < 20, `rest=${res.restSeconds}s active=${res.activeSeconds}s`);

  // Walk out of frame for 2.6 s during rep 3, back at the top before rep 4.
  const walkOut = (f) => (f.t > 7000 && f.t < 9600 ? { ...f, lms: null } : f);
  r = run("Squat", repStream("squat", ...GOOD_SQUAT, { reps: 6, mutate: walkOut }));
  check("Walking out of frame: no fake reps, set completes", r.reps.length === 5 && r.min >= 88, fmt(r));
  // ...and mid-rep: that rep is abandoned, not half-scored.
  const midRep = (f) => (f.t > 1300 && f.t < 3500 ? { ...f, lms: null } : f);
  r = run("Squat", repStream("squat", ...GOOD_SQUAT, { reps: 6, mutate: midRep }));
  check("Walking out mid-rep: that rep is dropped", r.reps.length === 5 && r.min >= 88, fmt(r));

  // A 0.25 s twitch through the bottom: faster than any real rep.
  const twitch = (c) => (c < 0.12 ? easeIO(c / 0.12) : c < 0.25 ? 1 - easeIO((c - 0.12) / 0.13) : 0);
  r = run("Squat", repStream("squat", ...GOOD_SQUAT, { timing: [0.12, 0, 0.13, 1.5], profile: twitch }));
  check("Twitches (0.25 s 'reps') don't count", r.reps.length === 0 && r.shallow === 0, fmt(r));

  // Sitting at the bottom for 14 s: too long for a rep, dropped quietly.
  r = run("Squat", repStream("squat", ...GOOD_SQUAT, { reps: 1, timing: [1, 14, 1, 1] }));
  check("Stuck at the bottom 14 s: not a rep", r.reps.length === 0, fmt(r));

  for (const fps of [10, 15, 30]) {
    r = run("Squat", repStream("squat", ...GOOD_SQUAT, { fps, noisePx: 3, jitterMs: 1000 / fps / 3, seed: fps }));
    check(`Squat at ${fps} fps (irregular frame times)`, r.reps.length === 5 && r.min >= 88, fmt(r));
  }

  // Per-rep data for the coach and the results screen.
  const d = run("Squat", repStream("squat", ...GOOD_SQUAT, { timing: [1.2, 0.5, 0.8, 0.6] })).session.results().details[0];
  const sum = d.phases.down + d.phases.bottom + d.phases.up;
  check("Per-rep data: phases add up to the rep", Math.abs(sum - d.duration) < 0.01 && d.phases.down > d.phases.up,
        JSON.stringify(d.phases));
  check("Per-rep data: depth and lean recorded", Number.isFinite(d.measures.depthDeg) && Number.isFinite(d.measures.lean), JSON.stringify(d.measures));
}

/* ── Confidence gate + facing (overlay) ───────────────── */
{
  /** Run a session and collect what the overlay would have done. */
  const runOverlay = (exName, stream, map = (f) => f) => {
    const s = new Session(getExercise(exName), { mode: "set", target: 90, goal: 1, setReps: 50 });
    const overlays = {}, facings = [];
    let reps = 0;
    for (const f0 of stream) {
      const f = map(f0);
      const out = s.update(f.lms, ASPECT, f.t, f.world ?? null);
      overlays[out.overlay ?? "none"] = (overlays[out.overlay ?? "none"] ?? 0) + 1;
      if (out.overlay === "rep") facings.push(out.facing?.dir);
      reps += out.events.filter((e) => e.type === "rep").length;
    }
    return { s, overlays, facings, reps };
  };

  // Walking across the room, bobbing a little: never lines, never reps.
  const walk = (f) => (f.lms ? { ...f, lms: f.lms.map((p) => ({ ...p, x: p.x + (f.t / 1000) * 0.2 - 0.25 })) } : f);
  let o = runOverlay("Squat", repStream("squat", STAND, { depth: 40, lean: 10 }, { reps: 6, timing: [0.4, 0.1, 0.4, 0.3] }), walk);
  check("Walking around: no lines, no reps", o.reps === 0 && !o.overlays.rep && (o.overlays.none ?? 0) > (o.overlays.ready ?? 0), JSON.stringify(o.overlays));

  o = runOverlay("Squat", repStream("squat", ...GOOD_SQUAT));
  check("Facing right: reps counted, guide points right", o.reps === 5 && o.facings.length > 20 && o.facings.every((d) => d === 1), `reps=${o.reps} rep-frames=${o.facings.length}`);
  check("Overlay: 'rep' only mid-rep, 'ready' between", o.overlays.rep > 0 && o.overlays.ready > 0, JSON.stringify(o.overlays));

  o = runOverlay("Squat", repStream("squat", ...GOOD_SQUAT), (f) => (f.lms ? { ...f, lms: turnAround(f.lms) } : f));
  check("Facing left: reps counted, guide points left", o.reps === 5 && o.facings.length > 20 && o.facings.every((d) => d === -1), `reps=${o.reps}`);

  // Turns round between rep 3 and 4 (t ≈ 9.5 s): the side switches, facing follows, nothing breaks.
  o = runOverlay("Squat", repStream("squat", ...GOOD_SQUAT, { reps: 6 }), (f) => (f.lms && f.t > 9500 ? { ...f, lms: turnAround(f.lms) } : f));
  const after = o.facings.slice(-15);
  check("Turning round mid-set: side + facing follow, reps keep counting", o.reps === 6 && o.s.sides.side === "RIGHT" && after.every((d) => d === -1),
        `reps=${o.reps} side=${o.s.sides.side} last=${after.join("")}`);

  // Jittery, barely-visible tracking (a dark room): don't draw, don't count.
  const jittery = (f, rand) => (f.lms ? { ...f, lms: f.lms.map((p) => ({ ...p, x: p.x + (rand() - 0.5) * 0.02, y: p.y + (rand() - 0.5) * 0.02, visibility: 0.5 + rand() * 0.12 })) } : f);
  o = runOverlay("Squat", repStream("squat", ...GOOD_SQUAT, { mutate: jittery, seed: 21 }));
  check("Jittery low-visibility frames: no lines, no reps", o.reps === 0 && !o.overlays.rep, JSON.stringify(o.overlays));
}

/* ── Calibration inside a session ──────────────────────── */
{
  const s = new Session(getExercise("Squat"), { mode: "set", target: 90, goal: 1, setReps: 5, armed: false });
  let ready = false;
  for (const f of repStream("squat", ...GOOD_SQUAT, { reps: 0, lead: 3 })) {
    const out = s.update(f.lms, ASPECT, f.t);
    ready ||= !!out.ready;
  }
  check("Unarmed: standing still calibrates and reports ready", !!s.calib && ready && s.reps.length === 0,
        `topKnee=${s.calib?.topMetric.toFixed(1)} shallow=${s.shallow}`);
  let last = s.lastT;
  const feed = (stream) => { const base = last + 33; for (const f of stream) { s.update(f.lms, ASPECT, base + f.t); last = base + f.t; } };
  feed(repStream("squat", ...GOOD_SQUAT, { reps: 3 }));
  check("Unarmed: reps are not counted until armed", s.reps.length === 0);
  s.arm();
  feed(repStream("squat", ...GOOD_SQUAT, { reps: 3 }));
  check("Armed: reps count", s.reps.length === 3, `reps=[${s.reps.join(",")}]`);
}

/* ── Results summary ───────────────────────────────────── */
{
  const res = run("Squat", repStream("squat", STAND, { depth: 55, lean: 20 })).session.results();
  check("Results: fault counted once per rep", res.faults.filter((k) => k === "depth").length === 5,
        `faults=[${res.faults.join(",")}]`);
  check("Results: component bars averaged across reps", res.bars.some((b) => b.label === "Depth" && b.value < 60),
        JSON.stringify(res.bars));
}

console.log(`\n${failed ? "SOME SESSION CHECKS FAILED" : "All session checks pass"} (${passed} passed, ${failed} failed)`);
if (failed) process.exit(1);
