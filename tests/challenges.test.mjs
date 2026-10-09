/**
 * challenges.test.mjs — daily challenges (js/challenges.js) count only real
 * saved sets that meet the goal, one per calendar day, end on a missed day,
 * and complete when every day is done. Run with:  npm test
 */
import { CHALLENGES, CHALLENGE_BY_ID, dayKey, addDays, meetsGoal, challengeStatus, todayJustDone } from "../public/js/challenges.js";
import { REGISTRY } from "../public/js/exercises/index.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(60)} ${detail}`);
};

/** A saved set at noon local time, `d` days after the start. */
const START = "2026-10-01";
const at = (d, h = 12) => { const [y, m, dd] = addDays(START, d).split("-").map(Number); return new Date(y, m - 1, dd, h); };
const set = (d, exercise, n, average, extra = {}) => ({ date: at(d).toISOString(), exercise, reps: Array(n).fill(average), average, ...extra });
const active = (id) => ({ id, start: START });

check("Every challenge uses an exercise the app can grade", CHALLENGES.every((c) => !c.test.exercise || REGISTRY[c.test.exercise]));
check("Ids are unique; every one has a name, length and goal", new Set(CHALLENGES.map((c) => c.id)).size === CHALLENGES.length && CHALLENGES.every((c) => c.name && c.days > 0 && c.goal));
check("Day keys: local dates, month rollover", dayKey(new Date(2026, 9, 1)) === "2026-10-01" && addDays("2026-10-31", 1) === "2026-11-01" && addDays("2026-12-31", 1) === "2027-01-01");

/* ── The goal ─────────────────────────────────────────── */
const sq = CHALLENGE_BY_ID.squat30.test;
check("10 squats at 80 meets the squat goal (edges count)", meetsGoal(sq, set(0, "Squat", 10, 80)));
check("9 reps, or an average of 79, doesn't", !meetsGoal(sq, set(0, "Squat", 9, 95)) && !meetsGoal(sq, set(0, "Squat", 20, 79)));
check("Another exercise doesn't count", !meetsGoal(sq, set(0, "Push-up", 20, 99)));
const pl = CHALLENGE_BY_ID.plank7.test;
check("Plank goal uses seconds held", meetsGoal(pl, set(0, "Plank", 3, 90, { heldS: 61 })) && !meetsGoal(pl, set(0, "Plank", 3, 90, { heldS: 45 })));
check("Older plank saves: 5 s per scored stretch", meetsGoal(pl, set(0, "Plank", 12, 85)));
check("'Clean week' takes any exercise", meetsGoal(CHALLENGE_BY_ID.clean7.test, set(0, "Lunge", 6, 92)));

/* ── Progress ─────────────────────────────────────────── */
let st = challengeStatus(active("squat30"), [], at(0));
check("Day 1 is the start day", st.day === 1 && st.days[0].state === "today" && st.days[1].state === "todo" && st.state === "active");
st = challengeStatus(active("squat30"), [set(0, "Squat", 10, 85), set(1, "Squat", 12, 90)], at(2));
check("Done days count; today waits", st.done === 2 && st.days[2].state === "today" && st.day === 3, `done ${st.done}, day ${st.day}`);
check("Two sets on one day count once", challengeStatus(active("squat30"), [set(0, "Squat", 10, 85), set(0, "Squat", 10, 95, { date: at(0, 18).toISOString() })], at(1)).done === 1);
st = challengeStatus(active("squat30"), [set(0, "Squat", 10, 85), set(2, "Squat", 10, 85)], at(2));
check("A missed day ends the run", st.state === "broken" && st.days[1].state === "missed");
check("A set that misses the goal doesn't save the day", challengeStatus(active("squat30"), [set(0, "Squat", 10, 70)], at(1)).state === "broken");
check("Sets before the start don't count", challengeStatus(active("squat30"), [set(-1, "Squat", 10, 99)], at(0)).done === 0);
const week = Array.from({ length: 7 }, (_, d) => set(d, "Plank", 3, 88, { heldS: 62 }));
st = challengeStatus(active("plank7"), week, at(6, 20));
check("Every day done: complete", st.state === "complete" && st.done === 7);
check("Undated old saves are ignored", challengeStatus(active("squat30"), [{ date: null, exercise: "Squat", reps: Array(20).fill(99), average: 99 }], at(0)).done === 0);
check("Unknown challenge: no status", challengeStatus({ id: "nope", start: START }, []) === null);

/* ── "Day done" note ──────────────────────────────────── */
const s1 = set(0, "Squat", 10, 85), s2 = set(0, "Squat", 11, 88, { date: at(0, 13).toISOString() });
check("Note only for the first set that meets today's goal", todayJustDone(active("squat30"), [s1], at(0, 14)) && !todayJustDone(active("squat30"), [s1, s2], at(0, 14)));
check("No note when the newest set misses the goal", !todayJustDone(active("squat30"), [set(0, "Squat", 10, 60)], at(0, 14)));

console.log(`\n${fail ? `${fail} challenge check(s) FAILED` : "All challenge checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
