/** menu.js — exercise list, session log, bests, and reset controls. */

import { CURVE } from "./ease.js";
import { EXERCISES, EXERCISE_META } from "../config.js";
import { store, globalAverage, resetExercise, dayStreak, lastWeek } from "../storage.js";
import { $, showScreen, confirmAction, toast } from "./components.js";
import { gradeVar } from "../geometry.js";
import { BY_NAME, renderPictos } from "../figures/pictos.js";
import { mountPickerRing } from "./picker-ring.js";
import { mountLoop } from "../figures/loop.js";
import { slide } from "./motion.js";
import { gradeColor } from "../grade.js";
import { renderChallengeCard } from "./challenges.js";
import { rollTo } from "./digits.js";
import { nearestUnlocks } from "../skills.js";

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
let stopRing = () => {};
let countRaf = 0;
let pickHandler = null;      // renderMenu's onPick, for the "Nearest unlocks" Train buttons

export function renderMenu(onPick) {
  pickHandler = onPick;
  const list = $("#exercise-list");
  list.removeAttribute("aria-busy");
  const quiet = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Wide screens with motion: the names stand on a ring of cards around the
  // stage (picker-ring.js). Otherwise the dial of names beside it.
  const ringMode = !quiet && matchMedia("(min-width: 1180px)").matches;
  stopRing();
  stopRing = () => {};
  const stageHtml = `
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
      </div>`;
  const cardHtml = (name, i) => {
    const best = store.bests[name];
    return `<button type="button" role="listitem" class="ex-card" data-i="${i}" data-name="${name}">
            ${ringMode ? `<span class="pk-pic picto" data-picto="${name}" aria-hidden="true"></span>` : ""}
            <span class="pk-i">${pad(i + 1)}</span>
            <span class="name">${name}</span>
            <span class="hint">${EXERCISE_META[name].hint}</span>
            ${best != null
              ? `<span class="best" style="color:${gradeVar(best)}">${best}</span><span class="reset" role="button" tabindex="0" title="Reset best">reset</span>`
              : `<span class="best dim">No best yet</span>`}
          </button>`;
  };

  list.innerHTML = ringMode ? `
    <div class="picker ring">
      <div class="pk-view">
        <div class="pk-ring" role="list">
          <div class="pk-centre">${stageHtml}</div>
          ${EXERCISES.map((name, i) => `<div class="pk-item">${cardHtml(name, i)}</div>`).join("")}
        </div>
        <button type="button" class="pk-turn" data-dir="-1" aria-label="Turn to the previous exercise">&larr;</button>
        <button type="button" class="pk-turn" data-dir="1" aria-label="Turn to the next exercise">&rarr;</button>
        <p class="pk-ring-hint" aria-hidden="true">Scroll or drag to turn &middot; Click a card to train</p>
      </div>
    </div>` : `
    <div class="picker">
      ${stageHtml}
      <div class="pk-list${EXERCISES.length > 6 ? " many" : ""}" role="list">
        ${EXERCISES.map(cardHtml).join("")}
        <span class="pk-marker" aria-hidden="true"></span>
      </div>
    </div>`;
  if (ringMode) renderPictos(list);

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
    // The marker glides to the name, stretching on the way like a needle.
    const it = items[i];
    if (marker) marker.style.translate = `0 ${it.offsetTop + it.offsetHeight / 2 - 1}px`;   // translate, not transform: the stretch below scales the marker, not its distance down the list
    if (marker && dir && !quiet) marker.animate([{ scale: "1 1" }, { scale: "1.5 6", offset: .35 }, { scale: "1 1" }], { duration: 520, easing: CURVE.outQuart });
    // The stage: the old figure leaves the way you moved (through a blur) as
    // the new one, doing its rep, comes in behind it.
    stopStage();
    const fig = stage.querySelector(".pk-fig");
    const old = fig.querySelector("svg:not(.pk-ghost)");
    const ghost = old && dir && !quiet ? old.cloneNode(true) : null;
    stopStage = mountLoop(fig, BY_NAME[name]);              // replaces the figure
    stage.loopStart = stopStage.start;                      // the setup demo carries on from here
    if (ghost) {
      ghost.classList.add("pk-ghost");
      fig.append(ghost);
      ghost.animate([{ transform: "none", opacity: 1, filter: "blur(0)" }, { transform: `translateY(${-dir * 60}px) scale(.85)`, opacity: 0, filter: "blur(10px)" }],
        { duration: 360, easing: CURVE.inQuart, fill: "forwards" }).finished.then(() => ghost.remove(), () => ghost.remove());
    }
    if (dir && !quiet) slide(fig.querySelector("svg:not(.pk-ghost)"), { from: [0, dir * 46], to: [0, 0], opacity: [0, 1], duration: 460, strength: 1 });
    rollTo(stage.querySelector(".pk-num i"), pad(i + 1));
    stage.querySelector(".pk-name").textContent = name;
    stage.querySelector(".pk-hint").textContent = EXERCISE_META[name].hint;
    if (dir && !quiet) slide(stage.querySelector(".pk-read"), { from: [0, dir * 18], to: [0, 0], opacity: [0, 1], duration: 360, strength: 0.7 });
    const arc = stage.querySelector(".pk-arc");
    arc.style.strokeDasharray = `${best ?? 0} 100`;
    arc.style.stroke = best != null ? gradeColor(best) : "transparent";
    // The best score counts up the scale with the arc, taking each grade's colour.
    const gv = stage.querySelector(".pk-gv");
    cancelAnimationFrame(countRaf);
    if (best == null) { gv.textContent = "--"; gv.style.fill = ""; }
    else if (quiet) { gv.textContent = best; gv.style.fill = gradeColor(best); }
    else {
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / 800), v = Math.round(best * (1 - Math.pow(1 - k, 3)));
        gv.textContent = v; gv.style.fill = gradeColor(v);
        if (k < 1) countRaf = requestAnimationFrame(tick);
      };
      countRaf = requestAnimationFrame(tick);
    }
    if (!quiet && dir) arc.animate([{ strokeDasharray: "0 100" }, { strokeDasharray: `${best ?? 0} 100` }], { duration: 800, easing: CURVE.outCubic });
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
      let to = { ArrowDown: i + 1, ArrowUp: i - 1, ...(ringMode && { ArrowRight: i + 1, ArrowLeft: i - 1 }) }[e.key];
      if (to == null) return;
      if (ringMode) to = (to + items.length) % items.length;    // a ring has no ends
      if (!items[to]) return;
      e.preventDefault();
      items[to].focus();
    });
  });
  stage.querySelector(".pk-go").addEventListener("click", () => pick(at));
  // The stage leans toward the pointer; its grid slides the other way and a
  // glare follows, so the figure seems to stand in front of the board.
  if (!quiet) {
    stage.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      stage.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
      stage.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
      stage.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
      stage.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
      stage.style.setProperty("--px", `${(-x * 14).toFixed(1)}px`);
      stage.style.setProperty("--py", `${(-y * 10).toFixed(1)}px`);
    });
    stage.addEventListener("pointerleave", () => ["--rx", "--ry", "--px", "--py"].forEach((k) => stage.style.removeProperty(k)));
  }
  list.querySelector(".pk-list, .pk-view").addEventListener("pointerleave", () => clearTimeout(hoverT));

  // Start on the last exercise you trained, or the first.
  const last = store.sessions?.at?.(-1)?.exercise;
  const first = Math.max(0, EXERCISES.indexOf(last));
  show(first);
  if (ringMode) {
    stopRing = mountPickerRing(list.querySelector(".pk-view"), {
      items: [...list.querySelectorAll(".pk-item")], start: first, intro: !renderMenu.shown,
      onFront: (i) => { clearTimeout(hoverT); show(i); },
    });
    stage.animate([{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }],
      { duration: renderMenu.shown ? 1 : 700, easing: CURVE.outCubic, fill: "backwards", composite: "add" });
  } else requestAnimationFrame(() => { marker.style.translate = `0 ${items[at].offsetTop + items[at].offsetHeight / 2 - 1}px`; });

  // The first time the menu shows, the names wind on like a dial and the stage draws in.
  if (!renderMenu.shown && !quiet && !ringMode) {
    items.forEach((c, i) => c.animate(
      [{ opacity: 0, transform: "translateY(40px) rotateX(-70deg)" }, { opacity: 1, transform: "none" }],
      { duration: 640, delay: 80 + i * 75, easing: CURVE.outCubic, fill: "backwards", composite: "add" }));
    stage.animate([{ clipPath: "inset(0 100% 0 0 round 18px)" }, { clipPath: "inset(0 0 0 0 round 18px)" }],
      { duration: 700, easing: CURVE.inOutCubic, fill: "backwards" });
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
  renderUnlocks();
}

/** The two tracked skills you're closest to, what's left for each, and a
 *  Train button that opens that exercise. */
function renderUnlocks() {
  const host = $("#unlocks-card");
  if (!host) return;
  const list = nearestUnlocks(store.sessions, store.skills);
  host.innerHTML = list.length ? list.map((u) => `
    <div class="unlock-row">
      <div class="unlock-text">
        <strong>${u.name}</strong>
        <span class="dim">${u.left}</span>
        <span class="unlock-bar" aria-hidden="true"><i style="width:${Math.round(u.near * 100)}%;background:${gradeColor(u.near * 100)}"></i></span>
      </div>
      <button type="button" class="btn" data-train="${u.exercise}" aria-label="Train ${u.exercise.toLowerCase()} for ${u.name}">Train</button>
    </div>`).join("") : `<p class="dim">Every tracked skill is unlocked.</p>`;
  host.onclick = (e) => { const b = e.target.closest("[data-train]"); if (b) pickHandler?.(b.dataset.train); };
}

export { showScreen };
