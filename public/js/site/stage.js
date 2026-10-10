/**
 * stage.js — the hero's live demo.
 *
 * Cycles through every exercise. Each frame: pose the rig, measure it with
 * the app's scoring, and colour the whole figure by that live score — coral
 * at the top of a rep, green when the form is right. The glow behind the
 * figure and the readout card follow the same colour.
 *
 * Auto-advances between exercises until someone picks a tab, pauses when
 * scrolled out of view, and renders a still frame for reduced motion.
 *
 * The first time the page opens in a visit, the figure arrives the way the
 * trainer sees a person ("it finds you"): the tracked points pop in, the
 * bones join them up, then the grade colour floods in.
 */

import { build, blend } from "../figures/rig.js";
import { EXERCISES, GROUND } from "../figures/poses.js";
import { gradeColor, gradeLetter } from "../grade.js";
import { slide, EASE } from "../ui/motion.js";
import { angleMark, levelLine, coachNote } from "../figures/annotate.js";
import { keypoints } from "../figures/draw.js";

const NS = "http://www.w3.org/2000/svg";
const CYCLES = { squat: 2, pushup: 2, plank: 1, lunge: 2, jack: 5 };
const VIEW = { x: 0, y: 18, w: 600, h: 482 };

// What the coach notes at the bottom of each demo rep (the demo reps are
// good ones), and the body part the arrow points at.
const NOTES = {
  squat:  ["Thighs about parallel", "hip"],
  pushup: ["Elbows at 90°", "elbN"],
  plank:  ["One straight line, shoulders to ankles", "hip"],
  lunge:  ["Back knee nearly down", "kneeF"],
  jack:   ["Hands all the way up", "wriN"],
};

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
};
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const P = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

