/**
 * ex-ring.js — the exercises section as a ring of cards in 3D (wide
 * screens, motion allowed): all eighteen exercises stand on a tilted ring
 * around the section's heading. The section holds still while you scroll
 * through it and the scroll turns the ring; it also turns slowly on its
 * own, pauses while the pointer is on a card, and a card that gets
 * keyboard focus turns to the front. A reading under the ring names the
 * card at the front.
 *
 * The cards are the page's own: the five exercise cards (clicking opens
 * the 3D popup, expop.js) and the small figures of the other thirteen
 * (each a link to its plate in the library), moved into the ring. On a
 * narrow screen, with reduced motion or without JavaScript they stay as
 * the grid and the strip of small figures.
 *
 * Cards always face you (they stand on the ring, they don't turn with
 * it); depth comes from the browser's own 3D, so cards behind the heading
 * pass behind it. One transform per card per frame, only while the
 * section is on screen.
 */

import { onScroll } from "./scroll-progress.js";
import { reducedMotion } from "../ui/motion.js";
import { renderPictos } from "../figures/pictos.js";

const TILT = 12 * (Math.PI / 180);   // the ring leans toward you: the front of it lower
const AUTO = 0.05;                   // radians a second, on its own
const SCROLL_TURN = Math.PI * 1.5;   // how far the whole scroll through the section turns it

export function mountExerciseRing(section = document.getElementById("exercises")) {
  if (!section || reducedMotion() || !matchMedia("(min-width: 1000px)").matches) return;
  const grid = section.querySelector(".ex-grid");
  const strip = section.querySelector(".mini-plates");
  const head = section.querySelector(".section-head");
  if (!grid || !strip || !head) return;

  // Build the run (tall, so the section pins) and the stage inside it.
  const run = document.createElement("div");
  run.className = "ex-ring-run";
  run.innerHTML = `<div class="ex-ring-stage"><div class="ex-ring"></div>
    <p class="ex-ring-read" aria-hidden="true"><span class="ex-ring-n">01</span> / <span class="ex-ring-of"></span> <b class="ex-ring-name"></b></p>
    <p class="ex-ring-hint" aria-hidden="true">Scroll to turn · Click a card</p></div>`;
  const ring = run.querySelector(".ex-ring");
  const centre = document.createElement("div");
  centre.className = "ex-ring-centre";
  centre.append(head);
  ring.append(centre);
  const cards = [...grid.querySelectorAll(".ex-card"), ...[...strip.querySelectorAll("li > a")]];
  const items = cards.map((card, i) => {
    const item = document.createElement("div");
    item.className = "ex-ring-item";
    if (card.tagName === "A") {
      card.classList.add("ex-ring-mini");
      // The strip drew these plain; on a card they get the grade colours like the rest.
      const fig = card.querySelector("[data-picto]");
      if (fig) { fig.removeAttribute("data-picto-plain"); fig.innerHTML = ""; }
    }
    card.style.setProperty("--fig", `"FIG ${String(i + 1).padStart(2, "0")}"`);
    item.append(card);
    ring.append(item);
    return { item, card, name: (card.querySelector("h3") ?? card.querySelector("span:last-child"))?.textContent.trim() ?? "" };
  });
  (grid.closest(".wrap") ?? grid).after(run);        // full width: the ring is wider than the page column
  renderPictos(ring);
  grid.hidden = true;
  section.querySelector(".also-ex")?.setAttribute("hidden", "");
  section.classList.add("ring-on");
  run.querySelector(".ex-ring-of").textContent = String(items.length).padStart(2, "0");

  const N = items.length;
  const st = { auto: 0, scroll: 0, shown: 0, hover: false, focus: null, visible: false, raf: 0, last: 0, R: 600, front: -1 };
  const readN = run.querySelector(".ex-ring-n"), readName = run.querySelector(".ex-ring-name");

  const size = () => { st.R = Math.max(480, Math.min(680, innerWidth * 0.44)); };
  size();
  addEventListener("resize", size);
  ring.addEventListener("pointerover", (e) => { st.hover = !!e.target.closest(".ex-ring-item"); });
  ring.addEventListener("pointerleave", () => { st.hover = false; });
  // A card reached by keyboard turns to the front.
  ring.addEventListener("focusin", (e) => {
    const i = items.findIndex((it) => it.item.contains(e.target));
    if (i >= 0) st.focus = i;
  });
  ring.addEventListener("focusout", () => { st.focus = null; });

  onScroll((s) => {
    const b = s.sections.exercises;
    if (!b) return;
    st.visible = b.visible;
    // How far through the pinned run (0 → 1) turns the ring.
    st.scroll = b.inside * SCROLL_TURN;
    if (st.visible && !st.raf) st.raf = requestAnimationFrame(frame);
  });

  function frame(now) {
    st.raf = 0;
    const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 1 / 60;
    st.last = now;
    if (!st.hover && st.focus == null) st.auto += AUTO * dt;
    let want = st.auto + st.scroll;
    if (st.focus != null) {
      // Turn the shortest way to put the focused card at the front (angle 0).
      const cur = st.shown + (st.focus * 2 * Math.PI) / N;
      const off = Math.atan2(Math.sin(cur), Math.cos(cur));
      want = st.shown - off;
      st.auto = want - st.scroll;
    }
    st.shown += (want - st.shown) * (1 - Math.exp(-dt * 6));
    const R = st.R;
    let best = -Infinity, front = 0;
    items.forEach(({ item }, i) => {
      const th = st.shown + (i * 2 * Math.PI) / N;
      const x = Math.sin(th) * R, z = Math.cos(th) * R;
      const y = z * Math.sin(TILT), zz = z * Math.cos(TILT);
      const near = (z / R + 1) / 2;                     // 0 at the back, 1 at the front
      item.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${zz.toFixed(1)}px)`;
      item.style.opacity = (0.12 + 0.88 * near * near).toFixed(3);   // the back of the ring fades behind the heading
      item.classList.toggle("back", near < 0.35);
      if (z > best) { best = z; front = i; }
    });
    if (front !== st.front) {
      st.front = front;
      readN.textContent = String(front + 1).padStart(2, "0");
      readName.textContent = items[front].name;
    }
    if (st.visible && !document.hidden) st.raf = requestAnimationFrame(frame);
    else st.last = 0;
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && st.visible && !st.raf) st.raf = requestAnimationFrame(frame); });
}
