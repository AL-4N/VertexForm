/**
 * lab.js (site) — the Form Lab.
 *
 * Pick an exercise, drag the sliders, and the figure re-poses and is scored
 * live by the app's own scoring engine. Presets jump to common faults, and the
 * cue line shows (and can speak) what the coach would say about that rep.
 */

import { LAB, evaluate } from "../figures/lab.js";
import { BY_ID } from "../figures/poses.js";
import { figureMarkup } from "../figures/draw.js";
import { angleMark, levelLine, offsetMark, coachNote, jointAngle } from "../figures/annotate.js";
import { gradeColor, gradeLetter } from "../grade.js";
import { slide, EASE } from "../ui/motion.js";
import { voice, configureVoice } from "../voice.js";

/**
 * Drawing-board marks for one pose: the measured angle as a protractor,
 * squat parallel / body-line offset as dimensions, and the coach's cue as a
 * handwritten note pointing at the body part it's about.
 */
function annotations(exId, s, lab, view, score, cue, focus) {
  const pts = Object.values(s).filter(Array.isArray);
  let out = "";
  if (exId === "squat") out += levelLine(s.kneeN[1], s.kneeN[0] - 120, s.kneeN[0] + 70, "parallel");
  const guide = lab.guide?.(s);
  if (guide) {
    const bend = Math.round(180 - jointAngle(s.neck, s.hip, s.ankN));
    if (bend >= 4) out += offsetMark(s.hip, guide[0], guide[1], `${bend}° off line`);
  }
  const arc = lab.arc?.(s);
  if (arc) out += angleMark(...arc);
  // The big score sits over the picture's top-left corner.
  const avoid = [{ x: view.x, y: view.y, w: view.w * 0.42, h: view.h * 0.22 }];
  out += coachNote(s[focus], cue, { view, pts, avoid, tone: score >= 90 ? "good" : "fix" });
  return out;
}
const same = (a, b) => Object.keys(a).every((k) => Math.round(a[k]) === Math.round(b[k]));

export function mountLab(root) {
  const svg = root.querySelector(".lab-svg");
  const tabs = [...root.querySelectorAll("[data-lab-ex]")];
  const q = (k) => root.querySelector(`[data-l="${k}"]`);
  const ui = {
    score: q("score"), letter: q("letter"), rows: q("rows"),
    sliders: q("sliders"), presets: q("presets"), parts: q("parts"),
    cue: q("cue"), speak: q("speak"),
  };

  let id = "squat";
  let v = {};
  let cueParts = [];             // what the play button says after the score

  function select(next, focus = false) {
    // Switching exercise: the new figure and its controls slide in from the
    // side the tab is on, with a horizontal motion blur.
    const from = tabs.findIndex((t) => t.dataset.labEx === id), to = tabs.findIndex((t) => t.dataset.labEx === next);
    const dir = to === from ? 0 : to > from ? 1 : -1;
    id = next;
    v = { ...LAB[id].presets[0].v };
    tabs.forEach((t) => {
      const on = t.dataset.labEx === id;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    controls();
    render();
    if (dir) {
      slide(svg, { from: [dir * 90, 0], to: [0, 0], opacity: [0, 1], duration: 420, ease: EASE.out, strength: 1 });
      slide(ui.sliders, { from: [dir * 50, 0], to: [0, 0], opacity: [0, 1], duration: 380, ease: EASE.out });
      slide(ui.presets, { from: [dir * 50, 0], to: [0, 0], opacity: [0, 1], duration: 440, ease: EASE.out });
    }
  }

  function controls() {
    const lab = LAB[id];
    ui.sliders.innerHTML = lab.sliders.map((sl) => `
      <label class="lab-slider">
        <span class="lab-slider-name">${sl.label}</span>
        <input type="range" min="${sl.min}" max="${sl.max}" step="1" value="${v[sl.key]}" data-key="${sl.key}">
        <span class="lab-ends"><span>${sl.lo}</span><span>${sl.hi}</span></span>
      </label>`).join("");
    ui.presets.innerHTML = lab.presets.map((p, i) =>
      `<button type="button" data-preset="${i}">${p.name}</button>`).join("");
  }

  function syncInputs() {
    ui.sliders.querySelectorAll("input").forEach((inp) => { inp.value = v[inp.dataset.key]; });
  }

  function render() {
    const lab = LAB[id];
    const { s, m, cue, parts, focus } = evaluate(id, v);
    cueParts = parts;
    const score = Math.round(m.score);
    const c = gradeColor(score);
    root.style.setProperty("--lab", c);

    // Floor exercises are long and low, so zoom in on them (same aspect ratio).
    const view = id === "pushup" || id === "plank" ? { x: 40, y: 164, w: 520, h: 408 } : { x: 0, y: 20, w: 600, h: 470 };
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
    svg.innerHTML = `
      <defs><radialGradient id="lab-glow"><stop offset="0" stop-color="${c}" stop-opacity=".32"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="300" cy="330" rx="260" ry="190" fill="url(#lab-glow)"/>
      ${figureMarkup(s, { color: c, floor: { x0: 24, x1: 576 }, guide: lab.guide?.(s), guideColor: "#eef1fb" })}
      ${annotations(id, s, lab, view, score, cue, focus)}`;

    ui.score.textContent = score;
    ui.letter.textContent = gradeLetter(score);
    ui.rows.innerHTML = m.rows.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join("");
    ui.parts.innerHTML = m.parts.map(([k, val]) => {
      const n = Math.round(val);
      return `<div class="lab-part"><span>${k}</span><span class="lab-track"><i style="width:${n}%;background:${gradeColor(n)}"></i></span><b style="color:${gradeColor(n)}">${n}</b></div>`;
    }).join("");
    ui.cue.textContent = cue;

    ui.presets.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-pressed", String(same(lab.presets[+b.dataset.preset].v, v))));
    svg.setAttribute("aria-label",
      `${BY_ID[id].name}, scored ${score} out of 100 (${gradeLetter(score)}). ${cue}`);
  }

  /* ── Events ─────────────────────────────────────────── */
  tabs.forEach((t) => t.addEventListener("click", () => select(t.dataset.labEx)));
  root.querySelector("[role=tablist]").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = tabs.findIndex((t) => t.dataset.labEx === id);
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    select(tabs[n].dataset.labEx, true);
    e.preventDefault();
  });

  ui.sliders.addEventListener("input", (e) => {
    const inp = e.target.closest("input");
    if (!inp) return;
    v[inp.dataset.key] = Number(inp.value);
    render();
  });

  ui.presets.addEventListener("click", (e) => {
    const b = e.target.closest("[data-preset]");
    if (!b) return;
    v = { ...LAB[id].presets[+b.dataset.preset].v };
    syncInputs();
    render();
  });

  // The score, then the cue, in the trainer's recorded voice (js/voice.js).
  ui.speak?.addEventListener("click", () => {
    configureVoice({ personality: "Chill" });
    voice.say([Number(ui.score.textContent), ...cueParts], { interrupt: true });
  });

  select("squat");
}
