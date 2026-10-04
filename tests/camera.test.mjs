/**
 * camera.test.mjs — which camera the trainer tries first (js/pose.js).
 *
 * Checks the camera "kind" guesses from device names, and the order cameras
 * are tried in: your pick, then real cameras (built-in first), with virtual
 * cameras left out unless picked. Run with:  npm test
 */
import { cameraKind, cameraOrder, cameraErrorMessage, frameStats, isPermissionError } from "../public/js/pose.js";

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(46)} ${ok ? "" : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log("Camera kinds (from device names)");
t("FaceTime HD Camera is built-in",        cameraKind("FaceTime HD Camera"), "builtin");
t("MacBook Air Camera (Built-in)",         cameraKind("MacBook Air Camera (Built-in)"), "builtin");
t("USB webcam is external",                cameraKind("Anker PowerConf C200"), "external");
t("Camo is virtual",                       cameraKind("Camo Camera"), "virtual");
t("OBS Virtual Camera is virtual",         cameraKind("OBS Virtual Camera"), "virtual");
t("Snap Camera is virtual",                cameraKind("Snap Camera"), "virtual");
t("Continuity Camera iPhone is a phone",   cameraKind("Sam’s iPhone Camera"), "phone");
t("Desk View is a phone",                  cameraKind("Desk View Camera"), "phone");
t("No name yet is external",               cameraKind(""), "external");

const cam = (id, label) => ({ id, label });
const ids = (list) => list.map((c) => c.id);
const camo = cam("camo", "Camo Camera"), anker = cam("anker", "Anker PowerConf C200");
const obs = cam("obs", "OBS Virtual Camera"), facetime = cam("ft", "FaceTime HD Camera");
const phone = cam("phone", "iPhone Camera");

console.log("\nOrder cameras are tried in");
t("Virtual listed first: real camera wins",   ids(cameraOrder([camo, anker])), ["anker"]);
t("Built-in before USB before iPhone",        ids(cameraOrder([phone, anker, obs, facetime])), ["ft", "anker", "phone"]);
t("Your pick comes first",                    ids(cameraOrder([facetime, anker], "anker")), ["anker", "ft"]);
t("A virtual camera you picked is used",      ids(cameraOrder([obs, anker], "obs")), ["obs", "anker"]);
t("Saved camera gone: falls back",            ids(cameraOrder([camo, anker], "unplugged")), ["anker"]);
t("Only virtual cameras: try them anyway",    ids(cameraOrder([camo, obs])), ["camo", "obs"]);
t("A camera that just failed goes last",      ids(cameraOrder([facetime, anker], null, "ft")), ["anker", "ft"]);
t("No cameras: empty list",                   ids(cameraOrder([])), []);
t("Doesn't change the list it was given",     (cameraOrder([camo, anker]), ids([camo, anker])), ["camo", "anker"]);

t("Streamlabs is virtual",                 cameraKind("Streamlabs Desktop Virtual Webcam"), "virtual");
t("Elgato Virtual Camera is virtual",      cameraKind("Elgato Virtual Camera"), "virtual");
t("Opera GX list: built-in still first",   ids(cameraOrder([cam("v", "OBS Virtual Camera"), cam("e", "Elgato Virtual Camera"), facetime])), ["ft"]);

console.log("\nError messages");
const msg = (name) => cameraErrorMessage({ name });
t("Busy camera mentions other tabs",       /other tabs of this site/.test(msg("NotReadableError")), true);
t("Busy camera mentions sidebar apps",     /sidebar/.test(msg("NotReadableError")), true);
t("Dead camera: 'pick another'",           /isn't sending video — pick another/.test(msg("NoVideo")), true);
t("Still picture explained",               /still picture/.test(msg("StillImage")), true);
t("Blocked access is a permission error",  isPermissionError({ name: "NotAllowedError" }), true);
t("Busy camera is not a permission error", isPermissionError({ name: "NotReadableError" }), false);

console.log("\nFrame checks (dead, dark, frozen)");
const frame = (rgb, n = 32 * 18) => { const a = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) a.set([...rgb(i), 255], i * 4); return a; };
t("All-black frame is black",              frameStats(frame(() => [2, 1, 3])).black, true);
t("Dim room is not 'black'",               frameStats(frame((i) => [10 + (i % 7), 12, 9])).black, false);
t("Brightness: mid-grey ≈ 128",            Math.round(frameStats(frame(() => [128, 128, 128])).luma), 128);
t("Same picture, same fingerprint",        frameStats(frame((i) => [i % 255, 40, 90])).hash === frameStats(frame((i) => [i % 255, 40, 90])).hash, true);
t("One pixel of noise changes it",         frameStats(frame((i) => [i % 255, 40, 90])).hash === frameStats(frame((i) => [i === 100 ? 1 : i % 255, 40, 90])).hash, false);

console.log(fail ? `\n${fail} camera check(s) FAILED` : `\nAll camera checks pass (${pass} passed)`);
process.exit(fail ? 1 : 0);
