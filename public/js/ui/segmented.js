/**
 * segmented.js — a highlight that glides between the options of a toggle
 * group (idea from 21st.dev's "Slide Tabs" / "Segmented Control", rebuilt
 * in plain JS). The pressed option's background becomes one shared
 * indicator that slides to the new choice with a horizontal motion blur
 * (js/ui/motion.js slide), instead of jumping.
 *
 * It watches aria-pressed, so existing click handlers don't change: they
 * flip aria-pressed as before and the indicator follows.
 */

import { slide, EASE } from "./motion.js";

export function glide(group) {
  if (!group || group.querySelector(":scope > .seg-ind")) return;
  const ind = document.createElement("span");
  ind.className = "seg-ind";
  ind.setAttribute("aria-hidden", "true");
  group.prepend(ind);
  group.classList.add("has-ind");
  let at = null;

  const place = (animate) => {
    const on = group.querySelector('[aria-pressed="true"]');
    if (!on || !on.offsetWidth) { ind.style.opacity = "0"; return; }
    const x = on.offsetLeft, w = on.offsetWidth;
    ind.style.opacity = "1";
    ind.style.left = `${x}px`;
    ind.style.top = `${on.offsetTop}px`;
    ind.style.width = `${w}px`;
    ind.style.height = `${on.offsetHeight}px`;
    if (animate && at != null && at !== x) {
      slide(ind, { from: [at - x, 0], to: [0, 0], duration: 320, ease: EASE.outBack, strength: 0.8, maxBlur: 12 });
    }
    at = x;
  };

  new MutationObserver(() => place(true)).observe(group, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
  new ResizeObserver(() => place(false)).observe(group);
  place(false);
}
