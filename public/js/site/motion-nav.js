/**
 * motion-nav.js — in-page links (header nav, "See how it works") glide to
 * their section with a vertical motion blur that follows the scroll speed.
 *
 * The blur is the #motion-blur SVG filter in index.html, applied only while
 * a glide runs, and only to the sections actually on screen (filtering the
 * whole page would make the browser blur thousands of off-screen pixels
 * every frame). The sticky header stays sharp. Reduced-motion users get the
 * browser's normal jump.
 */

const DURATION = 750;     // ms for a full glide
const BLUR_PER_SPEED = 6; // px of blur per (px/ms) of scroll speed
const MAX_BLUR = 18;      // px, vertical blur cap

// Ease in and out (cubic), so the blur builds, peaks mid-flight, and clears.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function mountMotionNav() {
  const main = document.querySelector("main");
  const blur = document.querySelector("#motion-blur feGaussianBlur");
  if (!main || !blur) return;
  const sections = [...main.children];

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  const blurred = new Set();

  const setBlur = (px) => {
    blur.setAttribute("stdDeviation", `0 ${px.toFixed(1)}`);
    const on = px > 0.3;
    const h = innerHeight;
    for (const el of sections) {
      const r = on ? el.getBoundingClientRect() : null;
      const visible = on && r.bottom > -40 && r.top < h + 40;
      if (visible && !blurred.has(el)) { el.style.filter = "url(#motion-blur)"; blurred.add(el); }
      else if (!visible && blurred.has(el)) { el.style.filter = ""; blurred.delete(el); }
    }
  };

  const stop = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
    setBlur(0);
  };

  function glide(target) {
    stop();
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const maxY = document.documentElement.scrollHeight - innerHeight;
    const from = scrollY;
    const to = Math.min(maxY, Math.max(0, target.getBoundingClientRect().top + from - pad));
    if (Math.abs(to - from) < 2) return;

    const start = performance.now();
    let lastY = from, lastT = start;

    const step = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      const y = from + (to - from) * ease(t);
      // "instant" overrides the stylesheet's scroll-behavior: smooth.
      scrollTo({ top: y, behavior: "instant" });

      const speed = Math.abs(y - lastY) / Math.max(1, now - lastT); // px/ms
      setBlur(Math.min(MAX_BLUR, speed * BLUR_PER_SPEED));
      lastY = y; lastT = now;

      if (t < 1) frame = requestAnimationFrame(step);
      else {
        frame = 0;
        setBlur(0);
        // Match a normal anchor jump: keyboard focus continues from the section.
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    };
    frame = requestAnimationFrame(step);
  }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href^="#"]');
    if (!link || reduce.matches) return;
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (!target || !target.matches("main section")) return; // e.g. the skip link stays native
    e.preventDefault();
    history.pushState(null, "", link.hash);
    glide(target);
  });

  // The user takes over mid-glide: hand scrolling back and drop the blur.
  for (const type of ["wheel", "touchstart", "keydown", "mousedown"]) {
    addEventListener(type, stop, { passive: true });
  }
}
