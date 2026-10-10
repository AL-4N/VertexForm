/**
 * digits.js — numbers that roll when they change (idea from 21st.dev's
 * "Animated Blur Number" / "Number Flow", rebuilt in plain JS).
 *
 * Only the digits that change move: the old one slides out and the new one
 * slides in, up for a bigger number and down for a smaller one, each with a
 * vertical motion blur (js/ui/motion.js slide). Digits line up by place
 * value, so 99 → 100 rolls every place. The first value is just set.
 * Screen readers get the plain text (aria-label), not the moving parts.
 */

import { slide, EASE, reducedMotion } from "./motion.js";

export function rollTo(el, value) {
  const text = String(value);
  const prev = el.dataset.roll;
  if (prev === text) return;
  el.dataset.roll = text;
  el.setAttribute("aria-label", text);
  if (prev == null || reducedMotion() || !el.querySelector(".dg")) {
    el.innerHTML = [...text].map((ch) => `<span class="dg" aria-hidden="true"><span>${ch}</span></span>`).join("");
    return;
  }
  const up = (parseFloat(text) || 0) >= (parseFloat(prev) || 0) ? 1 : -1;
  const width = Math.max(prev.length, text.length);
  const a = prev.padStart(width, " "), b = text.padStart(width, " ");
  const old = [...el.querySelectorAll(".dg")];
  const cells = [];
  for (let i = 0; i < width; i++) {
    // Reuse the cell in the same place-value position, if there was one.
    const oldCell = old[i - (width - old.length)];
    if (a[i] === b[i] && oldCell) { cells.push(oldCell); continue; }
    const cell = document.createElement("span");
    cell.className = "dg";
    cell.setAttribute("aria-hidden", "true");
    const inner = document.createElement("span");
    inner.textContent = b[i] === " " ? "" : b[i];
    cell.appendChild(inner);
    if (oldCell?.firstElementChild) {
      const out = oldCell.firstElementChild;
      out.classList.add("dg-out");
      cell.appendChild(out);
      slide(out, { from: [0, 0], to: [0, -up * 18], opacity: [1, 0], duration: 260, ease: EASE.in, strength: 0.7, maxBlur: 6 })
        .then(() => out.remove());
    }
    slide(inner, { from: [0, up * 18], to: [0, 0], opacity: [0, 1], duration: 300, ease: EASE.out, strength: 0.7, maxBlur: 6 });
    cells.push(cell);
  }
  el.replaceChildren(...cells.filter((c) => c.textContent !== "" || c.querySelector(".dg-out")));
}
