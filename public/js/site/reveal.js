/**
 * reveal.js — headings rise into place word by word.
 *
 * Each word of the hero headline (and of every section heading) sits in
 * its own little window and slides up into it, one after another, with a
 * touch of blur: the hero's as the page loads, each section's the first
 * time it comes on screen. The heading's text is unchanged for screen
 * readers (aria-label), and nothing is hidden unless this script runs.
 * Reduced motion: nothing moves.
 */

import { reducedMotion } from "../ui/motion.js";

function split(h) {
  if (h.dataset.split) return;
  h.dataset.split = "1";
  h.setAttribute("aria-label", h.textContent.replace(/\s+/g, " ").trim());
  let i = 0;
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(" "); return; }
          const w = document.createElement("span");
          w.className = "rw";
          w.setAttribute("aria-hidden", "true");
          w.innerHTML = `<span style="--i:${i++}"></span>`;
          w.firstChild.textContent = part;
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === Node.ELEMENT_NODE) walk(n);
    }
  };
  walk(h);
}

export function mountReveal() {
  if (reducedMotion()) return;
  const hero = document.querySelector("[data-reveal]");
  const heads = [...document.querySelectorAll("main section .section-head h2, .cta-band h2")];
  [hero, ...heads].filter(Boolean).forEach(split);
  // A timer, not an animation frame: a page opened in a background tab still shows its headline.
  if (hero) setTimeout(() => hero.classList.add("in"), 60);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -12% 0px" });
  heads.forEach((h) => {
    // Already on screen when the page opens (a reload mid-page): show it at once.
    if (h.getBoundingClientRect().top < innerHeight * 0.88) h.classList.add("in");
    else io.observe(h);
  });
}
