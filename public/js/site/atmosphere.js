/**
 * atmosphere.js — the space the homepage sits in, on the 3D stage
 * (stage.js), behind every section:
 *
 *   smoke   slow domain-warped noise in deep navy, teal, blue and green,
 *           with a faint warm vein, drawn at a quarter of the screen's
 *           resolution (smoke is soft, so it costs almost nothing)
 *   ink     a fluid (ink.js) over it: moving the pointer pours ink in the
 *           brand's colours along its path and stirs it, scrolling stirs
 *           it too, and now and then a drop falls in on its own, so the
 *           background is never still and never one colour
 *
 * The smoke is brightest in the hero and leans away from the pointer;
 * scrolling moves you through it; the hero figure's live grade colour
 * (the "vf:live" event from hero3d.js) lights the smoke around it. Runs
 * only while the tab is visible. Reduced motion: one still frame of smoke,
 * no ink.
 */

import { useStage } from "./stage.js";
import { Ink } from "./ink.js";

const SCALE = 0.25;         // the smoke's resolution, as a share of the screen's
// Ink colours: the grade scale and the cool end of the brand. Never purple.
const PALETTE = ["#2ee59d", "#39c6d6", "#c6ef4e", "#3a7bf0", "#ffbe3d", "#ff7a45", "#1fb5a4"];

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const SMOKE = `precision highp float;
varying vec2 vUv;
uniform float uTime, uDrift, uIntensity, uPull;
uniform vec2 uAspect, uFocus, uPointer;
uniform vec3 uLive;
float hash(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
void main() {
  vec2 p = (vUv - 0.5) * uAspect * 1.8;
  // The smoke leans away from the pointer.
  vec2 dp = (vUv - uPointer) * uAspect;
  p += normalize(dp + 1e-4) * exp(-dot(dp, dp) * 9.0) * 0.35 * uPull;
  p.y -= uDrift;
  float t = uTime * 0.03;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2) + 0.6 * t), fbm(p + 3.5 * q + vec2(8.3, 2.8) - 0.5 * t));
  float f = fbm(p + 2.8 * r);
  float smoke = smoothstep(0.32, 0.95, f);
  // More than one colour: the warp itself picks between teal, deep blue and green, with a faint warm vein.
  vec3 deep = vec3(0.022, 0.04, 0.095);
  vec3 teal = vec3(0.06, 0.29, 0.34);
  vec3 blue = vec3(0.09, 0.16, 0.42);
  vec3 green = vec3(0.05, 0.30, 0.17);
  vec3 warm = vec3(0.36, 0.22, 0.06);
  vec3 tint = mix(teal, blue, smoothstep(0.35, 0.75, q.x));
  tint = mix(tint, green, smoothstep(0.55, 0.85, q.y) * 0.8);
  vec3 col = mix(deep, tint, smoke);
  col += warm * smoothstep(0.78, 0.95, r.x) * smoke * 0.55;
  vec2 d = (vUv - uFocus) * uAspect;
  col += uLive * exp(-dot(d, d) * 2.4) * (0.07 + 0.32 * smoke);
  col += vec3(0.07, 0.12, 0.14) * exp(-dot(dp, dp) * 14.0) * uPull;   // the pointer lights the smoke a little
  float vig = smoothstep(1.3, 0.2, length((vUv - 0.5) * vec2(1.05, 1.0)));
  float a = (0.18 + 0.82 * smoke) * vig * uIntensity;
  gl_FragColor = vec4(col * a, a);
}`;

const BLIT = `varying vec2 vUv; uniform sampler2D tMap; void main() { gl_FragColor = texture2D(tMap, vUv); }`;

