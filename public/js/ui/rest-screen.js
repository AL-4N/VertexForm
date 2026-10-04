/**
 * rest-screen.js — the rest timer between sets (and between circuit steps).
 * A ring that empties, a spoken countdown, and one click to start the next set.
 */

import { $, showScreen } from "./components.js";
import { speech, beep } from "../voice.js";
import { restCue, mmss } from "../rest.js";

let timer = 0;

/**
 * @param o { seconds, next: "Squat × 5", kicker, auto (start by itself at 0),
 *            onGo(), onEnd() }
 */
export function showRest({ seconds, next, kicker = "Rest", auto = false, onGo, onEnd }) {
  stopRest();
  let total = seconds, left = seconds;
  let endAt = performance.now() + seconds * 1000;
  $("#rest-kicker").textContent = kicker;
  $("#rest-next").textContent = next ? `Next: ${next}` : "";
  $("#rest-go").textContent = auto ? "Start now" : "Next set";
  $("#rest-go").classList.remove("pulse");
  showScreen("rest", { focus: "#rest-go" });

  const draw = () => {
    $("#rest-time").textContent = mmss(left);
    $("#rest-prog").style.strokeDashoffset = String(100 - (left / total) * 100);
  };
  draw();
  if (seconds > 0) speech.say(`Rest ${seconds} seconds.${next ? ` Next, ${next.replace("×", "")}.` : ""}`, { anytime: true, priority: 2 });

  const go = () => { stopRest(); onGo?.(); };
  const end = () => { stopRest(); speech.clear(); onEnd?.(); };
  $("#rest-go").onclick = go;
  $("#rest-end").onclick = end;
  $("#rest-add").onclick = () => { endAt += 15000; total += 15; left += 15; draw(); };

  if (seconds <= 0) { if (auto) go(); return; }
  timer = setInterval(() => {
    const before = left;
    left = Math.max(0, (endAt - performance.now()) / 1000);
    draw();
    const cue = restCue(Math.ceil(before), Math.ceil(left), total, auto);
    if (cue) { speech.say(cue, { anytime: true, priority: 4, maxAgeMs: 1500 }); if (/^\d$/.test(cue)) beep(660, 80, 0.04); }
    if (left <= 0) {
      clearInterval(timer); timer = 0;
      if (auto) go();
      else $("#rest-go").classList.add("pulse");
    }
  }, 250);
}

export function stopRest() {
  clearInterval(timer);
  timer = 0;
}
