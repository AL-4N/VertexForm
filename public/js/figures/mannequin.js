/**
 * mannequin.js — the body the homepage's 3D draws (the hero, the stage):
 * MakeHuman's CC0 base mesh with its face blanked and a 23-bone skeleton,
 * from art/mannequin.blend (tools/export-mannequin.py writes
 * public/models/mannequin.bin; the format is described there).
 *
 *   const kit = await loadMannequin(THREE);
 *   const body = kit.make(material);      // a THREE.Group holding a SkinnedMesh
 *   body.fit(frames);                     // size it to a clip (scene3d.js frames)
 *   body.pose(P);                         // aim the bones at one frame of tracked points
 *   body.joint("lowerarm_l")              // where a joint is now (world space)
 *
 * Posing works from directions only, so it fits any clip: the hips and the
 * shoulders give the torso (the twist between them spread up the spine),
 * each arm and leg is aimed along its tracked segment and bends about the
 * hinge of the plane it moves in (so knees and elbows fold the right way,
 * and a straight limb keeps the twist it had), and the head looks along
 * the nose. The feet are then set on the clip's floor.
 */

let loading = null;

/** Fetch and unpack mannequin.bin once. Resolves to a kit with make(material). */
export function loadMannequin(THREE, url = new URL("../../models/mannequin.bin", import.meta.url)) {
  loading ??= fetch(url).then((r) => {
    if (!r.ok) throw new Error(`mannequin.bin: ${r.status}`);
    return r.arrayBuffer();
  }).then((buf) => unpackMannequin(THREE, buf));
  return loading;
}

