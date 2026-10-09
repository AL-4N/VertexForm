/**
 * weekly.js — your last 7 days as a few numbers, for the AI coach summary
 * (pure logic, no DOM; tests/weekly.test.mjs).
 *
 * This is everything that leaves the device when you ask for a summary:
 * per exercise, how many sets and reps, the average and best score, last
 * week's average, and the faults seen most; plus skill names and your
 * challenge day. No video, no landmarks, no dates beyond "last 7 days",
 * nothing that identifies you.
 */

import { faultLabel } from "./coaching.js";
import { skillPath } from "./skills.js";
import { challengeStatus } from "./challenges.js";

const DAY = 86400000;
const local = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function summarise(list) {
  const reps = list.reduce((n, s) => n + (s.reps?.length ?? 0), 0);
  const weighted = list.reduce((n, s) => n + (s.average ?? 0) * (s.reps?.length ?? 0), 0);
  return { sets: list.length, reps, average: reps ? Math.round(weighted / reps) : null, best: Math.max(...list.map((s) => s.best ?? 0)) };
}

/**
 * opts: { sessions, skills (kept ids), challenge (store.challenge), now }.
 * Returns the summary payload, or null if there were no sets this week.
 */
export function weekData({ sessions = [], skills = [], challenge = null, now = new Date() } = {}) {
  const t = now.getTime();
  const dated = sessions.filter((s) => s.date);
  const thisWeek = dated.filter((s) => t - Date.parse(s.date) < 7 * DAY && Date.parse(s.date) <= t);
  if (!thisWeek.length) return null;
  const lastWeek = dated.filter((s) => { const a = t - Date.parse(s.date); return a >= 7 * DAY && a < 14 * DAY; });

  const names = [...new Set(thisWeek.map((s) => s.exercise))];
  const exercises = names.map((name) => {
    const mine = thisWeek.filter((s) => s.exercise === name);
    const prev = lastWeek.filter((s) => s.exercise === name);
    const faults = {};
    for (const s of mine) for (const [k, n] of Object.entries(s.faults ?? {})) faults[k] = (faults[k] ?? 0) + n;
    return {
      name, ...summarise(mine),
      lastWeekAverage: prev.length ? summarise(prev).average : null,
      faults: Object.entries(faults).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => ({ label: faultLabel(name, k), reps: n })),
    };
  }).sort((a, b) => b.sets - a.sets);

  const steps = skillPath(sessions, skills).flatMap((p) => p.steps);
  const st = challenge ? challengeStatus(challenge, sessions, now) : null;
  return {
    activeDays: new Set(thisWeek.map((s) => local(new Date(s.date)))).size,
    exercises,
    skills: {
      unlocked: steps.filter((s) => s.status === "done").map((s) => s.name),
      next: steps.filter((s) => s.status === "next").map((s) => s.name),
    },
    challenge: st ? {
      name: st.challenge.name, day: st.day, of: st.challenge.days, daysDone: st.done,
      state: st.state, todayDone: st.days.find((d) => d.n === st.day)?.state === "done",
    } : null,
  };
}
