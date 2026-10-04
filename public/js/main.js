/**
 * main.js — app entry point and screen router.
 *
 * Flow:  menu → mode (+ setup options) → live session → results → menu
 */

import { DEFAULTS, EXERCISE_META, DEMO_TIPS } from "./config.js";
import { getSetting, setSetting, store } from "./storage.js";
import { voice } from "./voice.js";
import { $, $$, showScreen, toast } from "./ui/components.js";
import { renderMenu, addSessionEntry } from "./ui/menu.js";
import { runLive, stopLive, switchCamera } from "./ui/live.js";
import { refreshCameraPickers, onCameraPicked } from "./ui/camera-picker.js";
import { renderResults } from "./ui/results.js";
import { renderStats, wireStatsReset } from "./ui/stats.js";
import { saveScoreCard } from "./ui/sharecard.js";
import { mountLoop } from "./figures/loop.js";
import { BY_NAME } from "./figures/pictos.js";

/* ── Session config, seeded from saved settings ─────────── */
const cfg = {
  mode: "practice",
  target:    getSetting("target",      DEFAULTS.target),
  goal:      getSetting("goal",        DEFAULTS.goal),
  countdown: getSetting("countdown",   DEFAULTS.countdown),
  personality: getSetting("personality", DEFAULTS.personality),
  voice:     getSetting("voice",       DEFAULTS.voice),
  mirror:    getSetting("mirror",      DEFAULTS.mirror),
  setReps:   getSetting("setReps",     DEFAULTS.setReps),
  quality:   getSetting("quality",     DEFAULTS.quality),
  startMode: getSetting("startMode",   DEFAULTS.startMode),
};

let currentExercise = null;
let lastResults = null;
let stopDemo = () => {};

/* ── Boot ───────────────────────────────────────────────── */

function boot() {
  voice.enabled = cfg.voice;
  renderMenu(openMode);
  wirePills();
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
    // Settings live in the mode screen's setup panel — jump there.
    if (!currentExercise) currentExercise = "Squat";
    openMode(currentExercise);
    toast("Session options are below");
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

/* ── Setup pills ────────────────────────────────────────── */

function wirePills() {
  const groups = {
    "#opt-target":      { key: "target",      parse: Number },
    "#opt-goal":        { key: "goal",        parse: Number },
    "#opt-countdown":   { key: "countdown",   parse: Number },
    "#opt-personality": { key: "personality", parse: String },
    "#opt-setlen":      { key: "setReps",     parse: Number },
    "#opt-start":       { key: "startMode",   parse: String },
  };

  Object.entries(groups).forEach(([sel, { key, parse }]) => {
    const host = $(sel);
    if (!host) return;

    // Reflect the saved value on load.
    $$("button", host).forEach((b) =>
      b.classList.toggle("on", parse(b.dataset.val) === cfg[key]));

    host.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      $$("button", host).forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      cfg[key] = parse(btn.dataset.val);
      setSetting(key, cfg[key]);
    });
  });

  // Toggle pills (voice / mirror)
  const toggles = $("#opt-toggles");
  $$("button", toggles).forEach((b) => {
    const key = b.dataset.tog;
    b.classList.toggle("on", !!cfg[key]);
    b.textContent = `${cap(key)} ${cfg[key] ? "on" : "off"}`;
  });

  toggles.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const key = btn.dataset.tog;
    cfg[key] = !cfg[key];
    setSetting(key, cfg[key]);
    btn.classList.toggle("on", cfg[key]);
    btn.textContent = `${cap(key)} ${cfg[key] ? "on" : "off"}`;
    if (key === "voice") voice.enabled = cfg[key];
  });
}

/* ── Camera picker ──────────────────────────────────────── */

function wireCamera() {
  refreshCameraPickers();
  // A session is running: switch to the picked camera in place.
  // Otherwise the choice is saved and used next time.
  onCameraPicked((id) => switchCamera(id));
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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
