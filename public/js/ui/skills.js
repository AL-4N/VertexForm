/**
 * skills.js (ui) — the Skill path screens, built from js/skills.js.
 *
 *   Overview  one card per path (Push, Pull, Legs, Core) with a small map of
 *             its tiers; click a card to open its tree.
 *   Tree      full screen, drawn as a real tree: it grows up from a trunk,
 *             starting skills at the bottom, each branch climbing to the
 *             skills that need it. Prerequisites from other paths sit below
 *             the skill as linked chips. Unlocked skills are in bloom, the
 *             next one is a bud, locked ones are bare twigs. Opening a tree
 *             grows it: branches draw in tier by tier, then the flowers
 *             open. Click a skill for details and, if the app can grade it,
 *             a button to train it.
 */

import { reducedMotion } from "./motion.js";
import { growFrom } from "./popup.js";
import { store } from "../storage.js";
import { skillPath } from "../skills.js";
import { $, showScreen } from "./components.js";

const NS = "http://www.w3.org/2000/svg";

const ICON = {
  done: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 6.5"/></svg>`,
  next: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3"/></svg>`,
  locked: `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5.5" y="9" width="9" height="6.5" rx="1.2"/><path d="M7.5 9V7a2.5 2.5 0 0 1 5 0v2"/></svg>`,
  planned: "",
};
/** The flower on each tree card: open bloom, bud, or a bare twig. */
const petals = (n, rx, ry, cls) => Array.from({ length: n }, (_, i) =>
  `<g transform="rotate(${(360 / n) * i})"><ellipse class="${cls}" style="--i:${i}" cx="0" cy="${-ry + 0.6}" rx="${rx}" ry="${ry}"/></g>`).join("");
const FLOWER = {
  done: `<svg class="bloom" viewBox="-14 -14 28 28" aria-hidden="true">${petals(5, 4.3, 6.6, "petal")}<circle class="bloom-heart" r="3.1"/></svg>`,
  next: `<svg class="bud" viewBox="-14 -14 28 28" aria-hidden="true"><path class="twig" d="M0 13V3"/><path class="sepal" d="M0 5c-4-1-5-4-5-6 2 0 4 1 5 3 1-2 3-3 5-3 0 2-1 5-5 6z"/><ellipse class="bud-body" cx="0" cy="-3" rx="4.2" ry="6.6"/></svg>`,
  locked: `<svg class="bare" viewBox="-14 -14 28 28" aria-hidden="true"><path class="twig" d="M0 13V-6M0 3l-5-5M0 -1l4.5-4"/><path class="leaf" d="M-5-2c-3 0-4-2-4-3 2-1 4 0 4 3zM4.5-5c3 0 4-2 4-3-2-1-4 0-4 3z"/></svg>`,
};
FLOWER.planned = FLOWER.locked;
const STATUS_TEXT = { done: "Unlocked", next: "Next up", locked: "Locked", planned: "Not tracked yet" };
const statusText = (s) => (s.status === "planned" && s.ready ? "Not tracked yet · ready" : STATUS_TEXT[s.status]);

let onTrain = () => {};
let paths = [];
const pathOf = (id) => paths.find((p) => p.id === id);
const stepOf = (id) => paths.flatMap((p) => p.steps).find((s) => s.id === id);

/** Group a path's skills into rows by tier. */
const tiersOf = (path) => {
  const rows = [];
  for (const s of path.steps) (rows[s.tier - 1] ??= []).push(s);
  return rows;
};

/* ── Overview ──────────────────────────────────────────── */

/** Render the overview. `train(exercise)` opens that exercise's setup. */
export function renderSkills(train) {
  if (train) onTrain = train;
  paths = skillPath(store.sessions, store.skills);
  $("#skills-wrap").innerHTML = paths.map((p) => `
    <button type="button" class="card path-card" data-path="${p.id}">
      <span class="path-card-head">
        <span class="path-card-name">${p.name}</span>
        <span class="path-card-count">${p.done}/${p.steps.length}</span>
      </span>
      <span class="dim small">Builds to: ${p.goal}</span>
      <span class="path-map" aria-hidden="true">${miniTree(p)}</span>
      <span class="path-card-next small">${nextLine(p)}</span>
      <span class="path-card-open">Open tree <span aria-hidden="true">&rarr;</span></span>
    </button>`).join("");
  $("#skills-wrap").onclick = (e) => {
    const card = e.target.closest("[data-path]");
    if (card) zoomIntoTree(card, card.dataset.path);
  };
}

