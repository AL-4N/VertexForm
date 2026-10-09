/**
 * replay.js (ui) — watch your reps back.
 *
 *   createPlayer   your skeleton replaying on the drafting grid, coloured by
 *                  the rep's score, with a protractor reading the key angle
 *                  (knee, elbow…) frame by frame. Play/pause, scrub, ½× speed.
 *   Results card   after a set: every rep as a chip, best and worst marked;
 *                  pick one to watch, and Save it to keep it.
 *   Replays screen saved reps (kept until you delete them) and recent sets
 *                  (deleted for good 7 days after the set unless saved).
 *
 * Clips come from js/repclips.js and are stored by js/replay-store.js.
 */

import {
  SIDE, chains, KEY_ANGLE, KEEP_DAYS, framePoints, nearSide, keyAngle, deepestFrame,
  clipBounds, daysLeft, bestAndWorst, phaseProgress, frameAtProgress, facingDir,
} from "../repclips.js";
import { build, blend } from "../figures/rig.js";
import { BY_ID } from "../figures/poses.js";
import { figureMarkup, bounds } from "../figures/draw.js";
import { BY_NAME } from "../figures/pictos.js";
import { LAB } from "../figures/lab.js";
import { allClips, putClips, removeClip, purgeExpired } from "../replay-store.js";
import { angleMark } from "../figures/annotate.js";
import { gradeColor, gradeLetter } from "../grade.js";
import { $, showScreen, toast, confirmAction } from "./components.js";

const VIEW_W = 600, VIEW_H = 400;
const f1 = (n) => n.toFixed(1);

const ICON = {
  play: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z"/></svg>`,
  pause: `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="4" width="3.5" height="12" rx="1"/><rect x="11.5" y="4" width="3.5" height="12" rx="1"/></svg>`,
  star: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z"/></svg>`,
};

/* ── Drawing one frame ─────────────────────────────────── */

/** Fit a clip into the view: a function from clip units to view pixels. */
function fitter(clip, w = VIEW_W, h = VIEW_H, pad = 36) {
  const b = clipBounds(clip);
  const bw = Math.max(0.05, b.x1 - b.x0), bh = Math.max(0.05, b.y1 - b.y0);
  const s = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
  const ox = (w - bw * s) / 2 - b.x0 * s, oy = (h - bh * s) / 2 - b.y0 * s;
  return { map: (p) => [p.x * s + ox, p.y * s + oy], floor: b.y1 * s + oy + 6, s };
}

/** SVG markup for frame i of a clip. */
export function frameMarkup(clip, i, fit, near, { marks = true, width = 7 } = {}) {
  const pts = framePoints(clip, i).map((p) => ({ ...p, xy: fit.map(p) }));
  const c = gradeColor(clip.score ?? 0);
  const far = near === "L" ? "R" : "L";
  const line = (ids, op) => `<polyline points="${ids.map((j) => pts[j].xy.map(f1).join(",")).join(" ")}" fill="none" stroke="${c}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
  const S = SIDE[near];
  const torso = Math.hypot(pts[S.sh].xy[0] - pts[S.hip].xy[0], pts[S.sh].xy[1] - pts[S.hip].xy[1]);
  const r = Math.max(9, Math.min(26, torso * 0.22));
  let out = `<line x1="16" y1="${f1(fit.floor)}" x2="${VIEW_W - 16}" y2="${f1(fit.floor)}" class="rp-floor"/>`;
  out += chains(SIDE[far]).map((ch) => line(ch, 0.35)).join("");
  out += chains(S).map((ch) => line(ch, 1)).join("");
  const nose = pts[0].xy;
  out += `<circle cx="${f1(nose[0])}" cy="${f1(nose[1])}" r="${f1(r)}" fill="#0d1326" stroke="${c}" stroke-width="${width * 0.8}"/>`;
  out += [S.sh, S.el, S.wr, S.hip, S.kn, S.an].map((j) => `<circle cx="${f1(pts[j].xy[0])}" cy="${f1(pts[j].xy[1])}" r="${width * 0.6}" fill="#fff"/>`).join("");
  if (marks) {
    const k = keyAngle(clip, i, near);
    if (k) out += angleMark(...k.at.map((j) => pts[j].xy), { r: 32 });
  }
  return out;
}

/** A still of the rep's deepest moment, for lists. */
function thumbSVG(clip) {
  const fit = fitter(clip, VIEW_W, VIEW_H, 50);
  return `<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" aria-hidden="true">${frameMarkup(clip, deepestFrame(clip), fit, nearSide(clip), { marks: false, width: 12 })}</svg>`;
}

