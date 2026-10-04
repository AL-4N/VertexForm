/**
 * coach.js — the voice-coach demo. Switch personality and the same three
 * reps get coached in that voice; the play buttons speak them out loud with
 * the browser's own speech, exactly as the app does mid-set.
 */

import { gradeColor } from "../grade.js";

const LINES = {
  Chill: [
    "Chest up, sit back into your heels.",
    "So close. Go a touch lower, thighs to parallel.",
    "Nice. Two in a row.",
  ],
  Hype: [
    "Chest up! Sit back and drive!",
    "So close, one more push. Get lower!",
    "Let's go! Back to back!",
  ],
  Coach: [
    "Chest up. Hips back, not forward.",
    "Close. Tighten it up, thighs to parallel.",
    "Textbook. Two straight. Stay locked in.",
  ],
};
const SCORES = [74, 86, 94];

export function mountCoach(root) {
  if (!root) return;
  const buttons = [...root.querySelectorAll("[data-voice]")];
  const bubbles = [...root.querySelectorAll("[data-cue]")];
  const canSpeak = "speechSynthesis" in window;
  let voice = "Chill";

  bubbles.forEach((b, i) => {
    const chip = b.querySelector(".cue-score");
    chip.textContent = SCORES[i];
    chip.style.background = gradeColor(SCORES[i]);
    const play = b.querySelector(".cue-play");
    if (!canSpeak) { play.hidden = true; return; }
    play.addEventListener("click", () => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(`${SCORES[i]}. ${LINES[voice][i]}`);
      u.rate = voice === "Hype" ? 1.15 : 1.02;
      u.pitch = voice === "Hype" ? 1.15 : voice === "Coach" ? 0.9 : 1;
      speechSynthesis.speak(u);
    });
  });

  function render() {
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.voice === voice)));
    bubbles.forEach((b, i) => { b.querySelector(".cue-text").textContent = LINES[voice][i]; });
  }

  buttons.forEach((b) => b.addEventListener("click", () => { voice = b.dataset.voice; render(); }));
  render();
}
