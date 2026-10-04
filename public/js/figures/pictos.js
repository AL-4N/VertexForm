/**
 * pictos.js — small static figures for the exercise cards, drawn by the same
 * rig as the hero, in each exercise's "good form" position and stroked with
 * the grade gradient's A end.
 */

import { build, angleAt } from "./rig.js";
import { EXERCISES, GROUND } from "./poses.js";

const NS = "http://www.w3.org/2000/svg";
const P = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

// App exercise names → figure ids
export const BY_NAME = { "Squat": "squat", "Push-up": "pushup", "Plank": "plank", "Lunge": "lunge", "Jumping Jack": "jack" };

export function renderPictos(root = document) {
  root.querySelectorAll("[data-picto]").forEach((host) => {
    const key = BY_NAME[host.dataset.picto] ?? host.dataset.picto;
    const ex = EXERCISES.find((e) => e.id === key);
    if (!ex) return;
    const s = build(ex[ex.good ?? "bottom"]);

    // Fit the viewBox to the figure plus a little floor.
    const pts = Object.values(s).filter(Array.isArray);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const pad = 28;
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
    const y0 = Math.min(...ys) - pad - 19, y1 = GROUND + 14;

    const id = `pg-${ex.id}`;
    const legs = s.front
      ? [[s.hpN, s.kneeN, s.ankN, s.toeN], [s.hpF, s.kneeF, s.ankF, s.toeF]]
      : [[s.hip, s.kneeN, s.ankN, s.toeN]];
    const farLegs = s.front ? [] : [[s.hip, s.kneeF, s.ankF, s.toeF]];
    const arms = s.front
      ? [[s.shN, s.elbN, s.wriN], [s.shF, s.elbF, s.wriF]]
      : [[s.neck, s.elbN, s.wriN]];
    const farArms = s.front ? [] : [[s.neck, s.elbF, s.wriF]];
    const spine = s.front ? [s.hpN, s.hpF, s.hip, s.neck] : [s.hip, s.neck];

    const line = (arr, cls = "") => `<polyline class="${cls}" points="${arr.map(P).join(" ")}"/>`;
    host.innerHTML = `
      <svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" aria-hidden="true">
        <defs>
          <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x0}" y1="${y1}" x2="${x1}" y2="${y0}">
            <stop offset="0" stop-color="#c6ef4e"/><stop offset="1" stop-color="#2ee59d"/>
          </linearGradient>
        </defs>
        <line x1="${x0}" y1="${GROUND}" x2="${x1}" y2="${GROUND}" class="picto-floor"/>
        <g class="picto-far" stroke="url(#${id})">${[...farLegs, ...farArms].map((a) => line(a)).join("")}</g>
        <g class="picto-near" stroke="url(#${id})">
          ${line(spine)}${legs.map((a) => line(a)).join("")}${arms.map((a) => line(a)).join("")}
          ${s.front ? line([s.shN, s.shF]) : ""}
          <circle cx="${s.head[0].toFixed(1)}" cy="${s.head[1].toFixed(1)}" r="19"/>
        </g>
      </svg>`;
  });
}