/* ── Ideal form, in step with you ──────────────────────── */

/**
 * The site's stick figure doing a clean rep, timed to your rep's phases
 * (it reaches the bottom exactly when you do). Holds stay in their good
 * position. Drawn facing the same way you were.
 */
function idealMarkup(exercise, p, faceDir) {
  const id = BY_NAME[exercise], ex = BY_ID[id];
  if (!ex) return null;
  const top = build(ex.top), bottom = build(ex.bottom);
  const b0 = bounds(top, 40), b1 = bounds(bottom, 40);
  let x0 = Math.min(b0.x0, b1.x0), x1 = Math.max(b0.x1, b1.x1), y0 = Math.min(b0.y0, b1.y0), y1 = Math.max(b0.y1, b1.y1);
  // Same 3:2 shape as your pane.
  const w = x1 - x0, h = y1 - y0, want = VIEW_W / VIEW_H;
  if (w / h < want) { const add = h * want - w; x0 -= add / 2; x1 += add / 2; } else { const add = w / want - h; y0 -= add; }
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
  const t = ex.isHold || ex.id === "plank" ? (ex.good === "top" ? 0 : 1) : ease(p <= 0.5 ? p / 0.5 : (1 - p) / 0.5);
  let s = build(blend(ex.top, ex.bottom, t));
  // Face the same way you did (side views only).
  const rigDir = top.toeN && top.ankN ? Math.sign(top.toeN[0] - top.ankN[0]) || 1 : 1;
  if (!s.front && faceDir !== rigDir) {
    const cx = (x0 + x1) / 2;
    s = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Array.isArray(v) ? [2 * cx - v[0], v[1]] : v]));
  }
  const arc = LAB[id]?.arc?.(s);
  return {
    viewBox: `${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}`,
    markup: figureMarkup(s, { color: "#2ee59d", floor: { x0: x0 + 16, x1: x1 - 16 }, floorColor: "#2e3a63", headFill: "#0d1326", joints: false })
      + (arc ? angleMark(...arc, { r: 32 }) : ""),
  };
}

/* ── Player ────────────────────────────────────────────── */

/**
 * Compare modes: "off", "ideal" (the clean stick figure) or "best" (the
 * set's best rep). The choice sticks as you move between reps.
 */
