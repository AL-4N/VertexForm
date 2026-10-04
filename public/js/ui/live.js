/**
 * live.js — the live camera session screen.
 *
 * Owns the camera, the model, the countdown, the canvas overlay, the HUD and
 * the voice. All the analysis (setup checks, rep counting, grading, faults)
 * lives in js/session.js; this file turns its output into what you see and
 * hear.
 *
 * Every session gets a fresh control object. Pressing Back at ANY point —
 * while the model loads, during the countdown, mid-set, during the
 * celebration — cancels it cleanly: the camera turns off, timers stop, and
 * nothing fires afterwards.
 *
 * Cameras: the app picks a real camera (built-in first, virtual cameras only
 * if you chose one), checks it actually sends video, and moves on to the next
 * one if it doesn't. You can switch cameras mid-session from the dropdown.
 */

import { getExercise } from "../exercises/index.js";
import {
  initPose, detect, poseDelegate, poseModel, MODEL_NAMES,
  openCamera, stopCamera, listCameras, listCamerasWithNames, cameraOrder, countFrames,
  cameraErrorMessage, isPermissionError, streamCameraId, streamCameraName, sample, frameStats,
} from "../pose.js";
import { savedCameraId, savedCameraLabel, refreshCameraPickers } from "./camera-picker.js";
import { Session } from "../session.js";
import { gradeLetter, gradeVar } from "../geometry.js";
import { repFeedback, faultPhrase, milestone, noRepPhrase, praise, SETUP_CUES } from "../coaching.js";
import { voice, beep } from "../voice.js";
import { recordScore, countRep } from "../storage.js";
import { checkRep, checkStreak, checkSession } from "../achievements.js";
import { $, renderBars, toast } from "./components.js";
import { sizeCanvas, drawFrame, drawSkeleton, drawIdealChain, drawBorder, drawFramingGuide } from "./overlay.js";
import { framingCheck, lightingHint } from "../tracking.js";

const NEUTRAL = "#eef1fb";        // skeleton colour between reps
const SETUP_SPEAK_AFTER = 2500;   // ms a setup problem must last before it's said out loud
const STALL_MS = 3000;            // no new video frames for this long = the camera has stopped
const STILL_MS = 4000;            // the exact same picture for this long = a placeholder, not a camera
const AUTO_LITE_FPS = 15;         // "Auto" model quality: below this for a while, switch to the Fast model
const AUTO_LITE_AFTER_MS = 5000;

let active = null;                // the running session's control object

/**
 * @param exerciseName  which exercise
 * @param cfg  { mode, target, goal, countdown, mirror, setReps }
 * @param onFinish  called with a results object, or null if nothing to show
 */
