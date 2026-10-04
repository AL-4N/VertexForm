/**
 * main.js — entry point for the marketing site (index.html).
 */

import { mountStage } from "./stage.js";
import { renderPictos } from "../figures/pictos.js";
import { mountCoach } from "./coach.js";
import { gradeColor } from "../grade.js";
import { mountLab } from "./lab.js";
import { mountGame } from "./game.js";
import { renderHow } from "./how.js";
import { mountMotionNav } from "./motion-nav.js";
import { mountPageTransitions } from "../page-transition.js";

function colourScores() {
  // Any element with data-score gets its exact colour on the grade scale.
  document.querySelectorAll("[data-score]").forEach((n) => {
    n.style.setProperty("--c", gradeColor(Number(n.dataset.score)));
  });
}

function stickyNav() {
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

document.addEventListener("DOMContentLoaded", () => {
  stickyNav();
  mountMotionNav();
  mountPageTransitions();
  colourScores();
  renderPictos();
  mountCoach(document.querySelector("[data-coach]"));
  renderHow();
  const stage = document.querySelector("[data-stage]");
  if (stage) mountStage(stage);
  const lab = document.querySelector("[data-lab]");
  if (lab) mountLab(lab);
  const game = document.querySelector("[data-game]");
  if (game) mountGame(game);
});
// The service worker is registered by the trainer (js/main.js), not here: in
// Chrome, the first navigation from a page loaded before the worker existed to
// one it controls skips the page transition, and home → trainer is the one
// that matters. The worker still caches these pages for offline use.
