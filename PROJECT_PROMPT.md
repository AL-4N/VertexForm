# VertexForm: project briefing for Claude Code

Paste this into a new Claude Code session, or let it load automatically:
`CLAUDE.md` imports it. It describes the project, where everything lives, how
to work on it, and what's still open.

---

## What it is

**VertexForm** is a browser-based workout form coach. You point a webcam at
yourself and it tracks 33 body landmarks with MediaPipe Pose, entirely
on-device. It grades every rep 0–100 and talks to you with a natural
pre-recorded voice. There's no server, no account, no uploads and no
analytics. It's static HTML/CSS/vanilla JS ES modules with no build step to
run it.

- **Exercises:** squat, push-up, plank (a timed hold), lunge, jumping jack.
- **Modes:** Practice (rep by rep until you hit a target grade), Analyze a set
  (N reps or seconds, then a breakdown), and Workouts (circuits of up to 10
  steps with rest; 3 saved routines).
- **Website** (`index.html`): a hero demo, the Form Lab (sliders that drive the
  real scoring engine), and a "Spot the better rep" game.

## Links and places

| What | Where |
|---|---|
| GitHub repo | https://github.com/AL-4N/VertexForm (branch `main`) |
| Live site (Cloudflare) | https://vertexform.alan-ht-wang.workers.dev |
| The trainer | https://vertexform.alan-ht-wang.workers.dev/app.html (add `?debug` for diagnostics) |
| Local folder | `~/Downloads/vertexform` |
| Local dev server | `npm run dev` → http://localhost:8080 (python3 http.server on `public/`) |

**Deploying:** Cloudflare Workers (static assets) is connected to the GitHub
repo. Every push to `main` auto-deploys in about 1–2 minutes. `wrangler.jsonc`
serves `./public` with `html_handling: auto-trailing-slash`, which redirects
`app.html` to `/app` (`sw.js` handles that). To check a deploy has landed,
compare `const VERSION` in the live `/sw.js` with the local `public/sw.js`.

**Git:** pushes work over HTTPS with cached credentials, using
`GIT_TERMINAL_PROMPT=0 git push origin main`. `http.postBuffer` is raised for
large pushes. The GitHub CLI (`gh`) isn't installed. Commit as you go, with a
clear message and the Co-Authored-By trailer, and push when asked.

## The user

- Mac. Their browser is **Opera GX** (Chromium). Their external webcam is an
  **Anker PowerConf C200** (UVC, up to 2K).
- **Not an admin:** no Homebrew or sudo installs. Use npm packages instead
  (e.g. `ffmpeg-static`).
- Preferences:
  - **Every UI transition slides with a directional motion blur**, both
    existing and anything new. Use `public/js/ui/motion.js` → `slide()`.
    Respect `prefers-reduced-motion`.
  - Clickable buttons first; keyboard shortcuts only as extras.
  - Work autonomously in phases, run `npm test` after each, commit after each.
  - Brand: the grade gradient (coral F → green A) on navy; fonts Unbounded
    (display) and Instrument Sans (body); tokens in `css/theme.css`.

## Ground rules (don't break these)

1. Vanilla JS ES modules, no framework, no build step to run. `public/` must
   stay deployable as static files.
2. All processing stays on-device. MediaPipe loads from jsDelivr and Google's
   model storage, then `sw.js` caches it.
3. Pure logic (no DOM, unit-tested) stays pure: `session.js`, `filters.js`,
   `tracking.js`, `guide.js`, `coach.js`, `speech.js`, `circuit.js`,
   `history.js`, `rest.js`, `recording.js`, `phrases.js`, `scoring.js`,
   `geometry.js`, `exercises/*`. UI goes in `js/ui/`.
4. Scoring calibration: good reps ≈ 95–100, half squat ≈ 70–76, quarter ≈
   50–58, obvious faults clearly lower. If a curve changes, update
   `tests/scoring.test.mjs` and say why.
5. **Back must always stop the camera at once, in any state** (`stopLive()` in
   `ui/live.js`). The e2e suite checks that every stream ever opened has ended.
6. **After changing any file in `public/`, run `npm run sw`.** It regenerates
   the precache list and the content-hash version in `sw.js`; `npm test`
   fails otherwise, and a missing file breaks offline loading.
7. **All spoken text lives in `public/js/coaching.js`.** After adding or
   changing a phrase, run `npm run voice` (incremental), then `npm run sw`.
   `tests/voice.test.mjs` fails if any phrase has no recording.
