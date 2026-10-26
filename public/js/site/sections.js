/**
 * sections.js — a big outlined index number for each section, in the empty
 * space beside its heading on wide screens (Prägen-style numbered
 * chapters). Only sections whose heading has the row to itself get one,
 * numbered 01, 02… in page order. As a section arrives, its
 * digits roll up into place and the label decodes (decrypt.js picks up
 * .sec-index span); while you scroll past, the number drifts a little
 * slower than the page, for depth. Decorative: aria-hidden.
 */

import { reducedMotion } from "../ui/motion.js";

const LABEL = { exercises: "Exercises", how: "How it works", lab: "Form Lab", progress: "Training modes", paths: "Skill paths", setup: "Setup", faq: "Questions" };

export function mountSectionIndex() {
  const sections = [...document.querySelectorAll("main > section.section")];
  let count = 0;
  sections.forEach((sec) => {
    const head = sec.querySelector(":scope > .wrap > .section-head");
    if (!head) return;
    const label = LABEL[sec.id] ?? (sec.classList.contains("r3-section") ? "In 3D" : null);
    if (!label) return;
    const n = String(++count).padStart(2, "0");
    const el = document.createElement("div");
    el.className = "sec-index";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<b><i>${n}</i></b><span>${label}</span>`;
    head.parentElement.insertBefore(el, head);
  });

  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reducedMotion()) return;
  for (const el of document.querySelectorAll(".sec-index")) {
    gsap.from(el.querySelector("i"), { yPercent: 105, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } });
    gsap.fromTo(el, { y: 50 }, { y: -50, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: 0.5 } });
  }
}
