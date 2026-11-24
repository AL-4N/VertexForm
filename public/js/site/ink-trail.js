/**
 * ink-trail.js — a line of ink that runs down the margin as you scroll, so a
 * screen that is only words still shows you're moving through it.
 *
 *   the line   hand drawn (a slight wobble, the same every time: seeded),
 *              in three layers: a faint bleed, the ink in the go gradient
 *              (amber at the top to green at the bottom), a wet highlight.
 *   the tip    a drop of ink with a soft glow, stretching a little while it
 *              moves.
 *   splatter   small drops beside the line that land (back-out) as the
 *              tip passes them.
 *   marks      optional blots along the line (an info page's headings) that
 *              fill with ink once passed.
 *   labels     optional: a reading at the top ("Scroll") that fades once you
 *              start, and one at the foot (what comes next).
 *
 * set(p) gives the progress (0..1); the drawn ink follows it with a short
 * lag (exponential follow), so it flows rather than jumps. Draws only while
 * it's catching up. Homepage text scenes (scenes.js) and the info pages
 * (library.js) use it.
 */

import { reducedMotion } from "../ui/motion.js";

const NS = "http://www.w3.org/2000/svg";
const FOLLOW_MS = 120;
let uid = 0;

function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

export class InkTrail {
  constructor(host, { seed = "ink", top = "", bottom = "", marks = [] } = {}) {
    this.host = host;
    this.seed = seed;
    this.marksAt = marks;
    this.id = `ink-${++uid}`;
    this.quiet = reducedMotion();
    host.classList.add("ink-trail");
    host.setAttribute("aria-hidden", "true");
    this.svg = document.createElementNS(NS, "svg");
    host.append(this.svg);
    this.topLabel = top ? Object.assign(document.createElement("span"), { className: "ink-top", textContent: top }) : null;
    this.footLabel = bottom ? Object.assign(document.createElement("span"), { className: "ink-foot", innerHTML: bottom }) : null;
    if (this.topLabel) host.append(this.topLabel);
    if (this.footLabel) host.append(this.footLabel);
    this.goal = 0; this.shown = 0; this.raf = 0; this.last = 0; this.vel = 0;
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(host);
    this.layout();
  }

  /** Build the line for the host's current height. */
  layout() {
    const w = 40, h = Math.max(60, this.host.clientHeight);
    if (h === this.h) return;
    this.h = h;
    const rand = seeded(this.seed), x0 = w / 2;
    // The wobble: a point every ~34px, drifting a few px, smoothed (Catmull-Rom → bezier).
    const pts = [];
    for (let y = 0, k = 0; y <= h; y += 34, k++) pts.push([x0 + (k ? (rand() - 0.5) * 6 : 0), Math.min(y, h)]);
    if (pts.at(-1)[1] < h) pts.push([x0, h]);
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    const g = `${this.id}-g`;
    const splat = Array.from({ length: Math.round(h / 55) }, () => ({ t: 0.04 + rand() * 0.92, dx: (rand() < 0.5 ? -1 : 1) * (5 + rand() * 9), dy: (rand() - 0.5) * 10, r: 0.8 + rand() * 1.8 }));
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    this.svg.setAttribute("width", w);
    this.svg.setAttribute("height", h);
    this.svg.innerHTML = `<defs><linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${h}">
        <stop offset="0" stop-color="#ffbe3d"/><stop offset=".5" stop-color="#c6ef4e"/><stop offset="1" stop-color="#2ee59d"/></linearGradient></defs>
      <path class="ink-bed" d="${d}"/>
      <path class="ink-bleed" d="${d}" stroke="url(#${g})" pathLength="1"/>
      <path class="ink-body" d="${d}" stroke="url(#${g})" pathLength="1"/>
      <path class="ink-wet" d="${d}" pathLength="1"/>
      <g class="ink-splats"></g><g class="ink-marks"></g>
      <g class="ink-tip"><ellipse class="ink-glow" rx="10" ry="10" fill="url(#${g})"/><ellipse class="ink-drop" rx="3.6" ry="3.6" fill="url(#${g})"/></g>`;
    this.paths = [...this.svg.querySelectorAll(".ink-bleed, .ink-body, .ink-wet")];
    this.measure = this.svg.querySelector(".ink-body");
    this.len = this.measure.getTotalLength();
    // Sample the path once, so drawing never asks the browser for geometry
    // (that forced a layout every frame while other code was writing styles).
    const n = Math.max(48, Math.round(h / 4));
    this.lut = Array.from({ length: n + 1 }, (_, i) => { const q = this.measure.getPointAtLength((i / n) * this.len); return [q.x, q.y]; });
    this.tip = this.svg.querySelector(".ink-tip");
    this.drop = this.svg.querySelector(".ink-drop");
    const at = (t) => this.measure.getPointAtLength(t * this.len);
    this.splats = splat.map((s) => {
      const p = at(s.t), c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", (p.x + s.dx).toFixed(1)); c.setAttribute("cy", (p.y + s.dy).toFixed(1)); c.setAttribute("r", s.r.toFixed(2));
      c.setAttribute("fill", `url(#${g})`);
      c.classList.add("ink-splat");
      this.svg.querySelector(".ink-splats").append(c);
      return { t: s.t, c, on: false };
    });
    this.setMarks(this.marksAt);
    this.paint(this.shown);
  }