export function mountAtmosphere() {
  return useStage((ctx) => {
    const { THREE, passes, reduced, renderer, canvas } = ctx;
    const quad = new THREE.PlaneGeometry(2, 2);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const live = new THREE.Color(0xeef1fb), want = new THREE.Color(0xeef1fb);
    const u = {
      uTime: { value: 0 }, uDrift: { value: 0 }, uIntensity: { value: 1 }, uPull: { value: 0 },
      uAspect: { value: new THREE.Vector2(1, 1) }, uFocus: { value: new THREE.Vector2(0.5, 0.5) },
      uPointer: { value: new THREE.Vector2(-9, -9) }, uLive: { value: live },
    };
    const smoke = new THREE.Mesh(quad, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: SMOKE, depthTest: false, depthWrite: false }));
    const smokeScene = new THREE.Scene(); smokeScene.add(smoke);
    const rt = new THREE.WebGLRenderTarget(64, 64, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    const blit = new THREE.Mesh(quad, new THREE.ShaderMaterial({
      uniforms: { tMap: { value: rt.texture } }, vertexShader: VERT, fragmentShader: BLIT,
      transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
    }));
    const blitScene = new THREE.Scene(); blitScene.add(blit);
    document.addEventListener("vf:live", (e) => { want.set(e.detail); });

    // The ink: on screens with a real GPU, and not for reduced motion.
    const ink = reduced ? null : Ink.create(THREE, renderer, { dye: innerWidth < 760 ? 256 : 512 });
    const colours = PALETTE.map((c) => new THREE.Color(c).multiplyScalar(0.085));
    let hue = 0, hueAt = 0, nextDrop = 1.5;
    const pointer = { x: -9, y: -9, px: 0, py: 0, moved: false, active: false, last: 0 };
    let rect = canvas.getBoundingClientRect();
    if (!reduced) {
      addEventListener("pointermove", (e) => {
        const x = (e.clientX - rect.left) / Math.max(1, rect.width), y = 1 - (e.clientY - rect.top) / Math.max(1, rect.height);
        if (!pointer.active) { pointer.px = x; pointer.py = y; }
        Object.assign(pointer, { x, y, moved: true, active: true, last: performance.now() });
        ctx.request();
      }, { passive: true });
      document.addEventListener("pointerleave", () => { pointer.active = false; });
    }

    let lastSmoke = -1, w = 0, h = 0;
    passes.push((r) => {
      if (ctx.width !== w || ctx.height !== h) {          // the stage measures itself on resize
        w = ctx.width; h = ctx.height;
        rt.setSize(Math.max(64, Math.round(w * SCALE)), Math.max(64, Math.round(h * SCALE)));
        u.uAspect.value.set(w / Math.max(1, h), 1);
        rect = canvas.getBoundingClientRect();
        ink?.resize(w, h);
        lastSmoke = -1;
      }
      if (lastSmoke !== u.uTime.value) {
        lastSmoke = u.uTime.value;
        r.setRenderTarget(rt); r.clear(); r.render(smokeScene, cam); r.setRenderTarget(null);
      }
      r.render(blitScene, cam);
      ink?.draw(r, 0.9 + 0.3 * u.uIntensity.value);
    });

    return (s, dt, t) => {
      // Brightest over the hero, still clearly there behind the sections.
      const hero = s.sections.hero;
      const inHero = hero ? 1 - Math.min(1, Math.max(0, (s.y - hero.top) / Math.max(1, hero.height))) : 0;
      u.uIntensity.value = 0.72 + 0.28 * inHero;
      u.uDrift.value = (s.y / Math.max(1, s.vh)) * 0.22;           // scrolling moves you through it
      // The light sits on the hero figure (the middle of the hero) and leaves with it.
      if (hero) u.uFocus.value.set(0.5, 1 - (hero.top - s.y + hero.height * 0.5) / Math.max(1, s.vh));
      live.lerp(want, Math.min(1, dt * 4));
      // The smoke leans from the pointer while it moves, and settles after.
      const recent = pointer.active && performance.now() - pointer.last < 1200 ? 1 : 0;
      u.uPull.value += (recent - u.uPull.value) * Math.min(1, dt * 3);
      u.uPointer.value.set(pointer.x, pointer.y);
      if (!reduced) u.uTime.value = t;

      if (ink) {
        if (t - hueAt > 0.35) { hueAt = t; hue = (hue + 1) % colours.length; }
        if (pointer.moved) {
          pointer.moved = false;
          const dx = (pointer.x - pointer.px) * (w / Math.max(1, h) >= 1 ? 1 : w / h), dy = pointer.y - pointer.py;
          if (Math.abs(dx) + Math.abs(dy) > 0.0004) ink.splat(pointer.x, pointer.y, dx * 6000, dy * 6000, colours[hue]);
          pointer.px = pointer.x; pointer.py = pointer.y;
        }
        // Scrolling stirs it: a push up or down somewhere across the screen.
        if (Math.abs(s.velocity) > 40) ink.splat(Math.random(), 0.2 + Math.random() * 0.6, 0, Math.max(-900, Math.min(900, s.velocity * 0.5)), null, 0.012);
        // And now and then a drop falls in on its own.
        nextDrop -= dt;
        if (nextDrop <= 0) {
          nextDrop = 1.4 + Math.random() * 2.2;
          const a = Math.random() * Math.PI * 2;
          ink.splat(0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.8, Math.cos(a) * 420, Math.sin(a) * 420, colours[Math.floor(Math.random() * colours.length)], 0.004);
        }
        ink.step(Math.min(dt, 1 / 30));
      }
      return !reduced && !document.hidden;                        // the smoke and ink keep moving
    };
  });
}
