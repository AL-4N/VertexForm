# VertexForm upgrade — TODO

Ticked as each item lands. "Skipped" items say why.

## Phase 0 — Plan + polish request
- [x] Read the whole codebase; write this list
- [x] Home page → trainer: motion-blur page transition ("Start training", "Open the trainer")
- [x] Smoother, lighter interactions everywhere (screen transitions, hover, live loop cost)

### Found while reading
- [x] Live loop rebuilds the score bars with `innerHTML` every frame (layout thrash) → update in place
- [x] overlay.js calls `getComputedStyle` up to 3× per frame → cache the colours
- [x] Live loop detects new frames via `video.currentTime` → use requestVideoFrameCallback
- [x] "Settings" button just jumps to the setup screen → real Settings screen
- [x] `gradeLetter` is defined twice (geometry.js and grade.js) → one source
- [x] Stats screen hard-codes "/5" exercises → use the registry size
- [x] History stores only one number per session, no dates → can't chart over time; needs a storage migration
- [x] Voice `say({interrupt})` cancels lines mid-sentence and drops others → one priority queue
- [x] Setup-screen demo loop keeps a rAF running while hidden → stop it when not visible
- [x] README says 3 test suites; there are 4 (camera). CLAUDE.md doesn't exist → create it
- [x] Target "A+ 95" but grade letters stop at A → show "A+" for 95+ in the badge

## Phase 1 — Camera reliability
Already in place: picker on setup + live screens, saved deviceId with `{exact}`, name fallback,
built-in first, virtual cameras skipped, dead-camera detection (no frames / black), auto-try
next, track `ended`, devicechange, switching mid-session.
- [x] Camera busy (NotReadableError): mention other tabs of this site and browser sidebar apps (Opera GX)
- [x] Permission probe opens the browser's *default* camera (may be virtual) → ask for the preferred camera instead
- [x] Switching: await `play()` and resize the canvas before resuming detection; reset frame timing
- [x] "Frozen" detection also when frames arrive but are all black after start (camera covered / shutter)
- [x] Ask for 30 fps @ 1280×720; show real fps + camera name + resolution in ?debug
- [x] Unit tests: error messages (busy wording), order with Opera-style labels

## Phase 2 — Detection & tracking accuracy
- [x] One Euro filter (per landmark, per axis), one config object; smooth display + measurement,
      rep metric uses a lighter-smoothed signal so phase detection stays responsive
- [x] Model quality: Fast (lite) / Balanced (full) / Max (heavy) / Auto (full → lite if fps < 15, says so)
- [x] worldLandmarks: compute knee / elbow / lean / hip-line from 2D (aspect-corrected) AND 3D;
      evaluate stability; use the better or a confidence-weighted blend; document in code
