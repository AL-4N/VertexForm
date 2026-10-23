/** menu.js — exercise list, session log, bests, and reset controls. */

import { EXERCISES, EXERCISE_META } from "../config.js";
import { store, globalAverage, resetExercise, dayStreak, lastWeek } from "../storage.js";
import { $, showScreen, confirmAction, toast } from "./components.js";
import { gradeVar } from "../geometry.js";
import { renderPictos } from "../figures/pictos.js";
import { renderChallengeCard } from "./challenges.js";
import { rollTo } from "./digits.js";

let sessionLog = [];

export function addSessionEntry(exercise, score) {
  sessionLog.push({ exercise, score });
  renderSidebar();
}

export function renderMenu(onPick) {
  const list = $("#exercise-list");
  list.innerHTML = "";
  list.removeAttribute("aria-busy");

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
        : `<span class="best dim">No best yet</span>`}
    `;

    card.addEventListener("click", async (e) => {
      // The reset button lives inside the card; don't launch the exercise.
      if (e.target.classList.contains("reset")) {
        e.stopPropagation();
        if (await confirmAction(`Reset your best score for ${name}? (currently ${best})`, { yes: "Reset best", danger: true })) {
          resetExercise(name);
          toast(`${name} best cleared`);
          renderMenu(onPick);
        }
        return;
      }
      onPick(name, card);
    });

    list.appendChild(card);
  });
  renderPictos(list);
  // The first time the menu shows, the exercise cards rise in one after another.
  if (!renderMenu.shown && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    [...list.children].forEach((c, i) => c.animate(
      [{ opacity: 0, transform: "translateY(18px) scale(.98)" }, { opacity: 1, transform: "none" }],
      { duration: 520, delay: 80 + i * 70, easing: "cubic-bezier(.22,.61,.36,1)", fill: "backwards" }));
  }
  renderMenu.shown = true;

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
  rollTo($("#global-avg"), avg ?? "--");
  if (avg != null) $("#global-avg").style.color = gradeVar(avg);
  rollTo($("#total-reps"), store.stats.totalReps ?? 0);
  const streak = dayStreak();
  $("#day-streak").textContent = streak ? `${streak} day${streak === 1 ? "" : "s"}` : "0";
  // The week under it: a dot for each of the last 7 days, filled on days you
  // trained. The first time it shows, the days pop in one after another.
  const week = $("#day-week");
  if (week) {
    const html = lastWeek().map((d, i) => `<li class="${d.trained ? "on" : ""}${d.today ? " today" : ""}" style="--i:${i}" title="${d.key}${d.trained ? ": trained" : ""}"><i></i><span>${d.label}</span></li>`).join("");
    if (week.innerHTML !== html) { week.classList.toggle("fresh", !week.childElementCount); week.innerHTML = html; }
  }
  renderChallengeCard();
}

export { showScreen };
