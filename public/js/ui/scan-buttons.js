/**
 * scan-buttons.js — a scan passes over every button.
 *
 * On hover a bright beam sweeps across the button from left to right with
 * the go gradient filling in behind it, and each letter of the label rolls
 * over to its new colour as the beam reaches it, as if the scanner rewrote
 * the word. Leaving, a second beam runs the fill out through the right
 * edge and the letters roll back in the same order. The look is CSS
 * (.btn::before fill, ::after beam, .ch letters in site.css and app.css);
 * this file only adds the classes, splits the label into letters the
 * first time a button is hovered (again if its text has changed since),
 * and times each letter to the beam. Screen readers get the label as plain
 * text; the letters are hidden from them.
 *
 * Touch: no hover, so no scan; buttons squash a little when pressed (CSS).
 */

const DURATION = 550;    // ms; keep in step with the CSS transitions

export function mountScanButtons(root = document) {
  root.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const b = e.target.closest?.(".btn");
    if (!b || (e.relatedTarget && b.contains(e.relatedTarget)) || b.disabled) return;
    prepare(b);
    b.style.setProperty("--bw", `${b.offsetWidth + 8}px`);
    b.classList.remove("scan-out");
    b.classList.add("scan-in");
  });
  root.addEventListener("pointerout", (e) => {
    const b = e.target.closest?.(".btn");
    if (!b || (e.relatedTarget && b.contains(e.relatedTarget)) || !b.classList.contains("scan-in")) return;
    b.classList.remove("scan-in");
    b.classList.add("scan-out");
  });
}

function prepare(b) {
  if (b.dataset.scan === b.textContent) return;          // already split, text unchanged
  b.querySelectorAll(":scope .btn-sr, :scope .btn-word-wrap").forEach((n) => n.remove());
  const walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.textContent.trim() && !n.parentElement.closest("svg") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes = [];
  for (let n = walk.nextNode(); n; n = walk.nextNode()) nodes.push(n);
  for (const node of nodes) {
    const text = node.textContent;
    const sr = Object.assign(document.createElement("span"), { className: "btn-sr", textContent: text });
    const wrap = document.createElement("span");
    wrap.className = "btn-word-wrap";
    wrap.setAttribute("aria-hidden", "true");
    // Words stay whole (so a long label can still wrap); each letter rolls on its own.
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { wrap.append(" "); return; }
      const w = document.createElement("span");
      w.className = "btn-word";
      for (const c of part) w.append(Object.assign(document.createElement("span"), { className: "ch", textContent: c }));
      wrap.append(w);
    });
    node.replaceWith(sr, wrap);
  }
  // Each letter turns when the beam reaches it (the beam crosses in DURATION).
  const width = b.offsetWidth || 1;
  b.querySelectorAll(".ch").forEach((ch) => {
    const x = ch.offsetLeft + ch.offsetWidth / 2;
    ch.style.setProperty("--d", `${Math.round((x / width) * DURATION * 0.85)}ms`);
  });
  b.classList.add("scan-ready");
  b.dataset.scan = b.textContent;
}
