/**
 * cloud3d.js — "What the tracker reads": the homepage's point-cloud body.
 *
 * A body made of a few thousand glowing points doing the real 3D clips
 * (data/rep3d.json, the same simulated sets the hero and the scoring tests
 * use). It condenses out of drifting dust as the section scrolls into view,
 * from the feet up. Drag turns it, with a little coast; the pointer pushes
 * the points aside like a hand through smoke and they settle back; a scan
 * ring sweeps up and down the body, lighting the points it passes in the
 * colour of the last graded rep. The tracked joints are bright nodes on
 * thin bones. Picking another exercise blows the body back into dust and
 * it re-forms doing that one.
 *
 * The readout beside it is the engine's own numbers for the clip: the
 * measured angle (live, from the 3D joints), the rep, and each rep's score
 * as it's graded.
 *
 * Three.js loads only when the section gets near the screen, and the loop
 * runs only while it's on screen. No WebGL: the section keeps its text and
 * hides the stage. Reduced motion: a still body at the first rep's lowest
 * point, which you can still turn by dragging.
 */

import { loadClips, frameAt, doneAt, deepestT, angle3, BONES } from "../figures/scene3d.js";
import { gradeColor } from "../grade.js";
import { reducedMotion } from "../ui/motion.js";

const PICK = [["full", "Squat"], ["half", "Half squat"], ["pushup", "Push-up"], ["lunge", "Lunge"], ["jack", "Jumping jack"], ["plank", "Plank"]];
const JOINTS = ["shL", "shR", "elL", "elR", "wrL", "wrR", "hipL", "hipR", "knL", "knR", "anL", "anR", "heL", "heR", "toL", "toR", "nose"];
// Limb thickness (m) by bone, roughly a body's.
const RADIUS = { "shL-elL": .045, "elL-wrL": .036, "shR-elR": .045, "elR-wrR": .036, "hipL-knL": .07, "knL-anL": .05, "hipR-knR": .07, "knR-anR": .05,
  "anL-heL": .028, "heL-toL": .026, "anL-toL": .028, "anR-heR": .028, "heR-toR": .026, "anR-toR": .028, "shL-shR": .05, "hipL-hipR": .06, "shL-hipL": .05, "shR-hipR": .05 };
const BASE = "#7f93cc";

const VERT = /* glsl */`
attribute vec3 aScatter; attribute float aDelay; attribute float aSize; attribute float aSeed;
uniform float uAssemble, uTime, uScan, uPix, uPointerOn; uniform vec3 uPointer;
varying float vGlow; varying float vAlpha;
void main() {
  float k = smoothstep(aDelay, aDelay + .32, uAssemble);
  vec3 p = mix(aScatter, position, k);
  // Dust drifts while it waits; a body breathes a little.
  p += (1. - k * .96) * .05 * vec3(sin(uTime * .6 + aSeed * 6.3), cos(uTime * .5 + aSeed * 4.1), sin(uTime * .4 + aSeed * 5.7));
  // The pointer pushes points aside like a hand through smoke.
  vec3 d = p - uPointer; float dist = length(d);
  float push = uPointerOn * smoothstep(.42, 0., dist);
  p += normalize(d + 1e-4) * push * .2;
  float band = (1. - smoothstep(0., .055, abs(p.y - uScan))) * k;
  vGlow = max(band, push * .8);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  // Depth: points behind the body's middle fade, so it reads as a volume, not a flat sticker.
  vAlpha = mix(.22, 1., k) * mix(.35, 1., smoothstep(5.6, 4.3, -mv.z));
  gl_PointSize = aSize * uPix * (1. + vGlow * .9) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
uniform vec3 uBase, uHot; varying float vGlow; varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - .5);
  if (r > .5) discard;
  float a = smoothstep(.5, .0, r);
  gl_FragColor = vec4(mix(uBase, uHot, vGlow), a * vAlpha * (.38 + .62 * vGlow));   // dense parts (the torso) stay below white
}`;

const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();   // same cloud every visit

