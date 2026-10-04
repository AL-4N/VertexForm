/**
 * camera-preview.js — "Test camera" on the setup screen: a small live
 * preview, so you can check the picture before starting a set. It opens the
 * camera exactly the way a session does (pose.js openCamera: constraint
 * ladder, 6 s warm-up), and reports what the camera actually delivers.
 * Always stopped before a session starts and when you leave the screen.
 */

import {
  openCamera, stopCamera, listCamerasWithNames, camerasToTry, cameraErrorMessage, cameraInfo, streamCameraId,
} from "../pose.js";
import { savedCameraId, refreshCameraPickers } from "./camera-picker.js";
import { $ } from "./components.js";
import { slide, EASE } from "./motion.js";

let current = null;          // { stream, abort }

export const previewRunning = () => !!current;

/** Start (or restart, e.g. after picking another camera) the preview. */
export async function startPreview(pickedId = null, { mirror = true } = {}) {
  stopPreview();
  const box = $("#cam-preview"), video = $("#cam-preview-video");
  const status = $("#cam-preview-status"), info = $("#cam-preview-info");
  const ac = new AbortController();
  current = { stream: null, abort: ac };
  const mine = current;
  box.hidden = false;
  slide(box, { from: [0, -16], to: [0, 0], opacity: [0, 1], duration: 360, ease: EASE.out });
  video.style.transform = mirror ? "scaleX(-1)" : "";
  status.textContent = "Starting camera…";
  info.textContent = "";
  $("#cam-test").textContent = "Restart test";

  try {
    const { cams, probe } = await listCamerasWithNames();
    stopCamera(probe);                         // never hold the same webcam twice
    const savedId = pickedId ?? await savedCameraId(cams);
    const { order } = camerasToTry(cams, { pickedId: savedId });
    const cam = order[0] ?? { id: null, label: "" };
    status.textContent = `Starting ${cam.label || "camera"}… (a USB webcam can take a few seconds)`;
    const { stream, picture } = await openCamera(video, cam.id, {
      signal: ac.signal, log: (d) => console.info("[camera test]", cam.label || "default", JSON.stringify(d)),
    });
    if (current !== mine) { stopCamera(stream); return; }
    mine.stream = stream;
    const ci = cameraInfo(stream);
    console.info("[camera test] using", JSON.stringify(ci));
    status.textContent = picture === "black"
      ? "Camera shows a black picture. If it has a privacy cover, slide it open."
      : `✓ ${ci.label || "Camera"} works.`;
    info.textContent = ci.settings ? `${ci.settings.width}×${ci.settings.height} at ${ci.settings.frameRate} fps` : "";
    refreshCameraPickers(streamCameraId(stream));
  } catch (err) {
    if (current !== mine || err.name === "Aborted") return;
    console.warn("[camera test]", err, cameraInfo(null, err));
    status.textContent = cameraErrorMessage(err);
    info.textContent = `${err.name}: ${err.message}`;
  }
}

/** Camera off, preview hidden. Safe to call any time. */
export function stopPreview() {
  if (!current) return;
  current.abort.abort();
  stopCamera(current.stream);
  current = null;
  const video = $("#cam-preview-video");
  if (video) video.srcObject = null;
  if ($("#cam-preview")) $("#cam-preview").hidden = true;
  if ($("#cam-test")) $("#cam-test").textContent = "Test camera";
}
