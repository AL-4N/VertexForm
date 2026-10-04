/**
 * overlay.js — everything drawn onto the live <canvas>:
 * the video frame, your skeleton, and the green ideal-form guide.
 */

import { POSE_EDGES } from "../config.js";

const css = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Fit the canvas bitmap to the video's real size (and the CSS box). */
export function sizeCanvas(canvas, video) {
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h };
}

/** Paint the current video frame, optionally mirrored. */
export function drawFrame(ctx, video, w, h, mirror) {
  ctx.save();
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
}

/** Draw your tracked skeleton in the "you" colour. */
/** colour: the live score's grade colour, so your skeleton shows how you're doing. */
export function drawSkeleton(ctx, lms, w, h, mirror, colour) {
  const X = (p) => (mirror ? (1 - p.x) : p.x) * w;
  const Y = (p) => p.y * h;

  ctx.save();
  const tint = colour || css("--you") || "#c6ef4e";
  ctx.lineWidth = Math.max(3, w / 240);
  ctx.strokeStyle = tint;
  ctx.lineCap = "round";

  for (const [a, b] of POSE_EDGES) {
    const p = lms[a], q = lms[b];
    if (!p || !q) continue;
    if ((p.visibility ?? 1) < 0.3 || (q.visibility ?? 1) < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(X(p), Y(p));
    ctx.lineTo(X(q), Y(q));
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  const r = Math.max(3, w / 220);
  for (let i = 11; i < lms.length; i++) {          // skip face points
    const p = lms[i];
    if (!p || (p.visibility ?? 1) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(X(p), Y(p), r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw the ideal-form guide: a chain of points in pixel space returned by
 * an exercise module's drawIdeal().
 */
export function drawIdealChain(ctx, pts, w, mirror) {
  if (!pts || pts.length < 2) return;
  const X = (p) => (mirror ? (w - p.x) : p.x);

  ctx.save();
  ctx.strokeStyle = css("--ideal") || "#78ff78";
  ctx.fillStyle = css("--ideal") || "#78ff78";
  ctx.lineWidth = Math.max(3, w / 260);
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.9;
  ctx.setLineDash([Math.max(8, w / 90), Math.max(7, w / 110)]);

  ctx.beginPath();
  ctx.moveTo(X(pts[0]), pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i]), pts[i].y);
  ctx.stroke();

  const r = Math.max(4, w / 200);
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(X(p), p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A coloured border that reflects the live score. */
export function drawBorder(ctx, w, h, score, target) {
  const colour =
    score >= target ? css("--lime") :
    score >= target - 20 ? css("--amber") : css("--coral");
  ctx.save();
  ctx.strokeStyle = colour || "#f0655e";
  ctx.lineWidth = Math.max(8, w / 90);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2,
                 w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
}
