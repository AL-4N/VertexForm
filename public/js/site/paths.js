/**
 * paths.js — the homepage's skill paths, one card at a time.
 *
 * The section pins while scrolling rolls through the five paths, like a
 * project carousel: a big card holding the path's tree bends with scroll
 * speed (its top and bottom edges bow in) and rolls up and away through a
 * blur while the next rolls in from below; the middle column (N°01 / 05,
 * the path's name, real counts, a button into its tree) swaps with it; a
 * small glossy tile on the right showing the goal skill tumbles past the
 * other way and leans toward the pointer. When scrolling stops between two
 * paths, it glides to the nearer one.
 *
 * The trees are real: the same skillPath() and miniTree() the trainer uses,
 * read from this browser's saved sets if there are any (read-only).
 * Without GSAP's ticker, or with reduced motion, the paths are a plain list.
 */

import { PATHS, skillPath } from "../skills.js";
import { miniTree } from "../ui/mini-tree.js";
import { reducedMotion } from "../ui/motion.js";
import { smooth as smoothScroll } from "./smooth.js";

const KEY = "workout-analyzer:v1";
const pad = (n) => String(n).padStart(2, "0");
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function saved() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return { sessions: Array.isArray(d?.sessions) ? d.sessions : [], skills: Array.isArray(d?.skills) ? d.skills : [] };
  } catch { return { sessions: [], skills: [] }; }
}

/** The goal skill as a flower: in bloom if unlocked, a bud if next, else a bare twig. */
function goalFlower(status) {
  if (status === "done") {
    const petals = [0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-9" rx="6.4" ry="9.6" transform="rotate(${a})" class="pt-petal"/>`).join("");
    return `<svg class="pt-flower" viewBox="-24 -24 48 48" aria-hidden="true">${petals}<circle r="4.6" class="pt-heart"/></svg>`;
  }
  if (status === "next") {
    return `<svg class="pt-flower" viewBox="-24 -24 48 48" aria-hidden="true"><path d="M0 22V6" class="pt-twig"/><path d="M0 8c-7-1-9-6-9-10 4 0 7 2 9 5 2-3 5-5 9-5 0 4-2 9-9 10z" class="pt-sepal"/><ellipse cx="0" cy="-4" rx="7" ry="11" class="pt-bud"/></svg>`;
  }
  return `<svg class="pt-flower" viewBox="-24 -24 48 48" aria-hidden="true"><path d="M0 22V-12M0 6l-9-9M0-2l8-8" class="pt-twig"/><path d="M-9-3c-5 0-7-3-7-5 3-2 7 0 7 5zM8-10c5 0 7-3 7-5-3-2-7 0-7 5z" class="pt-leaf"/></svg>`;
}

function slideHTML(p, i, n) {
  const tracked = p.steps.filter((s) => s.test).length;
  const tiers = Math.max(...p.steps.map((s) => s.tier));
  const goal = p.steps.find((s) => s.name === p.goal) ?? p.steps.at(-1);
  const href = `app.html#tree-${p.id}`;
  return `
    <article class="pslide" data-i="${i}" aria-label="${p.name} path, ${i + 1} of ${n}">
      <a class="pc-card" href="${href}" tabindex="-1" aria-hidden="true">
        <span class="pc-cap">${p.steps.length} SKILLS · ${tiers} TIERS</span>
        <span class="pc-tree">${miniTree(p)}</span>
        <span class="pc-glare"></span>
        <span class="pc-cap pc-cap-b">BUILDS TO ${p.goal.toUpperCase()}</span>
      </a>
      <div class="pc-info">
        <span class="pc-n">N°${pad(i + 1)} / ${pad(n)}</span>
        <h3 aria-label="${p.name}">${[...p.name].map((c, k) => `<span class="pc-ch" style="--k:${k}" aria-hidden="true">${c}</span>`).join("")}</h3>
        <span class="pc-tags"><span>${p.steps.length} skills</span><span>${tracked} tracked</span><span>${p.done} unlocked</span></span>
        <a class="btn btn-ghost" href="${href}">Open the ${p.name.toLowerCase()} tree</a>
      </div>
      <div class="pc-tile" aria-hidden="true">
        <span class="pc-tile-in">
          ${goalFlower(goal.status)}
          <span class="pc-tile-k">GOAL</span>
          <span class="pc-tile-v">${p.goal}</span>
        </span>
      </div>
    </article>`;
}

/** Each skill mark in its own wrapper so it can pop without losing its place. */
function wrapMarks(svg) {
  if (!svg) return [];
  return [...svg.querySelectorAll(":scope > g")].map((mark) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    mark.replaceWith(g); g.append(mark);
    g.style.transformBox = "fill-box"; g.style.transformOrigin = "50% 100%";
    const m = /translate\(([\d.]+) ([\d.]+)\)/.exec(mark.getAttribute("transform") ?? "");
    return { g, y: m ? Number(m[2]) : 0 };
  });
}

