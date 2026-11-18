/**
 * scenes.js — the homepage scrolls *in*, not down (wide screens, motion
 * allowed). Every section is at least a full screen: a scene. Where one
 * scene meets the next, the page stops moving for one screen of scroll and
 * the camera moves forward instead: the scene you're leaving flies past you
 * (it grows and fades, held where it was), and the next comes up out of the
 * depth (it starts small and faint, already in place). Inside a scene you
 * read as usual. The hero doesn't just fly past: the camera dives into the
 * figure.
 *
 * Driven by scroll-progress.js (no layout reads per frame): one transform
 * and one opacity on the two sections at a boundary, and nothing on the rest.
 * Narrow screens and reduced motion keep the plain page.
 */

import { onScroll } from "./scroll-progress.js";
import { reducedMotion } from "../ui/motion.js";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

export function mountScenes() {
  if (reducedMotion() || !matchMedia("(min-width: 1100px) and (min-height: 620px)").matches) return;
  const root = document.documentElement;
  root.classList.add("scenes");
  const secs = [...document.querySelectorAll("main > section")];
  secs.forEach((el, i) => { el.style.zIndex = String(secs.length - i); });   // the scene you leave passes in front of the next
  const touched = new Set();
  let dive = null, diveVersion = -1, pageW = innerWidth, pad = 0;

  onScroll((s) => {
    const list = s.list.filter((b) => b.el.parentElement?.tagName === "MAIN");
    // Where the hero's figure is, inside the hero: the point the camera dives into.
    if (s.version !== diveVersion) {
      diveVersion = s.version;
      pageW = document.querySelector("main")?.clientWidth ?? innerWidth;
      // A transition ends where links land a section: just under the header.
      pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
      const fig = document.querySelector(".hero [data-hero3d]");
      const hero = list[0];
      dive = fig && hero ? (() => {
        let y = 0, x = 0;
        for (let e = fig; e && e !== hero.el && e !== document.body; e = e.offsetParent) { y += e.offsetTop; x += e.offsetLeft; }
        return { x: x + fig.offsetWidth / 2, y: y + fig.offsetHeight * 0.45 };
      })() : null;
    }
    const now = new Set();
    for (let i = 0; i < list.length - 1; i++) {
      const A = list[i], B = list[i + 1];
      const b = B.top;
      const L = s.vh - pad;
      const t = clamp01((s.y + s.vh - b) / L);          // 0: the boundary at the bottom of the screen, 1: under the header
      if (t <= 0 || t >= 1) continue;
      const hero = i === 0 && A.el.classList.contains("hero") && dive;
      // Leaving: held in place (its last screen stays put), flying past the camera.
      const out = easeIn(t);
      const ox = hero ? dive.x : pageW / 2;
      const oy = hero ? dive.y : A.height - s.vh / 2;
      A.el.style.transformOrigin = `${ox.toFixed(0)}px ${oy.toFixed(0)}px`;
      A.el.style.transform = `translate3d(0, ${(L * t).toFixed(1)}px, 0) scale(${(1 + out * (hero ? 2.6 : 0.45)).toFixed(4)})`;
      A.el.style.opacity = (1 - smooth(hero ? 0.2 : 0.04, hero ? 0.75 : 0.5, t)).toFixed(3);
      // Arriving: already where it will be, coming up out of the depth.
      const inn = easeOut(t);
      B.el.style.transformOrigin = `50% ${(s.vh / 2).toFixed(0)}px`;
      B.el.style.transform = `translate3d(0, ${(-L * (1 - t)).toFixed(1)}px, 0) scale(${(0.62 + 0.38 * inn).toFixed(4)})`;
      B.el.style.opacity = smooth(0.38, 0.95, t).toFixed(3);
      now.add(A.el).add(B.el);
    }
    // A section that just left a boundary goes back to plain.
    for (const el of touched) if (!now.has(el)) { el.style.transform = el.style.opacity = el.style.transformOrigin = ""; el.classList.remove("in-scene"); }
    for (const el of now) el.classList.add("in-scene");
    touched.clear();
    now.forEach((el) => touched.add(el));
  });
}
