/**
 * challenges.js — daily challenges (pure logic, no DOM; tests/challenges.test.mjs).
 *
 * A challenge is a run of days, each with the same goal ("one set of 10+
 * squats averaging 80+"). Day 1 is the day you start it. A day counts when
 * one of that day's saved sets meets the goal; miss a day and the challenge
 * is over (start again any time). Finish every day and it's complete.
 *
 * Only the start day is stored (store.challenge); progress is always worked
 * out from your real saved sets (store.sessions), never ticked by hand.
 */

export const CHALLENGES = [
  { id: "squat30",  name: "30 days of squats",    days: 30, goal: "One set of 10+ squats averaging 80+",   test: { exercise: "Squat",   reps: 10, avg: 80 } },
  { id: "pushup30", name: "30 days of push-ups",  days: 30, goal: "One set of 10+ push-ups averaging 80+", test: { exercise: "Push-up", reps: 10, avg: 80 } },
  { id: "lunge14",  name: "Two weeks of lunges",  days: 14, goal: "One set of 10+ lunges averaging 80+",   test: { exercise: "Lunge",   reps: 10, avg: 80 } },
  { id: "plank7",   name: "Plank week",           days: 7,  goal: "Hold a plank for 60 s, averaging 80+",  test: { exercise: "Plank",   seconds: 60, avg: 80 } },
  { id: "clean7",   name: "Clean week",           days: 7,  goal: "Any set of 5+ reps averaging 90+",      test: { exercise: null,      reps: 5, avg: 90 } },
];
export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

/** Local calendar date, YYYY-MM-DD (so "today" means today where you are). */
export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The key for `n` days after a day key. */
export function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

const held = (s) => s.heldS ?? (s.reps?.length ?? 0) * 5;

/** Does one saved set meet a challenge's daily goal? */
export function meetsGoal(test, s) {
  if (test.exercise && s.exercise !== test.exercise) return false;
  if ((s.average ?? 0) < test.avg) return false;
  if (test.seconds) return held(s) >= test.seconds;
  return (s.reps?.length ?? 0) >= test.reps;
}

/**
 * Where a challenge stands. `active` = { id, start } (start is a day key).
 * Returns { challenge, days: [{ key, n, state }], done, day, state } where a
 * day's state is "done" | "missed" | "today" (not done yet) | "todo", the
 * challenge state is "active" | "complete" | "broken", and `day` is today's
 * day number (1-based, capped at the length).
 */
export function challengeStatus(active, sessions, now = new Date()) {
  const ch = CHALLENGE_BY_ID[active?.id];
  if (!ch) return null;
  const today = dayKey(now);
  const doneDays = new Set(
    sessions.filter((s) => s.date && meetsGoal(ch.test, s)).map((s) => dayKey(new Date(s.date))),
  );
  let broken = false, done = 0;
  const days = Array.from({ length: ch.days }, (_, i) => {
    const key = addDays(active.start, i);
    let state;
    if (doneDays.has(key)) { state = "done"; done++; }
    else if (key < today) { state = "missed"; broken = true; }
    else state = key === today ? "today" : "todo";
    return { key, n: i + 1, state };
  });
  const todayIdx = days.findIndex((d) => d.key === today);
  return {
    challenge: ch, days, done,
    day: todayIdx >= 0 ? todayIdx + 1 : Math.min(ch.days, days.filter((d) => d.key <= today).length),
    state: broken ? "broken" : done === ch.days ? "complete" : "active",
  };
}

/** Did today's goal just get met by the newest set (for a one-time "day done" note)? */
export function todayJustDone(active, sessions, now = new Date()) {
  const st = challengeStatus(active, sessions, now);
  if (!st || st.state === "broken") return false;
  const today = dayKey(now);
  const todays = sessions.filter((s) => s.date && dayKey(new Date(s.date)) === today && meetsGoal(st.challenge.test, s));
  return todays.length === 1 && todays[0] === sessions.at(-1);
}
