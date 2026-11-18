/**
 * stage-placeholder.js — what the homepage shows with ?stage: a stand-in
 * shape on the 3D stage (stage.js) where the model will go, three drafting
 * rings at different depths, and a readout of the scroll numbers the stage
 * gets (scroll-progress.js). For building the 3D; never on the page
 * without ?stage.
 *
 * The stand-in moves the way a model could: it sits beside the content,
 * swapping sides from one section to the next, turns with the overall
 * progress, tips with the progress through the section under the middle
 * of the screen, and grows as that section's middle passes. The rings
 * drift at different speeds as you scroll: near ones faster than far ones.
 * It eases toward where the scroll puts it (reduced motion: no easing).
 */

import { useStage } from "./stage.js";
import { onScroll, sectionAt } from "./scroll-progress.js";

const inMain = (b) => b.el.parentElement?.tagName === "MAIN";

/** Where the stand-in should be for scroll state s, in screen widths/heights. */
function pose(s, aspect) {
  const here = sectionAt(s, 0.5, inMain);
  const mains = s.list.filter(inMain);
  const k = here ? mains.indexOf(here) : 0;
  const p = here?.progress ?? 0;
  const narrow = aspect < 0.9;                     // phones: centred behind the text, smaller
  return {
    x: narrow ? 0 : (k % 2 ? -0.31 : 0.31),        // a share of the screen width from the centre
    s: (narrow ? 0.65 : 1) * (0.85 + 0.3 * Math.sin(p * Math.PI)),
    ry: s.overall * Math.PI * 4,
    rx: p * Math.PI * 0.5,
  };
}

export async function mountStagePlaceholder() {
  const hud = document.createElement("pre");
  hud.className = "scroll-stage-hud";
  hud.setAttribute("aria-hidden", "true");
  document.body.append(hud);
  onScroll((s) => {
    const here = sectionAt(s, 0.5, inMain);
    hud.textContent = [
      "STAGE (?stage)",
      `overall   ${s.overall.toFixed(3)}`,
      `section   ${here ? here.key : "-"}`,
      `progress  ${here ? here.progress.toFixed(3) : "-"}`,
      `inside    ${here ? here.inside.toFixed(3) : "-"}`,
      `velocity  ${Math.round(s.velocity)} px/s`,
    ].join("\n");
  });

  const c = await useStage(({ THREE, scene, camera, reduced }) => {
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.98, 1), new THREE.MeshBasicMaterial({ color: 0x0d1326 })));
    model.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 1)),
      new THREE.LineBasicMaterial({ color: 0xc6ef4e, transparent: true, opacity: 0.75 })));
    scene.add(model);

    const ring = (radius) => new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => {
        const a = (i / 96) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      })),
      new THREE.LineBasicMaterial({ color: 0x2e3a63 }));
    const rings = [[1.6, -1.5, 1], [2.6, -5, 2.2], [3.8, -11, 4.5]].map(([radius, z, depth]) => {
      const r = ring(radius);
      r.position.z = z;
      r.rotation.x = -1.15;                         // tipped back like a circle on the floor
      scene.add(r);
      return { r, depth };
    });

    const cur = { x: 0, s: 1, ry: 0, rx: 0 };
    let first = true;
    return (s, dt) => {
      const halfW = Math.tan((camera.fov / 2) * (Math.PI / 180)) * camera.position.z * camera.aspect;
      const want = pose(s, camera.aspect);
      const k = reduced || first ? 1 : 1 - Math.exp(-dt * 5);
      first = false;
      let moving = false;
      for (const key in want) {
        cur[key] += (want[key] - cur[key]) * k;
        if (Math.abs(want[key] - cur[key]) > 1e-3) moving = true; else cur[key] = want[key];
      }
      model.position.set(cur.x * 2 * halfW, 0, 0);
      model.scale.setScalar(cur.s);
      model.rotation.set(cur.rx, cur.ry, 0);
      for (const { r, depth } of rings) r.position.y = -1.6 + (s.overall - 0.5) * (9 / depth);
      return moving;
    };
  });

  // No WebGL: a soft disc stands in, moving the same way (transform only).
  if (!c) {
    const disc = document.createElement("div");
    disc.className = "scroll-stage-fallback";
    disc.setAttribute("aria-hidden", "true");
    document.body.prepend(disc);
    onScroll((s) => {
      const p = pose(s, innerWidth / innerHeight);
      disc.style.transform = `translate(${(p.x * innerWidth).toFixed(1)}px, 0) scale(${p.s.toFixed(3)})`;
    });
  }
}
