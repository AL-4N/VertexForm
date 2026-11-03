/**
 * make-og.mjs — renders the link preview image, public/og.png (1200 × 630):
 *   node tools/make-og.mjs
 *
 * The site's own fonts, mark and figure, drawn by a headless browser
 * (Playwright's Chromium, or the installed Google Chrome). Re-run it if the
 * headline or the brand changes; the PNG is committed.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BY_ID } from "../public/js/figures/poses.js";
import { EXERCISES } from "../public/js/config.js";
import { build } from "../public/js/figures/rig.js";
import { figureMarkup, bounds, arcPath } from "../public/js/figures/draw.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const FONTS = "https://og.local/fonts";               // served from public/fonts by the route below

// The squat at the bottom of a good rep, with its knee protractor.
const ex = BY_ID.squat, s = build(ex.bottom), b = bounds(s, 40);
const figure = `<svg viewBox="${b.x0} ${b.y0} ${b.w} ${b.h}" height="380" width="${Math.round(380 * b.w / b.h)}">
  ${figureMarkup(s, { color: "#2ee59d", floor: { x0: b.x0 + 10, x1: b.x1 - 10 }, headFill: "#0d1326" })}
  <path d="${arcPath(s.hip, s.kneeN, s.ankN, 34)}" fill="none" stroke="#eef1fb" stroke-width="2" opacity=".75"/>
</svg>`;

const html = `<!DOCTYPE html><html><head><style>
@font-face { font-family: Unbounded; font-weight: 500; src: url("${FONTS}/unbounded-latin-500-normal.woff2"); }
@font-face { font-family: Unbounded; font-weight: 700; src: url("${FONTS}/unbounded-latin-700-normal.woff2"); }
@font-face { font-family: Instrument; font-weight: 500; src: url("${FONTS}/instrument-sans-latin-500-normal.woff2"); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #090d1c; color: #eef1fb; font-family: Instrument, sans-serif; overflow: hidden; position: relative; }
.grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(238,241,251,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(238,241,251,.05) 1px, transparent 1px); background-size: 24px 24px; }
.wash { position: absolute; right: -120px; top: -80px; width: 760px; height: 760px; background: radial-gradient(closest-side, rgba(46,229,157,.16), transparent); }
.copy { position: absolute; left: 80px; top: 78px; width: 640px; }
.logo { display: flex; align-items: center; gap: 14px; font-family: Unbounded; font-weight: 700; font-size: 34px; letter-spacing: -.02em; }
.logo em { font-style: normal; background: linear-gradient(100deg, #ffbe3d, #c6ef4e 45%, #2ee59d); -webkit-background-clip: text; color: transparent; }
h1 { margin-top: 74px; font-family: Unbounded; font-weight: 500; font-size: 62px; line-height: 1.08; letter-spacing: -.035em; }
p { margin-top: 26px; font-size: 25px; color: #a6aecb; }
.fig { position: absolute; right: 96px; bottom: 92px; }
.scale { position: absolute; left: 80px; right: 80px; bottom: 46px; display: flex; align-items: center; gap: 16px; font: 600 16px ui-monospace, Menlo, monospace; color: #808aac; }
.scale i { flex: 1; height: 4px; border-radius: 4px; background: linear-gradient(90deg, #ff4d6d 0%, #ff7a45 55%, #ffbe3d 70%, #c6ef4e 85%, #2ee59d 100%); }
</style></head><body>
<div class="grid"></div><div class="wash"></div>
<div class="copy">
  <div class="logo"><svg width="40" height="40" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ff4d6d"/><stop offset=".45" stop-color="#ffbe3d"/><stop offset=".75" stop-color="#c6ef4e"/><stop offset="1" stop-color="#2ee59d"/></linearGradient></defs><path d="M5 26 H28 M5 26 L19 5" fill="none" stroke="url(#g)" stroke-width="3.2" stroke-linecap="round"/><path d="M14.5 26 A9.5 9.5 0 0 0 10.3 18.1" fill="none" stroke="url(#g)" stroke-width="2.2" stroke-linecap="round"/><circle cx="5" cy="26" r="3.6" fill="#eef1fb"/></svg><span>Vertex<em>Form</em></span></div>
  <h1>Your webcam grades every rep from 0 to 100.</h1>
  <p>Form feedback for ${EXERCISES.length} exercises, out loud. Free, and the video never leaves your device.</p>
</div>
<div class="fig">${figure}</div>
<div class="scale"><span>F</span><i></i><span>A</span></div>
</body></html>`;

let browser;
try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: "chrome" }); }
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.route("https://og.local/**", (r) => {
  const u = new URL(r.request().url());
  if (u.pathname === "/") return r.fulfill({ contentType: "text/html", body: html });
  return r.fulfill({ contentType: "font/woff2", body: fs.readFileSync(path.join(ROOT, "public", u.pathname)) });
});
await page.goto("https://og.local/", { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(ROOT, "public", "og.png") });
await browser.close();
console.log("og.png written");
