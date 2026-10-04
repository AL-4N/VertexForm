/**
 * coach.test.mjs — the smarter coach (js/coach.js): impact-first cues,
 * escalation, reinforcement, trends, briefing and the post-set summary.
 * Run with:  npm test
 */
import { Coach, nextTarget, topFault } from "../public/js/coach.js";
import { getExercise } from "../public/js/exercises/index.js";
import { CONCRETE, FIXED } from "../public/js/coaching.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(54)} ${detail}`);
};

const squat = getExercise("Squat");
const seeded = () => { let i = 0; return () => ((i++ * 0.37) % 1); };
const mk = (opts) => new Coach(squat, { personality: "Chill", chattiness: "normal", target: 90, random: seeded(), ...opts });

/** A squat rep from measurements, graded and fault-checked by the real exercise module. */
function rep(depthDeg, lean, extra = {}) {
  const measures = { knee: 90, lean, depthDeg, kneeTravel: 0.3, hipY: 0.6 };
  const score = squat.grade(measures, []).score;
  return { score, measures, faults: squat.detectFaults({ ...measures, ...extra }), duration: extra.duration ?? 2, ...extra };
}

console.log("Impact-first cues");
{
  // Depth 16° high is MORE severe (3) but worth fewer points (11) than a 41° lean (severity 2, 12 points).
  const r = rep(16, 41);
  const c = mk();
  const ranked = c.rankByImpact(r);
  check("Severity says depth, impact says lean", r.faults[0].key === "depth" && ranked[0].key === "lean",
        ranked.map((f) => `${f.key}:+${f.gain.toFixed(1)}`).join(" "));
  const line = c.onRep(r)[0].text;
  check("The spoken cue is about the bigger win (lean)", /chest|fold|torso|lean|upright/i.test(line), line);
  check("Faults outside the score still rank (by severity)", mk().rankByImpact(rep(0, 20, { duration: 0.6 })).some((f) => f.key === "tempo"));
}

console.log("\nEscalation and repetition");
{
  const c = mk();
  const lines = [1, 2, 3, 4].map(() => c.onRep(rep(25, 20))[0].text);
  check("Same fault twice: rephrased, not repeated", lines[0] !== lines[1], `${lines[0]} | ${lines[1]}`);
  check("Third time: a concrete physical cue", CONCRETE.Squat.depth.some((p) => lines[2].includes(p)), lines[2]);
  check("No line is identical to the one before it", lines.every((l, i) => i === 0 || l !== lines[i - 1]));
  const q = mk({ chattiness: "quiet" });
  const a = q.onRep(rep(0, 20))[0].text, b = q.onRep(rep(0, 20))[0].text;
  check("Quiet mode: score only, still never identical twice", /^\d+\.$/.test(a) && a !== b, `${a} | ${b}`);
}

console.log("\nPositive reinforcement");
{
  const c = mk();
  c.onRep(rep(25, 20));                        // half squat: depth fault
  const line = c.onRep(rep(0, 20))[0].text;    // fixed it
  check("Fault fixed: says what got better", line.includes(FIXED.Squat.depth), line);
  const c2 = mk();
  c2.onRep(rep(25, 20));
  const l2 = c2.onRep(rep(0, 40))[0].text;     // depth fixed, now leaning
  check("Fixed one thing, new fault: praise + the next cue", l2.includes(FIXED.Squat.depth) && /chest|torso|upright|lean|fold/i.test(l2), l2);
}

console.log("\nTrends across the set");
{
  const c = mk({ chattiness: "detailed" });
  const out = [rep(-2, 20), rep(-3, 20), rep(-2, 20), rep(6, 20), rep(9, 20)].map((r) => c.onRep(r));
  check("Depth fading over the set: fatigue line", out.flat().some((l) => l.kind === "trend" && /depth|tired|slip|fading/i.test(l.text)),
        out.flat().filter((l) => l.kind === "trend").map((l) => l.text).join(" | "));
  const c2 = mk({ chattiness: "detailed" });
  const o2 = [2.2, 2.1, 2.2, 1.3, 1.2].map((d) => c2.onRep(rep(-2, 20, { duration: d })));
  check("Reps speeding up: rushing line", o2.flat().some((l) => l.kind === "trend" && /tempo|slow|rush/i.test(l.text)));
  const c3 = mk();
  const g = [1, 2, 3, 4].map(() => c3.onRep(rep(-2, 20))[0].text);
  check("Three clean reps: 'that's your groove' (once)", /groove/i.test(g[2]) && !/groove/i.test(g[3]), g[2]);
  const c4 = mk();
  const o4 = [rep(-2, 20), rep(-3, 20), rep(-2, 20), rep(6, 20), rep(9, 20)].map((r) => c4.onRep(r));
  check("Normal chattiness: no trend lines", !o4.flat().some((l) => l.kind === "trend"));
}

console.log("\nBriefing and summary");
{
  const b = mk().briefing({ reps: [70, 72], faults: { depth: 2, lean: 1 } });
  check("Briefing: last time's top issue + what to focus on", /depth/i.test(b) && /sitting lower/i.test(b), b);
  check("Briefing after a clean session", /clean/i.test(mk().briefing({ reps: [95], faults: {} })));
  check("No history: no briefing", mk().briefing(null) === null);
  check("Quiet: no briefing", mk({ chattiness: "quiet" }).briefing({ reps: [70], faults: { depth: 1 } }) === null);

  const reps = [rep(16, 41), rep(16, 41), rep(2, 20), rep(16, 41), rep(0, 22)];
  const res = {
    reps: reps.map((r) => r.score), best: Math.max(...reps.map((r) => r.score)), average: 80, isHold: false,
    bars: [{ label: "Depth", value: 85 }, { label: "Posture", value: 78 }, { label: "Control", value: 97 }],
    details: reps.map((r) => ({ score: r.score, measures: r.measures, faults: r.faults.map((f) => f.key) })),
  };
  const s = mk().summary(res);
  check("Summary: strengths from strong components", s.strengths.some((x) => /Control/.test(x)), s.strengths.join(" | "));
  check("Summary: #1 fix is the one costing the most points", s.fix?.key === "lean", JSON.stringify(s.fix));
  check("Summary: a concrete target", /^Next time: hit \d+\+ on \d of 5 reps$/.test(s.target), s.target);
  check("Summary: spoken version names the fix", /chest/i.test(s.spoken), s.spoken);
}

console.log("\nTargets");
check("Median 72 → hit 75+ on one more rep", nextTarget([70, 72, 74, 76, 60]) === "Next time: hit 75+ on 2 of 5 reps", nextTarget([70, 72, 74, 76, 60]));
check("All 95+ → keep it and add reps", /keep every one at 95\+/.test(nextTarget([96, 97, 99])));
check("Never asks for more reps than the set had", nextTarget([90, 91, 92]) === "Next time: hit 95+ on 1 of 3 reps", nextTarget([90, 91, 92]));
check("Most frequent fault wins, ties go to severity", topFault({ tempo: 2, depth: 2 }, "Squat") === "depth");

console.log(`\n${fail ? `${fail} coach check(s) FAILED` : "All coach checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
