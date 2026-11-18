"""
export-mannequin.py — write the mannequin body (art/mannequin.blend) to
public/models/mannequin.bin for the homepage (js/figures/mannequin.js).

Run inside Blender, from the repo root:
  ~/Applications/Blender.app/Contents/MacOS/Blender --background art/mannequin.blend --python tools/export-mannequin.py

The body is MakeHuman's CC0 base mesh (MPFB 2.0.18), face blanked, with
MPFB's "game engine" skeleton (finger bones folded into the hands). The
file is a small custom format rather than glTF, so the site needs no
loader library (and nothing from a CDN):

  "VFM1", uint32 header length, JSON header (padded to 4 bytes), then:
    position   int16 x3, quantized to the box in header.bounds
    index      uint16 x3 per triangle
    skinIndex  uint8 x4 (bone numbers)
    skinWeight uint8 x4 (sum 255)

Coordinates are converted to Three.js's: y up, the body facing +z, its
left side toward +x, feet on y = 0, metres. Each bone has its parent, head
and tail (rest pose) and its rest orientation as a quaternion.
"""

import bpy, json, os, struct
from mathutils import Matrix

OUT = os.path.join(os.path.dirname(bpy.data.filepath), "..", "public", "models", "mannequin.bin")
body = bpy.data.objects["VF_Body"]
rig = bpy.data.objects["VF_Rig"]

# Blender (x right, y back, z up; the body faces -y) to Three.js (x, z, -y).
C = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))
def v3(p):
    q = C @ p
    return [q.x, q.y, q.z]

# Bones, parents before children (Blender lists them that way).
bones = list(rig.data.bones)
index = {b.name: i for i, b in enumerate(bones)}
bone_out = []
for b in bones:
    m = rig.matrix_world @ b.matrix_local
    rot = (C @ m.to_3x3() @ C.transposed()).to_quaternion()
    bone_out.append({
        "name": b.name,
        "parent": index[b.parent.name] if b.parent else -1,
        "head": v3(rig.matrix_world @ b.head_local),
        "tail": v3(rig.matrix_world @ b.tail_local),
        "quat": [rot.x, rot.y, rot.z, rot.w],            # Three.js order
    })

me = body.data
me.calc_loop_triangles()
mw = body.matrix_world
P = [v3(mw @ v.co) for v in me.vertices]
lo = [min(p[k] for p in P) for k in range(3)]
hi = [max(p[k] for p in P) for k in range(3)]
q = lambda x, k: max(-32768, min(32767, round((x - lo[k]) / (hi[k] - lo[k]) * 65535) - 32768))

# Skin: the four strongest bone weights per vertex, normalised, to bytes.
group_bone = {g.index: index[g.name] for g in body.vertex_groups if g.name in index}
skin_i, skin_w = bytearray(), bytearray()
for v in me.vertices:
    ws = sorted(((e.weight, group_bone[e.group]) for e in v.groups if e.group in group_bone and e.weight > 0), reverse=True)[:4]
    total = sum(w for w, _ in ws) or 1
    b8 = [round(w / total * 255) for w, _ in ws]
    if b8: b8[0] += 255 - sum(b8)                         # exact sum of 255
    ws += [(0, 0)] * (4 - len(ws)); b8 += [0] * (4 - len(b8))
    skin_i += bytes(i for _, i in ws); skin_w += bytes(b8)

pos = b"".join(struct.pack("<3h", *(q(p[k], k) for k in range(3))) for p in P)
tris = b"".join(struct.pack("<3H", *t.vertices) for t in me.loop_triangles)

def pad4(b): return b + b"\0" * (-len(b) % 4)
blobs, offset, buffers = [], 0, {}
for name, data in (("position", pos), ("index", tris), ("skinIndex", bytes(skin_i)), ("skinWeight", bytes(skin_w))):
    data = pad4(data)
    buffers[name] = {"offset": offset, "length": len(data)}
    blobs.append(data); offset += len(data)

header = json.dumps({
    "version": 1, "source": "MakeHuman base mesh (CC0) via MPFB 2.0.18, art/mannequin.blend",
    "vertices": len(P), "triangles": len(me.loop_triangles),
    "bounds": {"min": lo, "max": hi}, "bones": bone_out, "buffers": buffers,
}, separators=(",", ":")).encode()
header += b" " * (-len(header) % 4)                      # pad with spaces: still valid JSON
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "wb") as f:
    f.write(b"VFM1" + struct.pack("<I", len(header)) + header + b"".join(blobs))
print(f"mannequin.bin: {len(P)} vertices, {len(me.loop_triangles)} triangles, {len(bones)} bones, {os.path.getsize(OUT) // 1024} KB")