export async function runLive(exerciseName, cfg, onFinish) {
  stopLive();
  const ctl = {
    cancelled: false, stream: null, raf: 0, vfc: 0, timers: new Set(),
    modelReady: false, opening: false, camAbort: null, frameReset: false,
    watchdog: 0, cleanup: [], luma: null, restartLoop: null,
  };
  ctl.cameraReady = new Promise((resolve) => { ctl.markCameraReady = resolve; });
  active = ctl;

  const ex = getExercise(exerciseName);
  const video = $("#video");
  const canvas = $("#overlay");
  const ctx = canvas.getContext("2d");
  const target = cfg.target;
  const isSet = cfg.mode === "set";

  /* ── HUD setup ─────────────────────────────────────────── */
  $("#live-title").textContent = `${isSet ? "Set" : "Practice"} — ${exerciseName}`;
  $("#live-goal").textContent = goalText(ex, cfg);
  $("#grade-target").textContent = `target ${target}`;
  $("#grade-letter").textContent = "–";
  $("#grade-letter").style.color = "";
  $("#grade-num").textContent = "";
  $("#rep-chips").innerHTML = "";
  $("#live-bars").innerHTML = "";
  $("#live-tip").textContent = ex.startTip ?? "Get into position";
  $("#celebrate").hidden = true;
  $("#live-best").textContent = "Best: –";
  $("#live-clock").textContent = "0:00";
  $("#live-reps").textContent = ex.isHold ? "Hold: 0 s" : `Reps: 0${isSet ? "/" + cfg.setReps : ""}`;

  /* ── Model + camera ────────────────────────────────────── */
  const loadingOk = await loadEverything(ctl, video, cfg.quality ?? "auto");
  if (!loadingOk || ctl.cancelled) return;

  // The session starts unarmed: frames during the countdown drive the
  // framing guide and calibration, but nothing is counted yet.
  const session = new Session(ex, { ...cfg, armed: false });
  let lastTs = 0, tint = null;
  let problem = null, problemSince = 0;          // setup problem being tracked for voice
  let lastScore = null;
  const debug = new URLSearchParams(location.search).has("debug");
  let fps = 0, lastFrameAt = 0, slowSince = null;
  const dbgEl = debug ? ensureDebugBox() : null;

  /* ── Frame loop ────────────────────────────────────────── */
  // requestVideoFrameCallback runs once per camera frame, with the frame's
  // capture time, so every frame is analysed exactly once. Older browsers
  // fall back to requestAnimationFrame + a "has the frame changed" check.
  const hasVfc = "requestVideoFrameCallback" in HTMLVideoElement.prototype;
  let lastVideoTime = -1;
  const onVideoFrame = (now, meta) => {
    if (ctl.cancelled) return;
    ctl.vfc = video.requestVideoFrameCallback(onVideoFrame);
    processFrame(meta?.captureTime || meta?.expectedDisplayTime || now);
  };
  const onAnimationFrame = () => {
    if (ctl.cancelled) return;
    ctl.raf = requestAnimationFrame(onAnimationFrame);
    if (video.currentTime === lastVideoTime) return;            // no new frame yet
    lastVideoTime = video.currentTime;
    processFrame(performance.now());
  };
  ctl.restartLoop = () => {               // new camera: re-attach to the <video>
    if (hasVfc) { video.cancelVideoFrameCallback?.(ctl.vfc); ctl.vfc = video.requestVideoFrameCallback(onVideoFrame); }
    else { cancelAnimationFrame(ctl.raf); lastVideoTime = -1; ctl.raf = requestAnimationFrame(onAnimationFrame); }
  };
  ctl.restartLoop();

  function processFrame(frameTime) {
    if (ctl.frameReset) {             // new camera: forget the old one's frame clock
      ctl.frameReset = false;
      lastFrameAt = 0; fps = 0; slowSince = null;
      session.lastT = null;           // first frame from the new camera counts as dt = 0
    }
    if (!ctl.stream || video.readyState < 2 || !video.videoWidth) return;

    // MediaPipe timestamps must strictly increase, across camera switches too.
    const ts = Math.max(frameTime, lastTs + 1);
    lastTs = ts;
    const { w, h } = sizeCanvas(canvas, video);
    drawFrame(ctx, video, w, h, cfg.mirror);

    const det = detect(video, ts);
    const lms = det?.landmarks ?? null;
    const out = session.update(lms, w / h, ts, det?.world ?? null);
    if (lastFrameAt) fps = fps ? fps * 0.9 + (1000 / Math.max(1, ts - lastFrameAt)) * 0.1 : 1000 / Math.max(1, ts - lastFrameAt);
    lastFrameAt = ts;
    autoQuality(ts);

    // Always-on, cheap snapshot for troubleshooting (and the automated tests).
    window.__vfDebug = {
      fps: Math.round(fps), camera: streamCameraName(ctl.stream), res: `${video.videoWidth}×${video.videoHeight}`,
      model: MODEL_NAMES[poseModel()] ?? poseModel(), delegate: poseDelegate(),
      state: out.state, armed: session.armed, phase: session.phase,
      metric: session.lastMetric != null ? Math.round(session.lastMetric * 100) / 100 : null,
      side: out.live?.side ?? null, w3d: +session.w3.toFixed(2),
      calib: session.calib ? "done" : `${Math.round((out.calibration ?? 0) * 100)}%`,
      glitches: session.glitches, gapFills: session.gaps.filledFrames, sideSwitches: session.sides.switches,
      reps: session.reps.length, facing: session.facing != null ? +session.facing.toFixed(2) : null,
      light: ctl.luma != null ? Math.round(ctl.luma) : null,
    };
    if (dbgEl) dbgEl.textContent = Object.entries(window.__vfDebug).map(([k, v]) => `${k}: ${v}`).join("\n");

    // Framing guide until you're set up and counting, or whenever you leave the frame.
    const framing = framingCheck(lms, { mirror: cfg.mirror });
    if (!session.armed || ["none", "partial"].includes(out.state)) drawFramingGuide(ctx, w, h, framing);

    // Skeleton (smoothed): coloured by form while you're mid-rep (or holding), neutral otherwise.
    const shownLms = out.display ?? lms;
    if (shownLms) {
      const scoring = session.armed && out.state === "ok" && (out.inRep || ex.isHold) && out.live;
      if (scoring) tint = tint == null ? out.live.score : tint + (out.live.score - tint) * 0.25;
      drawSkeleton(ctx, shownLms, w, h, cfg.mirror, scoring ? gradeVar(tint) : NEUTRAL);
      if (session.armed && out.state === "ok" && !ex.noIdeal) {
        drawIdealChain(ctx, ex.drawIdeal(ctx, shownLms, out.live.side, w, h), w, cfg.mirror);
      }
    }
    if (out.live && session.armed) renderBars($("#live-bars"), out.live.bars);

    // Tip line: lighting first, then framing, then whatever the engine says.
    const dark = lightingHint(ctl.luma);
    const frameHint = !framing.ok && (!session.armed || ["none", "partial"].includes(out.state)) ? framing.hint : null;
    const tip = dark ?? frameHint ?? out.tip ?? "";

    // Speak setup problems that last more than a moment.
    const issue = dark ? "dark" : frameHint ? "framing" : ["none", "partial", "turn", "position"].includes(out.state) ? out.state : null;
    if (issue) {
      if (problem !== issue) { problem = issue; problemSince = ts; }
      else if (ts - problemSince > SETUP_SPEAK_AFTER) {
        const cue = issue === "dark" || issue === "framing" ? tip
                  : issue === "turn" && ex.frontFacing ? SETUP_CUES.turnFront
                  : issue === "position" ? (ex.positionTip ?? SETUP_CUES.position)
                  : SETUP_CUES[issue];
        voice.say(cue, { minGap: 7 });
      }
    } else problem = null;

    ctl.lastOut = out;
    if (!session.armed && ctl.gate && out.ready) { const go = ctl.gate; ctl.gate = null; go(); }
    for (const e of out.events) handleEvent(e);
    if (session.armed) setClock(out);

    // Border + HUD
    if (session.armed) {
      const shown = ex.isHold ? out.hold?.score ?? null : lastScore;
      drawBorder(ctx, w, h, shown ?? 0, target);
      if (ex.isHold && out.hold) {
        setBadge(out.hold.score == null ? null : Math.round(out.hold.score));
        setText("#live-reps",
          `${out.hold.label}: ${Math.min(out.hold.seconds, out.hold.goal).toFixed(1)}${Number.isFinite(out.hold.goal) ? " / " + out.hold.goal + " s" : " s"}`);
      }
    }
    setText("#live-tip", tip);
  }

  /** "Auto" quality: if the full model can't keep up, drop to the fast one (once). */
  function autoQuality(ts) {
    if ((cfg.quality ?? "auto") !== "auto" || poseModel() !== "full" || !fps) return;
    if (fps >= AUTO_LITE_FPS) { slowSince = null; return; }
    slowSince ??= ts;
    if (ts - slowSince < AUTO_LITE_AFTER_MS) return;
    slowSince = Infinity;               // don't try again this session
    initPose(() => {}, "lite")
      .then(() => { if (!ctl.cancelled) toast(`Switched to the Fast model to keep up (${Math.round(fps)} fps)`, 4000); })
      .catch((err) => console.warn("[pose] couldn't switch to the fast model", err));
  }

  // Start: a countdown, or (auto-start) as soon as you're in position and still.
  if (cfg.startMode === "auto") {
    voice.say(ex.isHold ? "Get into position and hold still to start" : "Get into your starting position and hold still", { interrupt: true });
    await new Promise((resolve) => { ctl.gate = resolve; });
  } else {
    await countdown(ctl, cfg.countdown);
  }
  if (ctl.cancelled) return;
  session.arm();
  beep(990, 160, 0.06);
  voice.say("Go!", { interrupt: true });

  /* ── Events from the engine ────────────────────────────── */
  function handleEvent(e) {
    if (e.type === "rep") {
      lastScore = e.score;
      setBadge(e.score);
      countRep(e.score, target);
      checkRep(e.score);
      if (e.good) { checkStreak(e.streak); beep(880, 120, 0.05); } else beep(420, 100, 0.04);
      addChip(e.score);
      let line = repFeedback(exerciseName, e.score, target, e.faults, e.streak);
      if (isSet && cfg.setReps >= 6 && e.index === Math.ceil(cfg.setReps / 2)) line += ` ${milestone("halfway")}`;
      voice.say(line, { interrupt: true });
      updateCounts();
    } else if (e.type === "shallow") {
      beep(300, 90, 0.04);
      voice.say(noRepPhrase(exerciseName), { minGap: 2 });
      flashTip("No rep: not deep enough");
    } else if (e.type === "segment") {
      addChip(e.score);
      lastScore = e.score;
      const secs = session.reps.length * 5;
      const fix = e.faults?.[0];
      voice.say(fix ? faultPhrase(exerciseName, fix.key) : `${secs} seconds. ${praise()}`, { minGap: 3 });
      updateCounts();
    } else if (e.type === "done") {
      celebrate();
    } else if (e.type === "rest-start") {
      flashTip("Resting: the set clock is paused");
    }
  }

  /** Set clock: active time only; says so while it's paused for a rest. */
  function setClock(out) {
    const secs = Math.floor(out.clock ?? 0);
    const text = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}${out.resting ? " · resting" : ""}`;
    setText("#live-clock", text);
  }

  function updateCounts() {
    $("#live-best").textContent = `Best: ${session.best}`;
    if (ex.isHold) return;
    $("#live-reps").textContent = isSet
      ? `Reps: ${session.reps.length}/${cfg.setReps}`
      : `Reps: ${session.reps.length} · Good: ${session.goodReps}${cfg.goal ? "/" + cfg.goal : ""}`;
  }

  function flashTip(text) {
    const tip = $("#live-tip");
    tip.textContent = text;
    tip.classList.add("flash");
    later(() => tip.classList.remove("flash"), 900);
  }

  function celebrate() {
    $("#celebrate h2").textContent = isSet ? "SET COMPLETE" : "TARGET REACHED";
    $("#celebrate-sub").textContent = ex.isHold ? `Best 5 s: ${session.best}` : `Best rep: ${session.best}`;
    $("#celebrate").hidden = false;
    beep(1046, 220, 0.07);
    voice.say(isSet ? "Set complete. Here's your breakdown." : (milestone("improved") || "Target reached. Great work."), { interrupt: true });
    later(() => { $("#celebrate").hidden = true; finish(); }, 1800);
  }

  function finish() {
    if (ctl.cancelled) return;
    const res = session.results();
    stopLive();
    if (!res) {
      toast("No complete reps detected — try again with your whole body in frame");
      onFinish(null);
      return;
    }
    const isBest = recordScore(exerciseName, res.best);
    checkSession();
    onFinish({ exercise: exerciseName, target, isBest, mode: cfg.mode, ...res });
  }

  function later(fn, ms) {
    const id = setTimeout(() => { ctl.timers.delete(id); if (!ctl.cancelled) fn(); }, ms);
    ctl.timers.add(id);
  }
}

/** Stop whatever is running: camera off, loop and timers cancelled, voice silenced. */
export function stopLive() {
  const ctl = active;
  if (!ctl) return;
  ctl.cancelled = true;
  cancelAnimationFrame(ctl.raf);
  $("#video")?.cancelVideoFrameCallback?.(ctl.vfc);
  ctl.timers.forEach(clearTimeout);
  ctl.timers.clear();
  clearInterval(ctl.countdownTimer);
  clearInterval(ctl.watchdog);
  ctl.camAbort?.abort();            // a camera still opening closes itself
  ctl.cleanup.forEach((fn) => fn());
  ctl.markCameraReady();            // lets a waiting runLive() see it was cancelled
  ctl.gate?.();                     // ...and a waiting auto-start
  stopCamera(ctl.stream);
  ctl.stream = null;
  const v = $("#video");
  if (v) v.srcObject = null;
  $("#pose-camera") && ($("#pose-camera").hidden = true);
  $("#countdown") && ($("#countdown").hidden = true);
  voice.stop();
  active = null;
}

/* ── Loading: model, then camera, with friendly errors ─────── */

async function loadEverything(ctl, video, quality) {
  showCameraBox("Loading the pose model…");
  try {
    await initPose((m) => { $("#pose-msg").textContent = m; }, quality);
  } catch (err) {
    console.error(err);
    if (ctl.cancelled) return false;
    showCameraBox("Couldn't load the pose model. Check your internet connection, then try again.", { retry: true });
    return false;
  }
  if (ctl.cancelled) return false;
  ctl.modelReady = true;

  watchCamera(ctl, video);
  watchDevices(ctl, video);
  useCamera(ctl, video);
  await ctl.cameraReady;            // resolves once any camera works (or Back is pressed)
  return !ctl.cancelled;
}

/* ── Camera: choose, open, watch, switch ─────────────────────── */

/**
 * Switch the running session to another camera, without going back to the
 * menu. Returns false if no session is running (the choice is just saved).
 */
export function switchCamera(deviceId) {
  const ctl = active;
  if (!ctl?.modelReady || ctl.cancelled) return false;
  if (ctl.stream && streamCameraId(ctl.stream) === deviceId) return true;
  useCamera(ctl, $("#video"), { pickedId: deviceId, reason: "Switching camera…" });
  return true;
}

/**
 * Get a working camera into the session. Tries `pickedId` (or the saved
 * camera), then every real camera in turn, built-in first; each must send
 * real video within ~3 s. The old camera is stopped before a new one opens.
 * A newer call (another pick, a stall, an unplug) cancels an older one.
 * @param skip      a camera that just failed: tried last
 * @param problem   show the camera dropdown with the message
 */
async function useCamera(ctl, video, { pickedId = null, reason = null, skip = null, problem = false } = {}) {
  ctl.camAbort?.abort();
  const ac = (ctl.camAbort = new AbortController());
  const stale = () => ctl.cancelled || ac.signal.aborted;
  ctl.opening = true;
  dropStream(ctl, video);
  showCameraBox(reason ?? "Starting your camera…", { picker: problem });

  let probe = null;                 // stream opened for the permission check, reused if it's the pick
  try {
    let cams;
    ({ cams, probe } = await listCamerasWithNames());
    if (stale()) return false;
    const preferred = pickedId ?? await savedCameraId(cams);
    if (!pickedId && !preferred && savedCameraLabel()) {
      toast(`${savedCameraLabel()} isn't connected, so another camera was picked`, 4000);
    }
    const order = cameraOrder(cams, preferred, skip);
    if (!order.length) order.push({ id: null, label: "" });   // no list available: browser default

    let lastErr = null;
    for (const cam of order) {
      if (lastErr) {
        showCameraBox(`${cameraErrorMessage(lastErr)} Trying ${cam.label || "the next camera"}…`, { picker: true });
      }
      try {
        const reuse = probe && cam.id && streamCameraId(probe) === cam.id ? probe : null;
        if (reuse) probe = null;
        const stream = await openCamera(video, cam.id, { signal: ac.signal, stream: reuse });
        if (stale()) { stopCamera(stream); return false; }
        attachStream(ctl, video, stream);
        if (lastErr || reason) toast(`Camera: ${streamCameraName(stream) ?? "switched"}`);
        return true;
      } catch (err) {
        if (stale()) return false;
        console.warn("[camera]", cam.label || "default camera", err);
        lastErr = err;
        if (isPermissionError(err)) break;    // no camera works until access is allowed
      }
    }
    if (lastErr?.name === "NoVideo" && order.length > 1) {
      showCameraBox("None of your cameras are sending video. Check that the camera isn't covered or in use by another app, then pick one or try again.", { picker: true, retry: true });
      return false;
    }
    throw lastErr;
  } catch (err) {
    if (stale()) return false;
    console.error(err);
    showCameraBox(cameraErrorMessage(err), { picker: !isPermissionError(err), retry: true });
    return false;
  } finally {
    stopCamera(probe);
    if (ctl.camAbort === ac) ctl.opening = false;
    if (!stale()) refreshCameraPickers(streamCameraId(ctl.stream));
  }
}