/**
 * Opening a path from its card: a box holding the card's little tree lifts
 * off the card and grows to cover it (a small overshoot), the other cards
 * fade away, then the box expands and travels to exactly where the tree's
 * panel sits on the tree screen (slow off the mark, settling into place).
 * There it hands over to the real panel, the rest of the screen (title,
 * back button, detail panel) lays out around it, and the tree blooms.
 * Reduced motion: the tree just opens.
 */
let zooming = false;
async function zoomIntoTree(card, id) {
  if (zooming) return;
  if (reducedMotion() || !document.body.animate) { openTree(id); return; }
  zooming = true;
  const map = card.querySelector(".path-map");
  const m = map.getBoundingClientRect(), c = card.getBoundingClientRect();
  const box = document.createElement("div");
  box.className = "tree-zoom";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = `<span class="path-map">${map.innerHTML}</span>`;
  document.body.appendChild(box);
  const mini = box.firstElementChild;
  const list = $("#screen-skills");
  const at = (r, radius) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: radius });
  const over = { left: c.left - 8, top: c.top - 8, width: c.width + 16, height: c.height + 16 };
  const POP = "cubic-bezier(.2,.9,.3,1.15)", TRAVEL = "cubic-bezier(.65,0,.2,1)";
  let fade;
  try {
    // 1. The box appears on the card; the other cards fade away behind it.
    mini.animate([{ transform: "scale(1)" }, { transform: "scale(1.35)" }], { duration: 380, easing: POP, fill: "forwards" });
    fade = list.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 120, easing: "ease-out", fill: "forwards" });
    await box.animate([at(m, "6px"), at(over, "18px")], { duration: 380, easing: POP, fill: "forwards" }).finished;
    await new Promise((r) => setTimeout(r, 90));

    // 2. Lay the tree screen out unseen, find where its panel goes, fly there.
    openTree(id, null, { grow: false });
    const screen = $("#screen-skilltree"), panel = screen.querySelector(".tree-scroll");
    screen.style.visibility = "hidden";
    const target = panel.getBoundingClientRect();
    const radius = getComputedStyle(panel).borderRadius;
    mini.animate([{ transform: "scale(1.35)", opacity: 1 }, { transform: "scale(2.2)", opacity: 0 }], { duration: 520, easing: TRAVEL, fill: "forwards" });
    // Motion blur peaks at the fastest point of the flight, and the box glows green on the way.
    box.animate([{ filter: "blur(0)", boxShadow: "0 30px 80px -20px rgba(0,0,0,.7)" },
      { filter: "blur(7px)", boxShadow: "0 0 70px 6px rgba(46,229,157,.35)", offset: 0.5 },
      { filter: "blur(0)", boxShadow: "0 0 0 0 rgba(46,229,157,0)" }], { duration: 720, easing: "linear" });
    await box.animate([at(over, "18px"), at(target, radius)], { duration: 720, easing: TRAVEL, fill: "forwards" }).finished;

    // 3. The real panel takes over where the box landed; the rest lays out
    //    around it, and the tree grows and blooms.
    screen.style.visibility = "";
    const around = [...screen.querySelectorAll(".app-header > *"), screen.querySelector(".tree-detail")].filter(Boolean);
    around.forEach((el, k) => el.animate(
      [{ opacity: 0, transform: "translateY(22px)", filter: "blur(5px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
      { duration: 520, delay: 60 + k * 70, easing: "cubic-bezier(.22,.61,.36,1)", fill: "backwards" }));
    grow = true;
    drawEdges();
    await box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" }).finished;
  } finally {
    box.remove();
    fade?.cancel();
    $("#screen-skilltree").style.visibility = "";
    zooming = false;
    if (!$("#screen-skilltree").classList.contains("active")) openTree(id);
  }
}

/**
 * The card's picture of its path: the same tree as the full screen, small.
 * A trunk from the ground to the starting skills, curved branches up to the
 * skills that need them (thinner as they climb, dashed toward ones that
 * can't be tracked yet), and on each skill a blossom (unlocked), an amber
 * bud (next) or a bare twig (locked, or not tracked yet).
 */
