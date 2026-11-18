/**
 * figure-gl.js — the hero's figure in real 3D (Three.js, vendor/three): the
 * stick figure drawn in light (glow.js), with the hero's 2D canvases.
 *
 * It draws only the figure. The floor grid, protractor ring, angle marks
 * and coach notes stay on the 2D canvases above and below it (scene3d.js),
 * and both use the same camera: a Scene's camera (position, target, focal
 * length, where the target sits on the canvas) is copied onto a Three.js
 * perspective camera each frame, so everything lines up exactly.
 */

import * as THREE from "../../vendor/three/three.module.min.js";
import { GlowStick } from "./glow.js";

export class GLFigure {
  /** Throws if WebGL isn't available; callers fall back to the 2D figure. */
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.NoToneMapping;    // keep the grade colours true
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    this.figure = new GlowStick(THREE);
    this.scene.add(this.figure.object);
    this.w = 0; this.h = 0;
    this.clip = null;
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

  /**
   * Draw the figure at pose P (scene space) in colour. grow 0..1: the intro
   * (each bone drawn out from its first joint). frames: the clip's frames;
   * a new clip clears the trails so they don't streak across the change.
   */
  render(scene, cam, P, colour, { grow = 1, frames = null } = {}) {
    this.syncCamera(scene, cam);
    if (frames !== this.clip) { this.clip = frames; this.figure.resetTrails(); }
    this.figure.update(P, colour, this.camera, { grow });
    this.renderer.render(this.scene, this.camera);
  }
}
