/**
 * session.js — the analysis engine for one live session.
 *
 * Pure logic, no DOM: feed it one frame of landmarks at a time and it tells
 * you what's happening (setup problems, live position score, finished reps,
 * holds) as plain data. live.js turns that into the HUD and the voice; the
 * tests in /tests drive it with simulated bodies.
 *
 * What it does, in order, every frame:
 *   1. Aspect-correct the landmarks. MediaPipe gives x as a fraction of the
 *      frame WIDTH and y as a fraction of the HEIGHT, so on a 16:9 webcam raw
 *      angles are stretched. Scaling x by width/height makes angles true.
 *   2. Setup checks: is someone there, is the body fully visible, are they
 *      facing the right way for this exercise?
 *   3. Measure + grade the current position (for the live HUD).
 *   4. Rep exercises: a small state machine on a smoothed "rep metric"
 *      (knee or elbow angle, arm height). A rep only counts if it spends real
 *      TIME in the deep zone (frame-rate independent), and it's scored on the
 *      frames near the bottom of the rep, not the way down and up. Attempts
 *      that never get deep enough are reported as "shallow" (no rep).
 *   5. Holds (plank): a timer that runs while you're in position, scored in
 *      5-second segments, with steadiness (drift) tracking.
 */

import { LM, VIS_THRESHOLD } from "./config.js";
import { detectSide, trackingQuality, median, stdev } from "./geometry.js";

const SEGMENT_S = 5;                       // plank scoring segment length
const FACING_SIDE_MAX = 0.40;              // shoulder width / torso above this = facing the camera (measured: side-on ≈ 0.1, front-on ≈ 0.5)
const FACING_FRONT_MIN = 0.30;             // ...below this = side-on (bad for jumping jacks)
const LOST_RESET_MS = 1500;                // tracking lost this long mid-rep: abandon the rep
const REP_TIMEOUT_MS = 12000;              // stuck "in a rep" this long: abandon it

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Median of every numeric field across a list of measurement objects. */
export function medianFields(list) {
  const out = {};
  for (const k of Object.keys(list[0] ?? {})) {
    const vals = list.map((m) => m[k]).filter((v) => typeof v === "number" && Number.isFinite(v));
    if (vals.length) out[k] = median(vals);
  }
  return out;
}

/** x scaled by aspect ratio so both axes use the same unit (frame heights). */
export function aspectCorrect(lms, aspect) {
  return lms.map((p) => ({ x: p.x * aspect, y: p.y, z: p.z ?? 0, visibility: p.visibility ?? 1 }));
}

/** Shoulder width relative to torso length: ~0.1–0.4 side-on, ~0.6+ facing the camera. */
export function facingRatio(lms) {
  const ls = lms[LM.LEFT_SHOULDER], rs = lms[LM.RIGHT_SHOULDER];
  const lh = lms[LM.LEFT_HIP], rh = lms[LM.RIGHT_HIP];
  const torso = dist(mid(ls, rs), mid(lh, rh)) || 1e-6;
  return dist(ls, rs) / torso;
}

export class Session {
  /**
   * @param ex   exercise module (js/exercises/*)
   * @param opts { mode: "practice"|"set", target, goal (reps or 0=endless), setReps }
   */
  constructor(ex, opts) {
    this.ex = ex;
    this.mode = opts.mode;
    this.target = opts.target;
    this.goal = opts.goal;
    this.setReps = opts.setReps ?? 5;

    // Holds: practice = keep your target grade for N continuous seconds;
    // set = hold for a fixed time and get graded on the whole thing.
    this.holdGoalS = { 0: Infinity, 1: 10, 3: 30 }[this.goal] ?? 10;
    this.setHoldS = this.setReps * 6;              // 5 → 30 s, 10 → 60 s, 15 → 90 s

    this.reps = [];          // finished rep (or hold segment) scores
    this.repDetails = [];    // { score, bars, faults, duration }
    this.goodReps = 0;
    this.streak = 0;
    this.best = 0;
    this.done = false;

    // rep state machine
    this.phase = "wait";     // wait → top ⇄ down
    this.metricWin = [];
    this.buf = [];
    this.lastT = null;
    this.lastSeenT = null;

    // facing check (smoothed)
    this.facing = null;

    // hold state
    this.hold = { inPos: 0, good: 0, segT: 0, segScores: [], live: null, hipTrack: [] };
  }

