/**
 * boot.js — the calibration intro, on the first visit in a session (the
 * inline script in index.html's <head> decides and adds html.booting; it
 * also gives up after 6 s if this never runs).
 *
 *   0.0 s  The instrument powers on: the drafting grid spreads out from
 *          the middle, crosshairs draw out across the screen, and the
 *          wordmark rises behind them letter by letter, huge and outlined.
 *   0.1 s  MediaPipe's 33 body points come in from a cloud scattered in 3D
 *          depth and lock onto a standing figure one by one, top to
 *          bottom, while the figure turns from side-on to face you, a big
 *          counter climbs to 33 and a readout gives each point's
 *          coordinates as it lands.
 *   1.0 s  The bones draw in between them, the head's ring closes, and a
 *          scan line passes down the figure.
 *   1.9 s  Locked: viewfinder brackets snap round the figure, the horizon
 *          brightens and "Form" fills with the go gradient.
 *   open   The screen splits along the horizon (where the hero's own
 *          horizon sits) while the figure glides and shrinks into exactly
 *          where the hero's figure stands (sceneState.heroFigure), so the
 *          figure you watched being found is the one on the page.
 *
 * It waits for the hero's 3D and the fonts, for at least 2.5 s and at most
 * 5 s in all. "vf:booted" lets the hero's figure and headline arrive.
 */

import { smooth } from "./smooth.js";
import { sceneState } from "./scene-state.js";

// A person facing you, in a 240 × 340 box (MediaPipe's landmark order).
const PTS = [
  [120, 40], [126, 33], [131, 33], [136, 33], [114, 33], [109, 33], [104, 33], [144, 38], [96, 38], [127, 50], [113, 50],
  [158, 82], [82, 82], [176, 132], [64, 132], [186, 180], [54, 180], [190, 194], [50, 194], [186, 197], [54, 197], [181, 191], [59, 191],
  [142, 182], [98, 182], [146, 250], [94, 250], [148, 314], [92, 314], [145, 326], [95, 326], [160, 330], [80, 330],
];
// The body's connections (the face is a ring, not lines).
const LINKS = [[11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]];
const HEAD = [120, 40, 21];             // the head's ring: centre and radius
const TOP = 16, FEET = 332;             // the figure's extent in its box
const MIN = 2500, MAX = 5000, LOCK = 1900;
const EASE = "cubic-bezier(.65,.05,.25,1)", OUT = "cubic-bezier(.16,1,.3,1)";