export function mountPaths(root = document.querySelector("[data-paths]")) {
  if (!root) return;
  const { sessions, skills } = saved();
  const paths = skillPath(sessions, skills);
  const n = paths.length;
  root.innerHTML = `<div class="paths-pin">${paths.map((p, i) => slideHTML(p, i, n)).join("")}
    <ol class="paths-rail" aria-hidden="true">${paths.map((p, i) => `<li style="--i:${i}"><span>${pad(i + 1)}</span></li>`).join("")}<i class="paths-rail-fill"></i></ol></div>`;
  if (PATHS.length !== n) return;

  const G = window.gsap;
  if (!G || reducedMotion()) return;                      // a plain list
  root.classList.add("live");
  root.style.setProperty("--n", n);
  root.querySelectorAll(".mini-tree .mt-wood:not(.planned)").forEach((w) => { w.setAttribute("pathLength", "1"); });
  const slides = [...root.querySelectorAll(".pslide")];
  const parts = slides.map((s) => ({
    s, card: s.querySelector(".pc-card"), info: s.querySelector(".pc-info"), tile: s.querySelector(".pc-tile"),
    link: s.querySelector(".pc-info .btn"), tree: s.querySelector(".pc-tree"),
    wood: [...s.querySelectorAll(".mini-tree .mt-wood")], marks: wrapMarks(s.querySelector(".mini-tree")),
  }));
  const rail = root.querySelector(".paths-rail"), railFill = root.querySelector(".paths-rail-fill");
  const railDots = [...rail.querySelectorAll("li")];

  const st = { p: 0, shown: 0, v: 0, bow: 0, on: -1, mx: 0, my: 0, tmx: 0, tmy: 0, idle: 0 };

  function frame(time, dt) {
    // One read of the section's box: whether it's on screen, and how far through it you are.
    const r = root.getBoundingClientRect();
    if (r.bottom < -50 || r.top > innerHeight + 50) return;
    const run = Math.max(1, r.height - innerHeight);
    const step = Math.min(64, dt || 16) / 16.7;
    const prev = st.shown;
    st.p = clamp(-r.top / run, 0, 1) * (n - 1);
    st.shown += (st.p - st.shown) * (1 - Math.pow(1 - 0.14, step));
    if (Math.abs(st.p - st.shown) < 0.0005) st.shown = st.p;
    const v = (st.shown - prev) / step;                     // slides per frame
    st.v += (v - st.v) * 0.3;
    // The card bends with speed: its edges bow in up to 7% of its height.
    const want = clamp(Math.abs(st.v) * 90, 0, 7);
    st.bow += (want - st.bow) * 0.18;
    st.mx += (st.tmx - st.mx) * 0.1; st.my += (st.tmy - st.my) * 0.1;
    // Nothing moved since the last frame (scroll settled, pointer still,
    // edges straight): leave the styles alone instead of rewriting them.
    const key = `${st.shown.toFixed(4)}|${st.mx.toFixed(3)}|${st.my.toFixed(3)}|${st.bow.toFixed(2)}`;
    if (key === st.key) return;
    st.key = key;
    const bow = polygon(st.bow);
    const skew = clamp(st.v * 140, -6, 6);

    parts.forEach(({ s, card, info, tile }, i) => {
      const d = i - st.shown, a = Math.abs(d);
      const near = a < 1.6;
      s.style.visibility = near ? "" : "hidden";
      if (!near) return;
      // The card rolls over the top of a drum: up, tipped back, smaller, blurred.
      card.style.transform = `translate3d(0, ${d * 78}%, 0) perspective(1400px) rotateX(${-d * 28}deg) rotateY(${14 - st.mx * 6}deg) skewY(${skew}deg) scale(${1 - a * 0.12})`;
      card.style.opacity = String(clamp(1 - a * 0.85, 0, 1));
      card.style.filter = a > 0.02 ? `blur(${(a * 9).toFixed(1)}px)` : "none";
      card.style.clipPath = bow;
      // The middle column only shows its own path, rising through a blur.
      const ia = clamp(1 - a * 2.4, 0, 1);
      info.style.opacity = String(ia);
      info.style.transform = `translate3d(0, ${d * 70}px, 0)`;
      info.style.filter = ia < 0.99 ? `blur(${((1 - ia) * 10).toFixed(1)}px)` : "none";
      // The tile passes the other way and tumbles, leaning to the pointer.
      tile.style.transform = `translate3d(${st.mx * 14}px, ${-d * 120 + st.my * 10}%, 0) perspective(700px) rotateX(${d * 50 - st.my * 12}deg) rotateY(${st.mx * 18}deg) rotateZ(${d * -24}deg)`;
      tile.style.opacity = String(clamp(1 - a * 1.2, 0, 1));
      tile.style.setProperty("--sheen", `${50 + st.mx * 30 + d * 60}%`);
    });
    // Depth inside the card: the tree sits a little behind its frame and
    // drifts against the pointer; the glare follows the pointer over the glass.
    const cur = parts[Math.round(st.shown)];
    if (cur) {
      cur.tree.style.transform = `translate3d(${-st.mx * 10}px, ${-st.my * 6}px, 0)`;
      cur.card.style.setProperty("--gx", `${50 + st.mx * 40}%`);
      cur.card.style.setProperty("--gy", `${30 + st.my * 30}%`);
    }
    // The rail along the bottom fills to where you are, its tick for the path lighting up.
    railFill.style.transform = `scaleX(${(st.shown / (n - 1)).toFixed(4)})`;

    const on = Math.round(st.shown);
    if (on !== st.on) {
      st.on = on;
      parts.forEach(({ s, link }, i) => {
        s.classList.toggle("on", i === on);
        s.setAttribute("aria-hidden", String(i !== on));
        link.tabIndex = i === on ? 0 : -1;
      });
      railDots.forEach((d, i) => d.classList.toggle("on", i === on));
      arrive(parts[on]);
    }
    settle(time);
  }

  // Bowed edges as a clip-path polygon (percent of the card).
  function polygon(b) {
    if (b < 0.05) return "none";
    const top = [], bot = [];
    for (let k = 0; k <= 16; k++) {
      const x = k / 16, y = b * Math.sin(Math.PI * x);
      top.push(`${(x * 100).toFixed(2)}% ${y.toFixed(2)}%`);
      bot.unshift(`${(x * 100).toFixed(2)}% ${(100 - y).toFixed(2)}%`);
    }
    return `polygon(${top.concat(bot).join(",")})`;
  }

  // When scrolling stops between two paths, glide to the nearer one.
  let lastMove = 0, lastP = 0;
  function settle(time) {
    if (Math.abs(st.p - lastP) > 0.001) { lastP = st.p; lastMove = time; return; }
    const off = st.p - Math.round(st.p);
    if (time - lastMove < 0.22 || Math.abs(off) < 0.02 || st.p <= 0 || st.p >= n - 1) return;
    lastMove = Infinity;                                    // once per stop
    const lenis = smoothScroll();
    const r = root.getBoundingClientRect();
    const run = Math.max(1, r.height - innerHeight);
    const y = scrollY + r.top + (Math.round(st.p) / (n - 1)) * run;
    if (lenis) lenis.scrollTo(y, { duration: 0.7, easing: (t) => 1 - Math.pow(1 - t, 3) });
    else scrollTo({ top: y, behavior: "smooth" });
  }

  // A path arriving: its tree grows (trunk, then branches tier by tier, then
  // its flowers and buds pop open), the name's letters rise in one by one,
  // the tags pop and a light sweeps across the glass. Once per arrival.
  let lastArrived = null;
  function arrive(part) {
    if (!part || part === lastArrived) return;
    lastArrived = part;
    const { card, info, wood, marks } = part;
    const H = card.querySelector(".mini-tree")?.viewBox.baseVal.height || 200;
    wood.forEach((w) => {
      const y = w.getBBox().y + w.getBBox().height;           // branches nearer the ground grow first
      const dashed = w.classList.contains("planned");         // dashed ones (not tracked yet) fade in instead
      w.animate(dashed ? [{ opacity: 0 }, { opacity: 1 }] : [{ strokeDasharray: "1 1", strokeDashoffset: 1 }, { strokeDasharray: "1 1", strokeDashoffset: 0 }],
        { duration: 520, delay: (1 - y / H) * 520, easing: "cubic-bezier(.3,.6,.3,1)", fill: "backwards" });
    });
    marks.forEach(({ g, y }) => g.animate(
      [{ transform: "scale(0) rotate(-40deg)", opacity: 0 }, { transform: "scale(1.25) rotate(6deg)", opacity: 1, offset: .7 }, { transform: "none", opacity: 1 }],
      { duration: 460, delay: 300 + (1 - y / H) * 560, easing: "cubic-bezier(.3,.7,.4,1)", fill: "backwards" }));
    info.querySelectorAll(".pc-ch").forEach((c, k) => c.animate(
      [{ transform: "translateY(.7em) rotateX(-80deg)", opacity: 0, filter: "blur(6px)" }, { transform: "none", opacity: 1, filter: "blur(0)" }],
      { duration: 560, delay: 60 + k * 38, easing: "cubic-bezier(.22,.61,.36,1)", fill: "backwards" }));
    info.querySelectorAll(".pc-tags span").forEach((t, k) => t.animate(
      [{ transform: "translateY(10px) scale(.8)", opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 380, delay: 260 + k * 70, easing: "cubic-bezier(.34,1.5,.5,1)", fill: "backwards" }));
    card.querySelector(".pc-glare")?.animate(
      [{ backgroundPosition: "-60% 0" }, { backgroundPosition: "160% 0" }],
      { duration: 900, delay: 120, easing: "cubic-bezier(.5,0,.3,1)", pseudoElement: "::before" });
  }

  G.ticker.add(frame);
  root.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    st.tmx = (e.clientX / innerWidth) * 2 - 1;
    st.tmy = (e.clientY / innerHeight) * 2 - 1;
  });
  root.addEventListener("pointerleave", () => { st.tmx = 0; st.tmy = 0; });
}
