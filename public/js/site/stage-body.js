/**
 * stage-body.js — the figure on the homepage's 3D stage (stage.js): the
 * stick figure drawn in light (figures/glow.js), at the two places where
 * the page leaves room beside the text:
 *
 *   Questions   its bones draw out as the section arrives, then scrolling
 *               through the section scrubs one squat: your scroll is its
 *               knees, a tag on the knee reads the angle, and the camera
 *               walks round it. It fades as the section leaves.
 *   Closing     beside "Try it on your next set" it draws out again and
 *               raises its arms in a jumping jack as you reach the end of
 *               the page, finishing at the top of the jack, in green.
 *
 * The reps are the real clips the engine scored (data/rep3d.json). Its
 * colour comes from the measured angle on the grade scale: coral at the
 * start of the rep, green at full depth, as the exercise cards do on hover.
 * It stands in the empty space beside the section's text and travels with
 * the section (centred on it, sized to fit inside it), so it never overlaps
 * the sections around it; measured when the layout changes. With too little
 * room (or under 1280 px) there's nothing. Reduced motion: each station
 * shows the bottom of its rep, still.
 */

import { useStage } from "./stage.js";
import { loadClips, frameAt, angle3, clamp, smooth } from "../figures/scene3d.js";
import { GlowStick } from "../figures/glow.js";
import { gradeColor } from "../grade.js";
import { reducedMotion } from "../ui/motion.js";

const DEG = Math.PI / 180;
// p is the section's scroll progress: 0 as its top comes up from the bottom
// of the screen, 1 as its bottom leaves the top (scroll-progress.js).
const STATIONS = [
  { key: "faq", beside: ".faq", clip: "full", drawIn: [0.08, 0.3], rep: [0.3, 0.8], fadeOut: [0.84, 0.97], yaw: [24, 112], fill: 0.58 },
  // Half a jack: the page ends with the arms up, in green.
  { key: "close", beside: ".cta-band h2", clip: "jack", drawIn: [0.05, 0.24], rep: [0.22, 0.6], half: true, fadeOut: null, yaw: [-8, 22], fill: 0.72 },
];
const MIN_ROOM = 250;    // px beside the text, or the station stays empty

