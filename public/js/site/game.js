/**
 * game.js — "Spot the better rep".
 *
 * Two reps of the same exercise, drawn in neutral grey. Tap the one you think
 * scores higher; both are then coloured by their real score and the coach
 * explains what was wrong with the weaker one. Keeps a streak (best streak is
 * remembered in this browser only).
 */

import { LAB, LAB_ORDER, evaluate } from "../figures/lab.js";
import { BY_ID } from "../figures/poses.js";
import { figureSVG, bounds } from "../figures/draw.js";
import { gradeColor, gradeLetter } from "../grade.js";
import { slide, EASE } from "../ui/motion.js";

const KEY = "vertexform:game-best";
const NEUTRAL = "#a6aecb";
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function readBest() { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } }
function writeBest(n) { try { localStorage.setItem(KEY, String(n)); } catch { /* storage off: fine */ } }

/** Two reps whose scores differ enough to be a fair question. */
function makePair(lastId) {
  for (let tries = 0; tries < 40; tries++) {
    const id = pick(LAB_ORDER.filter((x) => x !== lastId));
    const lab = LAB[id];
    const [p1, p2] = [...lab.presets].sort(() => Math.random() - 0.5);
    const jitter = (v) => Object.fromEntries(lab.sliders.map((sl) =>
      [sl.key, clamp(v[sl.key] + (Math.random() - 0.5) * (sl.max - sl.min) * 0.12, sl.min, sl.max)]));
    const reps = [jitter(p1.v), jitter(p2.v)].map((v) => ({ v, ...evaluate(id, v) }));
    if (Math.abs(reps[0].m.score - reps[1].m.score) >= 10) return { id, reps };
  }
  return { id: "squat", reps: [LAB.squat.presets[0].v, LAB.squat.presets[1].v].map((v) => ({ v, ...evaluate("squat", v) })) };
}

export function mountGame(root) {
  const cards = [...root.querySelectorAll("[data-pick]")];
  const q = (k) => root.querySelector(`[data-g="${k}"]`);
  const ui = { ex: q("ex"), streak: q("streak"), best: q("best"), msg: q("msg"), next: q("next") };

  let pair = null, answered = false, streak = 0, best = readBest();
  ui.best.textContent = best;

  function draw(i, colour) {
    const { s, m } = pair.reps[i];
    const lab = LAB[pair.id];
    // Both cards share one frame so the two reps are drawn at the same scale.
    const b1 = bounds(pair.reps[0].s, 26), b2 = bounds(pair.reps[1].s, 26);
    const x0 = Math.min(b1.x0, b2.x0), y0 = Math.min(b1.y0, b2.y0);
    const x1 = Math.max(b1.x1, b2.x1), y1 = Math.max(b1.y1, b2.y1);
    const box = { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
    const c = colour ? gradeColor(m.score) : NEUTRAL;
    cards[i].querySelector(".game-fig").innerHTML = figureSVG(s, {
      box, color: c, guide: lab.guide?.(s), guideColor: "#eef1fb",
    });
  }

  function newRound() {
    const first = !pair;
    pair = makePair(pair?.id);
    answered = false;
    ui.ex.textContent = BY_ID[pair.id].name;
    ui.msg.textContent = `Which ${BY_ID[pair.id].name.toLowerCase()} scores higher?`;
    ui.msg.className = "game-msg";
    ui.next.hidden = true;
    cards.forEach((card, i) => {
      card.disabled = false;
      card.classList.remove("win", "lose", "chosen");
      card.querySelector(".game-score").textContent = "";
      card.style.removeProperty("--c");
      draw(i, false);
      // Next round: the two new reps slide in, one after the other.
      if (!first) setTimeout(() => slide(card.querySelector(".game-fig"), { from: [70, 0], to: [0, 0], opacity: [0, 1], duration: 420, ease: EASE.outBack, strength: 1 }), i * 90);
    });
    if (!first) slide(ui.msg, { from: [0, 16], to: [0, 0], opacity: [0, 1], duration: 340, ease: EASE.out });
  }

  function answer(i) {
    if (answered) return;
    answered = true;
    const scores = pair.reps.map((r) => Math.round(r.m.score));
    const win = scores[0] >= scores[1] ? 0 : 1, lose = 1 - win;
    const right = i === win;

    cards.forEach((card, k) => {
      card.disabled = true;
      card.classList.add(k === win ? "win" : "lose");
      card.classList.toggle("chosen", k === i);
      card.style.setProperty("--c", gradeColor(scores[k]));
      card.querySelector(".game-score").textContent = `${scores[k]} ${gradeLetter(scores[k])}`;
      draw(k, true);
    });

    streak = right ? streak + 1 : 0;
    if (streak > best) { best = streak; writeBest(best); }
    ui.streak.textContent = streak;
    ui.best.textContent = best;

    const L = lose === 0 ? "A" : "B", W = win === 0 ? "A" : "B";
    ui.msg.className = `game-msg ${right ? "right" : "wrong"}`;
    ui.msg.textContent = `${right ? "Right!" : "Not quite."} Rep ${W} scores ${scores[win]}, Rep ${L} scores ${scores[lose]}. ` +
      `Coach on Rep ${L}: “${pair.reps[lose].cue}”`;
    ui.next.hidden = false;
    slide(ui.msg, { from: [0, 18], to: [0, 0], opacity: [0, 1], duration: 360, ease: EASE.outBack });
    ui.next.focus({ preventScroll: true });
  }

  cards.forEach((card, i) => card.addEventListener("click", () => answer(i)));
  ui.next.addEventListener("click", newRound);
  newRound();
}