/** Unpack mannequin.bin's bytes (tests/mannequin.test.mjs reads the file directly). */
export function unpackMannequin(THREE, buf) {
  const dv = new DataView(buf);
  if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== "VFM1") throw new Error("mannequin.bin: not a VFM1 file");
  const hlen = dv.getUint32(4, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hlen)).replace(/\0+$/, ""));
  const base = 8 + hlen;
  const view = (name, Type) => {
    const b = head.buffers[name];
    return new Type(buf, base + b.offset, b.length / Type.BYTES_PER_ELEMENT);
  };
  const { min, max } = head.bounds;
  const q = view("position", Int16Array);
  const pos = new Float32Array(head.vertices * 3);
  for (let i = 0; i < pos.length; i++) {
    const k = i % 3;
    pos[i] = min[k] + ((q[i] + 32768) / 65535) * (max[k] - min[k]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setIndex(new THREE.BufferAttribute(view("index", Uint16Array).slice(0, head.triangles * 3), 1));
  geometry.setAttribute("skinIndex", new THREE.Uint8BufferAttribute(view("skinIndex", Uint8Array).slice(0, head.vertices * 4), 4));
  geometry.setAttribute("skinWeight", new THREE.Uint8BufferAttribute(view("skinWeight", Uint8Array).slice(0, head.vertices * 4), 4, true));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const rest = head.bones.map((b) => ({
    name: b.name, parent: b.parent,
    head: new THREE.Vector3(...b.head), tail: new THREE.Vector3(...b.tail),
    quat: new THREE.Quaternion(...b.quat),
  }));
  return { make: (material) => new Mannequin(THREE, geometry, rest, material) };
}

class Mannequin {
  constructor(THREE, geometry, rest, material) {
    const T = (this.T = THREE);
    this.rest = rest;
    this.id = Object.fromEntries(rest.map((b, i) => [b.name, i]));
    this.group = new T.Group();
    this.mesh = new T.SkinnedMesh(geometry, material);
    this.mesh.frustumCulled = false;                       // skinned: its rest bounds don't follow the pose
    this.bones = rest.map((b) => Object.assign(new T.Bone(), { name: b.name }));
    const world = rest.map((b) => new T.Matrix4().compose(b.head, b.quat, new T.Vector3(1, 1, 1)));
    rest.forEach((b, i) => {
      const local = b.parent < 0 ? world[i].clone() : world[b.parent].clone().invert().multiply(world[i]);
      local.decompose(this.bones[i].position, this.bones[i].quaternion, new T.Vector3());
      (b.parent < 0 ? this.mesh : this.bones[b.parent]).add(this.bones[i]);
    });
    this.group.add(this.mesh);
    this.group.updateMatrixWorld(true);
    this.mesh.bind(new T.Skeleton(this.bones));

    // Rest-pose directions and frames the posing measures against.
    const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
    const r = (n) => rest[this.id[n]];
    const dir = (n) => r(n).tail.clone().sub(r(n).head).normalize();
    this.restDir = Object.fromEntries(rest.map((b) => [b.name, b.tail.clone().sub(b.head).normalize()]));
    const hipsMid = r("thigh_l").head.clone().add(r("thigh_r").head).multiplyScalar(0.5);
    const shMid = r("upperarm_l").head.clone().add(r("upperarm_r").head).multiplyScalar(0.5);
    const up = shMid.clone().sub(hipsMid).normalize();
    this.restHips = frame(T, r("thigh_l").head.clone().sub(r("thigh_r").head), up);
    this.restChest = frame(T, r("upperarm_l").head.clone().sub(r("upperarm_r").head), up);
    this.restHead = frame(T, V(1, 0, 0), dir("head"), V(0, 0, 1));
    this.hipsMidRest = hipsMid;
    const fwd = V(0, 0, 1);
    // Hinges: knees fold the shin back, elbows fold the forearm forward.
    this.hingeRest = {
      l_leg: dir("thigh_l").cross(fwd.clone().negate()).normalize(), r_leg: dir("thigh_r").cross(fwd.clone().negate()).normalize(),
      l_arm: dir("upperarm_l").cross(fwd).normalize(), r_arm: dir("upperarm_r").cross(fwd).normalize(),
    };
    this.legLen = r("thigh_l").head.distanceTo(r("calf_l").head) + r("calf_l").head.distanceTo(r("foot_l").head);
    this.scale = 1;
    this.Q = rest.map(() => new T.Quaternion());           // posed world rotations, reused
    this.tmp = { a: V(), b: V(), c: V(), m: new T.Matrix4(), q: new T.Quaternion(), q2: new T.Quaternion() };
  }

  get object() { return this.group; }

  /** Size the body to a clip: its legs as long as the clip's (median over the frames). */
  fit(frames) {
    const T = this.T;
    const len = frames.map((P) => ["L", "R"].map((s) => new T.Vector3(...P["hip" + s]).distanceTo(new T.Vector3(...P["kn" + s]))
      + new T.Vector3(...P["kn" + s]).distanceTo(new T.Vector3(...P["an" + s]))).reduce((a, b) => a + b) / 2).sort((a, b) => a - b);
    this.scale = (len[len.length >> 1] || this.legLen) / this.legLen;
    this.group.scale.setScalar(this.scale);
  }

  /** Where joint (a bone's head) is now, in world space. */
  joint(name, out = new this.T.Vector3()) {
    return this.bones[this.id[name]].getWorldPosition(out);
  }

  /** Aim the skeleton at P (scene space points, metres, y up, feet on y = 0). */
  pose(P) {
    const T = this.T, { a, b, c } = this.tmp;
    const v = (k) => new T.Vector3(...P[k]);
    const id = this.id, R = this.rest, Q = this.Q;
    const hipL = v("hipL"), hipR = v("hipR"), shL = v("shL"), shR = v("shR");
    const hipMid = hipL.clone().add(hipR).multiplyScalar(0.5), shMid = shL.clone().add(shR).multiplyScalar(0.5);
    const up = shMid.clone().sub(hipMid);

    // Torso: hips from the hip line, chest from the shoulder line, both
    // standing along hips→shoulders; the spine shares the twist.
    const dHips = delta(T, this.restHips, frame(T, hipL.clone().sub(hipR), up));
    const dChest = delta(T, this.restChest, frame(T, shL.clone().sub(shR), up));
    const set = (name, d) => Q[id[name]].copy(d).multiply(R[id[name]].quat);
    Q[id.Root].copy(R[id.Root].quat);
    set("pelvis", dHips);
    set("spine_01", dHips.clone().slerp(dChest, 0.33));
    set("spine_02", dHips.clone().slerp(dChest, 0.66));
    set("spine_03", dChest);
    set("clavicle_l", dChest); set("clavicle_r", dChest);

    // Neck toward the head; the head looks along the nose.
    const ears = v("earL").add(v("earR")).multiplyScalar(0.5);
    const headC = ears.clone().add(v("nose").sub(ears).multiplyScalar(0.3));
    const dNeck = swing(T, dChest, this.restDir.neck_01, headC.clone().sub(shMid));
    set("neck_01", dNeck);
    const look = v("nose").sub(ears);
    set("head", delta(T, this.restHead, frame(T, a.copy(headC).sub(shMid).cross(look), headC.clone().sub(shMid), look)));

    // Limbs: aimed segment by segment, bending about their own plane's hinge.
    const limb = (upper, lower, end, p0, p1, p2, parentDelta, hinge) => {
      const dA = p1.clone().sub(p0).normalize(), dB = p2.clone().sub(p1).normalize();
      const carried = hinge.clone().applyQuaternion(parentDelta);
      const n = dA.clone().cross(dB);
      n.addScaledVector(carried.sub(a.copy(dA).multiplyScalar(carried.dot(dA))), 0.15);   // straight limb: keep the carried twist
      const dU = delta(T, frame(T, hinge, this.restDir[upper]), frame(T, n, dA));
      const dL = delta(T, frame(T, hinge, this.restDir[lower]), frame(T, n, dB));
      set(upper, dU); set(lower, dL); set(end, dL);
      return dL;
    };
    for (const s of ["l", "r"]) {
      const S = s.toUpperCase();
      limb(`upperarm_${s}`, `lowerarm_${s}`, `hand_${s}`, v("sh" + S), v("el" + S), v("wr" + S), dChest, this.hingeRest[`${s}_arm`]);
      const dCalf = limb(`thigh_${s}`, `calf_${s}`, `foot_${s}`, v("hip" + S), v("kn" + S), v("an" + S), dHips, this.hingeRest[`${s}_leg`]);
      const dFoot = swing(T, dCalf, this.restDir[`foot_${s}`], v("to" + S).sub(v("an" + S)));
      set(`foot_${s}`, dFoot); set(`ball_${s}`, dFoot);
    }

    // World rotations to each bone's local one (parents come first).
    R.forEach((r, i) => {
      const bone = this.bones[i];
      if (r.parent < 0) bone.quaternion.copy(Q[i]);
      else bone.quaternion.copy(this.tmp.q.copy(Q[r.parent]).invert().multiply(Q[i]));
    });

    // Put the hips on the tracked hips, then the lowest foot on the floor
    // the clip's lowest foot is on (so a jump still leaves the ground).
    const s = this.scale;
    const hipOff = b.copy(this.hipsMidRest).sub(R[id.pelvis].head).applyQuaternion(dHips).add(R[id.pelvis].head).multiplyScalar(s);
    this.group.position.copy(hipMid).sub(hipOff);
    this.group.updateMatrixWorld(true);
    const feet = ["foot_l", "ball_l", "foot_r", "ball_r"].map((n) => this.joint(n, c).y);
    const tips = ["ball_l", "ball_r"].map((n) => {
      const bone = this.bones[id[n]], len = R[id[n]].head.distanceTo(R[id[n]].tail);
      return a.set(0, len, 0).applyMatrix4(bone.matrixWorld).y;
    });
    const floorP = Math.min(...["heL", "heR", "toL", "toR"].map((k) => P[k][1]));
    this.group.position.y += floorP - Math.min(...feet, ...tips);
    this.group.updateMatrixWorld(true);
  }
}

/* ── Rotation helpers ─────────────────────────────────────── */

/** An orthonormal basis (as a rotation matrix) from a side vector x and an
 *  up vector y (made perpendicular), z = x × y. With three args, z is given
 *  and x is rebuilt from y × z. */
function frame(T, x, y, z) {
  const Y = y.clone().normalize();
  let X;
  if (z) X = Y.clone().cross(z).normalize();
  else X = x.clone().sub(Y.clone().multiplyScalar(x.dot(Y))).normalize();
  const Z = X.clone().cross(Y);
  return new T.Matrix4().makeBasis(X, Y, Z);
}

/** The rotation taking basis A to basis B, as a quaternion. */
function delta(T, A, B) {
  const m = B.clone().multiply(A.clone().transpose());
  return new T.Quaternion().setFromRotationMatrix(m);
}

/** parent rotation d, then the shortest turn that points restDir (carried by d) along target. */
function swing(T, d, restDir, target) {
  const carried = restDir.clone().applyQuaternion(d);
  return new T.Quaternion().setFromUnitVectors(carried, target.clone().normalize()).multiply(d);
}
