/**
 * flair.js — the trainer's signature screen moments, each tied to what the
 * screen is for (in the family of the skill tree's card-to-tree zoom, each
 * one different):
 *
 *   morphInto   a card becomes the panel it opens: the card's box stretches
 *               to exactly where that panel sits on the new screen while its
 *               figure flies into the panel's figure, then the rest of the
 *               screen drops in like dominoes (exercise → setup).
 *   stamp       a grade lands like a rubber stamp: it slams down, a ring of
 *               its colour shocks outward, the card jolts (results).
 *   flipBoard   stat cards flip down one after another like a departure
 *               board, then each chart draws its lines and pops its dots
 *               (history).
 *   dealCards   option cards start stacked like a deck and deal out to their
 *               places, and a calendar's days pop in as a wave (challenges).
 *
 * All Web Animations, no libraries. Reduced motion: none of it runs.
 */

import { reducedMotion } from "./motion.js";

const OUT = "cubic-bezier(.22,.61,.36,1)";
const TRAVEL = "cubic-bezier(.65,0,.2,1)";
const POP = "cubic-bezier(.2,.9,.3,1.25)";
const ok = () => !reducedMotion() && !!document.body.animate;
const rect = (r, radius) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: radius });

/**
 * from: the card pressed. figure: the bit of it that flies (its picture).
 * open(): switches to the new screen (without its own animation).
 * screen: the new screen; target / targetFigure: where the card and the
 * figure land on it; rest: what drops in around them afterwards.
 */