export function mountCloud(root = document.querySelector("[data-cloud]")) {
  if (!root) return;
  const canvas = root.querySelector("canvas");
  // Load Three.js only when the section is getting close.
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    Promise.all([import("../../vendor/three/three.module.min.js"), loadClips()])
      .then(([THREE, clips]) => start(THREE, clips, root, canvas))
      .catch((err) => { console.warn("[cloud3d]", err); root.classList.add("no-gl"); });
  }, { rootMargin: "600px" });
  io.observe(root);
}

function start(THREE, clips, root, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  const small = matchMedia("(max-width: 700px)").matches;
  const dpr = Math.min(small ? 1.5 : 1.75, devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 50);
  const body = new THREE.Group();
  scene.add(body);
  const still = reducedMotion();

  // ── The particles: each belongs to a bone (a point inside its capsule),
  //    the torso (between shoulders and hips) or the head (a shell). ──
  const N = small ? 3800 : 7200;
  const kind = new Uint8Array(N), ref = new Uint8Array(N), u1 = new Float32Array(N), u2 = new Float32Array(N), u3 = new Float32Array(N);
  const pos = new Float32Array(N * 3), scatter = new Float32Array(N * 3), delay = new Float32Array(N), size = new Float32Array(N), seed = new Float32Array(N);
  const lens = BONES.map(([a, b]) => RADIUS[`${a}-${b}`] ?? .04);
  for (let i = 0; i < N; i++) {
    const r = rand();
    if (r < .62) { kind[i] = 0; ref[i] = Math.floor(rand() * BONES.length); u1[i] = rand(); u2[i] = rand() * Math.PI * 2; u3[i] = Math.sqrt(rand()) * lens[ref[i]]; }
    else if (r < .88) { kind[i] = 1; u1[i] = rand(); u2[i] = rand(); u3[i] = (rand() - .5) * .2; }
    else { kind[i] = 2; u1[i] = rand() * Math.PI * 2; u2[i] = Math.acos(2 * rand() - 1); u3[i] = .09 + rand() * .025; }
    // Dust: a wide, flattened cloud round the body.
    const th = rand() * Math.PI * 2, rr = 1.2 + rand() * 1.8;
    scatter.set([Math.cos(th) * rr, .2 + rand() * 2.4, Math.sin(th) * rr * .7], i * 3);
    size[i] = (small ? .013 : .010) + rand() * .009;          // world size (m), projected in the shader
    seed[i] = rand();
  }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", posAttr);
  geo.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const uniforms = {
    uAssemble: { value: still ? 1 : 0 }, uTime: { value: 0 }, uScan: { value: 1 }, uPix: { value: 0 },
    uPointer: { value: new THREE.Vector3(0, -10, 0) }, uPointerOn: { value: 0 },
    uBase: { value: new THREE.Color(BASE) }, uHot: { value: new THREE.Color("#2ee59d") },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const cloud = new THREE.Points(geo, mat);
  cloud.frustumCulled = false;
  body.add(cloud);

  // Joints and bones: the skeleton the tracker actually reads.
  const jPos = new Float32Array(JOINTS.length * 3);
  const jGeo = new THREE.BufferGeometry();
  jGeo.setAttribute("position", new THREE.BufferAttribute(jPos, 3).setUsage(THREE.DynamicDrawUsage));
  const jMat = new THREE.PointsMaterial({ size: small ? .05 : .042, color: 0xeef1fb, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: dotTexture(THREE) });
  const joints = new THREE.Points(jGeo, jMat);
  joints.frustumCulled = false;
  body.add(joints);
  const bPos = new Float32Array(BONES.length * 6);
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3).setUsage(THREE.DynamicDrawUsage));
  const bMat = new THREE.LineBasicMaterial({ color: 0xeef1fb, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const bones = new THREE.LineSegments(bGeo, bMat);
  bones.frustumCulled = false;
  body.add(bones);

  // The scan ring, and a floor of fading dots.
  const ringPts = [];
  for (let k = 0; k <= 96; k++) { const a = k / 96 * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a) * .5, 0, Math.sin(a) * .5)); }
  const ringMat = new THREE.LineBasicMaterial({ color: 0x2ee59d, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts), ringMat);
  body.add(ring);
  const fl = [], fc = [];
  for (let x = -16; x <= 16; x++) for (let z = -16; z <= 16; z++) {
    const px = x * .1, pz = z * .1, d = Math.hypot(px, pz);
    if (d > 1.6) continue;
    fl.push(px, 0, pz);
    const f = Math.pow(1 - d / 1.6, 1.6) * .55;
    fc.push(.18 * f + .02, .23 * f + .03, .39 * f + .07);
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute("position", new THREE.Float32BufferAttribute(fl, 3));
  fGeo.setAttribute("color", new THREE.Float32BufferAttribute(fc, 3));
  body.add(new THREE.Points(fGeo, new THREE.PointsMaterial({ size: .016, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));

  // ── Clips: centred on the hips, standing on y = 0. ──
  const prep = {};
  const mean = (c, k, j) => c.frames.reduce((s, f) => s + f[k][j], 0) / c.frames.length;
  const stand = clips.full ?? Object.values(clips)[0];
  const flip = mean(stand, "nose", 1) < mean(stand, "anL", 1) ? -1 : 1;           // make y point up
  for (const [id] of PICK) {
    const c = clips[id];
    if (!c) continue;
    const f0 = c.frames;
    const avg = (k, j) => mean(c, k, j);
    let floor = Infinity;
    for (const f of f0) for (const k of ["heL", "heR", "toL", "toR", "wrL", "wrR"]) floor = Math.min(floor, f[k][1] * flip);
    prep[id] = { c, flip, floor, cx: (avg("hipL", 0) + avg("hipR", 0)) / 2, cz: (avg("hipL", 2) + avg("hipR", 2)) / 2 };
  }
  const ids = PICK.map(([id]) => id).filter((id) => prep[id]);
  if (!ids.length) throw new Error("no clips");

  // Per-particle delay: the body forms from the feet up.
  function setDelays(P) {
    for (let i = 0; i < N; i++) {
      const y = kind[i] === 2 ? 1.7 : kind[i] === 1 ? 1.2 : (P[BONES[ref[i]][0]][1] + P[BONES[ref[i]][1]][1]) / 2;
      delay[i] = Math.min(.66, Math.max(0, y / 1.9) * .55 + rand() * .12);
    }
    geo.attributes.aDelay.needsUpdate = true;
  }

  // ── The readout ──
  const $ = (s) => root.querySelector(s);
  const out = { label: $(".cl-label"), angle: $(".cl-angle"), rep: $(".cl-rep"), score: $(".cl-score"), reps: $(".cl-reps") };
  const chips = $(".cl-chips");
  chips.innerHTML = ids.map((id) => `<button type="button" class="cl-chip" data-id="${id}">${PICK.find((p) => p[0] === id)[1]}</button>`).join("");

  const st = { id: ids[0], t: 0, yaw: -0.55, vyaw: 0, tilt: 0, pulse: 1, hot: "#2ee59d", shownDone: -2, scroll: still ? 1 : 0, on: false, last: 0 };
  function pick(id) {
    st.id = id; st.t = 0; st.shownDone = -2; prep[id].c._i = 0;
    chips.querySelectorAll(".cl-chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
    if (!still) st.pulse = .3;                              // back into dust, then re-form
    const c = prep[id].c;
    out.label.textContent = c.measure.label;
    out.reps.innerHTML = c.reps.map(() => "<i></i>").join("");
    setDelays(pose(id, still ? deepestT(c, 0) : 0));
    if (still) draw(0);
  }
  chips.addEventListener("click", (e) => { const b = e.target.closest(".cl-chip"); if (b && b.dataset.id !== st.id) pick(b.dataset.id); });

  function pose(id, t) {
    const { c, flip, floor, cx, cz } = prep[id];
    const F = frameAt(c, t), P = {};
    for (const k in F) P[k] = [F[k][0] - cx, F[k][1] * flip - floor, F[k][2] - cz];
    return P;
  }

  // ── Placing the particles on a pose ──
  const A = [0, 0, 0], U = [0, 0, 0], V = [0, 0, 0];
  function place(P) {
    const sL = P.shL, sR = P.shR, hL = P.hipL, hR = P.hipR;
    // Torso normal (for its thickness), from across-the-shoulders × down-the-spine.
    const ax = [sR[0] - sL[0], sR[1] - sL[1], sR[2] - sL[2]], dn = [(hL[0] + hR[0] - sL[0] - sR[0]) / 2, (hL[1] + hR[1] - sL[1] - sR[1]) / 2, (hL[2] + hR[2] - sL[2] - sR[2]) / 2];
    const tn = norm(cross(ax, dn));
    const head = [(P.earL[0] + P.earR[0]) / 2, (P.earL[1] + P.earR[1]) / 2 + .02, (P.earL[2] + P.earR[2]) / 2];
    for (let i = 0; i < N; i++) {
      let x, y, z;
      if (kind[i] === 0) {
        const [ka, kb] = BONES[ref[i]], a = P[ka], b = P[kb], t = u1[i];
        A[0] = b[0] - a[0]; A[1] = b[1] - a[1]; A[2] = b[2] - a[2];
        basis(A, U, V);
        const c = Math.cos(u2[i]) * u3[i], s = Math.sin(u2[i]) * u3[i];
        x = a[0] + A[0] * t + U[0] * c + V[0] * s; y = a[1] + A[1] * t + U[1] * c + V[1] * s; z = a[2] + A[2] * t + U[2] * c + V[2] * s;
      } else if (kind[i] === 1) {
        const s = u1[i], t = u2[i], w = u3[i] * Math.sin(Math.PI * (.15 + .7 * s));
        const top = lerp3(sL, sR, s), bot = lerp3(hL, hR, s);
        x = top[0] + (bot[0] - top[0]) * t + tn[0] * w; y = top[1] + (bot[1] - top[1]) * t + tn[1] * w; z = top[2] + (bot[2] - top[2]) * t + tn[2] * w;
      } else {
        const th = u1[i], ph = u2[i], r = u3[i];
        x = head[0] + r * Math.sin(ph) * Math.cos(th); y = head[1] + r * Math.cos(ph) * 1.12; z = head[2] + r * Math.sin(ph) * Math.sin(th);
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    posAttr.needsUpdate = true;
    JOINTS.forEach((k, j) => jPos.set(P[k], j * 3));
    jGeo.attributes.position.needsUpdate = true;
    BONES.forEach(([a, b], j) => { bPos.set(P[a], j * 6); bPos.set(P[b], j * 6 + 3); });
    bGeo.attributes.position.needsUpdate = true;
  }

  // ── Sizing ──
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < .9 ? 38 : 30;
    camera.updateProjectionMatrix();
    uniforms.uPix.value = (h * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));   // metres at depth 1 → pixels
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ── Drag to turn (horizontal only, so a vertical swipe still scrolls) ──
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId, live: e.pointerType === "mouse" }; if (drag.live) canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    pointerAt(e);
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.live && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag.live = true; canvas.setPointerCapture(e.pointerId); }
    if (!drag.live) return;
    drag.x = e.clientX; drag.y = e.clientY;
    st.vyaw = dx * .006;
    st.yaw += st.vyaw;
    root.classList.add("dragged");
    if (still) draw(0);
  });
  const end = () => { drag = null; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  // The pointer in 3D: where its ray meets a plane through the body, facing the camera.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3(), inv = new THREE.Matrix4();
  const pointer = { on: 0, goal: 0 };
  function pointerAt(e) {
    if (e.pointerType !== "mouse" || still) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(camDir).negate(), mid);
    if (ray.ray.intersectPlane(plane, hit)) {
      uniforms.uPointer.value.copy(hit.applyMatrix4(inv.copy(body.matrixWorld).invert()));
      pointer.goal = 1;
    }
  }
  canvas.addEventListener("pointerleave", () => { pointer.goal = 0; });

  const hotGoal = new THREE.Color(), PAPER = new THREE.Color("#eef1fb"), camDir = new THREE.Vector3(), mid = new THREE.Vector3(0, .9, 0);

  // ── The loop ──
  function draw(dt) {
    const { c } = prep[st.id];
    if (!still) st.t = (st.t + dt) % c.dur;
    const t = still ? deepestT(c, 0) : st.t;
    const P = pose(st.id, t);
    place(P);

    // Readout: the live angle, the rep under way, each score as it's graded.
    const [a, b, cc] = c.measure.joints(c.side).map((k) => P[k]);
    out.angle.textContent = `${Math.round(angle3(a, b, cc))}°`;
    const done = still ? 0 : doneAt(c, t);
    if (done !== st.shownDone) {
      st.shownDone = done;
      const dots = [...out.reps.children];
      dots.forEach((d, k) => { d.className = k <= done ? "on" : ""; d.style.background = k <= done ? gradeColor(c.reps[k].score) : ""; });
      out.rep.textContent = c.kind === "hold" ? `${Math.max(0, done + 1) * 5} s held` : `Rep ${Math.min(done + 2, c.reps.length)} of ${c.reps.length}`;
      if (done >= 0) {
        const sc = c.reps[done].score;
        st.hot = gradeColor(sc);
        out.score.textContent = sc;
        out.score.style.color = st.hot;
        if (!still) out.score.animate([{ transform: "translateY(10px) scale(.8)", opacity: 0, filter: "blur(6px)" }, { transform: "none", opacity: 1, filter: "blur(0)" }], { duration: 420, easing: "cubic-bezier(.3,.7,.4,1.2)" });
      } else { out.score.textContent = "--"; out.score.style.color = ""; }
    }

    // Assembly: scrolled in × the re-form after a switch.
    if (!still) {
      const r = root.getBoundingClientRect();
      const goal = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * .85)));
      st.scroll += (goal - st.scroll) * .06;
      st.pulse = Math.min(1, st.pulse + dt / 1500);
    }
    const asm = Math.min(st.scroll, st.pulse);
    uniforms.uAssemble.value = asm * 1.02;
    const solid = Math.max(0, (asm - .8) / .2);
    jMat.opacity = solid; bMat.opacity = solid * .22;

    // Scan ring: up and down the body, in the last grade's colour.
    const sec = performance.now() / 1000;
    uniforms.uTime.value = sec;
    const scan = .05 + (Math.sin(sec * .7) * .5 + .5) * 1.75;
    uniforms.uScan.value = scan;
    ring.position.y = scan;
    ringMat.opacity = solid * .55;
    uniforms.uHot.value.lerp(hotGoal.set(st.hot), .08);     // eases to the new grade's colour
    ringMat.color.copy(uniforms.uHot.value);
    jMat.color.copy(uniforms.uHot.value).lerp(PAPER, .55);
    pointer.on += (pointer.goal - pointer.on) * .12;
    uniforms.uPointerOn.value = pointer.on;

    // Turning: drag, then coast; when left alone, a slow drift.
    if (!drag) { st.vyaw *= .94; st.yaw += st.vyaw + (still || root.classList.contains("dragged") ? 0 : dt * .00008); }
    body.rotation.y = st.yaw;
    const lying = c.kind === "hold" || st.id === "pushup";
    camera.position.set(0, lying ? 1.25 : 1.15, lying ? 4.6 : 4.9);
    camera.lookAt(0, lying ? .45 : .88, 0);
    renderer.render(scene, camera);
  }

  function loop(now) {
    if (!st.on) return;
    requestAnimationFrame(loop);
    const dt = Math.min(50, now - (st.last || now));
    st.last = now;
    draw(dt);
  }
  new IntersectionObserver(([e]) => {
    st.on = e.isIntersecting && !still;
    st.last = 0;
    if (st.on) requestAnimationFrame(loop);
  }).observe(root);

  root.classList.add("live");
  pick(st.id);
  draw(0);
}

function dotTexture(THREE) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.35, "rgba(255,255,255,.9)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Two unit vectors at right angles to d (written into u and v). */
function basis(d, u, v) {
  const l = Math.hypot(d[0], d[1], d[2]) || 1, x = d[0] / l, y = d[1] / l, z = d[2] / l;
  // Cross with whichever axis is least parallel, so it never degenerates.
  let ux, uy, uz;
  if (Math.abs(y) < .9) { ux = z; uy = 0; uz = -x; } else { ux = 0; uy = -z; uz = y; }
  const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
  u[0] = ux; u[1] = uy; u[2] = uz;
  v[0] = y * uz - z * uy; v[1] = z * ux - x * uz; v[2] = x * uy - y * ux;
}
