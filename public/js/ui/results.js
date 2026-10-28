/** results.js — post-session breakdown: grade, bars, rep chart, coach notes. */

import { $, renderBars, drawRepChart } from "./components.js";
import { renderReplayCard } from "./replay.js";
import { gradeLetter, gradeVar } from "../geometry.js";
import { faultLabel, faultPhrase } from "../coaching.js";
import { getExercise } from "../exercises/index.js";
import { slide, tween, EASE, reducedMotion } from "./motion.js";
import { gradeColor } from "../grade.js";
import { stamp, bestBadge } from "./flair.js";

/**
 * The score counts up from 0, and the number and letter take each colour of
 * the grade scale on the way, so you watch it climb from coral to where you
 * landed; the letter drops in each time it moves up a grade.
 */
let stopCount = null;
function countUp(best) {
  stopCount?.();
  const num = $("#res-score"), letter = $("#res-letter");
  const arc = $("#res-dial-arc"), bead = $("#res-dial-bead"), bands = [...document.querySelectorAll(".gd-bands text")];
  let shown = null;
  stopCount = tween(0, best, (x) => {
    const n = Math.round(x);
    num.textContent = n;
    num.style.color = gradeColor(n);
    // The dial round the letter sweeps with it: the arc, the bead riding its
    // end, and each band's letter lighting as the needle passes into it.
    if (arc) {
      const a = (135 + x * 2.7) * Math.PI / 180;
      arc.style.strokeDasharray = `${x} 100`;
      arc.style.stroke = arc.style.color = gradeColor(n);
      bead.setAttribute("cx", (50 * Math.cos(a)).toFixed(2));
      bead.setAttribute("cy", (50 * Math.sin(a)).toFixed(2));
      bead.style.fill = bead.style.color = gradeColor(n);
      bands.forEach((b) => b.classList.toggle("on", x >= Number(b.dataset.band) - (b.dataset.band === "30" ? 30 : 5)));
    }
    const l = gradeLetter(n);
    if (l !== shown) {
      letter.textContent = l;
      letter.style.color = gradeVar(n);
      if (shown != null) slide(letter, { from: [0, -10], to: [0, 0], duration: 200, ease: EASE.out, strength: 0.8 });
      shown = l;
    }
  }, { duration: 1100 });
  // Once it has counted up, the grade lands like a stamp, the dial flashes,
  // and a glint runs across "Go again".
  clearTimeout(countUp.stampAt);
  countUp.stampAt = setTimeout(() => {
    stamp(letter, gradeColor(best), undefined, { lift: true });
    if (reducedMotion()) return;
    letter.closest(".grade-dial")?.animate([{ filter: "brightness(1)" }, { filter: `brightness(1.8) drop-shadow(0 0 14px ${gradeColor(best)})`, offset: .2 }, { filter: "brightness(1)" }], { duration: 700, easing: "ease-out" });
    const again = $("#btn-again");
    again.classList.remove("glint"); void again.offsetWidth; again.classList.add("glint");
  }, 1050);
}

