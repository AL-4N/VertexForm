/**
 * history.js — progress over time and CSV export (pure, no DOM).
 * Works on store.sessions (js/storage.js).
 */

import { median } from "./geometry.js";

/** Everything the history screen shows for one exercise. */
export function exerciseHistory(sessions, exercise) {
  const list = sessions.filter((s) => s.exercise === exercise);
  const bests = list.map((s) => s.best).filter(Number.isFinite);
  const points = list.map((s) => ({ date: s.date, best: s.best, average: s.average ?? s.best }));
  return {
    count: list.length,
    best: bests.length ? Math.max(...bests) : null,
    average: bests.length ? Math.round(list.reduce((a, s) => a + (s.average ?? s.best), 0) / list.length) : null,
    recentMedian: bests.length ? Math.round(median(bests.slice(-5))) : null,
    points,
    faults: faultTrends(list),
  };
}

/**
 * Most common faults, and whether each is getting rarer: its share of reps
 * in your last 5 sessions versus the ones before.
 * @returns [{ key, count, recent, earlier, trend: "better" | "worse" | "same" | "new" }]
 */
export function faultTrends(list, recentN = 5) {
  const dated = list.filter((s) => s.faults);
  const rate = (arr, key) => {
    const reps = arr.reduce((a, s) => a + (s.reps?.length || 1), 0);
    const n = arr.reduce((a, s) => a + (s.faults?.[key] ?? 0), 0);
    return reps ? n / reps : 0;
  };
  const totals = {};
  for (const s of dated) for (const [k, n] of Object.entries(s.faults)) totals[k] = (totals[k] ?? 0) + n;
  const recent = dated.slice(-recentN), earlier = dated.slice(0, -recentN);
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => {
      const r = rate(recent, key), e = rate(earlier, key);
      const trend = !earlier.length ? "new" : r < e * 0.75 ? "better" : r > e * 1.25 ? "worse" : "same";
      return { key, count, recent: Math.round(r * 100), earlier: Math.round(e * 100), trend };
    });
}

/** One CSV field, quoted when needed (commas, quotes, line breaks, leading spaces). */
export function csvField(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Every saved set as CSV (opens in Excel, Numbers, Google Sheets). */
export function toCSV(sessions) {
  const head = ["date", "exercise", "mode", "best", "average", "reps", "rep_scores", "faults", "active_seconds"];
  const rows = sessions.map((s) => [
    s.date ?? "", s.exercise, s.mode ?? "", s.best, s.average ?? "",
    s.reps?.length ?? "", (s.reps ?? []).join(" "),
    Object.entries(s.faults ?? {}).map(([k, n]) => `${k}:${n}`).join("; "),
    s.activeS ?? "",
  ]);
  return [head, ...rows].map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}
