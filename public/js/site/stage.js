/**
 * stage.js — a fixed WebGL layer behind the homepage content, for 3D that
 * travels down the page with the scroll (next: the mannequin body in
 * art/mannequin.blend, exported as a GLB).
 *
 * The canvas covers the screen behind every section and in front of the
 * page's tone layer (body::before), so a model shows through between the
 * cards and text. Nothing is created until something asks for the stage:
 * until a model is plugged in, the live page doesn't load Three.js for it
 * or draw anything. Open the homepage with ?stage to see a placeholder
 * shape and the scroll numbers it gets (stage-placeholder.js).
 *
 * Plugging a model in:
 *
 *   import { useStage } from "./stage.js";
 *   useStage(({ THREE, scene, camera }) => {
 *     const model = …;  scene.add(model);
 *     return (s, dt) => {                      // each frame the stage draws
 *       model.rotation.y = s.overall * Math.PI * 2;
 *       model.position.x = s.sections.how.progress * 2 - 1;
 *       return false;                          // true: draw another frame (still easing)
 *     };
 *   });
 *
 * s is scroll-progress.js's state (overall, sections[key].progress and
 * .inside, velocity, direction…). The stage draws only when something
 * changed: the scroll moved, the window resized, or a layer's frame
 * returned true because it's still easing toward where the scroll puts it.
 * So it idles when the page is still, and stops while the tab is hidden.
 * Without WebGL, useStage resolves to null and the caller falls back.
 */

import { onScroll, scrollState } from "./scroll-progress.js";
import { reducedMotion } from "../ui/motion.js";

const layers = [];
let ctx = null, ready = null, raf = 0, last = 0;

function request() {
  if (!raf && ctx && !document.hidden) raf = requestAnimationFrame(draw);
}

function draw(now) {
  raf = 0;
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
  last = now;
  const s = scrollState();
  let again = false;
  for (const frame of layers) if (frame(s, dt, now / 1000) === true) again = true;
  ctx.renderer.render(ctx.scene, ctx.camera);
  if (again) request(); else last = 0;
}

async function create() {
  let THREE;
  try { THREE = await import("../../vendor/three/three.module.min.js"); } catch { return null; }
  const canvas = document.createElement("canvas");
  canvas.className = "scroll-stage";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const small = () => innerWidth < 760;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !small(), powerPreference: "low-power" });
  } catch {
    canvas.remove();
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 8);
  ctx = { THREE, scene, camera, renderer, canvas, request, reduced: reducedMotion() };

  // The canvas is 100lvh tall (css/site.css), so a phone's toolbars sliding
  // in and out don't resize it mid-scroll.
  const fit = (w, h) => {
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small() ? 1.25 : 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    request();
  };
  new ResizeObserver(([e]) => fit(e.contentRect.width, e.contentRect.height)).observe(canvas);
  fit(canvas.clientWidth, canvas.clientHeight);
  onScroll(request);
  document.addEventListener("visibilitychange", request);
  return ctx;
}

/**
 * Add a layer to the stage. setup(ctx) runs once Three.js and the canvas
 * are ready (ctx: THREE, scene, camera, renderer, canvas, request, reduced)
 * and returns its per-frame function. Resolves to ctx, or null without WebGL.
 */
export async function useStage(setup) {
  ready ??= create();
  const c = await ready;
  if (!c) return null;
  const frame = setup(c);
  if (typeof frame === "function") layers.push(frame);
  request();
  return c;
}
