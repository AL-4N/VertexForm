/**
 * rail.js — the side rail on wide screens: a ruler down the left edge with
 * one labelled tick per section, built from the header nav's links (one
 * list to keep up to date). nav-spy.js marks the current section; the
 * marker glides to it with a vertical motion blur, and a thin fill down the
 * ruler shows how far down the page you are.
 *
 * Below 1400px wide there's no room beside the content, so the CSS keeps
 * the header nav instead (html.has-rail only switches over at that width).
 */

import { slide, EASE } from "../ui/motion.js";

export function mountRail() {
  const links = [...document.querySelectorAll('.nav nav a[href^="#"]')];
  if (!links.length) return;

  const rail = document.createElement("nav");
  rail.className = "rail";
  rail.setAttribute("aria-label", "Sections");
  rail.innerHTML = `
    <span class="rail-track" aria-hidden="true"><span class="rail-fill"></span></span>
    <span class="rail-marker" aria-hidden="true"></span>
    <ol>${links.map((a, i) => `
      <li><a href="${a.hash}"><span class="rail-n">${String(i + 1).padStart(2, "0")}</span><span class="rail-label">${a.textContent}</span></a></li>`).join("")}
    </ol>`;
  document.body.appendChild(rail);
  document.documentElement.classList.add("has-rail");

  const fill = rail.querySelector(".rail-fill");
  const marker = rail.querySelector(".rail-marker");
  let raf = 0, markerY = null;

  const progress = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    fill.style.transform = `scaleY(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  };
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(progress); }, { passive: true });
  progress();

  // nav-spy.js says which section is current (or none, in the hero).
  document.addEventListener("vf:section", (e) => {
    const link = e.detail ? rail.querySelector(`a[href="${e.detail}"]`) : null;
    marker.classList.toggle("on", !!link);
    if (!link) return;
    const y = link.offsetTop + link.offsetHeight / 2;
    const from = markerY ?? y;
    markerY = y;
    slide(marker, { from: [0, from], to: [0, y], duration: from === y ? 0 : 380, ease: EASE.out, strength: 0.9, maxBlur: 10, keep: true });
  });
}
