/**
 * repclips.test.mjs — rep replays (js/repclips.js): frames pack small and
 * come back accurately, clips are cut around real reps, the replay reads
 * the right angle, and unsaved clips are deleted on time (saved ones never).
 * Run with:  npm test
 */
import {
  JOINTS, SIDE, KEEP_DAYS, MAX_UNSAVED, packFrame, RepBuffer, makeClip, framePoints,
  nearSide, keyAngle, deepestFrame, clipBounds, daysLeft, expiredIds, bestAndWorst,
} from "../public/js/repclips.js";
import { Session } from "../public/js/session.js";
import { getExercise } from "../public/js/exercises/index.js";
import { repStream, W, H } from "./helpers/synth.mjs";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(60)} ${detail}`);
};
const DAY = 86400000;

/** 33 landmarks, all at (0.5, 0.5), with some set explicitly. */
function lms(set = {}, vis = 1) {
  const out = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: vis }));
  for (const [i, p] of Object.entries(set)) out[i] = { ...out[i], ...p };
  return out;
}

/* ── Packing ──────────────────────────────────────────── */
const f = packFrame(lms({ 25: { x: 0.123456, y: 0.987654, visibility: 0.42 } }));
const clip1 = makeClip([0, 1, 2, 3].map((i) => ({ t: 1000 + i * 33, ...f })), { id: "a", exercise: "Squat", aspect: 1, mirror: false, score: 90, index: 1, date: new Date().toISOString() });
const knee = framePoints(clip1, 0)[JOINTS.indexOf(25)];
check("A frame keeps only the 15 skeleton joints", f.xy.length === 30 && f.vis.length === 15);
check("Positions come back within 0.0001", Math.abs(knee.x - 0.123456) < 1e-4 && Math.abs(knee.y - 0.987654) < 1e-4, `${knee.x.toFixed(5)}, ${knee.y.toFixed(5)}`);
check("Visibility comes back within 1%", Math.abs(knee.v - 0.42) < 0.01);
check("No pose: no frame", packFrame(null) === null);
check("Clip times start at 0", clip1.t[0] === 0 && Math.round(clip1.t[3]) === 99);
check("Too few frames: no clip", makeClip([{ t: 0, ...f }], {}) === null);
const mirrored = framePoints({ ...clip1, mirror: true, aspect: 2 }, 0)[JOINTS.indexOf(25)];
check("Mirrored + aspect-scaled like the live view", Math.abs(mirrored.x - (1 - 0.123456) * 2) < 2e-4, mirrored.x.toFixed(4));

/* ── Buffer ───────────────────────────────────────────── */
const buf = new RepBuffer(2);
for (let t = 0; t <= 5000; t += 100) buf.push(t, t === 3000 ? null : lms());
check("Buffer keeps only the last few seconds", buf.frames[0].t === 3000 - 0 || buf.frames[0].t >= 3000, `${buf.frames[0].t}..${buf.frames.at(-1).t}`);
check("Frames without a pose are skipped", !buf.frames.some((x) => x.t === 3000));
check("slice() cuts by time", buf.slice(4000, 4500).length === 6);

/* ── Angles ───────────────────────────────────────────── */
// Left side clearly visible, right side faint: hip (0.4, 0.5), knee (0.5, 0.5), ankle (0.5, 0.6) → 90°.
// Moving the hip down (bigger y) closes the knee.
const squatAt = (hipY, ankleX = 0.5) => lms({
  23: { x: 0.4, y: hipY }, 25: { x: 0.5, y: 0.5 }, 27: { x: ankleX, y: 0.6 }, 11: { x: 0.4, y: 0.3 },
  24: { visibility: 0.1 }, 26: { visibility: 0.1 }, 28: { visibility: 0.1 }, 12: { visibility: 0.1 },
});
const sq = makeClip([0.5, 0.55, 0.5, 0.45].map((hy, i) => ({ t: i * 33, ...packFrame(squatAt(hy)) })), { id: "s", exercise: "Squat", aspect: 1, mirror: false });
const slanted = makeClip([0, 1, 2, 3].map((i) => ({ t: i * 33, ...packFrame(squatAt(0.5, 0.6)) })), { id: "sl", exercise: "Squat", aspect: 1, mirror: false });
check("Near side = the one the camera sees best", nearSide(sq) === "L");
const a0 = keyAngle(sq, 0);
check("Squat reads the knee angle", Math.abs(a0.deg - 90) < 0.5 && a0.at[1] === SIDE.L.kn, `${a0.deg.toFixed(1)}°`);
const square = keyAngle(slanted, 0).deg, wide = keyAngle({ ...slanted, aspect: W / H }, 0).deg;
check("Angles use the aspect ratio (a 16:9 frame isn't squashed)", Math.abs(square - 135) < 0.5 && Math.abs(wide - 150.7) < 0.5, `${square.toFixed(1)}° square, ${wide.toFixed(1)}° at 16:9`);
check("Deepest frame = smallest knee angle", deepestFrame(sq) === 1, `frame ${deepestFrame(sq)}`);
const b = clipBounds(sq);
check("Bounds cover the visible joints", Math.abs(b.x0 - 0.4) < 1e-3 && Math.abs(b.y0 - 0.3) < 1e-3 && Math.abs(b.y1 - 0.6) < 1e-3, `${b.x0.toFixed(3)}..${b.x1.toFixed(3)}, ${b.y0.toFixed(3)}..${b.y1.toFixed(3)}`);

/* ── Clips from a real session (as js/ui/live.js cuts them) ── */
{
  const s = new Session(getExercise("Squat"), { mode: "set", target: 90, goal: 1, setReps: 5 });
  const rb = new RepBuffer(14), clips = [];
  for (const fr of repStream("squat", { depth: -8, lean: 5 }, { depth: 100, lean: 25 })) {
    const out = s.update(fr.lms, W / H, fr.t, fr.world ?? null);
    rb.push(fr.t, out.display);
    for (const e of out.events) if (e.type === "rep") {
      const c = makeClip(rb.slice(e.at - e.duration * 1000 - 200, e.at + 100), { id: `t-${e.index}`, exercise: "Squat", index: e.index, score: e.score, aspect: W / H, mirror: false, date: new Date().toISOString() });
      if (c) clips.push({ c, e });
    }
    if (s.done) break;
  }
  check("Every rep becomes a clip", clips.length === s.reps.length && clips.length >= 3, `${clips.length} clips, ${s.reps.length} reps`);
  const lens = clips.map(({ c, e }) => c.t[c.n - 1] / 1000 - e.duration);
  check("Each clip spans its rep (plus a little either side)", lens.every((d) => d > -0.05 && d < 0.45), lens.map((d) => d.toFixed(2)).join(" "));
  const deep = clips.map(({ c }) => keyAngle(c, deepestFrame(c)).deg);
  check("The replay's deepest knee angle is a real squat bottom", deep.every((d) => d > 50 && d < 115), deep.map((d) => d.toFixed(0)).join(" "));
  const bytes = clips.reduce((n, { c }) => n + c.xy.byteLength + c.vis.byteLength + c.t.byteLength, 0) / clips.length;
  check("A rep's clip is small (under 12 KB)", bytes < 12 * 1024, `${(bytes / 1024).toFixed(1)} KB`);
}

/* ── Keeping and deleting ─────────────────────────────── */
const now = Date.parse("2026-10-08T12:00:00Z");
const at = (days) => new Date(now - days * DAY).toISOString();
const mk = (id, days, saved = false, index = 1) => ({ id, date: at(days), saved, index });
check(`Unsaved: deleted after ${KEEP_DAYS} days`, JSON.stringify(expiredIds([mk("new", 1), mk("old", 7.5), mk("edge", 6.9)], now)) === '["old"]');
check("Saved: never deleted, however old", expiredIds([mk("keep", 400, true)], now).length === 0);
const many = Array.from({ length: MAX_UNSAVED + 5 }, (_, i) => mk(`u${i}`, i * 0.01, false, 1));
const cut = expiredIds(many, now);
check(`Only the newest ${MAX_UNSAVED} unsaved are kept`, cut.length === 5 && cut.includes(`u${MAX_UNSAVED + 4}`) && !cut.includes("u0"));
check("Days left counts down; saved has none", daysLeft(mk("x", 0), now) === KEEP_DAYS && daysLeft(mk("y", 6.5), now) === 1 && daysLeft(mk("z", 9), now) === 0 && daysLeft(mk("s", 1, true), now) === null);

const bw = bestAndWorst([{ score: 80 }, { score: 95 }, { score: 70 }]);
check("Best and worst rep of a set", bw.best === 1 && bw.worst === 2);
check("All the same score: no 'worst'", bestAndWorst([{ score: 90 }, { score: 90 }]).worst === null);

console.log(`\n${fail ? `${fail} replay check(s) FAILED` : "All replay checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
