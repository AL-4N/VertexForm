/**
 * popup.js — popups that grow out of what you clicked.
 *
 * openPopup(dialog, from) opens a <dialog> as a modal. The box starts as
 * the shape of `from` (the card or button you pressed) and opens out to
 * its full size with a clip-path, while the page behind blurs and dims
 * (::backdrop, css). Then its parts ([data-pop-item]) rise in one after
 * another. Closing runs it backwards into whatever opened it. With no
 * `from` it opens out of the centre as a circle.
 *
 * Esc, the close button ([data-pop-close]) and a click outside the box all
 * close it the same way. Focus goes back to `from` afterwards (the browser
 * does that for showModal). Reduced motion: it just opens and closes.
 */

import { reducedMotion } from "./motion.js";

const EASE_OUT = "cubic-bezier(.22,.61,.36,1)";
const EASE_IN = "cubic-bezier(.55,.06,.68,.19)";

function shapeOf(dlg, from, radius) {
  const d = dlg.getBoundingClientRect();
  const r = from?.isConnected ? from.getBoundingClientRect() : null;
  if (!r || !r.width) return `circle(0% at 50% 50%)`;
  const top = Math.max(0, r.top - d.top), left = Math.max(0, r.left - d.left);
  const right = Math.max(0, d.right - r.right), bottom = Math.max(0, d.bottom - r.bottom);
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`;
}

/**
 * Grow an element that just appeared out of a rectangle on screen (the
 * button or card that was pressed, measured before the page changed), then
 * let its children rise in one after another. With no rect: out of the
 * centre as a circle. Used for trainer screens, the skill-tree panel, and
 * anything else that should look like it came from what you clicked.
 */
export function growFrom(el, rect, { radius = 14, duration = 560, items = [] } = {}) {
  if (reducedMotion() || !el?.animate) return;
  const d = el.getBoundingClientRect();
  const from = rect && rect.width
    ? `inset(${Math.max(0, rect.top - d.top)}px ${Math.max(0, d.right - rect.right)}px ${Math.max(0, d.bottom - rect.bottom)}px ${Math.max(0, rect.left - d.left)}px round ${radius}px)`
    : `circle(0px at 50% ${Math.min(d.height / 2, innerHeight / 2 - d.top)}px)`;
  const to = rect && rect.width ? `inset(0px 0px 0px 0px round 0px)` : `circle(${Math.hypot(d.width, d.height)}px at 50% ${Math.min(d.height / 2, innerHeight / 2 - d.top)}px)`;
  el.animate([{ clipPath: from }, { clipPath: to }], { duration, easing: EASE_OUT });
  items.forEach((c, i) => c.animate(
    [{ opacity: 0, transform: "translateY(18px)", filter: "blur(5px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
    { duration: 440, delay: 140 + i * 45, easing: EASE_OUT, fill: "backwards" },
  ));
}

export function openPopup(dlg, from = null, { onClose, beforeClose } = {}) {
  dlg._from = from;
  dlg._onClose = onClose;
  dlg._beforeClose = beforeClose;     // optional: an animation (Promise) to finish before folding away
  if (!dlg._wired) wire(dlg);
  dlg.classList.remove("closing");
  dlg.showModal();
  if (reducedMotion()) return;
  const radius = parseFloat(getComputedStyle(dlg).borderRadius) || 22;
  dlg._anim?.cancel();
  dlg._anim = dlg.animate(
    [{ clipPath: shapeOf(dlg, from, 14) }, { clipPath: `inset(0px 0px 0px 0px round ${radius}px)` }],
    { duration: 560, easing: EASE_OUT },
  );
  dlg.querySelectorAll("[data-pop-item]").forEach((el, i) => {
    el.animate(
      [{ opacity: 0, transform: "translateY(22px)", filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
      { duration: 480, delay: 170 + i * 55, easing: EASE_OUT, fill: "backwards" },
    );
  });
}

export async function closePopup(dlg) {
  if (!dlg.open || dlg.classList.contains("closing")) return;
  const done = () => { dlg.classList.remove("closing"); dlg.close(); dlg._onClose?.(); };
  if (reducedMotion()) { done(); return; }
  dlg.classList.add("closing");
  if (dlg._beforeClose) { try { await dlg._beforeClose(); } catch { /* close anyway */ } }
  const radius = parseFloat(getComputedStyle(dlg).borderRadius) || 22;
  dlg._anim?.cancel();
  dlg._anim = dlg.animate(
    [{ clipPath: `inset(0px 0px 0px 0px round ${radius}px)` }, { clipPath: shapeOf(dlg, dlg._from, 14) }],
    { duration: 420, easing: EASE_IN, fill: "forwards" },
  );
  // Close when the animation ends; the timer covers a page that isn't
  // rendering (a background tab), where the finish event never comes.
  let closed = false;
  const finish = () => { if (closed) return; closed = true; dlg._anim?.cancel(); done(); };
  dlg._anim.onfinish = finish;
  setTimeout(finish, 470);
}

function wire(dlg) {
  dlg._wired = true;
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); closePopup(dlg); });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-pop-close]")) closePopup(dlg);
  });
}

/**
 * A yes/no question in a popup that grows out of the button that asked it.
 * Resolves true for the confirm button, false for anything else.
 */
export function askPopup(message, { from = document.activeElement, yes = "Yes", no = "Cancel", danger = false } = {}) {
  let dlg = document.getElementById("vf-ask");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "vf-ask";
    dlg.className = "pop pop-ask";
    dlg.setAttribute("aria-labelledby", "vf-ask-text");
    dlg.innerHTML = `<div class="pop-inner">
      <p id="vf-ask-text" class="pop-ask-text" data-pop-item></p>
      <div class="pop-ask-actions" data-pop-item>
        <button type="button" class="btn ghost" data-ask="no"></button>
        <button type="button" class="btn primary" data-ask="yes"></button>
      </div></div>`;
    document.body.appendChild(dlg);
  }
  dlg.querySelector("#vf-ask-text").textContent = message;
  const yesBtn = dlg.querySelector('[data-ask="yes"]'), noBtn = dlg.querySelector('[data-ask="no"]');
  yesBtn.textContent = yes; noBtn.textContent = no;
  yesBtn.classList.toggle("danger", danger);
  yesBtn.classList.toggle("primary", !danger);
  return new Promise((resolve) => {
    let answer = false;
    const pick = (e) => {
      const b = e.target.closest("[data-ask]");
      if (!b) return;
      answer = b.dataset.ask === "yes";
      closePopup(dlg);
    };
    dlg.addEventListener("click", pick);
    openPopup(dlg, from, { onClose: () => { dlg.removeEventListener("click", pick); resolve(answer); } });
    noBtn.focus();
  });
}
