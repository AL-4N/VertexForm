/**
 * coach.js — the AI coach summary's rules (pure; tests/weekly.test.mjs).
 *
 * The browser sends its last 7 days as a few numbers (public/js/weekly.js).
 * Everything here treats that as untrusted: it's rebuilt field by field,
 * clamped, and any text must look like a VertexForm exercise, fault or
 * skill name, so nothing else can reach the prompt.
 */

export const MODEL = "claude-opus-5-5";
export const MAX_BODY = 8 * 1024;

const EXERCISES = ["Squat", "Push-up", "Plank", "Lunge", "Jumping Jack"];
const NAME = /^[A-Za-z0-9 ,.'()+°-]{1,48}$/;
const int = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : null);
const name = (v) => (typeof v === "string" && NAME.test(v) ? v : null);
const names = (v, max) => (Array.isArray(v) ? v.map(name).filter(Boolean).slice(0, max) : []);

/** The week's numbers, cleaned; null if they're not usable. */
export function cleanWeek(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.exercises)) return null;
  const exercises = raw.exercises.slice(0, EXERCISES.length).map((e) => {
    if (!e || !EXERCISES.includes(e.name)) return null;
    return {
      name: e.name,
      sets: int(e.sets, 0, 500), reps: int(e.reps, 0, 20000),
      average: int(e.average, 0, 100), best: int(e.best, 0, 100),
      lastWeekAverage: e.lastWeekAverage == null ? null : int(e.lastWeekAverage, 0, 100),
      faults: (Array.isArray(e.faults) ? e.faults : []).slice(0, 3)
        .map((f) => (name(f?.label) ? { label: f.label, reps: int(f.reps, 0, 20000) } : null)).filter(Boolean),
    };
  }).filter(Boolean);
  if (!exercises.length) return null;
  const c = raw.challenge;
  return {
    activeDays: int(raw.activeDays, 0, 7) ?? 0,
    exercises,
    skills: { unlocked: names(raw.skills?.unlocked, 30), next: names(raw.skills?.next, 10) },
    challenge: c && name(c.name) ? {
      name: c.name, day: int(c.day, 1, 365), of: int(c.of, 1, 365), daysDone: int(c.daysDone, 0, 365),
      state: ["active", "complete", "broken"].includes(c.state) ? c.state : "active", todayDone: c.todayDone === true,
    } : null,
  };
}

export const SYSTEM = `You write the weekly review for someone using VertexForm, a webcam form coach. It grades every rep from 0 to 100 (90 and up is an A, 80s a B, 70s a C), names the faults it sees, and has a skill path and daily challenges.

You get their last 7 days as JSON. Write to them, in under 120 words, as three short paragraphs:
1. What went well this week, with one real number from the data.
2. The one fault to work on next (the one seen in the most reps), and a simple cue for fixing it.
3. What to do next week: point to their next skill or their challenge day if they have one, otherwise a small specific goal.

Use only what's in the data: never invent sets, scores, exercises or dates. If they barely trained, say so kindly and give one easy goal. Plain and direct, second person, sentence case. No headings, lists, emoji, or em dashes. Coaching for form only, not medical advice.`;

/** The Messages API request body for a cleaned week. */
export function requestBody(week) {
  return {
    model: MODEL,
    max_tokens: 4000,                    // a public endpoint: keep each summary's cost bounded
    output_config: { effort: "low" },    // a short summary doesn't need deep thinking
    fallbacks: "default",                // if a safeguard declines, retry on Anthropic's recommended model
    system: SYSTEM,
    messages: [{ role: "user", content: `My training data for the last 7 days:\n\n${JSON.stringify(week, null, 2)}` }],
  };
}

/** The summary text from a Messages API response, or an error code. */
export function readReply(data) {
  if (data?.stop_reason === "refusal") return { error: "declined" };
  const text = (data?.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return text ? { text } : { error: "empty" };
}
