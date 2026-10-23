/**
 * main.js — entry point for the marketing site (index.html).
 */

import { mountHero3d } from "./hero3d.js";
import { mountStory } from "./story.js";
import { mountExercisePopups } from "./expop.js";
import { mountTones } from "./tones.js";
import { mountSmooth } from "./smooth.js";
import { mountScrollFx } from "./scroll-fx.js";
import { mountSparks } from "./sparks.js";
import { mountMagnets } from "./magnet.js";
import { renderPictos } from "../figures/pictos.js";
import { mountCoach } from "./coach.js";
import { gradeColor } from "../grade.js";
import { mountLab } from "./lab.js";
import { mountRep3d } from "./rep3d.js";
import { renderHow } from "./how.js";
import { mountMotionNav } from "./motion-nav.js";
import { mountNavSpy } from "./nav-spy.js";
import { mountRail } from "./rail.js";
import { mountPageTransitions } from "../page-transition.js";
import { mountHoverFill } from "../ui/hover-fill.js";

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
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

document.addEventListener("DOMContentLoaded", () => {
  // GSAP, ScrollTrigger, SplitText and Lenis are self-hosted (public/vendor)
  // and load as plain scripts before this module; everything here still
  // works if they didn't.
  if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger, ...(window.SplitText ? [SplitText] : []));
  mountSmooth();
  stickyNav();
  mountHoverFill();
  headerCta();
  mountMotionNav();
  mountRail();
  mountNavSpy();
  mountPageTransitions();
  colourScores();
  renderPictos();
  mountCoach(document.querySelector("[data-coach]"));
  renderHow();
  mountTones();
  mountSparks();
  const hero = document.querySelector("[data-hero3d]");
  if (hero) mountHero3d(hero);
  const how = document.getElementById("how");
  if (how) mountStory(how);
  mountExercisePopups(document.querySelector(".ex-grid"), document.getElementById("ex-pop"));
  mountScrollFx();
  mountMagnets(".hero-actions .btn, .cta-band .btn");
  const r3 = document.querySelector("[data-r3]");
  if (r3) mountRep3d(r3);
  const lab = document.querySelector("[data-lab]");
  if (lab) mountLab(lab);
});
// The service worker is registered by the trainer (js/main.js), not here: in
// Chrome, the first navigation from a page loaded before the worker existed to
// one it controls skips the page transition, and home → trainer is the one
// that matters. The worker still caches these pages for offline use.
