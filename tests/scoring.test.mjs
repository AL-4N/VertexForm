/**
 * scoring.test.mjs — calibration checks for js/scoring.js.
 *
 * Builds exact squat geometry, runs it through the same windowed pipeline the
 * app uses (bottom window → medians → component scores → weighted blend), and
 * checks each case lands in its intended band. Run with:  npm test
 */
import { scoreSquat, scorePushup, scorePlank, scoreLunge, scoreControl, combine } from "../public/js/scoring.js";
import { thighAngleDeg, leanFromVertical, median, bottomWindow } from "../public/js/geometry.js";
import { gradeColor } from "../public/js/grade.js";

let pass = 0, fail = 0;
const t = (name, val, lo, hi) => {
  const ok = val >= lo && val <= hi;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(40)} ${String(Math.round(val)).padStart(4)}   want ${lo}–${hi}`);
};

const L = (x, y) => ({ x, y, visibility: 1 });
function squatAt(depthDeg, leanDeg) {
  const knee = L(0.53, 0.70), r = (depthDeg * Math.PI) / 180, tl = (leanDeg * Math.PI) / 180;
  const hip = L(knee.x - 0.2 * Math.cos(r), knee.y - 0.2 * Math.sin(r));
  return { knee, hip, sh: L(hip.x + 0.3 * Math.sin(tl), hip.y - 0.3 * Math.cos(tl)) };
}
function simSquat(bottomDepth, bottomLean, n = 40) {
  const hipY = [], ds = [], ls = [];
  for (let i = 0; i < n; i++) {
    const p = Math.sin((Math.PI * i) / (n - 1));
    const g = squatAt(70 * (1 - p) + bottomDepth * p, 5 * (1 - p) + bottomLean * p);
    hipY.push(g.hip.y); ds.push(thighAngleDeg(g.hip, g.knee)); ls.push(leanFromVertical(g.sh, g.hip));
  }
  const w = bottomWindow(hipY, "max", 0.02);
  const { depth, posture } = scoreSquat(median(w.map((i) => ds[i])), median(w.map((i) => ls[i])));
  return combine([[depth, 0.45], [posture, 0.35], [scoreControl(w.map((i) => hipY[i])), 0.20]]);
}
const two = (pair, a = 0.55, b = 0.45) => combine([[Object.values(pair)[0], a], [Object.values(pair)[1], b]]);

console.log("Squat (full windowed pipeline)");
t("Parallel, 20° lean",            simSquat(0, 20),  95, 100);
t("Below parallel, 25° lean",      simSquat(-8, 25), 95, 100);
t("Slightly high (8°)",            simSquat(8, 22),  88, 100);
t("Half squat (25° above)",        simSquat(25, 25), 55, 82);
t("Quarter squat (45° above)",     simSquat(45, 20), 35, 62);
t("Parallel but folded over 45°",  simSquat(0, 45),  70, 90);

console.log("\nOther exercises");
t("Lunge: knee 90°, lean 10°",      two(scoreLunge(90, 10)),   100, 100);
t("Lunge: standing straight",       two(scoreLunge(175, 2)),     0,  55);
t("Push-up: elbow 88°, line 7°",    two(scorePushup(88, 7)),   100, 100);
t("Push-up: shallow and saggy",     two(scorePushup(110, 15)),  55,  80);
t("Plank: level (sag .01)",         scorePlank(0.01),          100, 100);
t("Plank: sagging (sag .08)",       scorePlank(0.08),           50,  80);

console.log("\nGrade colours");
t("F is coral (red channel high)",  parseInt(gradeColor(10).slice(1, 3), 16), 240, 255);
t("A is green (green channel high)",parseInt(gradeColor(98).slice(3, 5), 16), 220, 255);

console.log(`\n${fail ? `${fail} FAILED` : "All scoring checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
