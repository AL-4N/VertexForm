/**
 * storage.test.mjs — saved data from older versions still loads
 * (js/storage.js migrate), and new session records. Run with:  npm test
 */
import { migrate, VERSION, recordSession, lastSession, store } from "../public/js/storage.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(54)} ${detail}`);
};

// Exactly what the previous version wrote to localStorage.
const V1 = {
  bests: { Squat: 96, "Push-up": 88 },
  history: { Squat: [72, 85, 96], "Push-up": [88] },
  stats: { totalReps: 42, goodReps: 17, tried: ["Squat", "Push-up"] },
  unlocked: ["first_rep", "first_a"],
  days: ["2026-09-30", "2026-10-01"],
  settings: { target: 80, personality: "Hype", voice: false, camera: "abc123", cameraLabel: "FaceTime HD Camera" },
};

const m = migrate(structuredClone(V1));
check("v1 data: bests, stats, achievements, days kept", m.bests.Squat === 96 && m.stats.totalReps === 42 && m.unlocked.length === 2 && m.days.length === 2);
check("v1 data: settings (incl. saved camera) kept", m.settings.personality === "Hype" && m.settings.camera === "abc123" && m.settings.voice === false);
check("v1 data: score history kept as-is", JSON.stringify(m.history) === JSON.stringify(V1.history));
check("v1 → v2: old scores become undated sessions", m.sessions.length === 4 && m.sessions.every((s) => s.date === null && s.legacy), `${m.sessions.length} sessions`);
check("v1 → v2: routines list added, version set", Array.isArray(m.routines) && m.version === VERSION);
check("Migrating again doesn't duplicate anything", migrate(structuredClone(m)).sessions.length === 4);
check("Corrupt data: falls back to a blank store", migrate("nonsense").sessions.length === 0 && migrate(null).bests && migrate(null).version === VERSION);
check("Partial v1 data (no stats): filled in", migrate({ bests: { Plank: 90 } }).stats.totalReps === 0);
check("Older saves: no challenge, empty challenge log; a saved one survives", m.challenge === null && Array.isArray(m.challengeLog) && migrate({ version: 2, challenge: { id: "plank7", start: "2026-10-01" } }).challenge?.id === "plank7" && migrate({ challenge: "junk" }).challenge === null);
check("Older saves get an empty skills list; kept skills survive", Array.isArray(m.skills) && !m.skills.length && migrate({ version: 2, skills: ["squat"] }).skills[0] === "squat");

recordSession({ exercise: "Squat", mode: "set", best: 91, average: 85, reps: [80, 85, 91], faults: ["depth", "depth", "lean"], activeSeconds: 31 }, new Date("2026-10-04T10:00:00Z"));
const last = lastSession("Squat");
check("New sessions record date, scores and fault counts", last?.date === "2026-10-04T10:00:00.000Z" && last.faults.depth === 2 && last.faults.lean === 1 && last.activeS === 31, JSON.stringify(last));
recordSession({ exercise: "Plank", mode: "set", best: 95, average: 92, reps: [90, 95, 92], faults: [], isHold: true, durations: [5, 5, 5.4] });
check("Holds record the seconds held", lastSession("Plank")?.heldS === 15 && lastSession("Squat").heldS === null);
check("lastSession finds the latest of that exercise only", lastSession("Lunge") === null && store.sessions.length >= 2);

console.log(`\n${fail ? `${fail} storage check(s) FAILED` : "All storage checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
