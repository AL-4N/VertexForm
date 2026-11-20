/**
 * tree3d.js — a skill path as a real tree in 3D (Three.js, vendor/three),
 * for the Skill tree screen on wide screens (ui/skills.js mounts it; narrow
 * screens and reduced motion keep the flat tree).
 *
 *   wood     a trunk from the ground, then a tapered branch from each skill
 *            up to every skill that needs it, spread round the trunk by tier.
 *            Branches out of an unlocked skill are lit (a green rim and a
 *            soft tube of light); branches toward skills that can't be
 *            tracked yet are dashed, like a plan not built.
 *   skills   an open flower (paper petals, green heart) when unlocked, an
 *            amber bud when it's next, a bare twig tip when locked.
 *   leaves   come in along the branches you've earned, so the tree leafs
 *            out as you unlock.
 *   labels   real buttons (the page's own, from skills.js) pinned to each
 *            skill by a leader line: its name, the workout that trains it
 *            and its status. Labels on the far side dim and can't be clicked.
 *
 * Opening it grows the tree: the trunk, then each tier's branches, each
 * flower opening as its branch arrives, the leaves after, while the camera
 * cranes up from the roots. It turns slowly on its own; drag to turn it,
 * pointing at a label stops it, and picking a skill swings it to the front
 * and lights its branches down to the trunk. Renders only while on screen
 * and moving.
 */

import * as THREE from "../../vendor/three/three.module.min.js";
import { tiersOf, avgPos } from "./mini-tree.js";

const TAU = Math.PI * 2;
const Y0 = 0.95, DY = 0.78;                 // height of the first tier, and between tiers
const AUTO = 0.07, IDLE = 3500;             // rad/s on its own; ms after a touch before it turns again
const COL = { wood: 0x6e6555, woodDim: 0x4a4d63, green: 0x2ee59d, amber: 0xffbe3d, paper: 0xeef1fb, rimDim: 0x7d86a8, leaf: 0x2c9a62, line: 0x2e3a63 };

let renderer = null, canvas = null, glowTex = null;
function getRenderer() {
  if (renderer) return renderer;
  canvas = document.createElement("canvas");
  canvas.className = "t3-canvas";
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;     // keep the grade colours true
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/** A soft round light, drawn once. */
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.15, "rgba(255,255,255,.7)");
  r.addColorStop(0.4, "rgba(255,255,255,.18)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Same tree every time it opens: randomness seeded by the path. */
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 3432918353), h = (h << 13) | (h >>> 19);
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeBack = (t) => { if (t <= 0) return 0; if (t >= 1) return 1; const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/* ── Materials ─────────────────────────────────────────── */

const WOOD_VS = `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vUv = uv;
    gl_Position = projectionMatrix * mv;
  }`;
// Bark lit from the camera's upper right, a rim of light at its edges, and
// optionally dashed along its length (a branch toward an untracked skill).
const WOOD_FS = `uniform vec3 uBase; uniform vec3 uRim; uniform float uRimK; uniform float uDash; uniform float uAlpha;
  varying vec3 vN; varying vec3 vV; varying vec2 vUv;
  void main() {
    if (uDash > 0.5 && fract(vUv.x * 26.0) > 0.52) discard;
    vec3 n = normalize(vN), v = normalize(vV);
    float diff = 0.32 + 0.68 * max(dot(n, normalize(vec3(0.45, 0.75, 0.55))), 0.0);
    float bark = 0.86 + 0.14 * sin(vUv.y * 37.7 + vUv.x * 55.0 + sin(vUv.x * 13.0) * 2.0);
    float rim = pow(1.0 - abs(dot(n, v)), 2.4);
    gl_FragColor = vec4(uBase * diff * bark + uRim * rim * uRimK, uAlpha);
  }`;
function woodMat({ base = COL.wood, rim = COL.rimDim, rimK = 0.55, dash = false, alpha = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uBase: { value: new THREE.Color(base) }, uRim: { value: new THREE.Color(rim) }, uRimK: { value: rimK }, uDash: { value: dash ? 1 : 0 }, uAlpha: { value: alpha } },
    vertexShader: WOOD_VS, fragmentShader: WOOD_FS, transparent: alpha < 1, depthWrite: alpha >= 1,
  });
}
// A soft tube of light round a lit branch: brightest where you look straight at it.
function haloMat(color, alpha) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha } },
    vertexShader: WOOD_VS,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying vec3 vN; varying vec3 vV;
      void main() { float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 3.0) * uAlpha; gl_FragColor = vec4(uColor * a, a); }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
}

