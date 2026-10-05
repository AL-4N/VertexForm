/**
 * voices.js — which recorded voice each personality uses (one config object).
 * The voice pack in public/audio/ is rendered from this by `npm run voice`
 * (scripts/build-voice.mjs, Kokoro-82M, Apache-2.0). Changing a voice or
 * speed here and re-running renders a fresh set.
 */
export const VOICES = {
  af_heart:   { label: "Heart: calm",      speed: 0.95 },
  af_bella:   { label: "Bella: energetic", speed: 1.08 },
  am_michael: { label: "Michael: firm",    speed: 1.0 },
};

/** The voice each personality speaks with, when the voice setting is "auto". */
export const PERSONALITY_VOICE = { Chill: "af_heart", Hype: "af_bella", Coach: "am_michael" };
