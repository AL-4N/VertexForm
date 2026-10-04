/**
 * voice.js — spoken coaching via the Web Speech API.
 * Replaces the macOS `say` command from the desktop version, and works in
 * every modern browser with no install.
 */

class VoiceCoach {
  constructor() {
    this.enabled = true;
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

  /**
   * @param text      what to say
   * @param interrupt cancel anything currently speaking (use for key events)
   * @param minGap    seconds that must have passed since the last utterance
   */
  say(text, { interrupt = false, minGap = 0 } = {}) {
    if (!this.enabled || !this.supported || !text) return;
    const now = performance.now() / 1000;
    if (now - this.lastSpoken < minGap) return;
    if (speechSynthesis.speaking) {
      if (interrupt) speechSynthesis.cancel();
      else return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.08;
    u.pitch = 1.0;
    if (this.voice) u.voice = this.voice;
    speechSynthesis.speak(u);
    this.lastSpoken = now;
  }

  stop() {
    if (this.supported) speechSynthesis.cancel();
  }
}

export const voice = new VoiceCoach();

/** Short synthesised beep — no audio files needed. */
let audioCtx = null;
export function beep(freq = 660, ms = 110, gain = 0.05) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    g.gain.value = gain;
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* audio is a nicety, never break the app over it */ }
}
