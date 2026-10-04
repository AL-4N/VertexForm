# VertexForm

**Your coach can't watch every rep. VertexForm can.**

VertexForm is a workout form coach that runs entirely in the browser. Point a
webcam at yourself and it tracks 33 points on your body, measures the joint
angles that matter for each exercise, grades every rep, and tells you out loud
what to fix. There's no server, no account and no uploads: the pose model runs
on your device.

## Features

**The trainer** (`app.html`)

- **5 exercises:** squat, push-up, plank (a timed hold), lunge, jumping jack.
- **Practice mode:** live coaching, rep by rep, until you hit your target grade
  (C 70 → A+ 95), for 1 rep, 3 reps or endless.
- **Analyze a set:** 5, 10 or 15 reps (plank: 30, 60 or 90 s), then a full
  breakdown with the score for every rep, your average, a part-by-part score
  (depth, posture, control…) and your most common fault.
- **Voice coach:** says your score and the one fix that matters most after
  every rep, in a Chill, Hype or Coach personality. Cues rotate so it never
  nags with the same line.
- **Judges like a coach:** dips that never get deep enough are called out as
  "no rep" instead of counted. It also flags folding forward, sagging or piked
  hips, knees drifting, rushed reps, bouncing out of the bottom, and drifting
  in a plank.
- **Setup help:** tells you (out loud, too) to step into the frame, step back,
  or turn side-on, and won't grade you until it can see you properly.
- **Ideal-form overlay:** a dashed green guide drawn on your own body, and your
  skeleton colored by your live score.
- **Progress:** personal bests, average, day streak, achievements and a
  shareable score-card image. Everything is saved in your browser only.

**The website** (`index.html`): live stick-figure demo, the Form Lab (drag
sliders and watch the real scoring engine grade a figure), and a "Spot the
better rep" game.

---

## Open it in VS Code

1. Unzip `vertexform.zip`, then in VS Code choose **File → Open Folder…** and
   pick the `vertexform` folder.
2. Install the **Live Server** extension (VS Code will suggest it, since it's
   listed in `.vscode/extensions.json`).
3. Click **Go Live** in the bottom-right corner. The site opens at
   `http://127.0.0.1:5500`. Click **Start training** and allow the camera.

`.vscode/settings.json` points Live Server at the `public/` folder, so the
right files are served automatically.

Don't double-click `index.html`. Browsers block this code when a page is
opened as a file, and the page will show a warning if that happens.

No VS Code? From this folder, run `python3 -m http.server 8080 --directory public`
and open `http://localhost:8080`.

## Put it on Cloudflare

Everything that goes online is in **`public/`**. There's no build step.

**Option A: drag and drop.** Go to dash.cloudflare.com, then **Workers & Pages
→ Create → Pages → Upload assets**. Name the project, drag in the **`public`**
folder, and click Deploy.

**Option B: from GitHub (updates automatically).** Push this folder to a GitHub
repo, then go to **Workers & Pages → Create → Pages → Connect to Git**. Set the
framework preset to *None*, leave the build command empty, and set the build
output directory to **`public`**.

**Option C: command line.** Run `npm run deploy`, which uses `wrangler.jsonc`
and needs Node.js.

Cloudflare serves the site over HTTPS, which the camera requires. `public/_headers`
sets the camera permission and caching rules, and `public/404.html` is the
not-found page.

---

## How the analyzer works

```
webcam ─▶ MediaPipe Pose (in-browser) ─▶ 33 landmarks per frame
       ─▶ session.js: aspect-correct → setup checks → measure → grade
       ─▶ rep engine: smoothed rep metric, time-in-the-hole check,
          score the frames near the bottom of the rep
       ─▶ live.js: overlay, HUD, voice, results
```

- **True angles.** MediaPipe reports x as a fraction of the frame width and y
  as a fraction of the height, which stretches angles on a 16:9 webcam. Every
  measurement is aspect-corrected first.
- **Fair scoring.** Each rep is scored on the frames near its deepest point,
  not the way down and up, and one glitchy frame can't create or ruin a rep.
