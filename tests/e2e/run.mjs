/**
 * run.mjs — end-to-end tests in a real browser (Playwright + Chromium):
 *     npm run test:e2e          (first time: npx playwright install chromium)
 *
 * The camera is Chromium's fake one: a synthetic test pattern by default
 * (two fake cameras, so switching can be tested), or your own clips from
 * tests/videos/ (converted to .y4m with ffmpeg-static) to count real reps.
 *
 * Every test fails on any console error. Camera checks use a wrapper around
 * getUserMedia that records every stream the page ever opened, so "Back
 * turned the camera off" means every one of those tracks has ended, not
 * just the one on screen.
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import ffmpeg from "ffmpeg-static";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const PUBLIC = path.join(ROOT, "public");
const CACHE = path.join(ROOT, "tests", "e2e", ".cache");
const VIDEOS = path.join(ROOT, "tests", "videos");
const ONLY = process.argv[2] ? new RegExp(process.argv[2], "i") : null;
fs.mkdirSync(CACHE, { recursive: true });

/* ── Static server for public/ ───────────────────────────── */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".json": "application/json", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let file = path.join(PUBLIC, decodeURIComponent(url.pathname));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404, { "content-type": "text/html" }).end(fs.readFileSync(path.join(PUBLIC, "404.html"))); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${server.address().port}`;

/* ── Fake camera material ─────────────────────────────────── */
function y4m(name, args) {
  const out = path.join(CACHE, name);
  if (!fs.existsSync(out)) execFileSync(ffmpeg, ["-loglevel", "error", "-y", ...args, out]);
  return out;
}
// No video given: Chromium's built-in fake camera (a moving test pattern), which can also pretend to be two cameras.
const PATTERN = null;
const videos = fs.existsSync(VIDEOS)
  ? fs.readdirSync(VIDEOS).filter((f) => /\.(mov|mp4|m4v|webm)$/i.test(f)).map((f) => {
      const base = f.replace(/\.[^.]+$/, "");
      const expPath = path.join(VIDEOS, `${base}.expect.json`);
      return { file: f, base, expect: fs.existsSync(expPath) ? JSON.parse(fs.readFileSync(expPath, "utf8")) : null };
    })
  : [];

/* ── Tiny test harness ────────────────────────────────────── */
let pass = 0, fail = 0;
const results = [];
const browsers = new Map();
async function browserFor(video = PATTERN, devices = 2) {
  const key = `${video}|${devices}`;
  if (!browsers.has(key)) {
    browsers.set(key, await chromium.launch({ args: [
      `--use-fake-device-for-media-stream=device-count=${devices}`, "--use-fake-ui-for-media-stream",
      ...(video ? [`--use-file-for-fake-video-capture=${video}`] : []), "--autoplay-policy=no-user-gesture-required",
    ] }));
  }
  return browsers.get(key);
}

/** A fresh, isolated page. opts: { camera: true|false, storage: object|null, onboarded, viewport, video } */
async function newPage({ camera = true, storage = undefined, onboarded = true, viewport = { width: 1280, height: 800 }, video, browser } = {}) {
  const b = browser ?? (camera ? await browserFor(video) : await chromium.launch());
  if (!camera && !browser) browsers.set(`nocam${Math.random()}`, b);
  const ctx = await b.newContext({ viewport, permissions: camera ? ["camera"] : [], acceptDownloads: true, serviceWorkers: "block" });
  const seed = storage === undefined ? { settings: { onboarded, voice: false } } : storage;
  await ctx.addInitScript(({ seed }) => {
    try { if (seed && !sessionStorage.getItem("seeded")) { localStorage.setItem("workout-analyzer:v1", JSON.stringify(seed)); sessionStorage.setItem("seeded", "1"); } } catch {}
    // Record every camera stream ever opened (to prove Back turns them ALL off).
    window.__streams = [];
    const gum = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (gum) navigator.mediaDevices.getUserMedia = async (c) => { const s = await gum(c); window.__streams.push(s); return s; };
  }, { seed });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("console", (m) => { if (m.type() === "error") page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push(`pageerror: ${e.message}`));
  return page;
}

async function test(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  const t0 = Date.now();
  const pages = [];
  const make = async (o) => { const p = await newPage(o); pages.push(p); return p; };
  try {
    await fn(make);
    const errs = pages.flatMap((p) => p.errors);
    if (errs.length) throw new Error(`console errors:\n      ${errs.join("\n      ")}`);
    pass++; console.log(`PASS  ${name.padEnd(64)} ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (err) {
    fail++; console.log(`FAIL  ${name.padEnd(64)} ${err.message.split("\n").join("\n      ")}`);
  } finally {
    for (const p of pages) await p.context().close().catch(() => {});
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ── Helpers ──────────────────────────────────────────────── */
const liveTracks = (page) => page.evaluate(() => window.__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === "live").length);
const openedStreams = (page) => page.evaluate(() => window.__streams.length);
const activeScreen = (page) => page.$eval(".screen.active", (e) => e.id);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const waitLive = (page, timeout = 90_000) => page.waitForFunction(() => window.__vfDebug && window.__vfDebug.fps > 0, null, { timeout });
async function openExercise(page, name = "Squat") {
  await page.click(`.ex-card:has(.name:text-is("${name}"))`);
  await page.waitForSelector("#screen-mode.active");
}
async function assertCameraOff(page, when) {
  await page.waitForTimeout(250);
  const n = await liveTracks(page);
  assert(n === 0, `${when}: ${n} camera track(s) still live`);
}
async function screensAt(page, width, ids) {
  await page.setViewportSize({ width, height: 844 });
  const bad = [];
  for (const id of ids) {
    await page.evaluate((id) => document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === `screen-${id}`)), id);
    const o = await overflow(page);
    if (o > 0) bad.push(`${id} +${o}px`);
  }
  return bad;
}
const SAMPLE_RESULTS = {
  exercise: "Squat", target: 90, isBest: false, mode: "set", reps: [84, 91, 88, 93, 79], best: 93, average: 87, repCount: 5, isHold: false,
  bars: [{ label: "Depth", value: 92 }, { label: "Posture", value: 80 }, { label: "Control", value: 95 }], faults: ["lean", "lean", "depth"],
  details: [84, 91, 88, 93, 79].map((s, i) => ({ score: s, duration: 2.1, phases: { down: 1, bottom: 0.4, up: 0.7 }, faults: i % 2 ? [] : ["lean"] })),
  summary: { strengths: ["Depth: 92/100"], fix: { key: "lean", label: "Chest up", focus: "keeping your chest up", cue: "Pick a spot on the wall" }, target: "Next time: hit 90+ on 3 of 5 reps" },
};
const V1_DATA = {
  bests: { Squat: 96, "Push-up": 88 }, history: { Squat: [72, 85, 96], "Push-up": [88] },
  stats: { totalReps: 42, goodReps: 17, tried: ["Squat", "Push-up"] }, unlocked: ["first_rep", "first_a"],
  days: ["2026-09-30", "2026-10-01"], settings: { target: 80, personality: "Hype", voice: false, onboarded: true },
};

