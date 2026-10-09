/**
 * challenges.js (ui) — the challenge card on the dashboard and the
 * Challenges screen, built from js/challenges.js.
 */

import { store, save } from "../storage.js";
import { CHALLENGES, CHALLENGE_BY_ID, challengeStatus, dayKey } from "../challenges.js";
import { $, showScreen, toast, confirmAction } from "./components.js";

function dots(st) {
  return `<div class="ch-dots" aria-hidden="true">${st.days.map((d) => `<i class="${d.state}"></i>`).join("")}</div>`;
}

/** The dashboard card: where your challenge stands, or a way to pick one. */
export function renderChallengeCard() {
  const host = $("#challenge-card");
  if (!host) return;
  const st = store.challenge ? challengeStatus(store.challenge, store.sessions) : null;
  if (!st) {
    host.innerHTML = `
      <p class="dim small">Pick a daily goal and keep it going.</p>
      <button type="button" class="btn" data-open-challenges>Browse challenges</button>`;
  } else {
    const today = st.days.find((d) => d.key === dayKey(new Date()));
    const line = st.state === "broken"
      ? `Missed day ${st.days.find((d) => d.state === "missed").n}. Start again whenever you're ready.`
      : today?.state === "done" ? "Today: done" : `Today: ${st.challenge.goal.charAt(0).toLowerCase()}${st.challenge.goal.slice(1)}`;
    host.innerHTML = `
      <p class="ch-name">${st.challenge.name}</p>
      <p class="ch-day">${st.state === "broken" ? "Ended" : `Day ${st.day} of ${st.challenge.days}`}</p>
      ${dots(st)}
      <p class="ch-today small${st.state === "broken" ? " broken" : today?.state === "done" ? " done" : ""}">${line}</p>
      <button type="button" class="btn ghost" data-open-challenges>${st.state === "broken" ? "Start again" : "See challenge"}</button>`;
  }
  host.onclick = (e) => { if (e.target.closest("[data-open-challenges]")) openChallenges(); };
}

/* ── Challenges screen ─────────────────────────────────── */

export function openChallenges() {
  renderChallenges();
  showScreen("challenges");
}

function start(id) {
  if (store.challenge) store.challengeLog.push({ ...store.challenge, end: dayKey(new Date()), result: "ended" });
  store.challenge = { id, start: dayKey(new Date()) };
  save();
  toast(`Started: ${CHALLENGE_BY_ID[id].name}. Day 1 is today.`);
  renderChallenges();
  renderChallengeCard();
}

function quit() {
  if (!store.challenge) return;
  store.challengeLog.push({ ...store.challenge, end: dayKey(new Date()), result: "ended" });
  store.challenge = null;
  save();
  renderChallenges();
  renderChallengeCard();
}

const dateText = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

function renderChallenges() {
  const st = store.challenge ? challengeStatus(store.challenge, store.sessions) : null;
  const cur = $("#challenge-current");
  if (st) {
    const msg = st.state === "broken"
      ? `You missed day ${st.days.find((d) => d.state === "missed").n}, so this run is over. Start it again from day 1, or pick another.`
      : `${st.done} of ${st.challenge.days} days done. Each day: ${st.challenge.goal.charAt(0).toLowerCase()}${st.challenge.goal.slice(1)}.`;
    cur.hidden = false;
    cur.innerHTML = `
      <div class="ch-head">
        <div><h2>${st.challenge.name}</h2><p class="dim">${msg}</p></div>
        <div class="ch-actions">
          ${st.state === "broken" ? `<button type="button" class="btn primary" data-start="${st.challenge.id}">Start again</button>` : ""}
          <button type="button" class="btn ghost" data-quit>${st.state === "broken" ? "Clear" : "Quit challenge"}</button>
        </div>
      </div>
      <ol class="ch-cal">${st.days.map((d) => `
        <li class="${d.state}" title="${dateText(d.key)}"><b>${d.n}</b><span>${d.state === "done" ? "done" : d.state === "missed" ? "missed" : d.state === "today" ? "today" : dateText(d.key)}</span></li>`).join("")}
      </ol>`;
  } else {
    cur.hidden = true;
    cur.innerHTML = "";
  }

  $("#challenge-list").innerHTML = CHALLENGES.map((c) => {
    const isCur = st && st.challenge.id === c.id && st.state !== "broken";
    return `
      <div class="card ch-option${isCur ? " on" : ""}">
        <h3>${c.name}</h3>
        <p class="dim small">${c.days} days. Each day: ${c.goal.charAt(0).toLowerCase()}${c.goal.slice(1)}.</p>
        ${isCur ? `<span class="ch-badge">Your challenge</span>` : `<button type="button" class="btn${st ? "" : " primary"}" data-start="${c.id}">${st && st.state !== "broken" ? "Switch to this" : "Start"}</button>`}
      </div>`;
  }).join("");

  const log = store.challengeLog.slice().reverse();
  $("#challenge-log").innerHTML = log.length
    ? log.map((l) => `<li><strong>${CHALLENGE_BY_ID[l.id]?.name ?? l.id}</strong> <span class="dim small">${dateText(l.start)} to ${dateText(l.end)}</span> <span class="ch-result ${l.result}">${l.result === "complete" ? "Completed" : "Ended early"}</span></li>`).join("")
    : `<li class="dim small">Challenges you finish or end show up here.</li>`;

  $("#screen-challenges").onclick = (e) => {
    const s = e.target.closest("[data-start]");
    if (s) {
      const live = store.challenge && challengeStatus(store.challenge, store.sessions)?.state !== "broken";
      if (live && !confirmAction(`Switch challenges? Your current one (${CHALLENGE_BY_ID[store.challenge.id].name}) ends.`)) return;
      start(s.dataset.start);
      return;
    }
    if (e.target.closest("[data-quit]")) {
      const live = challengeStatus(store.challenge, store.sessions)?.state !== "broken";
      if (live && !confirmAction("Quit this challenge? Your progress on it ends.")) return;
      quit();
    }
  };
}
