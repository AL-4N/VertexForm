/**
 * circuit.test.mjs — workout builder + runner (js/circuit.js), the rest
 * timer's spoken countdown (js/rest.js), and history / CSV export
 * (js/history.js). Run with:  npm test
 */
import {
  CircuitRunner, saveRoutine, deleteRoutine, validateRoutine, normalizeStep, stepSession, describeStep, MAX_ROUTINES,
} from "../public/js/circuit.js";
import { restCue, mmss } from "../public/js/rest.js";
import { toCSV, csvField, exerciseHistory, faultTrends } from "../public/js/history.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(54)} ${detail}`);
};

console.log("Routines");
const legs = { name: "Legs", rest: 60, steps: [{ exercise: "Squat", amount: 10 }, { exercise: "Lunge", amount: 8 }, { exercise: "Plank", amount: 45 }] };
check("A sensible routine is valid", validateRoutine(legs).ok);
check("No name: friendly error", validateRoutine({ ...legs, name: " " }).error === "Give the routine a name.");
check("No exercises: friendly error", /at least one/.test(validateRoutine({ ...legs, steps: [] }).error));
check("Plank under 10 s rejected", /10–300 seconds/.test(validateRoutine({ ...legs, steps: [{ exercise: "Plank", amount: 5 }] }).error));
check("Unknown exercise rejected", /Unknown/.test(validateRoutine({ ...legs, steps: [{ exercise: "Burpee", amount: 5 }] }).error));
check("Odd rest time rejected", !validateRoutine({ ...legs, rest: 45 }).ok);
check("Amounts clamp to sensible limits", normalizeStep({ exercise: "Squat", amount: 500 }).amount === 50 && normalizeStep({ exercise: "Plank", amount: 2 }).amount === 10);

let list = [];
({ list } = saveRoutine(list, legs));
({ list } = saveRoutine(list, { ...legs, name: "Push" }));
({ list } = saveRoutine(list, { ...legs, name: "Core" }));
const full = saveRoutine(list, { ...legs, name: "Fourth" });
check(`Up to ${MAX_ROUTINES} routines; the 4th explains why not`, list.length === 3 && /Delete one first/.test(full.error), full.error);
const upd = saveRoutine(list, { ...legs, name: "legs", rest: 30 });
check("Same name (any case) updates instead of adding", upd.list.length === 3 && upd.list[0].rest === 30 && !upd.error);
check("Delete removes by name", deleteRoutine(list, "Push").map((r) => r.name).join() === "Legs,Core");

console.log("\nRunning a circuit");
const run = new CircuitRunner(legs);
check("Starts on step 1", run.current.exercise === "Squat" && run.progress === "1 of 3" && !run.done);
check("Rep steps run as an N-rep set", JSON.stringify(stepSession(run.current)) === JSON.stringify({ mode: "set", setReps: 10 }));
check("Plank step runs as a timed hold", stepSession(run.steps[2]).holdSeconds === 45);
run.record({ best: 92, average: 88, repCount: 10 });
check("Records and moves on", run.current.exercise === "Lunge" && run.next.exercise === "Plank");
run.record(null);                       // backed out of the lunge
run.record({ best: 97, average: 95, repCount: 8 });
const sum = run.summary();
check("Done after the last step", run.done && run.current === null);
check("Summary marks skipped steps", sum[1].done === false && sum[0].best === 92 && sum[2].step === "Plank × 45 s", JSON.stringify(sum[2]));
check("Step labels read naturally", describeStep({ exercise: "Squat", amount: 10, unit: "reps" }) === "Squat × 10");

console.log("\nRest timer");
const cues = [];
for (let s = 60; s >= 0; s--) { const c = restCue(s + 1, s, 60, false); if (c) cues.push(c); }
check("60 s rest: 30, 10, 3-2-1, then 'tap Next set'", cues.join(" | ") === "Thirty seconds left. | Ten seconds. | 3 | 2 | 1 | Rest's over. Tap Next set when you're ready.", cues.join(" | "));
const autoCues = [];
for (let s = 15; s >= 0; s--) { const c = restCue(s + 1, s, 15, true); if (c) autoCues.push(c); }
check("Short circuit rest: just 3-2-1, Go!", autoCues.join(" ") === "3 2 1 Go!", autoCues.join(" "));
check("Clock text", mmss(65) === "1:05" && mmss(59.4) === "1:00" && mmss(0) === "0:00" && mmss(-3) === "0:00");

console.log("\nHistory and CSV");
const sessions = [
  { date: null, exercise: "Squat", best: 70, average: 70, reps: [70], faults: {}, legacy: true },
  ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-09-${10 + i}T10:00:00.000Z`, exercise: "Squat", mode: "set", best: 80 + i, average: 75 + i, reps: [1, 2, 3, 4, 5], faults: { depth: 4 }, activeS: 30 })),
  ...Array.from({ length: 5 }, (_, i) => ({ date: `2026-10-0${1 + i}T10:00:00.000Z`, exercise: "Squat", mode: "set", best: 90 + i, average: 88, reps: [1, 2, 3, 4, 5], faults: { depth: 1, lean: 2 }, activeS: 30 })),
  { date: "2026-10-04T10:00:00.000Z", exercise: "Plank", mode: "set", best: 99, average: 97, reps: [97, 99], faults: {}, activeS: 30 },
];
const h = exerciseHistory(sessions, "Squat");
check("Per-exercise: best, average, count", h.best === 94 && h.count === 12 && h.points.length === 12, `best ${h.best} avg ${h.average} n ${h.count}`);
const depth = h.faults.find((f) => f.key === "depth");
check("Faults over time: depth is getting rarer", depth?.trend === "better", JSON.stringify(depth));
check("Most common fault listed first", h.faults[0].key === "depth");
check("A fault only seen lately is 'worse'", faultTrends(sessions.filter((s) => s.exercise === "Squat")).find((f) => f.key === "lean")?.trend === "worse");

const csv = toCSV(sessions);
const lines = csv.trim().split("\r\n");
check("CSV: header + one row per set", lines.length === sessions.length + 1 && lines[0] === "date,exercise,mode,best,average,reps,rep_scores,faults,active_seconds");
check("CSV: faults and scores in readable columns", lines.at(-2).includes("depth:1; lean:2") && lines.at(-1).startsWith("2026-10-04T10:00:00.000Z,Plank,set,99,97,2,97 99,,30"), lines.at(-1));
check("CSV: commas and quotes are escaped", csvField('Legs, "heavy"') === '"Legs, ""heavy"""' && csvField(5) === "5" && csvField(null) === "");

console.log(`\n${fail ? `${fail} circuit/history check(s) FAILED` : "All circuit, rest and history checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
