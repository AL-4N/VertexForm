/**
 * boot.js — the calibration intro, on the first visit in a session (the
 * inline script in index.html's <head> decides and adds html.booting; it
 * also gives up after 6 s if this never runs).
 *
 * MediaPipe's 33 body points are found one by one on a standing figure,
 * top to bottom, while a counter climbs to 33; the bones are drawn between
 * them (MediaPipe's own connections); a scan passes down the figure; a
 * horizon line runs out to both edges; then the screen closes onto that
 * line, which is where the hero's own horizon sits, and "vf:booted" lets
 * the hero's figure and headline arrive. It waits for the hero's 3D and
 * the fonts, for at least 2.2 s and at most 5 s in all.
 */

import { smooth } from "./smooth.js";

// A person facing you, in a 240 × 340 box (MediaPipe's landmark order).
const PTS = [
  [120, 40], [126, 33], [131, 33], [136, 33], [114, 33], [109, 33], [104, 33], [144, 38], [96, 38], [127, 50], [113, 50],
  [158, 82], [82, 82], [176, 132], [64, 132], [186, 180], [54, 180], [190, 194], [50, 194], [186, 197], [54, 197], [181, 191], [59, 191],
  [142, 182], [98, 182], [146, 250], [94, 250], [148, 314], [92, 314], [145, 326], [95, 326], [160, 330], [80, 330],
];
const LINKS = [[0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]];
const MIN = 2200, MAX = 5000;
const EASE = "cubic-bezier(.65,.05,.25,1)";

export function mountBoot() {
  const html = document.documentElement;
  const boot = document.querySelector(".boot");
  if (!boot || !html.classList.contains("booting")) { boot?.remove(); return; }
  try { sessionStorage.setItem("vf-boot", "1"); } catch { /* it plays again next time */ }
  const t0 = performance.now();
  smooth()?.stop();

  // The figure: lines under the points, a scan band over both.
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 240 340");
  svg.innerHTML = `<defs><linearGradient id="boot-scan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c6ef4e" stop-opacity="0"/><stop offset=".85" stop-color="#c6ef4e" stop-opacity=".22"/><stop offset="1" stop-color="#eef1fb" stop-opacity=".9"/></linearGradient></defs>`;
  const lines = LINKS.map(([a, b]) => {
    const l = document.createElementNS(ns, "line");
    l.setAttribute("x1", PTS[a][0]); l.setAttribute("y1", PTS[a][1]); l.setAttribute("x2", PTS[b][0]); l.setAttribute("y2", PTS[b][1]);
    l.setAttribute("pathLength", "1"); l.style.strokeDasharray = "1 1"; l.style.strokeDashoffset = "1";
    svg.append(l);
    return { l, y: Math.min(PTS[a][1], PTS[b][1]) };
  });
  const dots = PTS.map(([x, y]) => {
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", 2.6);
    svg.append(c);
    return { c, y };
  });
  const scan = document.createElementNS(ns, "rect");
  Object.entries({ class: "boot-scan", x: -10, y: -60, width: 260, height: 60 }).forEach(([k, v]) => scan.setAttribute(k, v));
  svg.append(scan);
  boot.querySelector(".boot-fig").append(svg);
  const count = boot.querySelector(".boot-n"), state = boot.querySelector(".boot-state");

  // Points top to bottom, the counter climbing with them.
  const order = dots.map((d, i) => i).sort((a, b) => dots[a].y - dots[b].y);
  order.forEach((i, k) => setTimeout(() => {
    dots[i].c.classList.add("on");
    count.textContent = String(k + 1).padStart(2, "0");
  }, 150 + k * 30));
  // Bones from the head down, then the scan, then the horizon.
  lines.sort((a, b) => a.y - b.y).forEach(({ l }, k) => l.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    { duration: 380, delay: 760 + k * 14, easing: EASE, fill: "forwards" }));
  scan.style.opacity = "0";
  scan.animate([{ transform: "translateY(0)", opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.82 }, { transform: "translateY(420px)", opacity: 0 }],
    { duration: 650, delay: 1250, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
  boot.querySelector(".boot-line").animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 700, delay: 1450, easing: EASE, fill: "forwards" });
  setTimeout(() => { state.textContent = "Tracking"; }, 1900);

  // Hand over once the hero's 3D and the fonts are in (or at the cap).
  const hero = document.querySelector(".hero");
  const heroReady = new Promise((resolve) => {
    if (!hero || hero.classList.contains("hero-gl")) return resolve();
    new MutationObserver((_, mo) => { if (hero.classList.contains("hero-gl")) { mo.disconnect(); resolve(); } }).observe(hero, { attributes: true, attributeFilter: ["class"] });
  });
  const ready = Promise.all([heroReady, document.fonts?.ready]).then(() => new Promise((r) => setTimeout(r, Math.max(0, MIN - (performance.now() - t0)))));
  Promise.race([ready, new Promise((r) => setTimeout(r, MAX - (performance.now() - t0)))]).then(() => close(boot, html));
}

/** Close the screen onto the horizon line, then hand over to the hero. */
function close(boot, html) {
  const y = boot.querySelector(".boot-line").getBoundingClientRect().top;
  const below = Math.max(0, innerHeight - y - 1);
  boot.classList.add("closing");             // keeps its look once html.booting is gone
  html.classList.remove("booting");          // the page under it is ready to move
  smooth()?.start();
  document.dispatchEvent(new Event("vf:booted"));
  const anim = boot.animate([{ clipPath: "inset(0px 0px 0px 0px)" }, { clipPath: `inset(${y}px 0px ${below}px 0px)` }], { duration: 760, easing: "cubic-bezier(.76,0,.24,1)", fill: "forwards" });
  boot.querySelector(".boot-fig").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, fill: "forwards" });
  anim.finished.then(() => boot.remove(), () => boot.remove());
}