export function mountStage(root) {
  const svg = root.querySelector(".stage-svg");
  const card = {
    name:   root.querySelector("[data-r=name]"),
    score:  root.querySelector("[data-r=score]"),
    letter: root.querySelector("[data-r=letter]"),
    rows:   root.querySelector("[data-r=rows]"),
    marker: root.querySelector("[data-r=marker]"),
  };
  const tabs = [...root.querySelectorAll("[data-ex]")];

  // index.html ships a static figure so the box is never empty before (or
  // without) JavaScript. Clear it now that the live rig takes over.
  svg.replaceChildren();

  /* ── Build the SVG scene once ───────────────────────── */
  const defs = el("defs", {}, svg);
  const grad = el("radialGradient", { id: "stage-glow" }, defs);
  const stop0 = el("stop", { offset: "0%", "stop-opacity": ".55" }, grad);
  el("stop", { offset: "70%", "stop-opacity": "0", "stop-color": "#000" }, grad);

  const glow = el("ellipse", { cx: 300, cy: 340, rx: 270, ry: 210, fill: "url(#stage-glow)" }, svg);
  el("line", { x1: 30, y1: GROUND, x2: 570, y2: GROUND, class: "stage-floor" }, svg);
  // Faint tick marks on the floor read as a measuring scale.
  for (let x = 60; x <= 540; x += 40) el("line", { x1: x, y1: GROUND, x2: x, y2: GROUND + 8, class: "stage-tick" }, svg);

  const guide = el("line", { class: "stage-guide" }, svg);       // plank target line
  const far   = el("g", { class: "limb far" }, svg);
  const near  = el("g", { class: "limb near" }, svg);
  const marks = el("g", { class: "stage-marks" }, svg);           // protractor, parallel line
  const noteG = el("g", { class: "stage-note" }, svg);            // the coach's note (written once per rep)
  let marksHTML = "", noteOn = false, introActive = false;

  const farLeg  = el("polyline", {}, far);
  const farArm  = el("polyline", {}, far);
  const spine   = el("polyline", {}, near);
  const nearLeg = el("polyline", {}, near);
  const nearArm = el("polyline", {}, near);
  const girdles = el("polyline", {}, near);                       // front-view shoulders/hips
  const head    = el("circle", { r: 19, class: "head" }, near);
  const joints  = Array.from({ length: 8 }, () => el("circle", { r: 5.5, class: "joint" }, near));

  /* ── State ──────────────────────────────────────────── */
  let idx = 0, pinned = false, start = performance.now(), cycles = 0;
  let shown = 0;                  // smoothed score used for colour
  let visible = true, raf = null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function select(i, byUser) {
    const prev = idx;
    idx = (i + EXERCISES.length) % EXERCISES.length;
    // Next exercise: the figure slides in with a horizontal motion blur.
    if (idx !== prev) {
      const dir = idx > prev || (prev === EXERCISES.length - 1 && idx === 0) ? 1 : -1;
      slide(svg, { from: [dir * 80, 0], to: [0, 0], opacity: [0.2, 1], duration: 460, ease: EASE.out, strength: 1 });
      slide(card.name, { from: [dir * 30, 0], to: [0, 0], opacity: [0, 1], duration: 380, ease: EASE.out });
    }
    start = performance.now(); cycles = 0;
    noteG.replaceChildren(); noteOn = false;
    if (byUser) pinned = true;
    tabs.forEach((t, k) => t.setAttribute("aria-selected", String(k === idx)));
    card.name.textContent = EXERCISES[idx].name;
    if (reduced) draw(stillT());
  }

  tabs.forEach((t, k) => t.addEventListener("click", () => select(k, true)));
  root.addEventListener("keydown", (e) => {
    if (!tabs.includes(document.activeElement)) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      select(idx + (e.key === "ArrowRight" ? 1 : -1), true);
      tabs[idx].focus();
      e.preventDefault();
    }
  });

  // Still frames (reduced motion) show each exercise in its correct position.
  const stillT = () => (EXERCISES[idx].good === "top" ? 0 : 1);

  /* ── Draw one frame at rep-phase t (0 top … 1 bottom) ── */
  function draw(t, dt = 16) {
    const ex = EXERCISES[idx];
    const s = build(blend(ex.top, ex.bottom, t));
    const m = ex.measure(s);

    // Ease the colour toward the live score so it glides rather than flickers.
    const k = reduced ? 1 : 1 - Math.pow(0.001, dt / 1000);
    shown += (m.score - shown) * Math.min(1, k * 1.8);
    const c = gradeColor(shown);
    svg.style.setProperty("--live", c);
    root.style.setProperty("--live", c);
    root.closest(".hero")?.style.setProperty("--hero-live", c);
    stop0.setAttribute("stop-color", c);

    if (s.front) {
      // Front view: both legs and arms read equally; draw hips + shoulders as bars.
      far.classList.add("front");
      farLeg.setAttribute("points", [s.hpF, s.kneeF, s.ankF, s.toeF].map(P).join(" "));
      nearLeg.setAttribute("points", [s.hpN, s.kneeN, s.ankN, s.toeN].map(P).join(" "));
      farArm.setAttribute("points", [s.shF, s.elbF, s.wriF].map(P).join(" "));
      nearArm.setAttribute("points", [s.shN, s.elbN, s.wriN].map(P).join(" "));
      girdles.setAttribute("points", [s.shN, s.shF].map(P).join(" "));
      spine.setAttribute("points", [s.hpN, s.hpF, s.hip, s.neck].map(P).join(" "));
    } else {
      // Side view: far limbs sit behind the body, drawn fainter.
      far.classList.remove("front");
      farLeg.setAttribute("points", [s.hip, s.kneeF, s.ankF, s.toeF].map(P).join(" "));
      nearLeg.setAttribute("points", [s.hip, s.kneeN, s.ankN, s.toeN].map(P).join(" "));
      farArm.setAttribute("points", [s.neck, s.elbF, s.wriF].map(P).join(" "));
      nearArm.setAttribute("points", [s.neck, s.elbN, s.wriN].map(P).join(" "));
      girdles.setAttribute("points", "");
      spine.setAttribute("points", [s.hip, s.neck].map(P).join(" "));
    }
    head.setAttribute("cx", s.head[0].toFixed(1));
    head.setAttribute("cy", s.head[1].toFixed(1));

    const jp = s.front
      ? [s.kneeN, s.kneeF, s.ankN, s.ankF, s.elbN, s.elbF, s.wriN, s.wriF]
      : [s.neck, s.hip, s.kneeN, s.ankN, s.elbN, s.wriN, s.kneeF, s.elbF];
    joints.forEach((j, n) => { j.setAttribute("cx", jp[n][0].toFixed(1)); j.setAttribute("cy", jp[n][1].toFixed(1)); });

    // Drawing-board marks: a protractor on the measured joint (knee, elbow,
    // shoulder), squat parallel, and at the bottom of the rep a coach's note.
    const arcAt = {
      squat: [s.hip, s.kneeN, s.ankN], lunge: [s.hip, s.kneeN, s.ankN],
      pushup: [s.neck, s.elbN, s.wriN], jack: [s.hpN, s.shN, s.wriN],
    }[ex.id];
    let marked = arcAt ? angleMark(...arcAt) : "";
    if (ex.id === "squat" && t > 0.6) marked += levelLine(s.kneeN[1], s.kneeN[0] - 120, s.kneeN[0] + 70, "parallel");
    if (marked !== marksHTML) { marks.innerHTML = marked; marksHTML = marked; }
    // The note is written once, when the rep reaches the bottom (always, for the plank).
    const wantNote = ex.id === "plank" || t >= 0.999 || (noteOn && t > 0.85);
    if (wantNote && !noteOn) {
      const [text, at] = NOTES[ex.id];
      noteG.innerHTML = coachNote(s[at], text, { view: VIEW, pts: Object.values(s).filter(Array.isArray), tone: "good", write: true });
      noteOn = true;
    } else if (!wantNote && noteOn) { noteG.replaceChildren(); noteOn = false; }

    if (ex.id === "plank") {
      guide.setAttribute("x1", s.neck[0]); guide.setAttribute("y1", s.neck[1]);
      guide.setAttribute("x2", s.ankN[0]); guide.setAttribute("y2", s.ankN[1]);
      guide.style.display = "";
    } else guide.style.display = "none";

    // Readout card
    const sc = Math.round(m.score);
    card.score.textContent = sc;
    card.letter.textContent = gradeLetter(sc);
    card.marker.style.left = `${Math.max(0, Math.min(100, sc))}%`;
    const html = m.rows.map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("");
    if (card.rows.innerHTML !== html) card.rows.innerHTML = html;
  }

  /* ── Animation loop ─────────────────────────────────── */
  let last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || introActive) { last = now; start = now; return; }
    const dt = now - last; last = now;
    const ex = EXERCISES[idx];
    const [dn, hold, up, rest] = ex.timing;
    const total = dn + hold + up + rest;
    const e = now - start;
    const c = Math.floor(e / total);
    if (c !== cycles) {
      cycles = c;
      if (!pinned && cycles >= (CYCLES[ex.id] ?? 2)) { select(idx + 1, false); return; }
    }
    const p = e % total;
    const t = p < dn ? ease(p / dn)
            : p < dn + hold ? 1
            : p < dn + hold + up ? 1 - ease((p - dn - hold) / up)
            : 0;
    draw(t, dt);
  }

  /* ── "It finds you" ───────────────────────────────────── */
  // Once per visit, only if the hero is on screen. Each step is also timed
  // with setTimeout, so the figure always ends up fully drawn even if the
  // browser skips the animations.
  function playIntro() {
    const ex = EXERCISES[idx];
    const s = build(blend(ex.top, ex.bottom, 0));
    draw(0);
    introActive = true;
    const limbs = [spine, nearLeg, farLeg, nearArm, farArm, girdles];
    const anims = [];
    const go = (node, frames, opts) => { if (node.animate) anims.push(node.animate(frames, { fill: "both", ...opts })); };
    svg.style.setProperty("--live", "#eef1fb");
    svg.classList.add("intro");
    marks.style.opacity = "0";

    // 1. The tracked points pop in, one after another.
    const dots = el("g", { class: "intro-dots" }, svg);
    const pts = keypoints(s);
    pts.forEach((p, i) => {
      const dot = el("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: i >= pts.length - 5 ? 2.6 : 5.2 }, dots);
      go(dot, [{ opacity: 0, transform: "scale(.2)" }, { opacity: 1, transform: "scale(1)" }],
        { duration: 240, delay: i * 18, easing: "cubic-bezier(.2,.9,.3,1.35)" });
    });
    // 2. The bones join them up.
    const T1 = 380;
    limbs.forEach((l, k) => {
      l.setAttribute("pathLength", "1");
      go(l, [{ strokeDasharray: "1 1", strokeDashoffset: 1 }, { strokeDasharray: "1 1", strokeDashoffset: 0 }],
        { duration: 420, delay: T1 + k * 55, easing: "cubic-bezier(.22,.61,.36,1)" });
    });
    go(head, [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)" }],
      { duration: 320, delay: T1 + 220, easing: "cubic-bezier(.2,.9,.3,1.3)" });
    joints.forEach((j) => go(j, [{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "forwards" }));
    go(glow, [{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "forwards" });    // the glow comes with the colour

    // 3. The grade colour floods in; the points hand over to the joints.
    const T2 = T1 + 720;
    setTimeout(() => {
      svg.classList.add("intro-color");
      svg.style.removeProperty("--live");
      draw(0);
      go(dots, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: "ease-out" });
      go(glow, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: "ease-out" });
    }, T2);
    setTimeout(() => {
      anims.forEach((a) => a.cancel());
      limbs.forEach((l) => l.removeAttribute("pathLength"));
      dots.remove();
      marks.style.opacity = "";
      svg.classList.remove("intro", "intro-color");
      introActive = false;
    }, T2 + 520);
  }

  select(0, false);
  if (reduced) { draw(stillT()); return; }

  let firstVisit = true;
  try { firstVisit = !sessionStorage.getItem("vf-intro-seen"); sessionStorage.setItem("vf-intro-seen", "1"); } catch { /* storage blocked: play it */ }
  const onScreen = root.getBoundingClientRect().bottom > 0 && root.getBoundingClientRect().top < innerHeight;
  if (firstVisit && onScreen) playIntro();

  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.05 }).observe(root);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; });
  raf = requestAnimationFrame(frame);
}
