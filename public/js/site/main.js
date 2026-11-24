/**
 * main.js — entry point for the marketing site (index.html).
 */

import { mountHero3d } from "./hero3d.js";
import { mountStory } from "./story.js";
import { mountExercisePopups } from "./expop.js";
import { mountTones } from "./tones.js";
import { mountSmooth } from "./smooth.js";
import { mountBoot } from "./boot.js";
import { mountScrollFx } from "./scroll-fx.js";
import { mountSectionIndex } from "./sections.js";
import { mountCardReps } from "./card-reps.js";
import { mountFaq } from "./faq.js";
import { mountPaths } from "./paths.js";
import { renderPictos } from "../figures/pictos.js";
import { mountCoach } from "./coach.js";
import { gradeColor } from "../grade.js";
import { mountLab } from "./lab.js";
import { renderHow } from "./how.js";
import { mountMotionNav, landOnHash } from "./motion-nav.js";
import { mountExerciseRing } from "./ex-ring.js";
import { mountScenes } from "./scenes.js";
import { mountNavSpy } from "./nav-spy.js";
import { mountRail } from "./rail.js";
import { mountProgress } from "./progress.js";
import { mountPageTransitions } from "../page-transition.js";
import { mountHoverFill } from "../ui/hover-fill.js";
import { onScroll } from "./scroll-progress.js";

function colourScores() {
  // Any element with data-score gets its exact colour on the grade scale.
  document.querySelectorAll("[data-score]").forEach((n) => {
    n.style.setProperty("--c", gradeColor(Number(n.dataset.score)));
  });
}

/** The header's "Start training" shows only once the hero's own button is out of view. */
function headerCta() {
  const nav = document.querySelector(".nav");
  const heroBtn = document.querySelector(".hero-actions .btn-grad");
  if (!nav || !heroBtn || !("IntersectionObserver" in window)) { nav?.classList.remove("cta-hidden"); return; }
  const headerH = nav.getBoundingClientRect().height;
  new IntersectionObserver(([e]) => nav.classList.toggle("cta-hidden", e.isIntersecting), {
    rootMargin: `-${Math.round(headerH)}px 0px 0px 0px`,     // hidden under the sticky header counts as gone
  }).observe(heroBtn);
}

function stickyNav() {
  const nav = document.querySelector(".nav");
  onScroll((s) => nav.classList.toggle("scrolled", s.y > 8));
}

document.addEventListener("DOMContentLoaded", () => {
  // GSAP, ScrollTrigger, SplitText and Lenis are self-hosted (public/vendor)
  // and load as plain scripts before this module; everything here still
  // works if they didn't.
  if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger, ...(window.SplitText ? [SplitText] : []));
  mountSmooth();
  mountBoot();                        // the calibration intro, first visit in a session
  stickyNav();
  mountHoverFill();
  headerCta();
  mountMotionNav();
  mountRail();
  mountProgress();
  mountNavSpy();
  mountPageTransitions();
  colourScores();
  renderPictos();
  mountCoach(document.querySelector("[data-coach]"));
  renderHow();
  mountTones();
  const hero = document.querySelector("[data-hero3d]");
  if (hero) mountHero3d(hero);
  const how = document.getElementById("how");
  if (how) mountStory(how);
  mountExercisePopups(document.getElementById("exercises"), document.getElementById("ex-pop"));   // the grid, or the ring
  mountPaths();
  mountSectionIndex();
  mountCardReps(document.querySelector(".ex-grid"));
  mountScrollFx();
  mountFaq();
  const lab = document.querySelector("[data-lab]");
  if (lab) mountLab(lab);
  mountExerciseRing();                // after the section rules and card reveals have counted the cards
  mountScenes();                      // the page scrolls in: each section one full-screen scene (after the ring, story and paths are built)
  landOnHash();                       // last: everything that changes the page's height has mounted
  // ?stage: the 3D stage's placeholder and the scroll numbers it gets
  // (stage-placeholder.js), for building the 3D. Not loaded otherwise.
  if (new URLSearchParams(location.search).has("stage")) import("./stage-placeholder.js").then((m) => m.mountStagePlaceholder());
  // The space the page sits in (atmosphere.js), and the figure beside the
  // questions and the closing band (stage-body.js, wide screens).
  import("./atmosphere.js").then((m) => m.mountAtmosphere());
  import("./stage-body.js").then((m) => m.mountStageBody());
});
// The service worker is registered by the trainer (js/main.js), not here: in
// Chrome, the first navigation from a page loaded before the worker existed to
// one it controls skips the page transition, and home → trainer is the one
// that matters. The worker still caches these pages for offline use.
