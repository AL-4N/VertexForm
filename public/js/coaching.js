/**
 * coaching.js — the coaching intelligence layer.
 *
 * Instead of one generic "go lower" line, each exercise has a bank of
 * SPECIFIC faults. Every fault carries several phrasings that rotate, so the
 * coach never repeats itself twice in a row, and three personalities change
 * the tone of praise and milestones.
 */

/* ── Personality phrase banks ───────────────────────────── */
/* Every line the coach can say lives in this file, so the pre-rendered voice
   pack (npm run voice → public/audio/) can include all of them, and
   tests/voice.test.mjs fails if a line has no recording. */

export const PERSONALITIES = ["Chill", "Hype", "Coach"];

export const PRAISE = {
  Chill: ["Nice.", "Smooth rep.", "That's it.", "Clean.", "Good one.", "Really solid.", "Yeah, that works."],
  Hype:  ["Let's go!", "That was money!", "You're on fire!", "Huge rep!", "Beautiful!", "Unreal form!", "Certified clean!"],
  Coach: ["Good rep. Again.", "That's the standard.", "Solid, keep that form.", "Textbook.", "Yes. Lock that in.", "That's how it's done."],
};

export const NEAR_MISS = {
  Chill: ["So close.", "Almost there.", "Right on the edge."],
  Hype:  ["So close, one more push!", "You're knocking on the door!"],
  Coach: ["Close. Tighten it up.", "Almost. Fix one thing."],
};

export const NO_REP = {
  Chill: ["Too shallow, that one didn't count.", "Not deep enough to count."],
  Hype:  ["Deeper, that one didn't count!", "No rep, get all the way there!"],
  Coach: ["No rep. Full range.", "Didn't count. Go deeper."],
};

export const MILESTONES = {
  streak2:  { Chill: "Two in a row.",            Hype: "Back to back, keep it rolling!", Coach: "Two straight. Stay locked in." },
  halfway:  { Chill: "Halfway there.",            Hype: "Halfway! Don't slow down!",      Coach: "Halfway. Hold the standard." },
  improved: { Chill: "Better than the last one.", Hype: "Level up! That one was better!", Coach: "Improvement. Do it again." },
};

/* ── System lines: countdown, start, finish, rest timer, workouts ── */

export const EXERCISE_NAMES = ["Squat", "Push-up", "Plank", "Lunge", "Jumping Jack"];
export const REST_SECONDS = [15, 30, 45, 60, 75, 90, 105, 120];