/* ═══════════════════════ Website ═══════════════════════ */

await test("Site: hero demo animates, nav glides, no overflow", async (make) => {
  const page = await make({ camera: false });
  await page.goto(`${BASE}/index.html`);
  const a = await page.$eval("[data-stage] .stage-svg", (s) => s.innerHTML.length && s.querySelector("polyline")?.getAttribute("points"));
  await page.waitForTimeout(600);
  const b = await page.$eval("[data-stage] .stage-svg", (s) => s.querySelector("polyline")?.getAttribute("points"));
  assert(a && b && a !== b, "hero figure isn't moving");
  await page.click('.nav nav a[href="#lab"]');
  await page.waitForTimeout(1100);
  assert((await page.evaluate(() => location.hash)) === "#lab", "nav link didn't go to #lab");
  const top = await page.$eval("#lab", (e) => Math.round(e.getBoundingClientRect().top));
  assert(Math.abs(top - 80) < 30, `Form Lab not at the top after the glide (${top}px)`);
  assert(await page.evaluate(() => [...document.querySelectorAll("main > *")].every((s) => !s.style.filter)), "blur left behind after the glide");
  for (const w of [390, 1280]) { await page.setViewportSize({ width: w, height: 800 }); assert(await overflow(page) <= 0, `horizontal overflow at ${w}px`); }
});