export function mountBoot() {
  const html = document.documentElement;
  const boot = document.querySelector(".boot");
  if (!boot || !html.classList.contains("booting")) { boot?.remove(); return; }
  try { sessionStorage.setItem("vf-boot", "1"); } catch { /* it plays again next time */ }
  const t0 = performance.now();
  smooth()?.stop();
  const ns = "http://www.w3.org/2000/svg";
  const fig = boot.querySelector(".boot-fig");

  // ── Build ──
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 240 340");
  const lines = LINKS.map(([a, b]) => {
    const l = document.createElementNS(ns, "line");
    l.setAttribute("x1", PTS[a][0]); l.setAttribute("y1", PTS[a][1]); l.setAttribute("x2", PTS[b][0]); l.setAttribute("y2", PTS[b][1]);
    l.setAttribute("pathLength", "1"); l.style.strokeDasharray = "1 1"; l.style.strokeDashoffset = "1";
    svg.append(l);
    return { l, y: Math.min(PTS[a][1], PTS[b][1]) };
  });
  const head = document.createElementNS(ns, "circle");
  Object.entries({ cx: HEAD[0], cy: HEAD[1], r: HEAD[2], pathLength: 1, class: "boot-head" }).forEach(([k, v]) => head.setAttribute(k, v));
  head.style.strokeDasharray = "1 1"; head.style.strokeDashoffset = "1";
  svg.append(head);
  // The figure stands in 3D: the bones on a plane, the points as their own
  // elements so each can come in from its own depth.
  const rig = document.createElement("div");
  rig.className = "boot-rig";
  rig.append(svg);
  const dots = PTS.map(([x, y], i) => {
    const c = document.createElement("i");
    c.className = i <= 10 ? "boot-dot face" : "boot-dot";
    c.style.left = `${(x / 240) * 100}%`;
    c.style.top = `${(y / 340) * 100}%`;
    c.style.opacity = "0";
    rig.append(c);
    return { c, x, y };
  });
  fig.append(rig);
  // A scan line wider than the figure, fading out at its ends.
  const scan = document.createElement("i");
  scan.className = "boot-scan";
  fig.append(scan);
  // Viewfinder brackets, and the tag they lock with.
  const brackets = ["tl", "tr", "bl", "br"].map((k) => { const b = document.createElement("i"); b.className = `boot-br ${k}`; fig.append(b); return b; });
  const tag = document.createElement("span");
  tag.className = "boot-tag";
  tag.textContent = "Locked · 33 / 33";
  fig.append(tag);
  // The wordmark, grid, crosshairs and meta are in the page (index.html) and
  // power on in CSS from the first paint; the readout is added here.
  const word = boot.querySelector(".boot-word");
  const read = document.createElement("p");
  read.className = "boot-read";
  read.innerHTML = `<span class="boot-xy">PT -- · X -.--- Y -.---</span>`;
  boot.append(read);
  const xy = read.querySelector(".boot-xy");
  const count = boot.querySelector(".boot-n"), state = boot.querySelector(".boot-state"), horizon = boot.querySelector(".boot-line");

  // ── 0.1 s: points lock on, top to bottom, while the figure turns to face you ──
  rig.animate([{ transform: "rotateY(-78deg) rotateX(14deg) scale(.82)" }, { transform: "none" }], { duration: 2000, delay: 60, easing: "cubic-bezier(.45,0,.2,1)", fill: "backwards" });
  const order = dots.map((d, i) => i).sort((a, b) => dots[a].y - dots[b].y || dots[a].x - dots[b].x);
  order.forEach((i, k) => {
    const from = `translate3d(${(Math.random() - 0.5) * 900}px, ${(Math.random() - 0.5) * 700}px, ${(Math.random() * 1100 - 700).toFixed(0)}px)`;
    const delay = 60 + k * 24;
    dots[i].c.animate([{ transform: from, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: "translate3d(0,0,0)", opacity: 1 }],
      { duration: 760, delay, easing: OUT, fill: "forwards" });
    setTimeout(() => {
      count.textContent = String(k + 1).padStart(2, "0");
      xy.textContent = `PT ${String(i).padStart(2, "0")} · X ${(dots[i].x / 240).toFixed(3)} Y ${(dots[i].y / 340).toFixed(3)}`;
      dots[i].c.animate([{ boxShadow: "0 0 0 0 rgba(198,239,78,.9)" }, { boxShadow: "0 0 0 9px rgba(198,239,78,0)" }], { duration: 500, easing: "ease-out" });
    }, delay + 600);
  });

  // ── 1.0 s: bones from the head down, the head's ring, a scan ──
  lines.sort((a, b) => a.y - b.y).forEach(({ l }, k) => l.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    { duration: 420, delay: 1000 + k * 16, easing: EASE, fill: "forwards" }));
  head.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 520, delay: 980, easing: EASE, fill: "forwards" });
  scan.animate([{ top: "0%", opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { top: "100%", opacity: 0 }],
    { duration: 720, delay: 1300, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });

  // ── 1.9 s: locked ──
  setTimeout(() => {
    state.textContent = "Tracking";
    word.classList.add("locked");
    brackets.forEach((b) => b.animate([{ transform: "scale(1.5)", opacity: 0 }, { transform: "scale(.94)", opacity: 1, offset: 0.7 }, { transform: "scale(1)", opacity: 1 }],
      { duration: 480, easing: OUT, fill: "forwards" }));
    tag.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 400, delay: 200, easing: OUT, fill: "forwards" });
    count.animate([{ color: "transparent" }, { color: "rgba(198,239,78,.9)", offset: 0.2 }, { color: "transparent" }], { duration: 900, easing: "ease-out" });
    horizon.animate([{ opacity: 0.5, boxShadow: "0 0 12px rgba(198,239,78,.7)" }, { opacity: 1, boxShadow: "0 0 22px rgba(198,239,78,1)", offset: 0.3 }, { opacity: 0.85, boxShadow: "0 0 12px rgba(198,239,78,.7)" }],
      { duration: 700, fill: "forwards" });
  }, LOCK);

  // Hand over once the hero's 3D and the fonts are in (or at the cap).
  const hero = document.querySelector(".hero");
  const heroReady = new Promise((resolve) => {
    if (!hero || hero.classList.contains("hero-gl")) return resolve();
    new MutationObserver((_, mo) => { if (hero.classList.contains("hero-gl")) { mo.disconnect(); resolve(); } }).observe(hero, { attributes: true, attributeFilter: ["class"] });
  });
  const ready = Promise.all([heroReady, document.fonts?.ready]).then(() => new Promise((r) => setTimeout(r, Math.max(0, MIN - (performance.now() - t0)))));
  Promise.race([ready, new Promise((r) => setTimeout(r, MAX - (performance.now() - t0)))]).then(() => open(boot, html));
}