function miniTree(p) {
  const rows = tiersOf(p);
  const W = 200, GAP = 30, H = 26 + rows.length * GAP;
  const pos = {};
  rows.forEach((row, t) => {
    if (t) row.sort((a, b) => avgPos(a, pos) - avgPos(b, pos));
    row.forEach((s, i) => { pos[s.id] = (i + 0.5) / row.length; });
  });
  const xy = (s) => [20 + pos[s.id] * (W - 40), H - 22 - (s.tier - 1) * GAP];
  const ground = H - 6;
  const roots = p.steps.filter((s) => s.tier === 1).map(xy);
  const mx = roots.reduce((a, r) => a + r[0], 0) / roots.length;
  const curve = ([x1, y1], [x2, y2]) => { const m = (y1 + y2) / 2; return `M${x1} ${y1}C${x1} ${m} ${x2} ${m} ${x2} ${y2}`; };
  let wood = `<line x1="14" y1="${ground}" x2="${W - 14}" y2="${ground}" class="mt-ground"/>`;
  wood += roots.map((r) => `<path d="${curve([mx, ground], r)}" class="mt-wood mt-trunk"/>`).join("");
  for (const s of p.steps) {
    for (const r of s.requires) {
      const parent = p.steps.find((x) => x.id === r);
      if (!parent) continue;                                   // a prerequisite from another path
      const lit = parent.status === "done";
      wood += `<path d="${curve(xy(parent), xy(s))}" class="mt-wood${lit ? " lit" : ""}${s.status === "planned" ? " planned" : ""}" style="stroke-width:${Math.max(1.2, 4 - s.tier * 0.6)}"/>`;
    }
  }
  const mark = (s) => {
    const [x, y] = xy(s);
    if (s.status === "done") {
      const petals = [0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-3.6" rx="2.6" ry="3.8" transform="rotate(${a})" class="mt-petal"/>`).join("");
      return `<g transform="translate(${x} ${y}) scale(1.5)">${petals}<circle r="1.9" class="mt-heart"/></g>`;
    }
    if (s.status === "next") return `<g transform="translate(${x} ${y}) scale(1.5)"><path d="M0 7V2" class="mt-twig"/><ellipse cx="0" cy="-1" rx="3" ry="4.6" class="mt-bud"/></g>`;
    return `<g transform="translate(${x} ${y}) scale(1.4)" class="mt-bare"><path d="M0 6V-5M0 1l-3.5-3.5M0-2l3-3" class="mt-twig"/></g>`;
  };
  return `<svg class="mini-tree" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${wood}${p.steps.map(mark).join("")}</svg>`;
}

function nextLine(p) {
  const next = p.steps.filter((s) => s.status === "next");
  if (next.length) return `Next up: ${next.map((s) => s.name).join(", ")}`;
  if (p.steps.every((s) => s.status === "done")) return "Every skill unlocked";
  return "Next skills need a tracker that isn't built yet";
}

/* ── Tree ──────────────────────────────────────────────── */

let current = null, selected = null, resizeObs = null, grow = false;
const BARK = 9;                                   // trunk width; branches thin out as they climb

export function openTree(pathId, focusId = null, { grow: growScreen = true } = {}) {
  paths = skillPath(store.sessions, store.skills);
  current = pathOf(pathId);
  const first = current.steps.find((s) => s.status === "next") ?? current.steps.find((s) => s.status !== "done") ?? current.steps[0];
  selected = focusId && stepOf(focusId)?.path === pathId ? focusId : first.id;
  $("#tree-title").textContent = `${current.name} tree`;
  $("#tree-sub").textContent = `Builds to: ${current.goal} · ${current.done} of ${current.steps.length} unlocked`;
  drawTree();
  showScreen("skilltree", { grow: growScreen });
  grow = true;
  requestAnimationFrame(drawEdges);
}

function nodeHTML(s) {
  return `<button type="button" class="tree-node ${s.status}${s.ready ? " ready" : ""}" data-skill="${s.id}" aria-pressed="${s.id === selected}">
    <span class="tree-flower">${FLOWER[s.status]}</span>
    <span class="tree-node-text"><strong>${s.name}</strong><span class="tree-node-status">${statusText(s)}</span></span>
  </button>`;
}

function ghostHTML(req, child) {
  const r = stepOf(req);
  return `<button type="button" class="tree-ghost ${r.status}" data-skill="${r.id}" data-for="${child}">
    <span class="tree-ghost-path">${pathOf(r.path).name} path</span><strong>${r.name}</strong>
  </button>`;
}

function drawTree() {
  const rows = tiersOf(current);
  // Order each row by where its prerequisites sit in the row above, so lines cross less.
  const pos = {};
  rows.forEach((row, t) => {
    if (t) row.sort((a, b) => avgPos(a, pos) - avgPos(b, pos));
    row.forEach((s, i) => { pos[s.id] = (i + 0.5) / row.length; });
  });
  // Prerequisites from other paths sit in the row above the skill that needs them.
  const ghosts = rows.map(() => []);
  for (const s of current.steps) {
    for (const r of s.requires) if (stepOf(r).path !== current.id) (ghosts[s.tier - 2] ??= []).push([r, s.id]);
  }

  $("#tree").innerHTML = `
    <svg class="tree-edges" aria-hidden="true"></svg>
    ${rows.map((row, t) => `
      <div class="tree-row">
        <span class="tree-tier">T${t + 1}</span>
        <div class="tree-row-nodes">${row.map(nodeHTML).join("")}${(ghosts[t] ?? []).map(([r, c]) => ghostHTML(r, c)).join("")}</div>
      </div>`).join("")}`;

  $("#tree").onclick = (e) => {
    const ghost = e.target.closest(".tree-ghost");
    if (ghost) { openTree(stepOf(ghost.dataset.skill).path, ghost.dataset.skill); return; }
    const node = e.target.closest("[data-skill]");
    if (!node) return;
    selected = node.dataset.skill;
    $$tree("[data-skill]").forEach((n) => n.setAttribute("aria-pressed", String(n.dataset.skill === selected)));
    drawDetail();
    const panel = $("#tree-detail");
    growFrom(panel, node.getBoundingClientRect(), { duration: 480, items: [...panel.children] });
  };
  drawDetail();

  resizeObs?.disconnect();
  resizeObs = new ResizeObserver(() => drawEdges());
  resizeObs.observe($("#tree"));
}

const avgPos = (s, pos) => {
  const xs = s.requires.map((r) => pos[r]).filter((x) => x != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.5;
};
const $$tree = (sel) => [...$("#tree").querySelectorAll(sel)];

/**
 * The wood: a trunk from the ground up to every starting skill, then a
 * branch from each skill's top up to every skill that needs it. Branches
 * thin out with height. Where both ends are unlocked, a small blossom sits
 * on the branch. Right after opening, everything grows in tier by tier
 * (CSS reads --t: when this piece starts, in tiers).
 */
function drawEdges() {
  const tree = $("#tree"), svg = tree.querySelector(".tree-edges");
  if (!svg || !tree.offsetParent) return;
  const box = tree.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  svg.replaceChildren();
  const at = (el) => el.getBoundingClientRect();
  const el = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return svg.appendChild(n);
  };
  const branch = (x1, y1, x2, y2, width, cls, t) => {
    const my = (y1 + y2) / 2;
    const p = el("path", { d: `M${x1} ${y1}C${x1} ${my} ${x2} ${my} ${x2} ${y2}`, class: `tree-edge ${cls}`, pathLength: 1 });
    p.style.strokeWidth = `${width}px`;
    p.style.setProperty("--t", t);
    return p;
  };

  // Ground and trunk.
  // One starting skill: the trunk runs straight up into it. Several: it
  // splits a little below them.
  const groundY = box.height - 14;
  el("line", { x1: 24, y1: groundY, x2: box.width - 24, y2: groundY, class: "tree-ground" });
  const roots = current.steps.filter((s) => s.tier === 1).map((s) => {
    const b = at(tree.querySelector(`.tree-node[data-skill="${s.id}"]`));
    return { s, x: b.left + b.width / 2 - box.left, y: b.bottom - box.top };
  });
  const midX = roots.reduce((a, r) => a + r.x, 0) / roots.length;
  if (roots.length === 1) branch(midX, groundY, midX, roots[0].y, BARK, "trunk", 0);
  else {
    const fork = Math.max(...roots.map((r) => r.y)) + 34;
    branch(midX, groundY, midX, fork, BARK, "trunk", 0);
    for (const r of roots) branch(midX, fork, r.x, r.y, BARK - 2, r.s.status === "done" ? "done" : "", 0.6);
  }

  for (const s of current.steps) {
    const child = tree.querySelector(`.tree-node[data-skill="${s.id}"]`);
    for (const r of s.requires) {
      const parent = tree.querySelector(`.tree-node[data-skill="${r}"]`) ?? tree.querySelector(`.tree-ghost[data-skill="${r}"][data-for="${s.id}"]`);
      if (!child || !parent) continue;
      const a = at(parent), b = at(child);
      const x1 = a.left + a.width / 2 - box.left, y1 = a.top - box.top;
      const x2 = b.left + b.width / 2 - box.left, y2 = b.bottom - box.top;
      const lit = stepOf(r).status === "done";
      const p = branch(x1, y1, x2, y2, Math.max(2, BARK - 2 - s.tier * 1.5),
        `${lit ? "done" : ""} ${s.status === "planned" ? "planned" : ""}`, s.tier);
      if (lit && s.status === "done") {
        const m = p.getPointAtLength(p.getTotalLength() * 0.5);
        const g = el("g", { class: "edge-bloom", transform: `translate(${m.x} ${m.y}) scale(.55)` });
        g.style.setProperty("--t", s.tier + 0.5);
        g.innerHTML = petals(5, 4.3, 6.6, "petal") + `<circle class="bloom-heart" r="3.1"/>`;
      }
    }
  }

  // Each card's flower opens once the branch under it has grown.
  for (const s of current.steps) tree.querySelector(`.tree-node[data-skill="${s.id}"]`)?.style.setProperty("--t", s.tier + 0.6);
  if (grow) {
    grow = false;
    tree.classList.remove("growing");
    void tree.offsetWidth;                          // restart the animation
    tree.classList.add("growing");
    clearTimeout(drawEdges.done);
    drawEdges.done = setTimeout(() => tree.classList.remove("growing"), 1000 * (0.42 * (Math.max(...current.steps.map((x) => x.tier)) + 2)) + 900);
  }
}

/** The panel for the selected skill: goal, what it needs and unlocks, your best try. */
function drawDetail() {
  const s = stepOf(selected);
  const needs = s.requires.map(stepOf);
  const unlocks = paths.flatMap((p) => p.steps).filter((x) => x.requires.includes(s.id));
  const link = (x) => `<li><button type="button" class="tree-link ${x.status}" data-go="${x.id}"><span class="skill-node mini">${ICON[x.status]}</span>${x.name}${x.path !== current.id ? ` <span class="dim">(${pathOf(x.path).name})</span>` : ""}</button></li>`;
  const tracked = !!s.test;
  const train = tracked && s.status !== "done"
    ? `<button type="button" class="btn primary" data-train="${s.test.exercise}">Train ${s.test.exercise.toLowerCase()}</button>` : "";
  const why = s.status === "locked" ? `<p class="dim small">Unlock everything under "Needs" first.</p>`
    : s.status === "planned" ? `<p class="dim small">VertexForm can't grade this one yet. It's on the tracker plan, so it will unlock from real sets once it can.</p>`
    : "";

  $("#tree-detail").innerHTML = `
    <span class="tree-detail-status ${s.status}">${statusText(s)}</span>
    <h2>${s.name}</h2>
    <p class="tree-goal">${s.goal}</p>
    ${s.status === "next" ? `<p class="skill-closest small">${s.closest ? `Closest so far: ${s.closest}` : "No sets of this exercise yet"}</p>` : ""}
    ${why}
    ${needs.length ? `<h3 class="label">Needs</h3><ul class="tree-links">${needs.map(link).join("")}</ul>` : `<h3 class="label">Needs</h3><p class="dim small">Nothing. This is a starting skill.</p>`}
    ${unlocks.length ? `<h3 class="label">Leads to</h3><ul class="tree-links">${unlocks.map(link).join("")}</ul>` : `<h3 class="label">Leads to</h3><p class="dim small">The top of this path.</p>`}
    ${train}`;

  $("#tree-detail").onclick = (e) => {
    const go = e.target.closest("[data-go]");
    if (go) {
      const x = stepOf(go.dataset.go);
      if (x.path !== current.id) { openTree(x.path, x.id); return; }
      selected = x.id;
      $$tree("[data-skill]").forEach((n) => n.setAttribute("aria-pressed", String(n.dataset.skill === selected)));
      drawDetail();
      return;
    }
    const t = e.target.closest("[data-train]");
    if (t) onTrain(t.dataset.train);
  };
}