await test("Site: Form Lab sliders re-grade the figure", async (make) => {
  const page = await make({ camera: false });
  await page.goto(`${BASE}/index.html#lab`);
  const lab = page.locator("[data-lab]");
  await lab.scrollIntoViewIfNeeded();
  const before = await lab.innerText();
  const slider = lab.locator('input[type="range"]').first();
  await slider.fill("10");
  await slider.dispatchEvent("input");
  await page.waitForTimeout(200);
  assert((await lab.innerText()) !== before, "moving a slider changed nothing");
  const presets = lab.locator("button");
  if (await presets.count()) { await presets.nth(1).click(); await page.waitForTimeout(150); }
});

await test("Site: 'Spot the better rep' game responds", async (make) => {
  const page = await make({ camera: false });
  await page.goto(`${BASE}/index.html#game`);
  const game = page.locator("[data-game]");
  await game.scrollIntoViewIfNeeded();
  const before = await game.innerText();
  await game.locator("button").first().click();
  await page.waitForTimeout(400);
  assert((await game.innerText()) !== before, "picking an answer changed nothing");
});

await test("Site: 404 page and links back", async (make) => {
  const page = await make({ camera: false });
  const res = await page.goto(`${BASE}/nope.html`);
  assert(res.status() === 404 && (await page.locator("a[href]").count()) > 0, "404 page missing or has no way back");
  page.errors = page.errors.filter((e) => !/status of 404/.test(e));      // the 404 itself is expected
});

/* ═══════════════════════ Trainer ═══════════════════════ */

await test("Onboarding: shown on first visit, skippable, not shown again", async (make) => {
  const page = await make({ storage: null });
  await page.goto(`${BASE}/app.html`);
  await page.waitForSelector("#onboarding[open]");
  await page.click("#onb-next");
  await page.click("#onb-back");
  await page.click("#onb-skip");
  assert(!(await page.$("#onboarding[open]")), "Skip didn't close it");
  await page.reload();
  await page.waitForTimeout(400);
  assert(!(await page.$("#onboarding[open]")), "shown again after being skipped");
  await page.click("#btn-settings");
  await page.click("#btn-onboarding");
  assert(await page.$("#onboarding[open]"), "Settings → Show again didn't open it");
  await page.keyboard.press("Escape");
});

await test("Menu + setup: exercise list, demo, setup pills persist", async (make) => {
  const page = await make();
  await page.goto(`${BASE}/app.html`);
  assert((await page.locator(".ex-card").count()) === 5, "expected 5 exercises");
  await openExercise(page, "Push-up");
  assert(await page.locator("#mode-demo svg").count(), "good-rep demo missing");
  await page.click('#opt-target [data-val="80"]');
  await page.click('#opt-start [data-val="auto"]');
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("workout-analyzer:v1")).settings);
  assert(saved.target === 80 && saved.startMode === "auto", `settings not saved: ${JSON.stringify(saved)}`);
});

await test("Live: camera starts, pause / mute / gym / mirror, Back turns it off", async (make) => {
  const page = await make();
  await page.goto(`${BASE}/app.html?debug`);
  await openExercise(page);
  await page.click("#mode-practice");
  await waitLive(page);
  const dbg = await page.evaluate(() => window.__vfDebug);
  assert(/fake_device_0/.test(dbg.camera) && /^\d+×\d+$/.test(dbg.res) && dbg.model, `debug readout: ${JSON.stringify(dbg)}`);
  assert(await page.isVisible("#live-tip"), "tip line missing");
  await page.click("#live-pause");
  assert(await page.isVisible("#paused"), "pause overlay missing");
  await page.click("#paused-resume");
  assert(!(await page.isVisible("#paused")), "resume didn't close the pause overlay");
  await page.click("#live-mute");
  assert((await page.getAttribute("#live-mute", "aria-pressed")) === "true", "mute not pressed");
  await page.click("#live-gym");
  assert(await page.$eval("#screen-live .stage", (e) => e.classList.contains("gym")), "gym mode not applied");
  const mirror = await page.evaluate(() => window.__vf.cfg.mirror);
  await page.click("#live-mirror");
  assert((await page.evaluate(() => window.__vf.cfg.mirror)) === !mirror, "mirror didn't toggle");
  await page.click("#live-back");
  await assertCameraOff(page, "after Back");
  assert((await activeScreen(page)) === "screen-mode", "Back didn't return to the setup screen");
});

