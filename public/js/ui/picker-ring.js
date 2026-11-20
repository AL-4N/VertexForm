/**
 * picker-ring.js — the trainer's exercise picker as a ring of cards in 3D
 * (wide screens, motion allowed), the same instrument as the homepage's
 * ring (js/site/ex-ring.js): all the exercises stand on a tilted ring
 * around the live stage. The cards always face you; depth is the
 * browser's own 3D, so cards at the back pass behind the stage.
 *
 * It turns slowly on its own and stops while the pointer is on it. The
 * wheel, a drag, the arrow buttons or the arrow keys turn it, and it
 * settles with a card at the front. A card that gets keyboard focus turns
 * to the front. Whichever card is at the front is the one on the stage
 * (onFront). One transform per card per frame, only while it's on screen.
 *
 * A card catches a glint (a band of light sweeping across it) as it turns
 * to the front, and the whole ring catches one, card after card from the
 * front, once the cards have flown into place. Pointing at a card glints
 * it too (CSS, app.css).
 */

const TILT = 24 * (Math.PI / 180);   // the ring leans toward you: the front of it lower
const AUTO = 0.06;                   // radians a second, on its own
const WHEEL_STEP = 90;               // px of wheel per card
const IDLE = 3500;
const DEPTH = 0.78;                  // the ring is an ellipse: less deep than wide, so it fits under the stage                   // ms after you touch it before it turns on its own again

// The glint runs on the card's ::after. Browsers that can't animate a
// pseudo-element would move the card itself instead, so they get none.
const CAN_GLINT = typeof KeyframeEffect !== "undefined" && "pseudoElement" in KeyframeEffect.prototype;
const GLINT = [{ transform: "translateX(-140%) skewX(-18deg)" }, { transform: "translateX(240%) skewX(-18deg)" }];
function glint(item, delay = 0) {
  const card = item?.querySelector(".ex-card");
  if (!CAN_GLINT || !card) return;
  card.animate(GLINT, { duration: 900, delay, easing: "cubic-bezier(.5,0,.3,1)", pseudoElement: "::after" });
}

