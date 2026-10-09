/**
 * coach.js — the voice-coach demo. Switch personality and the same three
 * reps get coached in that personality's recorded voice (the same clips the
 * trainer plays mid-set, js/voice.js); lines come from js/site/coach-lines.js.
 */

import { gradeColor } from "../grade.js";
import { voice, configureVoice } from "../voice.js";
import { asText } from "../figures/lab.js";
import { DEMO, DEMO_SCORES } from "./coach-lines.js";

export function mountCoach(root) {
  if (!root) return;
  const buttons = [...root.querySelectorAll("[data-voice]")];
  const bubbles = [...root.querySelectorAll("[data-cue]")];
  let personality = "Chill";

  bubbles.forEach((b, i) => {
    const chip = b.querySelector(".cue-score");
    chip.textContent = DEMO_SCORES[i];
    chip.style.background = gradeColor(DEMO_SCORES[i]);
    b.querySelector(".cue-play").addEventListener("click", () => {
      configureVoice({ personality });
      voice.say([DEMO_SCORES[i], ...DEMO[personality][i]], { interrupt: true });
    });
  });

  function render() {
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.voice === personality)));
    bubbles.forEach((b, i) => { b.querySelector(".cue-text").textContent = asText(DEMO[personality][i]); });
  }

  buttons.forEach((b) => b.addEventListener("click", () => { personality = b.dataset.voice; render(); }));
  render();
}
