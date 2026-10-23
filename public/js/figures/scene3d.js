/**
 * scene3d.js — the homepage's 3D figure, shared by the 3D hero
 * (site/hero3d.js), the "How it works" story (site/story.js), the exercise
 * popups (site/expop.js) and the 3D view (site/rep3d.js).
 *
 * The clips (data/rep3d.json, made by tools/make-rep3d.mjs) are MediaPipe-
 * style 3D world landmarks of a simulated person, with the rep times and
 * scores the real Session engine gave them. Nothing here grades anything.
 *
 * Drawn on a 2D canvas with a small perspective camera of its own, no 3D
 * library: a drafting grid on the floor, a protractor ring with the
 * webcam's position marked, floor shadows, bones that recede with depth,
 * protractors measured in 3D, and the coach's handwritten notes.
 *
 * Scene space: x forward (the way a side-on person faces), y up from the
 * floor, z toward the webcam. Yaw 0 = the webcam's view.
 */

export const DEG = Math.PI / 180;

// Names for the joints the clip keeps (MediaPipe indices).
const IDX = { nose: 0, earL: 7, earR: 8, shL: 11, shR: 12, elL: 13, elR: 14, wrL: 15, wrR: 16,
  hipL: 23, hipR: 24, knL: 25, knR: 26, anL: 27, anR: 28, heL: 29, heR: 30, toL: 31, toR: 32 };
export const BONES = [
  ["shL", "elL"], ["elL", "wrL"], ["shR", "elR"], ["elR", "wrR"],
  ["shL", "shR"], ["shL", "hipL"], ["shR", "hipR"], ["hipL", "hipR"],
  ["hipL", "knL"], ["knL", "anL"], ["anL", "heL"], ["heL", "toL"], ["anL", "toL"],
  ["hipR", "knR"], ["knR", "anR"], ["anR", "heR"], ["heR", "toR"], ["anR", "toR"],
];
const DOTS = ["shL", "shR", "elL", "elR", "wrL", "wrR", "hipL", "hipR", "knL", "knR", "anL", "anR"];
export const POINTS = Object.keys(IDX);

// The canvas drawings are dark panels whatever the page tone around them.
const C = { text: "#eef1fb", dim: "#a6aecb", faint: "#737d9f", line2: "#2e3a63", head: "#0d1326", paper: "#eef1fb", note: "#fff6d8", good: "#2ee59d", fix: "#ffbe3d" };
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';
const HAND = '"Bradley Hand", "Segoe Print", "Ink Free", "Chalkboard SE", "Comic Neue", cursive';

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
export const mid = (a, b) => mul(add(a, b), 0.5);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const backOut = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

/** The angle at b (degrees) between a-b and c-b, in 3D. */
export const angle3 = (a, b, c) => {
  const u = norm(sub(a, b)), v = norm(sub(c, b));
  return Math.acos(clamp(dot(u, v), -1, 1)) / DEG;
};

/** Mix two #rrggbb colours. */
export function mixColor(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, "0")).join("");
}

/**
 * One clip's frames as scene points. World landmarks are centred on the
 * hips, so each frame is moved to stand on the floor with the feet planted
 * (smoothed over a few frames so tracking noise doesn't shake the figure).
 */
