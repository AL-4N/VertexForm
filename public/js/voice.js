/**
 * voice.js — the coach's voice.
 *
 * Plays pre-recorded neural-voice clips (Kokoro-82M, rendered by
 * `npm run voice` into public/audio/) with the Web Audio API. A line is
 * built from parts — [92, "Better, that one hit parallel."] — one clip per
 * part, scheduled on the audio clock with exact pauses (js/speech.js
 * planLine): ~250 ms after a score, ~400 ms between sentences.
 *
 * Clips are loaded once and cached (the browser keeps the files; the
 * service worker keeps them offline). If any part of a line has no clip, or
 * audio can't load, the whole line falls back to the browser's built-in
 * speech (Web Speech), so nothing is ever silently skipped. Setting
 * "System voice" uses Web Speech for everything.
 *
 * Everything said goes through one SpeechQueue: `voice` below is the
 * backend that actually talks; `speech` is the queue the app uses.
 */

import { SpeechQueue, planLine, partKey } from "./speech.js";
import { PERSONALITY_VOICE, VOICES } from "./voices.js";

const AUDIO_ROOT = "audio";

class VoiceCoach {
  constructor() {
    this.enabled = true;
    this.muted = false;
    this.rate = 1.05;       // system voice speed; for clips it tightens/loosens the pauses
    this.volume = 1;        // 0 – 1
    this.voiceId = "auto";  // auto (by personality) | a VOICES id | "system"
    this.personality = "Chill";
    this.current = null;    // the line being said: { cancel() }
    this.ctx = null;
    this.manifests = new Map();   // voice → Promise<{ key: [file, ms] }>
    this.buffers = new Map();     // url → Promise<AudioBuffer>
    this.web = typeof window !== "undefined" && "speechSynthesis" in window;
    this.webVoice = null;
    if (this.web) {
      const pick = () => {
        const vs = speechSynthesis.getVoices();
        this.webVoice = vs.find((v) => /Samantha|Google US English|Microsoft Aria/i.test(v.name)) || vs.find((v) => v.lang?.startsWith("en")) || vs[0] || null;
      };
      pick();
      speechSynthesis.addEventListener?.("voiceschanged", pick);
    }
  }

  /** The recorded voice to use now, or null for the system voice. */
  clipVoice() {
    if (this.voiceId === "system") return null;
    const id = this.voiceId === "auto" ? PERSONALITY_VOICE[this.personality] : this.voiceId;
    return VOICES[id] ? id : PERSONALITY_VOICE.Chill;
  }

