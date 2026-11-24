/**
 * scenes.js — the homepage scrolls *in*, not down (wide screens, motion
 * allowed). Every section is one full-screen scene:
 *
 *   plain sections   their content sits in a frame that holds still for
 *                    half a screen of scroll, fitted to the screen (scaled
 *                    down a little if it's taller), so you never scroll
 *                    down through a scene to read it.
 *   pinned sections  (the exercise ring, the story, the skill paths) rest
 *                    where their stage fills the screen; their rule stays
 *                    pinned at the top, and the story's and paths' heading
 *                    becomes a title card over the stage that zooms out
 *                    past you as you go on.
 *
 * Between two scenes the page holds still for one screen of scroll while
 * the camera moves in 3D, in turn: a cube turning left, a door swinging
 * open onto the next scene, a cube turning right, a flip down and up. From
 * the hero the camera dives into the figure while the 3D view itself
 * swings round it (sceneState.heroTurn, read by hero3d.js). Stop between
 * two scenes and the page glides to the nearer one.
 *
 * Driven by scroll-progress.js (layout read only when it changes): one
 * transform and one opacity on the two sections at a boundary. Narrow
 * screens and reduced motion keep the plain page.
 */

import { onScroll, scrollState, refresh } from "./scroll-progress.js";
import { reducedMotion } from "../ui/motion.js";
import { smooth as lenis } from "./smooth.js";
import { sceneState } from "./scene-state.js";

const HOLD = 0.5;                       // screens a plain scene holds still for
const TOP = 84, BOTTOM = 24;            // room in a frame for the header and a margin
const P = 2200;                         // perspective, px
const STYLES = ["cube", "door", "cube-r", "flip"];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t) => t * t * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export const scenesOn = () => !reducedMotion() && matchMedia("(min-width: 1100px) and (min-height: 620px)").matches;

