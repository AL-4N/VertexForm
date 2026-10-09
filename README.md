# VertexForm

**Your coach can't watch every rep. VertexForm can.**

VertexForm is a workout form coach that runs entirely in the browser. Point a
webcam at yourself and it tracks 33 points on your body, measures the joint
angles that matter for each exercise, grades every rep, and tells you out loud
what to fix. There's no account and no video upload: the pose model runs on
your device, and it works offline after the first visit. The only server
call is the optional AI coach summary (see "AI coach summary" below).

## Features

**The trainer** (`app.html`)

- **5 exercises:** squat, push-up, plank (a timed hold), lunge, jumping jack.
- **Practice mode:** live coaching, rep by rep, until you hit your target grade
  (C 70 → A+ 95), for 1 rep, 3 reps or endless.
- **Analyze a set:** 5, 10 or 15 reps (plank: 30, 60 or 90 s), then a full
  breakdown: every rep's score, time down / at the bottom / up, your average,
  a part-by-part score (depth, posture, control…), and the coach's summary
  (strengths, the one thing to fix, a concrete target for next time).
- **Workouts:** build a circuit (exercises + reps or seconds, rest between),
  save up to 3 routines, and run them back to back hands-free.
- **Rest timer** between sets (30 / 60 / 90 s) with a spoken countdown.
- **A smarter voice coach:**
  - It cues the fault that would add the most points, not just the "worst" one.
  - It notices trends: depth fading as you tire, reps speeding up, a groove of
    clean reps.
  - It praises fixes ("Better, that one hit parallel").
  - When a fault keeps coming back, it rephrases, then switches to a concrete
    physical cue.
  - It only speaks at the top of a rep or while you rest, never mid-rep.
  - It gives a briefing from your last session and a summary after each set.
  - There's an optional tempo coach ("down… 2… up").
  - Three personalities (Chill, Hype, Coach) and three levels of chattiness.
  - **A natural neural voice:** every line is pre-recorded with Kokoro-82M
    (free, Apache-2.0, rendered on a computer by `npm run voice`). Each
    personality has its own voice: calm Heart, energetic Bella, firm Michael.
    Lines are stitched from clips with exact pauses, and beeps duck under the
    voice. You can also pick "System voice (basic)".
- **Accurate tracking:**
  - Smoothing that steadies the angles without lag.
  - Each frame is checked against your own bone lengths, so glitches are thrown out.
  - A 2-second calibration that learns your real standing position.
  - It doesn't flip between your left and right side.
  - Joints hidden for a moment are bridged briefly.
  - 3D world landmarks are blended in when you turn away from side-on.
  - Three model sizes, with automatic fallback to the fast one.
- **Robust rep counting:**
  - Bounces at the bottom don't double count, and slow grinders still count.
  - Twitches and walking out of the picture are ignored.
  - Standing still mid-set pauses the set clock.
  - Optional auto-start once you're in position.
- **Camera that just works:**
  - It picks your real camera (built-in first) and skips virtual ones.
  - It notices a camera that's dead, frozen on a placeholder picture, or
    unplugged, and moves on.
  - You can switch cameras mid-session, or flip front/back on phones.
- **Lines only when it's really you, really exercising:**
  - Every frame gets a confidence score: visible joints, bone lengths,
    side-on (or facing, for jumping jacks), the right posture for the
    exercise, and not walking around.
  - Nothing is drawn when confidence is low, just a hint. A faint skeleton
    shows when you're ready. The full score-coloured skeleton and the
    ideal-form guide appear mid-rep, fading in and out with hysteresis.
  - Low-confidence frames are never graded or counted.
- **An ideal-form guide you can trust:**
  - It knows which way you face from a vote (toes, nose, knee bend, head
    end), locked during a rep. When unsure, it draws no guide.
  - It's built from your own limb lengths, anchored at your planted foot,
    and flips with the mirror setting.
  - Squat and lunge: the target pose, a "parallel" line at knee height and a
    green torso-lean zone. Push-up and plank: a target line with a tolerance
    band. Jumping jack: hand-height markers.
  - It never covers your face.
