import { build, blend, SEG } from "../public/js/figures/rig.js";
import { EXERCISES } from "../public/js/figures/poses.js";
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
let bad = 0;
for (const ex of EXERCISES) {
  const rows = [];
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const s = build(blend(ex.top, ex.bottom, t));
    const p = blend(ex.top, ex.bottom, t);
    const thigh = d(s.hpN, s.kneeN), shin = d(s.kneeN, s.ankN);
    const footSlip = d(s.ankN, p.ankleN) + d(s.ankF, p.ankleF);
    const handSlip = p.arms === "ik" ? d(s.wriN, p.handN) + d(s.wriF, p.handF) : 0;
    const upper = d(s.shN, s.elbN), fore = d(s.elbN, s.wriN);
    const m = ex.measure(s);
    const ok = Math.abs(thigh - SEG.thigh) < .01 && Math.abs(shin - SEG.shin) < .01 &&
               Math.abs(upper - SEG.upper) < .01 && Math.abs(fore - SEG.fore) < .01 &&
               footSlip < 0.6 && handSlip < 0.6;
    if (!ok) bad++;
    const minY = Math.min(...Object.values(s).filter(Array.isArray).map(q => q[1]));
    const maxY = Math.max(...Object.values(s).filter(Array.isArray).map(q => q[1]));
    rows.push(`  t=${t.toFixed(2)} ${ok ? "ok " : "BAD"} slip=${(footSlip + handSlip).toFixed(2)} score=${String(m.score).padStart(3)} | ${m.rows.map(r => r.join(": ")).join(" | ")}  y[${minY.toFixed(0)}..${maxY.toFixed(0)}]`);
  }
  console.log(ex.name); console.log(rows.join("\n"));
}
console.log(bad ? `\n${bad} FRAMES FAILED` : "\nAll frames: rigid limbs, nothing slips.");
process.exit(bad ? 1 : 0);
