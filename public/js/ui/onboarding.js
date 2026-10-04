/**
 * onboarding.js — three quick cards on how to set up the camera. Shown the
 * first time the trainer opens; re-openable from Settings.
 */

import { $, $$ } from "./components.js";

export function showOnboarding(onDone = () => {}) {
  const dlg = $("#onboarding");
  if (!dlg || dlg.open) return;
  const cards = $$(".onb-card", dlg), dots = $$(".onb-dots span", dlg);
  let i = 0;
  const show = () => {
    cards.forEach((c, k) => { c.hidden = k !== i; });
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
    $("#onb-back").hidden = i === 0;
    $("#onb-next").textContent = i === cards.length - 1 ? "Got it" : "Next";
    $("#onb-skip").hidden = i === cards.length - 1;
  };
  const close = () => { dlg.close(); onDone(); };
  $("#onb-next").onclick = () => { if (i < cards.length - 1) { i++; show(); } else close(); };
  $("#onb-back").onclick = () => { if (i > 0) { i--; show(); } };
  $("#onb-skip").onclick = close;
  dlg.oncancel = () => onDone();         // Esc
  show();
  dlg.showModal();
  $("#onb-next").focus();
}
