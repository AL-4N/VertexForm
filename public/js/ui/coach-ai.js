/**
 * coach-ai.js (ui) — the opt-in AI coach summary on the History screen.
 *
 * Nothing is sent until you press the button, and the first time it asks
 * first. What's sent is js/weekly.js's handful of numbers; the summary
 * comes back from Claude (Anthropic) through this site's Worker
 * (worker/index.js) and is kept on this device.
 */

import { store, getSetting, setSetting } from "../storage.js";
import { weekData } from "../weekly.js";
import { $, confirmAction } from "./components.js";

const KEY = "vertexform:coach-summary";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: shown once, not kept */ } };

const ERRORS = {
  local: "The coach summary works on the published site, not in a local preview.",
  "not-configured": "The AI coach isn't set up on this site yet. It needs an API key on the server.",
  "rate-limited": "Too many summaries just now. Try again in a minute.",
  declined: "The coach couldn't write a summary for this week. Try again after your next set.",
  offline: "You're offline. Connect to the internet to get a summary.",
  default: "Couldn't write a summary right now. Try again later.",
};

const dateText = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const paragraphs = (text) => text.split(/\n\s*\n/).map((p) => `<p>${p.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c])}</p>`).join("");

/** Forget the saved summary (Reset all). */
export function clearCoachAI() { try { localStorage.removeItem(KEY); } catch { /* nothing kept */ } }

export function renderCoachAI() {
  const host = $("#coach-ai");
  const week = weekData({ sessions: store.sessions, skills: store.skills, challenge: store.challenge });
  const saved = read();
  const body = saved
    ? `<div class="ai-text">${paragraphs(saved.text)}</div><p class="dim small">Written ${dateText(saved.at)}.</p>`
    : `<p class="dim">A short review of your last 7 days: what went well, the one thing to fix, and what to do next.</p>`;
  host.innerHTML = `
    <div class="ai-head"><h2 class="label">Coach summary</h2><span class="ai-by small">Written by Claude</span></div>
    <div class="ai-body">${body}</div>
    ${week
      ? `<button type="button" class="btn primary" id="ai-go">${saved ? "Write a new summary" : "Write my weekly summary"}</button>
         <p class="ai-note dim small">Sends this week's scores, rep counts and fault names to Claude (an AI by Anthropic). Never video, nothing that identifies you.</p>`
      : `<p class="dim small">Train this week to get a summary.</p>`}
    <p class="ai-error small" id="ai-error" role="alert" hidden></p>`;
  $("#ai-go")?.addEventListener("click", () => run(week));
}

async function run(week) {
  if (!getSetting("aiConsent", false)) {
    if (!confirmAction("Send this week's numbers to Claude to write your summary?\n\nWhat's sent: your scores, rep counts and fault names from the last 7 days. Never video, nothing that identifies you.")) return;
    setSetting("aiConsent", true);
  }
  const btn = $("#ai-go"), err = $("#ai-error"), bodyEl = $("#coach-ai .ai-body");
  btn.disabled = true;
  btn.textContent = "Writing your summary…";
  err.hidden = true;
  bodyEl.innerHTML = `<span class="skel-line ai-skel"></span><span class="skel-line ai-skel"></span><span class="skel-line ai-skel short"></span>`;
  let code = null;
  try {
    const res = await fetch("/api/coach-summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(week) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.text) {
      write({ text: data.text, at: new Date().toISOString() });
      renderCoachAI();
      return;
    }
    code = [404, 405, 501].includes(res.status) && !data.error ? "local" : data.error ?? "default";
  } catch {
    code = navigator.onLine === false ? "offline" : "default";
  }
  renderCoachAI();
  const e = $("#ai-error");
  e.textContent = ERRORS[code] ?? ERRORS.default;
  e.hidden = false;
}
