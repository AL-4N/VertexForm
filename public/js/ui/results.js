/** results.js — post-session breakdown: grade, bars, rep chart, coach notes. */

import { $, renderBars, drawRepChart } from "./components.js";
import { gradeLetter, gradeVar } from "../geometry.js";
import { faultLabel, faultPhrase } from "../coaching.js";
import { getExercise } from "../exercises/index.js";
import { slide, EASE } from "./motion.js";

export function renderResults(r) {
  if (!r) return;

  $("#results-title").textContent = `${r.exercise} results`;
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
  $("#res-chart").setAttribute("aria-label", `Rep scores: ${r.reps.join(", ")}. Target ${r.target}.`);
  renderSummary(r);
  renderDetails(r);

  // ── Coach notes: the most common fault across the session ──
  const counts = {};
  r.faults.forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (!ranked.length) {
    $("#res-tip").hidden = false;
    $("#res-tip").textContent =
      "Clean session: no repeated form faults detected. Keep that standard.";
    $("#res-faults").innerHTML = "";
    return;
  }

  const [topKey, topCount] = ranked[0];
  // With a coach summary, its "Fix next" already says this.
  $("#res-tip").hidden = !!r.summary?.fix;
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

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The coach's post-set summary: strengths, the one thing to fix, a target. */
function renderSummary(r) {
  const host = $("#res-summary");
  const s = r.summary;
  if (!s) { host.innerHTML = ""; return; }
  host.innerHTML = `
    <div class="sum-row"><span class="sum-tag good">Strengths</span><ul>${s.strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    ${s.fix ? `<div class="sum-row"><span class="sum-tag fix">Fix next</span><p><strong>${esc(s.fix.label)}</strong>: focus on ${esc(s.fix.focus)}.
      <span class="dim">${esc(s.fix.cue)}.</span></p></div>` : ""}
    <div class="sum-row"><span class="sum-tag goal">Target</span><p>${esc(s.target)}.</p></div>`;
}

/** Per-rep table: score, time down / at the bottom / up, and what was flagged. */
function renderDetails(r) {
  const host = $("#res-details");
  const card = host.closest(".card");
  const rows = r.details ?? [];
  card.hidden = !rows.length;
  if (!rows.length) return;
  const f = (v) => (Number.isFinite(v) ? `${v.toFixed(1)} s` : "–");
  const head = r.isHold
    ? "<tr><th scope=col>#</th><th scope=col>Score</th><th scope=col>Length</th><th scope=col>Flagged</th></tr>"
    : "<tr><th scope=col>Rep</th><th scope=col>Score</th><th scope=col>Down</th><th scope=col>Bottom</th><th scope=col>Up</th><th scope=col>Flagged</th></tr>";
  host.innerHTML = `<thead>${head}</thead><tbody>${rows.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong style="color:${gradeVar(d.score)}">${d.score}</strong> <span class="dim">${gradeLetter(d.score)}</span></td>
      ${r.isHold ? `<td>${f(d.duration)}</td>` : `<td>${f(d.phases?.down)}</td><td>${f(d.phases?.bottom)}</td><td>${f(d.phases?.up)}</td>`}
      <td>${d.faults?.length ? d.faults.map((k) => esc(faultLabel(r.exercise, k))).join(", ") : '<span class="dim">clean</span>'}</td>
    </tr>`).join("")}</tbody>`;
  // Rows slide in one after another, each with a little motion blur.
  [...host.querySelectorAll("tbody tr")].forEach((tr, k) => {
    tr.style.opacity = "0";
    setTimeout(() => slide(tr, { from: [40, 0], to: [0, 0], opacity: [0, 1], duration: 360, ease: EASE.out }), 120 + k * 55);
  });
  // The summary lines too.
  [...$("#res-summary").children].forEach((row, k) => {
    row.style.opacity = "0";
    setTimeout(() => slide(row, { from: [0, 22], to: [0, 0], opacity: [0, 1], duration: 380, ease: EASE.out }), 80 + k * 90);
  });
}