  /**
   * @param rawLms  33 MediaPipe landmarks (normalised) or null
   * @param aspect  video width / height
   * @param t       timestamp in ms
   */
  update(rawLms, aspect, t) {
    const dt = this.lastT == null ? 0 : Math.min(0.25, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;
    const out = { state: "none", tip: "", live: null, inRep: this.phase === "down", events: [], hold: null };
    if (this.done) { out.state = "done"; return out; }

    if (!rawLms) {
      out.tip = "Step into the frame";
      this.#lost(t);
      return out;
    }
    const lms = aspectCorrect(rawLms, aspect);
    const ex = this.ex;
    const side = ex.pickSide ? ex.pickSide(lms) : detectSide(lms);

    // ── Setup checks ─────────────────────────────────────
    const quality = ex.frontFacing ? frontQuality(lms) : trackingQuality(lms, side);
    if (quality < VIS_THRESHOLD) {
      out.state = "partial";
      out.tip = "Step back so your whole body is in frame";
      this.#lost(t);
      return out;
    }
    this.lastSeenT = t;

    const ratio = facingRatio(lms);
    this.facing = this.facing == null ? ratio : this.facing + (ratio - this.facing) * 0.15;
    if (!ex.frontFacing && this.facing > FACING_SIDE_MAX) {
      out.state = "turn";
      out.tip = "Turn side-on to the camera";
      return out;
    }
    if (ex.frontFacing && this.facing < FACING_FRONT_MIN) {
      out.state = "turn";
      out.tip = "Face the camera";
      return out;
    }

    // ── Measure + grade this frame ───────────────────────
    const m = ex.measure(lms, side);
    const graded = ex.grade(m, []);
    out.state = "ok";
    out.live = { ...graded, m, side };
    const faults = ex.detectFaults(m);
    out.tip = faults.length ? faults[0].label : "Looking good";
    out.faults = faults;

    if (ex.isHold) this.#holdStep(m, graded.score, faults, dt, out);
    else this.#repStep(m, graded.score, t, dt, out);
    out.inRep = this.phase === "down";
    return out;
  }

  /* ── Reps ─────────────────────────────────────────────── */

  #repStep(m, liveScore, t, dt, out) {
    const ex = this.ex;
    // Median of the last 3 readings: one glitchy frame can't flip the phase.
    this.metricWin.push(ex.repMetric(m));
    if (this.metricWin.length > 3) this.metricWin.shift();
    const metric = median(this.metricWin);
    this.lastMetric = metric;

    if (this.phase === "wait") {
      // Only start counting once we've seen you at the top of the movement.
      if (metric > ex.shallowThreshold) this.phase = "top";
      out.tip = this.phase === "wait" ? (ex.startTip ?? "Start from the top position") : out.tip;
      return;
    }

    if (this.phase === "top") {
      if (metric < ex.shallowThreshold - (ex.startMargin ?? 3)) {
        this.phase = "down";
        this.buf = [];
        this.repStart = t;
        this.minMetric = Infinity;
        this.deepTime = 0;
        this.deepFrames = 0;
      } else {
        return;
      }
    }

    // phase === "down"
    this.buf.push({ t, m, metric, score: liveScore });
    this.minMetric = Math.min(this.minMetric, metric);
    if (metric < ex.deepThreshold) { this.deepFrames++; this.deepTime += dt; }

    if (t - this.repStart > REP_TIMEOUT_MS) { this.phase = "top"; this.buf = []; return; }

    if (metric > ex.shallowThreshold) {
      this.phase = "top";
      const valid = this.deepFrames >= 2 && this.deepTime >= (ex.minDeepTime ?? 0.2);
      if (valid) {
        out.events.push(this.#finishRep(t));
      } else if (ex.shallowThreshold - this.minMetric >= (ex.attemptMin ?? 12)) {
        out.events.push({ type: "shallow" });
      }
      this.buf = [];
      if (this.#goalReached()) { this.done = true; out.events.push({ type: "done", reason: "goal" }); }
    }
  }

  #finishRep(t) {
    const ex = this.ex;
    const band = ex.bottomBand ?? 8;
    const window = this.buf.filter((f) => f.metric <= this.minMetric + band);
    const ms = window.map((f) => f.m);
    const m = ex.summarize ? ex.summarize(ms, this.buf.map((f) => f.m)) : medianFields(ms);

    // Control: how much the hips wobble at the bottom once the smooth
    // down-and-up curve is removed (quadratic fit), so normal travel isn't
    // mistaken for shakiness.
    const hipT = window.filter((f) => Number.isFinite(f.m.hipY));
    const wobble = hipT.length >= 5 ? residuals(hipT.map((f) => f.t / 1000), hipT.map((f) => f.m.hipY)) : [];
    // Bounce: barely any time spent at the bottom before rebounding out.
    const dwell = window.length ? (window[window.length - 1].t - window[0].t) / 1000 : 0;
    const bounce = dwell < (ex.minDwell ?? 0.18) ? 1 : 0;
    const duration = (t - this.repStart) / 1000;

    const graded = ex.grade(m, wobble);
    const faults = ex.detectFaults({ ...m, bounce, duration, dwell });
    const score = Math.round(graded.score);

    this.reps.push(score);
    this.best = Math.max(this.best, score);
    if (score >= this.target) { this.goodReps++; this.streak++; } else this.streak = 0;
    const detail = { score, bars: graded.bars, stats: graded.stats, faults, duration };
    this.repDetails.push(detail);
    return { type: "rep", index: this.reps.length, ...detail, streak: this.streak, good: score >= this.target };
  }

  #lost(t) {
    if (this.phase === "down" && this.lastSeenT != null && t - this.lastSeenT > LOST_RESET_MS) {
      this.phase = "top";
      this.buf = [];
    }
  }

