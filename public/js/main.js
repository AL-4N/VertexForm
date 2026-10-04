/**
 * main.js — app entry point and screen router.
 *
 * Flow:  menu → mode (+ setup options) → live session → results → menu
 */

import { EXERCISE_META, DEMO_TIPS } from "./config.js";
import { speech } from "./voice.js";
import { cfg as settingsCfg, wireSettings } from "./ui/settings.js";
import { $, $$, showScreen, toast } from "./ui/components.js";
import { renderMenu, addSessionEntry } from "./ui/menu.js";
import { runLive, stopLive, switchCamera } from "./ui/live.js";
import { refreshCameraPickers, onCameraPicked } from "./ui/camera-picker.js";
import { renderResults } from "./ui/results.js";
import { renderStats, wireStatsReset } from "./ui/stats.js";
import { saveScoreCard } from "./ui/sharecard.js";
import { mountLoop } from "./figures/loop.js";
import { BY_NAME } from "./figures/pictos.js";

/* ── Settings (js/ui/settings.js keeps them and their controls in sync) ── */
const cfg = settingsCfg;

let currentExercise = null;
let lastResults = null;
let stopDemo = () => {};

/* ── Boot ───────────────────────────────────────────────── */

function boot() {
  wireSettings();
  renderMenu(openMode);
  wireNav();
  wireStatsReset(() => renderMenu(openMode));
  wireCamera();

  if (!window.isSecureContext) {
    toast("Camera needs HTTPS — use a local server or your published site");
  }
}

/* ── Navigation ─────────────────────────────────────────── */

function wireNav() {
  $$("[data-back]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const to = btn.dataset.back;
      if (to === "menu") renderMenu(openMode);
      showScreen(to);
    }));

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

  $("#live-back").addEventListener("click", () => {
    stopLive();
    showScreen("mode");
  });

  $("#btn-share").addEventListener("click", async () => {
    if (!lastResults) return;
    try { await saveScoreCard(lastResults); toast("Score card saved to your downloads"); }
    catch { toast("Couldn't make the image in this browser"); }
  });

  $("#btn-again").addEventListener("click", () => {
    if (currentExercise) startSession(cfg.mode);
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


/* ── Session lifecycle ──────────────────────────────────── */

async function startSession(mode) {
  if (!currentExercise) return;
  cfg.mode = mode;
  stopDemo();
  showScreen("live");

  await runLive(currentExercise, cfg, (results) => {
    if (!results) {                 // backed out or no reps
      showScreen("menu");
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
