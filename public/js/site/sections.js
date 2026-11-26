/**
 * sections.js — each section opens on an instrument rule, the way the hero
 * reads: its number and name in mono on the left, a hairline that draws
 * itself across as the section arrives (scrubbed by the scroll), and on the
 * right a reading counted from the section itself ("18 exercises",
 * "4 steps"), so every number shown is real. Numbered as the side rail
 * numbers them; sections without a rail entry get no rule. Decorative:
 * aria-hidden (the headings and content say all of it).
 */

import { reducedMotion } from "../ui/motion.js";
import { CURVE } from "../ui/ease.js";
import { scenesOn } from "./scenes.js";

const LABEL = { exercises: "Exercises", how: "How it works", lab: "Form Lab", coach: "Coaching", progress: "Training", paths: "Skill paths", setup: "Setup", faq: "Questions" };
// What each rule reads on its right: counted from the page, [selector, one, many].
const READ = {
  exercises: [".ex-grid > .ex-card, .mini-plates > li", "exercise", "exercises"],
  how: ["[data-step]", "step", "steps"],
  lab: [".lab [role=tab]", "exercise to try", "exercises to try"],
  coach: ["[data-voice]", "voice", "voices"],
  progress: [".modes > .mode", "mode", "modes"],
  paths: [".paths-rail li, .paths-list > li", "path", "paths"],
  setup: [".setup > li", "step", "steps"],
  faq: [".faq details", "question", "questions"],
};

export function mountSectionIndex() {
  const railN = Object.fromEntries([...document.querySelectorAll(".rail a[href^='#']")].map((a) => [a.hash.slice(1), a.querySelector(".rail-n")?.textContent]));
  const rules = [];
  let count = 0;
  for (const sec of document.querySelectorAll("main > section.section")) {
    const head = sec.querySelector(".section-head");
    const label = LABEL[sec.id];
    if (!head || !label) continue;
    count++;
    const n = railN[sec.id] ?? String(count).padStart(2, "0");
    const [sel, one, many] = READ[sec.id] ?? [];
    const k = sel ? sec.querySelectorAll(sel).length : 0;
    const el = document.createElement("div");
    el.className = "sec-rule";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<span class="sec-rule-n"><i>N°</i>${n}</span><span class="sec-rule-name">${[...label].map((c) => `<b>${c === " " ? "&nbsp;" : c}</b>`).join("")}</span><i class="sec-rule-line"></i>`
      + (k ? `<span class="sec-rule-read">${k} ${k === 1 ? one : many}</span>` : "");
    // Its own row at the top of the section (a heading can sit inside a grid).
    const row = document.createElement("div");
    row.className = "wrap";
    row.append(el);
    sec.prepend(row);
    rules.push(el);
  }

  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reducedMotion()) return;
  for (const el of rules) {
    // The hairline draws across as the section comes up; the labels arrive with it.
    gsap.fromTo(el.querySelector(".sec-rule-line"), { scaleX: 0 }, { scaleX: 1, ease: "none",
      scrollTrigger: { trigger: el, start: "top 92%", end: "top 55%", scrub: 0.5 } });
    // The number and reading rise in; the name's letters follow one by one.
    // With scenes (scenes.js) they come in each time the scene lands and
    // lift out as it leaves, driven by its data-scene in css/site.css.
    el.querySelectorAll(".sec-rule-name b").forEach((b, k) => b.style.setProperty("--i", String(k)));
    if (scenesOn()) continue;
    // (Started as Web Animations, which never read styles: a GSAP tween
    // starting mid-scroll forced a full style recompute; css/site.css .pre
    // holds them down until then.)
    el.classList.add("pre");
    ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: () => {
      el.classList.remove("pre");
      el.querySelectorAll(".sec-rule-n, .sec-rule-read").forEach((s, k) => s.animate([{ transform: "translateY(100%)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 800, delay: k * 80, easing: CURVE.outExpo, fill: "backwards" }));
      el.querySelectorAll(".sec-rule-name b").forEach((b, k) => b.animate([{ transform: "translateY(110%)" }, { transform: "none" }],
        { duration: 600, delay: 100 + k * 35, easing: CURVE.outExpo, fill: "backwards" }));
    } });
  }
}