/** Make a verified stream the session's camera. */
function attachStream(ctl, video, stream) {
  ctl.stream = stream;
  ctl.frameReset = true;
  sizeCanvas($("#overlay"), video);   // new camera, maybe a new resolution
  ctl.restartLoop?.();
  const track = stream.getVideoTracks()[0];
  track?.addEventListener("ended", () => {
    // Fires when the camera is unplugged or the system takes it away (not when we stop it).
    if (ctl.stream !== stream || ctl.cancelled) return;
    useCamera(ctl, video, {
      reason: "Your camera was disconnected. Looking for another one…",
      skip: streamCameraId(stream), problem: true,
    });
  });
  $("#pose-loading").hidden = true;
  $("#pose-camera").hidden = true;
  ctl.markCameraReady();
}

/** Stop every track of the current camera and detach it from the <video>. */
function dropStream(ctl, video) {
  stopCamera(ctl.stream);
  ctl.stream = null;
  video.srcObject = null;
}

/**
 * Notice a camera that stops sending frames, or that only ever shows one
 * still picture (a virtual camera whose app isn't running), and move on to
 * the next one. Also keeps `ctl.luma` (mean brightness) for the lighting check.
 */
function watchCamera(ctl, video) {
  const frames = countFrames(video);
  ctl.cleanup.push(() => frames.stop());
  const probe = document.createElement("canvas");
  probe.width = 32; probe.height = 18;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  let seen = -1, since = performance.now();
  let lastHash = null, stillSince = performance.now();

  const moveOn = (reason) => {
    since = stillSince = performance.now();
    lastHash = null;
    useCamera(ctl, video, { reason, skip: streamCameraId(ctl.stream), problem: true });
  };

  ctl.watchdog = setInterval(() => {
    if (ctl.cancelled || ctl.opening || !ctl.stream || document.hidden) {
      seen = -1; since = stillSince = performance.now(); lastHash = null;
      return;
    }
    const now = performance.now();
    const n = frames.get();
    if (n === seen) {
      if (now - since > STALL_MS) moveOn("This camera isn't sending video — pick another. Trying the next one…");
      return;
    }
    seen = n; since = now;

    const px = sample(video, pctx);
    if (!px) return;
    const st = frameStats(px);
    ctl.luma = ctl.luma == null ? st.luma : ctl.luma * 0.6 + st.luma * 0.4;
    // Real sensors always add some noise, so frames are never pixel-identical
    // for seconds on end. A virtual camera's placeholder image is.
    if (st.hash !== lastHash) { lastHash = st.hash; stillSince = now; }
    else if (now - stillSince > STILL_MS) {
      moveOn("This camera is showing a still picture, not live video — pick another. Trying the next one…");
    }
  }, 500);
}

