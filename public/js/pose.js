/**
 * pose.js — MediaPipe Pose Landmarker + webcam access.
 *
 * Everything runs in the browser (WebAssembly, GPU when available), so the
 * site needs no server — it can live on Cloudflare as plain static files.
 *
 * Robustness:
 *   - Loads the library and model once; repeat calls reuse them.
 *   - Tries the GPU first and falls back to the CPU if the GPU path fails,
 *     either at startup or mid-session.
 *   - Picks a real camera (built-in first; virtual cameras like OBS or Camo
 *     only when chosen) and checks it sends video before using it.
 *   - Camera failures come back as plain-English messages.
 */

const TASKS_VERSION = "0.10.14";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}`;
export const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const OPTIONS = {
  runningMode: "VIDEO",
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

let landmarker = null;
let delegate = null;
let fileset = null;
let PoseLandmarkerClass = null;
let loading = null;
let switching = false;

async function create(which) {
  return PoseLandmarkerClass.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: which },
    ...OPTIONS,
  });
}

/** Load the library + model once. Later calls reuse them. */
export function initPose(onStatus = () => {}) {
  if (landmarker) return Promise.resolve(landmarker);
  if (loading) return loading;

  loading = (async () => {
    onStatus("Loading the pose engine…");
    const vision = await import(`${CDN}/vision_bundle.mjs`);
    PoseLandmarkerClass = vision.PoseLandmarker;
    fileset = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);

    onStatus("Loading the pose model…");
    try {
      // ?cpu in the page URL forces the CPU path (useful for troubleshooting).
      if (new URLSearchParams(location.search).has("cpu")) throw new Error("CPU requested");
      landmarker = await create("GPU");
      delegate = "GPU";
    } catch (err) {
      console.warn("[pose] GPU unavailable, using CPU:", err);
      landmarker = await create("CPU");
      delegate = "CPU";
    }
    return landmarker;
  })();

  // If loading fails, allow a retry later instead of caching the failure.
  loading.catch(() => {}).finally(() => { loading = null; });
  return loading;
}

export const poseDelegate = () => delegate;

/**
 * Detect on one video frame.
 * @returns 33 landmarks {x, y, z, visibility} (x/y normalised 0..1), or null.
 */
export function detect(video, timestampMs) {
  if (!landmarker || switching) return null;
  let res;
  try {
    res = landmarker.detectForVideo(video, timestampMs);
  } catch (err) {
    // Some GPUs fail only once frames start flowing. Switch to the CPU once.
    console.warn("[pose] detection failed:", err);
    if (delegate === "GPU") fallBackToCpu();
    return null;
  }
  const lms = res?.landmarks?.[0];
  if (!lms) return null;
  return lms.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0, visibility: p.visibility ?? 1 }));
}

async function fallBackToCpu() {
  if (switching) return;
  switching = true;
  try {
    landmarker?.close?.();
    landmarker = await create("CPU");
    delegate = "CPU";
  } catch (err) {
    console.error("[pose] CPU fallback failed:", err);
    landmarker = null;
  } finally {
    switching = false;
  }
}

/* ── Camera ────────────────────────────────────────────── */

/** Turn a camera error into something a person can act on. */
export function cameraErrorMessage(err) {
  const name = err?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access is blocked. Click the camera icon in your browser's address bar, choose Allow, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError")
    return "No camera found. Plug one in, or check that it isn't turned off in your system settings.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "Your camera is busy in another app (FaceTime, Zoom, Photo Booth…). Close that app and try again.";
  if (name === "AbortError")
    return "Your camera didn't respond in time. Close other apps that use it, or unplug it and plug it back in, then try again.";
  if (name === "NoVideo")
    return "This camera isn't sending video. Pick another camera.";
  if (name === "NoSecureContext")
    return "The camera only works on a secure page. Use Go Live in VS Code (localhost) or your https:// Cloudflare link.";
  // Unknown error: show its name so it can be looked up.
  const detail = [name, err?.message].filter(Boolean).join(": ");
  return "The camera couldn't start. Check your camera permissions and try again." + (detail ? ` (${detail})` : "");
}

export const isPermissionError = (err) =>
  ["NotAllowedError", "SecurityError", "NoSecureContext"].includes(err?.name);

/* Which camera to try first. Pure functions, so they're unit-tested. */

// Software cameras: they show nothing (or a logo) unless their app is running.
const VIRTUAL = /\b(obs|virtual|snap camera|camo|mmhmm|manycam|xsplit|ndi|camtwist|ecamm|vcam|droidcam|epoccam|iriun|logi capture|nvidia broadcast)\b/i;
const BUILT_IN = /facetime|built-?in|integrated/i;
// Continuity Camera (an iPhone/iPad used as a webcam): real, but only works when the phone is nearby.
const PHONE = /iphone|ipad|continuity|desk view/i;

/** "builtin" | "external" | "phone" | "virtual" */
export function cameraKind(label = "") {
  if (VIRTUAL.test(label)) return "virtual";
  if (BUILT_IN.test(label)) return "builtin";
  if (PHONE.test(label)) return "phone";
  return "external";
}

const KIND_RANK = { builtin: 0, external: 1, phone: 2, virtual: 3 };

/**
 * The order to try cameras in: the one you chose (if any), then real cameras,
 * built-in first. Virtual cameras are left out unless you chose one, or
 * they're all there is. `skip` (a camera that just failed) goes last.
 */
export function cameraOrder(cams, preferredId = null, skip = null) {
  const ranked = cams
    .map((c, i) => ({ ...c, kind: cameraKind(c.label), i }))
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.i - b.i)
    .map(({ i, ...c }) => c);
  const chosen = ranked.find((c) => c.id === preferredId);
  let order = ranked.filter((c) => c.kind !== "virtual" && c !== chosen);
  if (chosen) order.unshift(chosen);
  if (!order.length) order = ranked;
  return [...order.filter((c) => c.id !== skip), ...order.filter((c) => c.id === skip)];
}

/**
 * Cameras on this machine as [{ id, label, kind }]. Empty until the page has
 * been allowed to use the camera (browsers hide the list before that).
 */
export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  return devices
    .filter((d) => d.kind === "videoinput" && d.deviceId)
    .map((d) => ({ id: d.deviceId, label: d.label, kind: cameraKind(d.label) }));
}

/** Like listCameras, but asks for camera access first if the names are still hidden. */
export async function listCamerasWithNames() {
  const cams = await listCameras();
  if (cams.some((c) => c.label)) return cams;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    const e = new Error("insecure"); e.name = "NoSecureContext"; throw e;
  }
  // Opens the browser's default camera for a moment, only to get permission.
  stopCamera(await navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
  return listCameras();
}

/** Device id of the camera a stream is using. */
export const streamCameraId = (stream) => stream?.getVideoTracks()[0]?.getSettings?.().deviceId ?? null;
export const streamCameraName = (stream) => stream?.getVideoTracks()[0]?.label || null;

const aborted = () => { const e = new Error("aborted"); e.name = "Aborted"; return e; };

/**
 * Open one camera into the <video> and resolve with its stream once real
 * frames are showing. Throws a "NoVideo" error if the camera opens but sends
 * nothing (or only black) within `timeoutMs`, and stops it. An AbortSignal
 * cancels the attempt (Back pressed, or another camera picked meanwhile).
 */
export async function openCamera(videoEl, deviceId, { signal, timeoutMs = 3000 } = {}) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    const e = new Error("insecure"); e.name = "NoSecureContext"; throw e;
  }
  const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
  const stream = await navigator.mediaDevices.getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: "user", ...size },
    audio: false,
  });
  if (signal?.aborted) { stopCamera(stream); throw aborted(); }

  videoEl.srcObject = stream;
  const verdict = await waitForVideo(videoEl, stream, timeoutMs, signal);
  if (verdict === "ok") return stream;

  stopCamera(stream);
  if (videoEl.srcObject === stream) videoEl.srcObject = null;
  if (verdict === "aborted") throw aborted();
  const e = new Error(verdict === "black" ? "only black frames" : "no frames");
  e.name = "NoVideo";
  throw e;
}

/**
 * Count the video frames that actually arrive. (video.currentTime can't be
 * used for this: with a live camera it keeps ticking even when the picture
 * is frozen.) Returns { get(), stop() }.
 */
export function countFrames(video) {
  if ("requestVideoFrameCallback" in video) {
    let n = 0, handle = 0, stopped = false;
    const tick = () => { n++; if (!stopped) handle = video.requestVideoFrameCallback(tick); };
    handle = video.requestVideoFrameCallback(tick);
    return { get: () => n, stop: () => { stopped = true; video.cancelVideoFrameCallback?.(handle); } };
  }
  if (video.getVideoPlaybackQuality) {
    return { get: () => video.getVideoPlaybackQuality().totalVideoFrames, stop() {} };
  }
  let n = 0, last = -1;              // last resort: better than nothing
  return { get: () => { if (video.currentTime !== last) { last = video.currentTime; n++; } return n; }, stop() {} };
}

/**
 * Wait for real video: new frames that aren't all black.
 * Resolves "ok", "black", "no-frames" or "aborted". play() isn't awaited
 * because with a dead camera it can wait forever; the frames are watched instead.
 */
function waitForVideo(video, stream, ms, signal) {
  video.play().catch(() => {});
  const probe = document.createElement("canvas");
  probe.width = 32; probe.height = 18;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  const counter = countFrames(video);
  const start = performance.now();
  let seen = counter.get(), frames = 0;

  return new Promise((resolve) => {
    const done = (verdict) => { counter.stop(); resolve(verdict); };
    const tick = () => {
      if (signal?.aborted || stream.getVideoTracks()[0]?.readyState === "ended") return done("aborted");
      const n = counter.get();
      if (n !== seen && video.readyState >= 2 && video.videoWidth) {
        seen = n;
        frames++;
        if (!isBlack(video, pctx)) return done("ok");
      }
      if (performance.now() - start > ms) return done(frames ? "black" : "no-frames");
      setTimeout(tick, 100);
    };
    tick();
  });
}

/** True if a frame is (almost) pure black. Real cameras show noise even in a dark room. */
function isBlack(video, pctx) {
  try {
    pctx.drawImage(video, 0, 0, 32, 18);
    const px = pctx.getImageData(0, 0, 32, 18).data;
    for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 24) return false;
    return true;
  } catch {
    return false;                    // can't check: don't block the camera over it
  }
}

/** Stop every track of a stream (turns the camera light off). */
export function stopCamera(stream) {
  stream?.getTracks?.().forEach((t) => t.stop());
}