/** A tube along curve that thins from r0 to r1. Index order runs along the
 *  tube, so drawRange grows it from its base. */
function taperedTube(curve, r0, r1, segs = 44, radial = 10) {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = g.attributes.position, c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const r = r0 + (r1 - r0) * Math.pow(i / segs, 0.8);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      p.setXYZ(k, c.x + (p.getX(k) - c.x) * r, c.y + (p.getY(k) - c.y) * r, c.z + (p.getZ(k) - c.z) * r);
    }
  }
  p.needsUpdate = true;
  g.userData.full = segs * radial * 6;
  g.userData.step = radial * 6;
  g.userData.segs = segs;
  return g;
}

/* ── Layout: where each skill sits ─────────────────────── */

function layout(path, stepOf) {
  const rows = tiersOf(path);
  const pos = {};
  rows.forEach((row, t) => {
    if (t) row.sort((a, b) => avgPos(a, pos) - avgPos(b, pos));
    row.forEach((s, i) => { pos[s.id] = (i + 0.5) / row.length; });
  });
  const nodes = new Map();
  rows.forEach((row, t) => {
    const n = row.length, y = Y0 + t * DY;
    const r = n === 1 ? (t === 0 ? 0 : 0.14) : Math.max(0.5 + 0.28 * t, (n * 0.7) / TAU);
    row.forEach((s) => {
      let th;
      if (n === 1) {
        const ps = s.requires.map((q) => nodes.get(q)).filter(Boolean);
        th = ps.length ? Math.atan2(ps.reduce((a, p) => a + Math.sin(p.th), 0), ps.reduce((a, p) => a + Math.cos(p.th), 0)) : 0;
      } else th = TAU * pos[s.id] - Math.PI + t * 0.4;
      nodes.set(s.id, { s, th, r, y, tier: t + 1, p: new THREE.Vector3(Math.sin(th) * r, y, Math.cos(th) * r) });
    });
  });
  // Prerequisites from other paths: a small graft below the skill that needs them.
  const ghosts = [];
  for (const s of path.steps) for (const q of s.requires) {
    const req = stepOf(q);
    if (!req || req.path === path.id) continue;
    const c = nodes.get(s.id), th = c.th + 0.55 + ghosts.length * 0.2, r = c.r + 0.32;
    ghosts.push({ id: q, child: s.id, s: req, th, r, y: c.y - DY * 0.55, tier: c.tier, ghost: true,
      p: new THREE.Vector3(Math.sin(th) * r, c.y - DY * 0.55, Math.cos(th) * r) });
  }
  return { rows, nodes, ghosts, top: Y0 + (rows.length - 1) * DY, maxR: Math.max(0.4, ...[...nodes.values(), ...ghosts].map((n) => n.r)) };
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function bend(a, b, straight = false) {
  const dy = b.y - a.y;
  if (straight) return new THREE.CubicBezierCurve3(a, a.clone().add(V(0.05, dy * 0.33, 0.02)), b.clone().add(V(-0.04, -dy * 0.33, 0)), b);
  // Up first, then out: the way branches grow toward the light.
  return new THREE.CubicBezierCurve3(a, a.clone().add(V(0, dy * 0.6, 0)), b.clone().add(V(-b.x * 0.18, -dy * 0.32, -b.z * 0.18)), b);
}

/* ── The skill marks ───────────────────────────────────── */

const stdMat = (color, emissive = 0, k = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: k, roughness: 0.65, metalness: 0, ...extra });