/** Cameras plugged in or unplugged while the session runs. */
function watchDevices(ctl, video) {
  const md = navigator.mediaDevices;
  if (!md?.addEventListener) return;
  let known = null;
  listCameras().then((cams) => { known ??= new Set(cams.map((c) => c.id)); });

  const onChange = async () => {
    const cams = await listCameras();
    if (ctl.cancelled) return;
    const added = known ? cams.filter((c) => !known.has(c.id)) : [];
    known = new Set(cams.map((c) => c.id));
    const current = streamCameraId(ctl.stream);

    if (current && !known.has(current)) {
      // Some browsers never fire the track's "ended" event on unplug, so check here too.
      useCamera(ctl, video, { reason: "Your camera was unplugged. Looking for another one…", problem: true });
    } else if (added.length) {
      toast(`Camera connected: ${added.map((c) => c.label || "new camera").join(", ")}`);
      // Stuck without a working camera? Try the new one.
      const real = added.find((c) => c.kind !== "virtual");
      if (!ctl.stream && !ctl.opening && real) {
        useCamera(ctl, video, { pickedId: real.id, reason: `Starting ${real.label || "the new camera"}…` });
      }
    }
  };
  md.addEventListener("devicechange", onChange);
  ctl.cleanup.push(() => md.removeEventListener("devicechange", onChange));
}

