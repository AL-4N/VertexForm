/**
 * scroll-fx.js — what happens as you scroll the homepage (GSAP ScrollTrigger
 * and SplitText, vendor/gsap).
 *
 *   Headings   split into lines; each line rises out of its own mask, with
 *              a little blur, the first time it comes on screen (the hero's
 *              on load). Screen readers get the heading as one label.
 *   Cards      each group (exercise cards, steps, modes, cues, panels…)
 *              rises in one after another as it enters.
 *   Hero       as you scroll away, the copy drifts up faster than the page
 *              and the 3D scene sinks and fades: depth, not a hard cut.
 *
 * Nothing is hidden unless GSAP loaded and motion is allowed; with reduced
 * motion the page is simply there.
 */

import { reducedMotion } from "../ui/motion.js";

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
    fonts.then(() => { document.documentElement.classList.remove("split-wait"); heads.forEach(split); });
  }
  function split(h, k) {
    SplitText.create(h, {
      type: "lines", mask: "lines", autoSplit: true, linesClass: "split-line",
      onSplit: (self) => gsap.from(self.lines, {
        yPercent: 115, filter: "blur(6px)", duration: 1.05, ease: "expo.out", stagger: 0.09,
        delay: k === 0 ? 0.15 : 0,
        clearProps: "filter",
        scrollTrigger: k === 0 ? undefined : { trigger: h, start: "top 88%", once: true },
      }),
    });
  }

  /* ── Cards rise in, group by group ──────────────────── */
  const groups = [".ex-grid > .ex-card", ".steps > li", ".modes > .mode", ".cues > .cue", ".principles > li", ".cal-rows > li", ".two-col > .panel", ".also > div", ".lab", ".r3"];
  groups.forEach((sel) => {
    const items = gsap.utils.toArray(sel);
    if (!items.length) return;
    ScrollTrigger.batch(items, {
      start: "top 90%", once: true,
      onEnter: (batch) => gsap.from(batch, { y: 48, opacity: 0, scale: 0.97, duration: 0.9, ease: "power3.out", stagger: 0.08, clearProps: "transform,opacity" }),
    });
  });

  /* ── Hero depth on the way out ──────────────────────── */
  const hero = document.querySelector(".hero");
  if (hero) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 } });
    tl.to(".hero-copy", { yPercent: -18, opacity: 0.2, ease: "none" }, 0)
      .to(".hero-scene", { yPercent: 12, scale: 0.94, opacity: 0.35, ease: "none" }, 0)
      .to(".hero-hud", { yPercent: -10, opacity: 0, ease: "none" }, 0);
  }

  /* ── Stages open out of a narrow frame as you reach them ─ */
  for (const stage of document.querySelectorAll(".r3-stage, .lab-stage")) {
    gsap.fromTo(stage, { clipPath: "inset(14% 18% 14% 18% round 40px)" }, {
      clipPath: "inset(0% 0% 0% 0% round 22px)", ease: "none",
      scrollTrigger: { trigger: stage, start: "top 95%", end: "top 45%", scrub: 0.6 },
    });
  }

  /* ── The footer wordmark rises out of the floor ───────── */
  const mark = document.querySelector(".foot-mark span");
  if (mark) gsap.fromTo(mark, { yPercent: 70, opacity: 0.2 }, { yPercent: 0, opacity: 1, ease: "none",
    scrollTrigger: { trigger: ".foot", start: "top bottom", end: "bottom bottom", scrub: 0.5 } });

  // Layout settles once fonts are in; measure again then.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
