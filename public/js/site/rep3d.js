/**
 * rep3d.js — the homepage's 3D rep viewer: a squat you can turn around.
 *
 * The clips (data/rep3d.json, made by tools/make-rep3d.mjs) are MediaPipe-
 * style 3D world landmarks of a simulated person, with the rep times and
 * scores the real Session engine gave them. Nothing here grades anything:
 * it plays the clip back and colours each rep by the score it already got.
 *
 * Drawn on a canvas with its own small perspective camera, no 3D library:
 * a drafting grid on the floor, a protractor ring around the figure with
 * the webcam's position marked, floor shadows, and a protractor at the
 * knee measured in 3D. The readout puts that 3D knee angle next to the one
 * a flat picture from the current view would give, which is the point:
 * turn the view and the flat angle drifts, the 3D one doesn't.
 *
 * Drag to orbit (mouse: both axes; touch: sideways only, so the page still
 * scrolls), or use the view buttons, which swing there on a spring. Arrow
 * keys turn it too. Plays only while on screen; reduced motion starts
 * paused at the bottom of a rep and every move jumps to its end.
 */

import { gradeColor, gradeLetter } from "../grade.js";
import { spring, reducedMotion } from "../ui/motion.js";
import { glide } from "../ui/segmented.js";

const DEG = Math.PI / 180;
const VIEWS = {
  webcam: { yaw: 0, pitch: 6 },
  turned: { yaw: 38, pitch: 16 },
  front:  { yaw: 90, pitch: 8 },
  top:    { yaw: 20, pitch: 78 },
};
const DIST = 3.7;               // camera distance, metres
const RING = 0.8;               // floor protractor radius, metres

// Names for the joints the clip keeps (MediaPipe indices).
const IDX = { nose: 0, earL: 7, earR: 8, shL: 11, shR: 12, elL: 13, elR: 14, wrL: 15, wrR: 16,
  hipL: 23, hipR: 24, knL: 25, knR: 26, anL: 27, anR: 28, heL: 29, heR: 30, toL: 31, toR: 32 };
const BONES = [
  ["shL", "elL"], ["elL", "wrL"], ["shR", "elR"], ["elR", "wrR"],
  ["shL", "shR"], ["shL", "hipL"], ["shR", "hipR"], ["hipL", "hipR"],
  ["hipL", "knL"], ["knL", "anL"], ["anL", "heL"], ["heL", "toL"], ["anL", "toL"],
  ["hipR", "knR"], ["knR", "anR"], ["anR", "heR"], ["heR", "toR"], ["anR", "toR"],
];
const DOTS = ["shL", "shR", "elL", "elR", "wrL", "wrR", "hipL", "hipR", "knL", "knR", "anL", "anR"];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
const mid = (a, b) => mul(add(a, b), 0.5);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/**
 * One clip's frames as scene points: x forward (the way the person faces),
 * y up from the floor, z toward the webcam. World landmarks are centred on
 * the hips, so each frame is moved to stand on the floor with the feet
 * planted (both smoothed over a few frames so tracking noise doesn't shake
 * the whole figure).
 */
export function sceneFrames(clip, keep) {
  const at = Object.fromEntries(Object.entries(IDX).map(([k, i]) => [k, keep.indexOf(i)]));
  const raw = clip.w.map((w) => {
    const p = {};
    // MediaPipe: y down, z away from the camera. Flip both (not just y) so
    // the scene isn't mirrored.
    for (const [k, j] of Object.entries(at)) p[k] = [w[j * 3], -w[j * 3 + 1], -w[j * 3 + 2]];
    return p;
  });
  const feet = ["heL", "heR", "toL", "toR"];
  const base = raw.map((p) => {
    const a = mid(p.anL, p.anR);
    return [a[0], Math.min(...feet.map((k) => p[k][1])), a[2]];
  });
  const W = 3;
  return raw.map((p, i) => {
    let o = [0, 0, 0], n = 0;
    for (let k = Math.max(0, i - W); k <= Math.min(raw.length - 1, i + W); k++, n++) o = add(o, base[k]);
    o = mul(o, 1 / n);
    const q = {};
    for (const k in p) q[k] = [p[k][0] - o[0], p[k][1] - o[1], p[k][2] - o[2]];
    return q;
  });
}