/** The message box over the stage: text, plus optional camera dropdown and Try again. */
function showCameraBox(text, { picker = false, retry = false } = {}) {
  $("#pose-loading").hidden = false;
  $("#pose-msg").textContent = text;
  $("#pose-camera").hidden = !picker;
  $("#pose-retry").hidden = !retry;
}

/* ── HUD helpers ──────────────────────────────────────────── */

/** Small on-screen readout shown when the page URL has ?debug. */
function ensureDebugBox() {
  let el = document.getElementById("vf-debug");
  if (!el) {
    el = document.createElement("pre");
    el.id = "vf-debug";
    el.style.cssText = "position:absolute;right:12px;bottom:12px;z-index:20;margin:0;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.65);color:#c6ef4e;font:12px/1.4 ui-monospace,monospace;pointer-events:none";
    document.querySelector("#screen-live .stage").appendChild(el);
  }
  return el;
}

/** Set text only when it changed (no needless DOM work at 30 fps). */
function setText(sel, text) {
  const el = $(sel);
  if (el && el.textContent !== text) el.textContent = text;
}

function setBadge(score) {
  $("#grade-letter").textContent = score == null ? "–" : gradeLetter(score);
  $("#grade-letter").style.color = score == null ? "" : gradeVar(score);
  $("#grade-num").textContent = score == null ? "" : score;
}

