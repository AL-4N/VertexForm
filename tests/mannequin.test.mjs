/**
 * mannequin.test.mjs — the homepage's 3D body (public/js/figures/mannequin.js,
 * public/models/mannequin.bin from tools/export-mannequin.py) follows the
 * engine's clips: posed on frames of every clip in data/rep3d.json, each
 * arm and leg bone points along its tracked segment, the feet end on the
 * clip's floor, and nothing comes out NaN.
 */
import fs from "node:fs";
import path from "node:path";
import * as THREE from "../public/vendor/three/three.module.min.js";
import { unpackMannequin } from "../public/js/figures/mannequin.js";
import { prepareClips, frameAt } from "../public/js/figures/scene3d.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} ${detail}`); };
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public");
const bin = fs.readFileSync(path.join(ROOT, "models", "mannequin.bin"));
const kit = unpackMannequin(THREE, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const body = kit.make(new THREE.MeshBasicMaterial());
check("mannequin.bin unpacks: 23 bones, a skinned mesh", body.bones.length === 23 && body.mesh.isSkinnedMesh, `${body.bones.length} bones`);
check("The file stays small (under 400 KB)", bin.length < 400 * 1024, `${Math.round(bin.length / 1024)} KB`);

const clips = prepareClips(JSON.parse(fs.readFileSync(path.join(ROOT, "data", "rep3d.json"), "utf8")));
const SEGMENTS = [["upperarm", "lowerarm", "sh", "el"], ["lowerarm", "hand", "el", "wr"], ["thigh", "calf", "hip", "kn"], ["calf", "foot", "kn", "an"]];
const v = (p) => new THREE.Vector3(...p);
for (const [id, clip] of Object.entries(clips)) {
  body.fit(clip.frames);
  let worst = 0, floorErr = 0, nan = false;
  for (let k = 0; k < 12; k++) {
    const P = frameAt(clip, (clip.dur * k) / 12);
    body.pose(P);
    for (const [a, b, ja, jb] of SEGMENTS) for (const s of ["l", "r"]) {
      const S = s.toUpperCase();
      const got = body.joint(`${b}_${s}`).sub(body.joint(`${a}_${s}`)).normalize();
      const want = v(P[jb + S]).sub(v(P[ja + S])).normalize();
      const deg = (Math.acos(Math.min(1, Math.max(-1, got.dot(want)))) * 180) / Math.PI;
      if (Number.isNaN(deg)) nan = true;
      worst = Math.max(worst, deg);
    }
    // The lowest of the ankles, balls and toe tips against the clip's lowest heel or toe.
    const feet = ["foot_l", "ball_l", "foot_r", "ball_r"].map((n) => body.joint(n).y);
    const floorP = Math.min(...["heL", "heR", "toL", "toR"].map((j) => P[j][1]));
    floorErr = Math.max(floorErr, Math.min(...feet) - floorP);
  }
  check(`${id}: every limb bone points along its tracked segment`, !nan && worst < 3, `worst ${worst.toFixed(2)}°`);
  check(`${id}: the feet stay on the clip's floor`, floorErr < 0.08 && floorErr > -0.01, `${(floorErr * 100).toFixed(1)} cm`);
}

console.log(`\n${fail ? `${fail} mannequin check(s) FAILED` : "All mannequin checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