export async function mountStageBody() {
  const wide = matchMedia("(min-width: 1280px)");
  if (!wide.matches) return;
  const reduced = reducedMotion();
  let clips;
  try { clips = await loadClips(); } catch { return; }

  const tag = document.createElement("div");
  tag.className = "stage-tag";
  tag.setAttribute("aria-hidden", "true");
  document.body.append(tag);

  await useStage(({ THREE, scene, camera, canvas }) => {
    const root = new THREE.Group();
    scene.add(root);
    // A protractor ring on the floor, a tick every 10° (longer every 30°).
    const ring = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2, b = ((i + 1) / 96) * Math.PI * 2;
      ring.push(Math.cos(a) * 0.72, 0.002, Math.sin(a) * 0.72, Math.cos(b) * 0.72, 0.002, Math.sin(b) * 0.72);
    }
    for (let d = 0; d < 360; d += 10) {
      const a = d * DEG, r0 = d % 30 ? 0.68 : 0.63;
      ring.push(Math.cos(a) * r0, 0.002, Math.sin(a) * r0, Math.cos(a) * 0.72, 0.002, Math.sin(a) * 0.72);
    }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute("position", new THREE.Float32BufferAttribute(ring, 3));
    const ringMat = new THREE.LineBasicMaterial({ color: 0x2e3a63, transparent: true, opacity: 0 });
    const ringMesh = new THREE.LineSegments(ringGeo, ringMat);
    root.add(ringMesh);
    const figure = new GlowStick(THREE);
    root.add(figure.object);

    // Each clip's rep window, the range its measured angle moves through, and where its hips are.
    const prep = Object.fromEntries(STATIONS.map((s) => {
      const clip = clips[s.clip];
      const [t0, t1] = [clip.reps[0].t, clip.reps[1].t];
      const joints = clip.measure.joints(clip.side);
      const samples = Array.from({ length: 40 }, (_, i) => { const P = frameAt(clip, t0 + ((t1 - t0) * i) / 39); return { a: angle3(...joints.map((k) => P[k])), P }; });
      const start = samples[0].a;
      const peak = samples.reduce((m, x, i) => (Math.abs(x.a - start) > Math.abs(samples[m].a - start) ? i : m), 0);
      const hips = samples.map(({ P }) => [(P.hipL[0] + P.hipR[0]) / 2, (P.hipL[2] + P.hipR[2]) / 2]);
      const centre = [hips.reduce((a, h) => a + h[0], 0) / hips.length, hips.reduce((a, h) => a + h[1], 0) / hips.length];
      return [s.key, { clip, t0, t1: s.half ? t0 + ((t1 - t0) * peak) / 39 : t1, joints, start, far: samples[peak].a, centre }];
    }));

    // Where each station's free space is: beside its text, in the stage's own pixels.
    let room = {}, version = -1, c = canvas.getBoundingClientRect();
    const measureRoom = () => {
      c = canvas.getBoundingClientRect();
      room = Object.fromEntries(STATIONS.map((s) => {
        const el = document.querySelector(s.beside);
        if (!el) return [s.key, null];
        const right = textRight(el) - c.left;
        const free = c.width - right;
        return [s.key, free >= MIN_ROOM ? { at: (right + free / 2) / c.width } : null];
      }));
    };
    const v3 = new THREE.Vector3();
    let tagW = 0, lastClip = null;

    return (s) => {
      if (s.version !== version) { version = s.version; measureRoom(); }
      const st = wide.matches ? STATIONS.find((x) => room[x.key] && s.sections[x.key] && s.sections[x.key].progress > 0 && s.sections[x.key].progress < 1) : null;
      root.visible = !!st;
      // Written once per frame: the stage redraws every frame for the
      // atmosphere, and a 0 then a 1 in one frame restarted the tag's fade.
      let showTag = false;
      const done = () => { const o = showTag ? "1" : "0"; if (tag.style.opacity !== o) tag.style.opacity = o; return false; };
      if (!st) return done();

      const p = s.sections[st.key].progress;
      const { clip, t0, t1, joints, start, far, centre } = prep[st.key];
      if (clip !== lastClip) { lastClip = clip; figure.resetTrails(); }
      const k = reduced ? 0.5 : clamp((p - st.rep[0]) / (st.rep[1] - st.rep[0]), 0, 1);
      const P = frameAt(clip, t0 + (t1 - t0) * k);
      const angle = angle3(...joints.map((j) => P[j]));
      const depth = clamp((angle - start) / ((far - start) || 1), 0, 1);
      const grow = reduced ? 1 : smooth(st.drawIn[0], st.drawIn[1], p);
      const fade = reduced || !st.fadeOut ? 1 : 1 - smooth(st.fadeOut[0], st.fadeOut[1], p);
      ringMat.opacity = 0.9 * grow * fade;
      ringMesh.position.set(centre[0], 0, centre[1]);

      // The camera walks round the front of the figure, far enough back that
      // it fills `fill` of its section's height (at most 62% of the screen);
      // the view is then slid so it stands in the free space, centred on the
      // section as it scrolls past.
      const w = c.width, h = c.height;                    // measured with the page, not every frame
      const sec = s.sections[st.key];
      const top = Math.max(...Object.values(P).map((q) => q[1])) + 0.12, bottom = -0.08;
      const px = Math.min(sec.height * st.fill, h * 0.62);
      const dist = (top - bottom + 0.2) / (2 * Math.tan((camera.fov / 2) * DEG) * (px / h));
      const target = [centre[0], (top + bottom) / 2, centre[1]];
      const yaw = (st.yaw[0] + (st.yaw[1] - st.yaw[0]) * p) * DEG, pitch = 9 * DEG;
      camera.position.set(target[0] - Math.sin(yaw) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(...target);
      const centreY = sec.top - s.y + sec.height / 2;    // the section's middle, on screen
      camera.setViewOffset(w, h, w * (0.5 - room[st.key].at), h / 2 - centreY, w, h);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      figure.update(P, gradeColor(depth * 100), camera, { grow, fade });

      // The angle tag rides the measured joint once the figure is whole.
      if (grow >= 1 && fade >= 1) {
        v3.set(...P[joints[1]]).project(camera);
        tag.textContent = `${clip.measure.label.toUpperCase()} ${Math.round(angle)}°`;
        tagW ||= tag.offsetWidth;                           // tabular digits: the width barely changes
        const jx = c.left + ((v3.x + 1) / 2) * c.width;
        const x = jx + 18 + tagW > c.right - 8 ? jx - 18 - tagW : jx + 18;   // flip to the left near the edge
        tag.style.transform = `translate(${x.toFixed(1)}px, ${((1 - v3.y) / 2 * c.height - 12).toFixed(1)}px)`;
        showTag = true;
      }
      return done();
    };
  });
}

/** The right edge of an element's text (headings split into full-width
 *  line boxes by the reveal still end where their words end). */
function textRight(el) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let right = -Infinity;
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) right = Math.max(right, r.right);
  }
  return right === -Infinity ? el.getBoundingClientRect().right : right;
}
