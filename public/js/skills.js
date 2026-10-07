/**
 * skills.js — the skill path: four ladders (Push, Pull, Legs, Core) that
 * build toward calisthenics skills like the L-sit and the pull-up.
 *
 * Pure logic, no DOM (unit-tested in tests/skills.test.mjs). A step unlocks
 * from real saved sets (storage.js `sessions`), never from a guess:
 *   - "set" steps need one set of at least N reps averaging X or more;
 *   - "hold" steps need one hold of at least N seconds averaging X or more.
 * Steps without a `test` need a tracker that doesn't exist yet (see the
 * "Skill path trackers" plan in TODO.md); they show as "planned".
 *
 * A path is walked in order: a step can only unlock once the one before it
 * has. Unlocked ids are kept (store.skills), so trimming old history never
 * takes a skill away.
 */

const set = (exercise, reps, avg) => ({ kind: "set", exercise, reps, avg });
const hold = (exercise, seconds, avg) => ({ kind: "hold", exercise, seconds, avg });

export const PATHS = [
  {
    id: "push", name: "Push",
    steps: [
      { id: "pushup",        name: "Push-up",           goal: "10 push-ups in one set, average 80+",        test: set("Push-up", 10, 80) },
      { id: "pushup_clean",  name: "Clean push-ups",    goal: "15 push-ups in one set, average 90+",        test: set("Push-up", 15, 90) },
      { id: "diamond",       name: "Diamond push-up",   goal: "10 with hands together under the chest" },
      { id: "pike",          name: "Pike push-up",      goal: "8 with hips high, head toward the floor" },
      { id: "hspu",          name: "Handstand push-up", goal: "3 against a wall, full range" },
    ],
  },
  {
    id: "pull", name: "Pull",
    steps: [
      { id: "dead_hang",     name: "Dead hang",         goal: "Hang from a bar for 30 s, shoulders active" },
      { id: "negative",      name: "Negative pull-up",  goal: "5 slow lowers from chin over the bar, 3 s each" },
      { id: "pullup",        name: "Pull-up",           goal: "1 pull-up from a dead hang, chin over the bar" },
      { id: "pullup_10",     name: "10 pull-ups",       goal: "10 in one set, full range" },
      { id: "muscle_up",     name: "Muscle-up",         goal: "1 from a hang to straight arms above the bar" },
    ],
  },
  {
    id: "legs", name: "Legs",
    steps: [
      { id: "squat",         name: "Bodyweight squat",  goal: "10 squats in one set, average 80+",          test: set("Squat", 10, 80) },
      { id: "squat_deep",    name: "Full-depth squat",  goal: "15 squats in one set, average 90+",          test: set("Squat", 15, 90) },
      { id: "lunge",         name: "Lunge",             goal: "10 lunges in one set, average 85+",          test: set("Lunge", 10, 85) },
      { id: "pistol",        name: "Pistol squat",      goal: "1 per leg, heel down, other leg off the floor" },
    ],
  },
  {
    id: "core", name: "Core",
    steps: [
      { id: "plank",         name: "Plank",             goal: "Hold 30 s, average 80+",                     test: hold("Plank", 30, 80) },
      { id: "plank_solid",   name: "Solid plank",       goal: "Hold 60 s, average 90+",                     test: hold("Plank", 60, 90) },
      { id: "hollow",        name: "Hollow hold",       goal: "Hold 30 s, lower back on the floor" },
      { id: "l_sit",         name: "L-sit",             goal: "Hold 10 s, legs straight and level" },
      { id: "v_sit",         name: "V-sit",             goal: "Hold 5 s, legs above level" },
    ],
  },
];

/** Seconds held in a saved hold. Older saves lack heldS: each scored stretch is 5 s. */
export const heldSeconds = (s) => s.heldS ?? (s.reps?.length ?? 0) * 5;

/** How much of a step's goal one saved set reaches, per part (each 0..1). */
function reach(test, s) {
  const amount = test.kind === "hold" ? heldSeconds(s) / test.seconds : (s.reps?.length ?? 0) / test.reps;
  return { amount: Math.min(1, amount), quality: Math.min(1, (s.average ?? 0) / test.avg) };
}

const passes = (test, s) => {
  const r = reach(test, s);
  return s.exercise === test.exercise && r.amount >= 1 && r.quality >= 1;
};

/** The saved set that came closest to a step's goal (or null if none of that exercise). */
function closest(test, sessions) {
  let best = null, bestFit = -1;
  for (const s of sessions) {
    if (s.exercise !== test.exercise) continue;
    const r = reach(test, s);
    const fit = r.amount + r.quality;
    if (fit > bestFit) { bestFit = fit; best = s; }
  }
  if (!best) return null;
  const amount = test.kind === "hold" ? `${heldSeconds(best)} s` : `${best.reps.length} rep${best.reps.length === 1 ? "" : "s"}`;
  return `${amount}, average ${best.average}`;
}

/**
 * Every path with each step's status:
 *   "done"    unlocked (now or before);
 *   "next"    the first step not yet done, with `closest` = your best try;
 *   "locked"  comes after a step that isn't done yet;
 *   "planned" needs a tracker that isn't built yet.
 */
export function skillPath(sessions = [], kept = []) {
  const have = new Set(kept);
  return PATHS.map((path) => {
    let open = true;          // every step so far is done
    const steps = path.steps.map((step) => {
      if (!step.test) { open = false; return { ...step, status: "planned" }; }
      const done = open && (have.has(step.id) || sessions.some((s) => passes(step.test, s)));
      if (done) return { ...step, status: "done" };
      if (!open) return { ...step, status: "locked" };
      open = false;
      return { ...step, status: "next", closest: closest(step.test, sessions) };
    });
    return { ...path, steps, done: steps.filter((s) => s.status === "done").length };
  });
}

/** Ids of steps that are done now but weren't in `kept`, in path order. */
export function newSkills(sessions, kept = []) {
  const have = new Set(kept);
  return skillPath(sessions, kept).flatMap((p) => p.steps)
    .filter((s) => s.status === "done" && !have.has(s.id)).map((s) => s.id);
}

export const skillName = (id) => PATHS.flatMap((p) => p.steps).find((s) => s.id === id)?.name ?? id;