export async function morphInto({ from, figure, open, screen, target, targetFigure, rest = [] }) {
  if (!ok() || !from) { open(); return; }
  const c = from.getBoundingClientRect();
  const f = figure?.getBoundingClientRect();
  const box = document.createElement("div");
  box.className = "flair-box";
  box.setAttribute("aria-hidden", "true");
  document.body.appendChild(box);
  let fly = null;
  if (figure && f?.width) {
    fly = document.createElement("div");
    fly.className = "flair-fly picto";
    fly.setAttribute("aria-hidden", "true");
    fly.innerHTML = figure.innerHTML;
    document.body.appendChild(fly);
  }
  const radius = getComputedStyle(from).borderRadius || "14px";
  try {
    // Lift the card: a small pop where it is.
    const lifted = { left: c.left - 6, top: c.top - 6, width: c.width + 12, height: c.height + 12 };
    if (fly) fly.animate([rect(f, "0px"), rect({ left: f.left - 4, top: f.top - 6, width: f.width + 8, height: f.height + 8 }, "0px")], { duration: 260, easing: POP, fill: "forwards" });
    await box.animate([rect(c, radius), rect(lifted, radius)], { duration: 260, easing: POP, fill: "forwards" }).finished;

    // Lay the new screen out unseen and find where things land.
    open();
    screen.style.visibility = "hidden";
    const t = target.getBoundingClientRect();
    const tf = targetFigure?.getBoundingClientRect();
    const tRadius = getComputedStyle(target).borderRadius;
    const moves = [box.animate([rect(lifted, radius), rect(t, tRadius)], { duration: 680, easing: TRAVEL, fill: "forwards" }).finished];
    if (fly && tf?.width) {
      // The figure arcs up a little on its way (a hop), then lands.
      const mid = { left: (f.left + tf.left) / 2, top: Math.min(f.top, tf.top) - 40, width: (f.width + tf.width) / 2, height: (f.height + tf.height) / 2 };
      moves.push(fly.animate([rect(f, "0px"), { ...rect(mid, "0px"), offset: 0.55 }, rect(tf, "0px")], { duration: 760, easing: TRAVEL, fill: "forwards" }).finished);
    }
    await Promise.all(moves);

    // Hand over to the real screen; the rest drops in like dominoes.
    screen.style.visibility = "";
    rest.filter(Boolean).forEach((el, k) => el.animate(
      [{ opacity: 0, transform: "perspective(800px) rotateX(-55deg) translateY(-12px)", transformOrigin: "50% 0", filter: "blur(10px)" },
       { opacity: 1, transform: "perspective(800px) rotateX(0) translateY(0)", transformOrigin: "50% 0", filter: "blur(0)" }],
      { duration: 560, delay: 40 + k * 80, easing: POP, fill: "backwards" }));
    await Promise.all([box, fly].filter(Boolean).map((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" }).finished));
  } finally {
    box.remove();
    fly?.remove();
    screen.style.visibility = "";
  }
}

/** The grade lands: slams down from above, a ring of its colour shocks out, the card jolts. */
export function stamp(el, colour, card = el.closest(".card")) {
  if (!ok() || !el) return;
  el.animate([
    { transform: "scale(2.6) rotate(-16deg)", opacity: 0, filter: "blur(6px)" },
    { transform: "scale(.88) rotate(3deg)", opacity: 1, filter: "blur(0)", offset: 0.62 },
    { transform: "scale(1.06) rotate(-1deg)", offset: 0.82 },
    { transform: "scale(1) rotate(0)" },
  ], { duration: 560, easing: "cubic-bezier(.3,.7,.3,1)" });
  const r = el.getBoundingClientRect();
  const ring = document.createElement("span");
  ring.className = "flair-ring";
  ring.setAttribute("aria-hidden", "true");
  const size = Math.max(r.width, r.height);
  Object.assign(ring.style, { left: `${r.left + r.width / 2 - size / 2}px`, top: `${r.top + r.height / 2 - size / 2}px`, width: `${size}px`, height: `${size}px`, borderColor: colour });
  document.body.appendChild(ring);
  ring.animate([{ transform: "scale(.5)", opacity: 0.9 }, { transform: "scale(3.2)", opacity: 0 }], { duration: 650, delay: 330, easing: OUT, fill: "both" })
    .finished.then(() => ring.remove());
  card?.animate([
    { transform: "translate(0, 0)" }, { transform: "translate(0, 5px)", offset: 0.2 },
    { transform: "translate(-3px, -2px)", offset: 0.45 }, { transform: "translate(2px, 1px)", offset: 0.7 }, { transform: "translate(0, 0)" },
  ], { duration: 360, delay: 340, easing: "ease-out" });
}

/** History: stat cards flip down in turn like a departure board; charts draw themselves. */
export function flipBoard(host) {
  if (!ok() || !host) return;
  [...host.querySelectorAll(".stat-card")].forEach((el, k) => el.animate(
    [{ transform: "perspective(600px) rotateX(-92deg)", opacity: 0, transformOrigin: "50% 0" },
     { transform: "perspective(600px) rotateX(12deg)", opacity: 1, transformOrigin: "50% 0", offset: 0.7 },
     { transform: "perspective(600px) rotateX(0)", opacity: 1, transformOrigin: "50% 0" }],
    { duration: 520, delay: 60 + k * 55, easing: OUT, fill: "backwards" }));
  host.querySelectorAll(".hist-chart").forEach((chart, c) => {
    const delay = 300 + c * 120;
    chart.querySelectorAll("polyline").forEach((line) => {
      const len = line.getTotalLength?.() || 600;
      line.animate([{ strokeDasharray: `${len} ${len}`, strokeDashoffset: len }, { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 }],
        { duration: 900, delay, easing: "cubic-bezier(.45,.05,.55,.95)", fill: "backwards" });
    });
    chart.querySelectorAll("circle").forEach((dot, i) => dot.animate(
      [{ transform: "scale(0)" }, { transform: "scale(1)" }],
      { duration: 320, delay: delay + 500 + i * 25, easing: POP, fill: "backwards" }));
    chart.querySelectorAll("circle").forEach((dot) => { dot.style.transformBox = "fill-box"; dot.style.transformOrigin = "center"; });
  });
  host.querySelectorAll(".ach.on").forEach((a, i) => a.animate(
    [{ backgroundPosition: "-120% 0" }, { backgroundPosition: "220% 0" }],
    { duration: 900, delay: 700 + i * 90, easing: "ease-in-out" }));
}

/** Challenges: the cards deal out from a stacked deck; the calendar's days pop in as a wave. */
export function dealCards(cards, calendar = []) {
  if (!ok() || !cards.length) return;
  const first = cards[0].getBoundingClientRect();
  cards.forEach((el, k) => {
    const r = el.getBoundingClientRect();
    const dx = first.left - r.left, dy = first.top - r.top;
    const tilt = (k % 2 ? 1 : -1) * (3 + k * 1.5);
    el.animate([
      { transform: `translate(${dx}px, ${dy + 30}px) rotate(${tilt}deg) scale(.92)`, opacity: 0 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${tilt}deg) scale(.96)`, opacity: 1, offset: 0.25 },
      { transform: "translate(0, 0) rotate(0) scale(1)", opacity: 1 },
    ], { duration: 720, delay: k * 70, easing: TRAVEL, fill: "backwards" });
  });
  [...calendar].forEach((d, i) => d.animate(
    [{ transform: "scale(.3) translateY(10px)", opacity: 0 }, { transform: "scale(1) translateY(0)", opacity: 1 }],
    { duration: 420, delay: 200 + i * 35, easing: POP, fill: "backwards" }));
}
