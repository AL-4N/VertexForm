/**
 * library.test.mjs — public/exercises.html is generated from the trainer's
 * code (tools/make-library.mjs). Fails if it's out of date: run
 * `node tools/make-library.mjs`, then `npm run sw`.
 */
import fs from "node:fs";
import { render } from "../tools/make-library.mjs";
import { EXERCISES } from "../public/js/config.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} ${detail}`); };
const page = fs.readFileSync(new URL("../public/exercises.html", import.meta.url), "utf8");
const fresh = render();
check("exercises.html matches the trainer's code", page === fresh, page === fresh ? "" : "run node tools/make-library.mjs");
check("Every exercise has a plate", EXERCISES.every((e) => fresh.includes(`<h2>${e}</h2>`)), `${EXERCISES.length} exercises`);
check("No em dashes in the page", !/—/.test(fresh));
// The homepage shows five exercises as plates and the rest as small figures
// linking here: every exercise must be one or the other.
const home = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const { BY_NAME } = await import("../public/js/figures/pictos.js");
const missing = EXERCISES.filter((e) => !home.includes(`data-picto="${BY_NAME[e]}"`));
check("Every exercise is on the homepage (plate or small figure)", !missing.length, missing.join(", "));
console.log(`\n${fail ? `${fail} library check(s) FAILED` : "All library checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
