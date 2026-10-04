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

export class SpeechQueue {
  /**
   * @param backend { speak(text), cancel(), speaking() → bool }
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
  say(text, { priority = 1, maxAgeMs = 4000, key = null, interrupt = false, anytime = false } = {}) {
    if (!this.enabled || !text) return;
    const item = { text, priority, maxAgeMs, key, anytime: anytime || interrupt, at: this.now(), seq: this.seq++ };
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
    // The same sentence twice within a few seconds is never useful.
    if (ready.text === this.lastText && now - this.lastAt < 4000) return null;
    this.lastText = ready.text;
    this.lastAt = now;
    this.backend.speak(ready.text);
    return ready.text;
  }

  /** Forget everything queued and stop talking. */
  clear() {
    this.queue = [];
    this.backend.cancel();
  }

  get pending() { return this.queue.map((q) => q.text); }
}