8. `npm test` must pass before every commit.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Serve `public/` at :8080 |
| `npm test` | 13 unit and engine suites, ~330 checks |
| `npm run test:e2e` | Playwright browser suite (23 tests) with Chromium's fake camera. Subset: `node tests/e2e/run.mjs "regex"`. Against the live site: `E2E_BASE=https://vertexform.alan-ht-wang.workers.dev npm run test:e2e` |
| `npm run sw` | Refresh `public/sw.js` (precache list + version) |
| `npm run voice` | Render new or changed coach phrases with Kokoro into `public/audio/` (`--voice af_heart` for one voice). About 1 s per clip on CPU; voices can run in parallel processes |
| `npm run eval:angles` | 2D vs 3D angle accuracy on the simulator and on any `tests/fixtures/*` recordings |
| `npm run deploy` | `npm run sw` + `wrangler deploy` (normally not needed: pushing auto-deploys) |

Dev dependencies: `playwright` (Chromium is downloaded by
`npx playwright install chromium`), `ffmpeg-static` (its install script is
allowed in `package.json` `allowScripts`), and `kokoro-js` (its model, about
90 MB, sits in the Hugging Face cache).

## How it works (pipeline)

```
webcam → pose.js (MediaPipe PoseLandmarker; lite/full/heavy, "auto" falls back to lite below 15 fps; GPU→CPU fallback)
       → ui/live.js frame loop (requestVideoFrameCallback, capture timestamps)
       → Session.update(landmarks, aspect, t, worldLandmarks)   [session.js]
            side choice with 0.5 s hysteresis → bridge occluded joints ≤ 200 ms → One Euro smoothing (filters.js)
            → bone-length glitch rejection → setup checks (in frame, side-on / facing)
            → measure (2D aspect-corrected, blended with 3D world landmarks as you turn away)
            → CONFIDENCE (visibility, bones, facing, posture match, not walking) + gate (on 0.3 s / off 0.5 s)
              frames < 0.45 are never graded or counted; overlay = "none" | "ready" | "rep"
            → facing vote (toes, nose vs ears, knee bend, head end; smoothed ~1 s, locked mid-rep)
            → calibration (2 s still: bone lengths + your real top angle → personal thresholds)
            → rep engine (velocity phases, min/max rep duration, rest detection, walk-out reset)
              or hold engine (plank, 5 s segments)
       → coach.js (WHAT to say: impact-ranked cues, escalation, reinforcement, trends, briefing, summary)
       → speech.js queue (WHEN: never mid-rep, priorities, no overlap, stale lines dropped)
       → voice.js (Kokoro clips via Web Audio with exact pauses; Web Speech fallback)
       → overlay: skeleton + guide.js geometry drawn by ui/overlay.js (faded by state)
```

- **Camera** (`pose.js` + `ui/live.js`):
  - Opening: a constraint ladder (720p30 → 640×480 → device only; only
    `deviceId` is ever `exact`) and a 6 s warm-up for slow USB webcams.
  - Problems: black frames get a privacy-cover hint (the camera is not
    swapped). A camera you picked or saved is the **only** one tried; if it
    fails you get a message, the camera list and Try again.
  - Detection: virtual and Continuity cameras are skipped unless picked;
    dead or frozen cameras are spotted by a watchdog.
  - Tools: `?debug` shows a full camera diagnostics log, and the setup screen
    has a "Test camera" preview.
- **Storage:** one localStorage key, `workout-analyzer:v1` (the name is kept
  for old data), versioned (`VERSION` 2) with `migrate()` in `storage.js`.
- **Settings:** `config.js` DEFAULTS → `ui/settings.js` (`cfg`, `setCfg`).
  Controls bind declaratively with `data-setting` / `data-toggle`.
- **Voice pack:** `public/audio/<voice>/<hash>.mp3` plus a `manifest.json` per
  voice, and `voices.json`.
  - Voices: Heart (`af_heart`, Chill), Bella (`af_bella`, Hype), Michael
    (`am_michael`, Coach); configured in `js/voices.js`.
  - 3 × 535 clips, 12.8 MB at 32 kbps mono MP3. Not precached; cached the
    first time they play.
  - Coach lines are PARTS, e.g. `[92, "Better, that one hit parallel."]`.
    Pauses: 250 ms after a number, 400 ms between sentences.
