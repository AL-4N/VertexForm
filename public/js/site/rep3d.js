/**
 * rep3d.js — the homepage's 3D view: a squat you can turn around.
 *
 * Plays a squat clip (js/figures/scene3d.js) and colours each rep by the
 * score the real engine gave it. The readout puts the 3D knee angle next to
 * the one a flat picture from the current view would give, which is the
 * point: turn the view and the flat angle drifts, the 3D one doesn't.
 *
 * Drag to orbit (mouse: both axes; touch: sideways only, so the page still
 * scrolls), or use the view buttons, which swing there on a spring. Arrow
 * keys turn it too. Plays only while on screen; reduced motion starts
 * paused at the bottom of a rep and every move jumps to its end.
 */

import { gradeColor, gradeLetter } from "../grade.js";
import { spring, reducedMotion } from "../ui/motion.js";
import { glide } from "../ui/segmented.js";
import { Scene, loadClips, frameAt, repAt, deepestT, clamp } from "../figures/scene3d.js";

const VIEWS = {
  webcam: { yaw: 0, pitch: 6 },
  turned: { yaw: 38, pitch: 16 },
  front:  { yaw: 90, pitch: 8 },
  top:    { yaw: 20, pitch: 78 },
};

export async function mountRep3d(root) {
  const canvas = root.querySelector(".r3-canvas");
  const ui = Object.fromEntries([...root.querySelectorAll("[data-3]")].map((n) => [n.dataset["3"], n]));
  const clipBtns = [...root.querySelectorAll("[data-clip]")];
  const viewBtns = [...root.querySelectorAll("[data-view]")];

  let all;
  try { all = await loadClips(); }
  catch {
    ui.status.textContent = "The 3D clip didn't load. Reload the page to try again.";
    ui.status.hidden = false;
    return;
  }
  ui.status.hidden = true;
  root.classList.add("ready");
  const clips = { full: all.full, half: all.half };

  const scene = new Scene(canvas, { target: [0, 0.68, 0], zoom: 1.55 });
  const st = {
    clip: clips.full,
    t: 0, playing: !reducedMotion(), last: 0,
    yaw: VIEWS.turned.yaw, pitch: VIEWS.turned.pitch,
    vYaw: 0, drag: null, stops: [],
    visible: false, raf: 0,
  };

  // Reduced motion: start at the bottom of the second rep, paused.
  if (!st.playing) st.t = deepestT(st.clip, 1);

  function draw() {
    scene.fit();
    const cam = scene.camera(st.yaw, st.pitch);
    const clip = st.clip;
    const P = frameAt(clip, st.t);
    const n = repAt(clip, st.t), rep = clip.reps[n];
    const colour = gradeColor(rep.score);
    const [a, b, c] = clip.measure.joints(clip.side).map((k) => P[k]);

    scene.begin();
    scene.floor(cam);
    scene.figure(cam, P, colour);
    const k3 = scene.angle(cam, a, b, c);
    const flat = scene.flatAngle(cam, a, b, c);

    root.style.setProperty("--r3", colour);
    ui.rep.textContent = `${n + 1} of ${clip.reps.length}`;
    ui.score.textContent = `${rep.score} ${gradeLetter(rep.score)}`;
    ui.k3.textContent = `${Math.round(k3)}°`;
    ui.k2.textContent = `${Math.round(flat)}°`;
    ui.diff.textContent = `${Math.round(Math.abs(flat - k3))}° off`;
    const yaw = ((Math.round(st.yaw) % 360) + 540) % 360 - 180;
    ui.view.textContent = `VIEW ${yaw}° FROM WEBCAM · ${Math.round(st.pitch)}° UP`;
    ui.scrub.value = String(Math.round(st.t));
  }

  /* ── Loop: runs while on screen and something is moving ── */
  function tick(now) {
    st.raf = 0;
    const dt = st.last ? Math.min(50, now - st.last) : 16;
    st.last = now;
    if (st.playing) st.t = (st.t + dt) % st.clip.dur;
    if (!st.drag && Math.abs(st.vYaw) > 0.002) {        // coast after a flick
      st.yaw += st.vYaw * dt;
      st.vYaw *= Math.pow(0.0045, dt / 1000);
    } else if (!st.drag) st.vYaw = 0;
    draw();
    if (st.visible && (st.playing || st.drag || st.vYaw || st.stops.length)) want();
    else st.last = 0;
  }
  function want() { if (!st.raf) st.raf = requestAnimationFrame(tick); }
  const redraw = () => { if (!st.raf) draw(); };

  new ResizeObserver(redraw).observe(canvas);
  new IntersectionObserver(([e]) => { st.visible = e.isIntersecting; if (st.visible) want(); }, { rootMargin: "100px" }).observe(canvas);

  /* ── Views (spring there, like a needle settling) ───── */
  function stopSprings() { st.stops.forEach((s) => s()); st.stops = []; }
  function goTo(view) {
    stopSprings();
    st.vYaw = 0;
    // Take the short way round.
    const to = VIEWS[view];
    st.yaw = to.yaw + ((((st.yaw - to.yaw) % 360) + 540) % 360 - 180);
    let left = 2;
    const done = () => { if (--left === 0) st.stops = []; };
    const opts = { stiffness: 120, damping: 15, precision: 0.05 };
    st.stops = [
      spring(st.yaw, to.yaw, (v) => { st.yaw = v; if (v === to.yaw) done(); redraw(); }, opts),
      spring(st.pitch, to.pitch, (v) => { st.pitch = v; if (v === to.pitch) done(); redraw(); }, opts),
    ];
    want();
  }
  const press = (btns, on) => btns.forEach((b) => b.setAttribute("aria-pressed", String(b === on)));
  viewBtns.forEach((b) => b.addEventListener("click", () => { press(viewBtns, b); goTo(b.dataset.view); }));
  clipBtns.forEach((b) => b.addEventListener("click", () => {
    press(clipBtns, b);
    // Same moment of the other clip, so you compare like with like.
    st.clip = clips[b.dataset.clip];
    st.t = Math.min(st.t, st.clip.dur);
    markers();
    redraw();
  }));
  glide(root.querySelector(".r3-views"));
  glide(root.querySelector(".r3-clips"));

  /* ── Dragging ───────────────────────────────────────── */
  canvas.addEventListener("pointerdown", (e) => {
    stopSprings();
    st.drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, touch: e.pointerType === "touch" };
    st.vYaw = 0;
    canvas.setPointerCapture(e.pointerId);
    root.classList.add("dragging");
    press(viewBtns, null);
    want();
  });
  canvas.addEventListener("pointermove", (e) => {
    const d = st.drag;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, dt = Math.max(1, e.timeStamp - d.t);
    st.yaw -= dx * 0.45;
    if (!d.touch) st.pitch = clamp(st.pitch + dy * 0.35, 2, 82);
    st.vYaw = (-dx * 0.45) / dt * 0.6 + st.vYaw * 0.4;
    d.x = e.clientX; d.y = e.clientY; d.t = e.timeStamp;
  });
  const end = (e) => {
    if (!st.drag) return;
    if (e.timeStamp - st.drag.t > 80) st.vYaw = 0;      // held still before letting go: no coast
    if (reducedMotion()) st.vYaw = 0;
    st.drag = null;
    root.classList.remove("dragging");
    want();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("dblclick", () => { const b = viewBtns.find((x) => x.dataset.view === "turned"); press(viewBtns, b); goTo("turned"); });

  // Keyboard extras: arrows turn the view, space plays and pauses.
  canvas.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: [15, 0], ArrowRight: [-15, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
    if (e.key === " ") { e.preventDefault(); togglePlay(); return; }
    if (!step) return;
    e.preventDefault();
    stopSprings();
    press(viewBtns, null);
    const yaw = st.yaw + step[0], pitch = clamp(st.pitch + step[1], 2, 82);
    st.stops = [
      spring(st.yaw, yaw, (v) => { st.yaw = v; redraw(); }),
      spring(st.pitch, pitch, (v) => { st.pitch = v; redraw(); }),
    ];
    setTimeout(() => { st.stops = []; }, 900);
    want();
  });

  /* ── Timeline ───────────────────────────────────────── */
  const scrub = ui.scrub;
  function markers() {
    const clip = st.clip;
    scrub.max = String(clip.dur);
    ui.marks.replaceChildren(...clip.reps.map((r, i) => {
      const m = document.createElement("span");
      m.className = "r3-mark";
      m.style.left = `${(r.t / clip.dur) * 100}%`;
      m.style.setProperty("--c", gradeColor(r.score));
      m.textContent = String(r.score);
      m.title = `Rep ${i + 1}: ${r.score}${r.faults.length ? `, ${r.faults.join(", ")}` : ""}`;
      return m;
    }));
  }
  markers();
  scrub.addEventListener("input", () => { st.t = Number(scrub.value); setPlaying(false); redraw(); });

  function setPlaying(on) {
    st.playing = on;
    ui.play.setAttribute("aria-pressed", String(on));
    ui.play.setAttribute("aria-label", on ? "Pause" : "Play");
    if (on) want();
  }
  function togglePlay() { setPlaying(!st.playing); }
  ui.play.addEventListener("click", togglePlay);
  setPlaying(st.playing);

  draw();
}
