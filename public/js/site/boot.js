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
 *          horizon sits) while the figure turns into the hero's figure,
 *          joint for joint: every point travels to its joint on the hero
 *          (sceneState.heroJoints, in the hero camera's view), the body
 *          turning on the way (the shoulders and hips narrow and swing
 *          round into the side-on view), the head's ring settling onto the
 *          hero's, the colour easing to the hero's, with a short motion-blur
 *          trail while it moves fast. The hero's own figure assembles under
 *          it as it lands; then it fades. So the figure you watched being
 *          found is the one on the page.
 *
 * It waits for the hero's 3D and the fonts, for at least 2.5 s and at most
 * 5 s in all. "vf:booted" lets the hero's figure and headline arrive.
 */

import { CURVE, ease } from "../ui/ease.js";
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
const EASE = CURVE.inOutCubic, OUT = CURVE.outExpo;

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
  rig.animate([{ transform: "rotateY(-78deg) rotateX(14deg) scale(.82)" }, { transform: "none" }], { duration: 2000, delay: 60, easing: CURVE.inOutCubic, fill: "backwards" });
  const order = dots.map((d, i) => i).sort((a, b) => dots[a].y - dots[b].y || dots[a].x - dots[b].x);
  order.forEach((i, k) => {
    const from = `translate3d(${(Math.random() - 0.5) * 900}px, ${(Math.random() - 0.5) * 700}px, ${(Math.random() * 1100 - 700).toFixed(0)}px)`;
    const delay = 60 + k * 24;
    dots[i].c.animate([{ transform: from, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: "translate3d(0,0,0)", opacity: 1 }],
      { duration: 760, delay, easing: OUT, fill: "forwards" });
    setTimeout(() => {
      count.textContent = String(k + 1).padStart(2, "0");
      xy.textContent = `PT ${String(i).padStart(2, "0")} · X ${(dots[i].x / 240).toFixed(3)} Y ${(dots[i].y / 340).toFixed(3)}`;
      dots[i].c.animate([{ boxShadow: "0 0 0 0 rgba(198,239,78,.9)" }, { boxShadow: "0 0 0 9px rgba(198,239,78,0)" }], { duration: 500, easing: CURVE.outQuad });
    }, delay + 600);
  });

  // ── 1.0 s: bones from the head down, the head's ring, a scan ──
  lines.sort((a, b) => a.y - b.y).forEach(({ l }, k) => l.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    { duration: 420, delay: 1000 + k * 16, easing: EASE, fill: "forwards" }));
  head.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 520, delay: 980, easing: EASE, fill: "forwards" });
  // (transform, not top: it moves by the figure's height, 100% / 18% of its own)
  scan.animate([{ transform: "translateY(-100%)", opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { transform: "translateY(455%)", opacity: 0 }],
    { duration: 720, delay: 1300, easing: CURVE.inOutCubic, fill: "forwards" });

  // ── 1.9 s: locked ──
  setTimeout(() => {
    state.textContent = "Tracking";
    word.classList.add("locked");
    brackets.forEach((b) => b.animate([{ transform: "scale(1.5)", opacity: 0 }, { transform: "scale(.94)", opacity: 1, offset: 0.7 }, { transform: "scale(1)", opacity: 1 }],
      { duration: 480, easing: OUT, fill: "forwards" }));
    tag.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 400, delay: 200, easing: OUT, fill: "forwards" });
    count.animate([{ color: "transparent" }, { color: "rgba(198,239,78,.9)", offset: 0.2 }, { color: "transparent" }], { duration: 900, easing: CURVE.outQuad });
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
    { duration: 560, delay: Math.abs(i - all.length / 2) * 18, easing: CURVE.inQuart, fill: "forwards" }));
  boot.querySelector(".boot-line").animate([{ transform: "scaleX(1) scaleY(1)", opacity: 0.85 }, { transform: "scaleX(1) scaleY(4)", opacity: 1, offset: 0.25 }, { transform: "scaleX(1) scaleY(1)", opacity: 0 }],
    { duration: 900, easing: CURVE.outQuad, fill: "forwards" });
  // The figure turns into the hero's figure (or, without its joints, glides into its box).
  const fig = boot.querySelector(".boot-fig");
  if (morphIntoHero(fig)) { requestAnimationFrame(() => boot.classList.add("open")); setTimeout(() => boot.remove(), 1100); return; }
  const r = fig.getBoundingClientRect();
  const to = sceneState.heroFigure?.();
  const fromTop = r.top + (r.height * TOP) / 340, fromBottom = r.top + (r.height * FEET) / 340;
  const fromMid = (fromTop + fromBottom) / 2, fromX = r.left + r.width / 2;
  const ok = to && isFinite(to.x) && to.bottom > to.top;
  const k = ok ? (to.bottom - to.top) / (fromBottom - fromTop) : 0.6;
  const dx = ok ? to.x - fromX : 0, dy = ok ? (to.top + to.bottom) / 2 - fromMid : 0;
  fig.style.transformOrigin = `50% ${(((TOP + FEET) / 2) / 340) * 100}%`;
  fig.animate([{ transform: "translate(-50%, -54%)", opacity: 1 }, { opacity: 1, offset: 0.55 },
    { transform: `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-54% + ${dy.toFixed(1)}px)) scale(${k.toFixed(3)})`, opacity: 0 }],
    { duration: 950, easing: CURVE.inOutCubic, fill: "forwards" });
  requestAnimationFrame(() => boot.classList.add("open"));    // the two halves part (css/site.css)
  setTimeout(() => boot.remove(), 1100);
}