await test("Live: switching cameras mid-session keeps detecting", async (make) => {
  const page = await make();
  await page.goto(`${BASE}/app.html?debug`);
  await openExercise(page);
  await page.click("#mode-practice");
  await waitLive(page);
  const first = await page.evaluate(() => window.__vfDebug.camera);
  const other = await page.$eval("#live-camera", (s, cur) => [...s.options].find((o) => o.textContent !== cur)?.value, first);
  assert(other, "only one camera in the list");
  await page.selectOption("#live-camera", other);
  await page.waitForFunction((cur) => window.__vfDebug.camera && window.__vfDebug.camera !== cur, first, { timeout: 20_000 });
  const frames0 = await page.evaluate(() => window.__vfDebug.fps);
  await page.waitForTimeout(1500);
  assert((await page.evaluate(() => window.__vfDebug.fps)) > 0 && frames0 >= 0, "no frames after switching");
  const live = await liveTracks(page);
  assert(live === 1, `${live} live camera tracks after switching (the old one must stop)`);
  await page.keyboard.press("Escape");
  await assertCameraOff(page, "after Esc");
});

await test("Back turns the camera off: while loading, counting down, paused", async (make) => {
  const page = await make();
  await page.goto(`${BASE}/app.html?debug`);
  await page.evaluate(() => { window.__vf.cfg.countdown = 10; });
  // 1. Immediately (model / camera still loading).
  await openExercise(page);
  await page.click("#mode-practice");
  await page.click("#live-back");
  await page.waitForTimeout(3000);              // anything still opening must close itself
  await assertCameraOff(page, "Back while loading");
  // 2. During the 10 s countdown.
  await page.click("#mode-practice");
  await page.waitForSelector("#countdown:not([hidden])", { timeout: 90_000 });
  await page.click("#live-back");
  await assertCameraOff(page, "Back during the countdown");
  // 3. While paused.
  await page.evaluate(() => { window.__vf.cfg.countdown = 0; });
  await page.click("#mode-practice");
  await waitLive(page);
  await page.click("#live-pause");
  await page.click("#live-back");
  await assertCameraOff(page, "Back while paused");
  assert((await openedStreams(page)) >= 2, "sessions didn't open cameras");
});

await test("Camera blocked: clear message + Try again, nothing left on", async (make) => {
  const page = await make();
  // The browser says no (as when you click "Block" on the permission prompt).
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Permission denied", "NotAllowedError"); };
  });
  await page.goto(`${BASE}/app.html`);
  await openExercise(page);
  await page.click("#mode-practice");
  await page.waitForSelector("#pose-retry:not([hidden])", { timeout: 90_000 });
  const msg = await page.textContent("#pose-msg");
  assert(/blocked/i.test(msg), `unexpected message: ${msg}`);
  page.errors = page.errors.filter((e) => !/Permission|NotAllowed/i.test(e));   // the expected failure
  await page.click("#live-back");
  await assertCameraOff(page, "after a blocked camera");
});

await test("Results: summary, rep table, score card, rest timer → next set", async (make) => {
  const page = await make();
  await page.goto(`${BASE}/app.html?debug`);
  await page.evaluate((r) => window.__vf.showResults(r), SAMPLE_RESULTS);
  await page.waitForSelector("#screen-results.active");
  assert((await page.locator("#res-details tbody tr").count()) === 5, "rep table should have 5 rows");
  assert(/Next time: hit 90\+/.test(await page.textContent("#res-summary")), "coach target missing");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btn-share")]);
  assert(/\.png$/.test(dl.suggestedFilename()), `score card download: ${dl.suggestedFilename()}`);
  await page.click('#next-set [data-val="30"]');
  await page.click("#btn-rest");
  await page.waitForSelector("#screen-rest.active");
  await page.waitForTimeout(1200);
  assert(/^0:2\d$/.test(await page.textContent("#rest-time")), "rest timer not counting down from 30");
  await page.click("#rest-add");
  assert(/^0:[34]\d$/.test(await page.textContent("#rest-time")), "+15 s didn't add time");
  await page.evaluate(() => { window.__vf.cfg.countdown = 0; });
  await page.click("#rest-go");
  await waitLive(page);
  await page.click("#live-back");
  await assertCameraOff(page, "Back from the next set");
});