export function sceneFrames(clip, keep, scale = 1) {
  const at = Object.fromEntries(Object.entries(IDX).map(([k, i]) => [k, keep.indexOf(i)]));
  const raw = clip.w.map((w) => {
    const p = {};
    // MediaPipe: y down, z away from the camera. Flip both (not just y) so
    // the scene isn't mirrored.
    for (const [k, j] of Object.entries(at)) p[k] = [w[j * 3] / scale, -w[j * 3 + 1] / scale, -w[j * 3 + 2] / scale];
    return p;
  });
  // Tracking noise makes the figure twitch. Smooth each joint's path over
  // time (a 7-frame Gaussian, about ±0.2 s at 15 fps) before anything else.
  // Display only: the engine scored the clip as it was recorded.
  const K = [1, 6, 15, 20, 15, 6, 1].map((k) => k / 64);
  const calm = raw.map((p, i) => {
    const q = {};
    for (const key in p) {
      let x = 0, y = 0, z = 0, wsum = 0;
      K.forEach((w, j) => {
        const f = raw[Math.min(raw.length - 1, Math.max(0, i + j - 3))][key];
        x += f[0] * w; y += f[1] * w; z += f[2] * w; wsum += w;
      });
      q[key] = [x / wsum, y / wsum, z / wsum];
    }
    return q;
  });
  raw.splice(0, raw.length, ...calm);
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

/** What each exercise's readout measures, and on which joints. */
export const MEASURE = {
  "Squat":        { label: "Knee angle",  joints: (s) => ["hip" + s, "kn" + s, "an" + s] },
  "Push-up":      { label: "Elbow angle", joints: (s) => ["sh" + s, "el" + s, "wr" + s] },
  "Plank":        { label: "Body line",   joints: (s) => ["sh" + s, "hip" + s, "an" + s] },
  "Lunge":        { label: "Front knee",  joints: (s) => ["hip" + s, "kn" + s, "an" + s] },
  "Jumping Jack": { label: "Arm raise",   joints: (s) => ["hip" + s, "sh" + s, "wr" + s] },
};

/** The clips, ready to draw: frames in scene space, duration, the side the readout measures. */
export function prepareClips(data) {
  const scale = data.version >= 2 ? 1000 : 1;
  return Object.fromEntries(data.clips.map((c) => {
    const frames = sceneFrames(c, data.keep, scale);
    const avg = (k, i) => frames.reduce((s, f) => s + f[k][i], 0) / frames.length;
    // Side-on: the webcam-near side (the one the trainer grades). Lunge: the
    // front leg. Facing the camera: either side; the left.
    const side = c.front ? "L"
      : c.exercise === "Lunge" ? (avg("anL", 0) > avg("anR", 0) ? "L" : "R")
      : avg("knL", 2) > avg("knR", 2) ? "L" : "R";
    return [c.id, { ...c, frames, side, dur: c.t[c.t.length - 1], measure: MEASURE[c.exercise] }];
  }));
}

let loading = null;
/** Fetch and prepare the clips once for the whole page. */
export function loadClips() {
  loading ??= fetch("data/rep3d.json").then((r) => {
    if (!r.ok) throw new Error(`rep3d.json: ${r.status}`);
    return r.json();
  }).then(prepareClips);
  return loading;
}

/**
 * The clip's pose at time t (ms), between its saved frames: a Catmull-Rom
 * curve through the frames on either side, so the motion flows instead of
 * changing direction with a jolt at every saved frame.
 */
export function frameAt(clip, t) {
  const T = clip.t, F = clip.frames, n = T.length;
  let i = clip._i ?? 0;                                // start from last time's frame (playback moves forward)
  if (i > n - 2 || T[i] > t) i = 0;
  while (i < n - 2 && T[i + 1] <= t) i++;
  clip._i = i;
  const k = clamp((t - T[i]) / ((T[i + 1] - T[i]) || 1), 0, 1);
  const p0 = F[Math.max(0, i - 1)], p1 = F[i], p2 = F[Math.min(n - 1, i + 1)], p3 = F[Math.min(n - 1, i + 2)];
  const k2 = k * k, k3 = k2 * k, out = {};
  for (const key in p1) {
    const a = p0[key], b = p1[key], c = p2[key], d = p3[key];
    out[key] = [0, 1, 2].map((j) => 0.5 * (2 * b[j] + (c[j] - a[j]) * k + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * k2 + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * k3));
  }
  return out;
}
/** The rep a moment belongs to: the first rep that hasn't finished yet. */
export function repAt(clip, t) {
  const i = clip.reps.findIndex((r) => r.t >= t);
  return i < 0 ? clip.reps.length - 1 : i;
}
/** The last rep (or hold segment) already finished at time t, or -1. */
export const doneAt = (clip, t) => clip.reps.reduce((n, r, i) => (r.t <= t ? i : n), -1);
/** Time of the lowest hip position inside rep n. */
export function deepestT(clip, n) {
  const from = n ? clip.reps[n - 1].t : 0, to = clip.reps[n].t;
  let best = from, low = Infinity;
  clip.t.forEach((t, i) => {
    if (t < from || t > to) return;
    const h = clip.frames[i].hipL[1] + clip.frames[i].hipR[1];
    if (h < low) { low = h; best = t; }
  });
  return best;
}

/**
 * A canvas with a camera. Each frame: scene.fit() if the size may have
 * changed, cam = scene.camera(yaw, pitch), then draw floor, figure, marks.
 *   opts.target  what the camera looks at (metres)
 *   opts.dist    camera distance (metres)
 *   opts.zoom    focal length as a share of the canvas height
 *   opts.at      where the target sits on the canvas, [x, y] as shares
 */
export class Scene {
  constructor(canvas, { target = [0, 0.68, 0], dist = 3.7, zoom = 1.55, at = [0.5, 0.5], ring = 0.8, bg = null, maxDpr = 2 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    Object.assign(this, { target, dist, zoom, at, ring, bg, maxDpr });
    this.w = 0; this.h = 0; this.dpr = 1;
  }

  /** Match the backing store to the element's size. Returns true if it changed. */
  fit() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1);
    if (r.width === this.w && r.height === this.h && dpr === this.dpr) return false;
    this.w = r.width; this.h = r.height; this.dpr = dpr;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    return true;
  }

  camera(yaw, pitch) {
    const y = yaw * DEG, p = pitch * DEG;
    const T = this.target;
    const Cpos = add(T, mul([Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)], this.dist));
    const f = norm(sub(T, Cpos));
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    const focal = Math.min(this.h * this.zoom, this.w * this.zoom * 0.8);
    return { C: Cpos, f, r, u, focal, cx: this.w * this.at[0], cy: this.h * this.at[1], s: this.h / 480 };
  }

  /** Scene point → [screen x, screen y, depth]. */
  proj(cam, P) {
    const d = sub(P, cam.C), z = Math.max(0.05, dot(d, cam.f));
    return [cam.cx + (cam.focal * dot(d, cam.r)) / z, cam.cy - (cam.focal * dot(d, cam.u)) / z, z];
  }

  begin() {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    if (this.bg) { ctx.fillStyle = this.bg; ctx.fillRect(0, 0, this.w, this.h); }
    else ctx.clearRect(0, 0, this.w, this.h);
  }

  line(cam, a, b, style, width, alpha = 1) {
    const { ctx } = this;
    const p = this.proj(cam, a), q = this.proj(cam, b);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  }

  label(x, y, text, { color = C.text, box = true, size = 12, alpha = 1 } = {}) {
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    ctx.font = `600 ${size}px ${MONO}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (box) {
      const w = ctx.measureText(text).width + 12, h = size + 9;
      ctx.fillStyle = "#090d1c"; ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.strokeRect(x - w / 2 + 0.5, y - h / 2 + 0.5, w - 1, h - 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y + 0.5);
    ctx.globalAlpha = 1;
  }

  /**
   * The floor: a drafting grid every 25 cm fading toward its edge, a
   * protractor ring (a tick every 10°, longer every 30°, angles from the
   * webcam's line of sight) and the webcam's position.
   */
  floor(cam, { size = 7, grid = true, ring = true, webcam = true, alpha = 1 } = {}) {
    const { ctx } = this;
    const S = 0.25, N = size;
    ctx.lineCap = "butt";
    if (grid) {
      // Grid squares fade toward the edge. Rather than one stroke per square
      // edge (hundreds a frame), group them into five strengths and draw each
      // group as one path.
      const LEVELS = 5, paths = Array.from({ length: LEVELS }, () => []);
      for (let i = -N; i <= N; i++) {
        for (let j = -N; j < N; j++) {
          const fade = 1 - Math.hypot(i * S, (j + 0.5) * S) / (N * S);
          if (fade <= 0) continue;
          const g = paths[Math.min(LEVELS - 1, Math.floor(fade * LEVELS))];
          g.push([i * S, 0, j * S], [i * S, 0, (j + 1) * S], [j * S, 0, i * S], [(j + 1) * S, 0, i * S]);
        }
      }
      ctx.strokeStyle = C.dim; ctx.lineWidth = 1;
      paths.forEach((pts, lvl) => {
        if (!pts.length) return;
        ctx.globalAlpha = 0.13 * ((lvl + 0.5) / LEVELS) * alpha;
        ctx.beginPath();
        for (let q = 0; q < pts.length; q += 2) {
          const a = this.proj(cam, pts[q]), b = this.proj(cam, pts[q + 1]);
          ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        }
        ctx.stroke();
      });
    }
    if (!ring) return;
    const R = this.ring;
    const at = (r, a) => [Math.sin(a * DEG) * r, 0, Math.cos(a * DEG) * r];
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.55 * alpha; ctx.strokeStyle = C.line2; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let a = 0; a <= 360; a += 4) { const p = this.proj(cam, at(R, a)); a ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke();
    for (let a = 0; a < 360; a += 10) {
      const long = a % 30 === 0;
      this.line(cam, at(R, a), at(R - (long ? 0.09 : 0.045), a), C.dim, long ? 1.4 : 1, (long ? 0.6 : 0.35) * alpha);
      if (long && a % 90 === 0) {
        const p = this.proj(cam, at(R + 0.13, a));
        this.label(p[0], p[1], `${a > 180 ? a - 360 : a}°`, { color: C.faint, box: false, size: 11, alpha });
      }
    }
    if (!webcam) return;
    const camAt = [0, 0, R + 0.32];
    ctx.setLineDash([4, 6]);
    this.line(cam, camAt, [0, 0, 0.2], C.dim, 1.2, 0.5 * alpha);
    ctx.setLineDash([]);
    const c = this.proj(cam, camAt);
    this.label(c[0], c[1], "WEBCAM", { color: C.dim, size: 11, alpha });
  }

  /**
   * The floor, but drawn once into an offscreen canvas and copied each frame
   * until the camera (or the floor's options) change: the grid is the most
   * expensive thing on these canvases, and the camera is usually still.
   */
  floorCached(cam, opts = {}) {
    const key = [...cam.C, ...cam.f, cam.focal, cam.cx, cam.cy, this.w, this.h, this.dpr, opts.alpha ?? 1, opts.size ?? 7]
      .map((v) => (typeof v === "number" ? v.toFixed(3) : v)).join();
    const off = (this._floor ??= document.createElement("canvas"));
    if (key !== this._floorKey) {
      this._floorKey = key;
      off.width = this.canvas.width; off.height = this.canvas.height;
      const real = this.ctx;
      this.ctx = off.getContext("2d");
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.clearRect(0, 0, this.w, this.h);
      try { this.floor(cam, opts); } finally { this.ctx = real; }
    }
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }

  /**
   * The figure. colour: its grade colour. grow 0..1 draws each bone out
   * from its first joint ("it finds you"); dots 0..1 pops the tracked
   * points in one after another; shadow drops every bone onto the floor.
   */
  figure(cam, P, colour, { grow = 1, dots = 1, shadow = true, alpha = 1 } = {}) {
    const { ctx } = this;
    const s = cam.s;
    const tip = (a, b) => add(a, mul(sub(b, a), grow));
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (shadow && grow > 0) {
      const flat = (p) => [p[0], 0.002, p[2]];
      for (const [a, b] of BONES) this.line(cam, flat(P[a]), flat(tip(P[a], P[b])), "#000", 9 * s, 0.28 * alpha * grow);
    }

    const head = add(mid(P.earL, P.earR), mul(sub(P.nose, mid(P.earL, P.earR)), 0.3));
    const neck = mid(P.shL, P.shR);
    const centre = this.proj(cam, mid(mid(P.hipL, P.hipR), neck))[2];
    if (grow > 0) {
      const parts = BONES.map(([a, b]) => ({ a: P[a], b: tip(P[a], P[b]) }));
      const toHead = Math.max(0, Math.hypot(...sub(head, neck)) - 0.1);
      parts.push({ a: neck, b: add(neck, mul(norm(sub(head, neck)), toHead * grow)) });
      for (const p of parts) p.z = (this.proj(cam, p.a)[2] + this.proj(cam, p.b)[2]) / 2;
      parts.push({ head, z: this.proj(cam, head)[2] });
      parts.sort((x, y) => y.z - x.z);                  // far first
      for (const p of parts) {
        // The far side recedes, as on the flat figures (38% at the back).
        const a = (1 - 0.62 * smooth(-0.04, 0.14, p.z - centre)) * alpha;
        if (p.head) {
          const [x, y, z] = this.proj(cam, p.head);
          const r = ((cam.focal * 0.105) / z) * backOut(clamp(grow, 0, 1));
          if (r <= 0) continue;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = C.head; ctx.strokeStyle = colour; ctx.lineWidth = 6 * s * (this.dist / z);
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          continue;
        }
        this.line(cam, p.a, p.b, colour, 7 * s * (this.dist / p.z), a);
      }
    }
    if (dots <= 0) { ctx.globalAlpha = 1; return; }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff";
    DOTS.forEach((k, i) => {
      const [x, y, z] = this.proj(cam, P[k]);
      if (grow >= 1 && z - centre > 0.1) return;        // the far side's points are hidden behind the body
      const start = (i / DOTS.length) * 0.6;
      const k2 = backOut(clamp((dots - start) / 0.4, 0, 1));
      if (k2 <= 0) return;
      ctx.beginPath(); ctx.arc(x, y, 2.6 * s * k2 * (grow < 1 ? 1.5 : 1), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  /**
   * Only the tracked points, the way the pose model hands them over: a dot
   * and a thin ring on every point, popping in one after another.
   */
  points(cam, P, t = 1) {
    const { ctx } = this;
    const s = cam.s;
    POINTS.forEach((k, i) => {
      const start = (i / POINTS.length) * 0.65;
      const k2 = backOut(clamp((t - start) / 0.35, 0, 1));
      if (k2 <= 0) return;
      const [x, y] = this.proj(cam, P[k]);
      ctx.globalAlpha = 0.5 * clamp(k2, 0, 1);
      ctx.strokeStyle = C.text; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 7 * s * k2, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x, y, 2.8 * s * k2, 0, Math.PI * 2); ctx.fill();
    });
  }

  /** Protractor at b, drawn in the plane of a-b-c, with the angle boxed. Returns degrees. */
  angle(cam, a, b, c, { r = 0.13, alpha = 1 } = {}) {
    const { ctx } = this;
    const u = norm(sub(a, b)), w = norm(sub(c, b));
    const th = Math.acos(clamp(dot(u, w), -1, 1));
    const v = norm(sub(w, mul(u, dot(u, w))));
    const at = (rr, ang) => add(b, add(mul(u, rr * Math.cos(ang)), mul(v, rr * Math.sin(ang))));
    if (alpha > 0) {
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.9 * alpha; ctx.strokeStyle = C.text; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const p = this.proj(cam, at(r, (th * i) / 24)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.stroke();
      for (let d = 0; d <= th / DEG; d += 10) {
        const long = Math.round(d) % 30 === 0;
        this.line(cam, at(r, d * DEG), at(r * (long ? 0.72 : 0.84), d * DEG), C.text, 1.2, 0.7 * alpha);
      }
      const p = this.proj(cam, at(r * 2.1, th / 2));
      this.label(p[0], p[1], `${Math.round(th / DEG)}°`, { size: 13, alpha });
    }
    return th / DEG;
  }

  /** The same angle as a flat picture from this view would measure it. */
  flatAngle(cam, a, b, c) {
    const [p, q, r] = [a, b, c].map((x) => this.proj(cam, x));
    const v1 = [p[0] - q[0], p[1] - q[1]], v2 = [r[0] - q[0], r[1] - q[1]];
    return Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1]) / ((Math.hypot(...v1) * Math.hypot(...v2)) || 1), -1, 1)) / DEG;
  }

  /**
   * The coach's handwritten note beside a body part: the text is penned in
   * left to right (write 0..1), then a hand-drawn arrow reaches the joint.
   * good: green arrow; otherwise amber (a fix).
   */
  note(cam, target, text, { write = 1, good = true, side = 1 } = {}) {
    if (write <= 0) return;
    const { ctx } = this;
    const s = Math.min(cam.s, 1.1);                      // handwriting stays note-sized on big canvases
    const [tx, ty] = this.proj(cam, target);
    const size = Math.round(22 * s);
    ctx.font = `600 ${size}px ${HAND}`;
    const w = ctx.measureText(text).width;
    const nx = clamp(tx + side * 120 * s - (side < 0 ? w : 0), 12, this.w - w - 12), ny = clamp(ty - 120 * s, size + 8, this.h - 20);
    const pen = clamp(write / 0.7, 0, 1), arrow = clamp((write - 0.7) / 0.3, 0, 1);
    ctx.save();
    ctx.translate(nx, ny); ctx.rotate(-0.04);
    ctx.beginPath(); ctx.rect(-4, -size, (w + 8) * pen, size * 1.6); ctx.clip();
    ctx.fillStyle = C.note; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(text, 0, 0);
    ctx.restore();
    if (arrow <= 0) return;
    // A curved arrow from under the note to just short of the joint.
    const sx = side > 0 ? nx + 10 * s : nx + w - 10 * s, sy = ny + 12 * s;
    const ex = tx + side * 14 * s, ey = ty - 10 * s;
    const mx = (sx + ex) / 2 + side * 28 * s, my = (sy + ey) / 2 - 10 * s;
    const n = 24, upto = Math.round(n * arrow);
    const qp = (k) => { const u = k / n; return [(1 - u) * (1 - u) * sx + 2 * (1 - u) * u * mx + u * u * ex, (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * my + u * u * ey]; };
    ctx.globalAlpha = 1; ctx.strokeStyle = good ? C.good : C.fix; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    for (let k = 0; k <= upto; k++) { const [x, y] = qp(k); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    if (arrow >= 1) {
      const [px, py] = qp(n - 2);
      const ang = Math.atan2(ey - py, ex - px);
      ctx.beginPath();
      ctx.moveTo(ex - Math.cos(ang - 0.5) * 10 * s, ey - Math.sin(ang - 0.5) * 10 * s);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang + 0.5) * 10 * s, ey - Math.sin(ang + 0.5) * 10 * s);
      ctx.stroke();
    }
  }
}
