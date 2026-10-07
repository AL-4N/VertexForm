/**
 * skills.js (ui) — the Skill path screens, built from js/skills.js.
 *
 *   Overview  one card per path (Push, Pull, Legs, Core) with a small map of
 *             its tiers; click a card to open its tree.
 *   Tree      full screen: tiers run top-down (prerequisites on top), lines
 *             join each skill to what it needs, and prerequisites from other
 *             paths sit above it as linked chips. Click a skill for details
 *             and, if the app can grade it, a button to train it.
 */

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
      <span class="path-map" aria-hidden="true">
        ${tiersOf(p).map((row) => `<span class="path-map-row">${row.map((s) => `<i class="dot ${s.status}"></i>`).join("")}</span>`).join("")}
      </span>
      <span class="path-card-next small">${nextLine(p)}</span>
      <span class="path-card-open">Open tree <span aria-hidden="true">&rarr;</span></span>
    </button>`).join("");
  $("#skills-wrap").onclick = (e) => {
    const card = e.target.closest("[data-path]");
    if (card) openTree(card.dataset.path);
  };
}

function nextLine(p) {
  const next = p.steps.filter((s) => s.status === "next");
  if (next.length) return `Next up: ${next.map((s) => s.name).join(", ")}`;
  if (p.steps.every((s) => s.status === "done")) return "Every skill unlocked";
  return "Next skills need a tracker that isn't built yet";
}

/* ── Tree ──────────────────────────────────────────────── */

let current = null, selected = null, resizeObs = null;

export function openTree(pathId, focusId = null) {
  paths = skillPath(store.sessions, store.skills);
  current = pathOf(pathId);
  const first = current.steps.find((s) => s.status === "next") ?? current.steps.find((s) => s.status !== "done") ?? current.steps[0];
  selected = focusId && stepOf(focusId)?.path === pathId ? focusId : first.id;
  $("#tree-title").textContent = `${current.name} tree`;
  $("#tree-sub").textContent = `Builds to: ${current.goal} · ${current.done} of ${current.steps.length} unlocked`;
  drawTree();
  showScreen("skilltree");
  requestAnimationFrame(drawEdges);
}

function nodeHTML(s) {
  return `<button type="button" class="tree-node ${s.status}${s.ready ? " ready" : ""}" data-skill="${s.id}" aria-pressed="${s.id === selected}">
    <span class="skill-node">${ICON[s.status]}</span>
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

/** Lines from each prerequisite's bottom to the skill's top. */
function drawEdges() {
  const tree = $("#tree"), svg = tree.querySelector(".tree-edges");
  if (!svg || !tree.offsetParent) return;
  const box = tree.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  svg.replaceChildren();
  const at = (el) => el.getBoundingClientRect();
  for (const s of current.steps) {
    const child = tree.querySelector(`.tree-node[data-skill="${s.id}"]`);
    for (const r of s.requires) {
      const parent = tree.querySelector(`.tree-node[data-skill="${r}"]`) ?? tree.querySelector(`.tree-ghost[data-skill="${r}"][data-for="${s.id}"]`);
      if (!child || !parent) continue;
      const a = at(parent), b = at(child);
      const x1 = a.left + a.width / 2 - box.left, y1 = a.bottom - box.top;
      const x2 = b.left + b.width / 2 - box.left, y2 = b.top - box.top;
      const my = (y1 + y2) / 2;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", `M${x1} ${y1}C${x1} ${my} ${x2} ${my} ${x2} ${y2}`);
      const st = stepOf(r).status;
      path.setAttribute("class", `tree-edge ${st === "done" ? "done" : ""} ${s.status === "planned" ? "planned" : ""}`);
      svg.appendChild(path);
    }
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

