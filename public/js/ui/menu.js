/** menu.js — exercise list, session log, bests, and reset controls. */

import { EXERCISES, EXERCISE_META } from "../config.js";
import { store, globalAverage, resetExercise, dayStreak } from "../storage.js";
import { $, showScreen, confirmAction, toast } from "./components.js";
import { gradeVar } from "../geometry.js";
import { renderPictos } from "../figures/pictos.js";

let sessionLog = [];

export function addSessionEntry(exercise, score) {
  sessionLog.push({ exercise, score });
  renderSidebar();
}

export function renderMenu(onPick) {
  const list = $("#exercise-list");
  list.innerHTML = "";

  EXERCISES.forEach((name) => {
    const meta = EXERCISE_META[name];
    const best = store.bests[name];

    const card = document.createElement("button");
    card.className = "ex-card";
    card.innerHTML = `
      <span class="icon picto" data-picto="${name}"></span>
      <span class="meta">
        <span class="name">${name}</span>
        <span class="hint">${meta.hint}</span>
      </span>
      ${best != null
        ? `<span class="best" style="color:${gradeVar(best)}">${best}</span>
           <button class="reset" title="Reset best">reset</button>`
        : `<span class="best dim">—</span>`}
    `;

    card.addEventListener("click", (e) => {
      // The reset button lives inside the card; don't launch the exercise.
      if (e.target.classList.contains("reset")) {
        e.stopPropagation();
        if (confirmAction(`Reset your best score for ${name}? (currently ${best})`)) {
          resetExercise(name);
          toast(`${name} best cleared`);
          renderMenu(onPick);
        }
        return;
      }
      onPick(name);
    });

    list.appendChild(card);
  });
  renderPictos(list);

  renderSidebar();
}

function renderSidebar() {
  const host = $("#session-list");
  if (sessionLog.length === 0) {
    host.innerHTML = `<p class="dim">No attempts yet.<br />Your scores show up here.</p>`;
  } else {
    host.innerHTML = sessionLog
      .slice(-9).reverse()
      .map((e) => `
        <div class="session-row">
          <span>${e.exercise}</span>
          <strong style="color:${gradeVar(e.score)}">${e.score}</strong>
        </div>`)
      .join("");
  }

  const avg = globalAverage();
  $("#global-avg").textContent = avg ?? "--";
  if (avg != null) $("#global-avg").style.color = gradeVar(avg);
  $("#total-reps").textContent = store.stats.totalReps ?? 0;
  const streak = dayStreak();
  $("#day-streak").textContent = streak ? `${streak} day${streak === 1 ? "" : "s"}` : "0";
}

export { showScreen };
