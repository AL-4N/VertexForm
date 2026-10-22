/**
 * expop.js — each exercise card opens into a popup with that exercise in
 * 3D (js/figures/scene3d.js): drag to turn it, a protractor on the joint
 * the trainer measures, and the clip's reps coloured by the scores the
 * real engine gave them. The words come from the card itself (what it
 * measures, what it flags) and from the trainer's own setup tips
 * (config.js DEMO_TIPS), so the popup never says anything the card doesn't.
 *
 * The popup grows out of the card and shrinks back into it (ui/popup.js).
 */

import { gradeColor, gradeLetter } from "../grade.js";
import { DEMO_TIPS } from "../config.js";
import { openPopup } from "../ui/popup.js";
import { reducedMotion } from "../ui/motion.js";
import { Scene, loadClips, frameAt, repAt, deepestT, clamp } from "../figures/scene3d.js";

const CLIP_FOR = { squat: "full", pushup: "pushup", plank: "plank", lunge: "lunge", jack: "jack" };
const TIPS_FOR = { squat: "Squat", pushup: "Push-up", plank: "Plank", lunge: "Lunge", jack: "Jumping Jack" };

export function mountExercisePopups(grid, dlg) {
  if (!grid || !dlg) return;
  const x = Object.fromEntries([...dlg.querySelectorAll("[data-x]")].map((n) => [n.dataset.x, n]));
  const canvas = dlg.querySelector(".ex-pop-canvas");
  const scene = new Scene(canvas, { zoom: 1.45 });
  const st = { clip: null, t: 0, last: 0, raf: 0, yaw: 34, pitch: 12, vYaw: 0, drag: null };

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
    scene.floor(cam);
    scene.figure(cam, P, gradeColor(rep.score));
    scene.angle(cam, ...clip.measure.joints(clip.side).map((k) => P[k]));
  }
  function tick(now) {
    st.raf = 0;
    const dt = st.last ? Math.min(50, now - st.last) : 16;
    st.last = now;
    st.t = (st.t + dt) % st.clip.dur;
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
      st.yaw = c.front ? 24 : 34; st.pitch = 12; st.vYaw = 0;
      st.t = reducedMotion() ? (c.kind === "hold" ? c.reps[0].t : deepestT(c, 0)) : 0;
    }
    openPopup(dlg, card);
    if (st.clip) { draw(); if (!reducedMotion()) st.raf ||= requestAnimationFrame(tick); }
  }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".ex-card");
    if (card) open(card);
  });

  canvas.addEventListener("pointerdown", (e) => {
    st.drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, touch: e.pointerType === "touch" };
    st.vYaw = 0;
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
