/**
 * motion.js — sliding with a real motion blur.
 *
 * Every transition in the trainer goes through slide(): the element moves
 * (transform), fades if asked, and is blurred ALONG ITS DIRECTION OF TRAVEL
 * in proportion to its speed — sharp at rest, streaked mid-flight, sharp
 * again as it lands. The blur is an SVG feGaussianBlur with separate x/y
 * amounts, one small filter per moving element, removed when it stops.
 *
 * Reduced motion: elements jump straight to where they end up.
 */

const NS = "http://www.w3.org/2000/svg";
let host = null, seq = 0;
const running = new WeakMap();

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export const EASE = {
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  // Lands with a tiny overshoot: lively without wobbling.
  outBack: (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
};

function makeFilter() {
  if (!host) {
    host = document.createElementNS(NS, "svg");
    host.setAttribute("width", "0");
    host.setAttribute("height", "0");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    host.appendChild(document.createElementNS(NS, "defs"));
    document.body.appendChild(host);
  }
  const id = `vf-mb-${++seq}`;
  const f = document.createElementNS(NS, "filter");
  f.setAttribute("id", id);
  // Room around the element for the streaks.
  f.setAttribute("x", "-25%"); f.setAttribute("y", "-25%");
  f.setAttribute("width", "150%"); f.setAttribute("height", "150%");
  f.setAttribute("color-interpolation-filters", "sRGB");
  const blur = document.createElementNS(NS, "feGaussianBlur");
  blur.setAttribute("stdDeviation", "0 0");
  f.appendChild(blur);
  host.firstChild.appendChild(f);
  return { id, blur, remove: () => f.remove() };
}

/**
 * Slide an element with motion blur.
 * @param el
 * @param o { from: [x, y] px, to: [x, y] px, opacity: [from, to], scale: [from, to],
 *            duration ms, ease, strength (blur px per px/frame), maxBlur px, keep (leave the end transform on) }
 * @returns Promise that resolves when it lands (or is interrupted by another slide of the same element)
 */
export function slide(el, {
  from = [0, 0], to = [0, 0], opacity = null, scale = null, duration = 380,
  ease = EASE.out, strength = 0.9, maxBlur = 22, keep = false,
} = {}) {
  if (!el) return Promise.resolve();
  running.get(el)?.cancel();
  const end = () => {
    if (keep) el.style.transform = `translate(${to[0]}px, ${to[1]}px)${scale ? ` scale(${scale[1]})` : ""}`;
    else el.style.transform = "";
    el.style.opacity = opacity && opacity[1] !== 1 ? String(opacity[1]) : "";
    el.style.filter = "";
    el.style.willChange = "";
  };
  if (reducedMotion() || duration <= 0) { end(); return Promise.resolve(); }

  const filter = makeFilter();
  el.style.willChange = "transform, filter, opacity";
  let raf = 0, done = false, resolveFn;
  const promise = new Promise((r) => { resolveFn = r; });
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    end();
    filter.remove();
    running.delete(el);
    resolveFn();
  };

  const start = performance.now();
  let lastX = from[0], lastY = from[1], lastT = start;
  const frame = (now) => {
    if (done) return;
    const t = Math.min(1, (now - start) / duration);
    const p = ease(t);
    const x = from[0] + (to[0] - from[0]) * p;
    const y = from[1] + (to[1] - from[1]) * p;
    const s = scale ? scale[0] + (scale[1] - scale[0]) * p : null;
    el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)${s != null ? ` scale(${s.toFixed(4)})` : ""}`;
    if (opacity) el.style.opacity = String(opacity[0] + (opacity[1] - opacity[0]) * Math.min(1, t * 1.6));

    // Blur along the direction of travel, scaled by speed (px per 60 Hz frame).
    const dt = Math.max(1, now - lastT) / 16.67;
    const vx = (x - lastX) / dt, vy = (y - lastY) / dt;
    lastX = x; lastY = y; lastT = now;
    const bx = Math.min(maxBlur, Math.abs(vx) * strength), by = Math.min(maxBlur, Math.abs(vy) * strength);
    filter.blur.setAttribute("stdDeviation", `${bx.toFixed(2)} ${by.toFixed(2)}`);
    el.style.filter = bx > 0.25 || by > 0.25 ? `url(#${filter.id})` : "";

    if (t < 1) raf = requestAnimationFrame(frame);
    else finish();
  };
  // Start in the "from" state this very frame (no flash of the end state).
  el.style.transform = `translate(${from[0]}px, ${from[1]}px)${scale ? ` scale(${scale[0]})` : ""}`;
  if (opacity) el.style.opacity = String(opacity[0]);
  raf = requestAnimationFrame(frame);
  running.set(el, { cancel: finish });
  return promise;
}

/** Stop any slide on an element and put it at rest. */
export function settle(el) {
  running.get(el)?.cancel();
}
