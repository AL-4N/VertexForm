/**
 * storage.js — persistence via localStorage.
 * Replaces the JSON file the desktop version wrote to the home folder.
 */

// The key keeps its original name so saved data from every version is found.
const KEY = "workout-analyzer:v1";
export const VERSION = 2;

const BLANK = {
  version: VERSION,
  bests: {},        // { exercise: bestScore }
  history: {},      // { exercise: [score, ...] }  (capped)
  sessions: [],     // v2: [{ date, exercise, mode, best, average, reps:[...], faults:{key:n}, activeS }]
  routines: [],     // v2: saved circuits (up to 3)
  stats: { totalReps: 0, goodReps: 0, tried: [] },
  unlocked: [],     // achievement ids
  skills: [],       // unlocked skill-path step ids (js/skills.js)
  challenge: null,  // the challenge you're on: { id, start: "YYYY-MM-DD" } (js/challenges.js)
  challengeLog: [], // challenges that ended: [{ id, start, end, result: "complete" | "ended" }]
  days: [],         // local dates (YYYY-MM-DD) with at least one scored set
  settings: {},     // overrides of DEFAULTS
};

/**
 * Bring saved data from any older version up to date (pure, tested).
 *   v1 → v2: adds `sessions` and `routines`. Old per-exercise score lists
 *   become undated session entries, so history charts and the coach's
 *   briefing have something to work with. Nothing is deleted.
 */
export function migrate(d) {
  const out = { ...structuredClone(BLANK), ...(d && typeof d === "object" ? d : {}) };
  out.stats = { ...BLANK.stats, ...(out.stats ?? {}) };
  if (!Array.isArray(out.sessions)) out.sessions = [];
  if (!Array.isArray(out.routines)) out.routines = [];
  if (!Array.isArray(out.skills)) out.skills = [];
  if (!out.challenge || typeof out.challenge !== "object" || !out.challenge.id) out.challenge = null;
  if (!Array.isArray(out.challengeLog)) out.challengeLog = [];
  if (!(d?.version >= 2)) {
    for (const [exercise, scores] of Object.entries(out.history ?? {})) {
      for (const score of Array.isArray(scores) ? scores : []) {
        if (typeof score === "number") out.sessions.push({ date: null, exercise, mode: null, best: score, average: score, reps: [score], faults: {}, legacy: true });
      }
    }
  }
  out.version = VERSION;
  return out;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(BLANK);
    return migrate(JSON.parse(raw));
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

/**
 * Save one finished set for history and the coach's briefing.
 * Fault counts are "in how many reps", like the results screen.
 */
export function recordSession(r, date = new Date()) {
  const faults = {};
  for (const k of r.faults ?? []) faults[k] = (faults[k] ?? 0) + 1;
  store.sessions.push({
    date: date.toISOString(), exercise: r.exercise, mode: r.mode ?? null,
    best: r.best, average: r.average, reps: r.reps.slice(0, 60), faults,
    activeS: r.activeSeconds ?? null,
    heldS: r.isHold ? Math.round((r.durations ?? []).reduce((a, b) => a + b, 0)) : null,
  });
  store.sessions = store.sessions.slice(-500);
  save();
}

/** The most recent saved set of an exercise (or null). */
export function lastSession(exercise) {
  for (let i = store.sessions.length - 1; i >= 0; i--) if (store.sessions[i].exercise === exercise) return store.sessions[i];
  return null;
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
  store.sessions = [];
  store.stats = { totalReps: 0, goodReps: 0, tried: [] };
  store.unlocked = [];
  store.skills = [];
  store.challenge = null;
  store.challengeLog = [];
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
