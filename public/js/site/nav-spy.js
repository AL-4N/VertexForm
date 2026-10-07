/**
 * nav-spy.js — the header nav shows where you are: the link for the section
 * on screen turns gradient.
 *
 * "Where you are" = the last linked section whose top has passed a line
 * 40% down the screen. Sections without a link (the hero, "Progress"…)
 * light nothing up.
 */

export function mountNavSpy() {
  const nav = document.querySelector(".nav nav");
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = links.map((a) => document.getElementById(a.hash.slice(1)));
  if (!links.length || sections.some((s) => !s)) return;

  let current, raf = 0;

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
      return links.length - 1;
    }
    return i < 0 ? null : i;
  }

  function show(i) {
    if (i === current) return;
    current = i;
    links.forEach((a, k) => {
      a.classList.toggle("active", k === i);
      if (k === i) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
  }

  const update = () => { raf = 0; show(whereAmI()); };
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  update();
}
