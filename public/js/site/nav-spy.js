/**
 * nav-spy.js — the header nav shows where you are: the link for the section
 * on screen turns gradient, and a gradient underline glides to it with a
 * horizontal motion blur (js/ui/motion.js).
 *
 * "Where you are" = the last linked section whose top has passed a line
 * 40% down the screen. Sections without a link (the hero, "Progress"…)
 * light nothing up. While a nav glide is running (motion-nav.js sets
 * html[data-gliding]) the highlight goes straight to the clicked target
 * instead of hopping through every section on the way.
 */

import { slide, EASE } from "../ui/motion.js";

export function mountNavSpy() {
  const nav = document.querySelector(".nav nav");
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = links.map((a) => document.getElementById(a.hash.slice(1)));
  if (!links.length || sections.some((s) => !s)) return;

  const bar = document.createElement("span");
  bar.className = "nav-indicator";
  bar.setAttribute("aria-hidden", "true");
  nav.appendChild(bar);

  let current = null, raf = 0;

  /** Which linked section you're in (or null: hero, or an unlinked section after it). */
  function whereAmI() {
    const line = innerHeight * 0.4;
    let found = null;
    for (const s of [...document.querySelectorAll("main > section")]) {
      if (s.getBoundingClientRect().top <= line) found = s;
    }
    const i = sections.indexOf(found);
    // At the very bottom of the page, the last linked section stays lit.
    if (i < 0 && found && innerHeight + scrollY >= document.documentElement.scrollHeight - 4) {
      return links.findIndex((a) => a.hash === links.at(-1).hash);
    }
    return i < 0 ? null : i;
  }

  function show(i, animate = true) {
    if (i === current) return;
    const prev = current;
    current = i;
    links.forEach((a, k) => {
      a.classList.toggle("active", k === i);
      if (k === i) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
    if (i == null) { bar.classList.remove("on"); return; }
    const a = links[i], box = nav.getBoundingClientRect(), r = a.getBoundingClientRect();
    const oldLeft = parseFloat(bar.style.left) || 0;
    bar.style.left = `${r.left - box.left}px`;
    bar.style.width = `${r.width}px`;
    const wasOn = bar.classList.contains("on");
    bar.classList.add("on");
    if (!animate) return;
    if (prev != null && wasOn) {
      // Glide from the old item to the new one, blurred along the way.
      slide(bar, { from: [oldLeft - (r.left - box.left), 0], to: [0, 0], duration: 420, ease: EASE.outBack, strength: 0.8, maxBlur: 16 });
    } else {
      slide(bar, { from: [0, 6], to: [0, 0], opacity: [0, 1], duration: 300, ease: EASE.out });
    }
  }

  const update = () => {
    raf = 0;
    const gliding = document.documentElement.dataset.gliding;
    if (gliding) { show(links.findIndex((a) => a.hash === gliding)); return; }
    show(whereAmI());
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", () => { const i = current; current = null; show(i, false); });
  document.addEventListener("vf:glide", schedule);
  show(whereAmI(), false);
}
