/**
 * scroll-fx.js — what happens as you scroll the homepage (GSAP ScrollTrigger
 * and SplitText, vendor/gsap).
 *
 *   Headings   split into lines and letters; the letters rise out of their
 *              line's mask one after another, the first time the heading
 *              comes on screen (the hero's on load). Screen readers get the
 *              heading as one label.
 *   Leads      each section's opening paragraph starts dim and lights up
 *              word by word, at reading pace, as the section lands (with
 *              scenes.js the section is held still while it arrives, so a
 *              scroll-scrubbed light would finish before you could see it).
 *   Cards      each group (exercise cards, steps, modes, cues, panels…)
 *              rises in one after another as it enters.
 *   Hero       as you scroll away, the copy drifts up faster than the page
 *              and the 3D scene sinks and fades: depth, not a hard cut.
 *
 * Nothing is hidden unless GSAP loaded and motion is allowed; with reduced
 * motion the page is simply there.
 */

import { reducedMotion } from "../ui/motion.js";
import { gradeColor } from "../grade.js";
import { scenesOn } from "./scenes.js";
import { CURVE } from "../ui/ease.js";

export function mountScrollFx() {
  const { gsap, ScrollTrigger, SplitText } = window;
  if (!gsap || !ScrollTrigger || reducedMotion()) return;
  gsap.registerPlugin(ScrollTrigger, ...(SplitText ? [SplitText] : []));

  /* ── Headings ───────────────────────────────────────── */
  // Split only once the web fonts are in (lines measured in the fallback
  // font come out wrong); the hero headline waits hidden, at most a second.
  if (SplitText) {
    const heads = [document.querySelector(".hero h1"), ...document.querySelectorAll("main section .section-head h2, .cta-band h2")].filter(Boolean);
    document.documentElement.classList.add("split-wait");
    const fonts = Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1000))]);
    fonts.then(() => { document.documentElement.classList.remove("split-wait"); heads.forEach(split); leads.forEach(light); });
  }
  // With scenes, a heading or lead waits until its scene has landed.
  const scenes = scenesOn();
  const leads = SplitText ? gsap.utils.toArray("main section .section-head p, .cta-band .wrap > p") : [];
  // These reveals start by adding a class (CSS transitions, css/site.css),
  // not by GSAP tweens: a tween starting mid-scroll reads the element's
  // style first, and with the scene transitions writing styles in the same
  // frame every read forced the whole page to recompute (fast scrolling
  // started a dozen at once and stuttered). A class change only writes.
  const once = (el, start, fn) => {
    if (el.dataset.fxTrig) return;
    el.dataset.fxTrig = "1";
    ScrollTrigger.create({ trigger: el, start, once: true, onEnter: fn });
  };
  // Lit as you read: every word dim, then each one comes up to full in
  // turn, like a reading line moving through it.
  function light(p) {
    SplitText.create(p, {
      type: "words", wordsClass: "lit-w", autoSplit: true,
      onSplit: (self) => {
        p.style.setProperty("--each", `${Math.min(0.06, 2.2 / Math.max(1, self.words.length)).toFixed(3)}s`);
        self.words.forEach((w, i) => w.style.setProperty("--i", String(i)));
        p.classList.add("lit-ready");
        once(p, scenes ? "top 62%" : "top 85%", () => p.classList.add("lit"));
      },
    });
  }
  function split(h, k) {
    SplitText.create(h, {
      type: "lines,words,chars", mask: "lines", autoSplit: true, linesClass: "split-line", charsClass: "split-ch",
      onSplit: (self) => {
        // Letter by letter out of the line's mask: a clean rise (expo-out),
        // no blur, a slight tip back that settles as each letter lands.
        h.style.setProperty("--each", `${Math.min(0.024, 0.9 / Math.max(1, self.chars.length)).toFixed(4)}s`);
        self.chars.forEach((c, i) => c.style.setProperty("--i", String(i)));
        h.classList.add("rise-ready");
        if (k !== 0) { once(h, scenes ? "top 48%" : "top 88%", () => h.classList.add("risen")); return; }
        // The hero's headline waits, hidden, behind the calibration intro (boot.js).
        const go = () => setTimeout(() => h.classList.add("risen"), 150);
        if (document.documentElement.classList.contains("booting")) document.addEventListener("vf:booted", go, { once: true });
        else go();
      },
    });
  }

  /* ── Cards rise in, group by group ──────────────────── */
  const groups = [".ex-grid > .ex-card", ".steps > li", ".modes > .mode", ".cues > .cue", ".principles > li", ".cal-rows > li", ".two-col > .panel", ".also > div", ".lab", ".setup > li", ".faq > details"];
  groups.forEach((sel) => {
    const items = gsap.utils.toArray(sel);
    if (!items.length) return;
    ScrollTrigger.batch(items, {
      start: "top 90%", once: true,
      onEnter: (batch) => batch.forEach((el, k) => el.animate([{ transform: "translateY(28px)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 900, delay: k * 60, easing: CURVE.outExpo, fill: "backwards" })),
    });
  });

  /* ── Setup plans draw themselves in ─────────────────── */
  // Each step's little plan is penned stroke by stroke as its card arrives:
  // floor, camera, the rays, then the person.
  gsap.utils.toArray(".setup-step svg").forEach((svg) => {
    const strokes = [...svg.querySelectorAll("path, line, circle, rect")];
    const text = [...svg.querySelectorAll("text")];          // not every plan has labels
    strokes.forEach((s) => { s.setAttribute("pathLength", "1"); s.style.strokeDasharray = "1 1"; s.style.strokeDashoffset = "1"; });
    text.forEach((t) => { t.style.opacity = "0"; });
    ScrollTrigger.create({ trigger: svg, start: "top 85%", once: true, onEnter: () => {
      const runs = strokes.map((s, k) => s.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 900, delay: 250 + k * 90, easing: CURVE.inOutQuad, fill: "forwards" }));
      const words = text.map((t) => t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 250 + strokes.length * 90 + 600, easing: CURVE.outCubic, fill: "forwards" }));
      Promise.all([...runs, ...words].map((a) => a.finished)).then(() => {
        strokes.forEach((s) => { s.removeAttribute("pathLength"); s.style.strokeDasharray = ""; s.style.strokeDashoffset = ""; });
        text.forEach((t) => { t.style.opacity = ""; });
        [...runs, ...words].forEach((a) => a.cancel());
      }, () => {});
    } });
  });

  /* ── Hero depth on the way out (wide screens: stacked on a phone, the
     layers would slide over each other) ── */
  const hero = document.querySelector(".hero");
  if (hero && matchMedia("(min-width: 1000px)").matches) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 } });
    tl.to(".hero-copy", { yPercent: -18, opacity: 0.2, ease: "none" }, 0)
      .to(".hero-scene", { yPercent: 12, scale: 0.94, opacity: 0.35, ease: "none" }, 0)
      .to(".hero-side, .hero-read, .hero-depth, .hero-tag", { yPercent: -30, opacity: 0, ease: "none" }, 0);
  }

  /* ── Scores count up the scale as they come into view ──── */
  // The scoring test results and the example chips: each number climbs from
  // 0 to its score, taking every grade colour on the way (the trainer's
  // results do the same), a little after the one above it.
  const counted = (el) => el.querySelector("b") ?? el.querySelector("i") ?? el;
  ScrollTrigger.batch("[data-score]", {
    start: "top 92%", once: true,
    onEnter: (batch) => batch.forEach((el, k) => {
      const score = Number(el.dataset.score), out = counted(el), v = { n: 0 };
      gsap.to(v, { n: score, duration: 1.1, delay: k * 0.08, ease: "power2.out",
        onUpdate: () => { out.textContent = Math.round(v.n); el.style.setProperty("--c", gradeColor(v.n)); },
        onComplete: () => { out.textContent = score; el.style.setProperty("--c", gradeColor(score)); } });
    }),
  });
  // The example chart's bars grow up from the floor, one after another.
  ScrollTrigger.batch(".mock-chart span", {
    start: "top 92%", once: true,
    onEnter: (batch) => batch.forEach((el, k) => { el.style.transformOrigin = "50% 100%";
      el.animate([{ transform: "scaleY(0)" }, { transform: "none" }], { duration: 900, delay: k * 90, easing: CURVE.outBackSoft, fill: "backwards" }); }),
  });

  /* ── Stages open out of a narrow frame as you reach them ─ */
  for (const stage of document.querySelectorAll(".lab-stage")) {
    gsap.fromTo(stage, { clipPath: "inset(14% 18% 14% 18% round 40px)" }, {
      clipPath: "inset(0% 0% 0% 0% round 22px)", ease: "none",
      scrollTrigger: { trigger: stage, start: "top 95%", end: "top 45%", scrub: 0.6 },
    });
  }

  /* ── The story hands over: its scene shrinks back and fades ── */
  const pin = document.querySelector(".story:not([hidden]) .story-pin");
  if (pin) gsap.to(pin, { scale: 0.93, opacity: 0.25, ease: "none",
    scrollTrigger: { trigger: ".story", start: "bottom 100%", end: "bottom 55%", scrub: 0.5 } });

  /* ── The hero's scroll cue empties as you leave ─────────── */
  const cue = document.querySelector(".hero-cue i");
  if (cue) gsap.to(cue, { scaleY: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "40% top", scrub: 0.3 } });

  /* ── The footer wordmark rises out of the floor ───────── */
  const mark = document.querySelector(".foot-mark span");
  if (mark) gsap.fromTo(mark, { yPercent: 70, opacity: 0.2 }, { yPercent: 0, opacity: 1, ease: "none",
    scrollTrigger: { trigger: ".foot", start: "top bottom", end: "bottom bottom", scrub: 0.5 } });

  // Layout settles once fonts are in; measure again then.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
