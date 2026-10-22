/**
 * overlay.js — everything drawn onto the live <canvas>:
 * the video frame, your skeleton, and the green ideal-form guide.
 */

import { POSE_EDGES } from "../config.js";

// Theme colours, read once (getComputedStyle every frame forces style work).
const cssCache = new Map();
const css = (name) => {
  if (!cssCache.has(name)) cssCache.set(name, getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  return cssCache.get(name);
};

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

/**
 * Your tracked skeleton. colour: the live score's grade colour (or neutral);
 * alpha: 0..1, faded in and out by live.js so it never flickers.
 */
export function drawSkeleton(ctx, lms, w, h, mirror, colour, alpha = 1) {
  if (alpha <= 0.01) return;
  const X = (p) => (mirror ? (1 - p.x) : p.x) * w;
  const Y = (p) => p.y * h;

  ctx.save();
  ctx.globalAlpha = alpha;
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

/**
 * Framing guide: a dashed target box (where your whole body should be) and
 * corner brackets around where you are now. Green when you're inside it.
 * `check` comes from tracking.framingCheck(), in display (mirrored) coords.
 */
export function drawFramingGuide(ctx, w, h, check, margin = 0.03) {
  const ok = check?.ok;
  const colour = ok ? (css("--lime") || "#2ee59d") : (css("--amber") || "#ffbe3d");
  ctx.save();
  ctx.lineWidth = Math.max(2, w / 400);
  ctx.strokeStyle = colour;
  ctx.globalAlpha = ok ? 0.55 : 0.8;
  ctx.setLineDash([Math.max(10, w / 70), Math.max(8, w / 90)]);
  const x = w * margin, y = h * margin;
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w - 2 * x, h - 2 * y, 18); ctx.stroke(); }
  else ctx.strokeRect(x, y, w - 2 * x, h - 2 * y);

  const b = check?.box;
  if (b) {
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(3, w / 300);
    const x0 = b.x0 * w, x1 = b.x1 * w, y0 = Math.max(0, b.y0) * h, y1 = Math.min(1, b.y1) * h;
    const k = Math.min(28, (x1 - x0) / 3, (y1 - y0) / 3);
    ctx.beginPath();
    for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      ctx.moveTo(cx + dx * k, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * k);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The ideal-form guide (geometry from js/guide.js, already mirrored to match
 * the picture): soft glow, dashed green lines, rounded joints, thickness
 * relative to the frame. A circle around your head is cut out so the guide
 * never covers your face.
 */
export function drawGuide(ctx, g, w, h, alpha = 1) {
  if (!g || alpha <= 0.01) return;
  const green = css("--ideal") || "#2ee59d";
  const lw = Math.max(2.5, h / 170);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (g.head) {                                   // everything except the head zone
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(g.head.x, g.head.y, g.head.r, 0, Math.PI * 2);
    ctx.clip("evenodd");
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(46,229,157,.75)";
  ctx.shadowBlur = h / 55;

  if (g.wedge) {                                  // torso-lean green zone
    const { x, y, r, a0, a1 } = g.wedge;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, a0, a1, a1 < a0);
    ctx.closePath();
    ctx.fillStyle = "rgba(46,229,157,.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(46,229,157,.55)";
    ctx.lineWidth = lw * 0.6;
    ctx.setLineDash([]);
    ctx.stroke();
  }
  if (g.depth) {                                  // "parallel" line at knee height (thin dots: not part of the pose)
    ctx.save();
    ctx.globalAlpha = alpha * 0.75;
    ctx.strokeStyle = green;
    ctx.lineWidth = lw * 0.55;
    ctx.setLineDash([lw * 0.4, lw * 1.6]);
    ctx.beginPath();
    ctx.moveTo(g.depth.x0, g.depth.y);
    ctx.lineTo(g.depth.x1, g.depth.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // Label under the far end of the line, clear of the target pose.
    ctx.shadowBlur = 0;
    const fs = Math.max(12, h / 46);
    ctx.font = `600 ${fs}px "Instrument Sans", system-ui, sans-serif`;
    const label = "parallel";
    const tw = ctx.measureText(label).width;
    const tx = g.depth.x0 < g.depth.x1 ? g.depth.x0 : g.depth.x0 - tw;
    const ty = g.depth.y + fs * 1.5;
    ctx.fillStyle = "rgba(9,13,28,.72)";
    ctx.fillRect(tx - 5, ty - fs * 1.05, tw + 10, fs * 1.35);
    ctx.fillStyle = green;
    ctx.fillText(label, tx, ty);
    ctx.restore();
  }
  if (g.line) {                                   // push-up / plank: one straight line + tolerance band
    const [a, b] = g.line;
    const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
    const ox = (nx / nl) * g.band, oy = (ny / nl) * g.band;
    ctx.beginPath();
    ctx.moveTo(a.x + ox, a.y + oy); ctx.lineTo(b.x + ox, b.y + oy);
    ctx.lineTo(b.x - ox, b.y - oy); ctx.lineTo(a.x - ox, a.y - oy);
    ctx.closePath();
    ctx.fillStyle = "rgba(46,229,157,.14)";
    ctx.fill();
    ctx.strokeStyle = green;
    ctx.lineWidth = lw;
    ctx.setLineDash([lw * 3, lw * 2.2]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
    dot(ctx, g.idealHip, lw * 1.5, green);
  }
  if (g.chain) {                                  // target pose at the bottom
    ctx.strokeStyle = green;
    ctx.lineWidth = lw;
    ctx.setLineDash([lw * 3, lw * 2.2]);
    ctx.beginPath();
    g.chain.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    g.chain.forEach((p) => dot(ctx, p, lw * 1.4, green));
  }
  if (g.markers) {                                // jumping jack: hands up to here
    for (const m of g.markers) {
      ctx.strokeStyle = green;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(m.x, m.y, lw * 4, 0, Math.PI * 2);
      ctx.stroke();
      dot(ctx, m, lw * 1.2, green);
    }
  }
  ctx.restore();
}

function dot(ctx, p, r, colour) {
  if (!p) return;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
}
