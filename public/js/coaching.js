/**
 * coaching.js — the coaching intelligence layer.
 *
 * Instead of one generic "go lower" line, each exercise has a bank of
 * SPECIFIC faults. Every fault carries several phrasings that rotate, so the
 * coach never repeats itself twice in a row, and three personalities change
 * the tone of praise and milestones.
 */

import { getSetting } from "./storage.js";

/* ── Personality phrase banks ───────────────────────────── */

export const PERSONALITIES = ["Chill", "Hype", "Coach"];

const PRAISE = {
  Chill: ["Nice.", "Smooth rep.", "That's it.", "Clean.", "Good one.",
          "Really solid.", "Yeah, that works."],
  Hype:  ["Let's go!", "That was money!", "You're on fire!", "Huge rep!",
          "Beautiful!", "Unreal form!", "Certified clean!"],
  Coach: ["Good rep. Again.", "That's the standard.", "Solid, keep that form.",
          "Textbook.", "Yes. Lock that in.", "That's how it's done."],
};

const NEAR_MISS = {
  Chill: ["So close.", "Almost there.", "Right on the edge."],
  Hype:  ["So close, one more push!", "You're knocking on the door!"],
  Coach: ["Close. Tighten it up.", "Almost. Fix one thing."],
};

const MILESTONES = {
  streak2:  { Chill: "Two in a row.",            Hype: "Back to back, keep it rolling!", Coach: "Two straight. Stay locked in." },
  streak3:  { Chill: "Three straight, nice run.", Hype: "Hat trick! Unstoppable!",        Coach: "Three in a row. That's consistency." },
  improved: { Chill: "Better than the last one.", Hype: "Level up! That one was better!", Coach: "Improvement. Do it again." },
  halfway:  { Chill: "Halfway there.",            Hype: "Halfway! Don't slow down!",      Coach: "Halfway. Hold the standard." },
};

/* ── Fault banks ────────────────────────────────────────
   key: [severity 1-3, short label, [phrase variants...]]         */

export const FAULTS = {
  "Squat": {
    depth: [3, "Depth", [
      "Go lower, sink the hips to parallel",
      "You're cutting it high, drop a few more inches",
      "Deeper — thighs to parallel",
      "Not quite parallel yet, sit down into it",
      "Half reps. Get the hips below the knee line",
    ]],
    lean: [3, "Chest up", [
      "You're folding forward, lift your chest",
      "Chest up, sit back into your heels",
      "Keep the torso tall, don't tip over your toes",
      "Proud chest — hips back, not down and forward",
      "Too much lean. Think about staying upright",
    ]],
    kneeTravel: [2, "Knees back", [
      "Knees are drifting past your toes, push the hips back",
      "Load the hips more, keep the shins closer to vertical",
      "Sit back — let the hips do the work, not the knees",
    ]],
    bounce: [2, "Control", [
      "Control the bottom, no bouncing",
      "Pause for a beat at the bottom",
      "Own the bottom position, don't rebound out of it",
    ]],
    tempo: [1, "Slow down", [
      "Slow it down, two seconds on the way down",
      "Control the descent, don't drop into it",
      "Smooth and slow going down, powerful coming up",
    ]],
    lockout: [1, "Stand tall", [
      "Finish tall at the top, squeeze the glutes",
      "Stand all the way up between reps",
    ]],
  },

  "Push-up": {
    depth: [3, "Depth", [
      "Lower your chest, elbows to ninety",
      "Get the chest closer to the floor",
      "Deeper — break ninety with the elbows",
      "Half reps don't count, all the way down",
    ]],
    sag: [3, "Hips up", [
      "Hips are sagging, squeeze your glutes",
      "Brace the core, lift the hips to the line",
      "Don't let the hips dip, stay in one straight line",
    ]],
    pike: [2, "Hips down", [
      "Hips are too high, flatten out",
      "Lower the hips, body in one straight line",
      "You're piking — straighten from shoulders to ankles",
    ]],
    head: [1, "Head neutral", [
      "Keep the head neutral, eyes just ahead of your hands",
      "Don't crane the neck, lead with the chest not the chin",
    ]],
    tempo: [1, "Slow down", [
      "Slow the reps down, control both directions",
      "Two seconds down, one second up",
    ]],
  },

  "Lunge": {
    shallow: [3, "Depth", [
      "Bend the front knee more, aim for ninety degrees",
      "Sink deeper into the lunge",
      "Drop the back knee toward the floor",
    ]],
    tooDeep: [1, "Ease up", [
      "That's very deep — ease up a little if the knee complains",
    ]],
    lean: [2, "Torso tall", [
      "Stay upright, don't lean over the front leg",
      "Chest tall, shoulders stacked over the hips",
      "Keep the torso vertical through the whole rep",
    ]],
    kneeTravel: [2, "Knee back", [
      "Front knee is past the toes, lengthen your stance",
      "Take a bigger step so the shin stays vertical",
    ]],
  },

  "Plank": {
    sag: [3, "Hips up", [
      "Hips are sagging, squeeze the glutes and lift them",
      "Brace the core, bring the hips up to the line",
      "Don't let gravity win — hips back up",
    ]],
    pike: [2, "Hips down", [
      "Hips are too high, lower into one straight line",
      "Flatten out — shoulders to ankles in one line",
    ]],
    head: [1, "Head neutral", [
      "Relax the neck, look at the floor just ahead",
      "Keep the head in line with the spine",
    ]],
    drift: [1, "Hold steady", [
      "You're drifting, reset the position and hold",
      "Lock it in, no swaying",
    ]],
  },

  "Jumping Jack": {
    extension: [3, "Full range", [
      "Get the hands all the way overhead",
      "Full range — clap those hands up top",
      "Arms higher, reach for the ceiling",
    ]],
    feet: [2, "Feet wider", [
      "Jump the feet out wider",
      "Wider stance at the top, past your shoulders",
      "Get those feet out, don't just bounce in place",
    ]],
  },
};

