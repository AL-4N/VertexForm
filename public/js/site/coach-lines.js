/**
 * coach-lines.js — what the voice demo on the homepage says (pure, no DOM).
 *
 * Built from the trainer's own phrase banks (js/coaching.js), so every part
 * has a recorded clip in public/audio and the demo sounds exactly like the
 * coach in a real set. tests/voice.test.mjs checks they're all recorded.
 */

import { FAULTS, PRAISE, NEAR_MISS, MILESTONES } from "../coaching.js";

const lean = FAULTS.Squat.lean[2], depth = FAULTS.Squat.depth[2];

/** Three reps of a squat set: a fault, a near miss, a clean one. */
export const DEMO_SCORES = [74, 86, 94];
export const DEMO = {
  Chill: [[lean[1]], [NEAR_MISS.Chill[0], depth[0]], [PRAISE.Chill[0], MILESTONES.streak2.Chill]],
  Hype:  [[lean[0]], [NEAR_MISS.Hype[0], depth[2]], [PRAISE.Hype[0], MILESTONES.streak2.Hype]],
  Coach: [[lean[3]], [NEAR_MISS.Coach[0], depth[3]], [PRAISE.Coach[3], MILESTONES.streak2.Coach]],
};
