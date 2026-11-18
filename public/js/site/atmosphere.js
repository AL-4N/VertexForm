/**
 * atmosphere.js — the space the homepage sits in: slow navy and teal smoke
 * on the 3D stage (stage.js), behind every section. Domain-warped noise,
 * drawn at a quarter of the screen's resolution (smoke is soft, so it
 * costs almost nothing) and laid behind the stage's scene each frame.
 *
 * It's brightest in the hero and quieter behind the sections; scrolling
 * moves you through it; and the hero figure's live grade colour (the
 * "vf:live" event from hero3d.js) lights the smoke around it, so a green
 * rep glows green in the air too. Runs only while the tab is visible;
 * reduced motion: one still frame.
 */

import { useStage } from "./stage.js";

const SCALE = 0.25;         // the smoke's resolution, as a share of the screen's

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const SMOKE = `precision highp float;
varying vec2 vUv;
uniform float uTime, uDrift, uIntensity;
uniform vec2 uAspect, uFocus;
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
  p.y -= uDrift;
  float t = uTime * 0.03;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2) + 0.6 * t), fbm(p + 3.5 * q + vec2(8.3, 2.8) - 0.5 * t));
  float f = fbm(p + 2.8 * r);
  float smoke = smoothstep(0.34, 0.95, f);
  vec3 deep = vec3(0.022, 0.04, 0.095);
  vec3 teal = vec3(0.06, 0.27, 0.33);
  vec3 blue = vec3(0.09, 0.16, 0.40);
  vec3 col = mix(deep, teal, smoke);
  col = mix(col, blue, clamp(length(r) - 0.65, 0.0, 1.0) * 0.55);
  vec2 d = (vUv - uFocus) * uAspect;
  float glow = exp(-dot(d, d) * 2.4);
  col += uLive * glow * (0.07 + 0.32 * smoke);
  float vig = smoothstep(1.3, 0.2, length((vUv - 0.5) * vec2(1.05, 1.0)));
  float a = (0.18 + 0.82 * smoke) * vig * uIntensity;
  gl_FragColor = vec4(col * a, a);
}`;

const BLIT = `varying vec2 vUv; uniform sampler2D tMap; void main() { gl_FragColor = texture2D(tMap, vUv); }`;

export function mountAtmosphere() {
  return useStage((ctx) => {
    const { THREE, passes, reduced } = ctx;
    const quad = new THREE.PlaneGeometry(2, 2);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const live = new THREE.Color(0xeef1fb), want = new THREE.Color(0xeef1fb);
    const u = {
      uTime: { value: 0 }, uDrift: { value: 0 }, uIntensity: { value: 1 },
      uAspect: { value: new THREE.Vector2(1, 1) }, uFocus: { value: new THREE.Vector2(0.5, 0.5) }, uLive: { value: live },
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

    let lastSmoke = -1, w = 0, h = 0;
    passes.push((r) => {
      if (ctx.width !== w || ctx.height !== h) {          // the stage measures itself on resize
        w = ctx.width; h = ctx.height;
        rt.setSize(Math.max(64, Math.round(w * SCALE)), Math.max(64, Math.round(h * SCALE)));
        u.uAspect.value.set(w / Math.max(1, h), 1);
        lastSmoke = -1;
      }
      if (lastSmoke !== u.uTime.value) {
        lastSmoke = u.uTime.value;
        r.setRenderTarget(rt); r.clear(); r.render(smokeScene, cam); r.setRenderTarget(null);
      }
      r.render(blitScene, cam);
    });

    return (s, dt, t) => {
      // Brightest over the hero, quieter behind the sections.
      const hero = s.sections.hero;
      const inHero = hero ? 1 - Math.min(1, Math.max(0, (s.y - hero.top) / Math.max(1, hero.height))) : 0;
      u.uIntensity.value = 0.5 + 0.5 * inHero;
      u.uDrift.value = (s.y / Math.max(1, s.vh)) * 0.22;           // scrolling moves you through it
      // The light sits on the hero figure (the middle of the hero) and leaves with it.
      if (hero) u.uFocus.value.set(0.5, 1 - (hero.top - s.y + hero.height * 0.5) / Math.max(1, s.vh));
      live.lerp(want, Math.min(1, dt * 4));
      if (!reduced) u.uTime.value = t;
      return !reduced && !document.hidden;                        // the smoke keeps drifting
    };
  });
}