/**
 * Split the screen open along the horizon while the figure glides into the
 * hero's figure, then hand over to the hero.
 */
function open(boot, html) {
  boot.classList.add("closing");             // keeps its look once html.booting is gone
  html.classList.remove("booting");          // the page under it is ready to move
  smooth()?.start();
  document.dispatchEvent(new Event("vf:booted"));
  for (const el of boot.querySelectorAll(".boot-label, .boot-count, .boot-read, .boot-meta, .boot-vline, .boot-tag, .boot-grid")) el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: 300, fill: "forwards" });
  // The wordmark's letters fly off up and down from the horizon.
  boot.querySelectorAll(".boot-word b").forEach((b, i, all) => b.animate([{ transform: "none", opacity: 1 }, { transform: `translateY(${i % 2 ? 130 : -130}%) rotate(${(i - all.length / 2) * 3}deg)`, opacity: 0 }],
    { duration: 560, delay: Math.abs(i - all.length / 2) * 18, easing: "cubic-bezier(.6,0,.8,.3)", fill: "forwards" }));
  boot.querySelector(".boot-line").animate([{ transform: "scaleX(1) scaleY(1)", opacity: 0.85 }, { transform: "scaleX(1) scaleY(4)", opacity: 1, offset: 0.25 }, { transform: "scaleX(1) scaleY(1)", opacity: 0 }],
    { duration: 900, easing: "ease-out", fill: "forwards" });
  // The figure glides into the hero's figure: same place, same height.
  const fig = boot.querySelector(".boot-fig"), r = fig.getBoundingClientRect();
  const to = sceneState.heroFigure?.();
  const fromTop = r.top + (r.height * TOP) / 340, fromBottom = r.top + (r.height * FEET) / 340;
  const fromMid = (fromTop + fromBottom) / 2, fromX = r.left + r.width / 2;
  const ok = to && isFinite(to.x) && to.bottom > to.top;
  const k = ok ? (to.bottom - to.top) / (fromBottom - fromTop) : 0.6;
  const dx = ok ? to.x - fromX : 0, dy = ok ? (to.top + to.bottom) / 2 - fromMid : 0;
  fig.style.transformOrigin = `50% ${(((TOP + FEET) / 2) / 340) * 100}%`;
  fig.animate([{ transform: "translate(-50%, -54%)", opacity: 1 }, { opacity: 1, offset: 0.55 },
    { transform: `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-54% + ${dy.toFixed(1)}px)) scale(${k.toFixed(3)})`, opacity: 0 }],
    { duration: 950, easing: "cubic-bezier(.65,0,.25,1)", fill: "forwards" });
  requestAnimationFrame(() => boot.classList.add("open"));    // the two halves part (css/site.css)
  setTimeout(() => boot.remove(), 1100);
}
