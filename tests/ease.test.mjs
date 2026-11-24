// The motion curves (public/js/ui/ease.js): the named easing graphs, the same
// in JS and in both stylesheets, and each one well formed.
import fs from "node:fs";
import { BEZIER, CURVE, ease, cssVar } from "../public/js/ui/ease.js";

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log("FAIL", msg); } };

// 1. Every curve is a CSS custom property, with the same value, in both stylesheets.
for (const file of ["public/css/theme.css", "public/css/site.css"]) {
  const css = fs.readFileSync(file, "utf8");
  for (const k of Object.keys(BEZIER)) ok(css.includes(`${cssVar(k)}: ${CURVE[k]};`), `${file} is missing or differs on ${cssVar(k)} (want ${CURVE[k]})`);
}
// 2. Every curve used by name in the CSS exists.
for (const file of fs.readdirSync("public/css").map((f) => `public/css/${f}`)) {
  for (const [, name] of fs.readFileSync(file, "utf8").matchAll(/var\(--ease-([a-z-]+)\)/g)) {
    const key = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    ok(key in BEZIER, `${file} uses --ease-${name}, which isn't a curve`);
  }
}
// 3. The functions start at 0 and end at 1, and follow their bezier closely.
const bez = ([x1, y1, x2, y2], x) => {
  // Solve the bezier's x(s) = x, then return y(s).
  let lo = 0, hi = 1, s = x;
  for (let i = 0; i < 40; i++) { s = (lo + hi) / 2; const bx = 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s * s * x2 + s ** 3; if (bx < x) lo = s; else hi = s; }
  return 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s * s * y2 + s ** 3;
};
for (const [k, p] of Object.entries(BEZIER)) {
  const f = ease[k];
  ok(typeof f === "function", `ease.${k} missing`);
  if (!f) continue;
  ok(Math.abs(f(0)) < 1e-9 && Math.abs(f(1) - 1) < 1e-9, `ease.${k} doesn't run 0 → 1`);
  let worst = 0;
  for (let i = 0; i <= 20; i++) { const x = i / 20; worst = Math.max(worst, Math.abs(f(x) - bez(p, x))); }
  ok(worst < 0.1, `ease.${k} strays ${worst.toFixed(3)} from its bezier`);
}
// 4. The JS doesn't fall back to unnamed curves.
const js = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? js(`${dir}/${d.name}`) : d.name.endsWith(".js") ? [`${dir}/${d.name}`] : []));
for (const file of js("public/js")) {
  if (file.endsWith("ui/ease.js")) continue;
  const src = fs.readFileSync(file, "utf8");
  ok(!/cubic-bezier\(/.test(src), `${file} has an unnamed cubic-bezier (use CURVE from ui/ease.js)`);
  ok(!/easing: "(ease|ease-out|ease-in|ease-in-out)"/.test(src), `${file} uses a keyword easing (use CURVE from ui/ease.js)`);
}

console.log(fails ? `ease: ${fails} failed` : `ease: all ${Object.keys(BEZIER).length} curves in step`);
process.exit(fails ? 1 : 0);
