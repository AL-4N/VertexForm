/** stats.js — the Progress screen: overview, per-exercise history charts, faults over time, achievements, CSV export. */

import { store, globalAverage, resetAll } from "../storage.js";
import { ACHIEVEMENTS, isUnlocked } from "../achievements.js";
import { EXERCISES } from "../config.js";
import { exerciseHistory, toCSV } from "../history.js";
import { faultLabel } from "../coaching.js";
import { $, confirmAction, toast } from "./components.js";
import { gradeVar } from "../geometry.js";

const ICON_TROPHY = `<svg class="ach-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3h8v4a4 4 0 0 1-8 0zM6 5H3.5a2.5 2.5 0 0 0 2.6 3M14 5h2.5a2.5 2.5 0 0 1-2.6 3M10 11v3M7 17h6M8 14h4v3H8z"/></svg>`;
const ICON_LOCK = `<svg class="ach-icon" viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>`;

const TREND = {
  better: "↓ less often lately",
  worse: "↑ more often lately",
  same: "about the same",
  new: "",
};

export function renderStats() {
  const host = $("#stats-wrap");
  const avg = globalAverage();
  const s = store.stats;

  const overview = `
    <div class="card">
      <h2 class="label">Overview</h2>
      <div class="stat-card"><span>Global average</span>
        <strong class="big-stat" style="color:${avg != null ? gradeVar(avg) : "inherit"}">${avg ?? "--"}</strong></div>
      <div class="stat-card"><span>Total reps</span><strong class="big-stat">${s.totalReps ?? 0}</strong></div>
      <div class="stat-card"><span>Good reps</span><strong class="big-stat">${s.goodReps ?? 0}</strong></div>
      <div class="stat-card"><span>Exercises tried</span><strong class="big-stat">${new Set(s.tried ?? []).size}/${EXERCISES.length}</strong></div>
      <div class="stat-card"><span>Sets saved</span><strong class="big-stat">${store.sessions.length}</strong></div>
    </div>`;

  const perExercise = EXERCISES.map((name) => {
    const h = exerciseHistory(store.sessions, name);
    if (!h.count) return `<div class="card"><h2>${name}</h2><p class="dim">No sets yet.</p></div>`;
    const faults = h.faults.length
      ? `<ul class="fault-trends">${h.faults.map((f) => `
          <li><strong>${faultLabel(name, f.key)}</strong> <span class="dim">in ${f.count} rep${f.count === 1 ? "" : "s"}${TREND[f.trend] ? ` · ${TREND[f.trend]}` : ""}</span></li>`).join("")}</ul>`
      : `<p class="dim small">No faults recorded yet.</p>`;
    return `
      <div class="card">
        <h2>${name}</h2>
        <div class="stat-card"><span class="dim">Best</span><strong style="color:${gradeVar(h.best)}">${h.best}</strong></div>
        <div class="stat-card"><span class="dim">Average</span><strong>${h.average}</strong></div>
        <div class="stat-card"><span class="dim">Sets</span><strong>${h.count}</strong></div>
        ${historyChart(h.points, name)}
        <h3 class="label">Most common faults</h3>
        ${faults}
      </div>`;
  }).join("");

  const achievements = `
    <div class="card" style="grid-column:1/-1">
      <h2 class="label">Achievements: ${store.unlocked.length}/${ACHIEVEMENTS.length}</h2>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map((a) => `
          <div class="ach ${isUnlocked(a.id) ? "on" : ""}">
            <strong>${isUnlocked(a.id) ? ICON_TROPHY : ICON_LOCK}${a.title}</strong>
            <span class="dim">${a.desc}</span>
            <span class="sr-only">${isUnlocked(a.id) ? "Unlocked" : "Locked"}</span>
          </div>`).join("")}
      </div>
    </div>`;

  host.innerHTML = overview + perExercise + achievements;
}

/**
 * Best (solid) and average (dashed) score per set, oldest → newest, as a
 * small SVG chart. The y axis runs 40–100 so real differences show.
 */
function historyChart(points, name) {
  const pts = points.slice(-30);
  if (pts.length < 2) return `<p class="dim small">Do one more set to see a chart.</p>`;
  const W = 300, H = 90, pad = 6;
  const x = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v) => pad + (1 - (Math.max(40, Math.min(100, v)) - 40) / 60) * (H - pad * 2);
  const line = (key) => pts.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const first = pts[0].date ? new Date(pts[0].date).toLocaleDateString() : "earlier";
  const last = pts.at(-1).date ? new Date(pts.at(-1).date).toLocaleDateString() : "";
  const desc = `${name}: last ${pts.length} sets, best scores ${pts.map((p) => p.best).join(", ")}`;
  return `
    <figure class="hist-chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${desc}">
        <line x1="${pad}" x2="${W - pad}" y1="${y(90)}" y2="${y(90)}" class="hist-grid" />
        <line x1="${pad}" x2="${W - pad}" y1="${y(70)}" y2="${y(70)}" class="hist-grid" />
        <polyline points="${line("average")}" class="hist-avg" />
        <polyline points="${line("best")}" class="hist-best" />
        ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.best).toFixed(1)}" r="2.6" fill="${gradeVar(p.best)}"><title>${p.date ? new Date(p.date).toLocaleString() + ": " : ""}best ${p.best}, average ${p.average}</title></circle>`).join("")}
      </svg>
      <figcaption class="dim small"><span class="key-best">solid: best</span> <span class="key-avg">dashed: average</span> · ${first} → ${last || "now"} · lines at 70 and 90</figcaption>
    </figure>`;
}

export function wireStatsReset(onDone) {
  $("#btn-reset-all").addEventListener("click", () => {
    if (confirmAction("Erase ALL bests, history, and achievements? This cannot be undone.")) {
      resetAll();
      toast("All data cleared");
      renderStats();
      onDone?.();
    }
  });
  $("#btn-export").addEventListener("click", () => {
    if (!store.sessions.length) { toast("Nothing to export yet"); return; }
    const blob = new Blob([toCSV(store.sessions)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vertexform-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("History exported");
  });
}