function bloom(T) {
  const g = new T.Group(), petals = [];
  const pg = new T.SphereGeometry(1, 14, 8), petal = stdMat(COL.paper, COL.paper, 0.18);
  for (let k = 0; k < 5; k++) {
    const pivot = new T.Group();
    pivot.rotation.y = (k / 5) * TAU;
    const m = new T.Mesh(pg, petal);
    m.scale.set(0.058, 0.012, 0.034);
    m.position.x = 0.052;
    pivot.add(m);
    g.add(pivot);
    petals.push(pivot);
  }
  const heart = new T.Mesh(new T.SphereGeometry(0.026, 14, 10), stdMat(COL.green, COL.green, 0.9));
  heart.position.y = 0.012;
  g.add(heart);
  const halo = new T.Sprite(new T.SpriteMaterial({ map: glow(), color: COL.green, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.75 }));
  halo.scale.setScalar(0.42);
  g.add(halo);
  g.userData = { kind: "bloom", petals, halo };
  return g;
}
function bud(T) {
  const g = new T.Group();
  const body = new T.Mesh(new T.SphereGeometry(1, 16, 12), stdMat(COL.amber, COL.amber, 0.45));
  body.scale.set(0.036, 0.062, 0.036);
  body.position.y = 0.05;
  g.add(body);
  const sepal = stdMat(0x5f8a45);
  for (let k = 0; k < 3; k++) {
    const s = new T.Mesh(new T.ConeGeometry(0.014, 0.05, 6), sepal);
    s.position.set(Math.sin((k / 3) * TAU) * 0.018, 0.022, Math.cos((k / 3) * TAU) * 0.018);
    s.rotation.set(Math.cos((k / 3) * TAU) * 0.6, 0, -Math.sin((k / 3) * TAU) * 0.6);
    g.add(s);
  }
  const halo = new T.Sprite(new T.SpriteMaterial({ map: glow(), color: COL.amber, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 }));
  halo.scale.setScalar(0.34);
  halo.position.y = 0.05;
  g.add(halo);
  g.userData = { kind: "bud", halo };
  return g;
}
function twig(T, dim) {
  const g = new T.Group(), m = woodMat({ base: dim ? COL.woodDim : COL.wood, rimK: 0.3 });
  const geo = new T.CylinderGeometry(0.004, 0.009, 0.11, 6);
  const a = new T.Mesh(geo, m); a.position.set(-0.025, 0.045, 0); a.rotation.z = 0.6; g.add(a);
  const b = new T.Mesh(geo, m); b.position.set(0.02, 0.055, 0.01); b.rotation.z = -0.5; b.rotation.x = 0.3; g.add(b);
  const knob = new T.Mesh(new T.SphereGeometry(0.02, 10, 8), m); g.add(knob);
  g.userData = { kind: "twig" };
  return g;
}
function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.42, 0.22, 0.38, 0.72, 0, 1);
  s.bezierCurveTo(-0.38, 0.72, -0.42, 0.22, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
}

/* ── Mount ─────────────────────────────────────────────── */

/**
 * host: an empty, sized element. labelFor(step, { ghost }) returns the
 * button for a skill (it must carry data-skill). Returns { select(id), destroy() }.
 */
