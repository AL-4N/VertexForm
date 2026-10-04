/**
 * storage.js — persistence via localStorage.
 * Replaces the JSON file the desktop version wrote to the home folder.
 */

const KEY = "workout-analyzer:v1";

const BLANK = {
  bests: {},        // { exercise: bestScore }
  history: {},      // { exercise: [score, ...] }  (capped)
  stats: { totalReps: 0, goodReps: 0, tried: [] },
  unlocked: [],     // achievement ids
  days: [],         // local dates (YYYY-MM-DD) with at least one scored set
  settings: {},     // overrides of DEFAULTS
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(BLANK);
    const d = JSON.parse(raw);
    return { ...structuredClone(BLANK), ...d };
  } catch {
    return structuredClone(BLANK);
  }
}

export const store = read();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch { /* private mode / quota — the app still works, just won't persist */ }
}

export function recordScore(exercise, score) {
  store.history[exercise] = store.history[exercise] || [];
  store.history[exercise].push(score);
  // Keep the file small: last 200 attempts per exercise.
  store.history[exercise] = store.history[exercise].slice(-200);

  if (!store.stats.tried.includes(exercise)) store.stats.tried.push(exercise);
  markDay();

  let isBest = false;
  if (score > (store.bests[exercise] ?? -1)) {
    store.bests[exercise] = score;
    isBest = true;
  }
  save();
  return isBest;
}

export function countRep(score, target) {
  store.stats.totalReps += 1;
  if (score >= target) store.stats.goodReps += 1;
  save();
}

export function globalAverage() {
  const all = Object.values(store.history).flat();
  if (!all.length) return null;
  return Math.round(all.reduce((a, b) => a + b, 0) / all.length);
}

export function resetExercise(exercise) {
  delete store.bests[exercise];
  save();
}

export function resetAll() {
  store.bests = {};
  store.history = {};
  store.stats = { totalReps: 0, goodReps: 0, tried: [] };
  store.unlocked = [];
  store.days = [];
  save();
}

/* ── Day streak ─────────────────────────────────────── */

// Local calendar date, so "today" means today where you are.
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function markDay(date = new Date()) {
  store.days = store.days || [];
  const k = dayKey(date);
  if (!store.days.includes(k)) store.days = [...store.days, k].slice(-400);
}

/** Days in a row with training, ending today (or yesterday, if not yet today). */
export function dayStreak(now = new Date()) {
  const have = new Set(store.days || []);
  const d = new Date(now);
  if (!have.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (have.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function getSetting(key, fallback) {
  return store.settings[key] ?? fallback;
}

export function setSetting(key, value) {
  store.settings[key] = value;
  save();
}
