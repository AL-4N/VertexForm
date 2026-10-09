/**
 * sw.js — offline support (service worker).
 *
 * App files: network first, so you always get the newest version when
 * online; the cached copy is used when offline. Every app file is cached on
 * install, so the trainer works offline after one visit.
 *
 * Voice clips (audio/<voice>/<hash>.mp3): cache first, cached as they play.
 *
 * MediaPipe (library, wasm, pose models): cache first. Their URLs include a
 * version number, so a cached copy never goes stale; they're kept across
 * app updates and fetched again only if the URL changes.
 *
 * VERSION and PRECACHE are written by `npm run sw` (tools/update-sw.mjs):
 * VERSION is a hash of the app's files, so any change produces a new cache
 * and old ones are deleted on activate. Updates are never stuck.
 */

const VERSION = "fc58ceaf8d9d";
const PRECACHE = [
  "./",
  "404.html",
  "app.html",
  "audio/af_bella/manifest.json",
  "audio/af_heart/manifest.json",
  "audio/am_michael/manifest.json",
  "audio/voices.json",
  "css/app.css",
  "css/fonts.css",
  "css/marks.css",
  "css/site.css",
  "css/theme.css",
  "css/transitions.css",
  "favicon.svg",
  "fonts/instrument-sans-latin-400-normal.woff2",
  "fonts/instrument-sans-latin-500-normal.woff2",
  "fonts/instrument-sans-latin-600-normal.woff2",
  "fonts/instrument-sans-latin-700-normal.woff2",
  "fonts/unbounded-latin-500-normal.woff2",
  "fonts/unbounded-latin-600-normal.woff2",
  "fonts/unbounded-latin-700-normal.woff2",
  "fonts/unbounded-latin-800-normal.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "index.html",
  "js/achievements.js",
  "js/circuit.js",
  "js/coach.js",
  "js/coaching.js",
  "js/config.js",
  "js/exercises/index.js",
  "js/exercises/jumpingjack.js",
  "js/exercises/lunge.js",
  "js/exercises/plank.js",
  "js/exercises/pushup.js",
  "js/exercises/squat.js",
  "js/figures/annotate.js",
  "js/figures/draw.js",
  "js/figures/lab.js",
  "js/figures/loop.js",
  "js/figures/pictos.js",
  "js/figures/poses.js",
  "js/figures/rig.js",
  "js/filters.js",
  "js/geometry.js",
  "js/grade.js",
  "js/guide.js",
  "js/history.js",
  "js/main.js",
  "js/page-transition.js",
  "js/phrases.js",
  "js/pose.js",
  "js/pwa.js",
  "js/recording.js",
  "js/repclips.js",
  "js/replay-store.js",
  "js/rest.js",
  "js/scoring.js",
  "js/session.js",
  "js/site/coach.js",
  "js/site/how.js",
  "js/site/lab.js",
  "js/site/main.js",
  "js/site/motion-nav.js",
  "js/site/nav-spy.js",
  "js/site/rail.js",
  "js/site/stage.js",
  "js/skills.js",
  "js/speech.js",
  "js/storage.js",
  "js/tracking.js",
  "js/ui/camera-picker.js",
  "js/ui/camera-preview.js",
  "js/ui/components.js",
  "js/ui/live.js",
  "js/ui/menu.js",
  "js/ui/motion.js",
  "js/ui/onboarding.js",
  "js/ui/overlay.js",
  "js/ui/replay.js",
  "js/ui/rest-screen.js",
  "js/ui/results.js",
  "js/ui/settings.js",
  "js/ui/sharecard.js",
  "js/ui/skills.js",
  "js/ui/stats.js",
  "js/ui/workouts.js",
  "js/voice.js",
  "js/voices.js",
  "manifest.webmanifest",
];

const SHELL = `vf-shell-${VERSION}`;
const LIBS = "vf-libs-v1";
const LIB_HOSTS = ["cdn.jsdelivr.net", "storage.googleapis.com"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(PRECACHE.map(async (p) => {
      const res = await fetch(new Request(p, { cache: "reload" }));
      if (!res.ok) throw new Error(`precache ${p}: ${res.status}`);
      await cache.put(p, await unredirect(res));
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== LIBS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (LIB_HOSTS.includes(url.hostname) && /mediapipe/.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
  } else if (url.origin === self.location.origin && /\/audio\/.+\.mp3$/.test(url.pathname)) {
    // Voice clips: file names are content hashes, so a cached copy never goes stale.
    event.respondWith(cacheFirst(req));
  } else if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(LIBS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) unredirect(res.clone()).then((r) => cache.put(stripQuery(req), r)).catch(() => {});
    return res;
  } catch (err) {
    const hit = (await cache.match(stripQuery(req))) ?? (await cache.match(req)) ?? (await cache.match(asHtml(req)));
    if (hit) return hit;
    if (req.mode === "navigate") return (await cache.match("app.html")) ?? Response.error();
    throw err;
  }
}

/**
 * Cloudflare serves app.html by redirecting to /app. A redirected response
 * can't be handed to a page load, so store a clean copy of it instead.
 */
async function unredirect(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

/** /app (Cloudflare's address for app.html) → app.html; / → index.html. */
function asHtml(req) {
  const url = new URL(req.url);
  url.search = "";
  url.pathname = url.pathname.endsWith("/") ? `${url.pathname}index.html` : `${url.pathname}.html`;
  return url.toString();
}

/** app.html?debug and app.html share one cached copy. */
function stripQuery(req) {
  const url = new URL(req.url);
  if (!url.search) return req;
  url.search = "";
  return new Request(url.toString());
}
