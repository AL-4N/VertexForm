/**
 * circuit.js — workout builder and runner (pure logic, no DOM).
 *
 * A routine is a name, a list of steps (exercise + reps, or seconds for a
 * plank) and the rest between steps. Up to 3 routines are saved. The
 * runner walks the steps in order; the UI (main.js) runs each one as an
 * "Analyze a set" session with the rest screen in between.
 */

import { EXERCISES } from "./config.js";

export const MAX_ROUTINES = 3;
export const MAX_STEPS = 10;
export const REST_CHOICES = [0, 30, 60, 90, 120];

/** "reps" for rep exercises, "seconds" for holds. */
export const unitFor = (exercise) => (exercise === "Plank" ? "seconds" : "reps");

const LIMITS = { reps: [1, 50], seconds: [10, 300] };

/** A step with a sensible amount for its unit. */
export function normalizeStep({ exercise, amount }) {
  const unit = unitFor(exercise);
  const [lo, hi] = LIMITS[unit];
  const n = Math.round(Number(amount));
  return { exercise, amount: Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo)), unit };
}

/** @returns { ok: true } or { ok: false, error: "…" } (plain English, shown to the user) */
export function validateRoutine(r) {
  const name = String(r?.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the routine a name." };
  if (name.length > 40) return { ok: false, error: "Keep the name under 40 characters." };
  const steps = r?.steps ?? [];
  if (!steps.length) return { ok: false, error: "Add at least one exercise." };
  if (steps.length > MAX_STEPS) return { ok: false, error: `A routine can have up to ${MAX_STEPS} exercises.` };
  for (const s of steps) {
    if (!EXERCISES.includes(s.exercise)) return { ok: false, error: `Unknown exercise: ${s.exercise}` };
    const [lo, hi] = LIMITS[unitFor(s.exercise)];
    if (!(s.amount >= lo && s.amount <= hi)) return { ok: false, error: `${s.exercise}: choose ${lo}–${hi} ${unitFor(s.exercise)}.` };
  }
  if (!REST_CHOICES.includes(Number(r.rest))) return { ok: false, error: "Pick a rest time." };
  return { ok: true };
}

/**
 * Save a routine into a list (same name = update it). Returns a new list,
 * or an error if the list is full.
 */
export function saveRoutine(list, routine, max = MAX_ROUTINES) {
  const v = validateRoutine(routine);
  if (!v.ok) return { list, error: v.error };
  const clean = { name: routine.name.trim(), rest: Number(routine.rest), steps: routine.steps.map(normalizeStep) };
  const i = list.findIndex((r) => r.name.toLowerCase() === clean.name.toLowerCase());
  if (i >= 0) return { list: list.map((r, j) => (j === i ? clean : r)), error: null };
  if (list.length >= max) return { list, error: `You can save ${max} routines. Delete one first.` };
  return { list: [...list, clean], error: null };
}

export const deleteRoutine = (list, name) => list.filter((r) => r.name !== name);

/** Session options for one step: always an "Analyze a set". */
export function stepSession(step) {
  return step.unit === "seconds"
    ? { mode: "set", setReps: Math.max(1, Math.round(step.amount / 6)), holdSeconds: step.amount }
    : { mode: "set", setReps: step.amount };
}

export const describeStep = (s) => `${s.exercise} × ${s.amount}${s.unit === "seconds" ? " s" : ""}`;

/** Walks a routine's steps and collects each step's results. */
export class CircuitRunner {
  constructor(routine) {
    this.routine = { ...routine, steps: routine.steps.map(normalizeStep) };
    this.index = 0;
    this.results = [];          // one per step: results object, or null if skipped/ended early
  }

  get steps() { return this.routine.steps; }
  get current() { return this.steps[this.index] ?? null; }
  get next() { return this.steps[this.index + 1] ?? null; }
  get done() { return this.index >= this.steps.length; }
  get progress() { return `${Math.min(this.index + 1, this.steps.length)} of ${this.steps.length}`; }

  /** Finish the current step (with its results, or null) and move on. */
  record(result) {
    if (this.done) return;
    this.results.push(result ?? null);
    this.index++;
  }

  /** Per-step summary for the end of the workout. */
  summary() {
    return this.steps.map((s, i) => {
      const r = this.results[i];
      return { step: describeStep(s), exercise: s.exercise, done: !!r, best: r?.best ?? null, average: r?.average ?? null, reps: r?.repCount ?? 0 };
    });
  }
}
