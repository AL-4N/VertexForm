/**
 * overlay.test.mjs — when lines are drawn, and the ideal-form guide:
 * confidence score + gate (hysteresis), the facing vote (each cue, lock
 * mid-rep, low confidence → no guide), mirroring, and the guide's geometry
 * for left- and right-facing people. Run with:  npm test
 */
import {
  frameConfidence, ConfidenceGate, facingCues, facingVote, FacingTracker, DriftMeter,
} from "../public/js/tracking.js";
import { buildGuide, mirrorGuide, guideAlpha } from "../public/js/guide.js";
import { aspectCorrect } from "../public/js/session.js";
import { repStream, turnAround, W, H } from "./helpers/synth.mjs";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} ${detail}`);
};
const ASPECT = W / H;

/** The simulator frame closest to a point in the rep (k: 0 = top, 1 = bottom). */
const frameAt = (id, top, bottom, k, opts = {}) => [...repStream(id, top, bottom, { reps: 1, timing: [0.5, 1, 0.5, 0.3], noisePx: 0, ...opts })]
  .filter((f) => f.lms).reduce((best, f) => (Math.abs(f.k - k) < Math.abs(best.k - k) ? f : best));
const STAND = { depth: -8, lean: 5 }, DEEP = { depth: 100, lean: 25 };

console.log("Confidence");
{
  const good = frameConfidence({ visibility: 0.95, facingRatio: 0.1, posture: 1, drift: 0.1 });
  check("Clear, side-on, in posture, still: confident", good.value > 0.9, good.value.toFixed(2));
  const walking = frameConfidence({ visibility: 0.95, facingRatio: 0.1, posture: 1, drift: 1.6 });
  check("Walking across the frame: not confident (weakest = still)", walking.value < 0.2 && walking.weakest === "still");
  const lying = frameConfidence({ visibility: 0.95, facingRatio: 0.1, posture: 0, drift: 0 });
  check("Wrong posture for the exercise: not confident", lying.value === 0 && lying.weakest === "posture");
  const blurry = frameConfidence({ visibility: 0.55, facingRatio: 0.1 });
  check("Barely visible joints: not confident", blurry.value < 0.2 && blurry.weakest === "visibility");
  check("A bone suddenly 30% off: not confident", frameConfidence({ visibility: 0.95, boneRatio: 1.3 }).value < 0.05);
  check("Jumping jack: needs to face the camera", frameConfidence({ visibility: 0.95, facingRatio: 0.1, frontFacing: true }).value === 0);
  check("Side switching in progress lowers it a bit", frameConfidence({ visibility: 0.95, sideSwitching: true }).value === 0.8);

  const d = new DriftMeter();
  let drift = 0;
  for (let i = 0; i <= 30; i++) drift = d.update(0.4 + i * 0.01, 0.2, i * 33);
  check("Drift: hips moving 1.5 torsos in a second", Math.abs(drift - 1.5) < 0.05, drift.toFixed(2));
}

console.log("\nGate hysteresis (no flicker)");
{
  const g = new ConfidenceGate();
  const run = (conf, ms) => { let open; for (let t = 0; t < ms; t += 33) open = g.update(conf, clock += 33); return open; };
  let clock = 0;
  check("Opens only after ~0.3 s of confidence", !run(0.9, 260) && run(0.9, 80));
  check("A 200 ms dip doesn't close it", run(0.2, 200) && run(0.9, 100));
  check("Closes after ~0.5 s of low confidence", run(0.2, 460) && !run(0.2, 80));
  check("A brief good moment doesn't reopen it", !run(0.9, 200) && !run(0.2, 100));
  check("In-between confidence (0.5) changes nothing", !run(0.5, 1000));
}

console.log("\nFacing vote");
{
  const right = aspectCorrect(frameAt("squat", STAND, DEEP, 0.6).lms, ASPECT);
  const left = aspectCorrect(turnAround(frameAt("squat", STAND, DEEP, 0.6).lms), ASPECT);
  const byCue = (lms, side) => Object.fromEntries(facingCues(lms, side).map((c) => [c.cue, c.sign]));
  const r = byCue(right, "LEFT"), l = byCue(left, "RIGHT");
  check("Feet, head and knees all point right", r.foot === 1 && r.head === 1 && r.knee === 1, JSON.stringify(r));
  check("Turned round: all point left", l.foot === -1 && l.head === -1 && l.knee === -1, JSON.stringify(l));
  check("Vote: right = +1-ish, left = −1-ish", facingVote(facingCues(right, "LEFT")) > 0.8 && facingVote(facingCues(left, "RIGHT")) < -0.8);
  const standing = aspectCorrect(frameAt("squat", STAND, DEEP, 0).lms, ASPECT);
  check("Standing straight: no knee cue (feet + head still vote)", !facingCues(standing, "LEFT").some((c) => c.cue === "knee") && facingVote(facingCues(standing, "LEFT")) > 0.5);
  const push = aspectCorrect(frameAt("pushup", { depth: 0, hips: 0 }, { depth: 100, hips: 0 }, 0.5).lms, ASPECT);
  const fc = facingCues(push, "LEFT", { floor: true });
  check("Push-up: the head end decides (floor cue)", fc.some((c) => c.cue === "floor" && c.sign === 1) && !fc.some((c) => c.cue === "knee"));
  const noFeet = right.map((p, i) => (i >= 29 ? { ...p, visibility: 0.1 } : i <= 10 ? { ...p, visibility: 0.1 } : p));
  check("No feet, no head, straight legs: no opinion (vote 0)", facingVote(facingCues(noFeet.map((p, i) => (i === 25 || i === 26 ? { ...p, visibility: 0.1 } : p)), "LEFT")) === 0);

  const ft = new FacingTracker();
  let f;
  for (let i = 0; i < 40; i++) f = ft.update(1, i * 33);
  check("Smoothed: settles on → within ~1 s", f.dir === 1 && f.confidence > 0.8, JSON.stringify(f));
  for (let i = 40; i < 60; i++) f = ft.update(-1, i * 33, { lock: true });
  check("Locked mid-rep: a contrary vote doesn't flip it", f.dir === 1 && f.locked);
  f = ft.update(-1, 61 * 33);
  for (let i = 62; i < 120; i++) f = ft.update(-1, i * 33);
  check("After the rep it follows the new direction", f.dir === -1 && !f.locked);
  const unsure = new FacingTracker();
  for (let i = 0; i < 40; i++) f = unsure.update(i % 2 ? 0.3 : -0.3, i * 33);
  check("Mixed signals: low confidence", f.confidence < 0.35, f.confidence.toFixed(2));
}

console.log("\nIdeal guide geometry");
{
  const raw = frameAt("squat", STAND, DEEP, 0.9).lms;
  const g = buildGuide("squat", raw, { side: "LEFT", facing: 1, facingConfidence: 0.9, w: W, h: H });
  const [ank, knee, hip, sh] = g.chain;
  check("Squat, facing right: knee ahead of the ankle", knee.x > ank.x && knee.y < ank.y);
  check("...thigh parallel: hip level with knee, behind it", Math.abs(hip.y - knee.y) < 1 && hip.x < knee.x);
  check("...torso leans forward, shoulders above hips", sh.x > hip.x && sh.y < hip.y);
  check("...anchored at your ankle", Math.abs(ank.x - raw[27].x * W) < 0.01 && Math.abs(ank.y - raw[27].y * H) < 0.01);
  check("...lean wedge opens from upright toward the front", Math.abs(g.wedge.a0 + Math.PI / 2) < 1e-9 && Math.cos(g.wedge.a1) > 0);
  check("...parallel line at knee height, reaching back", Math.abs(g.depth.y - raw[25].y * H) < 1e-6 && g.depth.x0 < g.depth.x1);
  check("...head zone kept clear", g.head && g.head.r > 20);

  const rawL = turnAround(raw);
  const gl = buildGuide("squat", rawL, { side: "RIGHT", facing: -1, facingConfidence: 0.9, w: W, h: H });
  check("Facing left: the same guide, pointing left", gl.chain[1].x < gl.chain[0].x && gl.chain[2].x > gl.chain[1].x && gl.chain[3].x < gl.chain[2].x);
  check("...wedge leans left", Math.cos(gl.wedge.a1) < 0);
  check("Low facing confidence: no guide at all", buildGuide("squat", raw, { side: "LEFT", facing: 1, facingConfidence: 0.2, w: W, h: H }) === null);
  check("Unknown facing: no guide", buildGuide("squat", raw, { side: "LEFT", facing: 0, facingConfidence: 0.9, w: W, h: H }) === null);

  const bones = { thigh: 0.25, shin: 0.22, torso: 0.3 };
  const gb = buildGuide("squat", raw, { side: "LEFT", facing: 1, facingConfidence: 0.9, w: W, h: H, bones });
  const shinPx = Math.hypot(gb.chain[1].x - gb.chain[0].x, gb.chain[1].y - gb.chain[0].y);
  check("Built from YOUR calibrated limb lengths", Math.abs(shinPx - 0.22 * H) < 0.5, `${shinPx.toFixed(1)} px`);

  const m = mirrorGuide(g, W);
  check("Mirrored picture: points flip with the video", Math.abs(m.chain[1].x - (W - g.chain[1].x)) < 1e-9 && m.chain[1].y === g.chain[1].y);
  check("Mirrored: the wedge flips too (leans left on screen)", Math.cos(m.wedge.a1) < 0 && Math.abs(Math.sin(m.wedge.a1) - Math.sin(g.wedge.a1)) < 1e-9);
  check("Mirroring twice gives the original", Math.abs(mirrorGuide(m, W).wedge.a1 - g.wedge.a1) < 1e-9);

  const lunge = buildGuide("lunge", frameAt("lunge", { depth: 0, lean: 3 }, { depth: 100, lean: 5 }, 0.9).lms, { side: "LEFT", facing: 1, facingConfidence: 0.9, w: W, h: H });
  check("Lunge: front shin vertical in the target", Math.abs(lunge.chain[1].x - lunge.chain[0].x) < 0.01);
  const pu = buildGuide("line", frameAt("pushup", { depth: 0, hips: 0 }, { depth: 100, hips: 28 }, 0.9).lms, { side: "LEFT", facing: 1, facingConfidence: 0.9, w: W, h: H });
  check("Push-up: shoulder→ankle line with a tolerance band", pu.line.length === 2 && pu.band > 5 && pu.idealHip);
  const jack = buildGuide("arms", frameAt("jack", { arms: 0, feet: 0 }, { arms: 100, feet: 100 }, 0, { view: "front" }).lms, { side: "LEFT", facing: 0, w: W, h: H });
  check("Jumping jack: arm-height markers above the shoulders, no facing needed", jack.markers.length === 2 && jack.markers.every((p) => p.y < 200));

  check("Guide fades in on the way down…", guideAlpha(0) === 0 && guideAlpha(0.3) > 0.2 && guideAlpha(0.3) < 0.8);
  check("…and is fully on near the bottom", guideAlpha(0.7) === 1 && guideAlpha(1) === 1);
}

console.log(`\n${fail ? `${fail} overlay check(s) FAILED` : "All overlay checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
