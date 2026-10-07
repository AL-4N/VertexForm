/** skills.js (ui) — the Skill path screen: one ladder per area, built from js/skills.js. */

import { store } from "../storage.js";
import { skillPath } from "../skills.js";
import { $ } from "./components.js";

const ICON = {
  done: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 6.5"/></svg>`,
  next: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="2.6"/></svg>`,
  locked: `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5.5" y="9" width="9" height="6.5" rx="1.2"/><path d="M7.5 9V7a2.5 2.5 0 0 1 5 0v2"/></svg>`,
  planned: "",
};

const STATUS_TEXT = {
  done: "Unlocked",
  next: "Next up",
  locked: "Locked",
  planned: "Not tracked yet",
};

export function renderSkills() {
  const paths = skillPath(store.sessions, store.skills);
  $("#skills-wrap").innerHTML = paths.map((p) => `
    <section class="card skill-path" aria-labelledby="path-${p.id}">
      <header class="skill-head">
        <h2 id="path-${p.id}">${p.name}</h2>
        <span class="dim small">${p.done} of ${p.steps.length}</span>
      </header>
      <ol class="skill-steps">
        ${p.steps.map((s) => `
          <li class="skill ${s.status}">
            <span class="skill-node">${ICON[s.status]}</span>
            <div class="skill-body">
              <strong>${s.name}</strong>
              <span class="skill-status">${STATUS_TEXT[s.status]}</span>
              <span class="dim small">${s.goal}</span>
              ${s.status === "next" ? `<span class="skill-closest small">${s.closest ? `Closest so far: ${s.closest}` : "No sets of this exercise yet"}</span>` : ""}
            </div>
          </li>`).join("")}
      </ol>
    </section>`).join("");
}