export function mountScenes() {
  if (!scenesOn()) return;
  const root = document.documentElement;
  root.classList.add("scenes");
  const secs = [...document.querySelectorAll("main > section")];
  secs.forEach((el, i) => { el.style.zIndex = String(secs.length - i); });   // the scene you leave passes in front of the next

  // ── Build the scenes ──
  const fits = [], titles = [];
  for (const sec of secs) {
    if (sec.classList.contains("hero")) continue;
    const pin = sec.querySelector(".ex-ring-stage, .story-pin, .paths.live .paths-pin");
    if (pin) {
      sec.classList.add("scene-pinned");
      sec.querySelector(":scope > .wrap > .sec-rule")?.parentElement.classList.add("scene-rule");
      const head = sec.querySelector(".section-head");
      if (head && !pin.contains(head)) {
        head.classList.add("scene-title");
        pin.classList.add("has-title");
        pin.append(head);
        titles.push({ sec, head });
      }
    } else {
      sec.classList.add("scene-plain");
      const frame = document.createElement("div"), fit = document.createElement("div");
      frame.className = "scene-frame";
      fit.className = "scene-fit";
      fit.append(...sec.childNodes);
      frame.append(fit);
      sec.append(frame);
      fits.push(fit);
    }
  }
  // Fit each frame's content to the screen (only ever scaled down).
  const fitAll = () => {
    const avail = innerHeight - TOP - BOTTOM;
    for (const fit of fits) {
      fit.style.transform = "";
      const k = Math.min(1, avail / Math.max(1, fit.offsetHeight));
      if (k < 0.995) fit.style.transform = `scale(${k.toFixed(4)})`;
    }
  };
  fitAll();
  addEventListener("resize", fitAll);
  document.fonts?.ready.then(() => { fitAll(); refresh(); });
  refresh();

  const touched = new Set();
  let dive = null, ver = -1, pageW = innerWidth, snapT = 0;

  onScroll((s) => {
    const list = s.list.filter((b) => b.el.parentElement?.tagName === "MAIN");
    if (s.version !== ver) {
      ver = s.version;
      pageW = document.querySelector("main")?.clientWidth ?? innerWidth;
      // The point the camera dives into: the hero's figure.
      const fig = document.querySelector(".hero [data-hero3d]"), hero = list[0];
      dive = fig && hero ? (() => {
        let y = 0, x = 0;
        for (let e = fig; e && e !== hero.el && e !== document.body; e = e.offsetParent) { y += e.offsetTop; x += e.offsetLeft; }
        return { x: x + fig.offsetWidth / 2, y: y + fig.offsetHeight * 0.45 };
      })() : null;
    }
    const now = new Set(), W = pageW, vh = s.vh;
    let heroTurn = 0;
    for (let i = 0; i < list.length - 1; i++) {
      const A = list[i], B = list[i + 1];
      const t = clamp01((s.y + vh - B.top) / vh);   // 0: the boundary at the bottom of the screen, 1: at the top
      if (i === 0) heroTurn = A.el.classList.contains("hero") ? t : 0;
      if (t <= 0 || t >= 1) continue;
      // Both held where they are: A's last screen, B's first.
      const tyA = `translate3d(0, ${(vh * t).toFixed(1)}px, 0)`, tyB = `translate3d(0, ${(-vh * (1 - t)).toFixed(1)}px, 0)`;
      const oyA = A.height - vh / 2, oyB = vh / 2;
      let a = "", b = "", oa = 1, ob = 1, originA = `${W / 2}px ${oyA}px`, originB = `${W / 2}px ${oyB}px`;
      if (i === 0 && A.el.classList.contains("hero") && dive) {
        // Into the figure: the hero grows round it (its 3D camera swings at the same time).
        originA = `${dive.x.toFixed(0)}px ${dive.y.toFixed(0)}px`;
        a = `scale(${(1 + easeIn(t) * 2.6).toFixed(4)})`;
        oa = 1 - smooth(0.25, 0.8, t);
        b = `perspective(${P}px) rotateY(${(-28 * (1 - easeOut(t))).toFixed(2)}deg) scale(${(0.7 + 0.3 * easeOut(t)).toFixed(4)})`;
        ob = smooth(0.35, 0.9, t);
      } else {
        const e = inOut(t), style = STYLES[(i - 1) % STYLES.length], half = W / 2;
        if (style === "cube" || style === "cube-r") {
          // The page is a cube: this face turns away as the next comes round.
          const d = style === "cube" ? -1 : 1;
          a = `perspective(${P}px) translateZ(${-half}px) rotateY(${(d * 90 * e).toFixed(2)}deg) translateZ(${half}px)`;
          b = `perspective(${P}px) translateZ(${-half}px) rotateY(${(-d * 90 * (1 - e)).toFixed(2)}deg) translateZ(${half}px)`;
          oa = 1 - 0.75 * e; ob = 0.25 + 0.75 * e;
        } else if (style === "door") {
          // This scene swings open on its left edge; the next comes forward out of the depth behind it.
          originA = `0px ${oyA}px`;
          a = `perspective(${P}px) rotateY(${(105 * e).toFixed(2)}deg)`;     // the free edge swings away from you
          oa = 1 - smooth(0.35, 0.9, t);
          b = `perspective(${P}px) translateZ(${(-700 * (1 - easeOut(t))).toFixed(1)}px)`;
          ob = smooth(0.1, 0.7, t);
        } else {
          // Flip: this scene tips back flat onto the floor, then the next stands up from it.
          originA = `${half}px ${A.height}px`;
          originB = `${half}px ${vh}px`;
          const ka = clamp01(t / 0.6), kb = clamp01((t - 0.4) / 0.6);
          a = `perspective(${P}px) rotateX(${(82 * easeIn(ka)).toFixed(2)}deg)`;
          b = `perspective(${P}px) rotateX(${(82 * (1 - easeOut(kb))).toFixed(2)}deg)`;
          oa = 1 - smooth(0.3, 0.6, t); ob = smooth(0.4, 0.75, t);
        }
      }
      A.el.style.transformOrigin = originA;
      A.el.style.transform = `${tyA} ${a}`;
      A.el.style.opacity = oa.toFixed(3);
      B.el.style.transformOrigin = originB;
      B.el.style.transform = `${tyB} ${b}`;
      B.el.style.opacity = ob.toFixed(3);
      now.add(A.el).add(B.el);
    }
    sceneState.heroTurn = heroTurn;
    for (const el of touched) if (!now.has(el)) { el.style.transform = el.style.opacity = el.style.transformOrigin = ""; el.classList.remove("in-scene"); }
    for (const el of now) el.classList.add("in-scene");
    touched.clear();
    now.forEach((el) => touched.add(el));

    // Title cards over the pinned stages zoom out past you as you go on.
    for (const { sec, head } of titles) {
      const box = s.sections[sec.id];
      if (!box) continue;
      const k = clamp01((s.y - box.top) / (vh * 0.45));
      head.style.opacity = (1 - smooth(0.05, 1, k)).toFixed(3);
      head.style.transform = `translate(-50%, -50%) scale(${(1 + 0.35 * easeIn(k)).toFixed(4)})`;
      head.style.visibility = k >= 1 ? "hidden" : "";
      head.parentElement.style.setProperty("--title", (1 - smooth(0.05, 1, k)).toFixed(3));   // the stage waits, dimmed, behind it
    }

    // Stopped between two scenes: glide to the nearer one.
    clearTimeout(snapT);
    if (s.velocity === 0) snapT = setTimeout(snap, 140);
  });

  function snap() {
    const s = scrollState();
    if (!s || window.__vfNoSnap) return;                 // (screenshot tools hold a transition still)
    const list = s.list.filter((b) => b.el.parentElement?.tagName === "MAIN");
    for (let i = 0; i < list.length - 1; i++) {
      const B = list[i + 1], t = (s.y + s.vh - B.top) / s.vh;
      if (t <= 0.015 || t >= 0.985) continue;
      const target = t < 0.5 ? B.top - s.vh : B.top;
      const l = lenis();
      if (l) l.scrollTo(target, { duration: 0.9, easing: easeOut });
      else scrollTo({ top: target, behavior: "smooth" });
      return;
    }
  }
}