/** The angle at b (degrees) between a-b and c-b, in 3D. */
export const angle3 = (a, b, c) => {
  const u = norm(sub(a, b)), v = norm(sub(c, b));
  return Math.acos(clamp(dot(u, v), -1, 1)) / DEG;
};

export async function mountRep3d(root) {
  const canvas = root.querySelector(".r3-canvas");
  const ctx = canvas.getContext("2d");
  const ui = Object.fromEntries([...root.querySelectorAll("[data-3]")].map((n) => [n.dataset["3"], n]));
  const clipBtns = [...root.querySelectorAll("[data-clip]")];
  const viewBtns = [...root.querySelectorAll("[data-view]")];

  let data;
  try {
    const res = await fetch("data/rep3d.json");
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
  } catch {
    ui.status.textContent = "The 3D clip didn't load. Reload the page to try again.";
    ui.status.hidden = false;
    return;
  }
  ui.status.hidden = true;
  root.classList.add("ready");

  const clips = Object.fromEntries(data.clips.map((c) => {
    const frames = sceneFrames(c, data.keep);
    // The webcam-near leg: the one the trainer grades side-on.
    const zL = frames.reduce((s, f) => s + f.knL[2], 0), zR = frames.reduce((s, f) => s + f.knR[2], 0);
    return [c.id, { ...c, frames, near: zL > zR ? "L" : "R", dur: c.t[c.t.length - 1] }];
  }));

  const css = getComputedStyle(document.documentElement);
  const MONO = css.getPropertyValue("--mono").trim() || "ui-monospace, monospace";
  const INK2 = css.getPropertyValue("--ink-2").trim() || "#0d1326";
  const LINE2 = css.getPropertyValue("--line-2").trim() || "#2e3a63";
  const DIM = css.getPropertyValue("--text-dim").trim() || "#a6aecb";
  const FAINT = css.getPropertyValue("--text-faint").trim() || "#737d9f";

  const st = {
    clip: clips.full ?? Object.values(clips)[0],
    t: 0, playing: !reducedMotion(), last: 0,
    yaw: VIEWS.turned.yaw, pitch: VIEWS.turned.pitch,
    vYaw: 0, drag: null, stops: [],
    w: 0, h: 0, dpr: 1, visible: false, raf: 0,
  };

  // Reduced motion: start at the bottom of the second rep, paused.
  if (!st.playing) st.t = deepestT(st.clip, 1);

  /* ── Camera ─────────────────────────────────────────── */
  function camera() {
    const y = st.yaw * DEG, p = st.pitch * DEG;
    const target = [0, 0.68, 0];
    const C = add(target, mul([Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)], DIST));
    const f = norm(sub(target, C));
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    const focal = Math.min(st.h * 1.55, st.w * 1.2);
    return { C, f, r, u, focal, cx: st.w / 2, cy: st.h * 0.5 };
  }
  /** Scene point → [screen x, screen y, depth]. */
  const proj = (cam, P) => {
    const d = sub(P, cam.C), z = Math.max(0.05, dot(d, cam.f));
    return [cam.cx + (cam.focal * dot(d, cam.r)) / z, cam.cy - (cam.focal * dot(d, cam.u)) / z, z];
  };

  /* ── Clip playback ──────────────────────────────────── */
  function frameAt(clip, t) {
    const T = clip.t;
    let i = 0;
    while (i < T.length - 2 && T[i + 1] <= t) i++;
    const k = clamp((t - T[i]) / ((T[i + 1] - T[i]) || 1), 0, 1);
    const a = clip.frames[i], b = clip.frames[i + 1] ?? a, out = {};
    for (const key in a) out[key] = add(a[key], mul(sub(b[key], a[key]), k));
    return out;
  }
  /** The rep a moment belongs to: the first rep that hasn't finished yet. */
  function repAt(clip, t) {
    const i = clip.reps.findIndex((r) => r.t >= t);
    return i < 0 ? clip.reps.length - 1 : i;
  }
  /** Time of the lowest hip position inside rep n. */
  function deepestT(clip, n) {
    const from = n ? clip.reps[n - 1].t : 0, to = clip.reps[n].t;
    let best = from, low = Infinity;
    clip.t.forEach((t, i) => {
      if (t < from || t > to) return;
      const h = clip.frames[i].hipL[1] + clip.frames[i].hipR[1];
      if (h < low) { low = h; best = t; }
    });
    return best;
  }

  /* ── Drawing ────────────────────────────────────────── */
  function line(cam, a, b, style, width, alpha = 1) {
    const p = proj(cam, a), q = proj(cam, b);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  }
  function label(x, y, text, { color = "#eef1fb", box = true, size = 12, align = "center" } = {}) {
    ctx.globalAlpha = 1;
    ctx.font = `600 ${size}px ${MONO}`;
    ctx.textAlign = align; ctx.textBaseline = "middle";
    if (box) {
      const w = ctx.measureText(text).width + 12, h = size + 9;
      const x0 = align === "center" ? x - w / 2 : align === "left" ? x - 6 : x - w + 6;
      ctx.fillStyle = "#090d1c"; ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.fillRect(x0, y - h / 2, w, h); ctx.strokeRect(x0 + 0.5, y - h / 2 + 0.5, w - 1, h - 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y + 0.5);
  }

  function drawFloor(cam) {
    // Drafting grid every 25 cm, fading out toward its edges.
    const S = 0.25, N = 7;
    ctx.lineCap = "butt";
    for (let i = -N; i <= N; i++) {
      for (let j = -N; j < N; j++) {
        const fade = 1 - Math.hypot(i * S, (j + 0.5) * S) / (N * S);
        if (fade <= 0) continue;
        const a = 0.13 * fade;
        line(cam, [i * S, 0, j * S], [i * S, 0, (j + 1) * S], DIM, 1, a);
        line(cam, [j * S, 0, i * S], [(j + 1) * S, 0, i * S], DIM, 1, a);
      }
    }
    // Protractor ring: a tick every 10°, longer every 30°, angles measured
    // from the webcam's line of sight.
    const ring = (r, a) => [Math.sin(a * DEG) * r, 0, Math.cos(a * DEG) * r];
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.55; ctx.strokeStyle = LINE2; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let a = 0; a <= 360; a += 4) { const p = proj(cam, ring(RING, a)); a ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke();
    for (let a = 0; a < 360; a += 10) {
      const long = a % 30 === 0;
      line(cam, ring(RING, a), ring(RING - (long ? 0.09 : 0.045), a), DIM, long ? 1.4 : 1, long ? 0.6 : 0.35);
      if (long && a % 90 === 0) {
        const p = proj(cam, ring(RING + 0.13, a));
        label(p[0], p[1], `${a > 180 ? a - 360 : a}°`, { color: FAINT, box: false, size: 11 });
      }
    }
    // Where the webcam was, and its line of sight.
    const camAt = [0, 0, RING + 0.32];
    ctx.setLineDash([4, 6]);
    line(cam, camAt, [0, 0, 0.2], DIM, 1.2, 0.5);
    ctx.setLineDash([]);
    const c = proj(cam, camAt);
    label(c[0], c[1], "WEBCAM", { color: DIM, size: 11 });
  }

  function drawFigure(cam, P, colour) {
    const scale = st.h / 480;
    // Floor shadow: every bone dropped straight down.
    const flat = (p) => [p[0], 0.002, p[2]];
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const [a, b] of BONES) line(cam, flat(P[a]), flat(P[b]), "#000", 9 * scale, 0.28);

    const head = add(mid(P.earL, P.earR), mul(sub(P.nose, mid(P.earL, P.earR)), 0.3));
    const neck = mid(P.shL, P.shR);
    const centre = proj(cam, mid(mid(P.hipL, P.hipR), neck))[2];
    const parts = BONES.map(([a, b]) => ({ a: P[a], b: P[b] }));
    parts.push({ a: neck, b: add(neck, mul(norm(sub(head, neck)), Math.max(0, Math.hypot(...sub(head, neck)) - 0.1))) });
    for (const p of parts) p.z = (proj(cam, p.a)[2] + proj(cam, p.b)[2]) / 2;
    parts.push({ head, z: proj(cam, head)[2] });
    parts.sort((x, y) => y.z - x.z);                    // far first

    for (const p of parts) {
      // The far side recedes, as on the flat figures (38% at the back).
      const alpha = 1 - 0.62 * smooth(-0.04, 0.14, p.z - centre);
      if (p.head) {
        const [x, y, z] = proj(cam, p.head);
        const r = (cam.focal * 0.105) / z;
        ctx.globalAlpha = 1;
        ctx.fillStyle = INK2; ctx.strokeStyle = colour; ctx.lineWidth = 6 * scale * (DIST / z);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        continue;
      }
      line(cam, p.a, p.b, colour, 7 * scale * (DIST / p.z), alpha);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    for (const k of DOTS) {
      const [x, y, z] = proj(cam, P[k]);
      if (z - centre > 0.1) continue;                   // the far side's points are hidden behind the body
      ctx.beginPath(); ctx.arc(x, y, 2.6 * scale, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** Protractor at the graded knee, drawn in the plane of the leg. */
  function drawKnee(cam, P, side) {
    const hip = P["hip" + side], knee = P["kn" + side], ank = P["an" + side];
    const u = norm(sub(hip, knee)), w = norm(sub(ank, knee));
    const th = Math.acos(clamp(dot(u, w), -1, 1));
    const v = norm(sub(w, mul(u, dot(u, w))));
    const at = (r, a) => add(knee, add(mul(u, r * Math.cos(a)), mul(v, r * Math.sin(a))));
    const R = 0.13;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.9; ctx.strokeStyle = "#eef1fb"; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const p = proj(cam, at(R, (th * i) / 24)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke();
    for (let a = 0; a <= th / DEG; a += 10) {
      const long = Math.round(a) % 30 === 0;
      line(cam, at(R, a * DEG), at(R * (long ? 0.72 : 0.84), a * DEG), "#eef1fb", 1.2, 0.7);
    }
    const p = proj(cam, at(R * 2.1, th / 2));
    label(p[0], p[1], `${Math.round(th / DEG)}°`, { size: 13 });
    return th / DEG;
  }

  function draw() {
    const cam = camera();
    const clip = st.clip;
    const P = frameAt(clip, st.t);
    const n = repAt(clip, st.t), rep = clip.reps[n];
    const colour = gradeColor(rep.score);

    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    ctx.clearRect(0, 0, st.w, st.h);
    drawFloor(cam);
    drawFigure(cam, P, colour);
    const k3 = drawKnee(cam, P, clip.near);

    // The same knee as a flat picture from this view would measure it.
    const s = clip.near;
    const [h2, k2, a2] = [P["hip" + s], P["kn" + s], P["an" + s]].map((q) => proj(cam, q));
    const v1 = [h2[0] - k2[0], h2[1] - k2[1]], v2 = [a2[0] - k2[0], a2[1] - k2[1]];
    const flat = Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1]) / ((Math.hypot(...v1) * Math.hypot(...v2)) || 1), -1, 1)) / DEG;

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

  function resize() {
    const r = canvas.getBoundingClientRect();
    st.dpr = Math.min(2, window.devicePixelRatio || 1);
    st.w = r.width; st.h = r.height;
    canvas.width = Math.round(r.width * st.dpr);
    canvas.height = Math.round(r.height * st.dpr);
    draw();
  }
  new ResizeObserver(resize).observe(canvas);
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

  resize();
}