export function renderResults(r) {
  if (!r) return;

  $("#results-title").textContent = `${r.exercise} results`;
  countUp(r.best);
  const held = Math.round((r.durations ?? []).reduce((a, b) => a + b, 0));
  $("#res-sub").textContent = r.isHold
    ? `${held} s hold · best 5 s ${r.best} · average ${r.average}`
    : r.reps.length > 1
      ? `Best of ${r.reps.length} reps · average ${r.average}`
      : "Single rep";
  // A new best lands after the grade's stamp.
  if (r.isBest) bestBadge($("#res-best-badge"));
  else { clearTimeout(bestBadge.t); $("#res-best-badge").hidden = true; }

  // Component bars from the best rep's grade shape, if we have one.
  const ex = getExercise(r.exercise);
  const bars = r.bars ?? [
    { label: "Best rep", value: r.best },
    { label: "Average",  value: r.average },
  ];
  renderBars($("#res-bars"), bars, "res-bar");

  revealChart(r.reps, r.target);
  dealCards();
  $("#res-chart").setAttribute("aria-label", `Rep scores: ${r.reps.join(", ")}. Target ${r.target}.`);
  renderSummary(r);
  renderDetails(r);
  renderReplayCard(r.replays);

  // ── Coach notes: the most common fault across the session ──
  const counts = {};
  r.faults.forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (!ranked.length) {
    $("#res-tip").hidden = false;
    $("#res-tip").textContent =
      "Clean session: no repeated form faults detected. Keep that standard.";
    $("#res-faults").innerHTML = "";
    revealNotes();
    return;
  }

  const [topKey, topCount] = ranked[0];
  // With a coach summary, its "Fix next" already says this.
  $("#res-tip").hidden = !!r.summary?.fix;
  const unit = r.isHold ? "5-second stretches" : "reps";
  $("#res-tip").textContent =
    `Your most common issue was ${faultLabel(r.exercise, topKey).toLowerCase()} ` +
    `(in ${topCount} of ${r.reps.length} ${unit}). ${faultPhrase(r.exercise, topKey)}.`;

  // Each fault shows the set as a row of dots, one per rep, lit on the reps
  // it was flagged in (from the per-rep details when there are any).
  const total = r.reps.length;
  $("#res-faults").innerHTML = ranked.slice(0, 4).map(([key, n]) => {
    const sev = n >= total / 2 ? "var(--coral)" : "var(--amber)";
    const hit = r.details?.length === total ? r.details.map((d) => d.faults?.includes(key)) : Array.from({ length: total }, (_, i) => i < n);
    return `
    <div class="fault-item" style="--sev:${sev}">
      <span class="fault-sev" style="background:${sev}"></span>
      <div>
        <strong>${faultLabel(r.exercise, key)}</strong>
        <div class="dim">in ${n} of ${total} ${r.isHold ? "stretches" : "reps"}</div>
        ${total <= 30 ? `<span class="fault-dots" aria-hidden="true">${hit.map((h) => `<i class="${h ? "hit" : ""}"></i>`).join("")}</span>` : ""}
      </div>
    </div>`;
  }).join("");
  revealNotes();
}

/** The rep chart draws itself once its card is on screen (components.js drawRepChart's p). */
let stopChart = () => {};
function revealChart(reps, target) {
  stopChart();
  const canvas = $("#res-chart");
  if (reducedMotion() || !reps.length) { drawRepChart(canvas, reps, target); return; }
  drawRepChart(canvas, reps, target, 0);
  let raf = 0, t0 = 0;
  const dur = 700 + reps.length * 140;
  const step = (now) => {
    t0 ||= now;
    const p = Math.min(1, (now - t0) / dur);
    drawRepChart(canvas, reps, target, p);
    raf = p < 1 ? requestAnimationFrame(step) : 0;
  };
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    setTimeout(() => { raf = requestAnimationFrame(step); }, 450);
  }, { threshold: 0.4 });
  io.observe(canvas);
  stopChart = () => { io.disconnect(); cancelAnimationFrame(raf); drawRepChart(canvas, reps, target); };
}

/** The cards under the grade land one after another like sheets laid on the board. */
function dealCards() {
  if (reducedMotion()) return;
  const cards = [...document.querySelectorAll("#screen-results .results-wrap > .card:not(:first-child):not([hidden])")];
  cards.forEach((c, k) => c.animate(
    [{ opacity: 0, transform: `translateY(34px) rotate(${k % 2 ? 1.4 : -1.4}deg) scale(.97)` },
     { opacity: 1, transform: `translateY(-3px) rotate(${k % 2 ? -0.3 : 0.3}deg)`, offset: .7 },
     { opacity: 1, transform: "none" }],
    { duration: 620, delay: 380 + k * 110, easing: "cubic-bezier(.22,.61,.36,1)", fill: "backwards" }));
}