  #goalReached() {
    if (this.mode === "set") return this.reps.length >= this.setReps;
    return this.goal !== 0 && this.goodReps >= this.goal;
  }

  /* ── Holds ────────────────────────────────────────────── */

  #holdStep(m, score, faults, dt, out) {
    const h = this.hold;
    const inPosition = this.ex.inPosition ? this.ex.inPosition(m) : true;
    if (!inPosition) {
      out.state = "position";
      out.tip = this.ex.positionTip ?? "Get into position";
      h.good = 0;
      out.hold = this.#holdInfo();
      return;
    }

    // Smooth over ~0.5 s so one noisy frame doesn't break a hold.
    h.live = h.live == null ? score : h.live + (score - h.live) * Math.min(1, dt * 4);
    h.inPos += dt;
    h.segT += dt;
    h.segScores.push(h.live);

    // Steadiness: how much the hips wander over the last ~2 s.
    h.hipTrack.push(m.hipY);
    if (h.hipTrack.length > 60) h.hipTrack.shift();
    const drift = h.hipTrack.length > 20 ? stdev(h.hipTrack) : 0;
    if (drift > 0.02 && !faults.some((f) => f.key === "drift")) {
      const extra = this.ex.detectFaults({ ...m, drift });
      out.faults = extra;
      out.tip = extra[0]?.label ?? out.tip;
    }

    h.good = h.live >= this.target ? h.good + dt : 0;

    if (h.segT >= SEGMENT_S) {
      const seg = Math.round(h.segScores.reduce((a, b) => a + b, 0) / h.segScores.length);
      h.segT = 0; h.segScores = [];
      this.reps.push(seg);
      this.best = Math.max(this.best, seg);
      this.repDetails.push({ score: seg, bars: this.ex.grade(m, []).bars, faults: out.faults ?? [], duration: SEGMENT_S });
      out.events.push({ type: "segment", score: seg, index: this.reps.length, faults: out.faults ?? [] });
    }

    const finished = this.mode === "set" ? h.inPos >= this.setHoldS : h.good >= this.holdGoalS;
    if (finished) {
      // Count a partial final segment too, so nothing you held is lost.
      if (h.segScores.length > 10) {
        const seg = Math.round(h.segScores.reduce((a, b) => a + b, 0) / h.segScores.length);
        this.reps.push(seg); this.best = Math.max(this.best, seg);
        this.repDetails.push({ score: seg, bars: this.ex.grade(m, []).bars, faults: out.faults ?? [], duration: h.segT });
        out.events.push({ type: "segment", score: seg, index: this.reps.length, faults: out.faults ?? [] });
      }
      this.done = true;
      out.events.push({ type: "done", reason: "goal" });
    }
    out.hold = this.#holdInfo();
  }

  #holdInfo() {
    const h = this.hold;
    return this.mode === "set"
      ? { label: "Hold", seconds: h.inPos, goal: this.setHoldS, score: h.live }
      : { label: `Hold ${this.target}+`, seconds: h.good, goal: this.holdGoalS, score: h.live };
  }

  /* ── Summary ──────────────────────────────────────────── */

  results() {
    const reps = this.reps;
    if (!reps.length) return null;
    const average = Math.round(reps.reduce((a, b) => a + b, 0) / reps.length);

    // Average each score component across reps, for the results bars.
    const sums = new Map();
    for (const d of this.repDetails) for (const b of d.bars ?? []) {
      const s = sums.get(b.label) ?? { total: 0, n: 0 };
      s.total += b.value; s.n++;
      sums.set(b.label, s);
    }
    const bars = [...sums].map(([label, s]) => ({ label, value: Math.round(s.total / s.n) }));

    // One entry per fault per rep, so "seen in 3 of 5 reps" is honest.
    const faults = this.repDetails.flatMap((d) => [...new Set((d.faults ?? []).map((f) => f.key))]);

    return {
      reps, best: this.best, average, bars, faults,
      repCount: reps.length, isHold: !!this.ex.isHold,
      durations: this.repDetails.map((d) => d.duration),
    };
  }
}

