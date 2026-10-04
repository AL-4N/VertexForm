/**
 * rest.js — what the rest timer says out loud (pure, tested).
 * Called once a second with the seconds left before and after the tick.
 */

/**
 * @param before  seconds left on the previous tick
 * @param now     seconds left now
 * @param total   the rest length
 * @param auto    true if the next set starts by itself (circuits)
 * @returns a line to say, or null
 */
export function restCue(before, now, total, auto) {
  const crossed = (s) => before > s && now <= s;
  if (crossed(0)) return auto ? "Go!" : "Rest's over. Tap Next set when you're ready.";
  for (const s of [3, 2, 1]) if (crossed(s)) return String(s);
  if (total > 20 && crossed(10)) return "Ten seconds.";
  if (total >= 60 && crossed(30)) return "Thirty seconds left.";
  return null;
}

/** "1:05" */
export function mmss(s) {
  const t = Math.ceil(Math.max(0, s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
