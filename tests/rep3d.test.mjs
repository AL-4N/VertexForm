/**
 * rep3d.test.mjs — the homepage's 3D rep viewer (public/data/rep3d.json,
 * made by tools/make-rep3d.mjs) shows scores the real engine gives today.
 * If scoring changes, rerun `node tools/make-rep3d.mjs` and `npm run sw`.
 */
import fs from "node:fs";
import path from "node:path";
import { CLIPS, KEEP, framesOf, score } from "../tools/make-rep3d.mjs";
import { sceneFrames, angle3 } from "../public/js/site/rep3d.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} ${detail}`);
};

const file = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public", "data", "rep3d.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
check("rep3d.json: format and joints", data.format === "vertexform-rep3d" && JSON.stringify(data.keep) === JSON.stringify(KEEP));

for (const c of CLIPS) {
  const clip = data.clips.find((x) => x.id === c.id);
  if (!clip) { check(`${c.id}: clip present`, false); continue; }
  const now = score(c, framesOf(c));
  check(`${c.id}: saved scores match the engine today`, JSON.stringify(now) === JSON.stringify(clip.reps),
    `saved ${clip.reps.map((r) => r.score)} now ${now.map((r) => r.score)}`);
  check(`${c.id}: one time per frame`, clip.t.length === clip.w.length && clip.w.every((w) => w.length === KEEP.length * 3));

  const frames = sceneFrames(clip, data.keep);
  const lowest = Math.max(...frames.map((p) => Math.abs(Math.min(p.heL[1], p.heR[1], p.toL[1], p.toR[1]))));
  check(`${c.id}: feet stay on the floor`, lowest < 0.03, `max gap ${(lowest * 100).toFixed(1)} cm`);
  const knee = Math.min(...frames.map((p) => angle3(p.hipL, p.knL, p.anL)));
  check(`${c.id}: deepest 3D knee angle is plausible`, c.id === "full" ? knee < 95 : knee > 85 && knee < 125, `${knee.toFixed(0)}°`);
}
check("full depth grades A, half squat about C", (() => {
  const f = data.clips.find((x) => x.id === "full").reps, h = data.clips.find((x) => x.id === "half").reps;
  return f.every((r) => r.score >= 90) && h.every((r) => r.score >= 65 && r.score <= 80 && r.faults.includes("depth"));
})());

console.log(`\nrep3d: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
