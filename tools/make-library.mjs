/**
 * make-library.mjs — writes public/exercises.html, the exercise library:
 *   node tools/make-library.mjs
 *
 * Every word and figure on that page comes from the trainer's own code, so
 * it can't drift from what the app really does: the exercise list
 * (config.js), what a good rep looks like (DEMO_TIPS), what it scores
 * (each pose's measure()), the mistakes it flags and the exact words it says
 * (coaching.js FAULTS), the setup line (POSITION_CUES) and the skills each
 * exercise unlocks (skills.js). The page is plain HTML (readable without
 * scripts, and by search engines); tests/library.test.mjs fails if it's out
 * of date. Run this after changing any of those, then `npm run sw`.
 */
import fs from "node:fs";
import path from "node:path";
import { EXERCISES, DEMO_TIPS } from "../public/js/config.js";
import { FAULTS, POSITION_CUES } from "../public/js/coaching.js";
import { REGISTRY } from "../public/js/exercises/index.js";
import { PATHS } from "../public/js/skills.js";
import { BY_NAME } from "../public/js/figures/pictos.js";
import { BY_ID } from "../public/js/figures/poses.js";
import { build } from "../public/js/figures/rig.js";
import { figureMarkup, bounds } from "../public/js/figures/draw.js";
import { shell, esc } from "./page-shell.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "exercises.html");

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];
const steps = PATHS.flatMap((p) => p.steps.map((s) => ({ ...s, path: p.name })));

function figure(id) {
  const ex = BY_ID[id];
  const s = build(ex[ex.good ?? "bottom"]);
  const b = bounds(s, 26);
  const parts = ex.measure(s).parts.map(([k]) => k);
  const svg = `<svg viewBox="${b.x0.toFixed(1)} ${b.y0.toFixed(1)} ${b.w.toFixed(1)} ${b.h.toFixed(1)}" role="img" aria-label="Stick figure: a ${esc(ex.name.toLowerCase())} with good form">${figureMarkup(s, { color: "#2ee59d", floor: ex.ground === false ? null : { x0: b.x0 + 6, x1: b.x1 - 6 }, prop: ex.prop, headFill: "#0b1122" })}</svg>`;
  return { svg, parts };
}

function entry(name, i) {
  const id = BY_NAME[name], mod = REGISTRY[name];
  const { svg, parts } = figure(id);
  const tags = [mod.frontFacing ? "Front-on" : "Side-on", mod.isHold ? "Hold" : "Reps"];
  const faults = Object.entries(FAULTS[name] ?? {}).sort((a, b) => b[1][0] - a[1][0]);
  const skills = steps.filter((s) => s.test?.exercise === name);
  const n = String(i + 1).padStart(2, "0");
  return `
      <article class="lib-ex" id="ex-${id}">
        <figure class="lib-fig"><figcaption>FIG ${n}</figcaption>${svg}</figure>
        <div class="lib-body">
          <div class="lib-title"><h2>${esc(name)}</h2><span class="lib-tags">${tags.join(" · ")}</span></div>
          <p class="lib-setup">${esc(POSITION_CUES[name] ?? "")}.</p>
          <dl class="lib-facts">
            <div><dt>Scored on</dt><dd>${parts.map(esc).join(", ")}</dd></div>
            <div><dt>A good ${mod.isHold ? "hold" : "rep"}</dt><dd><ul>${(DEMO_TIPS[name] ?? []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul></dd></div>
            <div><dt>It flags</dt><dd><ul class="lib-faults">${faults.map(([, [, label, bank]]) => `<li><strong>${esc(label)}</strong> <q>${esc(bank[0])}.</q></li>`).join("")}</ul></dd></div>
            <div><dt>Unlocks</dt><dd>${skills.length ? `<ul>${skills.map((s) => `<li><strong>${esc(s.name)}</strong> <span>${esc(s.path)} path: ${esc(s.goal.charAt(0).toLowerCase() + s.goal.slice(1))}</span></li>`).join("")}</ul>` : "Not a skill on the paths yet"}</dd></div>
          </dl>
          <a class="btn btn-ghost btn-sm" href="app.html#train-${id}">Train ${esc(name.toLowerCase())}</a>
        </div>
      </article>`;
}

export function render() {
  const count = WORDS[EXERCISES.length] ?? String(EXERCISES.length);
  return shell({
    generator: "tools/make-library.mjs from the trainer's code",
    title: "Exercises: how VertexForm grades each one",
    description: `${count} exercises VertexForm grades through your webcam: what each one measures, the mistakes it flags, what the coach says, and the skills it unlocks.`,
    active: "exercises.html",
    body: `  <section class="section lib" data-tone="dark">
    <div class="wrap">
      <div class="section-head">
        <span class="tag tag-live">Exercise library</span>
        <h1>${count} exercises, <span class="dim">and how each one is graded.</span></h1>
        <p>Everything here comes from the trainer's own code: what it measures, the mistakes it
           flags and the words it says for each, and the skills a set can unlock.</p>
      </div>
      <nav class="lib-index" aria-label="Exercises">${EXERCISES.map((name) => `<a href="#ex-${BY_NAME[name]}">${esc(name)}</a>`).join("")}</nav>
${EXERCISES.map(entry).join("\n")}
    </div>
  </section>`,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  fs.writeFileSync(OUT, render());
  console.log(`exercises.html: ${EXERCISES.length} exercises`);
}
