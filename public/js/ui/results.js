/** results.js — post-session breakdown: grade, bars, rep chart, coach notes. */

import { $, renderBars, drawRepChart } from "./components.js";
import { gradeLetter, gradeVar } from "../geometry.js";
import { faultLabel, faultPhrase } from "../coaching.js";
import { getExercise } from "../exercises/index.js";

export function renderResults(r) {
  if (!r) return;

  $("#results-title").textContent = `${r.exercise} — results`;
  $("#res-letter").textContent = gradeLetter(r.best);
  $("#res-letter").style.color = gradeVar(r.best);
  $("#res-score").textContent = r.best;
  const held = Math.round((r.durations ?? []).reduce((a, b) => a + b, 0));
  $("#res-sub").textContent = r.isHold
    ? `${held} s hold · best 5 s ${r.best} · average ${r.average}`
    : r.reps.length > 1
      ? `Best of ${r.reps.length} reps · average ${r.average}`
      : "Single rep";
  $("#res-best-badge").hidden = !r.isBest;

  // Component bars from the best rep's grade shape, if we have one.
  const ex = getExercise(r.exercise);
  const bars = r.bars ?? [
    { label: "Best rep", value: r.best },
    { label: "Average",  value: r.average },
  ];
  renderBars($("#res-bars"), bars, "res-bar");

  drawRepChart($("#res-chart"), r.reps, r.target);

  // ── Coach notes: the most common fault across the session ──
  const counts = {};
  r.faults.forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (!ranked.length) {
    $("#res-tip").textContent =
      "Clean session — no repeated form faults detected. Keep that standard.";
    $("#res-faults").innerHTML = "";
    return;
  }

  const [topKey, topCount] = ranked[0];
  const unit = r.isHold ? "5-second stretches" : "reps";
  $("#res-tip").textContent =
    `Your most common issue was ${faultLabel(r.exercise, topKey).toLowerCase()} ` +
    `(in ${topCount} of ${r.reps.length} ${unit}). ${faultPhrase(r.exercise, topKey)}.`;

  $("#res-faults").innerHTML = ranked.slice(0, 4).map(([key, n]) => `
    <div class="fault-item">
      <span class="fault-sev" style="background:${
        n >= r.reps.length / 2 ? "var(--coral)" : "var(--amber)"}"></span>
      <div>
        <strong>${faultLabel(r.exercise, key)}</strong>
        <div class="dim">in ${n} of ${r.reps.length} ${r.isHold ? "stretches" : "reps"}</div>
      </div>
    </div>`).join("");
}
