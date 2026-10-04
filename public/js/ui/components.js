/** components.js — small shared UI helpers. */

import { gradeVar } from "../geometry.js";

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Switch the visible screen. */
export function showScreen(id) {
  $$(".screen").forEach((s) => s.classList.toggle("active", s.id === `screen-${id}`));
  window.scrollTo(0, 0);
}

/** Transient notification at the top of the window. */
export function toast(message, ms = 2800) {
  const host = $("#toasts");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 320);
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

/** Simple confirm dialog built on the native one — honest and accessible. */
export function confirmAction(message) {
  return window.confirm(message);
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
