/**
 * story.js — "How it works" as a pinned scene: the section holds still
 * while you scroll, and scrolling walks one 3D squat through the four
 * steps, with the camera moving round the figure as it goes.
 *
 *   1. It finds you        only the tracked points, seen from the webcam
 *   2. It measures angles  the bones join up; a protractor at the knee,
 *                          measured in 3D, next to what a flat picture reads
 *   3. It grades the rep   the engine's score floods in as the grade colour
 *   4. It tells you        the coach's note is penned in beside the hip
 *
 * The clip keeps playing while you read; scroll only moves through the
 * steps and the camera. Progress is eased, so a flick of the wheel glides.
 * The step text changes with a vertical motion-blur slide.
 *
 * Reduced motion (or no JavaScript): the four-card list in index.html
 * stays as it is and none of this runs.
 */

import { gradeColor, gradeLetter } from "../grade.js";
import { slide, EASE, reducedMotion } from "../ui/motion.js";
import { Scene, loadClips, frameAt, mixColor, clamp, smooth } from "../figures/scene3d.js";

const PAPER = "#eef1fb";
// Camera at the middle of each step: [yaw, pitch].
const SHOTS = [[0, 5], [40, 14], [68, 22], [22, 10]];

export async function mountStory(section) {
  const story = section.querySelector("[data-story]");
  if (!story || reducedMotion()) return;
  let clips;
  try { clips = await loadClips(); } catch { return; }
  const clip = clips.full;

  section.classList.add("has-story");
  story.hidden = false;
  const canvas = story.querySelector(".story-canvas");
  const steps = [...story.querySelectorAll("[data-step]")];
  const fill = story.querySelector(".story-fill");
  const chip = story.querySelector("[data-chip]");
  const scene = new Scene(canvas, { target: [0, 0.72, 0], zoom: 1.32, maxDpr: 1.5 });
  const wide = () => matchMedia("(min-width: 900px)").matches;

  const st = { p: 0, shown: 0, t: 0, last: 0, raf: 0, visible: false, step: -1 };
  const score = clip.reps[0].score;

  function progress() {
    const r = story.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
  }

  function shot(c) {
    // Ease between the shots, which sit at the middle of each step.
    const x = clamp(c - 0.5, 0, 3);
    const i = Math.min(2, Math.floor(x)), k = smooth(0, 1, x - i);
    const a = SHOTS[i], b = SHOTS[i + 1];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }

  /*
   * Changing step, so you can't miss it (GSAP + SplitText when loaded):
   * the old step's words fly up out of their line masks one after another
   * while the new step's rise in from below (the other way when scrolling
   * back), the big outlined step number rolls over like an odometer, the
   * fact chip flips to its new fact, and the step lights up on the meter.
   * Without GSAP: a plain slide.
   */
  const { gsap: G, SplitText: Split } = window;
  const big = story.querySelector(".story-big");
  const marks = [...story.querySelectorAll("[data-goto]")];
  const words = Split && G ? steps.map((s) => Split.create(s.querySelectorAll(".story-n, h3, p"), { type: "lines,words", mask: "lines" }).words) : null;
  if (words) {
    story.classList.add("fx");
    words.forEach((w) => G.set(w, { yPercent: 115, opacity: 0 }));
  }
  function setStep(i) {
    if (i === st.step) return;
    const prev = st.step, down = i > prev;
    st.step = i;
    steps.forEach((s, k) => { s.classList.toggle("on", k === i); s.setAttribute("aria-hidden", String(k !== i)); });
    marks.forEach((m, k) => m.classList.toggle("on", k === i));
    if (!words) {
      slide(steps[i], { from: [0, down ? 40 : -40], to: [0, 0], opacity: [0, 1], duration: 520, ease: EASE.out, strength: 0.9 });
      return;
    }
    const dir = down ? 1 : -1;
    if (prev >= 0) {
      G.killTweensOf(words[prev]);
      G.to(words[prev], { yPercent: -115 * dir, opacity: 0, filter: "blur(4px)", duration: 0.42, ease: "power3.in", stagger: 0.012 });
    }
    G.killTweensOf(words[i]);
    G.fromTo(words[i], { yPercent: 115 * dir, opacity: 0, filter: "blur(6px)" },
      { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 0.8, ease: "expo.out", stagger: 0.022, delay: prev >= 0 ? 0.2 : 0 });
    // The big number rolls: the old one flies off, the new one comes up behind it.
    if (big) {
      const old = big.firstElementChild;
      const n = document.createElement("span");
      n.textContent = String(i + 1).padStart(2, "0");
      big.appendChild(n);
      G.fromTo(n, { yPercent: 100 * dir, filter: "blur(8px)" }, { yPercent: 0, filter: "blur(0px)", duration: 0.85, ease: "expo.out", delay: 0.1 });
      if (old) G.to(old, { yPercent: -100 * dir, filter: "blur(8px)", opacity: 0, duration: 0.5, ease: "power3.in", onComplete: () => old.remove() });
    }
    G.fromTo(chip, { rotateX: -90 * dir, opacity: 0 }, { rotateX: 0, opacity: 1, duration: 0.55, ease: "back.out(1.7)", delay: 0.3 });
  }

  function draw() {
    if (scene.fit()) { scene.at = wide() ? [0.64, 0.56] : [0.5, 0.4]; scene.zoom = wide() ? 1.32 : 2.0; }
    const c = st.shown * 4;
    const [yaw, pitch] = shot(c);
    const cam = scene.camera(yaw, pitch);
    const P = frameAt(clip, st.t);

    const pts = smooth(0.05, 0.6, c);
    const grow = smooth(0.95, 1.4, c);
    const flood = smooth(2.0, 2.35, c);
    const marks = smooth(1.25, 1.5, c) * (1 - smooth(2.85, 3.05, c));
    const write = smooth(3.1, 3.6, c);
    const colour = mixColor(PAPER, gradeColor(score), flood);

    scene.begin();
    scene.floorCached(cam, { size: 9, alpha: +(0.6 + 0.4 * smooth(0.6, 1.2, c)).toFixed(2) });
    if (grow < 1) scene.points(cam, P, pts * (1 - grow));
    scene.figure(cam, P, colour, { grow, dots: grow, shadow: grow > 0 });
    const [a, b, k] = ["hipL", "knL", "anL"].map((x) => P[x.replace("L", clip.side)]);
    const a3 = scene.angle(cam, a, b, k, { alpha: marks });
    const flat = scene.flatAngle(cam, a, b, k);
    if (write > 0) scene.note(cam, P["hip" + clip.side], "Thighs about parallel", { write, side: 1 });

    // The fact under each step.
    const i = Math.min(3, Math.floor(c));
    setStep(i);
    const facts = [
      `33 POINTS TRACKED · ${Object.keys(P).length} DRAWN HERE`,
      `KNEE IN 3D ${Math.round(a3)}° · IN THE PICTURE ${Math.round(flat)}°`,
      `REP SCORED ${score} ${gradeLetter(score)} BY THE ENGINE`,
      `SPOKEN AFTER THE REP, NEVER DURING IT`,
    ];
    if (chip.textContent !== facts[i]) chip.textContent = facts[i];
    chip.style.setProperty("--c", i === 2 ? gradeColor(score) : "");
    fill.style.transform = `scaleY(${st.shown})`;
  }

  function tick(now) {
    st.raf = 0;
    const dt = st.last ? Math.min(50, now - st.last) : 16;
    st.last = now;
    st.t = (st.t + dt) % clip.dur;
    if (!trigger) st.p = progress();
    st.shown += (st.p - st.shown) * (1 - Math.pow(0.0005, dt / 1000));
    draw();
    if (st.visible) st.raf = requestAnimationFrame(tick);
    else st.last = 0;
  }
  // With GSAP, ScrollTrigger tracks how far through the story you are (it
  // also hears Lenis's smoothed scrolling); without it, measure it here.
  const { ScrollTrigger } = window;
  const trigger = ScrollTrigger?.create({ trigger: story, start: "top top", end: "bottom bottom", onUpdate: (s) => { st.p = s.progress; } }) ?? null;

  new IntersectionObserver(([e]) => {
    st.visible = e.isIntersecting;
    if (st.visible && !st.raf) st.raf = requestAnimationFrame(tick);
  }).observe(story);

  // Clicking a step on the meter scrolls to it.
  story.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => {
    const r = story.getBoundingClientRect();
    const span = r.height - innerHeight;
    scrollTo({ top: scrollY + r.top + span * ((Number(b.dataset.goto) + 0.5) / 4), behavior: "smooth" });
  }));

  st.shown = st.p = progress();
  draw();
}
