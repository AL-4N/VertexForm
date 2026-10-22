/**
 * smooth.js — smooth scrolling for the homepage (Lenis, vendor/lenis).
 *
 * Wheel and trackpad scrolling glide instead of stepping. Lenis runs on
 * GSAP's ticker, so ScrollTrigger (scroll-fx.js, story.js) reads the same
 * smoothed position every frame. It pauses while a popup is open (a modal
 * <dialog>), so the page behind doesn't move under it, and anything marked
 * data-lenis-prevent scrolls natively. Touch keeps the phone's own scrolling.
 * Off for reduced motion, or if the vendor files didn't load.
 */

import { reducedMotion } from "../ui/motion.js";

let lenis = null;
/** The running Lenis instance, or null when the page scrolls natively. */
export const smooth = () => lenis;

export function mountSmooth() {
  if (lenis || reducedMotion() || typeof window.Lenis !== "function") return null;
  const { gsap, ScrollTrigger } = window;
  lenis = new window.Lenis({ lerp: 0.15, smoothWheel: true, autoRaf: !gsap });   // 0.15: glides, but keeps up with the hand
  if (gsap && ScrollTrigger) {
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const sync = () => (document.querySelector("dialog[open]") ? lenis.stop() : lenis.start());
  new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
  return lenis;
}