export function createPlayer(host) {
  host.innerHTML = `
    <div class="rp">
      <div class="rp-stage">
        <figure class="rp-pane"><svg class="rp-svg rp-a" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img"></svg><figcaption class="rp-cap rp-cap-a" hidden></figcaption></figure>
        <figure class="rp-pane rp-pane-b" hidden><svg class="rp-svg rp-b" viewBox="0 0 ${VIEW_W} ${VIEW_H}" aria-hidden="true"></svg><figcaption class="rp-cap rp-cap-b"></figcaption></figure>
      </div>
      <div class="rp-controls">
        <button type="button" class="rp-play" aria-label="Play">${ICON.play}</button>
        <input type="range" class="rp-scrub" min="0" max="1" step="1" value="0" aria-label="Position in the rep" />
        <span class="rp-time" aria-hidden="true">0.0 s</span>
        <div class="rp-seg rp-speed" role="group" aria-label="Speed">
          <button type="button" data-speed="1" aria-pressed="true">1×</button>
          <button type="button" data-speed="0.5" aria-pressed="false">½×</button>
        </div>
      </div>
      <div class="rp-row">
        <p class="rp-angle"></p>
        <div class="rp-seg rp-compare" role="group" aria-label="Compare with">
          <span class="rp-seg-label">Compare</span>
          <button type="button" data-cmp="off" aria-pressed="true">Off</button>
          <button type="button" data-cmp="ideal" aria-pressed="false">Ideal form</button>
          <button type="button" data-cmp="best" aria-pressed="false">Best rep</button>
        </div>
      </div>
    </div>`;
  const q = (sel) => host.querySelector(sel);
  const stage = q(".rp-stage"), svg = q(".rp-a"), svgB = q(".rp-b"), paneB = q(".rp-pane-b");
  const capA = q(".rp-cap-a"), capB = q(".rp-cap-b"), play = q(".rp-play");
  const scrub = q(".rp-scrub"), time = q(".rp-time"), angleEl = q(".rp-angle"), bestBtn = q('[data-cmp="best"]');
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let clip = null, fit = null, near = "L", deep = 0, i = 0, pos = 0, speed = 1, playing = false, raf = 0, last = 0, holdUntil = 0, visible = true;
  let mode = "off", best = null, other = null;     // other: { clip, fit, near, deep } for "best"

  const frameAt = (ms) => {
    let k = 0;
    while (k < clip.n - 1 && clip.t[k + 1] <= ms) k++;
    return k;
  };

  function drawB() {
    const p = phaseProgress(clip, i, deep);
    if (mode === "ideal") {
      const ideal = idealMarkup(clip.exercise, p, facingDir(clip, near));
      if (!ideal) return;
      svgB.setAttribute("viewBox", ideal.viewBox);
      svgB.innerHTML = ideal.markup;
    } else if (mode === "best" && other) {
      svgB.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
      svgB.innerHTML = frameMarkup(other.clip, frameAtProgress(other.clip, p, other.deep), other.fit, other.near);
    }
  }
  function show(k) {
    i = k;
    svg.innerHTML = frameMarkup(clip, i, fit, near);
    if (mode !== "off") drawB();
    scrub.value = String(i);
    time.textContent = `${(clip.t[i] / 1000).toFixed(1)} s`;
    const spec = KEY_ANGLE[clip.exercise], a = keyAngle(clip, i, near);
    angleEl.textContent = spec && a ? `${spec.name}: ${Math.round(a.deg)}°` : "";
  }
  function setMode(m) {
    if (m === "best" && !(best && best.id !== clip?.id)) m = "off";
    mode = m;
    other = m === "best" ? { clip: best, fit: fitter(best), near: nearSide(best), deep: deepestFrame(best) } : null;
    host.querySelectorAll("[data-cmp]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cmp === mode)));
    const on = mode !== "off";
    paneB.hidden = !on; capA.hidden = !on;
    stage.classList.toggle("two", on);
    if (clip) {
      capA.textContent = `You, rep ${clip.index} (${clip.score})`;
      capB.textContent = mode === "ideal" ? "Ideal form, in step with you" : other ? `Your best, rep ${other.clip.index} (${other.clip.score})` : "";
      show(i);
    }
  }
  function setPlaying(on) {
    playing = on;
    play.innerHTML = on ? ICON.pause : ICON.play;
    play.setAttribute("aria-label", on ? "Pause" : "Play");
    cancelAnimationFrame(raf); raf = 0; last = 0;
    if (on) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = 0;
    if (!playing || !clip) return;
    if (!visible) { raf = requestAnimationFrame(tick); last = now; return; }
    const dt = last ? Math.min(100, now - last) : 0;
    last = now;
    if (now < holdUntil) { raf = requestAnimationFrame(tick); return; }
    pos += dt * speed;
    const end = clip.t[clip.n - 1];
    if (pos > end) { pos = 0; holdUntil = now + 500; show(clip.n - 1); }     // a beat at the end, then loop
    else show(frameAt(pos));
    raf = requestAnimationFrame(tick);
  }

  play.addEventListener("click", () => setPlaying(!playing));
  scrub.addEventListener("input", () => { setPlaying(false); show(Number(scrub.value)); pos = clip.t[i]; });
  q(".rp-speed").addEventListener("click", (e) => {
    const b = e.target.closest("[data-speed]");
    if (!b) return;
    speed = Number(b.dataset.speed);
    host.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  });
  q(".rp-compare").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cmp]");
    if (b && !b.disabled) setMode(b.dataset.cmp);
  });
  // Only spend frames while the player is on screen.
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(svg);

  return {
    /** Play a clip. `opts.best`: the clip "Best rep" compares with (or null). */
    load(c, opts = {}) {
      clip = c; fit = fitter(c); near = nearSide(c); deep = deepestFrame(c);
      best = opts.best ?? null;
      const canBest = !!(best && best.id !== c.id);
      bestBtn.disabled = !canBest;
      bestBtn.title = canBest ? "" : best ? "This is your best rep" : "No other rep to compare with";
      scrub.max = String(c.n - 1);
      svg.setAttribute("aria-label", `Replay of ${c.exercise.toLowerCase()} rep ${c.index}, scored ${c.score}`);
      pos = 0; i = 0;
      setMode(mode === "best" && !canBest ? "off" : mode);
      if (reduce) { setPlaying(false); show(deep); }      // a still of the bottom; Play still works
      else { show(0); setPlaying(true); }
    },
    stop() { setPlaying(false); },
  };
}