export const SYSTEM = {
  go: "Go!",
  again: "Again.",
  average: "Average",
  startRep: "Get into your starting position and hold still.",
  startHold: "Get into position and hold still to start.",
  setComplete: "Set complete.",
  targetReached: "Target reached. Great work.",
  cleanSet: "Clean set.",
  restOver: "Rest's over. Tap Next set when you're ready.",
  tenSeconds: "Ten seconds.",
  thirtyLeft: "Thirty seconds left.",
  nextUp: "Next up:",
  firstUp: "First up:",
  workoutStart: "Workout starting.",
  workoutDone: "Workout complete. Nice work.",
  workoutEnded: "Workout ended.",
  voiceOff: "The voice is off.",
  sample: "Nice depth, keep the chest up.",
  tempo: ["Down", "two", "Up"],
  rest: (n) => `Rest ${n} seconds.`,
  name: (exercise) => `${exercise}.`,
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

/* ── Setup problems (said out loud while you get into position) ── */

export const SETUP_CUES = {
  none:     "Step into the frame",
  partial:  "Step back so I can see your whole body",
  turn:     "Turn side-on to the camera",
  turnFront:"Face the camera",
  position: "Get into position",
};

/** Framing, lighting and camera hints (shown on screen, and said if they last). */
export const FRAMING = {
  enter: "Step into the frame",
  stepBack: "Step back so I can see you head to toe",
  feetCut: "Feet are cut off: lower the camera or tilt it down",
  headCut: "Head is cut off: raise the camera or tilt it up",
  moveRight: "Move a step to the right (as you see it on screen)",
  moveLeft: "Move a step to the left (as you see it on screen)",
  closer: "Step a little closer",
  dark: "It's too dark: turn on a light in front of you",
  black: "Camera shows a black picture. If it has a privacy cover, slide it open.",
  wholeBody: "Keep your whole body in view",
  still: "Stay in one spot",
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

/* ── Smarter-coach phrase banks (used by js/coach.js) ───────────────
   CONCRETE: the physical cue for when the same fault keeps coming back.
   FIXED:    what you did right when a fault disappears ("that one hit parallel").
   FOCUS:    what to focus on, for the pre-set briefing and the summary.       */

export const CONCRETE = {
  "Squat": {
    depth: ["Sit back like there's a chair behind you, and touch it with your hips",
            "Push your knees out and drop your hips until your thighs are flat"],
    lean: ["Pick a spot on the wall at eye level and keep looking at it all the way down",
           "Brace like someone's about to poke your stomach, then sit straight down"],
    kneeTravel: ["Send your hips back first, like closing a car door with your butt"],
    bounce: ["Count one-thousand at the bottom before you stand up"],
    tempo: ["Count two seconds on the way down: one-thousand, two-thousand"],
    lockout: ["At the top, squeeze your glutes like you're cracking a walnut"],
  },
  "Push-up": {
    depth: ["Lower until your chest is a fist's height from the floor"],
    sag: ["Squeeze your glutes and pull your belly button to your spine"],
    pike: ["Push your hips down until your body is one plank of wood"],
    head: ["Look at a spot just ahead of your hands, not at your feet"],
    tempo: ["Two seconds down, pause, then push the floor away"],
  },
  "Lunge": {
    shallow: ["Drop the back knee straight down until it almost kisses the floor"],
    tooDeep: ["Stop when the back knee is a few centimetres off the floor"],
    lean: ["Stack your shoulders over your hips, like a string pulling your head up"],
    kneeTravel: ["Take a longer step so the front shin stays upright"],
  },
  "Plank": {
    sag: ["Squeeze your glutes hard and tuck your tailbone under"],
    pike: ["Lower your hips until they line up with your shoulders and heels"],
    head: ["Look at the floor just in front of your hands"],
    drift: ["Freeze. Imagine a glass of water balanced on your back"],
  },
  "Jumping Jack": {
    extension: ["Clap your hands right above your head on every jump"],
    feet: ["Land with your feet wider than your shoulders, like a big X"],
  },
};

export const FIXED = {
  "Squat":   { depth: "that one hit parallel", lean: "your chest stayed up", kneeTravel: "hips went back first", bounce: "nice control at the bottom", tempo: "much better tempo", lockout: "full lockout" },
  "Push-up": { depth: "your chest got low", sag: "hips stayed in line", pike: "nice straight line", head: "head stayed neutral", tempo: "good controlled tempo" },
  "Lunge":   { shallow: "good depth on that one", tooDeep: "nice controlled depth", lean: "torso stayed tall", kneeTravel: "front shin stayed upright" },
  "Plank":   { sag: "hips are back in line", pike: "hips came down, nice line", head: "head's neutral now", drift: "rock steady now" },
  "Jumping Jack": { extension: "hands all the way up", feet: "feet nice and wide" },
};

export const FOCUS = {
  "Squat":   { depth: "sitting lower, thighs to parallel", lean: "keeping your chest up", kneeTravel: "sending your hips back first", bounce: "pausing at the bottom", tempo: "a slower way down", lockout: "standing all the way up" },
  "Push-up": { depth: "getting your chest lower", sag: "keeping your hips up", pike: "keeping your hips down", head: "keeping your head neutral", tempo: "slowing the reps down" },
  "Lunge":   { shallow: "dropping the back knee lower", tooDeep: "controlling the depth", lean: "staying upright", kneeTravel: "a longer step" },
  "Plank":   { sag: "keeping your hips up", pike: "keeping your hips level", head: "a neutral neck", drift: "holding still" },
  "Jumping Jack": { extension: "getting your hands all the way up", feet: "jumping your feet wider" },
};

/** Personality-flavoured lines for the smarter coach. `{x}` is filled in. */
export const COACH_LINES = {
  reinforce: { Chill: ["Better, {x}.", "Nice, {x}."], Hype: ["YES! {x}!", "There it is, {x}!"], Coach: ["Good. {x}.", "Better. {x}. Again."] },
  groove:    { Chill: ["Three clean reps in a row. That's your groove."], Hype: ["Three clean in a row! You're locked in!"], Coach: ["Three clean reps straight. That's the groove. Keep it."] },
  fatigue:   { Chill: ["Depth is dropping, you're getting tired. Stay deep."], Hype: ["Don't let the depth slip now, dig in!"], Coach: ["Your depth is fading. Fatigue. Keep the standard."] },
  rushing:   { Chill: ["Tempo's speeding up. Slow it back down."], Hype: ["Easy, slow it down, control wins!"], Coach: ["You're rushing. Control the tempo."] },
  rest:      { Chill: ["Take a breath. Go when you're ready."], Hype: ["Shake it out, then let's go again!"], Coach: ["Rest. Clock's paused. Go when ready."] },
  briefFix:  { Chill: ["Last time your most common issue was {x}. Focus on {y}."], Hype: ["Last time {x} held you back. Today, {y}!"], Coach: ["Last session: {x}. Today, focus on {y}."] },
  briefGood: { Chill: ["Last time was clean. Same again."], Hype: ["Last time was clean, let's beat it!"], Coach: ["Last session was clean. Match it."] },
  summaryFix:{ Chill: ["Next time, focus on {y}."], Hype: ["Next time: {y}, and you'll fly!"], Coach: ["Next session: {y}."] },
};
