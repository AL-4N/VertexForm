/**
 * coach.js — the smarter coach (pure logic, no DOM, no audio).
 *
 * Decides WHAT to say; js/speech.js decides WHEN (only at the top of a rep
 * or while resting, one line at a time). Fed one event at a time by
 * live.js, and tested on its own in tests/coach.test.mjs.
 *
 *   Impact first     the cue is for the fault that would add the most points
 *                    if fixed (re-grading the rep with that fault corrected),
 *                    not just the "most severe" one.
 *   Trends           depth fading over the set (fatigue), tempo speeding up,
 *                    a groove of clean reps.
 *   Reinforcement    when the fault from last rep is gone: "Better, that one
 *                    hit parallel."
 *   Escalation       same fault again → a different phrasing; a third time →
 *                    a concrete physical cue. Never the same sentence twice
 *                    in a row.
 *   Briefing / summary  from your history, and after the set: strengths, the
 *                    one thing to fix, and a concrete target.
 *
 * Chattiness: "quiet" (score only), "normal", "detailed" (adds trends and a
 * fuller summary).
 */

import {
  FAULTS, CONCRETE, FIXED, FOCUS, COACH_LINES, PRAISE, NEAR_MISS, NO_REP, MILESTONES, SYSTEM,
  faultLabel, faultSeverity,
} from "./coaching.js";
import { median } from "./geometry.js";

export const CHATTINESS = ["quiet", "normal", "detailed"];

/**
 * A spoken line is a list of PARTS: numbers (said as numbers, e.g. a score)
 * and whole phrases from coaching.js. The voice plays one recorded clip per
 * part with set pauses between them (js/voice.js); `text` is the same line
 * for the screen and the fallback system voice.
 */
export const partsText = (parts) => parts.map((p) => (typeof p === "number" ? `${p}.` : p)).join(" ").replace(/\s+/g, " ").trim();

export class Coach {
  /**
   * @param ex    exercise module (js/exercises/*)
   * @param opts  { personality, chattiness, target, random }
   */
  constructor(ex, { personality = "Chill", chattiness = "normal", target = 90, random = Math.random } = {}) {
    this.ex = ex;
    this.name = ex.name;
    this.personality = COACH_LINES.reinforce[personality] ? personality : "Chill";
    this.chattiness = CHATTINESS.includes(chattiness) ? chattiness : "normal";
    this.target = target;
    this.random = random;
    this.repeats = new Map();      // fault key → times it was the cue in a row
    this.rotation = new Map();     // bank id → next index
    this.lastLine = "";
    this.prev = null;              // previous rep { score, topKey, faultKeys }
    this.cleanRun = 0;
    this.grooveSaid = false;
    this.cooldown = { fatigue: 0, rushing: 0 };
    this.reps = [];                // { score, measures, duration }
  }

  /* ── Ranking ─────────────────────────────────────────── */

  /** Points the rep would gain if `key` were fixed (0 if it isn't part of the score). */
  gain(rep, key) {
    const fix = this.ex.fixes?.[key];
    if (!fix || !rep.measures) return 0;
    try {
      const now = this.ex.grade(rep.measures, []).score;
      const fixed = this.ex.grade(fix(rep.measures), []).score;
      return Math.max(0, fixed - now);
    } catch { return 0; }
  }

  /** The rep's faults, biggest score gain first, then severity. */
  rankByImpact(rep) {
    return (rep.faults ?? [])
      .map((f) => ({ ...f, severity: f.severity ?? faultSeverity(this.name, f.key), gain: this.gain(rep, f.key) }))
      .sort((a, b) => b.gain - a.gain || b.severity - a.severity);
  }

  /* ── Events ──────────────────────────────────────────── */