/* ── Shared bits ───────────────────────────────────────── */

function saveButton(clip) {
  return `<button type="button" class="btn rp-save" data-save="${clip.id}" aria-pressed="${!!clip.saved}">${ICON.star}<span>${clip.saved ? "Saved" : "Save rep"}</span></button>`;
}

const dateText = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
  ", " + new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function keepText(clip) {
  if (clip.saved) return "Saved. Kept until you delete it.";
  const d = daysLeft(clip);
  return d > 1 ? `Not saved. Deleted in ${d} days.` : d === 1 ? "Not saved. Deleted tomorrow." : "Not saved. Deleted next time the app opens.";
}

function infoHTML(clip, total) {
  const c = gradeColor(clip.score);
  return `
    <p class="rp-which">Rep ${clip.index}${clip.of ?? total ? ` of ${clip.of ?? total}` : ""}</p>
    <p class="rp-score" style="color:${c}">${clip.score}<span>${gradeLetter(clip.score)}</span></p>
    ${clip.faults?.length ? `<ul class="rp-faults">${clip.faults.map((f) => `<li>${f}</li>`).join("")}</ul>` : `<p class="dim small">No faults on this rep.</p>`}
    ${saveButton(clip)}
    <p class="rp-keep dim small">${keepText(clip)}</p>`;
}

async function toggleSave(clip) {
  clip.saved = !clip.saved;
  await putClips([clip]);       // the whole clip, so it's right even if the set is still being written
  toast(clip.saved ? "Rep saved" : `Removed from saved. ${daysLeft(clip) > 0 ? `Deleted in ${daysLeft(clip)} days.` : "Deleted next time the app opens."}`);
}

/* ── Results card ──────────────────────────────────────── */

let cardPlayer = null;

/** After a set: watch any rep, save the ones to keep. Hidden if there are no clips. */
export function renderReplayCard(clips) {
  const card = $("#res-replay-card");
  if (!clips?.length) { card.hidden = true; cardPlayer?.stop(); return; }
  card.hidden = false;
  cardPlayer ??= createPlayer($("#res-player"));
  const { best, worst } = bestAndWorst(clips);
  let pick = worst ?? best;     // the rep with the most to learn from

  const strip = $("#res-strip");
  const draw = () => {
    strip.innerHTML = clips.map((c, k) => `
      <button type="button" class="rep-chip${k === pick ? " on" : ""}${c.saved ? " saved" : ""}" data-k="${k}" aria-pressed="${k === pick}"
        aria-label="Rep ${c.index}, ${c.score}${k === best ? ", best" : k === worst ? ", worst" : ""}${c.saved ? ", saved" : ""}" style="--c:${gradeColor(c.score)}">
        <b>${c.score}</b><span>${k === best ? "best" : k === worst ? "worst" : `rep ${c.index}`}</span>
      </button>`).join("");
    $("#res-replay-info").innerHTML = infoHTML(clips[pick], clips.length);
  };
  draw();
  cardPlayer.load(clips[pick], { best: clips[best] });

  strip.onclick = (e) => {
    const b = e.target.closest("[data-k]");
    if (!b) return;
    pick = Number(b.dataset.k);
    draw();
    cardPlayer.load(clips[pick], { best: clips[best] });
  };
  $("#res-replay-info").onclick = async (e) => {
    if (!e.target.closest("[data-save]")) return;
    await toggleSave(clips[pick]);
    draw();
  };
}