/* ── The turn into the hero's figure ──────────────────────────────────── */

// Where each of the 33 points goes on the hero: its joint, or (face, hands,
// heels) a point near one. [key, toward, amount, fades] with toward/amount
// placing it part way to another joint.
const TO = [
  ["nose"], ["nose", "earL", 0.35, 1], ["nose", "earL", 0.5, 1], ["nose", "earL", 0.65, 1], ["nose", "earR", 0.35, 1], ["nose", "earR", 0.5, 1], ["nose", "earR", 0.65, 1],
  ["earL", null, 0, 1], ["earR", null, 0, 1], ["nose", "shL", 0.15, 1], ["nose", "shR", 0.15, 1],
  ["shL"], ["shR"], ["elL"], ["elR"], ["wrL"], ["wrR"],
  ["wrL", "elL", -0.12, 1], ["wrR", "elR", -0.12, 1], ["wrL", "elL", -0.16, 1], ["wrR", "elR", -0.16, 1], ["wrL", "elL", -0.08, 1], ["wrR", "elR", -0.08, 1],
  ["hipL"], ["hipR"], ["knL"], ["knR"], ["anL"], ["anR"], ["heL"], ["heR"], ["toL"], ["toR"],
];
const BODY = [11, 12, 23, 24];               // the turn swings round the middle of these
const LIME = [198, 239, 78];