- **Live screen:** framing guide ("move left", "step back"), lighting check,
  pause, mute, mirror, gym mode (a rep counter readable across the room),
  fullscreen, and keyboard shortcuts (Space, M, F, G, Esc).
- **Progress:** score history charts, best and average per exercise, your most
  common faults and whether they're getting rarer, CSV export, a day streak,
  achievements and a shareable score card.
- **Installable app (PWA)**, phone-friendly (portrait layout, keeps the screen
  awake during a set), and accessible: keyboard navigation, focus rings,
  screen-reader announcements, reduced motion, and colour is never the only
  signal.

**The website** (`index.html`): live stick-figure demo, the Form Lab (drag
sliders and watch the real scoring engine grade a figure). Moving between the website and the trainer uses a
motion-blur page transition.

---


## AI coach summary (optional)

The History screen can write a short review of your week with Claude
(Anthropic). It's the only feature that talks to a server, and only when you
press the button (it asks the first time). What's sent is decided in
`public/js/weekly.js`: per exercise, sets, reps, average and best score, last
week's average and the top fault names, plus skill names and your challenge
day. Never video, landmarks or anything that identifies you.

It runs through a small Cloudflare Worker (`worker/index.js`, configured in
`wrangler.jsonc`) so the API key stays on the server. The Worker re-checks
everything it receives (`worker/coach.js`), only accepts requests from this
site's own pages, and calls `claude-opus-5-5` at low effort with refusal
fallback on.

**One-time setup**, in the Cloudflare dashboard: Workers & Pages → vertexform
→ Settings → Variables and Secrets → Add → type *Secret*, name
`ANTHROPIC_API_KEY`, value: your key from console.anthropic.com. Until it's
set, the button says the coach isn't set up yet. Each summary costs a fraction
of a cent; set a monthly spend limit in the Anthropic console to be safe.

Optional rate limit: add a Workers rate-limit binding named `COACH_LIMIT`
(e.g. 5 requests per 60 s per visitor) and the Worker will use it.

## Run it locally

From this folder:

```bash
npm run dev          # serves public/ at http://localhost:8080
```

Or in VS Code: install the **Live Server** extension (suggested by
`.vscode/extensions.json`) and click **Go Live**. Don't double-click
`index.html`: browsers block the code when a page is opened as a file.

## Put it on Cloudflare

Everything that goes online is in **`public/`**. There's no build step.

1. Run **`npm run sw`** after changing anything in `public/`. It refreshes the
   offline cache list in `public/sw.js` (`npm test` fails if you forget).
2. Then deploy one of these ways:
   - **Command line:** `npm run deploy` (runs `npm run sw` for you, then
     `wrangler deploy` with `wrangler.jsonc`).
   - **Drag and drop:** dash.cloudflare.com → Workers & Pages → Create →
     upload the **`public`** folder.
   - **From GitHub (auto-deploys):** connect the repo in Workers & Pages.
     Build command: empty. Output directory: **`public`**.

Cloudflare serves the site over HTTPS, which the camera requires.
`public/_headers` sets the camera permission and caching rules.

---

## How the analyzer works

```
webcam ─▶ MediaPipe Pose (in-browser) ─▶ 33 landmarks + 3D world landmarks per frame
       ─▶ session.js:
            side (with hysteresis) → bridge short occlusions → One Euro smoothing
            → bone-length glitch check → aspect-correct → setup checks
            → measure (2D, blended with 3D as you turn) → calibrate → grade
       ─▶ rep engine: velocity-aware phases, time-in-the-hole check, min/max rep
          duration, rest detection; scores the frames near the bottom of the rep
       ─▶ coach.js (what to say) → speech.js (when to say it) → live.js (HUD, voice)
```

- **True angles.** MediaPipe reports x as a fraction of the frame width and y
  as a fraction of the height, which stretches angles on a 16:9 webcam. Every
  measurement is aspect-corrected first.