/* ── Replays screen ────────────────────────────────────── */

let screenPlayer = null, backTo = "stats";

export async function openReplays(from = "stats") {
  backTo = from;
  cardPlayer?.stop();
  await purgeExpired();
  screenPlayer ??= createPlayer($("#replays-player"));
  showScreen("replays");
  await renderReplays();
}

export function wireReplays() {
  $("#replays-back").addEventListener("click", () => { screenPlayer?.stop(); showScreen(backTo, { dir: "back" }); });
}

async function renderReplays(selectId = null) {
  const clips = await allClips();
  const saved = clips.filter((c) => c.saved);
  const sets = new Map();
  for (const c of clips.filter((x) => !x.saved)) {
    if (!sets.has(c.setId)) sets.set(c.setId, []);
    sets.get(c.setId).push(c);
  }
  const empty = !clips.length;
  $("#replays-main").hidden = empty;
  $("#replays-empty").hidden = !empty;
  if (empty) { screenPlayer.stop(); return; }

  const current = clips.find((c) => c.id === selectId) ?? saved[0] ?? clips[0];
  const setSize = clips.filter((c) => c.setId === current.setId).length;

  $("#replays-saved").innerHTML = saved.length
    ? saved.map((c) => `
        <button type="button" class="saved-rep${c.id === current.id ? " on" : ""}" data-id="${c.id}" style="--c:${gradeColor(c.score)}" aria-pressed="${c.id === current.id}">
          <span class="saved-thumb">${thumbSVG(c)}</span>
          <span class="saved-meta"><strong>${c.exercise}</strong><span class="dim small">${dateText(c.date)}</span></span>
          <b class="saved-score">${c.score}</b>
        </button>`).join("")
    : `<p class="dim small">Nothing saved yet. Open a rep and press Save rep to keep it here for good.</p>`;

  $("#replays-recent").innerHTML = sets.size
    ? [...sets.values()].map((set) => `
        <div class="recent-set">
          <div class="recent-head"><strong>${set[0].exercise}</strong><span class="dim small">${dateText(set[0].date)}</span><span class="recent-keep small">${keepText(set[0]).replace("Not saved. ", "")}</span></div>
          <div class="rep-strip">${set.map((c) => `
            <button type="button" class="rep-chip${c.id === current.id ? " on" : ""}" data-id="${c.id}" style="--c:${gradeColor(c.score)}" aria-pressed="${c.id === current.id}" aria-label="Rep ${c.index}, ${c.score}">
              <b>${c.score}</b><span>rep ${c.index}</span>
            </button>`).join("")}</div>
        </div>`).join("")
    : `<p class="dim small">Every rep of your sets lands here for ${KEEP_DAYS} days.</p>`;

  $("#replays-title").textContent = `${current.exercise}, ${dateText(current.date)}`;
  $("#replays-info").innerHTML = infoHTML(current, setSize) + `<button type="button" class="btn danger rp-delete" data-del="${current.id}">Delete replay</button>`;
  // "Best rep" = the best rep of the same set, else your best saved rep of that exercise.
  const sameSet = clips.filter((c) => c.setId === current.setId);
  const pool = sameSet.length > 1 ? sameSet : clips.filter((c) => c.exercise === current.exercise);
  const bestClip = pool.reduce((a, c) => (c.score > a.score ? c : a), pool[0]);
  screenPlayer.load(current, { best: bestClip });

  $("#replays-lists").onclick = (e) => {
    const b = e.target.closest("[data-id]");
    if (b) renderReplays(b.dataset.id);
  };
  $("#replays-info").onclick = async (e) => {
    if (e.target.closest("[data-save]")) { await toggleSave(current); renderReplays(current.id); return; }
    if (e.target.closest("[data-del]") && confirmAction("Delete this replay for good? This can't be undone.")) {
      await removeClip(current.id);
      toast("Replay deleted");
      renderReplays();
    }
  };
}
