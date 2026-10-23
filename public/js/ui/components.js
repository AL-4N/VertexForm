/** components.js — small shared UI helpers. */

import { askPopup, growFrom } from "./popup.js";
import { scramble } from "./scramble.js";
import { gradeVar } from "../geometry.js";
import { slide, tween, EASE } from "./motion.js";

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Switch the visible screen. The new screen slides in with a horizontal
 * motion blur: from the right going forward, from the left going back
 * (js/ui/motion.js). `focus` = a selector to focus once it's showing (else
 * its heading), for keyboard and screen-reader users.
 */
// The control that was pressed last, measured as it was pressed, so the next
// screen can grow out of it (showScreen). Older than 700 ms: not the cause.
let pressed = null;
document.addEventListener("click", (e) => {
  const t = e.target instanceof Element && e.target.closest("button, a, [role=button], .ex-card, .mode-card, .path-card, .tree-node");
  if (t) pressed = { rect: t.getBoundingClientRect(), at: performance.now() };
}, true);

export function showScreen(id, { focus = null, dir = "forward", grow = true } = {}) {
  const next = document.getElementById(`screen-${id}`);
  const current = $(".screen.active");
  $$(".screen").forEach((s) => s.classList.toggle("active", s === next));
  window.scrollTo(0, 0);
  const target = (focus && $(focus)) || next?.querySelector("h1, h2");
  if (target) {
    if (!target.matches("button, a, input, select, textarea, [tabindex]")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
  if (next && current && current !== next && grow) {
    // Forward: the screen grows out of the button or card you pressed (or
    // out of the middle when nothing was pressed, like results after a set).
    // Back: it slides in from the left with a motion blur.
    if (dir === "back") slide(next, { from: [-64, 0], to: [0, 0], opacity: [0, 1], duration: 380, ease: EASE.out, strength: 1.1 });
    else {
      const recent = pressed && performance.now() - pressed.at < 700 ? pressed.rect : null;
      growFrom(next, recent, { items: [...next.children].slice(0, 8) });
    }
    pressed = null;
    // The screen's small labels decode as it opens.
    next.querySelectorAll(".label").forEach((l, i) => setTimeout(() => scramble(l), 120 + i * 60));
  }
}

/** Transient notification at the top of the window. */
export function toast(message, ms = 2800) {
  const host = $("#toasts");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  host.appendChild(el);
  // Pops open from a dot in the middle, drops into place, and closes back
  // into a dot when it's done.
  const shut = "inset(0 calc(50% - 6px) round 99px)", open = "inset(0 0 round 99px)";
  if (el.animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.animate([{ clipPath: shut, transform: "translateY(-14px) scale(.9)" }, { clipPath: open, transform: "none" }],
      { duration: 460, easing: "cubic-bezier(.2,.9,.3,1.2)" });
  }
  setTimeout(() => {
    if (!el.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.remove(); return; }
    el.animate([{ clipPath: open, opacity: 1 }, { clipPath: shut, opacity: 0 }], { duration: 300, easing: "cubic-bezier(.55,.06,.68,.19)", fill: "forwards" })
      .finished.then(() => el.remove());
  }, ms);
}

/** Build the markup for a labelled progress bar. */
export function barHTML({ label, value }, cls = "bar-row") {
  const v = Math.round(value);
  return `
    <div class="${cls}">
      <div class="bar-label"><span>${label}</span><span>${v}</span></div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${v}%;background:${gradeVar(v)}"></div>
      </div>
    </div>`;
}

/**
 * Show a set of bars. Rebuilds the markup only when the set of labels
 * changes; otherwise just updates numbers and widths in place, which keeps
 * the live screen cheap at 30 fps (no layout-thrashing innerHTML per frame).
 */
export function renderBars(host, bars, cls = "bar-row") {
  if (!host) return;
  const key = cls + "|" + bars.map((b) => b.label).join("|");
  if (host.dataset.bars !== key) {
    host.innerHTML = bars.map((b) => barHTML(b, cls)).join("");
    host.dataset.bars = key;
    // Results: new bars grow in one after another, their numbers counting up
    // with them. (Not the live HUD's bars: those update every rep.)
    if (cls === "res-bar" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      [...host.children].forEach((row, i) => {
        const v = Math.round(bars[i].value), fill = row.querySelector(".bar-fill"), num = row.querySelector(".bar-label span:last-child");
        const delay = 250 + i * 110;
        fill?.animate([{ width: "0%" }, { width: `${v}%` }], { duration: 900, delay, easing: "cubic-bezier(.22,.61,.36,1)", fill: "backwards" });
        if (num) {
          num.textContent = "0";
          setTimeout(() => tween(0, v, (x) => { num.textContent = Math.round(x); }, { duration: 900 }), delay);
        }
      });
    }
    return;
  }
  const rows = host.children;
  bars.forEach((b, i) => {
    const v = Math.round(b.value);
    const row = rows[i];
    if (!row || row.dataset.v === String(v)) return;
    row.dataset.v = v;
    row.querySelector(".bar-label span:last-child").textContent = v;
    const fill = row.querySelector(".bar-fill");
    fill.style.width = `${v}%`;
    fill.style.background = gradeVar(v);
  });
}

/**
 * Ask before doing something that can't be undone. A popup grows out of the
 * button that asked (ui/popup.js); resolves true only for the confirm button.
 * opts: { yes, danger } — button text, and red for destructive actions.
 */
export function confirmAction(message, opts = {}) {
  return askPopup(message, { yes: "Yes", ...opts });
}

/** Draw a small rep-by-rep bar chart onto a canvas. */
export function drawRepChart(canvas, scores, target) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const style = getComputedStyle(document.documentElement);
  const dim = style.getPropertyValue("--text-dim").trim() || "#98a0a6";

  ctx.clearRect(0, 0, w, h);
  if (!scores.length) {
    ctx.fillStyle = dim; ctx.font = "13px sans-serif";
    ctx.fillText("No reps recorded", 12, h / 2);
    return;
  }

  const pad = 24, padR = 70;                 // room on the right for the target label
  const chartH = h - pad * 1.5;
  const slot = (w - pad - padR) / scores.length;
  const barW = Math.min(46, slot - 8);

  // Target line
  const ty = pad + chartH * (1 - target / 100);
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(pad, ty); ctx.lineTo(w - padR + 8, ty); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = dim; ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`target ${target}`, w - padR + 14, ty + 4);

  scores.forEach((s, i) => {
    const x = pad + i * slot + (slot - barW) / 2;
    const bh = Math.max(3, chartH * (s / 100));
    const y = pad + chartH - bh;
    ctx.fillStyle = gradeVar(s);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, barW, bh, 4); else ctx.rect(x, y, barW, bh);
    ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(s), x + barW / 2, y - 5);
    ctx.textAlign = "left";
  });
}
