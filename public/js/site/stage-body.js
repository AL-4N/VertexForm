/**
 * stage-body.js — the mannequin on the homepage's 3D stage (stage.js), at
 * the two places where the page leaves room beside the text:
 *
 *   Questions   it scans in (a band of light passing down it) as the
 *               section arrives, then scrolling through the section scrubs
 *               one squat: your scroll is its knees, a tag on the knee
 *               reads the angle, and the camera walks round it. It scans
 *               out from the feet up as the section leaves.
 *   Closing     beside "Try it on your next set" it scans in again and
 *               raises its arms in a jumping jack as you reach the end of
 *               the page, finishing at the top of the jack, in green.
 *
 * The reps are the real clips the engine scored (data/rep3d.json). The body
 * takes its colour from the measured angle on the grade scale: coral at the
 * start of the rep, green at full depth, as the exercise cards do on hover.
 * It stands in the empty space beside the section's text and travels with
 * the section (centred on it, sized to fit inside it), so it never overlaps
 * the sections around it; measured when the layout changes. With too little
 * room (or under 1280 px) there's nothing.
 * Reduced motion: each station shows the bottom of its rep, still.
 */

import { useStage } from "./stage.js";
import { loadClips, frameAt, angle3, clamp, smooth } from "../figures/scene3d.js";
import { loadMannequin } from "../figures/mannequin.js";
import { makeSatin } from "../figures/satin.js";
import { gradeColor } from "../grade.js";
import { reducedMotion } from "../ui/motion.js";

const DEG = Math.PI / 180;
// p is the section's scroll progress: 0 as its top comes up from the bottom
// of the screen, 1 as its bottom leaves the top (scroll-progress.js).
const STATIONS = [
  { key: "faq", beside: ".faq", clip: "full", scanIn: [0.08, 0.3], rep: [0.3, 0.8], scanOut: [0.84, 0.97], yaw: [24, 112], fill: 0.58 },
  // Half a jack: the page ends with the arms up, in green.
  { key: "close", beside: ".cta-band h2", clip: "jack", scanIn: [0.05, 0.24], rep: [0.22, 0.6], half: true, scanOut: null, yaw: [-8, 22], fill: 0.72 },
];
const MIN_ROOM = 250;    // px beside the text, or the station stays empty