/**
 * Residuals of y after a least-squares quadratic fit over x. Used to separate
 * shakiness from the smooth U-shape of a rep's bottom.
 */
export function residuals(xs, ys) {
  const n = xs.length;
  const x0 = xs[0];
  const X = xs.map((x) => x - x0);
  let s0 = n, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
  for (let i = 0; i < n; i++) {
    const x = X[i], x2 = x * x, y = ys[i];
    s1 += x; s2 += x2; s3 += x2 * x; s4 += x2 * x2;
    t0 += y; t1 += x * y; t2 += x2 * y;
  }
  // Solve [[s0 s1 s2][s1 s2 s3][s2 s3 s4]] · [a b c] = [t0 t1 t2] (Cramer's rule).
  const det3 = (a, b, c, d, e, f, g, h, i) => a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  const D = det3(s0, s1, s2, s1, s2, s3, s2, s3, s4);
  if (Math.abs(D) < 1e-12) {
    const mean = t0 / n;
    return ys.map((y) => y - mean);
  }
  const a = det3(t0, s1, s2, t1, s2, s3, t2, s3, s4) / D;
  const b = det3(s0, t0, s2, s1, t1, s3, s2, t2, s4) / D;
  const c = det3(s0, s1, t0, s1, s2, t1, s2, s3, t2) / D;
  return ys.map((y, i) => y - (a + b * X[i] + c * X[i] * X[i]));
}

/** Visibility for front-facing exercises: both sides matter. */
function frontQuality(lms) {
  const ids = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_WRIST, LM.RIGHT_WRIST,
               LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];
  return ids.reduce((a, i) => a + (lms[i]?.visibility ?? 0), 0) / ids.length;
}

