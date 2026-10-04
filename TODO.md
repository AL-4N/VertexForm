# VertexForm upgrade — TODO

Ticked as each item lands. "Skipped" items say why.

## Phase 0 — Plan + polish request
- [x] Read the whole codebase; write this list
- [ ] Home page → trainer: motion-blur page transition ("Start training", "Open the trainer")
- [ ] Smoother, lighter interactions everywhere (screen transitions, hover, live loop cost)

### Found while reading
- [ ] Live loop rebuilds the score bars with `innerHTML` every frame (layout thrash) → update in place
- [ ] overlay.js calls `getComputedStyle` up to 3× per frame → cache the colours
- [ ] Live loop detects new frames via `video.currentTime` → use requestVideoFrameCallback
- [ ] "Settings" button just jumps to the setup screen → real Settings screen
- [ ] `gradeLetter` is defined twice (geometry.js and grade.js) → one source
- [ ] Stats screen hard-codes "/5" exercises → use the registry size
- [ ] History stores only one number per session, no dates → can't chart over time; needs a storage migration
- [ ] Voice `say({interrupt})` cancels lines mid-sentence and drops others → one priority queue
- [ ] Setup-screen demo loop keeps a rAF running while hidden → stop it when not visible
- [ ] README says 3 test suites; there are 4 (camera). CLAUDE.md doesn't exist → create it
- [ ] Target "A+ 95" but grade letters stop at A → show "A+" for 95+ in the badge

## Phase 1 — Camera reliability
Already in place: picker on setup + live screens, saved deviceId with `{exact}`, name fallback,
built-in first, virtual cameras skipped, dead-camera detection (no frames / black), auto-try
next, track `ended`, devicechange, switching mid-session.
- [ ] Camera busy (NotReadableError): mention other tabs of this site and browser sidebar apps (Opera GX)
- [ ] Permission probe opens the browser's *default* camera (may be virtual) → ask for the preferred camera instead
- [ ] Switching: await `play()` and resize the canvas before resuming detection; reset frame timing
- [ ] "Frozen" detection also when frames arrive but are all black after start (camera covered / shutter)
- [ ] Ask for 30 fps @ 1280×720; show real fps + camera name + resolution in ?debug
- [ ] Unit tests: error messages (busy wording), order with Opera-style labels

## Phase 2 — Detection & tracking accuracy
- [ ] One Euro filter (per landmark, per axis), one config object; smooth display + measurement,
      rep metric uses a lighter-smoothed signal so phase detection stays responsive
- [ ] Model quality: Fast (lite) / Balanced (full) / Max (heavy) / Auto (full → lite if fps < 15, says so)
- [ ] worldLandmarks: compute knee / elbow / lean / hip-line from 2D (aspect-corrected) AND 3D;
      evaluate stability; use the better or a confidence-weighted blend; document in code
- [ ] Body calibration (2 s stand still; plank/push-up use the top position): segment lengths + standing knee angle
- [ ] Reject frames where a bone length jumps > 25% from calibration
- [ ] Personalised thresholds (top ≈ the user's real standing angle)
- [ ] Side selection with hysteresis (switch only after ~0.5 s clearly better)
- [ ] Occlusion: interpolate key joints for ≤ 200 ms, else drop the frame
- [ ] Framing guide: dashed silhouette box + hints (move left/right, step back, camera too low/high)
- [ ] Lighting check (too dark → say so)
- [ ] requestVideoFrameCallback loop with real frame timestamps
- [ ] Real fps in ?debug

## Phase 3 — Rep detection robustness
- [ ] Velocity / phase awareness (descending / bottom / ascending): bounces at the bottom don't double count, slow grinders count
- [ ] Min / max rep duration per exercise; ignore walking out of frame
- [ ] Resting: still at the top > N s mid-set → pause the set clock, count nothing, resume automatically
- [ ] Auto-start option (hold the start position still for 1 s) vs countdown
- [ ] Per-rep data: depth, lean, down / bottom / up durations

## Phase 4 — Smarter coach
- [ ] Prioritise by impact (score gain if fixed), not just severity
- [ ] Trends: depth dropping (fatigue), tempo speeding up, clean-rep groove
- [ ] Positive reinforcement when a fault gets fixed
- [ ] Escalation: rephrase, then a concrete physical cue; never the identical sentence twice in a row
- [ ] Speak only at the top of a rep / rest; one priority speech queue, no overlaps or pile-ups
- [ ] Pre-set briefing from history
- [ ] Post-set summary: strengths, #1 fix, a concrete target
- [ ] Tempo coach (spoken or beeped "down… 2… up")
- [ ] Settings: voice on/off, speed, volume, chattiness (Quiet / Normal / Detailed)
- [ ] New lines for all three personalities

## Phase 5 — Quality of life
- [ ] Live controls: gym mode (huge counter), mute, pause/resume, camera picker, mirror, fullscreen;
      shortcuts Space / M / F / Esc as extras
- [ ] Rest timer between sets (30/60/90 s) with voice countdown, "Next set" button
- [ ] Workout builder / circuit: exercises + reps/seconds, back to back with rest; save up to 3 routines
- [ ] History page: per-exercise chart over time, best/avg, common faults over time, CSV export
- [ ] First-run onboarding (3 cards), skippable, re-openable from Settings
- [ ] PWA: manifest + versioned service worker caching the shell and MediaPipe lib/wasm/model
- [ ] Phone: front/rear toggle, portrait layout, Wake Lock during a set
- [ ] Accessibility: focus states, aria-live rep results, reduced motion, never colour-only

## Phase 6 — Real-data testing tools
- [ ] ?debug landmark recorder (Record / Stop → JSON download, 4-decimal rounding)
- [ ] tests/fixtures + tests/replay.test.mjs with `.expect.json` sidecars
- [ ] RECORDING_GUIDE.md
- [ ] Playwright e2e with Chromium fake camera; ffmpeg-static converts tests/videos/* to .y4m;
      synthetic pattern when no videos exist

## Phase 7 — Test everything
- [ ] Unit tests for every new module
- [ ] New session scenarios (glitches, side flips, occlusion, resting, grinders, double bounce, walk-out, 10/15/30 fps)
- [ ] Playwright e2e for every screen + site pages; no console errors; no horizontal overflow at 390/1280; Back stops the camera
- [ ] Keyboard pass through every screen
- [ ] Old localStorage data loads (migration test)
- [ ] README, CLAUDE.md, in-app help, CHANGELOG.md

## Decided not to do
(filled in as decisions are made)