  /** Blots along the line at these fractions (0..1), e.g. an info page's headings. */
  setMarks(fracs = []) {
    this.marksAt = fracs;
    const host = this.svg.querySelector(".ink-marks");
    if (!host || !this.measure) return;
    host.replaceChildren();
    // Blots closer than 14px merge into one (a page with many short sections).
    let lastY = -Infinity;
    const keep = fracs.filter((t) => { const y = Math.max(0, Math.min(1, t)) * this.h; if (y - lastY < 14) return false; lastY = y; return true; });
    this.marks = keep.map((t) => {
      const p = this.measure.getPointAtLength(Math.max(0, Math.min(1, t)) * this.len), g = document.createElementNS(NS, "g");
      g.setAttribute("class", "ink-mark");
      g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      g.innerHTML = `<line x1="5" y1="0" x2="16" y2="0"/><circle r="4"/>`;
      host.append(g);
      return { t, g, on: false };
    });
    this.paint(this.shown);
  }

  /** A point on the line at t (0..1), from the samples. */
  point(t) {
    const lut = this.lut, f = Math.max(0, Math.min(1, t)) * (lut.length - 1), i = Math.floor(f), k = f - i;
    const a = lut[i], b = lut[Math.min(lut.length - 1, i + 1)];
    return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k };
  }

  /** Where the reader is: 0..1. */
  set(p) {
    const g = Math.max(0, Math.min(1, p));
    if (g === this.goal && this.shown === g) return;          // nothing to draw
    this.goal = g;
    if (this.quiet) { this.shown = this.goal; this.paint(this.shown); return; }
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  frame(now) {
    this.raf = 0;
    const dt = Math.min(64, this.last ? now - this.last : 16);
    this.last = now;
    const before = this.shown;
    this.shown += (this.goal - this.shown) * (1 - Math.exp(-dt / FOLLOW_MS));
    if (Math.abs(this.goal - this.shown) < 0.0008) this.shown = this.goal;
    this.vel = (this.shown - before) / (dt / 1000);
    this.paint(this.shown);
    if (this.shown !== this.goal) this.raf = requestAnimationFrame((t) => this.frame(t));
    else { this.last = 0; this.vel = 0; this.paint(this.shown); }
  }

  paint(p) {
    if (!this.measure) return;
    for (const el of this.paths) el.style.strokeDashoffset = String(1 - p);
    const pt = this.point(p);
    // The drop stretches along the line while the ink runs, and rounds off at rest.
    const stretch = Math.min(1.9, 1 + Math.abs(this.vel) * 2.2);
    this.tip.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    this.drop.setAttribute("ry", (3.6 * stretch).toFixed(2));
    this.drop.setAttribute("rx", (3.6 / Math.sqrt(stretch)).toFixed(2));
    this.tip.style.opacity = p > 0.002 ? "1" : "0.35";
    for (const s of this.splats ?? []) {
      const on = p >= s.t;
      if (on !== s.on) { s.on = on; s.c.classList.toggle("on", on); }
    }
    for (const m of this.marks ?? []) {
      const on = p >= m.t - 0.002;
      if (on !== m.on) { m.on = on; m.g.classList.toggle("on", on); }
    }
    if (this.topLabel) this.topLabel.style.opacity = String(Math.max(0, 1 - p * 18));
    if (this.footLabel) this.footLabel.style.opacity = String(0.35 + 0.65 * Math.max(0, (p - 0.55) / 0.45));
  }

  destroy() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.host.replaceChildren(); }
}

