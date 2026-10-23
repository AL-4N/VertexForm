/**
 * hero3d.js — the homepage hero: a person doing each exercise in 3D,
 * filling the whole hero, that you can look around.
 *
 * The clips are simulated people with 3D world landmarks, scored by the
 * real engine (js/figures/scene3d.js, tools/make-rep3d.mjs). The figure is
 * paper white while a rep is under way; when the engine's rep event comes,
 * the score counts up the grade scale, the figure takes that grade's
 * colour and the coach's note is penned in beside the body part.
 *
 * Moving the pointer over the hero steers the camera a little (the scene
 * leans toward the pointer); dragging spins it, with momentum. Touch:
 * sideways drags spin it and the page still scrolls. The exercise buttons
 * switch clips (the camera glides to frame the new one); otherwise it moves
 * on to the next exercise after each clip.
 *
 * "It finds you": the first time the hero opens in a visit, the tracked
 * points pop in, then the bones grow out between them. Switching exercise
 * replays a quicker version.
 *
 * Plays only while on screen. Reduced motion: a still frame at the bottom
 * of the first rep, coloured by its score; buttons switch still frames.
 */

import { gradeColor, gradeLetter } from "../grade.js";
import { reducedMotion } from "../ui/motion.js";
import { Scene, loadClips, frameAt, doneAt, deepestT, mixColor, clamp, smooth } from "../figures/scene3d.js";

const ORDER = ["full", "pushup", "plank", "lunge", "jack"];
const TAB_FOR = { full: "squat", pushup: "pushup", plank: "plank", lunge: "lunge", jack: "jack" };
const NAME = { full: "Squat", pushup: "Push-up", plank: "Plank", lunge: "Lunge", jack: "Jumping jack" };
// The coach's note after each graded rep (the demo reps are good ones), and
// the body part the arrow points at ("other" = the leg the readout doesn't measure).
const NOTES = {
  full:   ["Thighs about parallel", "hip"],
  pushup: ["Elbows at 90°", "el"],
  plank:  ["One straight line, shoulders to ankles", "hip"],
  lunge:  ["Back knee nearly down", "kn", "other"],
  jack:   ["Hands all the way up", "wr"],
};
const PAPER = "#eef1fb";
const BASE = { yaw: 32, pitch: 12 };

