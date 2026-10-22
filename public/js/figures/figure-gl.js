/**
 * figure-gl.js — the 3D figure as real geometry, lit and casting a soft
 * shadow (Three.js, vendor/three). Used by the homepage hero.
 *
 * It draws only the body. The floor grid, protractor ring, angle marks and
 * coach notes stay on the 2D canvases above and below it (scene3d.js),
 * and both use the same camera: a Scene's camera (position, target, focal
 * length, where the target sits on the canvas) is copied onto a Three.js
 * perspective camera each frame, so everything lines up exactly.
 *
 * Limbs are capsules (a cylinder per bone plus a sphere per joint), the
 * head a sphere, all in the grade colour with a little of it glowing, so
 * the figure reads on navy. A key light casts the shadow onto an invisible
 * floor that only shows shadows; a cool fill and a rim light give depth.
 */

import * as THREE from "../../vendor/three/three.module.min.js";
import { BONES } from "./scene3d.js";

const R_LIMB = 0.032, R_HEAD = 0.105;
const JOINTS = ["shL", "shR", "elL", "elR", "wrL", "wrR", "hipL", "hipR", "knL", "knR", "anL", "anR", "heL", "heR", "toL", "toR"];
const UP = new THREE.Vector3(0, 1, 0);

export class GLFigure {
  /** Throws if WebGL isn't available; callers fall back to the 2D figure. */
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;    // keep the grade colours true

    const scene = (this.scene = new THREE.Scene());
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

    scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x0b1125, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.2, 5, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 14 });
    key.shadow.radius = 6;
    key.shadow.bias = -0.0005;
    scene.add(key);
    this.rim = new THREE.DirectionalLight(0x9fb4ff, 1.4);
    this.rim.position.set(-3, 2.5, -3.5);
    scene.add(this.rim);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.38 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    this.material = new THREE.MeshStandardMaterial({ color: 0xeef1fb, roughness: 0.42, metalness: 0.05 });
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);
    const ball = new THREE.SphereGeometry(1, 20, 14);
    const mesh = (g) => { const m = new THREE.Mesh(g, this.material); m.castShadow = true; scene.add(m); return m; };
    this.bones = [...BONES, ["neck", "headBase"]].map(() => mesh(cyl));
    this.joints = JOINTS.map(() => mesh(ball));
    this.head = mesh(ball);
    this.tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3() };
    this.w = 0; this.h = 0;
  }

  /** Copy a scene3d Scene's camera (from scene.camera()) onto the Three.js one. */
  syncCamera(scene, cam) {
    const { w, h } = scene;
    if (w !== this.w || h !== this.h || scene.dpr !== this.dpr) {
      this.w = w; this.h = h; this.dpr = scene.dpr;
      this.renderer.setPixelRatio(scene.dpr);
      this.renderer.setSize(w, h, false);
    }
    const c = this.camera;
    c.fov = (2 * Math.atan(h / (2 * cam.focal)) * 180) / Math.PI;
    c.aspect = w / h;
    c.position.set(...cam.C);
    c.up.set(0, 1, 0);
    c.lookAt(...scene.target);
    // Put the target where the 2D scene puts it on the canvas.
    c.setViewOffset(w, h, w / 2 - cam.cx, h / 2 - cam.cy, w, h);
    c.updateProjectionMatrix();
  }

  /** Draw the body at pose P (scene space). grow 0..1 draws each bone out from its first joint. */
  render(scene, cam, P, colour, { grow = 1 } = {}) {
    this.syncCamera(scene, cam);
    this.material.color.set(colour);
    this.material.emissive.set(colour);
    this.material.emissiveIntensity = 0.16;
    this.rim.color.set(colour).lerp(new THREE.Color(0x9fb4ff), 0.5);

    const { a, b, d } = this.tmp;
    const ears = a.set(...P.earL).add(b.set(...P.earR)).multiplyScalar(0.5).clone();
    const headC = ears.clone().add(b.set(...P.nose).sub(ears).multiplyScalar(0.3));
    const neck = a.set(...P.shL).add(b.set(...P.shR)).multiplyScalar(0.5).clone();
    const headBase = neck.clone().add(d.copy(headC).sub(neck).setLength(Math.max(0, headC.distanceTo(neck) - R_HEAD)));
    const at = (k) => (k === "neck" ? neck : k === "headBase" ? headBase : new THREE.Vector3(...P[k]));

    [...BONES, ["neck", "headBase"]].forEach(([p, q], i) => {
      const m = this.bones[i];
      const s = at(p), e = at(q);
      d.copy(e).sub(s).multiplyScalar(grow);
      const len = d.length();
      m.visible = len > 1e-4;
      if (!m.visible) return;
      const r = i < 4 ? R_LIMB * 0.85 : R_LIMB;          // arms a touch slimmer
      m.position.copy(s).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(UP, d.clone().normalize());
      m.scale.set(r, len, r);
    });
    JOINTS.forEach((k, i) => {
      const m = this.joints[i];
      m.visible = grow > 0;
      m.position.set(...P[k]);
      const r = (k.startsWith("el") || k.startsWith("wr") ? R_LIMB * 0.85 : R_LIMB) * Math.min(1, grow * 1.5);
      m.scale.setScalar(Math.max(1e-4, r));
    });
    this.head.visible = grow > 0;
    this.head.position.copy(headC);
    this.head.scale.setScalar(Math.max(1e-4, R_HEAD * Math.min(1, grow * 1.3)));

    this.renderer.render(this.scene, this.camera);
  }
}
