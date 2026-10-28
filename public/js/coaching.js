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

export const EXERCISE_NAMES = ["Squat", "Push-up", "Plank", "Lunge", "Jumping Jack", "Pike push-up", "Side plank", "Hollow hold", "Mountain climber", "Dead hang"];
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
      "Deeper. Thighs to parallel",
      "Not quite parallel yet, sit down into it",
      "Half reps. Get the hips below the knee line",
    ]],
    lean: [3, "Chest up", [
      "You're folding forward, lift your chest",
      "Chest up, sit back into your heels",
      "Keep the torso tall, don't tip over your toes",
      "Proud chest. Hips back, not down and forward",
      "Too much lean. Think about staying upright",
    ]],
    kneeTravel: [2, "Knees back", [
      "Knees are drifting past your toes, push the hips back",
      "Load the hips more, keep the shins closer to vertical",
      "Sit back. Let the hips do the work, not the knees",
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
      "Deeper. Break ninety with the elbows",
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
      "You're piking. Straighten from shoulders to ankles",
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

  "Pike push-up": {
    depth: [3, "Depth", [
      "Lower your head toward the floor, between your hands",
      "Bend the elbows more, bring your head down",
      "Deeper. Head almost to the floor",
    ]],
    hipsLow: [3, "Hips high", [
      "Hips higher, make an upside-down V",
      "Your hips dropped. Pike them back up over your shoulders",
      "Walk your feet in and push the hips up",
    ]],
    tempo: [1, "Slow down", [
      "Slow down, lower your head with control",
      "Control it. Two seconds on the way down",
    ]],
  },

  "Side plank": {
    sag: [3, "Hips up", [
      "Your hips are sinking, lift them off the floor",
      "Push the floor away and raise your hips",
      "Hips up, into one line from head to feet",
    ]],
    pike: [2, "Hips down", [
      "Hips are too high, lower them into a straight line",
      "Lower the hips a little, head to heels in one line",
    ]],
    drift: [1, "Hold steady", [
      "Stay still, stack your feet and hold",
      "Steady. Keep the top hip stacked over the bottom one",
    ]],
  },

  "Mountain climber": {
    drive: [2, "Knee higher", [
      "Drive the knee higher, right up to your chest",
      "Bring the knee all the way in",
      "Bigger drives, knee toward your elbow",
    ]],
    sag: [3, "Hips up", [
      "Hips are sagging, brace your core",
      "Keep the hips level with your shoulders",
      "Don't let the hips drop as you drive",
    ]],
    pike: [2, "Hips down", [
      "Hips are popping up, keep them low",
      "Stay flat. Hips down, back in one line",
    ]],
  },

  "Hollow hold": {
    flat: [2, "Lift higher", [
      "Lift your shoulders and legs a little higher",
      "Curl up a bit more, shoulder blades off the floor",
    ]],
    folded: [2, "Stretch out", [
      "Lower your legs a little, stretch out long",
      "You're folding up. Reach the legs away from you",
    ]],
    drift: [1, "Hold still", [
      "Stay still, press your lower back into the floor",
      "Keep the shape. Breathe and hold it",
    ]],
  },

  "Dead hang": {
    bentArms: [3, "Straight arms", [
      "Straighten your arms all the way and hang",
      "Relax the elbows, hang from straight arms",
      "Let your body drop. Arms long",
    ]],
    drift: [1, "Hold still", [
      "You're swinging. Squeeze your legs together and settle",
      "Stop the swing, keep your body still under the bar",
    ]],
  },

  "Lunge": {
    shallow: [3, "Depth", [
      "Bend the front knee more, aim for ninety degrees",
      "Sink deeper into the lunge",
      "Drop the back knee toward the floor",
    ]],
    tooDeep: [1, "Ease up", [
      "That's very deep. Ease up a little if the knee complains",
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
      "Don't let gravity win. Hips back up",
    ]],
    pike: [2, "Hips down", [
      "Hips are too high, lower into one straight line",
      "Flatten out. Shoulders to ankles in one line",
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
      "Full range. Clap those hands up top",
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

/** How to get into each exercise's start position: shown on screen and said
 *  out loud when you're not in it yet. */
export const POSITION_CUES = {
  "Squat":             "Stand tall, side-on, to start",
  "Push-up":           "Get into the top of a push-up, side-on",
  "Plank":             "Get into your plank, side-on to the camera",
  "Lunge":             "Stand tall, side-on, to start",
  "Jumping Jack":      "Face the camera, arms by your sides",
  "Pike push-up":      "Hands and feet on the floor, hips high, side-on",
  "Side plank":        "Side plank on one forearm, chest to the camera",
  "Hollow hold":       "Lie on your back, side-on, then lift your shoulders and legs",
  "Mountain climber":  "High plank, side-on, then drive the near knee to your chest",
  "Dead hang":         "Hang from a bar, facing the camera, arms straight",
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
  "Pike push-up": {
    depth: ["Aim the top of your head at a spot just in front of your hands"],
    hipsLow: ["Walk your feet closer until your hips sit right over your shoulders"],
    tempo: ["Two seconds down, pause, then push the floor away"],
  },
  "Side plank": {
    sag: ["Press the bottom forearm into the floor and lift the bottom hip"],
    pike: ["Let the hips come down until shoulders, hips and ankles line up"],
    drift: ["Stack your feet, squeeze your glutes and breathe slowly"],
  },
  "Mountain climber": {
    drive: ["Try to touch your knee to your elbow on every drive"],
    sag: ["Squeeze your glutes and keep your shoulders right over your hands"],
    pike: ["Keep your back flat, like a tabletop, while the knees drive"],
  },
  "Hollow hold": {
    flat: ["Lift until your shoulder blades and your heels both clear the floor"],
    folded: ["Push your heels away from you until your legs are low and long"],
    drift: ["Press your lower back into the floor like you're squashing a grape"],
  },
  "Dead hang": {
    bentArms: ["Let your shoulders take the weight, elbows fully straight"],
    drift: ["Point your toes at the floor and squeeze your legs together"],
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
  "Pike push-up": { depth: "your head got right down", hipsLow: "hips stayed high", tempo: "good controlled tempo" },
  "Side plank":   { sag: "hips came back up", pike: "straight line now", drift: "steady now" },
  "Mountain climber": { drive: "knee came right in", sag: "hips stayed level", pike: "back stayed flat" },
  "Hollow hold":  { flat: "that's the hollow", folded: "legs are long now", drift: "rock steady now" },
  "Dead hang":    { bentArms: "arms are straight now", drift: "the swing has stopped" },
};

export const FOCUS = {
  "Squat":   { depth: "sitting lower, thighs to parallel", lean: "keeping your chest up", kneeTravel: "sending your hips back first", bounce: "pausing at the bottom", tempo: "a slower way down", lockout: "standing all the way up" },
  "Push-up": { depth: "getting your chest lower", sag: "keeping your hips up", pike: "keeping your hips down", head: "keeping your head neutral", tempo: "slowing the reps down" },
  "Lunge":   { shallow: "dropping the back knee lower", tooDeep: "controlling the depth", lean: "staying upright", kneeTravel: "a longer step" },
  "Plank":   { sag: "keeping your hips up", pike: "keeping your hips level", head: "a neutral neck", drift: "holding still" },
  "Jumping Jack": { extension: "getting your hands all the way up", feet: "jumping your feet wider" },
  "Pike push-up": { depth: "lowering your head closer to the floor", hipsLow: "keeping your hips high", tempo: "slowing the reps down" },
  "Side plank":   { sag: "lifting your hips", pike: "a straight line, head to heels", drift: "holding still" },
  "Mountain climber": { drive: "driving the knee higher", sag: "keeping your hips level", pike: "keeping your back flat" },
  "Hollow hold":  { flat: "lifting a little higher", folded: "stretching out long", drift: "holding the shape" },
  "Dead hang":    { bentArms: "hanging from straight arms", drift: "staying still under the bar" },
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