export async function mountStageBody() {
  const wide = matchMedia("(min-width: 1280px)");
  if (!wide.matches) return;
  const reduced = reducedMotion();
  let clips;
  try { clips = await loadClips(); } catch { return; }
  const debugStage = new URLSearchParams(location.search).has("stage");

  const tag = document.createElement("div");
  tag.className = "stage-tag";
  tag.setAttribute("aria-hidden", "true");
  document.body.append(tag);

  await useStage(({ THREE, scene, camera, renderer, canvas, request }) => {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const root = new THREE.Group();
    scene.add(root);
    root.add(new THREE.HemisphereLight(0xdfe6ff, 0x0b1125, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);     // nearly overhead: the shadow pools under the feet
    key.position.set(0.8, 6, 1.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -1, near: 0.5, far: 14 });
    key.shadow.radius = 6;
    key.shadow.bias = -0.0005;
    root.add(key, key.target);
    const rim = new THREE.DirectionalLight(0x9fb4ff, 1.4);
    rim.position.set(-3, 2.5, -3.5);
    root.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.ShadowMaterial({ opacity: 0.28 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);
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
    root.add(new THREE.LineSegments(ringGeo, ringMat));

    const satin = makeSatin(THREE);
    const grade = new THREE.Color(), base = new THREE.Color(0x141c36), white = new THREE.Color(0xeef1fb);
    let body = null, fitted = null;
    loadMannequin(THREE).then((kit) => {
      body = kit.make(satin.material);
      body.mesh.castShadow = true;
      root.add(body.object);
      request();
    }).catch(() => {});

    // Each clip's rep window and the range its measured angle moves through.
    const prep = Object.fromEntries(STATIONS.map((s) => {
      const clip = clips[s.clip];
      const [t0, t1] = [clip.reps[0].t, clip.reps[1].t];
      const joints = clip.measure.joints(clip.side);
      const angleAt = (t) => { const P = frameAt(clip, t); return angle3(...joints.map((k) => P[k])); };
      const samples = Array.from({ length: 40 }, (_, i) => angleAt(t0 + ((t1 - t0) * i) / 39));
      const start = samples[0];
      const peak = samples.reduce((m, a, i) => (Math.abs(a - start) > Math.abs(samples[m] - start) ? i : m), 0);
      const far = samples[peak];
      return [s.key, { clip, t0, t1: s.half ? t0 + ((t1 - t0) * peak) / 39 : t1, joints, start, far }];
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
    let tagW = 0;

    return (s) => {
      if (s.version !== version) { version = s.version; measureRoom(); }
      const st = wide.matches && body ? STATIONS.find((x) => room[x.key] && s.sections[x.key] && s.sections[x.key].progress > 0 && s.sections[x.key].progress < 1) : null;
      root.visible = !!st;
      if (!debugStage) canvas.style.visibility = st ? "" : "hidden";
      tag.style.opacity = "0";
      if (!st) return false;

      const p = s.sections[st.key].progress;
      const { clip, t0, t1, joints, start, far } = prep[st.key];
      const k = reduced ? 0.5 : clamp((p - st.rep[0]) / (st.rep[1] - st.rep[0]), 0, 1);
      const P = frameAt(clip, t0 + (t1 - t0) * k);
      if (fitted !== clip) { body.fit(clip.frames); fitted = clip; }
      body.pose(P);

      // Colour from the measured angle: coral at the start of the rep, green at full depth.
      const angle = angle3(...joints.map((j) => P[j]));
      const depth = clamp((angle - start) / ((far - start) || 1), 0, 1);
      grade.set(gradeColor(depth * 100));
      satin.material.color.copy(base).lerp(grade, 0.14);
      satin.material.emissive.copy(grade);
      satin.material.emissiveIntensity = 0.05;
      satin.u.uRim.value.copy(grade);
      satin.u.uRimStrength.value = 1.05;
      rim.color.copy(grade).lerp(white, 0.3);

      // The scan: in from the head down, out from the feet up.
      const top = Math.max(...Object.values(P).map((q) => q[1])) + 0.12, bottom = -0.08;
      const into = reduced ? 1 : smooth(st.scanIn[0], st.scanIn[1], p);
      const out = reduced || !st.scanOut ? 0 : smooth(st.scanOut[0], st.scanOut[1], p);
      satin.u.uScan.value = out > 0 ? bottom + (top - bottom) * out : into >= 1 ? -10 : top - (top - bottom) * into;
      body.mesh.castShadow = into >= 1 && out === 0;
      ringMat.opacity = 0.9 * into * (1 - out);

      // The camera walks round the front of the body, far enough back that
      // the body fills `fill` of its section's height (at most 62% of the
      // screen); the view is then slid so the body sits in the free space,
      // centred on the section as it scrolls past.
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const sec = s.sections[st.key];
      const px = Math.min(sec.height * st.fill, h * 0.62);
      const span = top - bottom + 0.2;
      const dist = span / (2 * Math.tan((camera.fov / 2) * DEG) * (px / h));
      const target = [0, (top + bottom) / 2, 0];
      const yaw = (st.yaw[0] + (st.yaw[1] - st.yaw[0]) * p) * DEG, pitch = 9 * DEG;
      camera.position.set(target[0] - Math.sin(yaw) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(...target);
      const centreY = sec.top - s.y + sec.height / 2;    // the section's middle, on screen
      camera.setViewOffset(w, h, w * (0.5 - room[st.key].at), h / 2 - centreY, w, h);
      camera.updateProjectionMatrix();
      key.target.position.set(...target);
      key.position.set(target[0] + 0.8, 6, target[2] + 1.4);

      // The angle tag rides the measured joint once the body is whole.
      if (into >= 1 && out === 0) {
        body.joint(jointBone(joints[1], clip.side), v3).project(camera);
        const r = c;
        tag.textContent = `${clip.measure.label.toUpperCase()} ${Math.round(angle)}°`;
        tagW ||= tag.offsetWidth;                           // tabular digits: the width barely changes
        const jx = r.left + ((v3.x + 1) / 2) * r.width;
        const x = jx + 18 + tagW > r.right - 8 ? jx - 18 - tagW : jx + 18;   // flip to the left near the edge
        tag.style.transform = `translate(${x.toFixed(1)}px, ${((1 - v3.y) / 2 * r.height - 12).toFixed(1)}px)`;
        tag.style.opacity = "1";
      }
      return false;
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

/** The mannequin bone whose head is the tracked joint k ("knL", "shR"…). */
function jointBone(k, side) {
  const s = k.slice(-1).toLowerCase();
  const map = { kn: "calf_", sh: "upperarm_", el: "lowerarm_", hip: "thigh_", an: "foot_", wr: "hand_" };
  return (map[k.slice(0, -1)] ?? "calf_") + (s === "l" || s === "r" ? s : side.toLowerCase());
}
