# Recording guide: real test clips

The simulator tests a perfect stick figure. These recordings test **you**, on
**your** webcam, which is what actually matters. Each clip takes under a
minute to make. The app records the raw landmark data (not video), so clips
are about 1 MB and contain no images of you.

There are two kinds of recording:

- **Landmark recordings** (`.json`): replayed by `npm test` through the real
  analysis engine. These are the main ones, and you make them in the app.
- **Videos** (`.mov` / `.mp4`, optional): played into the real app as a fake
  camera by `npm run test:e2e`. Only needed for the end-to-end test.

## How to make a landmark recording

1. Run the app (`npm run dev`) and open **http://localhost:8080/app.html?debug**.
2. Pick the exercise, then choose **Analyze a set**. Set length doesn't
   matter: the replay counts everything.
3. Get into position. When the countdown ends, click **● Record**
   (bottom-left).
4. Do the reps exactly as described below, then click **■ Stop**. The file
   downloads.
5. Rename it as shown below and move it to `tests/fixtures/`.
6. Create the matching `.expect.json` next to it (the contents are listed
   below), then run `npm test`.

Camera setup for every clip: camera at hip height, 2–3 m away, your whole
body in the picture, a light in front of you. Stand side-on, except for
jumping jacks (face the camera).

## The clips

| # | File name | What to do | `.expect.json` |
|---|---|---|---|
| 1 | `squat-good-5.json` | 5 slow squats, thighs to parallel, chest up | `{ "reps": 5, "minScore": 85 }` |
| 2 | `squat-half-5.json` | 5 half squats (stop well above parallel) | `{ "reps": 5, "maxScore": 82, "faults": ["depth"] }` |
| 3 | `squat-lean-5.json` | 5 full-depth squats, folding your chest forward | `{ "reps": 5, "maxScore": 88, "faults": ["lean"] }` |
| 4 | `squat-tiny-5.json` | 5 small knee dips (a quarter of the way down) | `{ "noReps": true }` |
| 5 | `squat-fast-8.json` | 8 quick squats, full depth, no pause | `{ "reps": 8, "repsTolerance": 1 }` |
| 6 | `squat-rest-6.json` | 3 good squats, stand still for 8 s, 3 more | `{ "reps": 6, "minScore": 80 }` |
| 7 | `pushup-good-5.json` | 5 full push-ups (camera at floor height) | `{ "reps": 5, "minScore": 85 }` |
| 8 | `pushup-sag-5.json` | 5 push-ups letting your hips sag | `{ "reps": 5, "faults": ["sag"] }` |
| 9 | `pushup-half-5.json` | 5 half push-ups | `{ "noReps": true }` |
| 10 | `plank-good-30s.json` | Hold a straight plank for 30 s | `{ "seconds": 30, "minScore": 85 }` |
| 11 | `plank-sag-20s.json` | Hold a plank 20 s with your hips sagging | `{ "seconds": 20, "maxScore": 80, "faults": ["sag"] }` |
| 12 | `lunge-good-6.json` | 6 lunges (3 each leg, step forward, back knee low) | `{ "reps": 6, "repsTolerance": 1, "minScore": 80 }` |
| 13 | `jack-good-10.json` | 10 jumping jacks, facing the camera, hands overhead | `{ "reps": 10, "repsTolerance": 1, "minScore": 85 }` |
| 14 | `jack-lazy-10.json` | 10 jumping jacks with hands only to shoulder height | `{ "reps": 0, "repsTolerance": 2 }` |
| 15 | `squat-turned-5.json` | 5 good squats turned about 30° toward the camera | `{ "reps": 5, "minScore": 80 }` |
| 16 | `squat-walkout-4.json` | 2 squats, walk out of the picture for 5 s, come back, 2 squats | `{ "reps": 4 }` |

Start with **1, 2, 7 and 10**. They cover most of the engine. The others
test the edge cases (rest detection, walking out, turning, occlusion).

If a clip fails, keep it. That's exactly the data needed to fix the engine.
The expected values are where the scoring should land. If your own form
honestly differs (e.g. clip 1 scored 82 because you really were a bit
high), adjust the `.expect.json` rather than the clip.

## Extra: which angle source is better on your camera

After recording clips 1, 7 and 15, run `npm run eval:angles`. It compares
the 2D and 3D angle measurements on your real data (jitter and how far
they disagree). That shows whether the 2D/3D blend in
`js/tracking.js` (`worldWeight`) suits your setup.

## Optional: videos for the end-to-end test

Put short clips (5–20 s) in `tests/videos/`, named like the landmark clips
(e.g. `squat-good-5.mov`), with the same `.expect.json` next to them
(e.g. `squat-good-5.expect.json`). `npm run test:e2e` converts them with
ffmpeg (from npm, no install needed) and plays each one into the real app
as its camera. It then checks the rep count, that the results screen
appears, and that there are no console errors. Phone videos work. Hold the
phone sideways (landscape) and keep it still.

These videos stay on your computer. `tests/videos/` is git-ignored.
