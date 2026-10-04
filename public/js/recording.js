/**
 * recording.js — the ?debug landmark recorder's file format (pure, tested).
 *
 * A recording is the RAW pose stream exactly as MediaPipe gave it (before
 * any smoothing), so replaying it through session.js exercises the whole
 * engine. Numbers are rounded to 4 decimals and points stored as arrays,
 * which keeps a 30-second clip around 1 MB.
 *
 * {
 *   format: "vertexform-recording", version: 1,
 *   exercise: "Squat", aspect: 1.7778, recordedAt: ISO date, camera, model,
 *   frames: [ { t: ms since start, lms: [[x,y,z,vis] × 33] | null, world: [[x,y,z,vis] × 33] | null } ]
 * }
 */

export const FORMAT = "vertexform-recording";
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const pack = (pts) => (pts ? pts.map((p) => [r4(p.x), r4(p.y), r4(p.z ?? 0), r4(p.visibility ?? 1)]) : null);
const unpack = (arr) => (arr ? arr.map(([x, y, z, visibility]) => ({ x, y, z, visibility })) : null);

export class Recorder {
  constructor(meta) {
    this.meta = meta;          // { exercise, aspect, camera, model }
    this.frames = [];
    this.t0 = null;
  }

  add(t, lms, world) {
    this.t0 ??= t;
    this.frames.push({ t: Math.round((t - this.t0) * 10) / 10, lms: pack(lms), world: pack(world) });
  }

  get seconds() { return this.frames.length ? this.frames.at(-1).t / 1000 : 0; }

  toJSON() {
    return { format: FORMAT, version: 1, recordedAt: new Date().toISOString(), ...this.meta, aspect: r4(this.meta.aspect), frames: this.frames };
  }
}

/** Parse a recording back into frames the Session understands. */
export function readRecording(data) {
  if (data?.format !== FORMAT) throw new Error("Not a VertexForm recording");
  return {
    exercise: data.exercise,
    aspect: data.aspect,
    frames: data.frames.map((f) => ({ t: f.t, lms: unpack(f.lms), world: unpack(f.world) })),
  };
}
