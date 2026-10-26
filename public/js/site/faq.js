/**
 * faq.js — the homepage questions. Each answer is a <details>; opening it
 * glides the height open while the text unblurs and rises, closing runs it
 * back. Opening one closes any other that's open. Without GSAP (or with
 * reduced motion) the plain <details> behaviour is left alone.
 */

import { reducedMotion } from "../ui/motion.js";

export function mountFaq(root = document.querySelector("[data-faq]")) {
  const gsap = window.gsap;
  if (!root || !gsap || reducedMotion()) return;
  const items = [...root.querySelectorAll("details")];

  function open(d) {
    const a = d.querySelector(".faq-a");
    d.open = true;
    gsap.killTweensOf(a);
    gsap.fromTo(a, { height: 0 }, { height: "auto", duration: 0.6, ease: "expo.out" });
    gsap.fromTo(a.firstElementChild, { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "expo.out", clearProps: "transform" });
  }
  function close(d) {
    const a = d.querySelector(".faq-a");
    gsap.killTweensOf(a);
    gsap.to(a.firstElementChild, { opacity: 0, duration: 0.2, ease: "power1.in" });
    gsap.to(a, { height: 0, duration: 0.4, ease: "power3.inOut", onComplete: () => {
      d.open = false;
      gsap.set([a, a.firstElementChild], { clearProps: "all" });
    } });
  }

  items.forEach((d) => d.querySelector("summary").addEventListener("click", (e) => {
    e.preventDefault();
    if (d.open) { close(d); return; }
    items.forEach((o) => { if (o !== d && o.open) close(o); });
    open(d);
  }));
}
