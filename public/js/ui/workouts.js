/**
 * workouts.js — the Workouts screen: saved routines (up to 3) and the
 * builder. Starting a routine hands it to main.js, which runs it.
 */

import { EXERCISES } from "../config.js";
import { store, save } from "../storage.js";
import {
  MAX_ROUTINES, MAX_STEPS, unitFor, normalizeStep, saveRoutine, deleteRoutine, validateRoutine, describeStep,
} from "../circuit.js";
import { $, $$, toast, confirmAction } from "./components.js";

const DEFAULT_STEPS = [
  { exercise: "Squat", amount: 10 },
  { exercise: "Push-up", amount: 8 },
  { exercise: "Plank", amount: 30 },
];

let draft = { name: "", rest: 60, steps: DEFAULT_STEPS.map(normalizeStep) };
let onStart = () => {};

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Wire the screen once. `start(routine)` runs a routine. */
export function wireWorkouts(start) {
  onStart = start;
  $("#add-step").addEventListener("click", () => {
    readForm();
    if (draft.steps.length >= MAX_STEPS) { showError(`A routine can have up to ${MAX_STEPS} exercises.`); return; }
    draft.steps.push(normalizeStep({ exercise: "Squat", amount: 10 }));
    renderSteps();
    $$("#step-list select").at(-1)?.focus();
  });
  $("#routine-rest").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-val]");
    if (!b) return;
    draft.rest = Number(b.dataset.val);
    renderRest();
  });
  $("#step-list").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-remove]");
    if (!b) return;
    readForm();
    draft.steps.splice(Number(b.dataset.remove), 1);
    renderSteps();
  });
  $("#step-list").addEventListener("change", (e) => {
    if (e.target.matches("select")) { readForm(); renderSteps(); }   // unit may change (plank = seconds)
  });
  $("#routine-save").addEventListener("click", () => {
    readForm();
    const { list, error } = saveRoutine(store.routines ?? [], draft);
    if (error) { showError(error); return; }
    store.routines = list;
    save();
    showError("");
    toast(`Saved "${draft.name.trim()}"`);
    renderRoutines();
  });
  $("#routine-start").addEventListener("click", () => {
    readForm();
    const name = draft.name.trim() || "Quick workout";
    const v = validateRoutine({ ...draft, name });
    if (!v.ok) { showError(v.error); return; }
    showError("");
    onStart({ ...draft, name, steps: draft.steps.map(normalizeStep) });
  });
  $("#routine-list").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const r = (store.routines ?? [])[Number(b.dataset.i)];
    if (!r) return;
    if (b.dataset.act === "start") onStart(r);
    else if (b.dataset.act === "edit") { draft = structuredClone(r); renderBuilder(); $("#routine-name").focus(); }
    else if (b.dataset.act === "delete" && confirmAction(`Delete the routine "${r.name}"?`)) {
      store.routines = deleteRoutine(store.routines, r.name);
      save();
      renderRoutines();
    }
  });
}

export function renderWorkouts() {
  renderRoutines();
  renderBuilder();
}

function renderRoutines() {
  const list = store.routines ?? [];
  $("#routine-count").textContent = `(${list.length} of ${MAX_ROUTINES})`;
  $("#routine-list").innerHTML = list.length
    ? list.map((r, i) => `
      <div class="routine">
        <div>
          <strong>${esc(r.name)}</strong>
          <p class="dim">${r.steps.map((s) => esc(describeStep(s))).join(" · ")}${r.rest ? ` · ${r.rest} s rest` : ""}</p>
        </div>
        <div class="routine-actions">
          <button class="btn primary" data-act="start" data-i="${i}">Start</button>
          <button class="btn ghost" data-act="edit" data-i="${i}">Edit</button>
          <button class="btn ghost" data-act="delete" data-i="${i}" aria-label="Delete ${esc(r.name)}">Delete</button>
        </div>
      </div>`).join("")
    : `<p class="dim">No saved routines yet. Build one below: pick exercises, reps (or seconds for a plank) and the rest between them.</p>`;
}

function renderBuilder() {
  $("#routine-name").value = draft.name;
  renderSteps();
  renderRest();
}

function renderSteps() {
  $("#step-list").innerHTML = draft.steps.map((s, i) => `
    <li class="step">
      <label class="sr-only" for="step-ex-${i}">Exercise ${i + 1}</label>
      <select id="step-ex-${i}" class="text-input">
        ${EXERCISES.map((e) => `<option${e === s.exercise ? " selected" : ""}>${e}</option>`).join("")}
      </select>
      <label class="sr-only" for="step-n-${i}">${unitFor(s.exercise)}</label>
      <input id="step-n-${i}" class="text-input num" type="number" inputmode="numeric" min="1" value="${s.amount}" />
      <span class="dim step-unit">${unitFor(s.exercise)}</span>
      <button type="button" class="btn ghost" data-remove="${i}" aria-label="Remove ${esc(s.exercise)}" ${draft.steps.length <= 1 ? "disabled" : ""}>Remove</button>
    </li>`).join("");
}

function renderRest() {
  $$("#routine-rest button").forEach((b) => {
    const on = Number(b.dataset.val) === draft.rest;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

/** Pull the form's values into the draft (amounts normalised to their unit's limits). */
function readForm() {
  draft.name = $("#routine-name").value;
  draft.steps = $$("#step-list .step").map((li) => {
    const exercise = li.querySelector("select").value;
    const prev = draft.steps.find((s) => s.exercise === exercise);
    let amount = Number(li.querySelector("input").value);
    if (unitFor(exercise) === "seconds" && amount < 10) amount = prev?.unit === "seconds" ? prev.amount : 30;
    return normalizeStep({ exercise, amount });
  });
}

function showError(msg) {
  $("#builder-error").textContent = msg;
}