/* ── Reps that didn't count ─────────────────────────────── */

const NO_REP = {
  "Squat":        ["Too shallow, that one didn't count", "No rep. Sit deeper", "Not deep enough to count"],
  "Push-up":      ["No rep. Chest lower", "That one didn't count, go deeper", "Half rep. All the way down"],
  "Lunge":        ["Too shallow to count, drop the back knee", "No rep. Sink lower"],
  "Jumping Jack": ["Arms all the way up for it to count", "No rep. Hands overhead"],
};

export function noRepPhrase(exercise) {
  const bank = NO_REP[exercise] ?? ["That one didn't count"];
  const id = `norep:${exercise}`;
  const next = (rotation.get(id) ?? -1) + 1;
  rotation.set(id, next);
  return bank[next % bank.length];
}

/* ── Setup problems (said out loud while you get into position) ── */

export const SETUP_CUES = {
  none:     "Step into the frame",
  partial:  "Step back so I can see your whole body",
  turn:     "Turn side-on to the camera",
  turnFront:"Face the camera",
  position: "Get into position",
};

/* ── Rotation so cues never repeat back to back ─────────── */

const rotation = new Map();

export function faultPhrase(exercise, key) {
  const bank = FAULTS[exercise]?.[key]?.[2];
  if (!bank || !bank.length) return "";
  const id = `${exercise}:${key}`;
  const next = (rotation.get(id) ?? -1) + 1;
  rotation.set(id, next);
  return bank[next % bank.length];
}

export function faultLabel(exercise, key) {
  return FAULTS[exercise]?.[key]?.[1] ?? key;
}

export function faultSeverity(exercise, key) {
  return FAULTS[exercise]?.[key]?.[0] ?? 1;
}

const personality = () => getSetting("personality", "Chill");

export const praise    = () => pick(PRAISE[personality()] ?? PRAISE.Chill);
export const nearMiss  = () => pick(NEAR_MISS[personality()] ?? NEAR_MISS.Chill);
export const milestone = (key) => MILESTONES[key]?.[personality()] ?? "";

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * Rank detected faults worst-first.
 * @param found array of [key, severityOverride]
 */
export function rankFaults(exercise, found) {
  return found
    .map(([key, sev]) => ({
      key,
      severity: sev ?? faultSeverity(exercise, key),
      label: faultLabel(exercise, key),
    }))
    .sort((a, b) => b.severity - a.severity);
}

/** Build the spoken line for a finished rep. */
export function repFeedback(exercise, score, target, faults, streak) {
  if (score >= target) {
    const m = streak >= 3 ? milestone("streak3")
            : streak === 2 ? milestone("streak2") : "";
    return `${score}. ${praise()} ${m}`.trim();
  }
  if (score >= target - 6) {
    const top = faults[0];
    return `${score}. ${nearMiss()} ${top ? faultPhrase(exercise, top.key) : ""}`.trim();
  }
  const top = faults[0];
  return top ? `${score}. ${faultPhrase(exercise, top.key)}` : `${score}.`;
}
