# Changelog

## 2.0.0 — 2026-10-04

The big upgrade: accuracy, a smarter coach, quality of life, and tests for
all of it. Saved data from 1.x loads as before and is migrated automatically.

### Camera
- Fixed: a busy or virtual default camera no longer stops the app from
  reaching your real camera. The permission check tolerates it, and the real
  cameras are tried in order (built-in first).
- New: cameras stuck on a still picture (virtual-camera placeholders) are
  detected and skipped. The camera now asks for 30 fps at 720p.
- New: friendlier "camera busy" message (other tabs, sidebar apps), and a
  message for browsers that can't use the camera.

### Tracking accuracy
- One Euro landmark smoothing: about 6× steadier angles, with about 10 ms of
  lag mid-movement.
- 2-second calibration (bone lengths, your real top position) with
  personalised rep thresholds.
- Frames where a bone suddenly changes length (tracking glitches) are rejected.
- Side selection with 0.5 s hysteresis. Joints hidden for ≤ 200 ms are
  bridged; longer gaps drop the frame.
- 3D world landmarks are blended with 2D angles as you turn from side-on.
- Model quality: Fast / Balanced / Max accuracy / Auto, falling back to Fast
  below 15 fps.
- Framing guide with on-screen hints, lighting check, and
  requestVideoFrameCallback frame loop.

### Rep counting
- Velocity-aware phases. Per-exercise minimum and maximum rep length:
  twitches are ignored and grinders count.
- Resting at the top pauses the set clock. Walking out resets cleanly.
- Optional auto-start. Per-rep timings (down / bottom / up) are shown on the
  results screen.

### Coach
- Cues ranked by score impact, trends (fatigue, rushing, groove), and
  reinforcement when you fix something.
- Escalating cues: rephrased, then a concrete physical cue, never the same
  sentence twice.
- Speaks only at the top of a rep or at rest, through one priority queue.
- Pre-set briefing from history, and a post-set summary with a concrete target.
- Tempo coach, voice speed and volume, chattiness levels.

### Quality of life
- Live controls: pause, mute, mirror, camera flip, gym mode and fullscreen,
  with keyboard shortcuts. Screen wake lock.
- Rest timer, workout builder and circuits (3 saved routines), and a progress
  page with charts, fault trends and CSV export.
- First-run setup tips. Settings screen with help.
- Installable PWA that works offline after the first session.
- Motion-blur page transition from the home page to the trainer.
  Blur-fade between screens. Lighter live-screen rendering.
- Accessibility: focus rings, focus management, aria-live rep results,
  reduced motion, and colour is never the only signal.

### Testing
- New suites: tracking, coach, speech, storage, circuit, PWA, replay
  (about 235 checks in total).
- Playwright end-to-end suite: 18 browser tests with a fake camera.
- ?debug landmark recorder, recording replay harness, RECORDING_GUIDE.md.

## 1.0.0
- First release: 5 exercises, practice and set modes, voice coach, progress
  and achievements, website with live demo, Form Lab and rep game.