  /** The audio context, created/resumed on a user gesture (browsers require one). */
  audio() {
    if (!this.ctx) {
      const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  manifest(voice) {
    if (!this.manifests.has(voice)) {
      const p = fetch(`${AUDIO_ROOT}/${voice}/manifest.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((m) => m.clips);
      p.catch(() => this.manifests.delete(voice));     // try again next time
      this.manifests.set(voice, p);
    }
    return this.manifests.get(voice);
  }

  buffer(voice, file) {
    const url = `${AUDIO_ROOT}/${voice}/${file}`;
    if (!this.buffers.has(url)) {
      const ctx = this.audio();
      const p = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${url}`)))).then((b) => ctx.decodeAudioData(b));
      p.catch(() => this.buffers.delete(url));
      this.buffers.set(url, p);
    }
    return this.buffers.get(url);
  }

  /** Fetch + decode clips ahead of time (session start): no delay when they're needed. */
  async preload(parts) {
    const voice = this.clipVoice();
    if (!voice || !this.audio()) return;
    try {
      const clips = await this.manifest(voice);
      await Promise.all(parts.map((p) => clips[partKey(p)]).filter(Boolean).map(([f]) => this.buffer(voice, f).catch(() => null)));
    } catch { /* fine: lines will load on demand or fall back */ }
  }

  /* ── Backend for the SpeechQueue ─────────────────────── */

  speak(item) {
    if (!this.enabled || this.muted || this.volume <= 0) return;
    const token = { cancelled: false, cancel: () => {} };
    this.current = token;
    const done = () => { if (this.current === token) this.current = null; };
    this.playClips(item, token).then((ok) => {
      if (token.cancelled) return done();
      if (ok) return done();
      this.speakWeb(item.text, token).then(done);
    });
    // Never let a stuck line block the queue.
    setTimeout(done, 15000);
  }

  /** @returns true if the whole line was played from clips. */
  async playClips(item, token) {
    const voice = this.clipVoice();
    const ctx = voice && this.audio();
    if (!ctx) return false;
    try {
      const clips = await this.manifest(voice);
      const entries = item.parts.map((p) => clips[partKey(p)]);
      if (entries.some((e) => !e)) return false;                 // a part with no recording: system voice for the line
      const bufs = await Promise.all(entries.map(([f]) => this.buffer(voice, f)));
      if (token.cancelled) return true;
      const { starts, total } = planLine(item.parts, bufs.map((b) => b.duration * 1000), this.rate / 1.05);
      const t0 = ctx.currentTime + 0.03;
      this.out.gain.value = this.volume;
      const sources = bufs.map((b, i) => {
        const src = ctx.createBufferSource();
        src.buffer = b;
        src.connect(this.out);
        src.start(t0 + starts[i] / 1000);
        return src;
      });
      token.cancel = () => sources.forEach((s) => { try { s.stop(); } catch { /* not started */ } });
      await new Promise((r) => setTimeout(r, total + 60));
      return true;
    } catch (err) {
      console.warn("[voice] clip playback failed, using the system voice:", err?.message ?? err);
      return false;
    }
  }

  speakWeb(text, token) {
    if (!this.web || !text) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = this.rate;
      u.volume = this.volume;
      if (this.webVoice) u.voice = this.webVoice;
      u.onend = u.onerror = () => resolve();
      token.cancel = () => { speechSynthesis.cancel(); resolve(); };
      speechSynthesis.speak(u);
      setTimeout(resolve, (text.split(/\s+/).length / (2.6 * this.rate)) * 1000 + 1500);
    });
  }

  cancel() {
    if (this.current) { this.current.cancelled = true; this.current.cancel(); }
    this.current = null;
    if (this.web) speechSynthesis.cancel();
  }

  speaking() {
    return !!this.current;
  }

  /* ── Simple API (setup cues, countdown, system lines) ── */

  /**
   * @param line      a phrase, or parts like [3] or ["Rest 60 seconds.", "Next up:", "Squat."]
   * @param interrupt cut in now (use for key events)
   * @param minGap    seconds that must have passed since the last line said this way
   */
  say(line, { interrupt = false, minGap = 0, priority, maxAgeMs = 3000 } = {}) {
    if (!this.enabled || !line) return;
    const now = performance.now() / 1000;
    if (minGap && now - (this.lastSay ?? -Infinity) < minGap) return;
    this.lastSay = now;
    speech.say(line, { interrupt, anytime: true, priority: priority ?? (interrupt ? 5 : 1), maxAgeMs });
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
if (typeof window !== "undefined") {
  setInterval(() => speech.tick(speech.gate()), 100);
  // Browsers only allow audio after a click or key press: wake it up on the first one.
  const unlock = () => voice.audio();
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });
}

/** Mute everything (voice and beeps) for now, without changing the saved Voice setting. */
export function setMuted(muted) {
  voice.muted = muted;
  speech.enabled = voice.enabled && !muted;
  if (muted) speech.clear();
}
export const isMuted = () => !!voice.muted;

/** Apply the voice settings. */
export function configureVoice({ enabled, rate, volume, voiceId, personality } = {}) {
  if (enabled != null) { voice.enabled = enabled; speech.enabled = enabled && !voice.muted; if (!enabled) speech.clear(); }
  if (rate != null) voice.rate = rate;
  if (volume != null) voice.volume = volume;
  if (voiceId != null) voice.voiceId = voiceId;
  if (personality != null) voice.personality = personality;
}

/** Short synthesised beep — no audio files needed. Ducked while the coach is talking. */
export function beep(freq = 660, ms = 110, gain = 0.05) {
  try {
    if (voice.volume <= 0 || voice.muted) return;
    const ctx = voice.audio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    // Duck: much quieter under the voice, so a beep never masks a word.
    g.gain.value = gain * voice.volume * (voice.speaking() ? 0.3 : 1);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  } catch { /* audio is a nicety, never break the app over it */ }
}
