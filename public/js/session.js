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
import { trackingQuality, median, stdev } from "./geometry.js";
import { LandmarkSmoother, SMOOTHING } from "./filters.js";
import {
  Calibrator, SideTracker, GapFiller, visibilityScore, keyJointIds,
  boneLengths, boneGlitch, medianBones, personalShallow,
  worldAngles, worldWeight, fuseAngles,
  frameConfidence, ConfidenceGate, facingCues, facingVote, FacingTracker, DriftMeter,
} from "./tracking.js";
import { FRAMING, SETUP_CUES } from "./coaching.js";

const SEGMENT_S = 5;                       // plank scoring segment length
const FACING_SIDE_MAX = 0.40;              // shoulder width / torso above this = facing the camera (measured: side-on ≈ 0.1, front-on ≈ 0.5)
const FACING_FRONT_MIN = 0.30;             // ...below this = side-on (bad for jumping jacks)
const LOST_RESET_MS = 1500;                // tracking lost this long mid-rep: abandon the rep
const ABSENT_RESET_MS = 2500;              // gone this long (walked off): start again from the top
const REST_AFTER_S = 4;                    // still at the top this long mid-set = resting
const DEFAULT_REP_S = [0.4, 12];           // a rep shorter / longer than this isn't a rep
const GLITCH_ACCEPT_MS = 600;              // a "glitch" that lasts this long is real: re-learn the bones
const DEFAULT_KEY_JOINTS = ["SHOULDER", "HIP", "KNEE", "ANKLE"];
const FRAME_MIN_CONFIDENCE = 0.45;         // below this a frame is never graded or counted

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
    this.setHoldS = opts.holdSeconds ?? this.setReps * 6;   // 5 → 30 s, 10 → 60 s, 15 → 90 s (circuits: any length)

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
    this.vel = 0;            // rep metric velocity (units/s), smoothed
    this.prevMetric = null;
    this.motion = "still";   // descending | bottom | ascending | top | still (for timing speech)

    // set clock: active time only (paused while resting or away)
    this.activeS = 0;
    this.resting = false;
    this.topStill = 0;       // seconds spent still at the top since the last rep
    this.restS = 0;          // total rest time

    // facing check (smoothed)
    this.facing = null;

    // Tracking clean-up (js/filters.js, js/tracking.js)
    this.smooth = new LandmarkSmoother(SMOOTHING.measure);     // measurement + display
    this.smoothPhase = new LandmarkSmoother(SMOOTHING.phase);  // rep-phase signal: lighter
    this.smoothWorld = new LandmarkSmoother(SMOOTHING.measure); // 3D world landmarks (metres; similar scale)
    this.sides = new SideTracker({ margin: ex.sideMargin ?? 0.15 });
    this.gaps = new GapFiller();
    this.calibrator = new Calibrator();
    this.calib = null;                 // { bones, topMetric } once calibrated
    this.shallow = ex.shallowThreshold;
    this.boneHistory = [];             // recent good frames' bones (reference until calibrated)
    this.glitchSince = null;
    this.glitches = 0;
    this.w3 = 0;                       // current weight of the 3D angles
    this.gate = new ConfidenceGate();  // overlay on/off, with hysteresis
    this.facingTracker = new FacingTracker();
    this.drift = new DriftMeter();
    this.confidence = 0;
    this.overlay = "none";             // none | ready | rep
    this.facingDir = { dir: 0, confidence: 0, locked: false };

    // Not armed (countdown / waiting for auto-start): track, calibrate and
    // report readiness, but don't count anything yet.
    this.armed = opts.armed ?? true;
    this.restAfterS = opts.restAfterS ?? REST_AFTER_S;

    // hold state
    this.hold = { inPos: 0, good: 0, segT: 0, segScores: [], live: null, hipTrack: [] };
  }

  /**
   * @param rawLms  33 MediaPipe landmarks (normalised) or null
   * @param aspect  video width / height
   * @param t       timestamp in ms
   */
  /** Start counting (after the countdown, or once auto-start sees you ready). */
  arm() { this.armed = true; }

  /**
   * @param rawLms  33 MediaPipe landmarks (normalised) or null
   * @param aspect  video width / height
   * @param t       timestamp in ms
   * @param world   MediaPipe worldLandmarks (metres), optional
   */
  update(rawLms, aspect, t, world = null) {
    const dt = this.lastT == null ? 0 : Math.min(0.25, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;
    const out = { state: "none", tip: "", live: null, inRep: this.phase === "down", events: [], hold: null, display: null };
    if (this.done) { out.state = "done"; return out; }

    if (!rawLms) {
      out.tip = FRAMING.enter;
      this.#lost(t);
      return this.#keepOverlay(out, t);
    }
    const ex = this.ex;

    // ── Which side to measure (with hysteresis) ──────────
    const corrected = aspectCorrect(rawLms, aspect);
    const side = this.sides.update({
      LEFT:  ex.sideScore ? ex.sideScore(corrected, "LEFT")  : visibilityScore(corrected, "LEFT"),
      RIGHT: ex.sideScore ? ex.sideScore(corrected, "RIGHT") : visibilityScore(corrected, "RIGHT"),
    }, t);
    const boneSide = ex.frontFacing ? "BOTH" : side;

    // ── Setup checks ─────────────────────────────────────
    const quality = ex.frontFacing ? frontQuality(corrected) : trackingQuality(corrected, side);
    if (quality < VIS_THRESHOLD) {
      out.state = "partial";
      out.tip = "Step back so your whole body is in frame";
      this.#lost(t);
      return this.#keepOverlay(out, t);
    }

    // ── Occlusion: bridge a key joint hidden ≤ 200 ms, else drop the frame ──
    const gap = this.gaps.apply(rawLms, keyJointIds(ex.keyJoints ?? DEFAULT_KEY_JOINTS, boneSide), t);
    if (gap.dropped) {
      out.state = "occluded";
      out.tip = FRAMING.wholeBody;
      this.#lost(t);
      return this.#keepOverlay(out, t);
    }

    // ── Smooth (One Euro): steady angles without lag ─────
    const smoothed = this.smooth.apply(gap.lms, t);
    out.display = smoothed;
    const lms = aspectCorrect(smoothed, aspect);
    const lmsPhase = aspectCorrect(this.smoothPhase.apply(gap.lms, t), aspect);

    // ── Tracking glitch: a bone suddenly a different length ──
    const bones = boneLengths(lms, boneSide);
    const ref = this.calib?.bones ?? (this.boneHistory.length >= 15 ? medianBones(this.boneHistory) : null);
    const g = ref ? boneGlitch(bones, ref) : { glitch: false };
    if (g.glitch) {
      this.glitchSince ??= t;
      if (t - this.glitchSince < GLITCH_ACCEPT_MS) {
        this.glitches++;
        out.state = "glitch";
        out.tip = "";
        return this.#keepOverlay(out, t);
      }
      // It's lasted: the reference was wrong (or you changed position). Re-learn.
      this.boneHistory = [];
      if (this.calib) this.calib = { ...this.calib, bones: null };
    }
    this.glitchSince = null;
    this.boneHistory.push(bones);
    if (this.boneHistory.length > 45) this.boneHistory.shift();

    const ratio = facingRatio(lms);
    this.facing = this.facing == null ? ratio : this.facing + (ratio - this.facing) * 0.15;
    if (!ex.frontFacing && this.facing > FACING_SIDE_MAX) {
      out.state = "turn";
      out.tip = SETUP_CUES.turn;
      return this.#keepOverlay(out, t);
    }
    if (ex.frontFacing && this.facing < FACING_FRONT_MIN) {
      out.state = "turn";
      out.tip = SETUP_CUES.turnFront;
      return this.#keepOverlay(out, t);
    }

    // ── Measure (2D, blended with 3D as you turn away) ───
    const w3 = !ex.frontFacing && world ? worldAngles(this.smoothWorld.apply(world, t), side) : null;
    this.w3 = w3 ? worldWeight(this.facing) : 0;
    const m = fuseAngles(ex.measure(lms, side), w3, this.w3);
    const metric = ex.repMetric(fuseAngles(ex.measure(lmsPhase, side), w3, this.w3));

    // ── Confidence: is this really you doing the exercise, tracked well? ──
    const ids = keyJointIds(ex.keyJoints ?? DEFAULT_KEY_JOINTS, boneSide);
    const visibility = ids.reduce((a, i) => a + (rawLms[i]?.visibility ?? 0), 0) / ids.length;
    const hipX = (lms[LM.LEFT_HIP].x + lms[LM.RIGHT_HIP].x) / 2;
    const conf = frameConfidence({
      visibility, boneRatio: g.ratio ?? 1, facingRatio: this.facing, frontFacing: !!ex.frontFacing,
      posture: ex.posture ? ex.posture(m) : 1, drift: this.drift.update(hipX, bones.torso, t),
      sideSwitching: this.sides.since != null,
    });
    this.confidence = conf.value;
    out.confidence = conf.value;
    const shown = this.gate.update(conf.value, t);

    // Which way you face (for the ideal-form guide): locked while a rep is under way.
    if (!ex.frontFacing) {
      this.facingDir = this.facingTracker.update(facingVote(facingCues(lms, side, { floor: !!ex.floor })), t, { lock: this.phase === "down" });
    }
    out.facing = this.facingDir;

    if (conf.value < FRAME_MIN_CONFIDENCE) {
      // Not graded, not counted, not calibrated: say what's wrong instead.
      out.state = "unsure";
      out.tip = {
        visibility: FRAMING.wholeBody, bones: "", still: FRAMING.still,
        facing: ex.frontFacing ? SETUP_CUES.turnFront : SETUP_CUES.turn,
        posture: (ex.isHold ? ex.positionTip : ex.startTip) ?? SETUP_CUES.position,
      }[conf.weakest] ?? "";
      out.weakest = conf.weakest;
      this.#lost(t);
      return this.#keepOverlay(out, t, shown);
    }
    this.lastSeenT = t;

    // ── Calibration: your bones and your real top position ──
    const atTop = ex.isHold ? (ex.inPosition ? ex.inPosition(m) : true) : metric > this.shallow;
    if (atTop && this.phase !== "down") {
      const res = this.calibrator.update(lms, boneSide, metric, t);
      if (res && !this.calib) {
        this.calib = res;
        if (!ex.isHold) this.shallow = personalShallow(ex, res.topMetric);
      }
    }
    out.calibration = this.calibrator.progress;

    const graded = ex.grade(m, []);
    out.state = "ok";
    out.live = { ...graded, m, side };
    const faults = ex.detectFaults(m);
    out.tip = faults.length ? faults[0].label : "Looking good";
    out.faults = faults;

    // How far into the rep (0 at the top, 1 at full depth): fades the guide in and out.
    out.progress = ex.isHold ? 1 : Math.max(0, Math.min(1, (this.shallow - metric) / Math.max(1e-6, this.shallow - ex.deepThreshold)));

    if (!this.armed) {
      // Ready = in the start position and holding still for a second.
      out.ready = atTop && this.calibrator.stillFor >= 1;
      out.tip = atTop ? (this.calib ? "Ready" : "Hold still a moment…") : (ex.isHold ? ex.positionTip : ex.startTip) ?? "Get into position";
      this.overlay = out.overlay = shown ? "ready" : "none";
      return out;
    }

    if (ex.isHold) this.#holdStep(m, graded.score, faults, dt, out);
    else this.#repStep(m, metric, graded.score, t, dt, out);
    out.inRep = this.phase === "down";
    // Overlay: nothing unless confident; the full overlay only mid-rep (or holding).
    const doing = ex.isHold ? out.state === "ok" : out.inRep;
    this.overlay = out.overlay = !shown ? "none" : doing ? "rep" : "ready";
    if (!this.resting) this.activeS += dt; else this.restS += dt;
    out.resting = this.resting;
    out.clock = this.activeS;
    return out;
  }

  /** A frame that isn't used: the overlay keeps its state until the gate closes. */
  #keepOverlay(out, t, shown = this.gate.update(0, t)) {
    this.overlay = out.overlay = !shown ? "none" : this.overlay === "none" ? "ready" : this.overlay;
    out.facing = this.facingDir;
    out.confidence = this.confidence = Math.min(this.confidence, 0.3);
    return out;
  }

  /* ── Reps ─────────────────────────────────────────────── */

  #repStep(m, rawMetric, liveScore, t, dt, out) {
    const ex = this.ex;
    // Median of the last 3 readings: one glitchy frame can't flip the phase.
    this.metricWin.push(rawMetric);
    if (this.metricWin.length > 3) this.metricWin.shift();
    const metric = median(this.metricWin);
    this.lastMetric = metric;

    // Velocity of the rep metric, and which way you're moving. "Still" is
    // relative to the exercise's range of motion (degrees for most, torso
    // fractions for jumping jacks).
    const range = ex.shallowThreshold - ex.deepThreshold;
    const stillVel = ex.stillVel ?? range * 0.5;
    if (this.prevMetric != null && dt > 0) {
      const v = (metric - this.prevMetric) / dt;
      this.vel += (v - this.vel) * Math.min(1, dt * 12);
    }
    this.prevMetric = metric;
    const moving = Math.abs(this.vel) > stillVel;
    this.motion = this.phase === "down"
      ? (!moving ? "bottom" : this.vel < 0 ? "descending" : "ascending")
      : moving ? (this.vel < 0 ? "descending" : "ascending") : "top";
    out.motion = this.motion;

    if (this.phase === "wait") {
      // Only start counting once we've seen you at the top of the movement.
      if (metric > this.shallow) { this.phase = "top"; this.topStill = 0; }
      out.tip = this.phase === "wait" ? (ex.startTip ?? "Start from the top position") : out.tip;
      return;
    }

    if (this.phase === "top") {
      // Resting: standing still at the top for a while, mid-set. The set
      // clock pauses and nothing counts until you start the next rep.
      // Still = staying within a small band of where you stopped (velocity
      // alone is too jumpy here: a straight knee's angle is noisy near 180°).
      if (this.topAnchor == null || Math.abs(metric - this.topAnchor) > range * 0.2) { this.topAnchor = metric; this.topStill = 0; }
      else this.topStill += dt;
      if (!this.resting && this.reps.length && this.topStill >= (this.restAfterS ?? REST_AFTER_S)) {
        this.resting = true;
        out.events.push({ type: "rest-start" });
      }
      if (metric < this.shallow - (ex.startMargin ?? 3)) {
        if (this.resting) { this.resting = false; out.events.push({ type: "rest-end", seconds: this.topStill }); }
        this.phase = "down";
        this.buf = [];
        this.repStart = t;
        this.minMetric = Infinity;
        this.deepTime = 0;
        this.deepFrames = 0;
        this.topStill = 0;
        this.topAnchor = null;
      } else {
        return;
      }
    }

    // phase === "down"
    this.buf.push({ t, m, metric, score: liveScore });
    this.minMetric = Math.min(this.minMetric, metric);
    if (metric < ex.deepThreshold) { this.deepFrames++; this.deepTime += dt; }

    const [minS, maxS] = ex.repSeconds ?? DEFAULT_REP_S;
    if (t - this.repStart > maxS * 1000) {
      // Far too long for one rep (sat down, wandered off): drop it quietly,
      // and wait to see you back at the top before counting again.
      this.phase = "wait"; this.buf = []; this.topStill = 0;
      out.events.push({ type: "abandoned" });
      return;
    }

    if (metric > this.shallow) {
      this.phase = "top";
      this.topStill = 0;
      this.topAnchor = null;
      const duration = (t - this.repStart) / 1000;
      const valid = this.deepFrames >= 2 && this.deepTime >= (ex.minDeepTime ?? 0.2);
      if (duration < minS) {
        // Faster than a human rep: a tracking twitch, not a rep or a no-rep.
      } else if (valid) {
        out.events.push(this.#finishRep(t));
      } else if (this.shallow - this.minMetric >= (ex.attemptMin ?? 12)) {
        out.events.push({ type: "shallow", depth: this.shallow - this.minMetric });
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

    // Phases of the rep: down (start → first frame at the bottom), bottom
    // (time near the deepest point), up (last bottom frame → back at the top).
    const bottomStart = window.length ? window[0].t : t;
    const bottomEnd = window.length ? window[window.length - 1].t : t;
    const phases = {
      down: (bottomStart - this.repStart) / 1000,
      bottom: (bottomEnd - bottomStart) / 1000,
      up: (t - bottomEnd) / 1000,
    };

    const graded = ex.grade(m, wobble);
    const faults = ex.detectFaults({ ...m, bounce, duration, dwell });
    const score = Math.round(graded.score);

    this.reps.push(score);
    this.best = Math.max(this.best, score);
    if (score >= this.target) { this.goodReps++; this.streak++; } else this.streak = 0;
    // Everything the coach and results need about this rep.
    const measures = numeric(m);
    const detail = { score, bars: graded.bars, stats: graded.stats, faults, duration, phases, measures, at: t };
    this.repDetails.push(detail);
    return { type: "rep", index: this.reps.length, ...detail, streak: this.streak, good: score >= this.target };
  }

  #lost(t) {
    if (this.lastSeenT == null) return;
    const gone = t - this.lastSeenT;
    if (this.phase === "down" && gone > LOST_RESET_MS) {
      this.phase = "top";
      this.buf = [];
    }
    if (gone > ABSENT_RESET_MS && this.phase !== "wait") {
      // Walked out of the frame: when you come back, start again from the top,
      // so stepping back into position can't look like a rep.
      this.phase = "wait";
      this.buf = [];
      this.metricWin = [];
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
      this.repDetails.push({ score: seg, bars: this.ex.grade(m, []).bars, faults: out.faults ?? [], duration: SEGMENT_S, measures: numeric(m) });
      out.events.push({ type: "segment", score: seg, index: this.reps.length, faults: out.faults ?? [] });
    }

    const finished = this.mode === "set" ? h.inPos >= this.setHoldS : h.good >= this.holdGoalS;
    if (finished) {
      // Count a partial final segment too, so nothing you held is lost.
      if (h.segScores.length > 10) {
        const seg = Math.round(h.segScores.reduce((a, b) => a + b, 0) / h.segScores.length);
        this.reps.push(seg); this.best = Math.max(this.best, seg);
        this.repDetails.push({ score: seg, bars: this.ex.grade(m, []).bars, faults: out.faults ?? [], duration: h.segT, measures: numeric(m) });
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
      details: this.repDetails.map(({ score, faults: f, duration, phases, measures }) => ({
        score, duration, phases, measures, faults: (f ?? []).map((x) => x.key),
      })),
      activeSeconds: Math.round(this.activeS), restSeconds: Math.round(this.restS),
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

/** The numeric measurements of a frame, rounded (for per-rep data). */
function numeric(m) {
  return Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === "number" && Number.isFinite(v)).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
}

/** Visibility for front-facing exercises: both sides matter. */
function frontQuality(lms) {
  const ids = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_WRIST, LM.RIGHT_WRIST,
               LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];
  return ids.reduce((a, i) => a + (lms[i]?.visibility ?? 0), 0) / ids.length;
}

