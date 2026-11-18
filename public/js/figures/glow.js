/**
 * glow.js — the stick figure drawn in light, for the homepage's 3D (the
 * hero, figure-gl.js; the stage, site/stage-body.js). The same figure as
 * the 2D drawings, built from what the tracker sees:
 *
 *   bones    a thin white-hot core inside a soft tube of light in the live
 *            grade colour (bright where you look straight at it, fading to
 *            nothing at its edges)
 *   head     a ring that always faces you, like the drawn figure's head
 *   joints   a bright point on every tracked joint
 *   trails   faint lines behind the hands and feet, so a rep leaves a
 *            light-painting of the path it took
 *   floor    a pool of the figure's light on the floor beneath it
 *
 * All additive, so it reads as light on the dark page. Points are scene
 * space (scene3d.js: metres, y up, the floor at 0).
 */

import { BONES } from "./scene3d.js";

const R_CORE = 0.011, R_HALO = 0.05, R_HEAD = 0.1;
const JOINTS = ["shL", "shR", "elL", "elR", "wrL", "wrR", "hipL", "hipR", "knL", "knR", "anL", "anR", "toL", "toR"];
const TRAILS = ["wrL", "wrR", "anL", "anR", "head"];
const TRAIL_N = 26;                         // samples kept per trail
const TRAIL_EVERY = 34;                     // ms between samples

/** A soft round light (white middle, fading out), drawn once on a canvas. */
function glowTexture(THREE) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.12, "rgba(255,255,255,.85)");
  r.addColorStop(0.3, "rgba(255,255,255,.28)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Light that's brightest where you look straight at the surface: a tube of glow. */
function haloMaterial(THREE) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0.85 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = abs(dot(normalize(vN), normalize(vV)));
        float a = pow(f, 2.6) * uAlpha;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
}