/** Where to point the camera and how far back to stand so the whole clip fits. */
function framing(clip) {
  let x0 = Infinity, x1 = -Infinity, y1 = 0, z0 = Infinity, z1 = -Infinity;
  for (const f of clip.frames) for (const k in f) {
    const [x, y, z] = f[k];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const extent = Math.max(y1, x1 - x0, z1 - z0);
  return { target: [(x0 + x1) / 2, Math.max(0.35, y1 * 0.45), (z0 + z1) / 2], dist: Math.max(3.4, extent * 2.15) };
}

export async function mountHero3d(root) {
  const canvas = root.querySelector(".hero-canvas");
  const hero = root.closest(".hero") ?? root;
  const card = Object.fromEntries([...hero.querySelectorAll("[data-r]")].map((n) => [n.dataset.r, n]));
  const tabs = [...hero.querySelectorAll("[data-ex]")];
  const view = hero.querySelector("[data-hero-view]");

  let clips;
  try { clips = await loadClips(); }
  catch { return; }                                         // the static figure stays
  hero.classList.add("hero-3d");

  const reduced = reducedMotion();
  const wide = () => matchMedia("(min-width: 1000px)").matches;
  const scene = new Scene(canvas, { at: [0.5, 0.5], zoom: 1.0, ring: 0.8, maxDpr: 1.25 });
  // The body in real 3D (Three.js, figures/figure-gl.js) where WebGL works:
  // the floor stays on this canvas, the lit body goes on a WebGL canvas
  // above it, and the marks (points, protractor, notes) on a third canvas
  // on top, all through the same camera. Until it loads, or without WebGL,
  // the flat-shaded 2D figure draws instead.
  let gl = null, marks = scene;
  import("../figures/figure-gl.js").then(({ GLFigure }) => {
    const glCanvas = document.createElement("canvas"), top = document.createElement("canvas");
    glCanvas.className = top.className = "hero-layer";
    glCanvas.setAttribute("aria-hidden", "true"); top.setAttribute("aria-hidden", "true");
    canvas.after(glCanvas, top);
    gl = new GLFigure(glCanvas);
    marks = new Scene(top, { ring: 0.8, maxDpr: 1.25 });
    hero.classList.add("hero-gl");
    if (reduced) draw();
  }).catch(() => { /* no WebGL: keep the 2D figure */ });
  const st = {
    id: "full", t: 0, last: 0, raf: 0, visible: true, pinned: false,
    yaw: BASE.yaw, pitch: BASE.pitch, aimYaw: 0, aimPitch: 0, spin: 0, vSpin: 0, drag: null,
    target: null, dist: 3.7, intro: null, colour: PAPER, from: PAPER, flood: 1, done: -1,
    count: null,
  };
  const frames = Object.fromEntries(ORDER.map((id) => [id, framing(clips[id])]));
  Object.assign(st, { target: frames.full.target.slice(), dist: frames.full.dist });

  /* ── Readout ────────────────────────────────────────── */
  function readout(clip, P, n, a3) {
    card.name.textContent = NAME[st.id];
    const rows = [[clip.measure.label, `${Math.round(a3)}°`]];
    if (clip.kind === "hold") rows.push(["Held", `${Math.floor(st.t / 1000)} s`]);
    else rows.push(["Rep", `${Math.min(n + (reduced ? 1 : 2), clip.reps.length)} of ${clip.reps.length}`]);   // the rep under way (the still: the graded one)
    const html = rows.map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("");
    if (card.rows.innerHTML !== html) card.rows.innerHTML = html;
  }
  function showScore(score, animate) {
    st.count?.();
    const set = (v) => {
      const s = Math.round(v);
      card.score.textContent = String(s);
      card.letter.textContent = gradeLetter(s);
      card.score.style.color = gradeColor(s);
      card.marker.style.left = `${clamp(s, 0, 100)}%`;
    };
    if (!animate) { set(score); return; }
    // Count up the scale: the number climbs from 0 through each grade colour.
    let start = 0;
    const step = (now) => {
      start ||= now;
      const k = clamp((now - start) / 650, 0, 1);
      set(score * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf2 = requestAnimationFrame(step);
    };
    let raf2 = requestAnimationFrame(step);
    st.count = () => cancelAnimationFrame(raf2);
  }
  function clearScore() {
    st.count?.();
    card.score.textContent = "–";
    card.letter.textContent = "";
    card.score.style.color = "";
    card.marker.style.left = "0%";
  }

  /* ── Draw ───────────────────────────────────────────── */
  function draw(now = performance.now()) {
    if (scene.fit()) { scene.at = wide() ? [0.7, 0.4] : [0.5, 0.5]; scene.zoom = wide() ? 0.88 : 1.6; }
    const clip = clips[st.id];
    Object.assign(scene, { target: st.target, dist: st.dist });
    if (marks !== scene) { marks.fit(); Object.assign(marks, { at: scene.at, zoom: scene.zoom, target: st.target, dist: st.dist }); }
    const cam = scene.camera(st.yaw + st.aimYaw + st.spin, clamp(st.pitch + st.aimPitch, 2, 60));
    const P = frameAt(clip, st.t);
    // The reduced-motion still sits at the bottom of rep 1 and shows that rep's score.
    const n = reduced ? 0 : doneAt(clip, st.t);

    // A new graded rep: flood its colour in, count the score up, pen the note.
    if (n !== st.done) {
      st.done = n;
      if (n >= 0) {
        st.from = st.colour; st.flood = 0;
        showScore(clip.reps[n].score, !reduced);
      } else { st.from = st.colour; st.flood = 0; clearScore(); }
    }
    const goal = n >= 0 ? gradeColor(clip.reps[n].score) : PAPER;
    st.colour = mixColor(st.from, goal, st.flood);
    hero.style.setProperty("--hero-live", st.colour);

    // The intro: points, then bones.
    let dots = 1, grow = 1;
    if (st.intro) {
      const e = now - st.intro.at, { pts, bones } = st.intro;
      dots = clamp(e / pts, 0, 1);
      grow = smooth(pts * 0.75, pts * 0.75 + bones, e);
      if (e > pts * 0.75 + bones) st.intro = null;
    }

    // With the WebGL body, this canvas only holds the floor: repaint it only
    // when the camera has actually moved (most frames it hasn't).
    const camKey = gl ? [st.yaw + st.aimYaw + st.spin, st.pitch + st.aimPitch, st.dist, ...st.target, scene.w, scene.h].map((v) => v.toFixed(2)).join() : null;
    if (!gl || camKey !== st.floorKey) {
      st.floorKey = camKey;
      scene.begin();
      scene.floor(cam, { size: 9 });
    }
    if (gl) {
      gl.render(scene, cam, P, st.colour, { grow });
      marks.begin();
      if (grow < 1) marks.points(cam, P, dots);
    } else scene.figure(cam, P, st.colour, { grow, dots });
    const [a, b, c] = clip.measure.joints(clip.side).map((k) => P[k]);
    const a3 = marks.angle(cam, a, b, c, { alpha: grow >= 1 ? 1 : 0 });

    // The note: penned in after a graded rep, gone before the next one ends.
    if (n >= 0 && grow >= 1) {
      const since = st.t - clip.reps[n].t;
      const [text, joint, which] = NOTES[st.id];
      const s = which === "other" ? (clip.side === "L" ? "R" : "L") : clip.side;
      if (since >= 0 && since < 2200) marks.note(cam, P[joint + s], text, { write: reduced ? 1 : clamp(since / 900, 0, 1), side: 1 });
    }

    readout(clip, P, n, a3);
    if (view) {
      const yaw = ((Math.round(st.yaw + st.aimYaw + st.spin) % 360) + 540) % 360 - 180;
      view.textContent = `VIEW ${yaw}° FROM WEBCAM`;
    }
  }

  /* ── Loop ───────────────────────────────────────────── */
  function tick(now) {
    st.raf = 0;
    const dt = st.last ? Math.min(50, now - st.last) : 16;
    st.last = now;
    const clip = clips[st.id];
    st.t += dt;
    if (st.t >= clip.dur) {
      st.t = 0; st.done = -2;
      if (!st.pinned) { select(ORDER[(ORDER.indexOf(st.id) + 1) % ORDER.length], false); }
    }
    // Ease toward the pointer, the new clip's framing, and the flooding colour.
    const k = 1 - Math.pow(0.004, dt / 1000);
    const g = frames[st.id];
    st.target = st.target.map((v, i) => v + (g.target[i] - v) * k);
    st.dist += (g.dist - st.dist) * k;
    st.aimYaw += ((st.aim?.[0] ?? 0) - st.aimYaw) * k;
    st.aimPitch += ((st.aim?.[1] ?? 0) - st.aimPitch) * k;
    st.flood = Math.min(1, st.flood + dt / 450);
    if (!st.drag && Math.abs(st.vSpin) > 0.002) {
      st.spin += st.vSpin * dt;
      st.vSpin *= Math.pow(0.004, dt / 1000);
    }
    draw(now);
    if (st.visible && !document.hidden) want();
    else st.last = 0;
  }
  function want() { if (!st.raf && !reduced) st.raf = requestAnimationFrame(tick); }

  /* ── Exercises ──────────────────────────────────────── */
  function select(id, byUser) {
    st.id = id;
    st.t = 0; st.done = -2;
    if (byUser) st.pinned = true;
    // Picking an exercise whips the camera round about 100° and lets it
    // coast to a stop while the new figure is found and drawn.
    if (byUser && !reduced) st.vSpin = 0.55;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.ex === TAB_FOR[id])));
    if (reduced) {
      // A still: the bottom of the first rep, in that rep's colour.
      const clip = clips[id];
      Object.assign(st, frames[id]);
      st.target = frames[id].target.slice();
      st.t = clip.kind === "hold" ? clip.reps[0].t : deepestT(clip, 0);
      st.colour = st.from = gradeColor(clip.reps[0].score); st.flood = 1; st.done = 0;
      showScore(clip.reps[0].score, false);
      draw();
      return;
    }
    st.intro = { at: performance.now(), pts: 320, bones: 380 };
    st.colour = st.from = PAPER; st.flood = 1;
    clearScore();
  }
  tabs.forEach((t) => t.addEventListener("click", () => select(ORDER.find((id) => TAB_FOR[id] === t.dataset.ex), true)));
  hero.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0 || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    const j = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[j].focus(); tabs[j].click();
    e.preventDefault();
  });

  /* ── Looking around ─────────────────────────────────── */
  if (!reduced) {
    hero.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || st.drag) return;
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      st.aim = [-x * 50, -y * 16];
    });
    hero.addEventListener("pointerleave", () => { st.aim = [0, 0]; });
    canvas.addEventListener("pointerdown", (e) => {
      st.drag = { x: e.clientX, t: e.timeStamp };
      st.vSpin = 0;
      canvas.setPointerCapture(e.pointerId);
      hero.classList.add("dragging");
    });
    canvas.addEventListener("pointermove", (e) => {
      const d = st.drag;
      if (!d) return;
      const dx = e.clientX - d.x, dt = Math.max(1, e.timeStamp - d.t);
      st.spin -= dx * 0.4;
      st.vSpin = ((-dx * 0.4) / dt) * 0.6 + st.vSpin * 0.4;
      d.x = e.clientX; d.t = e.timeStamp;
    });
    const end = (e) => {
      if (!st.drag) return;
      if (e.timeStamp - st.drag.t > 80) st.vSpin = 0;
      st.drag = null;
      hero.classList.remove("dragging");
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("dblclick", () => { st.spin = 0; st.vSpin = 0; });
  }

  new ResizeObserver(() => { if (reduced) draw(); }).observe(canvas);
  new IntersectionObserver(([e]) => { st.visible = e.isIntersecting; if (st.visible) want(); }, { threshold: 0.02 }).observe(hero);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) want(); });

  select("full", false);
  if (!reduced) {
    // The full "it finds you" only on the first view of the visit.
    let first = true;
    try { first = !sessionStorage.getItem("vf-intro-seen"); sessionStorage.setItem("vf-intro-seen", "1"); } catch { /* storage blocked: play it */ }
    st.intro = first ? { at: performance.now() + 150, pts: 700, bones: 650 } : { at: performance.now(), pts: 300, bones: 350 };
  }
  hero.classList.add("ready");
  want();
}
