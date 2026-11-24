/**
 * ink.js — ink in water, behind the homepage: a small stable-fluids
 * simulation on the GPU (velocity, pressure and dye fields; vorticity to
 * keep it curling; a pressure solve so it swirls instead of spreading).
 * atmosphere.js steps it each frame and lays its dye over the smoke.
 *
 *   ink.splat(x, y, dx, dy, colour)  push the fluid at (x, y) (0..1 of the
 *                                    canvas, y up) with velocity (dx, dy),
 *                                    dropping in some dye
 *   ink.step(dt)                     move it on
 *   ink.draw(renderer)               add its dye to what's on the canvas
 *
 * Built only where the GPU can render to half-float textures; otherwise
 * Ink.create returns null and the smoke stays on its own.
 */

const SIM = 128;            // velocity and pressure grid (shorter side)
const PRESSURE_ITERATIONS = 18;
const CURL = 10;            // vorticity: gentle eddies, not a churn
const VELOCITY_FADE = 0.7, DYE_FADE = 1.9, PRESSURE_KEEP = 0.8;    // trails clear in about a second

const BASE_VERT = `uniform vec2 texelSize;
varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
void main() {
  vUv = uv;
  vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;
const HEAD = `precision highp float; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;`;
const FRAG = {
  splat: `${HEAD} uniform sampler2D uTarget; uniform float aspect; uniform vec3 color; uniform vec2 point; uniform float radius;
    void main() { vec2 p = vUv - point; p.x *= aspect; vec3 s = exp(-dot(p, p) / radius) * color; gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + s, 1.0); }`,
  advect: `${HEAD} uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 simTexel; uniform float dt; uniform float fade;
    void main() { vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * simTexel; gl_FragColor = texture2D(uSource, coord) / (1.0 + fade * dt); }`,
  curl: `${HEAD} uniform sampler2D uVelocity;
    void main() { float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y, T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0); }`,
  vorticity: `${HEAD} uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
    void main() { float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x, T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x, C = texture2D(uCurl, vUv).x;
      vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 0.0001; f *= curl * C; f.y *= -1.0;
      vec2 v = texture2D(uVelocity, vUv).xy + f * dt; gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0); }`,
  divergence: `${HEAD} uniform sampler2D uVelocity;
    void main() { float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x, T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0); }`,
  scale: `${HEAD} uniform sampler2D uTexture; uniform float value; void main() { gl_FragColor = value * texture2D(uTexture, vUv); }`,
  pressure: `${HEAD} uniform sampler2D uPressure; uniform sampler2D uDivergence;
    void main() { float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      gl_FragColor = vec4((L + R + B + T - texture2D(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0); }`,
  gradient: `${HEAD} uniform sampler2D uPressure; uniform sampler2D uVelocity;
    void main() { float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      gl_FragColor = vec4(texture2D(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0); }`,
  // The dye as ink in dark water: faint, never past 32% cover, premultiplied.
  display: `${HEAD} uniform sampler2D uTexture; uniform float strength;
    void main() { vec3 c = texture2D(uTexture, vUv).rgb * strength; c = c / (1.0 + c); float m = max(c.r, max(c.g, c.b));
      float a = clamp(m * 0.9, 0.0, 0.32); gl_FragColor = vec4(c * (a / max(m, 1e-4)) * 0.7, a); }`,
};

export class Ink {
  /** An Ink for this renderer, or null where the GPU can't run it. */
  static create(THREE, renderer, { dye = 512 } = {}) {
    const gl = renderer.getContext();
    if (!renderer.capabilities.isWebGL2 || !gl.getExtension("EXT_color_buffer_float")) return null;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    if (/swiftshader|llvmpipe|software/i.test(name)) return null;      // a software GPU: too slow for this
    return new Ink(THREE, renderer, dye);
  }

  constructor(THREE, renderer, dyeRes) {
    this.T = THREE; this.r = renderer; this.dyeRes = dyeRes;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.mats = Object.fromEntries(Object.entries(FRAG).map(([k, frag]) => [k, new THREE.ShaderMaterial({
      uniforms: { texelSize: { value: new THREE.Vector2() } }, vertexShader: BASE_VERT, fragmentShader: frag, depthTest: false, depthWrite: false,
    })]));
    const disp = this.mats.display;
    Object.assign(disp, { transparent: true, premultipliedAlpha: true });
    this.aspect = 1;
    this.resize(16, 9);
  }

  /** Size the grids to the canvas's shape (call when it changes). */
  resize(w, h) {
    const aspect = w / Math.max(1, h);
    if (Math.abs(aspect - this.aspect) < 0.01 && this.vel) return;
    this.aspect = aspect;
    const T = this.T;
    const size = (res) => (aspect >= 1 ? [Math.round(res * aspect), res] : [res, Math.round(res / aspect)]);
    const rt = ([x, y], filter) => new T.WebGLRenderTarget(x, y, { type: T.HalfFloatType, format: T.RGBAFormat, minFilter: filter, magFilter: filter, depthBuffer: false, stencilBuffer: false });
    const pair = (s, f) => ({ read: rt(s, f), write: rt(s, f), swap() { [this.read, this.write] = [this.write, this.read]; } });
    for (const f of [this.vel, this.dye, this.pres]) if (f) { f.read.dispose(); f.write.dispose(); }
    this.div?.dispose(); this.curlT?.dispose();
    const sim = size(SIM), dye = size(this.dyeRes);
    this.vel = pair(sim, T.LinearFilter);
    this.dye = pair(dye, T.LinearFilter);
    this.pres = pair(sim, T.NearestFilter);
    this.div = rt(sim, T.NearestFilter);
    this.curlT = rt(sim, T.NearestFilter);
    this.simTexel = new T.Vector2(1 / sim[0], 1 / sim[1]);
    this.dyeTexel = new T.Vector2(1 / dye[0], 1 / dye[1]);
  }

  pass(name, uniforms, target, texel = this.simTexel) {
    const m = this.mats[name];
    m.uniforms.texelSize.value.copy(texel);
    for (const [k, v] of Object.entries(uniforms)) (m.uniforms[k] ??= { value: v }).value = v;
    this.quad.material = m;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  splat(x, y, dx, dy, colour, radius = 0.0022) {
    const T = this.T;
    this.pass("splat", { uTarget: this.vel.read.texture, aspect: this.aspect, point: new T.Vector2(x, y), color: new T.Vector3(dx, dy, 0), radius }, this.vel.write);
    this.vel.swap();
    if (colour) {
      this.pass("splat", { uTarget: this.dye.read.texture, aspect: this.aspect, point: new T.Vector2(x, y), color: new T.Vector3(colour.r, colour.g, colour.b), radius }, this.dye.write, this.dyeTexel);
      this.dye.swap();
    }
  }

  step(dt) {
    const v = this.vel;
    this.pass("curl", { uVelocity: v.read.texture }, this.curlT);
    this.pass("vorticity", { uVelocity: v.read.texture, uCurl: this.curlT.texture, curl: CURL, dt }, v.write); v.swap();
    this.pass("divergence", { uVelocity: v.read.texture }, this.div);
    this.pass("scale", { uTexture: this.pres.read.texture, value: PRESSURE_KEEP }, this.pres.write); this.pres.swap();
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      this.pass("pressure", { uPressure: this.pres.read.texture, uDivergence: this.div.texture }, this.pres.write); this.pres.swap();
    }
    this.pass("gradient", { uPressure: this.pres.read.texture, uVelocity: v.read.texture }, v.write); v.swap();
    this.pass("advect", { uVelocity: v.read.texture, uSource: v.read.texture, simTexel: this.simTexel, dt, fade: VELOCITY_FADE }, v.write); v.swap();
    this.pass("advect", { uVelocity: v.read.texture, uSource: this.dye.read.texture, simTexel: this.simTexel, dt, fade: DYE_FADE }, this.dye.write, this.dyeTexel); this.dye.swap();
    this.r.setRenderTarget(null);
  }

  /** Add the dye to the canvas (the current target), as light. */
  draw(renderer, strength = 1) {
    this.pass("display", { uTexture: this.dye.read.texture, strength }, null, this.dyeTexel);
  }
}
