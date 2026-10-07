/**
 * skills.test.mjs — the skill path (js/skills.js) unlocks steps only from
 * real saved sets, in order, and never loses one. Run with:  npm test
 */
import { PATHS, skillPath, newSkills, heldSeconds } from "../public/js/skills.js";
import { REGISTRY } from "../public/js/exercises/index.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} ${detail}`);
};

const reps = (n, score) => Array(n).fill(score);
const set = (exercise, n, average) => ({ exercise, reps: reps(n, average), average, best: average });
const step = (paths, id) => paths.flatMap((p) => p.steps).find((s) => s.id === id);

/* ── The paths themselves ─────────────────────────────── */
const all = PATHS.flatMap((p) => p.steps);
check("Four paths: Push, Pull, Legs, Core", PATHS.map((p) => p.name).join() === "Push,Pull,Legs,Core");
check("Step ids are unique", new Set(all.map((s) => s.id)).size === all.length);
check("Every tracked step uses an exercise the app can grade", all.filter((s) => s.test).every((s) => REGISTRY[s.test.exercise]));
check("Every step says what it takes", all.every((s) => s.name && s.goal));
check("In each path, untracked steps come after tracked ones",
  PATHS.every((p) => p.steps.findIndex((s) => !s.test) === -1 || p.steps.slice(p.steps.findIndex((s) => !s.test)).every((s) => !s.test)));
check("L-sit and pull-up are on the path", !!step(PATHS, "l_sit") && !!step(PATHS, "pullup"));

/* ── Statuses ─────────────────────────────────────────── */
let p = skillPath([]);
check("No history: first tracked steps are next", ["pushup", "squat", "plank"].every((id) => step(p, id).status === "next"));
check("No history: later tracked steps are locked", step(p, "pushup_clean").status === "locked" && step(p, "squat_deep").status === "locked");
check("Untracked steps show as planned", step(p, "l_sit").status === "planned" && step(p, "dead_hang").status === "planned");
check("No history: next step says there are no sets yet", step(p, "pushup").closest === null);

p = skillPath([set("Push-up", 10, 80)]);
check("10 push-ups at 80 unlocks Push-up (edges count)", step(p, "pushup").status === "done");
check("...and Clean push-ups becomes next", step(p, "pushup_clean").status === "next");
check("Closest try is reported from the real set", step(p, "pushup_clean").closest === "10 reps, average 80", step(p, "pushup_clean").closest);

p = skillPath([set("Push-up", 9, 99), set("Push-up", 20, 79)]);
check("Short set or low average doesn't unlock", step(p, "pushup").status === "next");
check("Closest try picks the nearer set (1 point short beats 1 rep short)", step(p, "pushup").closest === "20 reps, average 79", step(p, "pushup").closest);

p = skillPath([set("Push-up", 15, 93)]);
check("One great set unlocks both push-up steps", step(p, "pushup").status === "done" && step(p, "pushup_clean").status === "done");
check("After the tracked steps, the path waits on a tracker", step(p, "diamond").status === "planned");

p = skillPath([set("Lunge", 12, 95)]);
check("Steps unlock in order (lunge waits for squats)", step(p, "lunge").status === "locked");
p = skillPath([set("Lunge", 12, 95), set("Squat", 15, 96)]);
check("...and unlocks once the squats are done", step(p, "squat_deep").status === "done" && step(p, "lunge").status === "done");

check("Other exercises don't count toward a step", skillPath([set("Squat", 30, 99)]).every((x) => x.id === "legs" || x.done === 0));

/* ── Holds ────────────────────────────────────────────── */
const plank = (heldS, average) => ({ exercise: "Plank", reps: reps(Math.floor(heldS / 5), average), average, heldS });
check("Hold seconds: recorded value, else 5 s per stretch", heldSeconds({ heldS: 42, reps: [1] }) === 42 && heldSeconds({ reps: [1, 2, 3] }) === 15 && heldSeconds({ heldS: null, reps: [1, 2] }) === 10);
p = skillPath([plank(31, 85)]);
check("31 s plank at 85 unlocks Plank, not Solid plank", step(p, "plank").status === "done" && step(p, "plank_solid").status === "next");
check("Hold progress is shown in seconds", step(p, "plank_solid").closest === "31 s, average 85", step(p, "plank_solid").closest);
check("A 60 s plank at 90 unlocks Solid plank", step(skillPath([plank(60, 90)]), "plank_solid").status === "done");

/* ── Kept unlocks + new unlocks ───────────────────────── */
p = skillPath([], ["pushup", "pushup_clean"]);
check("Kept skills stay unlocked after history is trimmed", step(p, "pushup_clean").status === "done" && p.find((x) => x.id === "push").done === 2);
check("newSkills lists only fresh unlocks, in path order", JSON.stringify(newSkills([set("Push-up", 15, 92), set("Squat", 10, 85)], ["pushup"])) === JSON.stringify(["pushup_clean", "squat"]));
check("newSkills is empty when nothing changed", newSkills([set("Push-up", 15, 92)], ["pushup", "pushup_clean"]).length === 0);
check("Legacy one-score saves never unlock a set step", newSkills([{ exercise: "Squat", reps: [99], average: 99, legacy: true }]).length === 0);

console.log(`\n${fail ? `${fail} skill check(s) FAILED` : "All skill checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
