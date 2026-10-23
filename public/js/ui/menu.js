/** menu.js — exercise list, session log, bests, and reset controls. */

import { EXERCISES, EXERCISE_META } from "../config.js";
import { store, globalAverage, resetExercise, dayStreak, lastWeek } from "../storage.js";
import { $, showScreen, confirmAction, toast } from "./components.js";
import { gradeVar } from "../geometry.js";
import { BY_NAME } from "../figures/pictos.js";
import { mountLoop } from "../figures/loop.js";
import { slide } from "./motion.js";
import { gradeColor } from "../grade.js";
import { renderChallengeCard } from "./challenges.js";
import { rollTo } from "./digits.js";

let sessionLog = [];

export function addSessionEntry(exercise, score) {
  sessionLog.push({ exercise, score });
  renderSidebar();
}

/**
 * The exercise picker: an instrument, not a list of cards. On the left a
 * drafting-board stage where the exercise you point at does its rep live,
 * with a big index number that rolls, a gauge of your best score and a
 * Train button. On the right the names stand in a tall stack like a dial:
 * outlined, tipping away the further they are from the one you point at,
 * which fills with the go gradient while a ruler marker glides to it.
 * Pointing (or focusing) previews; clicking a name trains it straight away,
 * and its stage becomes the setup panel (morphInto in main.js).
 */
let stopStage = () => {};
export function renderMenu(onPick) {
  const list = $("#exercise-list");
  list.removeAttribute("aria-busy");
  const quiet = matchMedia("(prefers-reduced-motion: reduce)").matches;

  list.innerHTML = `
    <div class="picker">
      <div class="pk-stage" aria-live="polite">
        <span class="pk-num" aria-hidden="true"><i>01</i><b>/ ${pad(EXERCISES.length)}</b></span>
        <div class="pk-fig picto"></div>
        <div class="pk-read">
          <span class="pk-name"></span>
          <span class="pk-hint"></span>
        </div>
        <svg class="pk-gauge" viewBox="0 0 120 70" aria-hidden="true">
          <path d="M10 62 A50 50 0 0 1 110 62" class="pk-track" pathLength="100"/>
          <path d="M10 62 A50 50 0 0 1 110 62" class="pk-arc" pathLength="100"/>
          <text x="60" y="52" text-anchor="middle" class="pk-gv"></text>
          <text x="60" y="67" text-anchor="middle" class="pk-gk">BEST</text>
        </svg>
        <button type="button" class="btn primary pk-go"></button>
      </div>
      <div class="pk-list" role="list">
        ${EXERCISES.map((name, i) => {
          const best = store.bests[name];
          return `<button type="button" role="listitem" class="ex-card" data-i="${i}" data-name="${name}">
            <span class="pk-i">${pad(i + 1)}</span>
            <span class="name">${name}</span>
            <span class="hint">${EXERCISE_META[name].hint}</span>
            ${best != null
              ? `<span class="best" style="color:${gradeVar(best)}">${best}</span><span class="reset" role="button" tabindex="0" title="Reset best">reset</span>`
              : `<span class="best dim">No best yet</span>`}
          </button>`;
        }).join("")}
        <span class="pk-marker" aria-hidden="true"></span>
      </div>
    </div>`;

  const stage = list.querySelector(".pk-stage");
  const items = [...list.querySelectorAll(".ex-card")];
  const marker = list.querySelector(".pk-marker");
  let at = -1, hoverT = 0;

  function show(i) {
    if (i === at) return;
    const dir = at < 0 ? 0 : i > at ? 1 : -1;
    at = i;
    const name = EXERCISES[i], best = store.bests[name];
    items.forEach((el, k) => {
      el.classList.toggle("on", k === i);
      el.style.setProperty("--d", String(k - i));
      el.style.setProperty("--a", String(Math.abs(k - i)));
    });
    // The marker glides to the name.
    const it = items[i];
    marker.style.transform = `translateY(${it.offsetTop + it.offsetHeight / 2 - 1}px)`;
    // The stage: a new figure doing its rep, sliding in the way you moved.
    stopStage();
    const fig = stage.querySelector(".pk-fig");
    stopStage = mountLoop(fig, BY_NAME[name]);
    if (dir && !quiet) slide(fig, { from: [0, dir * 46], to: [0, 0], opacity: [0, 1], duration: 420, strength: 1 });
    rollTo(stage.querySelector(".pk-num i"), pad(i + 1));
    stage.querySelector(".pk-name").textContent = name;
    stage.querySelector(".pk-hint").textContent = EXERCISE_META[name].hint;
    if (dir && !quiet) slide(stage.querySelector(".pk-read"), { from: [0, dir * 18], to: [0, 0], opacity: [0, 1], duration: 360, strength: 0.7 });
    const arc = stage.querySelector(".pk-arc");
    arc.style.strokeDasharray = `${best ?? 0} 100`;
    arc.style.stroke = best != null ? gradeColor(best) : "transparent";
    const gv = stage.querySelector(".pk-gv");
    gv.textContent = best ?? "--";
    gv.style.fill = best != null ? gradeColor(best) : "";
    stage.querySelector(".pk-go").textContent = `Train ${name.toLowerCase()}`;
    stage.style.setProperty("--pk", best != null ? gradeColor(best) : "#2ee59d");
  }

  async function pick(i, e) {
    const name = EXERCISES[i], best = store.bests[name];
    // The reset control lives inside the name; don't launch the exercise.
    if (e?.target.closest?.(".reset")) {
      e.stopPropagation();
      if (await confirmAction(`Reset your best score for ${name}? (currently ${best})`, { yes: "Reset best", danger: true })) {
        resetExercise(name);
        toast(`${name} best cleared`);
        renderMenu(onPick);
      }
      return;
    }
    show(i);
    onPick(name, stage);
  }

  items.forEach((el, i) => {
    el.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      clearTimeout(hoverT);
      hoverT = setTimeout(() => show(i), 70);           // passing over a name on the way doesn't swap the stage
    });
    el.addEventListener("focus", () => show(i));
    el.addEventListener("click", (e) => pick(i, e));
    el.addEventListener("keydown", (e) => {
      const to = { ArrowDown: i + 1, ArrowUp: i - 1 }[e.key];
      if (to == null || !items[to]) return;
      e.preventDefault();
      items[to].focus();
    });
  });
  stage.querySelector(".pk-go").addEventListener("click", () => pick(at));
  list.querySelector(".pk-list").addEventListener("pointerleave", () => clearTimeout(hoverT));

  // Start on the last exercise you trained, or the first.
  const last = store.sessions?.at?.(-1)?.exercise;
  show(Math.max(0, EXERCISES.indexOf(last)));
  requestAnimationFrame(() => { marker.style.transform = `translateY(${items[at].offsetTop + items[at].offsetHeight / 2 - 1}px)`; });

  // The first time the menu shows, the names wind on like a dial and the stage draws in.
  if (!renderMenu.shown && !quiet) {
    items.forEach((c, i) => c.animate(
      [{ opacity: 0, transform: "translateY(40px) rotateX(-70deg)", filter: "blur(8px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
      { duration: 640, delay: 80 + i * 75, easing: "cubic-bezier(.22,.61,.36,1)", fill: "backwards", composite: "add" }));
    stage.animate([{ clipPath: "inset(0 100% 0 0 round 18px)" }, { clipPath: "inset(0 0 0 0 round 18px)" }],
      { duration: 700, easing: "cubic-bezier(.65,0,.2,1)", fill: "backwards" });
  }
  renderMenu.shown = true;

  renderSidebar();
}

const pad = (n) => String(n).padStart(2, "0");

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
