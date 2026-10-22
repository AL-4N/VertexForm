# CLAUDE.md — working on VertexForm

Browser-based workout form coach. Read README.md for features and layout.

Full briefing (repo, live site, deploy, user, architecture, open items):
@PROJECT_PROMPT.md

How it looks, sounds and reads (colours, type, figures, motion, writing rules):
@DESIGN.md

## Ground rules
- Plain HTML/CSS/vanilla JS ES modules. No frameworks, no build step. `public/` deploys as static files.
- Animation libraries: only the self-hosted ones in `public/vendor/` (see `vendor/README.md` for versions and licenses): **GSAP** 3.15 with ScrollTrigger and SplitText, **Lenis** (smooth scroll) and **Three.js** 0.180 (minified builds; later versions ship none). Never load anything from a CDN. Site code must still work if a vendor file fails to load (guard `window.gsap`, `window.Lenis`; Three.js is a dynamic import with a 2D fallback). Reduced motion turns all of it off.
- Everything stays on-device: no uploads, accounts or analytics. MediaPipe loads from jsDelivr/Google storage, then is cached by `sw.js`. No server code: an AI coach summary was built and then removed at the user's request (it would spend their API credits). Accounts/leaderboards: don't build until the user asks.
- Pure logic, no DOM, unit-tested: `session.js`, `filters.js`, `tracking.js`, `coach.js`, `speech.js`, `circuit.js`, `history.js`, `rest.js`, `recording.js`, `scoring.js`, `geometry.js`, `exercises/*`. UI goes in `js/ui/`.
- Scoring calibration: good reps ≈ 95–100, half squat ≈ 70–76, quarter ≈ 50–58, obvious faults clearly lower. Change a curve → update `tests/scoring.test.mjs` and say why.
- Back must always stop the camera at once, in any state (`stopLive()` in `ui/live.js`). The e2e suite checks every stream ever opened has ended.
- Brand: grade gradient coral→green on navy, Unbounded + Instrument Sans. Colour tokens in `css/theme.css`.
- Clickable controls first; keyboard shortcuts are extras.

## Commands
- `npm run dev` — serve `public/` at http://localhost:8080 (`?debug` for the readout + landmark recorder, `?cpu` to skip the GPU)
- `npm test` — all unit/engine suites (must pass before every commit)
- `npm run test:e2e` — Playwright browser suite (first time: `npx playwright install chromium`); pass a regex to run a subset: `node tests/e2e/run.mjs "camera"`
- `npm run sw` — **run after changing any file in `public/`**: refreshes the precache list + content-hash version in `public/sw.js` (`tests/pwa.test.mjs` fails otherwise; a missing file there breaks offline loading)
- `npm run voice` — render new/changed coach phrases with Kokoro (incremental; first run downloads ~90 MB model). **Any new spoken text must be added to `coaching.js` (and so to `js/phrases.js`) and rendered**, or `tests/voice.test.mjs` fails. Then `npm run sw`.
- `npm run eval:angles` — 2D vs 3D angle accuracy on the simulator and on `tests/fixtures/*`
- `npm run deploy` — `npm run sw` + `wrangler deploy`

## How things fit
- `ui/live.js` owns the camera, the frame loop (requestVideoFrameCallback), HUD and controls; it feeds `Session.update(landmarks, aspect, t, world)` and turns events into the coach (`coach.js`) and speech queue (`speech.js`, gated to "not mid-rep").
- A `Session` starts unarmed (countdown / auto-start): it tracks, calibrates and reports `ready`, but counts nothing until `arm()`.
- Settings: `config.js` DEFAULTS → `ui/settings.js` (`cfg`, `setCfg`); controls bind declaratively with `data-setting` / `data-toggle`.
- Storage: one localStorage key (`workout-analyzer:v1`, name kept for old data), versioned (`VERSION` + `migrate()` in `storage.js`). Add fields with a migration + `tests/storage.test.mjs` case.
- Screens switch with `showScreen(id)` (View Transitions blur-fade; focus moves to the new screen's heading).
- The service worker is registered only by the trainer (see the note in `js/site/main.js`).

## Motion libraries (homepage)
- `js/site/smooth.js`: Lenis on GSAP's ticker, feeding ScrollTrigger; paused while a `<dialog>` is open; `data-lenis-prevent` scrolls natively. In-page link glides go through `lenis.scrollTo` (`motion-nav.js`).
- `js/site/scroll-fx.js`: SplitText line reveals for headings, ScrollTrigger batch reveals for card groups, hero parallax on the way out.
- `js/site/story.js`: ScrollTrigger progress for the pinned 3D story.
- `js/figures/figure-gl.js`: the hero's lit 3D body (Three.js) under the same camera as `figures/scene3d.js`, which still draws the floor, protractors and notes on 2D canvases.
- `js/site/sparks.js`, `js/site/magnet.js`: click sparks and magnetic buttons, ideas from React Bits rebuilt in plain JS.
- Not used, on purpose: React Bits, Kokonut UI, Componentry, Bklit UI (React/Tailwind components: port the idea instead); Motion and Anime.js (duplicate GSAP); Spline, Rive, Theatre.js (need scene files made in their own editors; if the owner makes one, self-host its runtime in `vendor/`); Manus (an AI agent, not a library).

## Overlay + voice
- `Session.update` returns `confidence`, `overlay` ("none" | "ready" | "rep"), `facing` ({dir, confidence, locked}) and `progress`. Frames below 0.45 confidence are never graded or counted. live.js fades skeleton/guide alphas toward the state.
- Guide geometry is pure (`js/guide.js`, raw image pixels); `mirrorGuide()` for the mirrored view; drawing in `ui/overlay.js drawGuide`.
- Speech: coach lines are PARTS (`[92, "phrase"]`); `voice.js` plays one clip per part on the Web Audio clock with `speech.js planLine` pauses; any missing clip → the whole line via Web Speech.

## Tests
- Simulated people: `tests/helpers/synth.mjs` (`repStream` supports rotation, 3D world landmarks, mutations, rests, custom motion profiles, irregular frame times).
- Real recordings: `tests/fixtures/*.json` + `.expect.json` (RECORDING_GUIDE.md). Synthetic ones are regenerated by `node tools/make-synthetic-fixture.mjs`.
- `?debug` exposes `window.__vfDebug` (live state) and `window.__vf` (`cfg`, `showResults(r)`) for the browser tests.
