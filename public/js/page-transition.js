/**
 * page-transition.js — the home ↔ trainer motion-blur transition for
 * browsers that can't do it natively (no cross-document View Transitions:
 * Firefox, older Safari). Where the browser can, css/transitions.css does
 * it all and this does nothing.
 */

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const native = () => "onpagereveal" in window;     // ships with cross-document view transitions
const KEY = "vf-page-transition";

export function mountPageTransitions() {
  if (native() || reduced()) return;
  const body = document.body;

  // Arriving from a page that played the "leave" animation.
  try {
    if (sessionStorage.getItem(KEY)) {
      sessionStorage.removeItem(KEY);
      body.classList.add("vf-arriving");
      body.addEventListener("animationend", () => body.classList.remove("vf-arriving"), { once: true });
    }
  } catch { /* storage blocked: no arrive animation */ }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
    if (url.pathname === location.pathname) return;            // same page (#anchors etc.)
    e.preventDefault();
    try { sessionStorage.setItem(KEY, "1"); } catch { /* fine */ }
    body.classList.add("vf-leaving");
    setTimeout(() => { location.href = url.href; }, 230);
  });

  // Back button restores a page from the cache with the "leaving" state: undo it.
  window.addEventListener("pageshow", (e) => { if (e.persisted) body.classList.remove("vf-leaving", "vf-arriving"); });
}
