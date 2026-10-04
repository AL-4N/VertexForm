/**
 * voice.js — spoken coaching via the Web Speech API.
 * Replaces the macOS `say` command from the desktop version, and works in
 * every modern browser with no install.
 *
 * Everything spoken goes through one SpeechQueue (js/speech.js), so lines
 * never overlap. `voice` is the backend that actually talks; `speech` is
 * the queue the rest of the app uses.
 */

import { SpeechQueue } from "./speech.js";

class VoiceCoach {
  constructor() {
    this.enabled = true;
    this.rate = 1.08;       // 0.7 – 1.5
    this.volume = 1;        // 0 – 1
    this.current = null;    // utterance being spoken
    this.lastSpoken = 0;
    this.supported = typeof window !== "undefined" && "speechSynthesis" in window;
    this.voice = null;
    if (this.supported) {
      const pick = () => {
        const vs = speechSynthesis.getVoices();
        // Prefer a natural-sounding English voice when one exists.
        this.voice =
          vs.find((v) => /Samantha|Google US English|Microsoft Aria/i.test(v.name)) ||
          vs.find((v) => v.lang?.startsWith("en")) ||
          vs[0] || null;
      };
      pick();
      speechSynthesis.addEventListener?.("voiceschanged", pick);
    }
  }

  /* ── Backend for the SpeechQueue ─────────────────────── */

  speak(text) {
    if (!this.enabled || !this.supported || !text || this.volume <= 0) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = this.rate;
    u.pitch = 1.0;
    u.volume = this.volume;
    if (this.voice) u.voice = this.voice;
    const done = () => { if (this.current === u) this.current = null; };
    u.onend = done;
    u.onerror = done;
    // Some browsers occasionally never fire onend: don't let that block the queue.
    const words = text.split(/\s+/).length;
    setTimeout(done, (words / (2.6 * this.rate)) * 1000 + 1500);
    this.current = u;
    speechSynthesis.speak(u);
    this.lastSpoken = performance.now() / 1000;
  }

  cancel() {
    this.current = null;
    if (this.supported) speechSynthesis.cancel();
  }

  speaking() {
    return !!this.current || (this.supported && speechSynthesis.speaking);
  }

  /* ── Simple API (setup cues, countdown) ───────────────── */

  /**
   * @param text      what to say
   * @param interrupt cut in now (use for key events)
   * @param minGap    seconds that must have passed since the last line said this way
   */
  say(text, { interrupt = false, minGap = 0, priority } = {}) {
    if (!this.enabled || !text) return;
    const now = performance.now() / 1000;
    if (minGap && now - (this.lastSay ?? -Infinity) < minGap) return;
    this.lastSay = now;
    speech.say(text, { interrupt, anytime: true, priority: priority ?? (interrupt ? 5 : 1), maxAgeMs: 3000 });
  }

  stop() {
    speech.clear();
  }
}

export const voice = new VoiceCoach();
export const speech = new SpeechQueue(voice);

/**
 * When coaching lines may be spoken. live.js swaps this for "not mid-rep"
 * while a session runs; elsewhere anything can be said straight away.
 */
speech.gate = () => true;
if (typeof window !== "undefined") setInterval(() => speech.tick(speech.gate()), 150);

/** Apply the voice settings. */
export function configureVoice({ enabled, rate, volume } = {}) {
  if (enabled != null) { voice.enabled = enabled; speech.enabled = enabled; if (!enabled) speech.clear(); }
  if (rate != null) voice.rate = rate;
  if (volume != null) voice.volume = volume;
}

/** Short synthesised beep — no audio files needed. Respects the volume setting. */
let audioCtx = null;
export function beep(freq = 660, ms = 110, gain = 0.05) {
  try {
    if (voice.volume <= 0) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    g.gain.value = gain * voice.volume;
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* audio is a nicety, never break the app over it */ }
}