- **Steady without lag.** A One Euro filter smooths hard when you're still and
  lightly when you move. On the simulator it cuts angle jitter about 6× with
  roughly 10 ms of lag. The rep-phase signal uses a lighter filter, so the top
  and bottom of a rep are caught promptly.
- **2D or 3D?** Side-on, 2D angles are exact and steadier. As you turn toward
  the camera they read too straight (8° at 30° turned, for push-up elbows), so
  the 3D world landmarks are blended in, up to 50/50. Run `npm run eval:angles`
  to see the numbers, including on your own recordings.
- **Fair scoring.** Each rep is scored on the frames near its deepest point,
  not the way down and up, and one glitchy frame can't create or ruin a rep.
- **Size- and frame-rate independent.** Measurements are relative to your own
  body, and a rep must spend real time in the bottom position.

## Project structure

```
vertexform/
├── public/                     ← the website (this is what you deploy)
│   ├── index.html  app.html  404.html  manifest.webmanifest  sw.js  _headers
│   ├── css/                    fonts, site, theme, app, transitions
│   ├── audio/              the pre-recorded coach voice (npm run voice): <voice>/<hash>.mp3 + manifest.json
│   ├── icons/  fonts/  favicon.svg
│   └── js/
│       ├── session.js          ★ the analysis engine (pure logic, fully tested)
│       ├── filters.js          One Euro landmark smoothing
│       ├── tracking.js         calibration, glitches, side choice, occlusion, framing, 2D/3D
│       ├── coach.js            ★ the smarter coach: what to say (pure)
│       ├── speech.js           the speech queue: when to say it (pure)
│       ├── coaching.js         ★ every spoken phrase (personalities, faults, system lines)
│       ├── phrases.js  voices.js   the phrase inventory; which voice each personality uses
│       ├── guide.js            ideal-form guide geometry (pure)
│       ├── circuit.js  history.js  rest.js  recording.js   (pure, tested)
│       ├── pose.js             MediaPipe + camera (models, GPU/CPU, camera choice)
│       ├── scoring.js  geometry.js  grade.js  storage.js (+ migration)  voice.js
│       ├── exercises/          one module per exercise: thresholds, measure, grade, faults, fixes
│       ├── ui/                 screens: menu, live, results, stats, settings, workouts, rest, onboarding…
│       ├── figures/  site/     stick-figure rig, website scripts
│       └── main.js             app entry point and screen router
├── tests/                      npm test  (unit + engine)   ·   npm run test:e2e  (browser)
│   ├── *.test.mjs              see "Tests" below
│   ├── fixtures/               recordings replayed by replay.test.mjs
│   ├── e2e/run.mjs             Playwright end-to-end suite
│   ├── videos/                 your own test videos (git-ignored)
│   └── helpers/synth.mjs       simulated people → MediaPipe-style landmarks
├── scripts/build-voice.mjs     renders the voice pack with Kokoro (npm run voice)
├── tools/                      update-sw.mjs (npm run sw), make-synthetic-fixture.mjs
├── RECORDING_GUIDE.md          which real clips to record for testing
├── CHANGELOG.md  CLAUDE.md  TODO.md
└── package.json  wrangler.jsonc
```

## Tests

`npm test` (Node.js 18+) runs 11 suites, about 235 checks:

| Suite | What it checks |
|---|---|
| `session` (48) | Simulated people do every exercise, with good form and common faults, at 10–30 fps with jitter and dropped frames. Also covers tracking glitches, side flips, occlusion, turning 30°, grinders, double bounces, resting, walking out, twitches and calibration. |
| `tracking` (39) | One Euro filter, bone glitches, calibration, personal thresholds, side hysteresis, gap-filling, framing / lighting hints, 2D vs 3D |
| `coach` (25) | Impact-first cues, escalation, reinforcement, trends, briefing, summary, targets |
| `camera` (32) | Camera choice and order, error messages, dead / dark / frozen frame checks |
| `circuit` (27) | Routines, the circuit runner, rest-timer cues, history and CSV export |
| `scoring` (18) | Calibration bands (good ≈ 95–100, half squat ≈ 70–76, quarter ≈ 50–58), grade letters |
| `speech` (15) | One line at a time, never mid-rep, priorities, no pile-ups |
| `replay` (13) | Recordings in `tests/fixtures/` against their `.expect.json` |
| `storage` (10) | Old saved data still loads (v1 → v2 migration) |
| `pwa` (8) | The offline cache list is complete and current |
| `rig` | The stick figure's limbs stay rigid |