  /**
   * A finished rep (or a hold segment).
   * @param rep { score, faults:[{key,severity}], measures, duration, index }
   * @param ctx { setReps } for the halfway call
   * @returns [{ parts, text, priority, kind }] — usually one line; a trend line may follow
   */
  onRep(rep, { setReps = 0 } = {}) {
    const lines = [];
    const ranked = this.rankByImpact(rep);
    const top = ranked[0] ?? null;
    const good = rep.score >= this.target;
    const clean = good && !ranked.length;
    this.reps.push({ score: rep.score, measures: rep.measures ?? {}, duration: rep.duration });
    const P = this.personality;

    // Clean-rep run (for the "two in a row" and groove lines).
    this.cleanRun = clean ? this.cleanRun + 1 : 0;
    if (!clean) this.grooveSaid = false;

    // Fault repetition (for escalation): only the cue we'd give counts.
    for (const k of [...this.repeats.keys()]) if (k !== top?.key) this.repeats.delete(k);
    if (top) this.repeats.set(top.key, (this.repeats.get(top.key) ?? 0) + 1);

    if (this.chattiness === "quiet") {
      lines.push(this.#line([rep.score], 2, "score"));
      this.#remember(rep, top);
      return lines;
    }

    // What got better since the last rep?
    const fixedKey = this.prev?.topKey && !(rep.faults ?? []).some((f) => f.key === this.prev.topKey) && rep.score > this.prev.score
      ? this.prev.topKey : null;
    const reinforce = fixedKey && FIXED[this.name]?.[fixedKey]
      ? this.#fill(this.#pick(`reinforce:${P}`, COACH_LINES.reinforce[P]), FIXED[this.name][fixedKey])
      : null;

    let body;
    if (good && !top) {
      const groove = this.cleanRun >= 3 && !this.grooveSaid;
      if (groove) this.grooveSaid = true;
      body = groove ? [this.#pick(`groove:${P}`, COACH_LINES.groove[P])]
           : this.cleanRun === 2 && !reinforce ? [MILESTONES.streak2[P]]
           : [reinforce ?? this.#pick(`praise:${P}`, PRAISE[P])];
    } else if (top) {
      const near = !good && rep.score >= this.target - 6 ? this.#pick(`near:${P}`, NEAR_MISS[P]) : null;
      body = [reinforce, near, this.cue(top.key)];
    } else {
      body = [reinforce ?? this.#pick(`praise:${P}`, PRAISE[P])];
    }
    if (!this.ex.isHold && setReps >= 6 && rep.index === Math.ceil(setReps / 2)) body.push(MILESTONES.halfway[P]);
    // A hold segment has no rep score to read out.
    lines.push(this.#line([...(this.ex.isHold ? [] : [rep.score]), ...body.filter(Boolean)], good ? 2 : 3, "rep"));

    // Trends across the set (detailed coaching).
    if (this.chattiness === "detailed") {
      const trend = this.trend();
      if (trend) lines.push(this.#line([trend], 1, "trend"));
    }
    this.#remember(rep, top);
    return lines;
  }

  /** A rep that didn't go deep enough to count. */
  onNoRep() {
    return [this.#line([this.#pick(`norep:${this.personality}`, NO_REP[this.personality])], 2, "norep")];
  }

  /** Standing still at the top mid-set. */
  onRest() {
    if (this.chattiness === "quiet") return [];
    return [this.#line([this.#pick(`rest:${this.personality}`, COACH_LINES.rest[this.personality])], 1, "rest")];
  }

  /**
   * The cue for a fault, escalating when it keeps coming back:
   * 1st time a standard phrasing, 2nd a different one, 3rd+ a concrete
   * physical cue (alternating with phrasings so it doesn't nag).
   */
  cue(key) {
    const n = this.repeats.get(key) ?? 1;
    const bank = FAULTS[this.name]?.[key]?.[2] ?? [];
    const concrete = CONCRETE[this.name]?.[key] ?? [];
    const useConcrete = concrete.length && n >= 3 && (n - 3) % 2 === 0;
    return useConcrete ? this.#pick(`concrete:${key}`, concrete) : this.#pick(`fault:${key}`, bank);
  }

  /** Fatigue (depth fading) or rushing (reps speeding up), at most every few reps. */
  trend() {
    const r = this.reps;
    for (const k of Object.keys(this.cooldown)) this.cooldown[k] = Math.max(0, this.cooldown[k] - 1);
    if (r.length < 4) return null;
    const cfg = this.ex.trend;
    if (cfg && !this.cooldown.fatigue) {
      const early = median(r.slice(0, 3).map((x) => x.measures[cfg.key]).filter(Number.isFinite));
      const late = median(r.slice(-2).map((x) => x.measures[cfg.key]).filter(Number.isFinite));
      if (Number.isFinite(early) && Number.isFinite(late) && (late - early) * cfg.worse > cfg.by) {
        this.cooldown.fatigue = 4;
        return this.#pick(`fatigue:${this.personality}`, COACH_LINES.fatigue[this.personality]);
      }
    }
    if (!this.ex.isHold && !this.cooldown.rushing) {
      const early = median(r.slice(0, 3).map((x) => x.duration).filter(Number.isFinite));
      const late = median(r.slice(-2).map((x) => x.duration).filter(Number.isFinite));
      if (early > 0 && late < early * 0.7) {
        this.cooldown.rushing = 4;
        return this.#pick(`rushing:${this.personality}`, COACH_LINES.rushing[this.personality]);
      }
    }
    return null;
  }

  /* ── Before and after the set ────────────────────────── */

  /**
   * Pre-set briefing from your last session of this exercise.
   * @param last { faults: {key: count}, reps: [scores] } or null
   */
  briefing(last) {
    if (this.chattiness === "quiet" || !last?.reps?.length) return null;
    const top = topFault(last.faults, this.name);
    if (!top) return this.#pick(`briefGood:${this.personality}`, COACH_LINES.briefGood[this.personality]);
    return briefFixLine(this.name, top, this.#pick(`briefFix:${this.personality}`, COACH_LINES.briefFix[this.personality]));
  }

  /**
   * After the set: what went well, the one thing to fix (by total points it
   * cost you), and a concrete target for next time.
   * @param res session.results()
   */
  summary(res) {
    if (!res?.reps?.length) return null;
    const n = res.reps.length;
    const unit = res.isHold ? "5-second stretches" : "reps";

    const strengths = [];
    for (const b of res.bars ?? []) if (b.value >= 90) strengths.push(`${b.label}: ${b.value}/100`);
    const clean = (res.details ?? []).filter((d) => !d.faults?.length).length;
    if (clean && clean >= n / 2) strengths.push(`No form faults on ${clean} of ${n} ${unit}`);
    if (!strengths.length) strengths.push(`Best ${res.isHold ? "stretch" : "rep"}: ${res.best}`);

    // The fix worth the most points across the whole set (count × severity if no score impact).
    const cost = new Map();
    for (const d of res.details ?? []) {
      for (const key of new Set(d.faults ?? [])) {
        const g = this.gain({ measures: d.measures }, key);
        cost.set(key, (cost.get(key) ?? 0) + (g || faultSeverity(this.name, key)));
      }
    }
    const fixKey = [...cost].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const fix = fixKey ? {
      key: fixKey,
      label: faultLabel(this.name, fixKey),
      focus: FOCUS[this.name]?.[fixKey] ?? faultLabel(this.name, fixKey).toLowerCase(),
      cue: CONCRETE[this.name]?.[fixKey]?.[0] ?? FAULTS[this.name]?.[fixKey]?.[2]?.[0] ?? "",
    } : null;

    const target = nextTarget(res.reps, unit);
    const fixLine = fix ? fillTemplate(this.#pick(`summaryFix:${this.personality}`, COACH_LINES.summaryFix[this.personality]), "", fix.focus) : null;
    // Spoken: "Set complete. Average 87. Next time, focus on …" (the target stays on screen).
    const parts = this.chattiness === "quiet"
      ? [SYSTEM.setComplete]
      : [SYSTEM.setComplete, SYSTEM.average, res.average, fixLine ?? SYSTEM.cleanSet];
    return { strengths, fix, target, parts, spoken: partsText(parts) };
  }

  /* ── Helpers ─────────────────────────────────────────── */

  #remember(rep, top) {
    this.prev = { score: rep.score, topKey: top?.key ?? null };
  }

  /** Next item of a bank, rotating, never equal to the last line spoken. */
  #pick(id, bank) {
    if (!bank?.length) return "";
    let i = this.rotation.get(id);
    if (i == null) i = Math.floor(this.random() * bank.length);
    const text = bank[i % bank.length];
    this.rotation.set(id, i + 1);
    return text;
  }

  #fill(template, x, y = "") {
    return fillTemplate(template, x, y);
  }

  /** Build a line from parts; if it's word-for-word the last one, vary it ("… Again."). */
  #line(parts, priority, kind) {
    let text = partsText(parts);
    if (text && text === this.lastLine && (kind === "rep" || kind === "score")) {
      parts = [...parts, SYSTEM.again];
      text = partsText(parts);
    }
    this.lastLine = partsText(parts.filter((p) => p !== SYSTEM.again));
    return { parts, text, priority, kind };
  }
}

/** Most frequent fault (ties: most severe). */
export function topFault(counts, exercise) {
  const entries = Object.entries(counts ?? {}).filter(([, n]) => n > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1] || faultSeverity(exercise, b[0]) - faultSeverity(exercise, a[0]));
  return entries[0][0];
}

/**
 * A concrete, reachable target: the next multiple of 5 above your median,
 * on one more rep than you managed this time. "Next time: hit 85+ on 4 of 5 reps"
 */
export function nextTarget(scores, unit = "reps") {
  const n = scores.length;
  if (!n) return "";
  if (scores.every((s) => s >= 95)) return `Next time: keep every one at 95+ and add a few more ${unit}`;
  const med = median(scores);
  const bar = Math.min(95, Math.max(60, Math.ceil((med + 1) / 5) * 5));
  const hit = scores.filter((s) => s >= bar).length;
  const want = Math.min(n, hit + 1);
  return `Next time: hit ${bar}+ on ${want} of ${n} ${unit}`;
}

/** Fill a COACH_LINES template: {x} and {y}, capitalised. Exported so the voice pack can render every fill. */
export function fillTemplate(template, x, y = "") {
  const text = template.replace("{x}", x).replace("{y}", y);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Last time your most common issue was depth. Focus on sitting lower…" */
export function briefFixLine(exercise, key, template) {
  const label = faultLabel(exercise, key).toLowerCase();
  return fillTemplate(template, label, FOCUS[exercise]?.[key] ?? label);
}
