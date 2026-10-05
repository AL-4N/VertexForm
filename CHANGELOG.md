# Changelog

## 2.1.0 — 2026-10-04

### Overlay only when it's really you exercising
- Per-frame confidence: key-joint visibility, bone lengths vs calibration,
  side/facing, posture matching the exercise, and not walking around.
- Overlay states with hysteresis (on after 0.3 s, off after 0.5 s) and fades:
  nothing plus a hint, a faint skeleton when ready, and the full skeleton
  plus guide mid-rep. Low-confidence frames are never graded or counted.

### Ideal-form guide
- Facing from a weighted, smoothed vote (toes, nose vs ears, knee bend,
  head end on the floor), locked during a rep. No confident facing, no guide.
  This fixes guides drawn backwards.
- New guide geometry (js/guide.js) built from your calibrated limb lengths:
  target bottom pose, a "parallel" line, a torso-lean zone, a push-up/plank
  tolerance band and jumping-jack arm markers. It flips with the mirror,
  never covers the face, fades in on the way down and out on the way up.

### Coach voice
- Natural neural voice pre-rendered with Kokoro-82M (Apache-2.0):
  `npm run voice` → public/audio/. Calm Heart for Chill, energetic Bella for
  Hype, firm Michael for Coach, plus a voice picker and "System voice
  (basic)".
- Lines are stitched from clips with exact pauses (250 ms after a score,
  400 ms between sentences). Clips are preloaded per session and cached
  offline. Beeps duck under the voice. Stale rep feedback is dropped when a
  new rep starts. Any missing clip falls back to the system voice.
- All spoken text now lives in coaching.js. tests/voice.test.mjs fails if
  any line lacks a recording.

## 2.0.1 — 2026-10-04

### External USB webcams (e.g. Anker PowerConf C200)
- Fixed: a USB webcam that takes a few seconds to send its first frame, or
  starts with black / muted frames, was declared dead after 3 s and
  replaced by another camera. The app now waits up to 6 s ("Starting
  camera…"), and a muted track is waited out.
- Fixed: a camera you pick (or picked before) is the only one tried. If it
  fails you get the reason, the camera list and Try again, never a silent
  switch.
- Constraint ladder: 1280×720 @ 30 → 640×480 → device only. Only the device
  id is ever `exact`. It retries on OverconstrainedError / NotReadableError.
- The old camera (and the permission-check stream) is fully stopped before
  another opens, so the same webcam is never held twice.
- All-black frames mean "Camera shows a black picture. If it has a privacy
  cover, slide it open". The camera is kept, not swapped. Very dark is low
  light, not dead.
- "Elgato" no longer counts as a virtual camera (the Facecam is real).
  Continuity / iPhone cameras are skipped unless you pick them.
- ?debug: getUserMedia attempts and errors, track settings, capabilities,
  readyState and muted, on screen and in the console.
- Setup screen: Test camera, with a live preview.
- The motion-blur slide is now on every transition (screens, onboarding
  carousel, dialogs, toasts, overlays, the website's Form Lab, game and
  hero).
- Offline mode works on Cloudflare (it redirects app.html to /app).

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
