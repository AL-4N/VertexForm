/**
 * pwa.js — register the service worker (offline support, installable app).
 * Skipped when the page is opened as a file or without HTTPS/localhost.
 */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext || location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("[pwa] service worker not registered:", err));
  });
}
