/**
 * expop.js — each exercise card opens into a popup with that exercise in
 * 3D (js/figures/scene3d.js): drag to turn it, a protractor on the joint
 * the trainer measures, and the clip's reps coloured by the scores the
 * real engine gave them. The words come from the card itself (what it
 * measures, what it flags) and from the trainer's own setup tips
 * (config.js DEMO_TIPS), so the popup never says anything the card doesn't.
 *
 * The popup grows out of the card and shrinks back into it (ui/popup.js).
 * As it opens, the card's flat figure flies into the popup and lands on
 * the 3D figure, which waits in the same pose seen straight from the side
 * (the webcam's view), so the two line up. The flat one dissolves into it,
 * then the camera swings round, the floor and protractor fade in, and it
 * starts moving: the drawing becomes the 3D model.
 */

import { gradeColor, gradeLetter } from "../grade.js";
import { DEMO_TIPS } from "../config.js";
import { openPopup } from "../ui/popup.js";
import { reducedMotion, tween, EASE } from "../ui/motion.js";
import { Scene, loadClips, frameAt, repAt, deepestT, clamp } from "../figures/scene3d.js";

const CLIP_FOR = { squat: "full", pushup: "pushup", plank: "plank", lunge: "lunge", jack: "jack" };
const TIPS_FOR = { squat: "Squat", pushup: "Push-up", plank: "Plank", lunge: "Lunge", jack: "Jumping Jack" };