- [x] Body calibration (2 s stand still; plank/push-up use the top position): segment lengths + standing knee angle
- [x] Reject frames where a bone length jumps > 25% from calibration
- [x] Personalised thresholds (top ≈ the user's real standing angle)
- [x] Side selection with hysteresis (switch only after ~0.5 s clearly better)
- [x] Occlusion: interpolate key joints for ≤ 200 ms, else drop the frame
- [x] Framing guide: dashed silhouette box + hints (move left/right, step back, camera too low/high)
- [x] Lighting check (too dark → say so)
- [x] requestVideoFrameCallback loop with real frame timestamps
- [x] Real fps in ?debug

## Phase 3 — Rep detection robustness
- [x] Velocity / phase awareness (descending / bottom / ascending): bounces at the bottom don't double count, slow grinders count
- [x] Min / max rep duration per exercise; ignore walking out of frame
- [x] Resting: still at the top > N s mid-set → pause the set clock, count nothing, resume automatically
- [x] Auto-start option (hold the start position still for 1 s) vs countdown
- [x] Per-rep data: depth, lean, down / bottom / up durations

## Phase 4 — Smarter coach
- [x] Prioritise by impact (score gain if fixed), not just severity
- [x] Trends: depth dropping (fatigue), tempo speeding up, clean-rep groove
- [x] Positive reinforcement when a fault gets fixed
- [x] Escalation: rephrase, then a concrete physical cue; never the identical sentence twice in a row
- [x] Speak only at the top of a rep / rest; one priority speech queue, no overlaps or pile-ups
- [x] Pre-set briefing from history
- [x] Post-set summary: strengths, #1 fix, a concrete target
- [x] Tempo coach (spoken or beeped "down… 2… up")
- [x] Settings: voice on/off, speed, volume, chattiness (Quiet / Normal / Detailed)
- [x] New lines for all three personalities

## Phase 5 — Quality of life
- [x] Live controls: gym mode (huge counter), mute, pause/resume, camera picker, mirror, fullscreen;
      shortcuts Space / M / F / Esc as extras
- [x] Rest timer between sets (30/60/90 s) with voice countdown, "Next set" button
- [x] Workout builder / circuit: exercises + reps/seconds, back to back with rest; save up to 3 routines
- [x] History page: per-exercise chart over time, best/avg, common faults over time, CSV export
- [x] First-run onboarding (3 cards), skippable, re-openable from Settings
- [x] PWA: manifest + versioned service worker caching the shell and MediaPipe lib/wasm/model
- [x] Phone: front/rear toggle, portrait layout, Wake Lock during a set
- [x] Accessibility: focus states, aria-live rep results, reduced motion, never colour-only

## Phase 6 — Real-data testing tools
- [x] ?debug landmark recorder (Record / Stop → JSON download, 4-decimal rounding)
- [x] tests/fixtures + tests/replay.test.mjs with `.expect.json` sidecars
- [x] RECORDING_GUIDE.md
- [x] Playwright e2e with Chromium fake camera; ffmpeg-static converts tests/videos/* to .y4m;
      synthetic pattern when no videos exist

## Phase 7 — Test everything
- [x] Unit tests for every new module
- [x] New session scenarios (glitches, side flips, occlusion, resting, grinders, double bounce, walk-out, 10/15/30 fps)
- [x] Playwright e2e for every screen + site pages; no console errors; no horizontal overflow at 390/1280; Back stops the camera
- [x] Keyboard pass through every screen
- [x] Old localStorage data loads (migration test)
- [x] README, CLAUDE.md, in-app help, CHANGELOG.md

## Skill path (js/skills.js, "Skill path" screen)
- [x] Four paths (Push, Pull, Legs, Core); steps unlock in order from real saved sets
      (set: N reps averaging X+; hold: N s averaging X+); unlocks kept in `store.skills`
- [x] "Next up" shows your closest real attempt; untracked steps show "Not tracked yet"
- [x] Holds save `heldS` (exact seconds); older saves fall back to 5 s per scored stretch
- [x] tests/skills.test.mjs; storage test for the new fields

### Skill path trackers (planned)
Each one is a new `js/exercises/*.js` module (measure / grade / detectFaults / thresholds),
fault phrases in `coaching.js` (then `npm run voice` + `npm run sw`), synthetic poses in
`tests/helpers/synth.mjs`, scoring bands in `tests/scoring.test.mjs`, then a `test:` on its
step in `js/skills.js`. Order = most useful first.
- [ ] **Pull-up** (unlocks Pull path: Negative, Pull-up, 10 pull-ups). Front-on or side-on,
      whole body + hands in frame (camera further back and higher than for squats).
      Rep metric: elbow angle (hang > 155°, top < 70°) plus nose above the wrist line at the top.
      The bar isn't tracked; the wrists stand in for it. Faults: half rep (chin under wrists),
      no dead hang at the bottom, kipping (hip swing: horizontal hip speed), rushed lowering.
      Negative = top hold then a lowering of 3 s or more.
- [ ] **Dead hang** (hold): wrists above head, elbows > 160°, feet off the floor (ankles move
      up with the body, no floor contact for the whole hold). Fault: shrugged shoulders
      (shoulder-to-ear distance shrinks vs the calibrated standing value).
- [ ] **L-sit** (hold, side-on): hip angle 80–100°, knees > 165°, ankles at or above hip height.
      In-position only when the hips are above the wrists' floor line (hands on floor or
      parallettes). Faults: bent knees, legs dropping (ankle below hip), leaning back.
- [ ] **Hollow hold** (hold, side-on, lying): shoulders and ankles both off the floor line,
      hip angle 140–170°. Fault: legs too high (easy), lower back arching (hip lifts).
- [ ] **V-sit** (hold): like the L-sit with ankles clearly above hip height (hip angle < 75°).
- [ ] **Diamond push-up**: push-up module plus wrists close together (wrist gap < shoulder
      width x 0.5, front-on or 45°). Needs a facing check that allows a 45° camera.
- [ ] **Pike push-up**: hips high (hip angle < 110°), rep = head toward the floor (elbow angle).
- [ ] **Handstand push-up** (wall): body inverted (ankles above shoulders), elbow angle reps.
- [ ] **Pistol squat**: squat module on one leg; the free foot must stay off the floor for the
      whole rep; depth = working thigh angle; per-leg counts.
- [ ] **Muscle-up**: pull-up tracker plus a transition phase (wrists move from above the head
      to below the shoulders) and a lockout at the top.

## Decided not to do
- **Upgrade MediaPipe tasks-vision 0.10.14 → 1.x.** A major version with possible API changes; 0.10.14 is
  known to work here and the upgrade can't be verified without a real webcam. Revisit separately.
- **Static-picture camera check at startup.** Spotting a frozen placeholder needs ~4 s of identical
  frames; doing it before the session starts would delay every start. It runs in the watchdog instead.
- **Service worker on the marketing site.** Registered from the trainer only: in Chrome, the first
  navigation from a page loaded before the worker existed to one it controls skips the cross-page
  transition (measured: 0/3 vs 3/3). The worker still precaches the site pages for offline use.
- **Keyboard pass** is automated for the main path (Tab to an exercise, Enter, Tab to Practice, Space,
  Esc, pills with Enter) plus an accessible-name audit of every screen. A full manual screen-reader
  pass (VoiceOver) wasn't done.
- **Scoring curves unchanged.** Smoothing moved simulated scores by at most ±1 (all bands hold), so
  `tests/scoring.test.mjs` only gained grade-letter checks.
- **Directional (vertical) blur in the page transition.** View-transition snapshots take CSS filters;
  an SVG directional blur there isn't reliable across browsers, so it's a strong blur + upward
  motion, which reads as motion blur. The in-page nav glide keeps the true vertical SVG blur.
