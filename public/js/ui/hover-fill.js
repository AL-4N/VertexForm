/**
 * hover-fill.js — buttons fill from the pointer.
 *
 * On hover the grade gradient grows as a circle from the point where the
 * pointer came in until it covers the button, and on leaving it shrinks
 * back toward the point where the pointer went out. This only tracks those
 * two points (as --fx / --fy on the button); the circle itself is CSS
 * (`.btn::before` clip-path in site.css and app.css), so it costs nothing
 * while the pointer moves around inside.
 */

export function mountHoverFill(root = document) {
  const mark = (e) => {
    if (e.pointerType === "touch") return;
    const b = e.target.closest?.(".btn");
    if (!b || (e.relatedTarget && b.contains(e.relatedTarget))) return;   // moving between the button's own parts
    const r = b.getBoundingClientRect();
    b.style.setProperty("--fx", `${Math.round(e.clientX - r.left)}px`);
    b.style.setProperty("--fy", `${Math.round(e.clientY - r.top)}px`);
  };
  root.addEventListener("pointerover", mark);
  root.addEventListener("pointerout", mark);
}