export function mountExercisePopups(grid, dlg) {
  if (!grid || !dlg) return;
  const x = Object.fromEntries([...dlg.querySelectorAll("[data-x]")].map((n) => [n.dataset.x, n]));
  const canvas = dlg.querySelector(".ex-pop-canvas");
  const scene = new Scene(canvas, { zoom: 1.45 });
  const st = { clip: null, t: 0, last: 0, raf: 0, yaw: 34, pitch: 12, vYaw: 0, drag: null, playing: true, show: 1, floor: 1, run: 0 };

  function framing(clip) {
    let x0 = Infinity, x1 = -Infinity, y1 = 0;
    for (const f of clip.frames) for (const k in f) { x0 = Math.min(x0, f[k][0]); x1 = Math.max(x1, f[k][0]); y1 = Math.max(y1, f[k][1]); }
    scene.target = [(x0 + x1) / 2, Math.max(0.35, y1 * 0.45), 0];
    scene.dist = Math.max(3.2, Math.max(y1, x1 - x0) * 2.1);
  }

  function draw() {
    const clip = st.clip;
    if (!clip) return;
    scene.fit();
    const cam = scene.camera(st.yaw, st.pitch);
    const P = frameAt(clip, st.t);
    const rep = clip.reps[repAt(clip, st.t)];
    scene.begin();
    if (st.floor > 0) scene.floor(cam, { alpha: st.floor });
    if (st.show > 0) scene.figure(cam, P, gradeColor(rep.score), { alpha: st.show, shadow: st.floor > 0.3 });
    scene.angle(cam, ...clip.measure.joints(clip.side).map((k) => P[k]), { alpha: st.floor * st.show });
  }

  /** The 3D figure's outline on screen, for the flat figure to land on. */
  function figureBox() {
    scene.fit();
    const cam = scene.camera(st.yaw, st.pitch);
    const P = frameAt(st.clip, st.t);
    const c = canvas.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k in P) { const [x, y] = scene.proj(cam, P[k]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const pad = 14;                                  // the head's radius and the limbs' width
    return { left: c.left + x0 - pad, top: c.top + y0 - pad, width: x1 - x0 + pad * 2, height: y1 - y0 + pad * 2 };
  }

  /** Card figure → 3D figure (see the top of this file). */
  async function becomeModel(card, run) {
    const c = st.clip;
    const from = card.querySelector(".picto svg");
    const end = { yaw: c.front ? 24 : 34, pitch: 12 };
    if (!from) { Object.assign(st, end, { show: 1, floor: 1, playing: true }); return; }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (run !== st.run) return;
    const a = from.getBoundingClientRect(), b = figureBox();
    // The flat figure's drawing fits its box by height (its own aspect), so aim it the same way.
    const fly = document.createElement("div");
    fly.className = "ex-pop-fly picto";
    fly.setAttribute("aria-hidden", "true");
    fly.innerHTML = from.outerHTML;
    dlg.appendChild(fly);
    const box = (r) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    const TRAVEL = "cubic-bezier(.65,0,.2,1)";
    await fly.animate([box(a), box(b)], { duration: 780, easing: TRAVEL, fill: "forwards" }).finished.catch(() => {});
    if (run !== st.run) { fly.remove(); return; }
    // Dissolve the flat drawing into the model…
    tween(0, 1, (v) => { st.show = v; if (!st.raf) draw(); }, { duration: 320 });
    await fly.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(3px)" }], { duration: 360, easing: "ease-out", fill: "forwards" }).finished.catch(() => {});
    fly.remove();
    if (run !== st.run) return;
    // …then turn it round into 3D, the floor coming up as it turns.
    const y0 = st.yaw, p0 = st.pitch;
    tween(0, 1, (k) => {
      st.yaw = y0 + (end.yaw - y0) * k; st.pitch = p0 + (end.pitch - p0) * k; st.floor = k;
      if (k >= 1) st.playing = true;
    }, { duration: 1300, ease: EASE.inOut });
  }
  function tick(now) {
    st.raf = 0;
    const dt = st.last ? Math.min(50, now - st.last) : 16;
    st.last = now;
    if (st.playing) st.t = (st.t + dt) % st.clip.dur;
    if (!st.drag && Math.abs(st.vYaw) > 0.002) { st.yaw += st.vYaw * dt; st.vYaw *= Math.pow(0.0045, dt / 1000); }
    draw();
    if (dlg.open) st.raf = requestAnimationFrame(tick);
    else st.last = 0;
  }

  async function open(card) {
    const id = card.querySelector("[data-picto]")?.dataset.picto;
    let clips;
    try { clips = await loadClips(); } catch { clips = null; }
    x.name.textContent = card.querySelector("h3").textContent;
    x.tag.textContent = card.querySelector(".tag")?.textContent ?? "";
    x.measures.textContent = card.querySelector(".ex-measures").textContent.trim();
    x.flags.textContent = card.querySelector(".ex-flags").textContent.replace(/^Flags:\s*/, "").trim();
    x.tips.replaceChildren(...(DEMO_TIPS[TIPS_FOR[id]] ?? []).map((t) => Object.assign(document.createElement("li"), { textContent: t })));
    st.clip = clips?.[CLIP_FOR[id]] ?? null;
    dlg.classList.toggle("no-3d", !st.clip);
    if (st.clip) {
      const c = st.clip;
      x.label.textContent = c.measure.label;
      x.reps.replaceChildren(...c.reps.map((r, i) => {
        const b = document.createElement("span");
        b.className = "ex-pop-rep";
        b.style.setProperty("--c", gradeColor(r.score));
        b.innerHTML = `<b>${r.score}</b> ${gradeLetter(r.score)}<small>${c.kind === "hold" ? `${(i + 1) * 5} s held` : `rep ${i + 1}`}</small>`;
        return b;
      }));
      framing(c);
      st.vYaw = 0;
      // Start in the card's pose (the bottom of a rep), seen from the side.
      st.t = c.kind === "hold" ? c.reps[0].t : deepestT(c, 0);
      if (reducedMotion()) Object.assign(st, { yaw: c.front ? 24 : 34, pitch: 12, show: 1, floor: 1, playing: false });
      else Object.assign(st, { yaw: 0, pitch: 0, show: 0, floor: 0, playing: false });
    }
    const run = ++st.run;
    openPopup(dlg, card, { onClose: () => { st.run++; dlg.querySelectorAll(".ex-pop-fly").forEach((f) => f.remove()); } });
    if (st.clip) {
      draw();
      if (!reducedMotion()) { st.raf ||= requestAnimationFrame(tick); becomeModel(card, run); }
    }
  }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".ex-card");
    if (card) open(card);
  });

  canvas.addEventListener("pointerdown", (e) => {
    st.drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, touch: e.pointerType === "touch" };
    st.vYaw = 0;
    Object.assign(st, { show: 1, floor: 1, playing: true });       // grabbing it mid-intro: skip to the 3D
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const d = st.drag;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, dt = Math.max(1, e.timeStamp - d.t);
    st.yaw -= dx * 0.45;
    if (!d.touch) st.pitch = clamp(st.pitch + dy * 0.35, 2, 80);
    st.vYaw = ((-dx * 0.45) / dt) * 0.6 + st.vYaw * 0.4;
    d.x = e.clientX; d.y = e.clientY; d.t = e.timeStamp;
    if (reducedMotion()) draw();
  });
  const end = (e) => { if (st.drag && e.timeStamp - st.drag.t > 80) st.vYaw = 0; st.drag = null; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}
