/**
 * make-guide.mjs — writes public/guide.html:   node tools/make-guide.mjs
 *
 * The Guide: the reference material that used to make the homepage long
 * (camera setup, how the scoring is tested, what it can't do yet), in the
 * site's shell. Its body is tools/guide-body.html; each score is drawn in
 * its own grade colour here (the homepage did that in script).
 * tests/guide.test.mjs fails if the page is stale.
 */
import fs from "node:fs";
import path from "node:path";
import { shell } from "./page-shell.mjs";
import { gradeColor } from "../public/js/grade.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "guide.html");

export function render() {
  const body = fs.readFileSync(path.join(ROOT, "tools", "guide-body.html"), "utf8")
    .replace(/^<!--[^\n]*-->\n/, "")
    .replace(/data-score="(\d+)"/g, (_, n) => `data-score="${n}" style="--c:${gradeColor(Number(n))}"`);
  return shell({
    generator: "tools/make-guide.mjs",
    title: "Guide: VertexForm",
    description: "How to set up your camera for VertexForm, how its scoring is tested, and what it can't do yet.",
    active: "guide.html",
    body,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  fs.writeFileSync(OUT, render());
  console.log("guide.html written");
}