/** Coach notes: the tip's words rise in, then each fault's dots light rep by rep. */
function revealNotes() {
  if (reducedMotion()) return;
  const tip = $("#res-tip");
  if (!tip.hidden && tip.textContent) {
    const words = tip.textContent.split(" ");
    tip.setAttribute("aria-label", tip.textContent);
    tip.innerHTML = words.map((w) => `<span class="tw" aria-hidden="true">${esc(w)}</span>`).join(" ");
    tip.querySelectorAll(".tw").forEach((w, k) => w.animate(
      [{ opacity: 0, transform: "translateY(.5em)" }, { opacity: 1, transform: "none" }],
      { duration: 420, delay: 700 + k * 28, easing: "cubic-bezier(.22,.61,.36,1)", fill: "backwards" }));
  }
  document.querySelectorAll("#res-faults .fault-item").forEach((item, f) => {
    item.querySelectorAll(".fault-dots i").forEach((d, k) => d.animate(
      d.classList.contains("hit")
        ? [{ transform: "scale(0)" }, { transform: "scale(1.6)", offset: .6 }, { transform: "scale(1)" }]
        : [{ transform: "scale(0)" }, { transform: "scale(1)" }],
      { duration: 360, delay: 900 + f * 160 + k * 45, easing: "cubic-bezier(.3,.7,.4,1)", fill: "backwards" }));
  });
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The coach's post-set summary: strengths, the one thing to fix, a target. */
function renderSummary(r) {
  const host = $("#res-summary");
  const s = r.summary;
  if (!s) { host.innerHTML = ""; return; }
  host.innerHTML = `
    <div class="sum-row"><span class="sum-tag good">Strengths</span><ul>${s.strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    ${s.fix ? `<div class="sum-row"><span class="sum-tag fix">Fix next</span><p><strong>${esc(s.fix.label)}</strong>: focus on ${esc(s.fix.focus)}.
      <span class="dim">${esc(s.fix.cue)}.</span></p></div>` : ""}
    <div class="sum-row"><span class="sum-tag goal">Target</span><p>${esc(s.target)}.</p></div>`;
}

/** Per-rep table: score, time down / at the bottom / up, and what was flagged. */
function renderDetails(r) {
  const host = $("#res-details");
  const card = host.closest(".card");
  const rows = r.details ?? [];
  card.hidden = !rows.length;
  if (!rows.length) return;
  const f = (v) => (Number.isFinite(v) ? `${v.toFixed(1)} s` : "–");
  const head = r.isHold
    ? "<tr><th scope=col>#</th><th scope=col>Score</th><th scope=col>Length</th><th scope=col>Flagged</th></tr>"
    : "<tr><th scope=col>Rep</th><th scope=col>Score</th><th scope=col>Down</th><th scope=col>Bottom</th><th scope=col>Up</th><th scope=col>Flagged</th></tr>";
  host.innerHTML = `<thead>${head}</thead><tbody>${rows.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong style="color:${gradeVar(d.score)}">${d.score}</strong> <span class="dim">${gradeLetter(d.score)}</span></td>
      ${r.isHold ? `<td>${f(d.duration)}</td>` : `<td>${f(d.phases?.down)}</td><td>${f(d.phases?.bottom)}</td><td>${f(d.phases?.up)}</td>`}
      <td>${d.faults?.length ? d.faults.map((k) => esc(faultLabel(r.exercise, k))).join(", ") : '<span class="dim">clean</span>'}</td>
    </tr>`).join("")}</tbody>`;
  // Rows slide in one after another, each with a little motion blur.
  [...host.querySelectorAll("tbody tr")].forEach((tr, k) => {
    tr.style.opacity = "0";
    setTimeout(() => slide(tr, { from: [40, 0], to: [0, 0], opacity: [0, 1], duration: 360, ease: EASE.out }), 120 + k * 55);
  });
  // The summary lines too.
  [...$("#res-summary").children].forEach((row, k) => {
    row.style.opacity = "0";
    setTimeout(() => slide(row, { from: [0, 22], to: [0, 0], opacity: [0, 1], duration: 380, ease: EASE.out }), 80 + k * 90);
  });
}
