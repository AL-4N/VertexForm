/**
 * update-sw.mjs — refresh public/sw.js before a deploy:  npm run sw
 *
 * Lists every file the app needs into PRECACHE and sets VERSION to a hash
 * of their contents, so each release gets a fresh cache and browsers drop
 * the old one. (`npm test` checks this was run: tests/pwa.test.mjs.)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public");
const SKIP = new Set(["sw.js", "_headers", ".DS_Store"]);

export function appFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      // Voice clips (public/audio/*/*.mp3, ~14 MB) aren't precached: each is
      // cached the first time it plays (sw.js). Their manifests are.
      else if (!SKIP.has(name) && !name.startsWith(".") && !name.endsWith(".txt") && !name.endsWith(".mp3")) out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  walk(root);
  return out;
}

export function versionOf(files) {
  const h = crypto.createHash("sha256");
  for (const f of files) { h.update(f); h.update(fs.readFileSync(path.join(root, f))); }
  return h.digest("hex").slice(0, 12);
}

export function render(src, files) {
  return src
    .replace(/const VERSION = ".*?";/, `const VERSION = "${versionOf(files)}";`)
    .replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = [\n${["./", ...files].map((f) => `  "${f}",`).join("\n")}\n];`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const swPath = path.join(root, "sw.js");
  const files = appFiles();
  fs.writeFileSync(swPath, render(fs.readFileSync(swPath, "utf8"), files));
  console.log(`sw.js: ${files.length} files, version ${versionOf(files)}`);
}
