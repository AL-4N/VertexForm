/**
 * guide.test.mjs — public/guide.html is generated (tools/make-guide.mjs from
 * tools/guide-body.html). Run `node tools/make-guide.mjs`, then `npm run sw`,
 * if it's stale.
 */
import fs from "node:fs";
import path from "node:path";
import { render } from "../tools/make-guide.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let fails = 0;
const check = (name, ok, why = "") => { if (!ok) { fails++; console.log(`FAIL ${name} ${why}`); } };
const page = fs.readFileSync(path.join(ROOT, "public", "guide.html"), "utf8");
check("guide.html matches its generator", page === render(), "run node tools/make-guide.mjs");
for (const id of ["setup", "scoring", "limits"]) check(`guide has #${id}`, page.includes(`id="${id}"`));
check("the homepage links to the guide", fs.readFileSync(path.join(ROOT, "public", "index.html"), "utf8").includes('href="guide.html"'));
console.log(fails ? `guide: ${fails} failed` : "guide: page in step");
process.exit(fails ? 1 : 0);
