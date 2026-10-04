/**
 * sharecard.js — draws a 1080×1350 score card (Instagram portrait size) for
 * a finished session and downloads it as a PNG. Everything is drawn on a
 * canvas locally; nothing is uploaded.
 */

import { build } from "../figures/rig.js";
import { BY_ID, GROUND } from "../figures/poses.js";
import { BY_NAME } from "../figures/pictos.js";
import { bounds } from "../figures/draw.js";
import { GRADE_STOPS, gradeColor, gradeLetter } from "../grade.js";

const W = 1080, H = 1350;
const NAVY = "#090d1c", INK2 = "#0d1326", DIM = "#a6aecb", FAINT = "#737d9f", LINE = "#222c4e";

function gradeGradient(ctx, x0, x1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  GRADE_STOPS.forEach(([s, c]) => g.addColorStop(s / 100, c));
  return g;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw a posed skeleton into the box (bx, by, bw, bh). */
function drawFigure(ctx, s, color, bx, by, bw, bh) {
  const b = bounds(s, 30);
  const k = Math.min(bw / b.w, bh / b.h);
  const ox = bx + (bw - b.w * k) / 2 - b.x0 * k;
  const oy = by + (bh - b.h * k) - b.y0 * k + 0;
  const T = (p) => [ox + p[0] * k, oy + p[1] * k];

  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "#2e3a63"; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx, T([0, GROUND])[1]); ctx.lineTo(bx + bw, T([0, GROUND])[1]);
  ctx.stroke();

  const poly = (pts, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    pts.map(T).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  ctx.strokeStyle = color; ctx.lineWidth = 7 * k;
  ctx.shadowColor = color; ctx.shadowBlur = 24;
  if (s.front) {
    [[s.hpF, s.kneeF, s.ankF, s.toeF], [s.hpN, s.kneeN, s.ankN, s.toeN], [s.shF, s.elbF, s.wriF],
     [s.shN, s.elbN, s.wriN], [s.shN, s.shF], [s.hpN, s.hpF, s.hip, s.neck]].forEach((p) => poly(p));
  } else {
    poly([s.hip, s.kneeF, s.ankF, s.toeF], 0.38);
    poly([s.neck, s.elbF, s.wriF], 0.38);
    [[s.hip, s.neck], [s.hip, s.kneeN, s.ankN, s.toeN], [s.neck, s.elbN, s.wriN]].forEach((p) => poly(p));
  }
  ctx.globalAlpha = 1;
  const [hx, hy] = T(s.head);
  ctx.beginPath(); ctx.arc(hx, hy, 19 * k, 0, Math.PI * 2);
  ctx.fillStyle = INK2; ctx.fill();
  ctx.lineWidth = 6 * k; ctx.stroke();
  ctx.restore();
}

function drawMark(ctx, x, y, size) {
  const k = size / 32;
  const g = ctx.createLinearGradient(x, y + size, x + size, y);
  g.addColorStop(0, "#ff4d6d"); g.addColorStop(0.45, "#ffbe3d"); g.addColorStop(0.75, "#c6ef4e"); g.addColorStop(1, "#2ee59d");
  ctx.save();
  ctx.strokeStyle = g; ctx.lineCap = "round";
  ctx.lineWidth = 3.2 * k;
  ctx.beginPath(); ctx.moveTo(x + 5 * k, y + 26 * k); ctx.lineTo(x + 28 * k, y + 26 * k);
  ctx.moveTo(x + 5 * k, y + 26 * k); ctx.lineTo(x + 19 * k, y + 5 * k); ctx.stroke();
  ctx.lineWidth = 2.2 * k;
  ctx.beginPath(); ctx.arc(x + 5 * k, y + 26 * k, 9.5 * k, -Math.PI * 0.32, 0); ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(x + 5 * k, y + 26 * k, 3.6 * k, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export async function renderScoreCard(r) {
  try { await document.fonts?.ready; } catch { /* draw with fallback fonts */ }
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const color = gradeColor(r.best);

  // Background + glow behind the figure
  ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 600, 40, W / 2, 600, 520);
  glow.addColorStop(0, color + "40"); glow.addColorStop(1, color + "00");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = gradeGradient(ctx, 0, W); ctx.fillRect(0, 0, W, 14);

  // Wordmark + date
  drawMark(ctx, 84, 82, 64);
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 46px Unbounded, system-ui, sans-serif";
  ctx.fillStyle = "#fff"; ctx.fillText("Vertex", 166, 132);
  const vw = ctx.measureText("Vertex").width;
  const fg = ctx.createLinearGradient(166 + vw, 0, 166 + vw + 140, 0);
  fg.addColorStop(0, "#ffbe3d"); fg.addColorStop(0.45, "#c6ef4e"); fg.addColorStop(1, "#2ee59d");
  ctx.fillStyle = fg; ctx.fillText("Form", 166 + vw, 132);
  ctx.font = "500 30px 'Instrument Sans', system-ui, sans-serif";
  ctx.fillStyle = FAINT; ctx.textAlign = "right";
  ctx.fillText(new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), W - 84, 128);
  ctx.textAlign = "left";

  // Exercise name
  ctx.font = "800 84px Unbounded, system-ui, sans-serif";
  ctx.fillStyle = "#eef1fb";
  ctx.fillText(r.exercise, 84, 290);

  // Figure in its good-form position, coloured by the score
  const ex = BY_ID[BY_NAME[r.exercise]];
  if (ex) drawFigure(ctx, build(ex[ex.good ?? "bottom"]), color, 120, 330, W - 240, 520);

  // Score
  ctx.font = "800 230px Unbounded, system-ui, sans-serif";
  ctx.fillStyle = color;
  ctx.fillText(String(r.best), 76, 1090);
  const sw = ctx.measureText(String(r.best)).width;
  ctx.font = "700 92px Unbounded, system-ui, sans-serif";
  ctx.fillText(gradeLetter(r.best), 76 + sw + 28, 1090);
  ctx.font = "500 34px 'Instrument Sans', system-ui, sans-serif";
  ctx.fillStyle = DIM;
  const sub = r.reps.length > 1 ? `Best of ${r.reps.length} reps · average ${r.average}` : "Single rep";
  ctx.fillText(sub + (r.isBest ? "  ·  new personal best" : ""), 84, 1150);

  // Rep chips
  const reps = r.reps.slice(-12);
  const cw = 70, gap = 8;
  reps.forEach((sc, i) => {
    const x = 84 + i * (cw + gap), y = 1188;
    roundRect(ctx, x, y, cw, 48, 14);
    ctx.fillStyle = gradeColor(sc); ctx.fill();
    ctx.font = "700 24px Unbounded, system-ui, sans-serif";
    ctx.fillStyle = "#07140e"; ctx.textAlign = "center";
    ctx.fillText(String(sc), x + cw / 2, y + 33);
    ctx.textAlign = "left";
  });

  // Footer
  ctx.fillStyle = LINE; ctx.fillRect(84, 1268, W - 168, 2);
  ctx.font = "500 28px 'Instrument Sans', system-ui, sans-serif";
  ctx.fillStyle = FAINT;
  ctx.fillText("Graded live by VertexForm · form feedback for every rep", 84, 1316);
  return c;
}

export async function saveScoreCard(r) {
  const c = await renderScoreCard(r);
  const blob = await new Promise((res) => c.toBlob(res, "image/png"));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vertexform-${r.exercise.toLowerCase().replace(/[^a-z]+/g, "-")}-${r.best}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
