/**
 * pwa.test.mjs — the installable app is wired up: sw.js lists every app file
 * and its version matches their contents (i.e. `npm run sw` was run after the
 * last change), and the manifest's icons exist. Run with:  npm test
 */
import fs from "node:fs";
import path from "node:path";
import { appFiles, versionOf } from "../tools/update-sw.mjs";

const pub = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public");
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(54)} ${detail}`);
};

const sw = fs.readFileSync(path.join(pub, "sw.js"), "utf8");
const files = appFiles();
const listed = [...sw.matchAll(/^\s+"([^"]+)",$/gm)].map((m) => m[1]);
const missing = files.filter((f) => !listed.includes(f));
check("sw.js precaches every app file", !missing.length, missing.length ? `missing: ${missing.join(", ")} (run npm run sw)` : `${files.length} files`);
check("sw.js lists no files that don't exist", listed.every((f) => f === "./" || files.includes(f)));
const v = sw.match(/const VERSION = "(.*?)";/)?.[1];
check("Cache version matches the files (npm run sw was run)", v === versionOf(files), `sw ${v} vs files ${versionOf(files)}`);
check("MediaPipe is cached first, app files network first", /cacheFirst\(req\)/.test(sw) && /networkFirst\(req\)/.test(sw));

const mf = JSON.parse(fs.readFileSync(path.join(pub, "manifest.webmanifest"), "utf8"));
check("Manifest: name, start page, standalone", mf.short_name === "VertexForm" && mf.start_url === "app.html" && mf.display === "standalone");
check("Manifest icons exist (incl. maskable)", mf.icons.every((i) => fs.existsSync(path.join(pub, i.src))) && mf.icons.some((i) => i.purpose === "maskable"));
for (const page of ["index.html", "app.html"]) {
  const html = fs.readFileSync(path.join(pub, page), "utf8");
  check(`${page} links the manifest`, html.includes('rel="manifest"'));
}

console.log(`\n${fail ? `${fail} PWA check(s) FAILED` : "All PWA checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
