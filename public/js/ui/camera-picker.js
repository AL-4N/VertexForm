/**
 * camera-picker.js — the "Camera" dropdowns (setup panel, live screen, and
 * the camera-problem message).
 *
 * Every <select class="camera-select"> on the page shows the same list and
 * stays in sync. A camera you pick by hand is saved, so the app opens it
 * next time; until then the app picks a real camera by itself.
 */

import { listCameras, cameraOrder } from "../pose.js";
import { getSetting, setSetting } from "../storage.js";
import { $$ } from "./components.js";

/**
 * The saved camera's device id, or null if none was picked (or it's gone).
 * Falls back to matching by name in case the browser changed the id.
 */
export async function savedCameraId(cams) {
  const id = getSetting("camera", null);
  if (!id) return null;
  cams = cams ?? await listCameras();
  if (cams.some((c) => c.id === id)) return id;
  const label = getSetting("cameraLabel", null);
  return cams.find((c) => label && c.label === label)?.id ?? null;
}

/** Name of the saved camera, if one was picked. */
export const savedCameraLabel = () => (getSetting("camera", null) ? getSetting("cameraLabel", null) : null);

/** Rebuild every camera dropdown. `activeId` = the camera in use right now. */
export async function refreshCameraPickers(activeId = null) {
  const cams = await listCameras();
  const has = (id) => id && cams.some((c) => c.id === id);
  // Show the camera in use, else the saved one, else the one the app would pick.
  const saved = await savedCameraId(cams);
  const selected = [activeId, saved, cameraOrder(cams)[0]?.id].find(has) ?? null;

  for (const sel of $$("select.camera-select")) {
    sel.replaceChildren();
    if (!cams.length) {
      sel.append(new Option("Start a session to see your cameras", ""));
      sel.disabled = true;
      continue;
    }
    cams.forEach((c, i) => {
      const name = c.label || `Camera ${i + 1}`;
      const opt = new Option(c.kind === "virtual" ? `${name} (virtual)` : name, c.id);
      opt.dataset.label = c.label;
      sel.append(opt);
    });
    sel.value = selected ?? cams[0].id;
    sel.disabled = false;
  }
}

/** Call `handler(deviceId)` when a camera is picked in any dropdown. */
export function onCameraPicked(handler) {
  for (const sel of $$("select.camera-select")) {
    sel.addEventListener("change", () => {
      const id = sel.value;
      if (!id) return;
      setSetting("camera", id);
      setSetting("cameraLabel", sel.selectedOptions[0]?.dataset.label || null);
      $$("select.camera-select").forEach((s) => { if (s !== sel) s.value = id; });
      handler(id);
    });
  }
  // Cameras plugged in or unplugged: update the list (live.js handles the session itself).
  navigator.mediaDevices?.addEventListener?.("devicechange", () => refreshCameraPickers(currentValue()));
}

const currentValue = () => $$("select.camera-select").find((s) => s.value)?.value || null;
