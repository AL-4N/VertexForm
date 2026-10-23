/**
 * coach.js — the voice-coach demo. Switch personality and the same three
 * reps get coached in that personality's recorded voice (the same clips the
 * trainer plays mid-set, js/voice.js); lines come from js/site/coach-lines.js.
 *
 * While a cue plays, its card lights up in its score's colour and the play
 * button becomes five bars that move with the actual voice: an analyser is
 * tapped onto the coach's audio output and each bar follows one band of
 * it. (If a line falls back to the system voice there's no audio to read,
 * so the bars just breathe.)
 */

import { gradeColor } from "../grade.js";
import { voice, configureVoice } from "../voice.js";
import { asText } from "../figures/lab.js";
import { DEMO, DEMO_SCORES } from "./coach-lines.js";
import { glide } from "../ui/segmented.js";

let analyser = null;
function tap() {
  if (analyser) return analyser;
  const ctx = voice.audio();
  if (!ctx || !voice.out) return null;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.6;
  voice.out.connect(analyser);
  return analyser;
}

/** Light a cue card and move its bars with the voice until the line ends. */
function speaking(card) {
  document.querySelectorAll(".cue.speaking").forEach((c) => c.classList.remove("speaking"));
  card.classList.add("speaking");
  const bars = [...card.querySelectorAll(".cue-wave i")];
  const a = tap(), data = a ? new Uint8Array(a.frequencyBinCount) : null;
  const started = performance.now();
  const step = (now) => {
    const playing = voice.current || now - started < 500;            // the line may take a moment to start
    if (!playing || !card.classList.contains("speaking")) {
      card.classList.remove("speaking");
      bars.forEach((b) => { b.style.transform = ""; });
      return;
    }
    if (a) a.getByteFrequencyData(data);
    bars.forEach((b, i) => {
      const v = data ? data[2 + i * 3] / 255 : 0.35 + 0.25 * Math.sin(now / 160 + i);
      b.style.transform = `scaleY(${(0.18 + v * 0.95).toFixed(3)})`;
    });
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function mountCoach(root) {
  if (!root) return;
  const buttons = [...root.querySelectorAll("[data-voice]")];
  const bubbles = [...root.querySelectorAll("[data-cue]")];
  let personality = "Chill";

  bubbles.forEach((b, i) => {
    const chip = b.querySelector(".cue-score");
    chip.textContent = DEMO_SCORES[i];
    chip.style.background = gradeColor(DEMO_SCORES[i]);
    b.style.setProperty("--cue", gradeColor(DEMO_SCORES[i]));
    const play = b.querySelector(".cue-play");
    play.insertAdjacentHTML("beforeend", `<span class="cue-wave" aria-hidden="true">${"<i></i>".repeat(5)}</span>`);
    play.addEventListener("click", () => {
      configureVoice({ personality });
      voice.say([DEMO_SCORES[i], ...DEMO[personality][i]], { interrupt: true });
      speaking(b);
    });
  });

  function render() {
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.voice === personality)));
    bubbles.forEach((b, i) => { b.querySelector(".cue-text").textContent = asText(DEMO[personality][i]); });
  }

  buttons.forEach((b) => b.addEventListener("click", () => { personality = b.dataset.voice; render(); }));
  render();
  glide(root.querySelector(".voices"));
}
