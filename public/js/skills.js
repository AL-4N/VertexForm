/**
 * skills.js — the skill tree: four paths (Push, Pull, Legs, Core) that build
 * toward calisthenics skills like the L-sit and the pull-up.
 *
 * Pure logic, no DOM (unit-tested in tests/skills.test.mjs). A skill unlocks
 * from real saved sets (storage.js `sessions`), never from a guess:
 *   - "set" skills need one set of at least N reps averaging X or more;
 *   - "hold" skills need one hold of at least N seconds averaging X or more.
 * Skills without a `test` need a tracker that doesn't exist yet (see the
 * "Skill path trackers" plan in TODO.md); they show as "planned".
 *
 * `requires` lists prerequisites (any path): a skill can only unlock once
 * all of them have. Unlocked ids are kept (store.skills), so trimming old
 * history never takes a skill away.
 */

const set = (exercise, reps, avg) => ({ kind: "set", exercise, reps, avg });
const hold = (exercise, seconds, avg) => ({ kind: "hold", exercise, seconds, avg });

export const PATHS = [
  {
    id: "push", name: "Push", goal: "Handstand push-up",
    steps: [
      { id: "pushup",        name: "Push-up",           requires: [],                      goal: "10 push-ups in one set, average 80+",        test: set("Push-up", 10, 80) },
      { id: "pushup_clean",  name: "Clean push-ups",    requires: ["pushup"],              goal: "15 push-ups in one set, average 90+",        test: set("Push-up", 15, 90) },
      { id: "diamond",       name: "Diamond push-up",   requires: ["pushup_clean"],        goal: "10 with hands together under the chest" },
      { id: "dips",          name: "Dips",              requires: ["pushup_clean"],        goal: "5 on parallel bars, shoulders below elbows" },
      { id: "pike",          name: "Pike push-up",      requires: ["pushup_clean"],        goal: "8 with hips high, head toward the floor" },
      { id: "hspu",          name: "Handstand push-up", requires: ["pike", "dips"],        goal: "3 against a wall, full range" },
    ],
  },
  {
    id: "pull", name: "Pull", goal: "Muscle-up",
    steps: [
      { id: "dead_hang",     name: "Dead hang",         requires: [],                      goal: "Hang from a bar for 30 s, shoulders active" },
      { id: "negative",      name: "Negative pull-up",  requires: ["dead_hang"],           goal: "5 slow lowers from chin over the bar, 3 s each" },
      { id: "pullup",        name: "Pull-up",           requires: ["negative"],            goal: "1 pull-up from a dead hang, chin over the bar" },
      { id: "pullup_10",     name: "10 pull-ups",       requires: ["pullup"],              goal: "10 in one set, full range" },
      { id: "muscle_up",     name: "Muscle-up",         requires: ["pullup_10", "dips"],   goal: "1 from a hang to straight arms above the bar" },
    ],
  },
  {
    id: "legs", name: "Legs", goal: "Pistol squat",
    steps: [
      { id: "squat",         name: "Bodyweight squat",  requires: [],                      goal: "10 squats in one set, average 80+",          test: set("Squat", 10, 80) },
      { id: "squat_deep",    name: "Full-depth squat",  requires: ["squat"],               goal: "15 squats in one set, average 90+",          test: set("Squat", 15, 90) },
      { id: "lunge",         name: "Lunge",             requires: ["squat"],               goal: "10 lunges in one set, average 85+",          test: set("Lunge", 10, 85) },
      { id: "pistol",        name: "Pistol squat",      requires: ["squat_deep", "lunge"], goal: "1 per leg, heel down, other leg off the floor" },
    ],
  },
  {
    id: "core", name: "Core", goal: "V-sit",
    steps: [
      { id: "plank",         name: "Plank",             requires: [],                      goal: "Hold 30 s, average 80+",                     test: hold("Plank", 30, 80) },
      { id: "plank_solid",   name: "Solid plank",       requires: ["plank"],               goal: "Hold 60 s, average 90+",                     test: hold("Plank", 60, 90) },
      { id: "hollow",        name: "Hollow hold",       requires: ["plank_solid"],         goal: "Hold 30 s, lower back on the floor" },
      { id: "l_sit",         name: "L-sit",             requires: ["hollow", "dips"],      goal: "Hold 10 s, legs straight and level" },
      { id: "v_sit",         name: "V-sit",             requires: ["l_sit"],               goal: "Hold 5 s, legs above level" },
    ],
  },
];

const STEPS = PATHS.flatMap((p) => p.steps.map((s) => ({ ...s, path: p.id })));
export const STEP_BY_ID = Object.fromEntries(STEPS.map((s) => [s.id, s]));

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
 * Every path with each skill's status:
 *   "done"    unlocked (now or before);
 *   "next"    every prerequisite is done, not unlocked yet; `closest` = your
 *             best real try (or null);
 *   "locked"  a prerequisite isn't done yet;
 *   "planned" needs a tracker that isn't built yet.
 * `ready` = every prerequisite is done. Each skill also gets `tier` (1 = no prerequisites; else one more than its
 * deepest prerequisite in the same path) for drawing the tree top-down.
 */
export function skillPath(sessions = [], kept = []) {
  const have = new Set(kept);
  const status = {};
  const statusOf = (id) => {
    if (status[id]) return status[id];
    const step = STEP_BY_ID[id];
    const ready = step.requires.every((r) => statusOf(r) === "done");
    // A kept unlock stays unlocked even if the rules around it change.
    status[id] = !step.test ? "planned"
      : have.has(id) || (ready && sessions.some((s) => passes(step.test, s))) ? "done"
      : ready ? "next" : "locked";
    return status[id];
  };
  const tiers = {};
  const tierOf = (id) => tiers[id] ??= 1 + Math.max(0, ...STEP_BY_ID[id].requires
    .filter((r) => STEP_BY_ID[r].path === STEP_BY_ID[id].path).map(tierOf));

  return PATHS.map((path) => {
    const steps = path.steps.map((step) => {
      const st = statusOf(step.id);
      return {
        ...step, path: path.id, status: st, tier: tierOf(step.id),
        ready: step.requires.every((r) => statusOf(r) === "done"),
        ...(st === "next" ? { closest: closest(step.test, sessions) } : {}),
      };
    });
    return { ...path, steps, done: steps.filter((s) => s.status === "done").length };
  });
}

/** Ids of skills that are done now but weren't in `kept`, in path order. */
export function newSkills(sessions, kept = []) {
  const have = new Set(kept);
  return skillPath(sessions, kept).flatMap((p) => p.steps)
    .filter((s) => s.status === "done" && !have.has(s.id)).map((s) => s.id);
}

export const skillName = (id) => STEP_BY_ID[id]?.name ?? id;
