/**
 * settings.js — the app's settings, and every control bound to them.
 *
 * Controls declare what they change in the HTML, so the same setting can
 * appear in several places (the setup panel and the Settings screen) and
 * they all stay in sync:
 *   <div class="pills" data-setting="tempo" data-type="string"> <button data-val="off">…
 *   <button data-toggle="voice">Voice</button>              (on/off)
 *   <input type="range" data-setting="volume" data-type="number">
 */

import { DEFAULTS } from "../config.js";
import { getSetting, setSetting } from "../storage.js";
import { configureVoice } from "../voice.js";
import { $$ } from "./components.js";

/** Current settings (saved values over defaults), plus per-session `mode`. */
export const cfg = Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, getSetting(k, DEFAULTS[k])]));
cfg.mode = "practice";

const listeners = new Set();
/** Run `fn(key, value)` whenever a setting changes. */
export const onSetting = (fn) => listeners.add(fn);

/** Change a setting: saves it, applies it, and updates every control showing it. */
export function setCfg(key, value) {
  cfg[key] = value;
  setSetting(key, value);
  apply(key);
  sync(key);
  listeners.forEach((fn) => fn(key, value));
}

function apply(key) {
  if (key == null || ["voice", "voiceRate", "volume", "voiceId", "personality"].includes(key)) {
    configureVoice({ enabled: !!cfg.voice, rate: cfg.voiceRate, volume: cfg.volume, voiceId: cfg.voiceId, personality: cfg.personality });
  }
}

const parse = (type, v) => (type === "number" ? Number(v) : type === "bool" ? v === "true" : String(v));
const FORMAT = {
  voiceRate: (v) => `${Number(v).toFixed(2)}×`,
  volume: (v) => `${Math.round(v * 100)}%`,
};

/** Reflect settings in the controls (all of them, or one key). */
export function sync(only = null) {
  for (const group of $$(".pills[data-setting]")) {
    const key = group.dataset.setting;
    if (only && key !== only) continue;
    for (const b of $$("button[data-val]", group)) {
      const on = parse(group.dataset.type, b.dataset.val) === cfg[key];
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    }
  }
  for (const b of $$("button[data-toggle]")) {
    const key = b.dataset.toggle;
    if (only && key !== only) continue;
    b.dataset.label ??= b.textContent.trim();
    const on = !!cfg[key];
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
    b.textContent = `${b.dataset.label} ${on ? "on" : "off"}`;
  }
  for (const r of $$("input[type=range][data-setting]")) {
    const key = r.dataset.setting;
    if (only && key !== only) continue;
    r.value = cfg[key];
    const out = r.parentElement.querySelector("output");
    if (out) out.textContent = (FORMAT[key] ?? String)(cfg[key]);
  }
}

/** Wire every settings control on the page. Call once at start-up. */
export function wireSettings() {
  for (const group of $$(".pills[data-setting]")) {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-val]");
      if (btn) setCfg(group.dataset.setting, parse(group.dataset.type, btn.dataset.val));
    });
  }
  for (const b of $$("button[data-toggle]")) {
    b.addEventListener("click", () => setCfg(b.dataset.toggle, !cfg[b.dataset.toggle]));
  }
  for (const r of $$("input[type=range][data-setting]")) {
    r.addEventListener("input", () => setCfg(r.dataset.setting, Number(r.value)));
  }
  apply(null);
  sync();
}
