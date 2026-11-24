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
import { ease } from "../ui/ease.js";
import { InkTrail } from "./ink-trail.js";

const HOLD = 0.5;                       // screens a plain scene holds still for
const TOP = 84, BOTTOM = 24;            // room in a frame for the header and a margin
const P = 2200;                         // perspective, px
const STYLES = ["sweep", "scan", "portal", "slats", "horizon"];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const inOut = ease.inOutCubic, easeIn = ease.inCubic, easeOut = ease.outCubic;   // (js/ui/ease.js)

export const scenesOn = () => !reducedMotion() && matchMedia("(min-width: 1100px) and (min-height: 620px)").matches;

export function mountScenes() {
  if (!scenesOn()) return;
  const root = document.documentElement;
  root.classList.add("scenes");
  const secs = [...document.querySelectorAll("main > section")];
  secs.forEach((el, i) => { el.style.zIndex = String(i + 1); });   // the scene arriving is revealed over the one you leave

  // ── Build the scenes ──
  const fits = [], titles = [], trails = [];
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
      // A scene that's only words (no model, no live figure beside it) gets
      // an ink trail down its margin: it runs as you scroll through the
      // scene, and its foot names the scene that comes next.
      if (!sec.matches("#lab, #faq")) {
        const host = document.createElement("div");
        host.className = "scene-trail";
        frame.append(host);
        const next = secs[secs.indexOf(sec) + 1];
        const name = (next?.querySelector(".sec-rule-name")?.textContent || next?.querySelector("h2")?.textContent || "").replace(/\s+/g, " ").trim();
        trails.push({ key: sec.id || sec.dataset.scroll, trail: new InkTrail(host, { seed: sec.id || sec.dataset.scroll || "scene", top: "Scroll", bottom: name ? `Next <b>${name}</b>` : "" }) });
      }
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
  let dive = null, ver = -1, pageW = innerWidth, mainLeft = 0, snapT = 0;
  const edge = makeEdge();

  onScroll((s) => {
    const list = s.list.filter((b) => b.el.parentElement?.tagName === "MAIN");
    if (s.version !== ver) {
      ver = s.version;
      const main = document.querySelector("main");
      pageW = main?.clientWidth ?? innerWidth;
      mainLeft = main?.getBoundingClientRect().left ?? 0;
      // The point the camera dives into: the hero's figure.
      const fig = document.querySelector(".hero [data-hero3d]"), hero = list[0];
      dive = fig && hero ? (() => {
        let y = 0, x = 0;
        for (let e = fig; e && e !== hero.el && e !== document.body; e = e.offsetParent) { y += e.offsetTop; x += e.offsetLeft; }
        return { x: x + fig.offsetWidth / 2, y: y + fig.offsetHeight * 0.45 };
      })() : null;
    }
    const now = new Set(), W = pageW, vh = s.vh;
    let heroTurn = 0, shown = null;
    for (let i = 0; i < list.length - 1; i++) {
      const A = list[i], B = list[i + 1];
      const t = clamp01((s.y + vh - B.top) / vh);   // 0: the boundary at the bottom of the screen, 1: at the top
      if (i === 0) heroTurn = A.el.classList.contains("hero") ? t : 0;
      if (t <= 0 || t >= 1) continue;
      // Both held where they are: A's last screen, B's first. B is
      // revealed over A through a shape; A falls back into the dark under it.
      const tyA = `translate3d(0, ${(vh * t).toFixed(1)}px, 0)`, tyB = `translate3d(0, ${(-vh * (1 - t)).toFixed(1)}px, 0)`;
      const e = inOut(t), hero = i === 0 && A.el.classList.contains("hero") && dive;
      const style = hero ? "portal" : STYLES[(i - 1) % STYLES.length];
      // Where the shape opens from, in B's own box (its first screen is the viewport).
      const cx = hero ? dive.x - mainLeft : W / 2, cy = hero ? dive.y - (A.height - vh) : vh / 2;
      const far = Math.hypot(Math.max(cx, W - cx), Math.max(cy, vh - cy)) * 1.02;
      let clip = "none", fall = "";
      if (style === "portal") {
        clip = `circle(${(far * e).toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
        fall = hero ? `scale(${(1 + easeIn(t) * 2.4).toFixed(4)})` : `perspective(${P}px) translateZ(${(-520 * e).toFixed(1)}px)`;
      } else if (style === "sweep") {
        // A protractor's sweep: the wedge opens clockwise from twelve o'clock.
        const ang = 360 * e, pts = [`${cx}px ${cy}px`];
        for (let a = 0; a <= ang + 0.01; a += Math.min(10, Math.max(1, ang))) { const r = ((a - 90) * Math.PI) / 180; pts.push(`${(cx + Math.cos(r) * far).toFixed(1)}px ${(cy + Math.sin(r) * far).toFixed(1)}px`); }
        const r = ((ang - 90) * Math.PI) / 180;
        pts.push(`${(cx + Math.cos(r) * far).toFixed(1)}px ${(cy + Math.sin(r) * far).toFixed(1)}px`);
        clip = ang >= 359.5 ? "none" : `polygon(${pts.join(",")})`;
        fall = `perspective(${P}px) rotateZ(${(-12 * e).toFixed(2)}deg) scale(${(1 - 0.16 * e).toFixed(4)})`;
      } else if (style === "scan") {
        // A calibration scan: the next scene is there wherever the line has passed.
        clip = `inset(0 0 ${(B.height - vh * e).toFixed(1)}px 0)`;
        fall = `perspective(${P}px) rotateX(${(28 * e).toFixed(2)}deg) translateZ(${(-260 * e).toFixed(1)}px)`;
      } else if (style === "slats") {
        // Ruler slats: nine vertical bands open from their middles, left to right.
        const n = 9, sw = W / n, pts = [];
        for (let k = 0; k < n; k++) {
          const o = clamp01(e * 1.55 - k * 0.07), m = sw * (k + 0.5), h = (sw / 2) * o + (o > 0 ? 0.6 : 0);
          pts.push(`${(m - h).toFixed(1)}px 0px`, `${(m - h).toFixed(1)}px ${vh}px`, `${(m + h).toFixed(1)}px ${vh}px`, `${(m + h).toFixed(1)}px 0px`);
        }
        clip = `polygon(0px 0px, ${pts.join(",")}, ${W}px 0px)`;
        fall = `perspective(${P}px) rotateY(${(-16 * e).toFixed(2)}deg) scale(${(1 - 0.12 * e).toFixed(4)})`;
      } else {
        // The horizon opens: a band from the middle line out to the edges.
        const half = (vh / 2) * e;
        clip = `inset(${(vh / 2 - half).toFixed(1)}px 0 ${(B.height - vh / 2 - half).toFixed(1)}px 0)`;
        fall = `perspective(${P}px) scale(${(1 - 0.22 * e).toFixed(4)})`;
      }
      const oyA = hero ? dive.y : A.height - vh / 2, oxA = hero ? dive.x : W / 2;
      A.el.style.transformOrigin = `${oxA.toFixed(0)}px ${oyA.toFixed(0)}px`;
      A.el.style.transform = `${tyA} ${fall}`;
      A.el.style.opacity = (1 - (hero ? smooth(0.3, 0.85, t) : 0.45 * e)).toFixed(3);
      B.el.style.transformOrigin = `${(W / 2).toFixed(0)}px ${(vh / 2).toFixed(0)}px`;
      B.el.style.transform = `${tyB} scale(${(1.06 - 0.06 * easeOut(t)).toFixed(4)})`;     // and settles a touch as it opens
      B.el.style.clipPath = clip;
      B.el.style.opacity = "";
      now.add(A.el).add(B.el);
      shown = { style, t, e, cx: cx + mainLeft, cy, far, W, vh, x0: mainLeft };
    }
    edge(shown);
    sceneState.heroTurn = heroTurn;
    for (const el of touched) if (!now.has(el)) { el.style.transform = el.style.opacity = el.style.transformOrigin = el.style.clipPath = ""; el.classList.remove("in-scene"); }
    for (const el of now) el.classList.add("in-scene");
    touched.clear();
    now.forEach((el) => touched.add(el));

    // Ink trails: how far through its scene you are (it holds still while you scroll).
    for (const { key, trail } of trails) {
      const box = s.sections[key];
      if (box) trail.set((s.y - box.top) / Math.max(1, box.height - vh));
    }

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

/**
 * The glowing edge that rides each reveal, drawn like the instrument: the
 * portal's ring with protractor ticks, the sweep's two arms and its angle in
 * a boxed reading, the scan line with how far it has gone, the slats' edges,
 * the horizon's two lines. One fixed SVG over the page; shown only mid-way.
 */
function makeEdge() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "scene-edge");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<g data-s="portal"><circle class="se-ring"/><circle class="se-ticks"/></g>
    <g data-s="sweep"><line class="se-arm"/><line class="se-arm se-arm2"/><path class="se-arc"/><g class="se-tag"><rect width="58" height="22" rx="3"/><text x="29" y="15"></text></g></g>
    <g data-s="scan"><line class="se-line"/><g class="se-tag"><rect width="74" height="22" rx="3"/><text x="37" y="15"></text></g></g>
    <g data-s="slats"><path class="se-slat"/></g>
    <g data-s="horizon"><line class="se-line"/><line class="se-line"/></g>`;
  document.body.append(svg);
  const groups = Object.fromEntries([...svg.querySelectorAll("[data-s]")].map((g) => [g.dataset.s, g]));
  let last = null;
  const set = (el, a) => { for (const k in a) el.setAttribute(k, a[k]); };
  return (st) => {
    const style = st?.style ?? null;
    if (style !== last) { for (const k in groups) groups[k].style.display = k === style ? "" : "none"; last = style; }
    if (!st) { svg.style.opacity = "0"; return; }
    svg.style.opacity = Math.sin(Math.PI * st.t).toFixed(3);
    const { e, cx, cy, far, W, vh, x0 } = st, g = groups[style];
    if (style === "portal") {
      const r = far * e;
      g.querySelectorAll("circle").forEach((c) => set(c, { cx, cy, r: Math.max(0, r) }));
      g.querySelector(".se-ticks").style.strokeDasharray = `1.5 ${(2 * Math.PI * Math.max(1, r) / 72 - 1.5).toFixed(2)}`;
    } else if (style === "sweep") {
      const ang = 360 * e, rad = ((ang - 90) * Math.PI) / 180, L = Math.min(W, vh) * 0.42;
      const [a1, a2] = g.querySelectorAll(".se-arm");
      set(a1, { x1: cx, y1: cy, x2: cx, y2: cy - far });
      set(a2, { x1: cx, y1: cy, x2: cx + Math.cos(rad) * far, y2: cy + Math.sin(rad) * far });
      const ex = cx + Math.cos(rad) * L * 0.3, ey = cy + Math.sin(rad) * L * 0.3;
      set(g.querySelector(".se-arc"), { d: `M${cx} ${cy - L * 0.3} A${L * 0.3} ${L * 0.3} 0 ${ang > 180 ? 1 : 0} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}` });
      const mid = (((ang / 2) - 90) * Math.PI) / 180;
      g.querySelector(".se-tag").setAttribute("transform", `translate(${(cx + Math.cos(mid) * L * 0.46 - 29).toFixed(1)} ${(cy + Math.sin(mid) * L * 0.46 - 11).toFixed(1)})`);
      g.querySelector("text").textContent = `${Math.round(ang)}°`;
    } else if (style === "scan") {
      const y = vh * e;
      set(g.querySelector(".se-line"), { x1: x0, y1: y, x2: x0 + W, y2: y });
      g.querySelector(".se-tag").setAttribute("transform", `translate(${(x0 + W - 98).toFixed(1)} ${(y - 30).toFixed(1)})`);
      g.querySelector("text").textContent = `SCAN ${Math.round(e * 100)}%`;
    } else if (style === "slats") {
      const n = 9, sw = W / n;
      let d = "";
      for (let k = 0; k < n; k++) {
        const o = clamp01(e * 1.55 - k * 0.07);
        if (o <= 0 || o >= 1) continue;
        const m = x0 + sw * (k + 0.5), h = (sw / 2) * o;
        d += `M${(m - h).toFixed(1)} 0V${vh}M${(m + h).toFixed(1)} 0V${vh}`;
      }
      g.querySelector(".se-slat").setAttribute("d", d || "M0 0");
    } else {
      const half = (vh / 2) * e;
      const [l1, l2] = g.querySelectorAll(".se-line");
      set(l1, { x1: x0, y1: vh / 2 - half, x2: x0 + W, y2: vh / 2 - half });
      set(l2, { x1: x0, y1: vh / 2 + half, x2: x0 + W, y2: vh / 2 + half });
    }
  };
}
