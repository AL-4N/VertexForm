/**
 * phrases.js — every line the app can say out loud, in one list (pure).
 *
 * Used by scripts/build-voice.mjs to render the voice pack, and by
 * tests/voice.test.mjs to fail if anything in coaching.js has no
 * recording. Templates ("Better, {x}.") are listed with every value they
 * can be filled with, so whole sentences are recorded (natural intonation)
 * rather than glued from fragments. Scores are recorded separately as the
 * numbers 0–100.
 */

import {
  PRAISE, NEAR_MISS, NO_REP, MILESTONES, SYSTEM, REST_SECONDS, EXERCISE_NAMES,
  FAULTS, CONCRETE, FIXED, FOCUS, COACH_LINES, SETUP_CUES, FRAMING, PERSONALITIES,
} from "./coaching.js";
import { fillTemplate, briefFixLine } from "./coach.js";
export { numberKey } from "./speech.js";

export const NUMBERS = Array.from({ length: 101 }, (_, i) => i);

/** All phrases (strings), de-duplicated and sorted. */
export function allPhrases() {
  const out = new Set();
  const add = (v) => {
    if (typeof v === "string") { if (v.trim()) out.add(v); }
    else if (Array.isArray(v)) v.forEach(add);
    else if (v && typeof v === "object") Object.values(v).forEach(add);
  };

  add([PRAISE, NEAR_MISS, NO_REP, MILESTONES, SETUP_CUES, FRAMING, CONCRETE]);
  for (const [k, v] of Object.entries(SYSTEM)) if (typeof v !== "function") add(v);
  REST_SECONDS.forEach((n) => add(SYSTEM.rest(n)));
  EXERCISE_NAMES.forEach((e) => add(SYSTEM.name(e)));
  for (const ex of Object.values(FAULTS)) for (const [, , bank] of Object.values(ex)) add(bank);

  for (const p of PERSONALITIES) {
    for (const key of ["groove", "fatigue", "rushing", "rest", "briefGood"]) add(COACH_LINES[key][p]);
    for (const t of COACH_LINES.reinforce[p]) for (const ex of Object.values(FIXED)) for (const x of Object.values(ex)) add(fillTemplate(t, x));
    for (const t of COACH_LINES.summaryFix[p]) for (const ex of Object.values(FOCUS)) for (const y of Object.values(ex)) add(fillTemplate(t, "", y));
    for (const t of COACH_LINES.briefFix[p]) for (const [ex, faults] of Object.entries(FAULTS)) for (const key of Object.keys(faults)) add(briefFixLine(ex, key, t));
  }
  return [...out].sort();
}
