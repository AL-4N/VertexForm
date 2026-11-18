/**
 * scroll-progress.js — how far through the homepage you are, as numbers
 * from 0 to 1, for everything that moves with the scroll: the side rail,
 * the progress line, the page tone, the nav highlight, the skill paths and
 * the 3D stage behind the content (stage.js).
 *
 * The page is measured only when its layout changes (a resize, the fonts
 * arriving, the story or the skill paths growing as they mount), never per
 * frame. Each frame is arithmetic on scrollY, so the scroll handlers no
 * longer force a layout one after another.
 *
 *   onScroll((s) => …)  runs once per frame while the page moves, once more
 *                       when it stops (velocity 0), and after each measure
 *   s.overall           0 at the top of the page, 1 at the bottom
 *   s.sections[key]     { progress, inside, visible, top, height, el, index }
 *                         progress: 0 as its top comes up from the bottom of
 *                                   the screen, 1 as its bottom leaves the top
 *                         inside:   0 as its top reaches the top of the
 *                                   screen, 1 as its bottom reaches the
 *                                   bottom (how far through a pinned scene)
 *   s.list              the same boxes in page order
 *   s.y, s.vh, s.max    scroll position, screen height, furthest scroll (px)
 *   s.velocity          px per second (positive going down); s.direction
 *   s.version           goes up each time the page is measured again
 *   sectionAt(s, f)     the section under a line f of the way down the screen
 *
 * Tracked: main > section (key: its id, else data-scroll) and the footer.
 * track(el, key) adds any other element (paths.js tracks its pinned run).
 */

import { smooth } from "./smooth.js";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Progress for every box at scroll position y (pure; tests/scroll.test.mjs). */
export function computeScroll(y, vh, docH, boxes) {
  const max = Math.max(0, docH - vh);
  const sections = {};
  const list = boxes.map((b, index) => {
    const s = {
      key: b.key, el: b.el, index, top: b.top, height: b.height,
      progress: clamp01((y + vh - b.top) / Math.max(1, b.height + vh)),
      inside: clamp01((y - b.top) / Math.max(1, b.height - vh)),
      visible: b.top < y + vh && b.top + b.height > y,
    };
    sections[b.key] = s;
    return s;
  });
  return { y, vh, max, overall: max > 0 ? clamp01(y / max) : 0, sections, list };
}

/** The section under a line f (0 top, 1 bottom) of the screen, or null. */
export function sectionAt(s, f = 0.5, pick = () => true) {
  const line = s.y + s.vh * f;
  return s.list.find((b) => pick(b) && b.top <= line && b.top + b.height > line) ?? null;
}

const tracked = [];
const subs = new Set();
let state = null, boxes = [], vh = 0, docH = 0, version = 0;
let raf = 0, measureRaf = 0, lastY = null, lastT = 0, velocity = 0, started = false, eventY = null;

// Reading scrollY inside an animation frame, after other code has changed
// styles, makes the browser recompute them first. Take Lenis's position when
// it's running, else the one read in the scroll event (before any writes).
const currentY = () => smooth()?.scroll ?? eventY ?? scrollY;

/** Measure the page again (cheap to call often: it waits for the next frame). */
export function refresh() {
  measureRaf ||= requestAnimationFrame(measure);
}

function measure() {
  measureRaf = 0;
  const y = scrollY;                                            // measuring reads layout anyway
  vh = innerHeight;
  docH = document.documentElement.scrollHeight;
  boxes = tracked.map(({ key, el }) => {
    const r = el.getBoundingClientRect();
    return { key, el, top: r.top + y, height: r.height };
  }).sort((a, b) => a.top - b.top);                             // page order, outer boxes first
  version++;
  update(true);
}

function update(force) {
  raf = 0;
  const y = currentY(), now = performance.now();
  const moved = y !== lastY;
  if (!moved && !force && velocity === 0) return;
  if (lastY !== null && now > lastT) {
    const v = moved ? (y - lastY) / ((now - lastT) / 1000) : 0;
    velocity = moved ? velocity + (v - velocity) * 0.5 : 0;    // a frame with no movement: stopped
  }
  lastY = y; lastT = now;
  state = computeScroll(y, vh, docH, boxes);
  state.velocity = velocity;
  state.direction = Math.sign(velocity);
  state.version = version;
  for (const fn of subs) fn(state);
  if (moved) raf = requestAnimationFrame(() => update(false));   // one more frame to see it stop
}

function start() {
  if (started) return;
  started = true;
  document.querySelectorAll("main > section, body > footer").forEach((el, i) => {
    tracked.push({ key: el.id || el.dataset.scroll || `section-${i}`, el });
  });
  measure();
  addEventListener("scroll", () => { eventY = scrollY; raf ||= requestAnimationFrame(() => update(false)); }, { passive: true });
  addEventListener("resize", refresh);
  addEventListener("load", refresh);
  document.fonts?.ready.then(refresh);
  // The page growing or shrinking (the story and skill paths mounting,
  // images, fonts) moves every section below it: measure again.
  if ("ResizeObserver" in window) new ResizeObserver(refresh).observe(document.body);
}

/** Listen to the scroll. Returns a function that stops listening. */
export function onScroll(fn) {
  start();
  subs.add(fn);
  if (state) fn(state);
  return () => subs.delete(fn);
}

/** The latest numbers (measuring first if nothing has asked yet). */
export function scrollState() {
  start();
  return state;
}

/** Track another element under key (its box shows up in s.sections[key]). */
export function track(el, key) {
  start();
  if (!el || tracked.some((t) => t.el === el)) return;
  tracked.push({ key, el });
  measure();
}