await test("History: old saved data loads, charts, CSV export", async (make) => {
  const page = await make({ storage: { ...V1_DATA } });
  await page.goto(`${BASE}/app.html`);
  assert((await page.textContent(".ex-card:first-child .best")).trim() === "96", "old best score not shown");
  assert(/\d/.test(await page.textContent("#global-avg")), "global average missing");
  await page.click("#btn-stats");
  await page.waitForSelector("#screen-stats.active");
  assert((await page.locator(".hist-chart svg").count()) >= 1, "no history chart for the migrated squat data");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btn-export")]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  assert(csv.startsWith("date,exercise,mode,best") && csv.trim().split("\n").length === 5, `CSV:\n${csv}`);
});

await test("Settings: voice, chattiness, tempo, model quality persist", async (make) => {
  const page = await make();
  await page.goto(`${BASE}/app.html`);
  await page.click("#btn-settings");
  await page.click('[data-setting="chattiness"] [data-val="detailed"]');
  await page.click('[data-setting="tempo"] [data-val="beep"]');
  await page.click('[data-setting="quality"] [data-val="lite"]');
  await page.locator("#set-rate").fill("1.2");
  await page.reload();
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("workout-analyzer:v1")).settings);
  assert(s.chattiness === "detailed" && s.tempo === "beep" && s.quality === "lite" && Math.abs(s.voiceRate - 1.2) < 1e-9, JSON.stringify(s));
});

await test("Workouts: build, save (max 3), run, Back → summary", async (make) => {
  const page = await make();
  await page.goto(`${BASE}/app.html?debug`);
  await page.evaluate(() => { window.__vf.cfg.countdown = 0; });
  await page.click("#btn-workouts");
  for (const n of ["A", "B", "C", "D"]) { await page.fill("#routine-name", n); await page.click("#routine-save"); }
  assert((await page.locator("#routine-list .routine").count()) === 3, "should keep 3 routines");
  assert(/Delete one first/.test(await page.textContent("#builder-error")), "4th routine should explain the limit");
  await page.click('#routine-list [data-act="start"] >> nth=0');
  await waitLive(page);
  assert(/A · 1 of 3/.test(await page.textContent("#live-title")), "circuit title missing");
  await page.click("#live-back");
  await assertCameraOff(page, "Back during a workout");
  await page.waitForSelector("#screen-circuit-done.active");
  assert(/0 of 3 done/.test(await page.textContent("#circuit-title")), "workout summary missing");
});

await test("Keyboard only: open an exercise, start, Esc back, settings pills", async (make) => {
  const page = await make();
  await page.goto(`${BASE}/app.html?debug`);
  await page.evaluate(() => { window.__vf.cfg.countdown = 0; });
  let found = false;
  for (let i = 0; i < 12 && !found; i++) {
    await page.keyboard.press("Tab");
    found = await page.evaluate(() => document.activeElement?.classList.contains("ex-card"));
  }
  assert(found, "Tab never reached an exercise card");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert(outline !== "none", "focused card has no visible focus ring");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#screen-mode.active");
  let onPractice = false;
  for (let i = 0; i < 6 && !onPractice; i++) { await page.keyboard.press("Tab"); onPractice = await page.evaluate(() => document.activeElement?.id === "mode-practice"); }
  assert(onPractice, "Tab didn't reach Practice");
  await page.keyboard.press("Enter");
  await waitLive(page);
  await page.keyboard.press("Space");
  assert(await page.isVisible("#paused"), "Space didn't pause");
  await page.keyboard.press("Escape");
  await assertCameraOff(page, "Esc from the keyboard");
  await page.click('#screen-mode [data-back="menu"]');
  await page.click("#btn-settings");
  await page.waitForSelector("#screen-settings.active");
  await page.waitForTimeout(400);                 // screen transition done (it moves focus to the heading)
  assert(await page.evaluate(() => document.activeElement?.tagName === "H1"), "focus didn't move to the new screen's heading");
  await page.focus('[data-setting="chattiness"] [data-val="quiet"]');
  await page.keyboard.press("Enter");
  assert((await page.evaluate(() => JSON.parse(localStorage.getItem("workout-analyzer:v1")).settings.chattiness)) === "quiet", "Enter on a pill didn't select it");
});

await test("Layout: no horizontal overflow on any screen at 390 and 1280 px", async (make) => {
  const page = await make();
  await page.goto(`${BASE}/app.html?debug`);
  await page.evaluate((r) => window.__vf.showResults(r), SAMPLE_RESULTS);
  const ids = ["menu", "mode", "results", "stats", "settings", "workouts", "rest", "circuit-done", "live"];
  const bad = [...await screensAt(page, 390, ids), ...await screensAt(page, 1280, ids)];
  assert(!bad.length, `overflow: ${bad.join(", ")}`);
});

