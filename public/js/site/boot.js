/**
 * boot.js — the calibration intro, on the first visit in a session (the
 * inline script in index.html's <head> decides and adds html.booting; it
 * also gives up after 6 s if this never runs).
 *
 *   1. MediaPipe's 33 body points start as a cloud scattered in 3D depth
 *      and lock onto a standing figure one by one, top to bottom, the way
 *      the tracker finds a body, while the figure turns from side-on to
 *      face you, a big counter climbs to 33 and a readout gives each
 *      point's coordinates as it lands. Behind it the wordmark rises in
 *      letter by letter, outlined; "Form" fills with the go gradient when
 *      tracking locks.
 *   2. The bones draw in between them (MediaPipe's own connections),
 *      glowing, and a scan passes down the figure.
 *   3. A horizon line runs out to both edges; then the screen splits open
 *      along it, top half up and bottom half down, with a flash on the
 *      line, which is where the hero's own horizon sits, as the figure
 *      rushes toward you and the wordmark's letters fly off. "vf:booted" lets
 *      the hero's figure and headline arrive as it opens.
 *
 * It waits for the hero's 3D and the fonts, for at least 2.4 s and at most
 * 5 s in all.
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
const MIN = 2400, MAX = 5000;
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
  // The figure stands in 3D: the bones on a plane, the points as their own
  // elements so each can come in from its own depth.
  const rig = document.createElement("div");
  rig.className = "boot-rig";
  const dots = PTS.map(([x, y]) => {
    const c = document.createElement("i");
    c.className = "boot-dot";
    c.style.left = `${(x / 240) * 100}%`;
    c.style.top = `${(y / 340) * 100}%`;
    c.style.opacity = "0";
    rig.append(c);
    return { c, y, x };
  });
  const scan = document.createElementNS(ns, "rect");
  Object.entries({ class: "boot-scan", x: -10, y: -60, width: 260, height: 60 }).forEach(([k, v]) => scan.setAttribute(k, v));
  scan.style.opacity = "0";
  svg.append(scan);
  rig.prepend(svg);
  boot.querySelector(".boot-fig").append(rig);
  const count = boot.querySelector(".boot-n"), state = boot.querySelector(".boot-state");
  // The wordmark behind the figure, a letter at a time; and the readout.
  const word = document.createElement("p");
  word.className = "boot-word";
  word.innerHTML = `<span>${[..."Vertex"].map((c) => `<b>${c}</b>`).join("")}</span><span class="boot-form">${[..."Form"].map((c, i) => `<b data-c="${c}" style="--i:${i}">${c}</b>`).join("")}</span>`;
  boot.prepend(word);
  const read = document.createElement("p");
  read.className = "boot-read";
  read.innerHTML = `<span>Pose landmarker · 33 points</span><span class="boot-xy">PT -- · X -.--- Y -.---</span>`;
  boot.append(read);
  const xy = read.querySelector(".boot-xy");
  word.querySelectorAll("b").forEach((b, i) => b.animate([{ transform: "translateY(112%)" }, { transform: "none" }],
    { duration: 900, delay: 120 + i * 55, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" }));
  // The figure turns from side-on to face you while it's found.
  rig.animate([{ transform: "rotateY(-78deg) rotateX(14deg) scale(.82)" }, { transform: "none" }],
    { duration: 2000, delay: 60, easing: "cubic-bezier(.45,0,.2,1)", fill: "backwards" });

  // 1. Scattered points lock on, top to bottom; the counter climbs as each one lands.
  const order = dots.map((d, i) => i).sort((a, b) => dots[a].y - dots[b].y);
  order.forEach((i, k) => {
    // From somewhere in the room: across, up or down, and nearer or farther.
    const from = `translate3d(${(Math.random() - 0.5) * 900}px, ${(Math.random() - 0.5) * 700}px, ${(Math.random() * 1100 - 700).toFixed(0)}px)`;
    const delay = 120 + k * 24;
    dots[i].c.animate([{ transform: from, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: "translate3d(0,0,0)", opacity: 1 }],
      { duration: 760, delay, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });
    setTimeout(() => {
      count.textContent = String(k + 1).padStart(2, "0");
      xy.textContent = `PT ${String(i).padStart(2, "0")} · X ${(dots[i].x / 240).toFixed(3)} Y ${(dots[i].y / 340).toFixed(3)}`;
      dots[i].c.animate([{ boxShadow: "0 0 0 0 rgba(198,239,78,.9)" }, { boxShadow: "0 0 0 9px rgba(198,239,78,0)" }], { duration: 500, easing: "ease-out" });
    }, delay + 600);
  });
  // 2. Bones from the head down, glowing; then the scan.
  lines.sort((a, b) => a.y - b.y).forEach(({ l }, k) => l.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    { duration: 380, delay: 1050 + k * 14, easing: EASE, fill: "forwards" }));
  scan.animate([{ transform: "translateY(0)", opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.82 }, { transform: "translateY(420px)", opacity: 0 }],
    { duration: 650, delay: 1500, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
  // 3. The horizon runs out to both edges.
  boot.querySelector(".boot-line").animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 700, delay: 1650, easing: EASE, fill: "forwards" });
  setTimeout(() => { state.textContent = "Tracking"; word.classList.add("locked"); }, 2050);

  // Hand over once the hero's 3D and the fonts are in (or at the cap).
  const hero = document.querySelector(".hero");
  const heroReady = new Promise((resolve) => {
    if (!hero || hero.classList.contains("hero-gl")) return resolve();
    new MutationObserver((_, mo) => { if (hero.classList.contains("hero-gl")) { mo.disconnect(); resolve(); } }).observe(hero, { attributes: true, attributeFilter: ["class"] });
  });
  const ready = Promise.all([heroReady, document.fonts?.ready]).then(() => new Promise((r) => setTimeout(r, Math.max(0, MIN - (performance.now() - t0)))));
  Promise.race([ready, new Promise((r) => setTimeout(r, MAX - (performance.now() - t0)))]).then(() => open(boot, html));
}

/** Split the screen open along the horizon, then hand over to the hero. */
function open(boot, html) {
  boot.classList.add("closing");             // keeps its look once html.booting is gone
  html.classList.remove("booting");          // the page under it is ready to move
  smooth()?.start();
  document.dispatchEvent(new Event("vf:booted"));
  for (const el of boot.querySelectorAll(".boot-label, .boot-count, .boot-read")) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards" });
  // The figure rushes toward you; the wordmark's letters fly off up and down from the horizon.
  boot.querySelector(".boot-fig")?.animate([{ transform: "translate(-50%, -54%) scale(1)", opacity: 1 }, { opacity: 0, offset: 0.5 }, { transform: "translate(-50%, -54%) scale(3.4)", opacity: 0 }],
    { duration: 700, easing: "cubic-bezier(.55,0,.8,.2)", fill: "forwards" });
  boot.querySelectorAll(".boot-word b").forEach((b, i, all) => b.animate([{ transform: "none", opacity: 1 }, { transform: `translateY(${i % 2 ? 140 : -140}%) rotate(${(i - all.length / 2) * 3}deg)`, opacity: 0 }],
    { duration: 520, delay: Math.abs(i - all.length / 2) * 20, easing: "cubic-bezier(.6,0,.8,.3)", fill: "forwards" }));
  boot.querySelector(".boot-line").animate([{ transform: "scaleX(1) scaleY(1)", opacity: 1, filter: "brightness(1)" }, { transform: "scaleX(1) scaleY(4)", opacity: 1, filter: "brightness(2.2)", offset: 0.25 }, { transform: "scaleX(1) scaleY(1)", opacity: 0 }],
    { duration: 900, easing: "ease-out", fill: "forwards" });
  requestAnimationFrame(() => boot.classList.add("open"));    // the two halves part (css/site.css)
  setTimeout(() => boot.remove(), 1100);
}