export class GlowStick {
  constructor(THREE, { trails = true } = {}) {
    const T = (this.T = THREE);
    this.group = new T.Group();
    this.colour = new T.Color(0xeef1fb);
    this.white = new T.Color(0xffffff);
    const tube = new T.CylinderGeometry(1, 1, 1, 18, 1, true);
    this.coreMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false });
    this.haloMat = haloMaterial(T);
    const pairs = [...BONES, ["neck", "headBase"]];
    this.bones = pairs.map(([a, b]) => {
      const core = new T.Mesh(tube, this.coreMat), halo = new T.Mesh(tube, this.haloMat);
      core.renderOrder = 2; halo.renderOrder = 1;
      this.group.add(halo, core);
      return { a, b, core, halo, far: false };
    });
    const glow = glowTexture(T);
    this.jointMat = new T.SpriteMaterial({ map: glow, color: 0xffffff, blending: T.AdditiveBlending, transparent: true, depthWrite: false });
    this.joints = JOINTS.map((k) => { const s = new T.Sprite(this.jointMat); s.renderOrder = 3; this.group.add(s); return { k, s }; });
    // The head: a ring facing the camera, glowing.
    this.head = new T.Group();
    this.headCore = new T.Mesh(new T.TorusGeometry(R_HEAD, 0.009, 8, 56), this.coreMat);
    this.headHalo = new T.Mesh(new T.TorusGeometry(R_HEAD, 0.04, 12, 56), this.haloMat);
    this.head.add(this.headHalo, this.headCore);
    this.group.add(this.head);
    // The pool of light on the floor.
    this.poolMat = new T.MeshBasicMaterial({ map: glow, color: 0xffffff, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.3 });
    this.pool = new T.Mesh(new T.PlaneGeometry(1.8, 1.8), this.poolMat);
    this.pool.rotation.x = -Math.PI / 2;
    this.group.add(this.pool);
    // Trails behind the hands, feet and head.
    this.trails = trails ? TRAILS.map(() => []) : null;
    if (trails) {
      const n = TRAILS.length * (TRAIL_N - 1) * 2;
      this.trailPos = new Float32Array(n * 3);
      this.trailCol = new Float32Array(n * 4);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(this.trailPos, 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute("color", new T.BufferAttribute(this.trailCol, 4).setUsage(T.DynamicDrawUsage));
      this.trailGeo = g;
      this.trailLines = new T.LineSegments(g, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      this.trailLines.frustumCulled = false;
      this.group.add(this.trailLines);
      this.lastSample = 0;
    }
    this.v = { a: new T.Vector3(), b: new T.Vector3(), d: new T.Vector3(), up: new T.Vector3(0, 1, 0) };
  }

  get object() { return this.group; }

  /** Forget the trails (a new clip, or the figure jumped). */
  resetTrails() { if (this.trails) this.trails.forEach((t) => (t.length = 0)); }

  /**
   * Draw pose P in colour (a CSS colour) for camera. grow 0..1 draws each
   * bone out from its first joint (the intro); fade 0..1 dims the whole figure.
   */
  update(P, colour, camera, { grow = 1, fade = 1, now = performance.now() } = {}) {
    const T = this.T, { a, b, d, up } = this.v;
    this.colour.set(colour);
    const core = this.coreMat.color.copy(this.white).lerp(this.colour, 0.22);
    this.coreMat.opacity = fade;
    this.haloMat.uniforms.uColor.value.copy(this.colour);
    this.haloMat.uniforms.uAlpha.value = 0.85 * fade;
    this.jointMat.color.copy(core);
    this.jointMat.opacity = fade;
    this.poolMat.color.copy(this.colour);
    this.poolMat.opacity = 0.32 * fade * grow;

    const ears = a.set(...P.earL).add(b.set(...P.earR)).multiplyScalar(0.5).clone();
    const headC = ears.clone().add(b.set(...P.nose).sub(ears).multiplyScalar(0.3));
    const neck = a.set(...P.shL).add(b.set(...P.shR)).multiplyScalar(0.5).clone();
    const headBase = neck.clone().add(d.copy(headC).sub(neck).setLength(Math.max(0, headC.distanceTo(neck) - R_HEAD)));
    const at = (k) => (k === "neck" ? neck : k === "headBase" ? headBase : new T.Vector3(...P[k]));

    for (const bone of this.bones) {
      const s = at(bone.a), e = at(bone.b);
      d.copy(e).sub(s).multiplyScalar(grow);
      const len = d.length();
      const show = len > 1e-4;
      bone.core.visible = bone.halo.visible = show;
      if (!show) continue;
      const q = new T.Quaternion().setFromUnitVectors(up, d.clone().normalize());
      for (const [m, r] of [[bone.core, R_CORE], [bone.halo, R_HALO]]) {
        m.position.copy(s).addScaledVector(d, 0.5);
        m.quaternion.copy(q);
        m.scale.set(r, len, r);
      }
    }
    for (const { k, s } of this.joints) {
      s.visible = grow > 0;
      s.position.set(...P[k]);
      const big = k.startsWith("to") ? 0.07 : 0.1;
      s.scale.setScalar(big * Math.min(1, grow * 1.5));
    }
    this.head.visible = grow > 0;
    this.head.position.copy(headC);
    this.head.quaternion.copy(camera.quaternion);          // always faces you
    this.head.scale.setScalar(Math.max(1e-4, Math.min(1, grow * 1.3)));
    const hips = a.set(...P.hipL).add(b.set(...P.hipR)).multiplyScalar(0.5);
    this.pool.position.set(hips.x, 0.003, hips.z);

    if (this.trails) this.updateTrails(P, headC, now, grow >= 1 ? fade : 0);
  }

  updateTrails(P, headC, now, alpha) {
    if (now - this.lastSample >= TRAIL_EVERY) {
      this.lastSample = now;
      TRAILS.forEach((k, i) => {
        const p = k === "head" ? headC.toArray() : P[k].slice();
        const t = this.trails[i];
        t.push(p);
        if (t.length > TRAIL_N) t.shift();
      });
    }
    const c = this.colour;
    let v = 0;
    TRAILS.forEach((k, i) => {
      const t = this.trails[i];
      for (let j = 0; j < TRAIL_N - 1; j++) {
        const p0 = t[j], p1 = t[j + 1];
        const ok = p0 && p1;
        for (const [p, w] of [[p0, j], [p1, j + 1]]) {
          const o = v * 3, oc = v * 4;
          if (ok) { this.trailPos[o] = p[0]; this.trailPos[o + 1] = p[1]; this.trailPos[o + 2] = p[2]; }
          else { this.trailPos[o] = this.trailPos[o + 1] = this.trailPos[o + 2] = 0; }
          const fadeIn = ok ? Math.pow(w / (t.length - 1 || 1), 1.6) * 0.55 * alpha : 0;
          this.trailCol[oc] = c.r; this.trailCol[oc + 1] = c.g; this.trailCol[oc + 2] = c.b; this.trailCol[oc + 3] = fadeIn;
          v++;
        }
      }
    });
    this.trailGeo.attributes.position.needsUpdate = true;
    this.trailGeo.attributes.color.needsUpdate = true;
  }
}