await test("Fake camera from a video file (ffmpeg → .y4m) feeds the app", async (make) => {
  const clip = y4m("pattern.y4m", ["-f", "lavfi", "-i", "testsrc=size=640x360:rate=30", "-t", "3", "-pix_fmt", "yuv420p"]);
  const page = await make({ video: clip });
  await page.goto(`${BASE}/app.html?debug`);
  await openExercise(page);
  await page.click("#mode-practice");
  await waitLive(page);
  assert((await page.evaluate(() => window.__vfDebug.res)) === "640×360", "the video file isn't the camera");
  await page.click("#live-back");
  await assertCameraOff(page, "after the file-camera test");
});

await test("Offline: after one visit the trainer and pose model work offline", async (make) => {
  const browser = await browserFor(PATTERN);
  const ctx = await browser.newContext({ permissions: ["camera"], serviceWorkers: "allow" });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem("s")) { localStorage.setItem("workout-analyzer:v1", JSON.stringify({ settings: { onboarded: true, voice: false, countdown: 3 } })); sessionStorage.setItem("s", 1); } } catch {} });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  try {
    await page.goto(`${BASE}/app.html`);
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30_000 });
    await openExercise(page);
    await page.click("#mode-practice");
    await waitLive(page);                            // library, wasm and model fetched (and cached)
    await page.click("#live-back");
    await ctx.setOffline(true);
    await page.goto(`${BASE}/app.html`);
    await openExercise(page);
    await page.click("#mode-practice");
    await waitLive(page, 60_000);
    await page.click("#live-back");
    await page.goto(`${BASE}/index.html`);
    assert(await page.isVisible("h1"), "the site didn't load offline");
    assert(!page.errors.length, page.errors.join("; "));
  } finally { await ctx.close(); }
});

/* ═══════════════════════ Your videos ═══════════════════════ */

for (const v of videos) {
  await test(`Video ${v.file}: ${v.expect ? JSON.stringify(v.expect) : "(no .expect.json: just runs)"}`, async (make) => {
    const clip = y4m(`${v.base}.y4m`, ["-i", path.join(VIDEOS, v.file), "-t", "30", "-vf", "scale=640:-2,fps=30", "-pix_fmt", "yuv420p"]);
    const page = await make({ video: clip });
    await page.goto(`${BASE}/app.html?debug`);
    const exercise = (v.expect?.exercise) ?? (v.base.startsWith("pushup") ? "Push-up" : v.base.startsWith("plank") ? "Plank" : v.base.startsWith("lunge") ? "Lunge" : v.base.startsWith("jack") ? "Jumping Jack" : "Squat");
    const want = v.expect?.reps ?? 3;
    await page.evaluate((n) => { Object.assign(window.__vf.cfg, { countdown: 0, setReps: n }); }, Math.max(1, want));
    await openExercise(page, exercise);
    await page.click("#mode-set");
    await page.waitForSelector("#screen-results.active", { timeout: 120_000 }).catch(() => {});
    const onResults = (await activeScreen(page)) === "screen-results";
    const reps = await page.evaluate(() => window.__vfDebug?.reps ?? 0);
    if (v.expect?.noReps) assert(!onResults && reps === 0, `expected no reps, got ${reps}`);
    else assert(onResults, `results screen never appeared (${reps} reps counted in 2 min)`);
    if (onResults && v.expect?.minScore) {
      const scores = await page.$$eval("#res-details tbody tr td:nth-child(2) strong", (els) => els.map((e) => Number(e.textContent)));
      assert(Math.min(...scores) >= v.expect.minScore, `scores ${scores.join(",")} below ${v.expect.minScore}`);
    }
    await page.click("#live-back").catch(() => {});
    await assertCameraOff(page, "after the video test");
  });
}
if (!videos.length) console.log("(No videos in tests/videos: the camera was a synthetic test pattern. See RECORDING_GUIDE.md.)");

/* ── Done ─────────────────────────────────────────────────── */
for (const b of browsers.values()) await b.close().catch(() => {});
server.close();
console.log(`\n${fail ? `${fail} browser test(s) FAILED` : "All browser tests pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
