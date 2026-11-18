/**
 * nav-spy.js — the nav shows where you are: every link to the section on
 * screen (header nav and side rail) turns gradient, and a "vf:section"
 * event says which one it is. On the hero (above every linked section) the
 * header nav lights nothing, but the side rail lights its first item, so
 * it shows where the page starts from the moment it loads.
 *
 * "Where you are" = the section under a line 40% down the screen. The
 * header lights only its own sections (nothing in between or after); the
 * side rail, which links every section, lights the last one you reached. While a nav glide runs (motion-nav.js sets
 * html[data-gliding]) the clicked link lights up at once instead of every
 * section on the way. Section positions come from scroll-progress.js.
 */

import { onScroll, scrollState } from "./scroll-progress.js";

export function mountNavSpy() {
  const nav = document.querySelector(".nav nav");
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = links.map((a) => document.getElementById(a.hash.slice(1)));
  if (!links.length || sections.some((s) => !s)) return;

  // The side rail links every section, the header only some: each lights its own.
  const railLinks = [...document.querySelectorAll('.rail a[href^="#"]')];
  const railSections = railLinks.map((a) => document.getElementById(a.hash.slice(1)));
  let current, railCurrent;
  const inMain = (b) => b.el.parentElement?.tagName === "MAIN";

  /** Header: lit only while you're in a section it links to (the hero and
   *  unlinked sections light nothing; nothing stays lit to the page's end). */
  function whereAmI(s) {
    const here = s.list.findLast((b) => inMain(b) && b.top <= s.y + s.vh * 0.4);   // the last section you've reached
    const i = here ? sections.indexOf(here.el) : -1;
    return i < 0 ? null : i;
  }
  /** Rail: the last of its sections you've reached (its first on the hero). */
  function railWhere(s) {
    const line = s.y + s.vh * 0.4;
    let k = 0;
    railSections.forEach((el, i) => { const b = el && s.sections[el.id]; if (b && b.top <= line) k = i; });
    return k;
  }

  function show(i, r) {
    if (i === current && r === railCurrent) return;
    current = i; railCurrent = r;
    const hash = i == null ? null : links[i].hash;
    for (const a of links) {
      const on = a.hash === hash;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    }
    railLinks.forEach((a, k) => {
      const on = k === r;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
    document.dispatchEvent(new CustomEvent("vf:section", { detail: hash }));
  }

  const update = (s = scrollState()) => {
    const gliding = document.documentElement.dataset.gliding;
    if (gliding) show(links.findIndex((a) => a.hash === gliding), Math.max(0, railLinks.findIndex((a) => a.hash === gliding)));
    else show(whereAmI(s), railWhere(s));
  };
  onScroll(update);
  document.addEventListener("vf:glide", () => update());
}
