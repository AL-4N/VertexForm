/** stats.js — history sparklines, bests, and the achievement grid. */

import { store, globalAverage, resetAll } from "../storage.js";
import { ACHIEVEMENTS, isUnlocked } from "../achievements.js";
import { EXERCISES } from "../config.js";
import { $, confirmAction, toast } from "./components.js";
import { gradeVar } from "../geometry.js";

export function renderStats() {
  const host = $("#stats-wrap");
  const avg = globalAverage();
  const s = store.stats;

  const overview = `
    <div class="card">
      <h3 class="label">Overview</h3>
      <div class="stat-card"><span>Global average</span>
        <strong class="big-stat" style="color:${avg != null ? gradeVar(avg) : "inherit"}">
          ${avg ?? "--"}</strong></div>
      <div class="stat-card"><span>Total reps</span>
        <strong class="big-stat">${s.totalReps ?? 0}</strong></div>
      <div class="stat-card"><span>Good reps</span>
        <strong class="big-stat" style="color:var(--lime)">${s.goodReps ?? 0}</strong></div>
      <div class="stat-card"><span>Exercises tried</span>
        <strong class="big-stat">${new Set(s.tried ?? []).size}/5</strong></div>
    </div>`;

  const perExercise = EXERCISES.map((name) => {
    const hist = store.history[name] ?? [];
    if (!hist.length) {
      return `<div class="card"><h3>${name}</h3><p class="dim">No attempts yet.</p></div>`;
    }
    const recent = hist.slice(-24);
    const best = store.bests[name];
    const mean = Math.round(hist.reduce((a, b) => a + b, 0) / hist.length);
    const spark = recent
      // Scale 40–100 to the full height so real differences between scores show.
      .map((v) => `<div style="height:${Math.max(6, Math.min(100, ((v - 40) / 60) * 100))}%;background:${gradeVar(v)}" title="${v}"></div>`)
      .join("");
    return `
      <div class="card">
        <h3>${name}</h3>
        <div class="stat-card"><span class="dim">Best</span>
          <strong style="color:${gradeVar(best)}">${best}</strong></div>
        <div class="stat-card"><span class="dim">Average</span>
          <strong>${mean}</strong></div>
        <div class="stat-card"><span class="dim">Attempts</span>
          <strong>${hist.length}</strong></div>
        <div class="spark">${spark}</div>
      </div>`;
  }).join("");

  const achievements = `
    <div class="card" style="grid-column:1/-1">
      <h3 class="label">Achievements — ${store.unlocked.length}/${ACHIEVEMENTS.length}</h3>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map((a) => `
          <div class="ach ${isUnlocked(a.id) ? "on" : ""}">
            <strong>${isUnlocked(a.id) ? "🏆 " : "🔒 "}${a.title}</strong>
            <span class="dim">${a.desc}</span>
          </div>`).join("")}
      </div>
    </div>`;

  host.innerHTML = overview + perExercise + achievements;
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
}
