/**
 * privacy.test.mjs — public/privacy.html is generated (tools/make-privacy.mjs)
 * and its promises hold in the code: no cookies, no analytics beacons, no
 * uploads. Run `node tools/make-privacy.mjs`, then `npm run sw`, if it's stale.
 */
import fs from "node:fs";
import path from "node:path";
import { render } from "../tools/make-privacy.mjs";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} ${detail}`); };
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public");
const page = fs.readFileSync(path.join(ROOT, "privacy.html"), "utf8");
check("privacy.html matches its generator", page === render(), page === render() ? "" : "run node tools/make-privacy.mjs");

// The page says: no cookies, no analytics, no uploads. Hold the code to it.
const files = fs.readdirSync(ROOT, { recursive: true }).map(String)
  .filter((f) => /\.(js|html)$/.test(f) && !f.startsWith("vendor") && !f.includes("node_modules"));
const src = files.map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")]);
const hits = (re) => src.filter(([, s]) => re.test(s)).map(([f]) => f);
check("No cookies are set", !hits(/document\.cookie\s*=/).length, hits(/document\.cookie\s*=/).join(", "));
check("No analytics beacons", !hits(/sendBeacon|google-analytics|gtag\(|plausible|posthog|segment\.io/).length, hits(/sendBeacon|google-analytics|gtag\(/).join(", "));
check("Nothing is POSTed anywhere", !hits(/method:\s*["']POST/i).length, hits(/method:\s*["']POST/i).join(", "));
console.log(`\n${fail ? `${fail} privacy check(s) FAILED` : "All privacy checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