export function mountPickerRing(view, { items, start = 0, intro = false, onFront }) {
  const N = items.length, STEP = (2 * Math.PI) / N, TAU = 2 * Math.PI;
  const st = {
    shown: -start * STEP, want: -start * STEP, R: 420, hover: false, focus: null,
    hold: performance.now() + IDLE, drag: null, dragged: false, wheelT: 0,
    raf: 0, last: 0, front: start, visible: true, grow: intro ? 0 : 1,
  };
  // The nearest angle that puts card i at the front.
  const angleFor = (i) => { const a = -i * STEP; return a + TAU * Math.round((st.want - a) / TAU); };
  const snap = () => { st.want = Math.round(st.want / STEP) * STEP; };
  const touch = (ms = IDLE) => { st.hold = performance.now() + ms; kick(); };
  const kick = () => { if (st.visible && !st.raf && !document.hidden) st.raf = requestAnimationFrame(frame); };

  const size = () => { st.R = Math.max(260, Math.min(480, view.clientWidth * 0.43)); kick(); };
  const ro = new ResizeObserver(size);
  ro.observe(view);
  const io = new IntersectionObserver(([e]) => { st.visible = e.isIntersecting; kick(); });
  io.observe(view);

  const on = (el, type, fn, opt) => { el.addEventListener(type, fn, opt); offs.push(() => el.removeEventListener(type, fn, opt)); };
  const offs = [];

  on(view, "pointerover", (e) => { st.hover = !!e.target.closest(".pk-item, .pk-centre"); });
  on(view, "pointerleave", () => { st.hover = false; touch(1200); onFront(st.front); });
  on(view, "focusin", (e) => {
    const i = items.findIndex((el) => el.contains(e.target));
    if (i < 0) return;
    st.focus = i;
    st.want = angleFor(i);
    touch();
  });
  on(view, "focusout", () => { st.focus = null; touch(); });
  on(view, "wheel", (e) => {
    if (e.ctrlKey) return;                                  // pinch zoom
    e.preventDefault();
    st.want -= ((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / WHEEL_STEP) * STEP;
    clearTimeout(st.wheelT);
    st.wheelT = setTimeout(snap, 140);
    touch();
  }, { passive: false });
  // Drag to turn: the front card follows the pointer sideways.
  on(view, "pointerdown", (e) => {
    if (!e.isPrimary || e.button !== 0 || e.target.closest(".pk-centre, .pk-turn")) return;
    st.drag = { x: e.clientX, want: st.want, id: e.pointerId };
    st.dragged = false;
  });
  on(view, "pointermove", (e) => {
    const d = st.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!st.dragged && Math.abs(dx) > 6) { st.dragged = true; view.setPointerCapture(d.id); view.classList.add("dragging"); }
    if (st.dragged) { st.want = d.want + (dx / st.R) * 1.1; touch(); }
  });
  const release = () => { if (!st.drag) return; st.drag = null; view.classList.remove("dragging"); if (st.dragged) snap(); touch(); };
  on(view, "pointerup", release);
  on(view, "pointercancel", release);
  // A drag that ends on a card isn't a click on it.
  on(view, "click", (e) => { if (st.dragged) { e.stopPropagation(); e.preventDefault(); st.dragged = false; } }, true);
  view.querySelectorAll(".pk-turn").forEach((b) => on(b, "click", () => {
    st.want = angleFor((st.front + Number(b.dataset.dir) + N) % N);
    touch();
  }));
  on(document, "visibilitychange", kick);

  function frame(now) {
    st.raf = 0;
    const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 1 / 60;
    st.last = now;
    const idle = !st.hover && st.focus == null && !st.drag && now > st.hold;
    if (idle) st.want -= AUTO * dt;                          // the next card comes round
    st.shown += (st.want - st.shown) * (1 - Math.exp(-dt * 7));
    // The first time: the cards fly out from the stage and wind into place.
    if (st.grow < 1) {
      st.grow = Math.min(1, st.grow + dt / 1.3);
      // Landed: a glint runs round the ring, both ways from the front card.
      if (st.grow === 1) items.forEach((el, i) => {
        const k = (i - st.front + N) % N;
        glint(el, Math.min(k, N - k) * 55);
      });
    }
    const g = 1 - Math.pow(1 - st.grow, 3);
    const R = st.R * g, spin = (1 - g) * 2.2;
    let best = -2, front = st.front;
    items.forEach((el, i) => {
      const th = st.shown + spin + i * STEP;
      const c = Math.cos(th), x = Math.sin(th) * R, z = c * R * DEPTH;
      const near = (c + 1) / 2;                             // 0 at the back, 1 at the front
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${(z * Math.sin(TILT)).toFixed(1)}px, ${(z * Math.cos(TILT)).toFixed(1)}px)`;
      el.style.opacity = ((0.14 + 0.86 * near * near) * g).toFixed(3);
      el.classList.toggle("back", near < 0.3);
      if (c > best) { best = c; front = i; }
    });
    items.forEach((el, i) => el.classList.toggle("front", i === front));
    if (front !== st.front) {
      st.front = front;
      if (st.grow === 1) glint(items[front], 120);          // catches the light as it comes round
      if (!st.hover) onFront(front);
    }
    // Keep drawing while it moves or turns on its own.
    const moving = idle || st.grow < 1 || Math.abs(st.want - st.shown) > 1e-4 || st.drag;
    if (moving && st.visible && !document.hidden) st.raf = requestAnimationFrame(frame);
    else {
      st.last = 0;
      // Settled after a touch: wake when it may turn on its own again (hover, focus and drag wake it themselves).
      if (!st.hover && st.focus == null && !st.drag && st.visible) setTimeout(kick, Math.max(0, st.hold - now) + 20);
    }
  }
  kick();

  return function stop() {
    cancelAnimationFrame(st.raf);
    clearTimeout(st.wheelT);
    ro.disconnect();
    io.disconnect();
    offs.forEach((f) => f());
    st.visible = false;
  };
}
