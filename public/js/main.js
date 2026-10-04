/**
 * main.js — app entry point and screen router.
 *
 * Flow:  menu → mode (+ setup options) → live session → results → (rest → next set) → menu
 *        menu → workouts → circuit: [live → rest] × steps → workout summary
 */

import { EXERCISE_META, DEMO_TIPS } from "./config.js";
import { speech } from "./voice.js";
import { cfg as settingsCfg, wireSettings, setCfg, onSetting } from "./ui/settings.js";
import { $, $$, showScreen, toast } from "./ui/components.js";
import { renderMenu, addSessionEntry } from "./ui/menu.js";
import { runLive, stopLive, switchCamera, togglePause, toggleMute, toggleFullscreen, flipCamera } from "./ui/live.js";
import { refreshCameraPickers, onCameraPicked } from "./ui/camera-picker.js";
import { renderResults } from "./ui/results.js";
import { renderStats, wireStatsReset } from "./ui/stats.js";
import { wireWorkouts, renderWorkouts } from "./ui/workouts.js";
import { showRest, stopRest } from "./ui/rest-screen.js";
import { showOnboarding } from "./ui/onboarding.js";
import { CircuitRunner, stepSession, describeStep } from "./circuit.js";
import { gradeVar } from "./geometry.js";
import { registerServiceWorker } from "./pwa.js";
import { mountPageTransitions } from "./page-transition.js";
import { saveScoreCard } from "./ui/sharecard.js";
import { mountLoop } from "./figures/loop.js";
import { BY_NAME } from "./figures/pictos.js";

/* ── Settings (js/ui/settings.js keeps them and their controls in sync) ── */
const cfg = settingsCfg;

let currentExercise = null;
let lastResults = null;
let stopDemo = () => {};
let circuit = null;              // the running workout (CircuitRunner), if any

/* ── Boot ───────────────────────────────────────────────── */

function boot() {
  mountPageTransitions();
  wireSettings();
  renderMenu(openMode);
  wireNav();
  wireStatsReset(() => renderMenu(openMode));
  wireCamera();
  wireWorkouts(startCircuit);

  if (!window.isSecureContext) {
    toast("Camera needs HTTPS — use a local server or your published site");
  }
  // First visit: three quick setup tips (re-openable from Settings).
  if (!cfg.onboarded) showOnboarding(() => setCfg("onboarded", true));

  // ?debug: hooks for troubleshooting and the browser tests (tests/e2e).
  if (new URLSearchParams(location.search).has("debug")) {
    window.__vf = {
      cfg,
      showResults(r) { lastResults = r; currentExercise = r.exercise; renderResults(r); showScreen("results"); },
    };
  }
}

/* ── Navigation ─────────────────────────────────────────── */

function wireNav() {
  $$("[data-back]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const to = btn.dataset.back;
      if (to === "menu") { stopDemo(); renderMenu(openMode); }
      showScreen(to, { dir: "back" });
    }));

  $("#btn-workouts").addEventListener("click", () => {
    renderWorkouts();
    showScreen("workouts");
  });
  $("#btn-onboarding").addEventListener("click", () => showOnboarding(() => setCfg("onboarded", true)));
  $("#btn-rest").addEventListener("click", () => {
    if (!lastResults) return;
    const ex = lastResults.exercise;
    showRest({
      seconds: cfg.restSeconds, next: lastResults.isHold ? `${ex}, ${cfg.setReps * 6} s` : `${ex} × ${lastResults.repCount}`,
      onGo: () => startSession(cfg.mode), onEnd: () => showScreen("results", { dir: "back" }),
    });
  });

  $("#btn-stats").addEventListener("click", () => {
    renderStats();
    showScreen("stats");
  });

  $("#btn-settings").addEventListener("click", () => {
    refreshCameraPickers();
    showScreen("settings");
  });
  $("#btn-test-voice").addEventListener("click", () => {
    if (!cfg.voice) { toast("The voice is off"); return; }
    speech.say("Ninety two. Nice depth, keep the chest up.", { interrupt: true, priority: 5 });
  });

  $("#mode-practice").addEventListener("click", () => startSession("practice"));
  $("#mode-set").addEventListener("click", () => startSession("set"));

  $("#pose-retry").addEventListener("click", () => startSession(cfg.mode));

  $("#live-back").addEventListener("click", goBackFromLive);
  wireLiveControls();

  $("#btn-share").addEventListener("click", async () => {
    if (!lastResults) return;
    try { await saveScoreCard(lastResults); toast("Score card saved to your downloads"); }
    catch { toast("Couldn't make the image in this browser"); }
  });

  $("#btn-again").addEventListener("click", () => {
    if (currentExercise) startSession(cfg.mode);
  });
}

/** Back from the live screen: the camera goes off at once, whatever was happening. */
function goBackFromLive() {
  stopLive();
  if (circuit) { endCircuit(); return; }
  showScreen("mode", { dir: "back" });
}

/* ── Live screen controls ───────────────────────────────── */

