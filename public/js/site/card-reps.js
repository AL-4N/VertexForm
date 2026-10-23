/**
 * card-reps.js — hover an exercise card and its figure does the rep: the
 * still drawing is swapped for the same live loop the trainer's setup
 * screen shows (figures/loop.js), coloured by its live score, so you watch
 * it climb from coral to green as it reaches the right depth. Leaving the
 * card puts the still drawing back. Both swaps crossfade. Mouse only; off
 * for reduced motion.
 */

import { mountLoop } from "../figures/loop.js";
import { renderPictos } from "../figures/pictos.js";
import { reducedMotion } from "../ui/motion.js";

export function mountCardReps(grid) {
  if (!grid || reducedMotion() || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  for (const card of grid.querySelectorAll(".ex-card")) {
    const host = card.querySelector(".picto[data-picto]");
    if (!host) continue;
    let stop = null;
    const fade = () => host.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
    card.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || stop) return;
      stop = mountLoop(host, host.dataset.picto);
      fade();
    });
    card.addEventListener("pointerleave", () => {
      if (!stop) return;
      stop(); stop = null;
      host.innerHTML = "";
      renderPictos(card);
      fade();
    });
  }
}