- **Size-independent.** Measurements are relative to your own body (angles,
  torso lengths), so standing closer to or farther from the camera doesn't
  change your score.
- **Frame-rate independent.** A rep must spend real time in the bottom
  position, so it works the same on a fast laptop and a slow one.

## Project structure

```
vertexform/
├── public/                 ← the website (this is what you deploy)
│   ├── index.html          marketing site
│   ├── app.html            the trainer
│   ├── 404.html  favicon.svg  _headers
│   ├── css/                fonts.css, site.css, theme.css, app.css
│   ├── fonts/              Unbounded + Instrument Sans (self-hosted, OFL)
│   └── js/
│       ├── session.js      ★ the analysis engine (pure logic, fully tested)
│       ├── pose.js         MediaPipe + camera (GPU with CPU fallback)
│       ├── scoring.js      calibrated scoring curves
│       ├── geometry.js     angle / body-line math
│       ├── coaching.js     fault phrases, personalities, no-rep calls
│       ├── exercises/      one module per exercise: thresholds, measure, grade, faults
│       ├── ui/             screens: menu, live, results, stats, overlay, score card
│       ├── figures/        stick-figure rig (site demo, Form Lab, app demos)
│       ├── site/           website-only scripts
│       └── config.js  grade.js  storage.js  voice.js  achievements.js  main.js
├── tests/                  run with: npm test
│   ├── session.test.mjs    simulated people doing every exercise, good and bad
│   ├── scoring.test.mjs    scoring calibration bands
│   ├── rig.test.mjs        stick-figure rig stays rigid
│   └── helpers/synth.mjs   turns stick-figure poses into MediaPipe landmarks
├── .vscode/                Live Server root + recommended extension
├── package.json            dev / test / deploy scripts
└── wrangler.jsonc          Cloudflare config (for Option C)
```

## Tests

`npm test` (needs Node.js 18+) runs 3 suites:

- **Session (26 checks):** simulated people do sets of every exercise, with good
  form and with common faults, at 12–30 fps, with camera jitter and dropped
  frames. The checks confirm rep counts, scores, faults, "no rep" calls,
  practice-mode stopping, plank timing, and the turn-side-on / step-back
  checks.
- **Scoring (14 checks):** the curves land in their calibration bands.
- **Rig:** the stick figure's limbs stay rigid and its feet don't slide.

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page or warning banner | You opened the file directly. Use **Go Live** or your Cloudflare link. |
| "Camera access is blocked" | Click the camera icon in the address bar → Allow → **Try again**. |
| "Your camera is busy" | Close FaceTime, Zoom or Photo Booth, then **Try again**. |
| Reps aren't counting | Stand side-on (face the camera for jumping jacks) with your whole body in frame, and start from the top position. |
| Slow or choppy | Add `?cpu` to the address (`…/app.html?cpu`) to skip the GPU, or close other tabs. |
| Want to see what it's measuring | Add `?debug` to the address for a live readout of fps, rep phase and the measured angle. |

## Adding an exercise

1. Create `public/js/exercises/<name>.js` (copy `squat.js`): set the rep
   metric and thresholds, `measure()`, `grade()`, `detectFaults()` and
   `drawIdeal()`. Then register it in `exercises/index.js`.
2. Add it to `EXERCISES`, `EXERCISE_META` and `DEMO_TIPS` in `config.js`, and
   give it a fault bank in `coaching.js`.
3. Optional, for the website: add keyframes in `figures/poses.js`, sliders in
   `figures/lab.js`, and a card in `index.html`.
4. Add a scenario to `tests/session.test.mjs` and run `npm test`.

## Limits

- A side-on camera sees one plane, so knees caving inward isn't scored.
- Bad lighting or a cut-off body hurts tracking. You'll get a prompt, not a
  fake score.
- Scores compare you to general coaching ranges. It's a training aid, not
  medical advice.

## Credits

Pose tracking by [MediaPipe](https://developers.google.com/mediapipe)
(Apache 2.0), loaded from jsDelivr and Google's model storage at runtime.
Fonts: Unbounded and Instrument Sans (SIL Open Font License, see `public/fonts/`).