`npm run test:e2e` runs 18 browser tests with Chromium's fake camera:

- every trainer screen and the website pages;
- camera switching;
- Back turning the camera off in every state;
- a blocked camera;
- keyboard-only use;
- no horizontal overflow at 390 and 1280 px;
- offline use;
- any videos you put in `tests/videos/`.

The first time, run `npx playwright install chromium`.

**Real-data testing:** see [RECORDING_GUIDE.md](RECORDING_GUIDE.md). Record
clips with `app.html?debug` → **● Record**, drop them in `tests/fixtures/`,
and `npm test` replays them through the engine.

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page or warning banner | You opened the file directly. Use `npm run dev`, **Go Live**, or your Cloudflare link. |
| Black / frozen picture | Pick your real camera from the **Camera** list and press **Test camera** on the setup screen. A USB webcam can take a few seconds to start. "Black picture" usually means a closed privacy cover. A camera you picked is never swapped for another. |
| Camera still won't start | Open `app.html?debug`, try again, and copy the green camera log under the message (it's in the browser console too). It shows each attempt, the error, and what the camera reported. |
| "Camera access is blocked" | Click the camera icon in the address bar → Allow → **Try again**. |
| "Your camera is busy" | Another tab or app has it: close other tabs of this site, FaceTime / Zoom / Teams, and browser sidebar apps (Opera GX's sidebar messengers can hold the camera). |
| Reps aren't counting | Stand side-on (face the camera for jumping jacks), whole body in the dashed box, start from the top and hold still a moment. |
| "Resting" appears | You stood still at the top for 4 s; just start the next rep. |
| Slow or choppy | Settings → Tracking model → **Fast**, or add `?cpu` to the address to skip the GPU. |
| Want to see what it's measuring | Add `?debug` for fps, camera, resolution, model, calibration and glitch counts, plus the recorder. |

## Adding an exercise

1. Create `public/js/exercises/<name>.js` (copy `squat.js`). Set the rep metric
   and thresholds, `repSeconds`, `measure()`, `grade()`, `detectFaults()`,
   `fixes` (for the coach), `posture()` (for the confidence gate) and `guide`
   (the guide type in `js/guide.js`). Then register it in `exercises/index.js`.
2. Add it to `EXERCISES`, `EXERCISE_META` and `DEMO_TIPS` in `config.js`, and
   give it fault, `CONCRETE`, `FIXED` and `FOCUS` lines in `coaching.js`.
3. Optional, for the website: keyframes in `figures/poses.js`, sliders in
   `figures/lab.js`, and a card in `index.html`.
4. Add a scenario to `tests/session.test.mjs`, then run `npm run voice` (records
   any new phrases), `npm run sw` and `npm test`.

## Limits

- A side-on camera sees one plane, so knees caving inward isn't scored.
- Bad lighting or a cut-off body hurts tracking. You'll get a prompt, not a
  fake score.
- The engine is tuned on a simulator. Real clips (RECORDING_GUIDE.md) are
  how it gets checked against real bodies and webcams.
- Scores compare you to general coaching ranges. It's a training aid, not
  medical advice.

## Credits

Pose tracking by [MediaPipe](https://developers.google.com/mediapipe)
(Apache 2.0), loaded from jsDelivr and Google's model storage at runtime, then
cached for offline use. Fonts: Unbounded and Instrument Sans (SIL Open Font
License, see `public/fonts/`).
