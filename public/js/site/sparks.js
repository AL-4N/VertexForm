/**
 * sparks.js — a click throws a few short sparks (an idea from React Bits'
 * "Click Spark", rebuilt in plain JS): eight strokes shoot out from the
 * point you clicked in the grade colours and fade within 0.4 s. One
 * full-window canvas that only draws while sparks are in the air.
 * Mouse only; off for reduced motion.
 */

import { reducedMotion } from "../ui/motion.js";
import { GRADE_STOPS } from "../grade.js";

export function mountSparks() {
  if (reducedMotion() || !matchMedia("(pointer: fine)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "sparks";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const colours = GRADE_STOPS.slice(2).map(([, c]) => c);       // amber → green
  let bursts = [], raf = 0;

  const fit = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();
  addEventListener("resize", fit);

  const draw = (now) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    bursts = bursts.filter((b) => now - b.at < 420);
    for (const b of bursts) {
      const k = (now - b.at) / 420, e = 1 - Math.pow(1 - k, 3);
      for (let i = 0; i < 8; i++) {
        const a = b.turn + (i / 8) * Math.PI * 2;
        const r0 = 6 + e * 26, r1 = r0 + 10 * (1 - k);
        ctx.strokeStyle = colours[i % colours.length];
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * r0, b.y + Math.sin(a) * r0);
        ctx.lineTo(b.x + Math.cos(a) * r1, b.y + Math.sin(a) * r1);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    raf = bursts.length ? requestAnimationFrame(draw) : 0;
  };

  addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    bursts.push({ x: e.clientX, y: e.clientY, at: performance.now(), turn: Math.random() * Math.PI });
    raf ||= requestAnimationFrame(draw);
  }, { passive: true });
}