- **PWA:** manifest, icons, and `sw.js`. App files are network-first;
  MediaPipe and audio are cache-first. Only the trainer registers the service
  worker: registering it from the home page would break Chrome's home →
  trainer page transition on first visits.
- **Transitions:**
  - Cross-page: View Transitions, with a fallback in `page-transition.js`.
  - In-app: screens and everything else slide with `motion.js`.
  - The site nav glides with a vertical SVG motion blur (`site/motion-nav.js`)
    and highlights the current section with the gradient (`site/nav-spy.js`).
- **Debug hooks** (with `?debug`): `window.__vfDebug` (live state: fps,
  camera, model, overlay, confidence, facing…), `window.__vf` (`cfg`,
  `showResults(r)`), and the landmark recorder (Record / Stop → JSON).

## Repo map (main files)

```
public/            index.html  app.html  404.html  sw.js  manifest.webmanifest  _headers
  css/             theme.css (tokens)  app.css  site.css  transitions.css  fonts.css
  audio/           pre-rendered voice pack (npm run voice)
  js/              session.js ★ engine · tracking.js · filters.js · guide.js · coach.js ★ · coaching.js ★ (all phrases)
                   speech.js · voice.js · voices.js · phrases.js · pose.js (camera + model) · storage.js
                   circuit.js · history.js · rest.js · recording.js · scoring.js · geometry.js · grade.js · config.js
     exercises/    squat, pushup, plank, lunge, jumpingjack (thresholds, measure, grade, faults, fixes, posture, guide)
     ui/           live.js ★ · overlay.js · motion.js · settings.js · results.js · stats.js · workouts.js
                   rest-screen.js · onboarding.js · camera-picker.js · camera-preview.js · menu.js · components.js
     site/         website scripts (stage, lab, game, how, motion-nav, nav-spy)
     figures/      stick-figure rig used by the site, the setup demo and the simulator
tests/             *.test.mjs (npm test) · e2e/run.mjs · helpers/synth.mjs (simulated people) · fixtures/ · videos/ (git-ignored)
scripts/build-voice.mjs   tools/update-sw.mjs   tools/make-synthetic-fixture.mjs
README.md · CLAUDE.md · CHANGELOG.md · TODO.md · RECORDING_GUIDE.md · PROJECT_PROMPT.md (this file)
```

## Tests

- **Unit and engine** (`npm test`): session 54, camera 53, overlay 43,
  tracking 39, circuit 27, coach 25, speech 24, scoring 18, replay 13,
  voice 12, storage 10, pwa 8, rig.
- **Simulator:** `tests/helpers/synth.mjs` turns the stick-figure rig into
  MediaPipe-style landmarks. `repStream` supports rotation, 3D world
  landmarks, mutations (glitches, occlusion), rests, custom motion profiles,
  irregular frame times; `turnAround()` makes the person face the other way.
- **Real data:** recordings made with `app.html?debug` → ● Record go in
  `tests/fixtures/` with an `.expect.json`. **None exist yet**: the user is
  meant to record the clips listed in `RECORDING_GUIDE.md`.

## History (main commits)

Initial site → nav motion blur → Phase 1 camera → 2 tracking accuracy →
3 rep robustness → 4 smarter coach → 5 QoL/PWA/transitions → 6 testing tools →
7 tests and docs → motion blur everywhere + Cloudflare offline fix →
Anker/USB webcam fix → confidence-gated overlay + facing-aware guide + Kokoro
voice → nav section highlight. See `CHANGELOG.md` and `git log`.

## Open items / not verified

- Everything was tested on the simulator and Chromium's fake camera, **not
  on a real body and webcam**. Rep counting and scoring on real people still
  need the user's recordings (`RECORDING_GUIDE.md`).
- The Anker USB webcam fix (6 s warm-up, explicit camera only) reproduces and
  fixes the likely cause in tests, but isn't confirmed on the device. If it
  still fails, ask for the green camera log from `app.html?debug`.
- The 2D/3D angle blend weights (`tracking.js worldWeight`) rest on assumed
  3D noise. Re-check with `npm run eval:angles` once real clips exist.
- Nobody has listened to the voice clips (all checks are automated). Re-render
  a phrase if it sounds wrong.
- The cross-page transition is skipped once in Chrome: trainer → home on the
  very first visit (service worker takeover).
- Not done: upgrading `@mediapipe/tasks-vision` from 0.10.14 to 1.x; a manual
  VoiceOver pass.
- `TODO.md` lists every planned item and the decisions not to do some things.