function addChip(score) {
  const host = $("#rep-chips");
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = score;
  chip.style.color = gradeVar(score);
  host.appendChild(chip);
  while (host.children.length > 8) host.removeChild(host.firstChild);
}

function goalText(ex, cfg) {
  if (cfg.mode === "set") return ex.isHold ? `${cfg.setReps * 6}-second hold, then results` : `${cfg.setReps} reps, then results`;
  if (cfg.goal === 0) return "Endless: press Back when you're done";
  if (ex.isHold) return `Hold ${gradeLetter(cfg.target)} (${cfg.target}+) for ${cfg.goal === 3 ? 30 : 10} s`;
  return `${cfg.goal} rep${cfg.goal > 1 ? "s" : ""} at ${gradeLetter(cfg.target)} (${cfg.target}+)`;
}

function countdown(ctl, seconds) {
  return new Promise((resolve) => {
    const el = $("#countdown");
    const span = el.querySelector("span");
    let n = seconds;
    el.hidden = false;
    span.textContent = n;
    beep(660, 90, 0.05);
    ctl.countdownTimer = setInterval(() => {
      if (ctl.cancelled) { clearInterval(ctl.countdownTimer); el.hidden = true; resolve(); return; }
      n -= 1;
      if (n <= 0) {
        clearInterval(ctl.countdownTimer);
        el.hidden = true;
        beep(990, 160, 0.06);
        resolve();
        return;
      }
      span.textContent = n;
      beep(660, 90, 0.05);
    }, 1000);
  });
}
