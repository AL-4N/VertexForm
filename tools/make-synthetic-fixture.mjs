/**
 * make-synthetic-fixture.mjs — writes tests/fixtures/synthetic-*.json from the
 * simulator, in the exact format the ?debug recorder saves. They keep the
 * replay harness tested until real recordings exist; real clips are what
 * matter (RECORDING_GUIDE.md).   node tools/make-synthetic-fixture.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { repStream, holdStream, W, H } from "../tests/helpers/synth.mjs";
import { Recorder } from "../public/js/recording.js";

const out = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "tests", "fixtures");
const save = (name, exercise, stream, expect) => {
  const rec = new Recorder({ exercise, aspect: W / H, camera: "simulator", model: "synthetic" });
  for (const f of stream) rec.add(f.t, f.lms, f.world ?? null);
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(rec.toJSON()));
  fs.writeFileSync(path.join(out, `${name}.expect.json`), JSON.stringify(expect, null, 2) + "\n");
  console.log(name, rec.frames.length, "frames");
};
save("synthetic-squat-good-5", "Squat", repStream("squat", { depth: -8, lean: 5 }, { depth: 100, lean: 25 }, { world: { noiseXY: 0.01, noiseZ: 0.03 } }), { reps: 5, minScore: 90, clean: true });
save("synthetic-squat-half-5", "Squat", repStream("squat", { depth: -8, lean: 5 }, { depth: 55, lean: 20 }), { reps: 5, maxScore: 80, faults: ["depth"] });
save("synthetic-plank-30s", "Plank", holdStream("plank", { hips: 0 }, { seconds: 30 }), { seconds: 30, minScore: 90 });
