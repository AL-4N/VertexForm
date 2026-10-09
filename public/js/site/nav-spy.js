/**
 * nav-spy.js — the nav shows where you are: every link to the section on
 * screen (header nav and side rail) turns gradient, and a "vf:section"
 * event says which one it is.
 *
 * "Where you are" = the last linked section whose top has passed a line
 * 40% down the screen. Sections without a link (the hero, "Progress"…)
 * light nothing up. While a nav glide runs (motion-nav.js sets
 * html[data-gliding]) the clicked link lights up at once instead of every
 * section on the way.
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
    const hash = i == null ? null : links[i].hash;
    for (const a of document.querySelectorAll('.nav nav a[href^="#"], .rail a[href^="#"]')) {
      const on = a.hash === hash;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    }
    document.dispatchEvent(new CustomEvent("vf:section", { detail: hash }));
  }

  const update = () => {
    raf = 0;
    const gliding = document.documentElement.dataset.gliding;
    show(gliding ? links.findIndex((a) => a.hash === gliding) : whereAmI());
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener("scroll", schedule, { passive: true });
  document.addEventListener("vf:glide", schedule);
  update();
}
