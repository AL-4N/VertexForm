/**
 * rep3d.test.mjs — the homepage's 3D rep viewer (public/data/rep3d.json,
 * made by tools/make-rep3d.mjs) shows scores the real engine gives today.
 * If scoring changes, rerun `node tools/make-rep3d.mjs` and `npm run sw`.
 */
import fs from "node:fs";
import path from "node:path";
import { CLIPS, KEEP, framesOf, score } from "../tools/make-rep3d.mjs";
import { prepareClips, angle3 } from "../public/js/figures/scene3d.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} ${detail}`);
};

const file = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public", "data", "rep3d.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
check("rep3d.json: format and joints", data.format === "vertexform-rep3d" && data.version === 2 && JSON.stringify(data.keep) === JSON.stringify(KEEP));
const ready = prepareClips(data);

for (const c of CLIPS) {
  const clip = data.clips.find((x) => x.id === c.id);
  if (!clip) { check(`${c.id}: clip present`, false); continue; }
  const now = score(c, framesOf(c));
  check(`${c.id}: saved scores match the engine today`, JSON.stringify(now) === JSON.stringify(clip.reps),
    `saved ${clip.reps.map((r) => r.score)} now ${now.map((r) => r.score)}`);
  check(`${c.id}: one time per frame`, clip.t.length === clip.w.length && clip.w.every((w) => w.length === KEEP.length * 3));

  const { frames, side, measure } = ready[c.id];
  const lowest = Math.max(...frames.map((p) => Math.abs(Math.min(p.heL[1], p.heR[1], p.toL[1], p.toR[1]))));
  check(`${c.id}: feet stay on the floor`, lowest < 0.03, `max gap ${(lowest * 100).toFixed(1)} cm`);
  // The readout's measured angle over the clip: [smallest, largest].
  const angles = frames.map((p) => angle3(...measure.joints(side).map((k) => p[k])));
  const lo = Math.min(...angles), hi = Math.max(...angles);
  const range = { full: [55, 95], half: [85, 125], pushup: [70, 110], plank: [160, 181], lunge: [75, 110], jack: [0, 60] }[c.id];
  check(`${c.id}: ${measure.label.toLowerCase()} is plausible`, lo >= range[0] && lo <= range[1] && (c.id !== "jack" || hi > 120), `${lo.toFixed(0)}° to ${hi.toFixed(0)}°`);
}
check("every other exercise grades A", ["pushup", "plank", "lunge", "jack"].every((id) => data.clips.find((x) => x.id === id).reps.every((r) => r.score >= 90)));
check("full depth grades A, half squat about C", (() => {
  const f = data.clips.find((x) => x.id === "full").reps, h = data.clips.find((x) => x.id === "half").reps;
  return f.every((r) => r.score >= 90) && h.every((r) => r.score >= 65 && r.score <= 80 && r.faults.includes("depth"));
})());

console.log(`\nrep3d: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