export function mountTree3d(host, { path, stepOf, selected = null, labelFor, intro = true }) {
  const T = THREE, R = getRenderer();
  const ac = new AbortController(), sig = { signal: ac.signal };
  host.classList.add("is-3d");
  host.append(canvas);
  const labels = document.createElement("div");
  labels.className = "t3-labels";
  host.append(labels);
  const hint = document.createElement("p");
  hint.className = "t3-hint";
  hint.setAttribute("aria-hidden", "true");
  hint.textContent = "Drag to turn · Click a skill";
  host.append(hint);

  const L = layout(path, stepOf);
  const rand = seeded(path.id);
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(30, 1, 0.1, 80);
  scene.add(new T.HemisphereLight(0xb9c6ee, 0x0d1326, 1.1));
  const sun = new T.DirectionalLight(0xfff4e2, 1.6);
  sun.position.set(2.5, 5, 4);
  scene.add(sun);
  const tree = new T.Group();
  scene.add(tree);
  const anyDone = path.steps.some((s) => s.status === "done");

  // Ground: a protractor ring on the drafting floor, a pool of light under the trunk.
  {
    const pts = [];
    for (let a = 0; a < 360; a += 5) {
      const len = a % 30 === 0 ? 0.13 : a % 10 === 0 ? 0.07 : 0.035, rr = 1.55, t = (a * Math.PI) / 180;
      pts.push(V(Math.sin(t) * rr, 0, Math.cos(t) * rr), V(Math.sin(t) * (rr + len), 0, Math.cos(t) * (rr + len)));
    }
    const ring = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: COL.line, transparent: true, opacity: 0.9 }));
    tree.add(ring);
    const circle = new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => V(Math.sin((i / 96) * TAU) * 1.55, 0, Math.cos((i / 96) * TAU) * 1.55))), new T.LineBasicMaterial({ color: COL.line }));
    tree.add(circle);
    const pool = new T.Mesh(new T.PlaneGeometry(2.6, 2.6), new T.MeshBasicMaterial({ map: glow(), color: anyDone ? COL.green : 0x4a5a9a, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: anyDone ? 0.28 : 0.16 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.002;
    tree.add(pool);
  }

  // ── Wood ──
  const branches = [];   // { geo, meshes, start, dur, mat, child, parent }
  const addBranch = (curve, r0, r1, { start, dur, lit = false, dash = false, dim = false, child = null, parent = null, segs }) => {
    const geo = taperedTube(curve, r0, r1, segs);
    const mat = woodMat({ base: dim ? COL.woodDim : COL.wood, rim: lit ? COL.green : COL.rimDim, rimK: lit ? 0.85 : 0.6, dash, alpha: dash ? 0.85 : 1 });
    const meshes = [new T.Mesh(geo, mat)];
    if (lit) {
      const hg = taperedTube(curve, r0 * 2.6, r1 * 2.8, segs);
      const h = new T.Mesh(hg, haloMat(COL.green, 0.22));
      h.renderOrder = 2;
      meshes.push(h);
    }
    meshes.forEach((m) => { m.geometry.setDrawRange(0, intro ? 0 : m.geometry.userData.full); tree.add(m); });
    const b = { curve, meshes, start, dur, mat, child, parent, lit, baseK: mat.uniforms.uRimK.value };
    branches.push(b);
    return b;
  };
  const TRUNK_END = 0.6;
  const tierStart = (tier) => 0.45 + (tier - 1) * 0.42;
  const roots = L.rows[0].map((s) => L.nodes.get(s.id));
  const nodeAt = new Map();     // id -> time it appears
  if (roots.length === 1) {
    addBranch(bend(V(0, 0, 0), roots[0].p, true), 0.13, 0.075, { start: 0, dur: TRUNK_END, lit: anyDone, child: roots[0].s.id, segs: 40 });
    nodeAt.set(roots[0].s.id, TRUNK_END);
  } else {
    const fork = V(0, Y0 - 0.36, 0);
    addBranch(bend(V(0, 0, 0), fork, true), 0.13, 0.085, { start: 0, dur: TRUNK_END * 0.8, lit: anyDone, segs: 36 });
    for (const r of roots) {
      addBranch(bend(fork, r.p), 0.075, 0.045, { start: TRUNK_END * 0.7, dur: 0.45, lit: anyDone, child: r.s.id, segs: 30 });
      nodeAt.set(r.s.id, TRUNK_END * 0.7 + 0.42);
    }
  }
  // Roots: a few short ones spreading on the floor.
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + rand() * 0.6, len = 0.28 + rand() * 0.18;
    addBranch(new T.CubicBezierCurve3(V(0, 0.08, 0), V(Math.sin(a) * len * 0.3, 0.02, Math.cos(a) * len * 0.3), V(Math.sin(a) * len * 0.8, 0, Math.cos(a) * len * 0.8), V(Math.sin(a) * len, -0.01, Math.cos(a) * len)),
      0.06, 0.01, { start: 0, dur: 0.5, segs: 16 });
  }
  for (const s of path.steps) {
    const c = L.nodes.get(s.id);
    if (c.tier === 1) continue;
    const st = tierStart(c.tier), dur = 0.55;
    for (const q of s.requires) {
      const parent = L.nodes.get(q);
      if (!parent) continue;
      const lit = parent.s.status === "done";
      const r0 = Math.max(0.022, 0.075 - c.tier * 0.011);
      addBranch(bend(parent.p, c.p), r0, r0 * 0.55, { start: st, dur, lit, dash: s.status === "planned", dim: !lit && s.status !== "next", child: s.id, parent: q });
    }
    nodeAt.set(s.id, st + dur * 0.92);
  }
  for (const g of L.ghosts) {
    const c = L.nodes.get(g.child), st = tierStart(c.tier) - 0.2;
    addBranch(bend(g.p, c.p), 0.012, 0.009, { start: st, dur: 0.5, dash: true, dim: true, child: g.child, segs: 24 });
    nodeAt.set(`ghost:${g.id}:${g.child}`, st);
  }

  // ── Marks on the skills ──
  const marks = [];
  for (const n of L.nodes.values()) {
    const st = n.s.status;
    const m = st === "done" ? bloom(T) : st === "next" ? bud(T) : twig(T, st === "planned");
    m.position.copy(n.p);
    m.userData.size = st === "done" ? 1.8 : st === "next" ? 1.9 : 1.5;
    tree.add(m);
    marks.push({ m, at: nodeAt.get(n.s.id) ?? 0, n });
  }
  for (const g of L.ghosts) {
    const knob = new T.Mesh(new T.SphereGeometry(0.03, 10, 8), stdMat(g.s.status === "done" ? COL.green : 0x5a6488, g.s.status === "done" ? COL.green : 0, 0.5));
    knob.position.copy(g.p);
    tree.add(knob);
    marks.push({ m: knob, at: nodeAt.get(`ghost:${g.id}:${g.child}`), n: g });
  }

  // ── Leaves, along the branches out of unlocked skills ──
  const leafSpots = [];
  const up = V(0, 1, 0), tmp = V(0, 0, 0), dir = V(0, 0, 0), q = new T.Quaternion(), roll = new T.Quaternion();
  for (const b of branches) {
    if (!b.lit) continue;
    const count = b.parent || b.child ? 6 : 8;
    for (let k = 0; k < count; k++) {
      const u = 0.25 + rand() * 0.72;
      const p = b.curve.getPointAt(u);
      const tan = b.curve.getTangentAt(u);
      const side = V(rand() - 0.5, 0, rand() - 0.5).cross(tan).normalize();
      if (side.lengthSq() < 0.01) side.set(1, 0, 0);
      dir.copy(side).multiplyScalar(0.9).addScaledVector(up, 0.55 + rand() * 0.4).normalize();
      q.setFromUnitVectors(up, dir);
      roll.setFromAxisAngle(dir, rand() * TAU);
      leafSpots.push({ p: p.addScaledVector(side, 0.02), q: roll.multiply(q).clone(), size: 0.06 + rand() * 0.05, at: b.start + b.dur * u + 0.15 });
    }
  }
  const leaves = new T.InstancedMesh(leafGeometry(), stdMat(COL.leaf, 0x1f6b45, 0.35, { side: T.DoubleSide }), Math.max(1, leafSpots.length));
  leaves.count = leafSpots.length;
  leaves.instanceMatrix.setUsage(T.DynamicDrawUsage);
  tree.add(leaves);
  const mtx = new T.Matrix4(), scl = V(1, 1, 1);
  const setLeaves = (t) => {
    leafSpots.forEach((l, i) => {
      const k = intro ? easeBack(Math.min(1, Math.max(0, (t - l.at) / 0.4))) : 1;
      scl.setScalar(Math.max(1e-4, l.size * k));
      mtx.compose(l.p, l.q, scl);
      leaves.setMatrixAt(i, mtx);
    });
    leaves.instanceMatrix.needsUpdate = true;
  };

  // ── Labels ──
  const items = [...L.nodes.values(), ...L.ghosts].map((n) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = labelFor(n.s, { ghost: !!n.ghost, child: n.child }).trim();
    const el = wrap.firstElementChild;
    el.classList.add("t3-label");
    labels.append(el);
    return { n, el, at: n.ghost ? nodeAt.get(`ghost:${n.id}:${n.child}`) : nodeAt.get(n.s.id), x: NaN, y: NaN, left: false, back: null, shown: false };
  });

  // ── State ──
  const st = {
    t: intro ? 0 : 99, yaw: 0, want: 0, vel: 0, hover: false, drag: null, hold: performance.now() + (intro ? 2600 : IDLE),
    raf: 0, last: 0, visible: true, dist: 6, w: 1, h: 1, picked: null,
  };
  const introLen = Math.max(...branches.map((b) => b.start + b.dur), ...leafSpots.map((l) => l.at + 0.4), 0) + 0.2;

  const fit = () => {
    st.w = host.clientWidth || 1; st.h = host.clientHeight || 1;
    R.setSize(st.w, st.h, false);
    cam.aspect = st.w / st.h;
    cam.updateProjectionMatrix();
    const f = Math.tan((cam.fov * Math.PI) / 360);
    const H = L.top + 0.75, W = 2 * (L.maxR + 1.15);       // room for the labels beside the outer skills
    st.dist = Math.max(H / 2 / f, W / 2 / (f * cam.aspect)) * 1.05;
    kick();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => { st.visible = e.isIntersecting; kick(); });
  io.observe(host);

  // Turn so the skill faces you, and light its branches down to the trunk.
  function select(id, { turn = true } = {}) {
    st.picked = id;
    const n = L.nodes.get(id);
    if (turn && n && n.r > 0.2) {
      const a = -n.th;
      st.want = a + TAU * Math.round((st.want - a) / TAU);
      st.vel = 0;
    }
    const route = new Set();
    const climb = (sid) => { for (const b of branches) if (b.child === sid && !route.has(b)) { route.add(b); if (b.parent) climb(b.parent); } };
    climb(id);
    // The trunk (and the fork up to the roots) are always on the way down.
    for (const b of branches) if (!b.parent && b.child && route.has(b)) for (const t of branches) if (!t.parent && !t.child && t.meshes[0].geometry.userData.segs >= 36) route.add(t);
    for (const b of branches) b.mat.uniforms.uRimK.value = route.has(b) ? Math.max(1.4, b.baseK * 1.6) : b.baseK;
    st.hold = performance.now() + 6000;
    kick();
  }

  // ── Input ──
  labels.addEventListener("pointerover", (e) => { st.hover = !!e.target.closest(".t3-label:not(.back)"); }, sig);
  host.addEventListener("pointerleave", () => { st.hover = false; st.hold = Math.max(st.hold, performance.now() + 1200); kick(); }, sig);
  labels.addEventListener("focusin", (e) => { const el = e.target.closest("[data-skill]"); if (el && L.nodes.has(el.dataset.skill)) select(el.dataset.skill); }, sig);
  canvas.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    st.drag = { x: e.clientX, want: st.want, lx: e.clientX, lt: performance.now(), id: e.pointerId };
    st.vel = 0;
    canvas.setPointerCapture(e.pointerId);
    host.classList.add("dragging");
    kick();
  }, sig);
  canvas.addEventListener("pointermove", (e) => {
    const d = st.drag;
    if (!d || e.pointerId !== d.id) return;
    const now = performance.now();
    st.want = d.want + (e.clientX - d.x) * 0.009;
    st.vel = ((e.clientX - d.lx) * 0.009) / Math.max(0.008, (now - d.lt) / 1000);
    d.lx = e.clientX; d.lt = now;
    kick();
  }, sig);
  const release = () => { if (!st.drag) return; st.drag = null; host.classList.remove("dragging"); st.hold = performance.now() + IDLE; kick(); };
  canvas.addEventListener("pointerup", release, sig);
  canvas.addEventListener("pointercancel", release, sig);
  document.addEventListener("visibilitychange", () => kick(), sig);

  const proj = V(0, 0, 0);
  function frame(now) {
    st.raf = 0;
    const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 1 / 60;
    st.last = now;
    const growing = st.t < introLen;
    if (growing) st.t += dt;

    // Turning: on its own when idle, coasting after a drag, easing to a picked skill.
    const idle = !st.hover && !st.drag && now > st.hold;
    if (idle) st.want += AUTO * dt;
    if (!st.drag && Math.abs(st.vel) > 0.01) { st.want += st.vel * dt; st.vel *= Math.exp(-dt * 3.2); } else if (!st.drag) st.vel = 0;
    st.yaw += (st.want - st.yaw) * (1 - Math.exp(-dt * 6));
    tree.rotation.y = st.yaw;

    // Growing: wood by tier, then flowers open, then leaves.
    const t = st.t;
    for (const b of branches) {
      const k = intro ? ease((t - b.start) / b.dur) : 1;
      for (const m of b.meshes) { const u = m.geometry.userData; m.geometry.setDrawRange(0, Math.round(u.segs * k) * u.step); }
    }
    for (const { m, at } of marks) {
      const k = intro ? Math.min(1, Math.max(0, (t - at) / 0.5)) : 1;
      m.scale.setScalar(Math.max(1e-4, easeBack(k) * (m.userData.size ?? 1)));
      const ud = m.userData;
      if (ud.kind === "bloom" || ud.kind === "bud") { m.rotation.order = "YXZ"; m.rotation.set(ud.kind === "bloom" ? 0.95 : 0.25, -st.yaw, 0); }
      if (ud.kind === "bloom") ud.petals.forEach((p, i) => { const o = intro ? Math.min(1, Math.max(0, (t - at - 0.12 - i * 0.06) / 0.45)) : 1; p.rotation.z = (1 - easeBack(o)) * 1.3 + 0.32; });
    }
    if (growing || !setLeaves.done) { setLeaves(t); setLeaves.done = !growing; }

    // Camera: cranes up from the roots while the tree grows.
    const c = intro ? ease(Math.min(1, t / 2.6)) : 1;
    const el = -0.04 + 0.2 * c, d = st.dist * (0.78 + 0.22 * c), ty = L.top * (0.28 + 0.2 * c) + 0.12;
    cam.position.set(0, ty + Math.sin(el) * d, Math.cos(el) * d);
    cam.lookAt(0, ty, 0);
    cam.updateMatrixWorld();
    R.render(scene, cam);

    // Labels follow their skills.
    const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
    for (const it of items) {
      const p = it.n.p;
      const x = p.x * cy + p.z * sy, z = -p.x * sy + p.z * cy;
      proj.set(x, p.y, z).project(cam);
      const sx = (proj.x + 1) * 0.5 * st.w, sy2 = (1 - proj.y) * 0.5 * st.h;
      if (!(Math.abs(sx - it.x) <= 0.3 && Math.abs(sy2 - it.y) <= 0.3)) {        // (NaN the first time)
        it.x = sx; it.y = sy2;
        it.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy2.toFixed(1)}px, 0)`;
      }
      const back = it.n.r > 0.2 && z < -it.n.r * 0.3;
      if (back !== it.back) { it.back = back; it.el.classList.toggle("back", back); it.el.tabIndex = back ? -1 : 0; }
      it.el.style.zIndex = String(Math.round(500 + z * 100));
      // Labels sit on the outer side of their skill, flipping with a little slack.
      const mid = st.w / 2;
      if (!it.left && sx < mid - 40 && it.n.r > 0.2) { it.left = true; it.el.classList.add("left"); }
      else if (it.left && (sx > mid + 40 || it.n.r <= 0.2)) { it.left = false; it.el.classList.remove("left"); }
      const show = !intro || t >= it.at;
      if (show !== it.shown) { it.shown = show; it.el.classList.toggle("in", show); }
    }

    const moving = growing || idle || st.drag || Math.abs(st.want - st.yaw) > 1e-4 || Math.abs(st.vel) > 0.01;
    if (moving && st.visible && !document.hidden) st.raf = requestAnimationFrame(frame);
    else {
      st.last = 0;
      if (!st.hover && !st.drag && st.visible) setTimeout(kick, Math.max(0, st.hold - now) + 20);
    }
  }
  function kick() { if (st.visible && !st.raf && !document.hidden && !ac.signal.aborted) st.raf = requestAnimationFrame(frame); }

  fit();
  if (selected) select(selected, { turn: !intro });
  kick();

  return {
    select,
    destroy() {
      ac.abort();
      cancelAnimationFrame(st.raf);
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => x.dispose?.()); });
      canvas.remove();
      labels.remove();
      hint.remove();
      host.classList.remove("is-3d", "dragging");
    },
  };
}
