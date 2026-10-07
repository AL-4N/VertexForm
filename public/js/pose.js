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
export const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}`;
const MODEL_BASE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker";

/**
 * Model quality. Bigger models track better (especially knees and wrists
 * that are partly hidden) but cost more per frame.
 *   lite  ≈ 5.8 MB   fastest — older laptops, phones
 *   full  ≈ 9.4 MB   the default: clearly steadier than lite
 *   heavy ≈ 31 MB    most accurate; wants a decent GPU
 * "auto" starts on full and drops to lite if the frame rate can't keep up.
 */
export const MODELS = {
  lite:  `${MODEL_BASE}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
  full:  `${MODEL_BASE}/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
  heavy: `${MODEL_BASE}/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task`,
};
export const MODEL_NAMES = { lite: "Fast", full: "Balanced", heavy: "Max accuracy" };
/** The model to load for a quality setting ("auto" → full). */
export const modelFor = (quality) => (MODELS[quality] ? quality : "full");

const OPTIONS = {
  runningMode: "VIDEO",
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

let landmarker = null;
let delegate = null;
let model = null;              // "lite" | "full" | "heavy" currently loaded
let fileset = null;
let PoseLandmarkerClass = null;
let loading = null, loadingModel = null;
let switching = false;

async function create(which, name) {
  return PoseLandmarkerClass.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODELS[name], delegate: which },
    ...OPTIONS,
  });
}

/**
 * Load the library + a model. Later calls reuse them; asking for a different
 * model swaps it in (detection pauses for the moment that takes).
 * @param quality "auto" | "lite" | "full" | "heavy"
 */
export function initPose(onStatus = () => {}, quality = "auto") {
  const name = modelFor(quality);
  if (landmarker && model === name) return Promise.resolve(landmarker);
  if (loading && loadingModel === name) return loading;

  loadingModel = name;
  const job = (async () => {
    if (loading) await loading.catch(() => {});      // one load at a time
    if (landmarker && model === name) return landmarker;
    if (!PoseLandmarkerClass) {
      onStatus("Loading the pose engine…");
      const vision = await import(`${CDN}/vision_bundle.mjs`);
      PoseLandmarkerClass = vision.PoseLandmarker;
      fileset = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    }

    onStatus(`Loading the pose model (${MODEL_NAMES[name]})…`);
    const old = landmarker;
    let next = null, nextDelegate = null;
    try {
      // ?cpu in the page URL forces the CPU path (useful for troubleshooting).
      if (new URLSearchParams(location.search).has("cpu")) throw new Error("CPU requested");
      next = await create(delegate === "CPU" ? "CPU" : "GPU", name);
      nextDelegate = delegate === "CPU" ? "CPU" : "GPU";
    } catch (err) {
      if (delegate !== "CPU") console.warn("[pose] GPU unavailable, using CPU:", err);
      next = await create("CPU", name);
      nextDelegate = "CPU";
    }
    landmarker = next; delegate = nextDelegate; model = name;
    if (old && old !== next) old.close?.();
    return landmarker;
  })();
  loading = job;

  // If loading fails, allow a retry later instead of caching the failure.
  job.catch(() => {}).finally(() => { if (loading === job) { loading = null; loadingModel = null; } });
  return job;
}

export const poseDelegate = () => delegate;
export const poseModel = () => model;

/**
 * Detect on one video frame.
 * @returns { landmarks, world } or null. landmarks: 33 × {x, y, z, visibility}
 *   with x/y normalised 0..1; world: the same 33 points in metres, centred
 *   on the hips (MediaPipe's worldLandmarks), or null if not provided.
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
  const pt = (p) => ({ x: p.x, y: p.y, z: p.z ?? 0, visibility: p.visibility ?? 1 });
  const world = res.worldLandmarks?.[0];
  return { landmarks: lms.map(pt), world: world ? world.map(pt) : null };
}

async function fallBackToCpu() {
  if (switching) return;
  switching = true;
  try {
    landmarker?.close?.();
    landmarker = await create("CPU", model ?? "full");
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
    return "Your camera is busy: another app or browser tab is using it. Close other tabs of this site, " +
      "video-call apps (FaceTime, Zoom, Teams) and browser sidebar apps (Opera GX's sidebar messengers can hold the camera), then try again.";
  if (name === "AbortError")
    return "Your camera didn't respond in time. Close other apps that use it, or unplug it and plug it back in, then try again.";
  if (name === "NoVideo")
    return "This camera isn't sending any video. Check it's plugged in and not in use by another app, then Try again, or pick another camera.";
  if (name === "BlackPicture")
    return "Camera shows a black picture. If it has a privacy cover, slide it open.";
  if (name === "StillImage")
    return "This camera is showing a still picture, not live video (probably a virtual camera whose app isn't running). Pick another.";
  if (name === "NotSupportedError" || name === "TypeError")
    return "This browser can't use the camera on this page. Open the site in Chrome, Edge, Opera, Firefox or Safari over https:// (or localhost).";
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
// Only software cameras by name: a real USB webcam (Anker, Logitech, Elgato Facecam, Razer…) never matches.
const VIRTUAL = /\b(obs|virtual|snap camera|camo|mmhmm|manycam|xsplit|ndi|camtwist|ecamm|vcam|droidcam|epoccam|iriun|logi capture|nvidia broadcast|streamlabs|screen ?capture|avatarify|vtube|veadotube|chromacam|youcam|cyberlink|splitcam|sparkocam|webcamoid|e2esoft)\b/i;
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
// Never picked automatically (only when you choose them): software cameras,
// and Continuity / iPhone cameras, which show nothing unless the phone is ready.
const AUTO_SKIP = new Set(["virtual", "phone"]);

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
  let order = ranked.filter((c) => !AUTO_SKIP.has(c.kind) && c !== chosen);
  if (chosen) order.unshift(chosen);
  if (!order.length) order = ranked;
  return [...order.filter((c) => c.id !== skip), ...order.filter((c) => c.id === skip)];
}

/**
 * Which cameras to try, in order. A camera you picked (now, or saved from
 * before) is the ONLY one tried: if it fails you get a message and the
 * camera list, never a silent switch to a different camera. With no pick,
 * real cameras are tried in cameraOrder() order.
 * @returns { order: [{id, label, kind}], explicit: bool }
 */
export function camerasToTry(cams, { pickedId = null, savedId = null, skip = null } = {}) {
  const want = pickedId ?? savedId;
  const chosen = want && cams.find((c) => c.id === want);
  if (chosen) return { order: [{ ...chosen, kind: cameraKind(chosen.label) }], explicit: true };
  return { order: cameraOrder(cams, null, skip), explicit: false };
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

/**
 * Like listCameras, but asks for camera access first if the names are still
 * hidden. Resolves { cams, probe }: `probe` is the stream opened to get
 * permission (or null). The caller reuses it if it's the camera it wants,
 * which saves opening the same camera twice, and must stop it otherwise.
 *
 * The browser's default camera can be a virtual or busy one. If it fails
 * for any reason other than permission, access has still been granted, so
 * the real cameras are listed and tried as usual instead of giving up.
 */
export async function listCamerasWithNames() {
  const cams = await listCameras();
  if (cams.some((c) => c.label)) return { cams, probe: null };
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    const e = new Error("insecure"); e.name = "NoSecureContext"; throw e;
  }
  let probe = null;
  try {
    probe = await navigator.mediaDevices.getUserMedia({ video: CAMERA_SIZE, audio: false });
  } catch (err) {
    if (isPermissionError(err)) throw err;
    console.warn("[camera] default camera failed during the permission check:", err);
  }
  return { cams: await listCameras(), probe };
}

/** What we ask every camera for: 720p at 30 fps, or the best it can do. */
export const CAMERA_SIZE = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };

/**
 * getUserMedia constraints to try, most to least specific. Only the device
 * id is ever `exact`; size and frame rate are always `ideal`, so a camera is
 * never refused for not supporting a mode.
 */
export function constraintLadder(deviceId, facing = "user") {
  const who = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: facing };
  return [
    { ...who, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    { ...who, width: { ideal: 640 }, height: { ideal: 480 } },
    { ...who },
  ];
}

const RETRY_WITH_LESS = new Set(["OverconstrainedError", "NotReadableError", "TrackStartError", "AbortError"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Open a camera, stepping down the constraint ladder when the camera can't
 * do what was asked (OverconstrainedError) or is still being released by a
 * previous stream (NotReadableError: wait a moment, then try again).
 * @param gum  getUserMedia (injectable for tests)
 * @param log  called with each attempt's outcome (diagnostics)
 */
export async function getCameraStream(deviceId, { facing = "user", signal, log = () => {}, gum } = {}) {
  gum ??= (c) => navigator.mediaDevices.getUserMedia(c);
  let lastErr = null;
  const ladder = constraintLadder(deviceId, facing);
  for (let step = 0; step < ladder.length; step++) {
    if (signal?.aborted) throw aborted();
    try {
      const stream = await gum({ video: ladder[step], audio: false });
      log({ step, ok: true, constraints: ladder[step] });
      return stream;
    } catch (err) {
      lastErr = err;
      log({ step, ok: false, constraints: ladder[step], error: `${err?.name}: ${err?.message}` });
      if (!RETRY_WITH_LESS.has(err?.name)) throw err;
      if (err.name !== "OverconstrainedError") await sleep(400);
    }
  }
  throw lastErr;
}

/** Everything useful about a camera track, for ?debug and bug reports. */
export function cameraInfo(stream, err = null) {
  const t = stream?.getVideoTracks?.()[0];
  const s = t?.getSettings?.() ?? {};
  let c = null;
  try { c = t?.getCapabilities?.() ?? null; } catch { /* not supported */ }
  return {
    label: t?.label ?? null,
    readyState: t?.readyState ?? null,
    muted: t?.muted ?? null,
    settings: t ? { width: s.width, height: s.height, frameRate: s.frameRate && Math.round(s.frameRate * 10) / 10, deviceId: s.deviceId?.slice(0, 12) } : null,
    capabilities: c ? { width: c.width, height: c.height, frameRate: c.frameRate, resizeMode: c.resizeMode } : null,
    error: err ? `${err.name}: ${err.message}` : null,
  };
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
/**
 * @returns { stream, picture: "ok" | "black" }. "black" = the camera sends
 *   frames but they're pure black (usually a closed privacy cover): it works,
 *   so it's used, and the caller tells you to open the cover.
 * Waits up to `timeoutMs` (6 s) for the first frame: USB webcams often take
 * 2–5 s to warm up and start "muted". Only a camera that sends NOTHING in
 * that time is a "NoVideo" error.
 */
export async function openCamera(videoEl, deviceId, { signal, timeoutMs = 6000, facing = "user", stream = null, log = () => {} } = {}) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    const e = new Error("insecure"); e.name = "NoSecureContext"; throw e;
  }
  stream ??= await getCameraStream(deviceId, { facing, signal, log });
  if (signal?.aborted) { stopCamera(stream); throw aborted(); }
  log({ opened: cameraInfo(stream) });

  videoEl.srcObject = stream;
  const verdict = await waitForVideo(videoEl, stream, timeoutMs, signal);
  if (verdict === "ok" || verdict === "black") {
    // Playing for sure before the caller starts reading frames (it already
    // shows frames, so this can't hang the way it can on a dead camera).
    await Promise.race([videoEl.play().catch(() => {}), new Promise((r) => setTimeout(r, 500))]);
    return { stream, picture: verdict };
  }

  log({ failed: verdict, info: cameraInfo(stream) });
  stopCamera(stream);
  if (videoEl.srcObject === stream) videoEl.srcObject = null;
  if (verdict === "aborted") throw aborted();
  const e = new Error(`no frames in ${Math.round(timeoutMs / 1000)} s${stream.getVideoTracks()[0]?.muted ? " (track stayed muted)" : ""}`);
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
        // Black frames are normal while a webcam warms up: keep waiting for a
        // real picture, up to the timeout.
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
  const px = sample(video, pctx);
  return px ? frameStats(px).black : false;   // can't check: don't block the camera over it
}

/** A tiny 32×18 copy of the current frame's pixels, or null if it can't be read. */
export function sample(video, pctx) {
  try {
    pctx.drawImage(video, 0, 0, 32, 18);
    return pctx.getImageData(0, 0, 32, 18).data;
  } catch {
    return null;
  }
}

/**
 * Brightness facts about a sampled frame (RGBA bytes). Pure, so it's tested.
 *   black: every pixel is (almost) pure black — a dead or covered camera
 *   luma:  mean brightness 0..255 — under ~45 is too dark to track well
 *   hash:  a cheap fingerprint, to spot a camera stuck on one still picture
 */
export function frameStats(px) {
  let max = 0, sum = 0, hash = 0;
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (r + g + b > max) max = r + g + b;
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
    hash = (hash * 31 + r + (g << 8) + (b << 16)) >>> 0;
  }
  const luma = n ? sum / n : 0;
  // "Black" means essentially zero everywhere (a closed cover, a dead
  // sensor). A dim room still has some signal: that's low light, not black.
  return { black: max <= 12 && luma < 2.5, luma, hash };
}

/** Stop every track of a stream (turns the camera light off). */
export function stopCamera(stream) {
  stream?.getTracks?.().forEach((t) => t.stop());
}
