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
console.log(`\n${fail ? `${fail} library check(s) FAILED` : "All library checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
