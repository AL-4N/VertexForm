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
  initPose, detect, poseDelegate,
  openCamera, stopCamera, listCameras, listCamerasWithNames, cameraOrder, countFrames,
  cameraErrorMessage, isPermissionError, streamCameraId, streamCameraName,
} from "../pose.js";
import { savedCameraId, savedCameraLabel, refreshCameraPickers } from "./camera-picker.js";
import { Session } from "../session.js";
import { gradeLetter, gradeVar } from "../geometry.js";
import { repFeedback, faultPhrase, milestone, noRepPhrase, praise, SETUP_CUES } from "../coaching.js";
import { voice, beep } from "../voice.js";
import { recordScore, countRep } from "../storage.js";
import { checkRep, checkStreak, checkSession } from "../achievements.js";
import { $, renderBars, toast } from "./components.js";
import { sizeCanvas, drawFrame, drawSkeleton, drawIdealChain, drawBorder } from "./overlay.js";

const NEUTRAL = "#eef1fb";        // skeleton colour between reps
const SETUP_SPEAK_AFTER = 2500;   // ms a setup problem must last before it's said out loud
const STALL_MS = 3000;            // no new video frames for this long = the camera has stopped

let active = null;                // the running session's control object

/**
 * @param exerciseName  which exercise
 * @param cfg  { mode, target, goal, countdown, mirror, setReps }
 * @param onFinish  called with a results object, or null if nothing to show
 */