function morphIntoHero(fig) {
  const J0 = sceneState.heroJoints?.();
  const dots = [...fig.querySelectorAll(".boot-dot")], headEl = fig.querySelector(".boot-head");
  if (!J0 || dots.length !== 33 || !headEl || !TO.every(([k]) => J0[k])) return false;
  const box = fig.getBoundingClientRect(), u = box.height / 340;          // px per unit of the figure's box
  const start = dots.map((d) => { const r = d.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const hr = headEl.getBoundingClientRect();
  const head0 = [hr.left + hr.width / 2, hr.top + hr.height / 2, hr.width / 2];
  const canvas = document.createElement("canvas");
  canvas.className = "boot-morph";
  document.body.append(canvas);
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  g.lineCap = "round";
  fig.style.visibility = "hidden";                    // the canvas draws it from here, from the same place
  const at = (J, [k, toward, amt = 0]) => toward ? [J[k][0] + (J[toward][0] - J[k][0]) * amt, J[k][1] + (J[toward][1] - J[k][1]) * amt] : J[k];
  const centre = (pts) => BODY.reduce((c, i) => [c[0] + pts[i][0] / 4, c[1] + pts[i][1] / 4], [0, 0]);
  const c0 = centre(start);
  const hex = (h) => { const n = parseInt(String(h || "#eef1fb").replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const DUR = 1000, t0 = performance.now(), trail = [];
  // Top to bottom, a little apart, so the turn runs down the body.
  const delay = start.map(([, y]) => Math.max(0, Math.min(1, (y - box.top) / box.height)) * 110);

  const pose = (now, J) => {
    const tgt = TO.map((m) => at(J, m)), c1 = centre(tgt);
    const pts = start.map((s, i) => {
      const e = ease.inOutCubic(Math.max(0, Math.min(1, (now - t0 - delay[i]) / DUR)));
      // A turn, not a slide: the offset from the middle swings round (cos / sin)
      // while the middle itself travels and the height settles.
      const a = (e * Math.PI) / 2, cx = c0[0] + (c1[0] - c0[0]) * e, cy = c0[1] + (c1[1] - c0[1]) * e;
      const sx = s[0] - c0[0], tx = tgt[i][0] - c1[0];
      return [cx + sx * Math.cos(a) + tx * Math.sin(a), cy + (s[1] - c0[1]) + ((tgt[i][1] - c1[1]) - (s[1] - c0[1])) * e, e];
    });
    const e = ease.inOutCubic(Math.max(0, Math.min(1, (now - t0 - 40) / DUR)));
    const h1 = J.head ?? [tgt[0][0], tgt[0][1], head0[2] * 0.5];
    const head = [head0[0] + (h1[0] - head0[0]) * e, head0[1] + (h1[1] - head0[1]) * e, head0[2] + (h1[2] - head0[2]) * e];
    return { pts, head, e };
  };

  const draw = (P, alpha, col, width) => {
    const { pts, head, e } = P;
    g.strokeStyle = `rgba(${col.join(",")},${(0.85 * alpha).toFixed(3)})`;
    g.lineWidth = width;
    g.beginPath();
    for (const [a, b] of LINKS) { g.moveTo(pts[a][0], pts[a][1]); g.lineTo(pts[b][0], pts[b][1]); }
    // The neck the hero's figure has, coming in as it lands.
    if (e > 0.3) { const n = [(pts[11][0] + pts[12][0]) / 2, (pts[11][1] + pts[12][1]) / 2]; g.moveTo(n[0], n[1]); g.lineTo(head[0] + (n[0] - head[0]) * (head[2] / Math.max(1, Math.hypot(n[0] - head[0], n[1] - head[1]))), head[1] + (n[1] - head[1]) * (head[2] / Math.max(1, Math.hypot(n[0] - head[0], n[1] - head[1])))); }
    g.moveTo(head[0] + head[2], head[1]);
    g.arc(head[0], head[1], Math.max(0.5, head[2]), 0, Math.PI * 2);
    g.stroke();
    // Points: the face and fingers fade as they fold into the head and hands.
    pts.forEach(([x, y, k], i) => {
      const fade = TO[i][3] ? 1 - k : 1;
      if (fade <= 0.02) return;
      g.fillStyle = `rgba(238,241,251,${(alpha * fade).toFixed(3)})`;
      g.beginPath(); g.arc(x, y, (i <= 10 ? 1.6 : 2.6) * Math.max(0.7, u * (1 - 0.3 * k)), 0, Math.PI * 2); g.fill();
    });
  };

  const frame = (now) => {
    const J = sceneState.heroJoints?.() ?? J0;        // the hero keeps moving: land on where it is now
    const P = pose(now, J);
    const col = LIME.map((c, i) => Math.round(c + (hex(J.colour)[i] - c) * P.e));
    const width = (1.4 * u) * (1 - P.e) + 2 * P.e;
    // Landed: it keeps following the hero (which keeps moving) while it fades, so there's never a double image.
    const fade = 1 - ease.outCubic(Math.max(0, Math.min(1, (now - t0 - DUR - 160) / 340)));
    g.clearRect(0, 0, W, H);
    g.shadowColor = `rgba(${col.join(",")},.6)`; g.shadowBlur = 8;
    // Motion blur: the last few frames, fainter, while it moves fast.
    trail.forEach((T, k) => draw(T, 0.12 * (k + 1) * (1 - P.e * 0.6) * fade, col, width));
    draw(P, fade, col, width);
    trail.push(P); if (trail.length > 3) trail.shift();
    if (fade > 0) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
  return true;
}

