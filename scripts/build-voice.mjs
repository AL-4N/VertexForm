/**
 * build-voice.mjs — pre-render the coach's voice:   npm run voice
 *
 * Renders every phrase the app can say (js/phrases.js) plus the numbers
 * 0–100 with Kokoro-82M (kokoro-js, Apache-2.0, runs locally on the CPU),
 * in each voice in js/voices.js. Each clip has its silence trimmed (the
 * player adds exact pauses) and is saved as a small mono MP3:
 *
 *   public/audio/<voice>/<hash>.mp3      hash of voice + speed + text
 *   public/audio/<voice>/manifest.json   { "text": ["file.mp3", ms], "#92": [...] }
 *   public/audio/voices.json             the voice list + personality mapping
 *
 * Incremental: existing clips are kept, only new or changed phrases are
 * rendered, and clips no phrase uses any more are deleted. The first run
 * downloads the model (~90 MB) into the Hugging Face cache.
 *
 *   node scripts/build-voice.mjs --voice af_heart    one voice only
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { KokoroTTS } from "kokoro-js";
import { allPhrases, NUMBERS, numberKey } from "../public/js/phrases.js";
import { VOICES, PERSONALITY_VOICE } from "../public/js/voices.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "audio");
const TMP = path.join(ROOT, "node_modules", ".cache", "vf-voice");
const BITRATE = "32k";          // speech at 24 kHz mono: clear, ~4 KB per second
const only = process.argv.includes("--voice") ? process.argv[process.argv.indexOf("--voice") + 1] : null;
fs.mkdirSync(TMP, { recursive: true });

/** Trim leading/trailing silence (keeps 25 ms) so pauses are exactly what the player adds. */
function trim(samples, rate) {
  const thr = 0.012, pad = Math.round(rate * 0.025);
  let a = 0, b = samples.length - 1;
  while (a < b && Math.abs(samples[a]) < thr) a++;
  while (b > a && Math.abs(samples[b]) < thr) b--;
  return samples.subarray(Math.max(0, a - pad), Math.min(samples.length, b + pad));
}

function wav(samples, rate) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return buf;
}

const items = [
  ...allPhrases().map((text) => ({ key: text, say: text })),
  ...NUMBERS.map((n) => ({ key: numberKey(n), say: `${n}.` })),
];

console.log(`Loading Kokoro… (${items.length} clips per voice)`);
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });

for (const [voice, cfg] of Object.entries(VOICES)) {
  if (only && voice !== only) continue;
  const dir = path.join(OUT, voice);
  fs.mkdirSync(dir, { recursive: true });
  const manifestPath = path.join(dir, "manifest.json");
  const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { clips: {} };
  const clips = {};
  let made = 0, kept = 0;
  const t0 = Date.now();
  for (const [i, it] of items.entries()) {
    const file = crypto.createHash("sha1").update(`${voice}|${cfg.speed}|${it.say}`).digest("hex").slice(0, 12) + ".mp3";
    const dest = path.join(dir, file);
    if (fs.existsSync(dest) && old.clips[it.key]?.[0] === file) { clips[it.key] = old.clips[it.key]; kept++; continue; }
    const audio = await tts.generate(it.say, { voice, speed: cfg.speed });
    const s = trim(audio.audio, audio.sampling_rate);
    const tmp = path.join(TMP, `${voice}-${file}.wav`);
    fs.writeFileSync(tmp, wav(s, audio.sampling_rate));
    execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-i", tmp, "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", BITRATE, dest]);
    fs.rmSync(tmp);
    clips[it.key] = [file, Math.round((s.length / audio.sampling_rate) * 1000)];
    made++;
    if (made % 25 === 0) {
      const per = (Date.now() - t0) / made;
      console.log(`  ${voice}: ${i + 1}/${items.length}  (~${Math.round(((items.length - i - 1) * per) / 60000)} min left)`);
    }
  }
  // Delete clips nothing uses any more.
  const used = new Set(Object.values(clips).map(([f]) => f));
  let removed = 0;
  for (const f of fs.readdirSync(dir)) if (f.endsWith(".mp3") && !used.has(f)) { fs.rmSync(path.join(dir, f)); removed++; }
  fs.writeFileSync(manifestPath, JSON.stringify({ voice, speed: cfg.speed, clips }));
  const bytes = fs.readdirSync(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0);
  console.log(`${voice}: ${made} rendered, ${kept} kept, ${removed} removed · ${(bytes / 1048576).toFixed(1)} MB`);
}

fs.writeFileSync(path.join(OUT, "voices.json"), JSON.stringify({
  voices: Object.fromEntries(Object.entries(VOICES).map(([id, v]) => [id, { label: v.label }])),
  personalities: PERSONALITY_VOICE,
}, null, 2) + "\n");
const total = fs.readdirSync(OUT, { recursive: true }).filter((f) => String(f).endsWith(".mp3"))
  .reduce((a, f) => a + fs.statSync(path.join(OUT, String(f))).size, 0);
console.log(`Voice pack: ${(total / 1048576).toFixed(1)} MB in public/audio/`);