export async function runLive(exerciseName, cfg, onFinish) {
  stopLive();
  const ctl = {
    cancelled: false, stream: null, raf: 0, timers: new Set(),
    modelReady: false, opening: false, camAbort: null, frameReset: false,
    watchdog: 0, cleanup: [],
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
  $("#live-reps").textContent = ex.isHold ? "Hold: 0 s" : `Reps: 0${isSet ? "/" + cfg.setReps : ""}`;

  /* ── Model + camera ────────────────────────────────────── */
  const loadingOk = await loadEverything(ctl, video);
  if (!loadingOk || ctl.cancelled) return;

  await countdown(ctl, cfg.countdown);
  if (ctl.cancelled) return;
  voice.say("Go!", { interrupt: true });

  const session = new Session(ex, cfg);
  let lastVideoTime = -1, lastTs = 0, tint = null;
  let problem = null, problemSince = 0;          // setup problem being tracked for voice
  let lastScore = null;
  const debug = new URLSearchParams(location.search).has("debug");
  let fps = 0, lastFrameAt = 0;
  const dbgEl = debug ? ensureDebugBox() : null;

  /* ── Frame loop ────────────────────────────────────────── */
  const loop = () => {
    if (ctl.cancelled) return;
    ctl.raf = requestAnimationFrame(loop);
    if (ctl.frameReset) {             // new camera: forget the old one's frame clock
      ctl.frameReset = false;
      lastVideoTime = -1; lastFrameAt = 0; fps = 0;
      session.lastT = null;           // first frame from the new camera counts as dt = 0
    }
    // MediaPipe timestamps (ts below) are NOT reset: they must keep increasing.
    if (!ctl.stream || video.readyState < 2 || video.currentTime === lastVideoTime) return;   // no new frame yet
    lastVideoTime = video.currentTime;

    const ts = Math.max(performance.now(), lastTs + 1);                        // strictly increasing
    lastTs = ts;
    const { w, h } = sizeCanvas(canvas, video);
    drawFrame(ctx, video, w, h, cfg.mirror);

    const lms = detect(video, ts);
    const out = session.update(lms, (video.videoWidth || 16) / (video.videoHeight || 9), ts);
    if (lastFrameAt) fps = fps * 0.9 + (1000 / Math.max(1, ts - lastFrameAt)) * 0.1;
    lastFrameAt = ts;
    // Always-on, cheap snapshot for troubleshooting (and the automated tests).
    window.__vfDebug = {
      fps: Math.round(fps), state: out.state, phase: session.phase, delegate: poseDelegate(),
      metric: session.lastMetric != null ? Math.round(session.lastMetric * 100) / 100 : null,
      reps: session.reps.length, facing: session.facing != null ? +session.facing.toFixed(2) : null,
      camera: streamCameraName(ctl.stream),
    };
    if (dbgEl) dbgEl.textContent = Object.entries(window.__vfDebug).map(([k, v]) => `${k}: ${v}`).join("\n");

    // Skeleton: coloured by form while you're mid-rep (or holding), neutral otherwise.
    if (lms) {
      const scoring = out.state === "ok" && (out.inRep || ex.isHold) && out.live;
      if (scoring) tint = tint == null ? out.live.score : tint + (out.live.score - tint) * 0.25;
      drawSkeleton(ctx, lms, w, h, cfg.mirror, scoring ? gradeVar(tint) : NEUTRAL);
      if (out.state === "ok" && !ex.noIdeal) {
        drawIdealChain(ctx, ex.drawIdeal(ctx, lms, out.live.side, w, h), w, cfg.mirror);
      }
    }
    if (out.live) renderBars($("#live-bars"), out.live.bars);

    // Speak setup problems that last more than a moment.
    const isProblem = ["none", "partial", "turn", "position"].includes(out.state);
    if (isProblem) {
      if (problem !== out.state) { problem = out.state; problemSince = ts; }
      else if (ts - problemSince > SETUP_SPEAK_AFTER) {
        const cue = out.state === "turn" && ex.frontFacing ? SETUP_CUES.turnFront
                  : out.state === "position" ? (ex.positionTip ?? SETUP_CUES.position)
                  : SETUP_CUES[out.state];
        voice.say(cue, { minGap: 7 });
      }
    } else problem = null;

    for (const e of out.events) handleEvent(e);

    // Border + HUD
    const shown = ex.isHold ? out.hold?.score ?? null : lastScore;
    drawBorder(ctx, w, h, shown ?? 0, target);
    if (ex.isHold && out.hold) {
      setBadge(out.hold.score == null ? null : Math.round(out.hold.score));
      $("#live-reps").textContent =
        `${out.hold.label}: ${Math.min(out.hold.seconds, out.hold.goal).toFixed(1)}${Number.isFinite(out.hold.goal) ? " / " + out.hold.goal + " s" : " s"}`;
    }
    $("#live-tip").textContent = out.tip || "";
  };
  ctl.raf = requestAnimationFrame(loop);

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
    }
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
  ctl.timers.forEach(clearTimeout);
  ctl.timers.clear();
  clearInterval(ctl.countdownTimer);
  clearInterval(ctl.watchdog);
  ctl.camAbort?.abort();            // a camera still opening closes itself
  ctl.cleanup.forEach((fn) => fn());
  ctl.markCameraReady();            // lets a waiting runLive() see it was cancelled
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

async function loadEverything(ctl, video) {
  showCameraBox("Loading the pose model…");
  try {
    await initPose((m) => { $("#pose-msg").textContent = m; });
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

  try {
    const cams = await listCamerasWithNames();
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
        const stream = await openCamera(video, cam.id, { signal: ac.signal });
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
    if (ctl.camAbort === ac) ctl.opening = false;
    if (!stale()) refreshCameraPickers(streamCameraId(ctl.stream));
  }
}

/** Make a verified stream the session's camera. */
function attachStream(ctl, video, stream) {
  ctl.stream = stream;
  ctl.frameReset = true;
  sizeCanvas($("#overlay"), video);   // new camera, maybe a new resolution
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

/** Notice a camera that stops sending frames, and move on to the next one. */
function watchCamera(ctl, video) {
  const frames = countFrames(video);
  ctl.cleanup.push(() => frames.stop());
  let seen = -1, since = performance.now();
  ctl.watchdog = setInterval(() => {
    if (ctl.cancelled || ctl.opening || !ctl.stream || document.hidden) {
      seen = -1; since = performance.now();
      return;
    }
    const n = frames.get();
    if (n !== seen) { seen = n; since = performance.now(); return; }
    if (performance.now() - since > STALL_MS) {
      since = performance.now();
      useCamera(ctl, video, {
        reason: "This camera isn't sending video. Pick another camera. Trying the next one…",
        skip: streamCameraId(ctl.stream), problem: true,
      });
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
    el.style.cssText = "position:absolute;left:12px;bottom:12px;z-index:20;margin:0;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.65);color:#c6ef4e;font:12px/1.4 ui-monospace,monospace;pointer-events:none";
    document.querySelector("#screen-live .stage").appendChild(el);
  }
  return el;
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