function wireLiveControls() {
  $("#live-pause").addEventListener("click", () => togglePause());
  $("#paused-resume").addEventListener("click", () => togglePause(false));
  $("#live-mute").addEventListener("click", toggleMute);
  $("#live-mirror").addEventListener("click", () => setCfg("mirror", !cfg.mirror));
  $("#live-gym").addEventListener("click", () => setCfg("gymMode", !cfg.gymMode));
  $("#live-full").addEventListener("click", toggleFullscreen);
  $("#live-flip").addEventListener("click", () => {
    const next = cfg.facing === "environment" ? "user" : "environment";
    setCfg("facing", next);
    if (cfg.mirror === (next === "environment")) setCfg("mirror", next !== "environment");   // a back camera isn't a mirror
    flipCamera(next);
  });

  const reflect = () => {
    $("#screen-live .stage").classList.toggle("gym", !!cfg.gymMode);
    $("#live-gym").setAttribute("aria-pressed", String(!!cfg.gymMode));
    $("#live-mirror").setAttribute("aria-pressed", String(!!cfg.mirror));
  };
  onSetting((key) => { if (key === "gymMode" || key === "mirror") reflect(); });
  reflect();

  // Keyboard shortcuts on the live screen (extras: every one has a button).
  document.addEventListener("keydown", (e) => {
    if (!$("#screen-live").classList.contains("active")) return;
    if (e.target.closest?.("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "spacebar") { e.preventDefault(); togglePause(); }
    else if (k === "m") toggleMute();
    else if (k === "f") toggleFullscreen();
    else if (k === "g") setCfg("gymMode", !cfg.gymMode);
    else if (k === "escape" && !document.fullscreenElement) goBackFromLive();
  });
}

function openMode(exercise) {
  currentExercise = exercise;
  $("#mode-title").textContent = exercise;

  const supportsLive = EXERCISE_META[exercise]?.live !== false;
  $("#mode-practice").style.display = supportsLive ? "" : "none";

  // Plank is a hold, so the wording (and the set length) is in seconds.
  const hold = exercise === "Plank";
  $("#mode-practice-text").textContent = hold
    ? "Live coaching while you hold. Keep your target grade for 10 seconds (or 30)."
    : "Live coaching, rep by rep, until you hit your target grade.";
  $("#mode-set-title").textContent = hold ? "Analyze a hold" : "Analyze a set";
  $("#mode-set-text").textContent = hold
    ? "Hold for a set time, then get a graded breakdown in 5-second chunks."
    : "Do a fixed number of reps, then get a full graded breakdown.";
  $$("#opt-setlen button").forEach((b) => {
    const n = Number(b.dataset.val);
    b.textContent = hold ? `${n * 6} s` : `${n} reps`;
  });
  $$("#opt-goal button").forEach((b) => {
    const n = Number(b.dataset.val);
    b.textContent = n === 0 ? "Endless" : hold ? `${n === 3 ? 30 : 10} s at target` : `${n} good rep${n > 1 ? "s" : ""}`;
  });

  // Animated "good rep" demo + the three things that matter.
  stopDemo();
  stopDemo = mountLoop($("#mode-demo"), BY_NAME[exercise]);
  $("#demo-tips").innerHTML = (DEMO_TIPS[exercise] ?? []).map((t) => `<li>${t}</li>`).join("");

  showScreen("mode");
}

/* ── Camera picker ──────────────────────────────────────── */

function wireCamera() {
  refreshCameraPickers();
  // A session is running: switch to the picked camera in place.
  // Otherwise the choice is saved and used next time.
  onCameraPicked((id) => switchCamera(id));
}


/* ── Workouts (circuits) ────────────────────────────────── */

function startCircuit(routine) {
  stopDemo();
  circuit = new CircuitRunner(routine);
  speech.say(`${routine.name}. ${routine.steps.length} exercises. First, ${describeStep(circuit.current).replace("×", "")}.`, { anytime: true, priority: 2 });
  runCircuitStep();
}

function runCircuitStep() {
  const step = circuit.current;
  const runCfg = { ...cfg, ...stepSession(step) };
  $("#live-title").textContent = "";
  showScreen("live");
  runLive(step.exercise, runCfg, (results) => {
    if (!circuit) return;
    circuit.record(results);
    if (results) addSessionEntry(results.exercise, results.best);
    if (circuit.done) { endCircuit(); return; }
    showRest({
      seconds: circuit.routine.rest, kicker: `Rest · ${circuit.progress} next`,
      next: describeStep(circuit.current), auto: true,
      onGo: runCircuitStep, onEnd: endCircuit,
    });
  }, { label: `${circuit.routine.name} · ${circuit.progress}` });
}

/** Finish (or abandon) the workout and show what got done. */
function endCircuit() {
  stopRest();
  const c = circuit;
  circuit = null;
  if (!c) { showScreen("menu"); return; }
  const rows = c.summary();
  const done = rows.filter((r) => r.done).length;
  $("#circuit-title").textContent = done === rows.length ? `${c.routine.name}: complete` : `${c.routine.name}: ${done} of ${rows.length} done`;
  $("#circuit-table").innerHTML = `<thead><tr><th scope=col>Exercise</th><th scope=col>Best</th><th scope=col>Average</th><th scope=col>Reps</th></tr></thead><tbody>${rows.map((r) => `
    <tr><td>${r.step}</td>
      <td>${r.done ? `<strong style="color:${gradeVar(r.best)}">${r.best}</strong>` : '<span class="dim">skipped</span>'}</td>
      <td>${r.done ? r.average : "–"}</td><td>${r.done ? r.reps : "–"}</td></tr>`).join("")}</tbody>`;
  renderMenu(openMode);
  showScreen("circuit-done");
  if (done) speech.say(done === rows.length ? "Workout complete. Nice work." : "Workout ended.", { anytime: true, priority: 3 });
}

/* ── Session lifecycle ──────────────────────────────────── */

async function startSession(mode) {
  if (!currentExercise) return;
  cfg.mode = mode;
  stopDemo();
  stopRest();
  showScreen("live");

  await runLive(currentExercise, cfg, (results) => {
    if (!results) {                 // backed out or no reps
      showScreen("menu", { dir: "back" });
      renderMenu(openMode);
      return;
    }
    lastResults = results;
    addSessionEntry(results.exercise, results.best);
    renderResults(results);
    showScreen("results");
  });
}

/* ── Go ─────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", boot);
registerServiceWorker();
