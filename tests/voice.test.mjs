/**
 * voice.test.mjs — the recorded voice pack covers everything the coach can
 * say, so nothing silently falls back to the robotic system voice.
 *
 *   - every phrase in coaching.js (js/phrases.js) and the numbers 0–100 have
 *     a clip in each voice's manifest, and the files exist;
 *   - the real coach, run through thousands of simulated reps in every
 *     exercise, personality and chattiness, only ever says recorded phrases;
 *   - the pack stays a sensible size.
 *
 * If this fails after adding or changing a phrase: run `npm run voice`.
 */
import fs from "node:fs";
import path from "node:path";
import { allPhrases, NUMBERS } from "../public/js/phrases.js";
import { numberKey, partKey } from "../public/js/speech.js";
import { VOICES, PERSONALITY_VOICE } from "../public/js/voices.js";
import { Coach } from "../public/js/coach.js";
import { REGISTRY } from "../public/js/exercises/index.js";
import { PERSONALITIES, SYSTEM, SETUP_CUES, FRAMING, REST_SECONDS } from "../public/js/coaching.js";
import { restCue } from "../public/js/rest.js";
import { rng } from "./helpers/synth.mjs";

const AUDIO = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public", "audio");
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} ${detail}`);
};

const phrases = allPhrases();
const keys = [...phrases, ...NUMBERS.map(numberKey)];
let totalBytes = 0;

for (const voice of Object.keys(VOICES)) {
  const mf = path.join(AUDIO, voice, "manifest.json");
  if (!fs.existsSync(mf)) { check(`${voice}: manifest exists`, false, "run npm run voice"); continue; }
  const { clips } = JSON.parse(fs.readFileSync(mf, "utf8"));
  const missing = keys.filter((k) => !clips[k]);
  check(`${voice}: every phrase + 0–100 recorded`, !missing.length, missing.length ? `${missing.length} missing, e.g. ${JSON.stringify(missing.slice(0, 3))} — run npm run voice` : `${keys.length} clips`);
  const files = Object.values(clips).map(([f]) => f);
  const absent = files.filter((f) => !fs.existsSync(path.join(AUDIO, voice, f)));
  check(`${voice}: every clip file exists`, !absent.length, absent.length ? `${absent.length} missing files` : "");
  const durations = Object.values(clips).map(([, ms]) => ms);
  check(`${voice}: clips are trimmed (none silent, none over 8 s)`, durations.every((ms) => ms > 150 && ms < 8000), `${Math.min(...durations)}–${Math.max(...durations)} ms`);
  const bytes = fs.readdirSync(path.join(AUDIO, voice)).filter((f) => f.endsWith(".mp3")).reduce((a, f) => a + fs.statSync(path.join(AUDIO, voice, f)).size, 0);
  totalBytes += bytes;
}
check("Each personality has a voice", PERSONALITIES.every((p) => VOICES[PERSONALITY_VOICE[p]]));
check(`Voice pack under 25 MB in total`, totalBytes < 25 * 1048576, `${(totalBytes / 1048576).toFixed(1)} MB`);

/* ── The coach only ever says recorded phrases ─────────────── */
const known = new Set(keys);
const unknown = new Set();
const say = (parts) => parts.forEach((p) => { if (!known.has(partKey(p))) unknown.add(String(p)); });
const r = rng(5);
for (const [name, ex] of Object.entries(REGISTRY)) {
  const faultKeys = Object.keys((await import("../public/js/coaching.js")).FAULTS[name] ?? {});
  for (const personality of PERSONALITIES) {
    for (const chattiness of ["quiet", "normal", "detailed"]) {
      const coach = new Coach(ex, { personality, chattiness, target: 90, random: r });
      const details = [];
      for (let i = 0; i < 120; i++) {
        // Random reps: good, near misses, faulty, with random faults and measurements.
        const faults = faultKeys.filter(() => r() < 0.25).map((key) => ({ key, severity: 1 + Math.floor(r() * 3) }));
        const score = faults.length ? 40 + Math.floor(r() * 55) : 85 + Math.floor(r() * 16);
        const measures = { knee: 70 + r() * 90, lean: r() * 60, depthDeg: -10 + r() * 40, elbow: 70 + r() * 80, bodyLine: r() * 20, sag: (r() - 0.5) * 0.1, armRaise: r() * 0.3, legSpread: r() * 2, hipY: 0.6 };
        const rep = { score, faults, measures, duration: 0.6 + r() * 3, index: i % 15 + 1 };
        for (const line of coach.onRep(rep, { setReps: 10 })) say(line.parts);
        if (r() < 0.1) coach.onNoRep().forEach((l) => say(l.parts));
        if (r() < 0.05) coach.onRest().forEach((l) => say(l.parts));
        details.push({ score, measures, faults: faults.map((f) => f.key) });
      }
      const summary = coach.summary({ reps: details.map((d) => d.score), best: 99, average: 77, isHold: !!ex.isHold, bars: [], details });
      say(summary.parts);
      const counts = Object.fromEntries(faultKeys.map((k) => [k, Math.floor(r() * 4)]));
      const brief = coach.briefing({ reps: [80], faults: counts });
      if (brief) say([brief]);
    }
  }
}
// System lines the app says outside the coach.
say([SYSTEM.go, SYSTEM.startRep, SYSTEM.startHold, SYSTEM.setComplete, SYSTEM.targetReached, SYSTEM.workoutStart, SYSTEM.firstUp, SYSTEM.workoutDone, SYSTEM.workoutEnded, 92, SYSTEM.sample, ...SYSTEM.tempo]);
for (const n of REST_SECONDS) say([SYSTEM.rest(n), SYSTEM.nextUp, SYSTEM.name("Squat")]);
for (const auto of [true, false]) for (let s = 90; s >= 0; s--) { const c = restCue(s + 1, s, 90, auto); if (c != null) say([c]); }
say([...Object.values(SETUP_CUES), ...Object.values(FRAMING)]);
check("The coach and app only say recorded phrases", !unknown.size, unknown.size ? [...unknown].slice(0, 5).join(" | ") : `checked ${PERSONALITIES.length * 3 * Object.keys(REGISTRY).length * 120} simulated reps`);

/* ── The website speaks in the same recorded voice ──────── */
// The homepage voice demo and the Form Lab's play button use these clips too,
// so every line they can say must be recorded (or they'd sound robotic).
const { DEMO, DEMO_SCORES } = await import("../public/js/site/coach-lines.js");
const { LAB, evaluate } = await import("../public/js/figures/lab.js");
const site = new Set();
const sayOnSite = (parts) => parts.forEach((p) => { if (!known.has(partKey(p))) site.add(String(p)); });
for (const lines of Object.values(DEMO)) lines.forEach((parts, i) => sayOnSite([DEMO_SCORES[i], ...parts]));
let labLines = 0;
for (const [id, lab] of Object.entries(LAB)) {
  const settings = [...lab.presets.map((p) => p.v)];
  // Every slider at its ends and middle too, not just the presets.
  for (const sl of lab.sliders) for (const val of [sl.min, (sl.min + sl.max) / 2, sl.max]) settings.push({ ...lab.presets[0].v, [sl.key]: val });
  for (const v of settings) { const { m, parts } = evaluate(id, v); sayOnSite([Math.round(m.score), ...parts]); labLines++; }
}
check("The website's demo and Form Lab only say recorded phrases", !site.size, site.size ? [...site].slice(0, 4).join(" | ") : `${labLines} Form Lab poses + ${Object.keys(DEMO).length * 3} demo lines`);

console.log(`\nVoice pack: ${(totalBytes / 1048576).toFixed(1)} MB (${Object.keys(VOICES).length} voices × ${keys.length} clips)`);
console.log(`${fail ? `${fail} voice check(s) FAILED` : "All voice checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
