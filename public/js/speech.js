/**
 * speech.js — one queue for everything the coach says (pure logic; the
 * actual voice is plugged in as a "backend", so tests can use a fake one).
 *
 * Rules:
 *   - One line at a time: nothing overlaps or talks over itself.
 *   - Coaching waits for a good moment: live.js passes canSpeak = true only
 *     at the top of a rep or while resting, never mid-rep. Lines marked
 *     `anytime` (setup problems, the countdown, tempo) skip that wait.
 *   - Priorities: when several lines wait, the most important goes first.
 *   - No pile-ups: stale lines expire (maxAgeMs), a line with the same `key`
 *     replaces the queued one, and the queue holds at most 3 lines.
 *   - `interrupt` cuts in now (set complete, Back pressed) and drops
 *     anything less important.
 */

/**
 * Pauses between the parts of a line, in ms. A score is followed by a short
 * beat ("92 … nice depth"); separate sentences get a clear gap.
 */
export const PAUSE = { afterNumber: 250, betweenSentences: 400, beforeNumber: 120 };

/** The manifest key for a number (scores, averages, countdown). */
export const numberKey = (n) => `#${n}`;

/** A line's parts as manifest keys: numbers → "#92", phrases as written. */
export const partKey = (p) => (typeof p === "number" ? numberKey(Math.round(p)) : p);

/**
 * When each part of a line starts, given each part's clip length (ms).
 * @param parts      e.g. [92, "Better, that one hit parallel.", "Go lower"]
 * @param durations  ms per part, same order
 * @param pace       1 = normal; > 1 shortens the pauses
 * @returns { starts: [ms], total: ms }
 */
export function planLine(parts, durations, pace = 1) {
  const starts = [];
  let t = 0;
  parts.forEach((p, i) => {
    if (i > 0) {
      const prev = parts[i - 1];
      const gap = typeof prev === "number" ? PAUSE.afterNumber
        : typeof p === "number" ? PAUSE.beforeNumber : PAUSE.betweenSentences;
      t += gap / pace;
    }
    starts.push(Math.round(t));
    t += durations[i];
  });
  return { starts, total: Math.round(t) };
}

export class SpeechQueue {
  /**
   * @param backend { speak(item: { text, parts }), cancel(), speaking() → bool }
   * @param opts    { now: () => ms, maxQueue }
   */
  constructor(backend, { now = () => performance.now(), maxQueue = 3 } = {}) {
    this.backend = backend;
    this.now = now;
    this.maxQueue = maxQueue;
    this.queue = [];
    this.seq = 0;
    this.lastText = "";
    this.lastAt = -Infinity;
    this.enabled = true;
  }

  /**
   * Queue a line.
   * @param opts { priority (higher first), maxAgeMs, key, interrupt, anytime }
   */
  say(line, { priority = 1, maxAgeMs = 4000, key = null, interrupt = false, anytime = false } = {}) {
    if (!this.enabled || !line || (Array.isArray(line) && !line.length)) return;
    // A line is a phrase, or parts: [92, "Nice."] (see js/coach.js).
    const parts = Array.isArray(line) ? line : [line];
    const text = parts.map((p) => (typeof p === "number" ? `${p}.` : p)).join(" ");
    const item = { text, parts, priority, maxAgeMs, key, interrupt, anytime: anytime || interrupt, at: this.now(), seq: this.seq++ };
    if (interrupt) {
      this.backend.cancel();
      this.queue = this.queue.filter((q) => q.priority > priority);
      this.queue.unshift(item);
      this.tick(true);
      return;
    }
    if (key) this.queue = this.queue.filter((q) => q.key !== key);
    this.queue.push(item);
    if (this.queue.length > this.maxQueue) {
      // Drop the least important (oldest among equals).
      this.queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
      this.queue.length = this.maxQueue;
    }
  }

  /**
   * Speak the next line if it's a good moment. Call every frame (and on a
   * timer). @returns the text spoken, or null.
   */
  tick(canSpeak) {
    const now = this.now();
    this.queue = this.queue.filter((q) => now - q.at <= q.maxAgeMs);
    if (!this.queue.length || this.backend.speaking()) return null;
    const ready = this.queue
      .filter((q) => canSpeak || q.anytime)
      .sort((a, b) => b.priority - a.priority || a.seq - b.seq)[0];
    if (!ready) return null;
    this.queue = this.queue.filter((q) => q !== ready);
    // The same sentence twice within a few seconds is never useful (unless
    // it was asked for: an interrupting line, like the Test voice button).
    if (!ready.interrupt && ready.text === this.lastText && now - this.lastAt < 4000) return null;
    this.lastText = ready.text;
    this.lastAt = now;
    this.backend.speak(ready);
    return ready.text;
  }

  /**
   * Forget queued lines with this key (not one already being said), e.g.
   * the last rep's feedback once a new rep has started.
   */
  drop(key) {
    this.queue = this.queue.filter((q) => q.key !== key);
  }

  /** Forget everything queued and stop talking. */
  clear() {
    this.queue = [];
    this.backend.cancel();
  }

  get pending() { return this.queue.map((q) => q.text); }
}
