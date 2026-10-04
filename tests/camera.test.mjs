/**
 * camera.test.mjs — which camera the trainer tries first (js/pose.js).
 *
 * Checks the camera "kind" guesses from device names, and the order cameras
 * are tried in: your pick, then real cameras (built-in first), with virtual
 * cameras left out unless picked. Run with:  npm test
 */
import {
  cameraKind, cameraOrder, camerasToTry, cameraErrorMessage, frameStats, isPermissionError, constraintLadder, getCameraStream,
} from "../public/js/pose.js";

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
t("Built-in before USB; iPhone/virtual skipped", ids(cameraOrder([phone, anker, obs, facetime])), ["ft", "anker"]);
t("Only an iPhone camera: used anyway",    ids(cameraOrder([phone])), ["phone"]);
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
t("Dead camera: says so, Try again or pick", /isn't sending any video.*Try again.*pick another/.test(msg("NoVideo")), true);
t("Black picture: privacy-cover hint",     msg("BlackPicture"), "Camera shows a black picture. If it has a privacy cover, slide it open.");
t("Still picture explained",               /still picture/.test(msg("StillImage")), true);
t("Blocked access is a permission error",  isPermissionError({ name: "NotAllowedError" }), true);
t("Busy camera is not a permission error", isPermissionError({ name: "NotReadableError" }), false);

console.log("\nFrame checks (dead, dark, frozen)");
const frame = (rgb, n = 32 * 18) => { const a = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) a.set([...rgb(i), 255], i * 4); return a; };
t("All-black frame is black",              frameStats(frame(() => [2, 1, 3])).black, true);
t("Dim room is not 'black'",               frameStats(frame((i) => [10 + (i % 7), 12, 9])).black, false);
t("Very dark (low light) is not 'black'",  frameStats(frame((i) => [3 + (i % 4), 4, 3])).black, false);
t("Covered lens (near-zero noise) is black", frameStats(frame((i) => [i % 3, 0, 1])).black, true);
t("Brightness: mid-grey ≈ 128",            Math.round(frameStats(frame(() => [128, 128, 128])).luma), 128);
t("Same picture, same fingerprint",        frameStats(frame((i) => [i % 255, 40, 90])).hash === frameStats(frame((i) => [i % 255, 40, 90])).hash, true);
t("One pixel of noise changes it",         frameStats(frame((i) => [i % 255, 40, 90])).hash === frameStats(frame((i) => [i === 100 ? 1 : i % 255, 40, 90])).hash, false);

console.log("\nReal USB webcams (the Anker PowerConf C200 bug)");
const elgato = cam("eg", "Elgato Facecam"), cont = cam("cc", "Continuity Camera");
t("Anker PowerConf C200 is a real camera",  cameraKind("Anker PowerConf C200"), "external");
t("Elgato Facecam is a real camera",        cameraKind("Elgato Facecam"), "external");
t("Razer / Logitech webcams are real",      [cameraKind("Razer Kiyo Pro"), cameraKind("Logitech BRIO")].join(), "external,external");
t("No built-in camera: Anker goes first",   ids(cameraOrder([obs, cont, anker])), ["anker"]);
t("You picked Anker: ONLY Anker is tried",  JSON.stringify(camerasToTry([facetime, anker], { pickedId: "anker" })), JSON.stringify({ order: [{ ...anker, kind: "external" }], explicit: true }));
t("Saved pick (Anker) wins over built-in",  ids(camerasToTry([facetime, anker], { savedId: "anker" }).order), ["anker"]);
t("Picked a virtual camera: it's used",     ids(camerasToTry([facetime, obs], { pickedId: "obs" }).order), ["obs"]);
t("No pick: automatic order, not explicit", camerasToTry([anker, facetime]).explicit, false);
t("Saved pick unplugged: automatic order",  ids(camerasToTry([facetime], { savedId: "anker" }).order), ["ft"]);

console.log("\nConstraints");
const ladder = constraintLadder("dev1");
const exacts = JSON.stringify(ladder).match(/"exact"/g)?.length ?? 0;
t("Ladder: 720p30 → 640×480 → device only", ladder.map((c) => Object.keys(c).sort().join("+")).join(" | "), "deviceId+frameRate+height+width | deviceId+height+width | deviceId");
t("Only deviceId is ever exact",            exacts === 3 && ladder.every((c) => c.deviceId.exact === "dev1" && !c.width?.exact && !c.height?.exact && !c.frameRate?.exact), true);
t("Size and frame rate are 'ideal'",        ladder[0].width.ideal === 1280 && ladder[0].frameRate.ideal === 30 && ladder[1].width.ideal === 640, true);
t("No device id: front camera by facing",   constraintLadder(null, "user")[2].facingMode, "user");

const mkErr = (name) => { const e = new Error(name); e.name = name; return e; };
const tries = async (errors) => {
  const seen = [];
  const gum = async (c) => { seen.push(c.video); const e = errors[seen.length - 1]; if (e) throw mkErr(e); return { id: "stream" }; };
  try { await getCameraStream("dev1", { gum }); return `ok after ${seen.length}`; }
  catch (e) { return `${e.name} after ${seen.length}`; }
};
t("OverconstrainedError: tries 640×480",    await tries(["OverconstrainedError"]), "ok after 2");
t("NotReadableError twice: device only",    await tries(["NotReadableError", "NotReadableError"]), "ok after 3");
t("Fails all 3: reports the last error",    await tries(["OverconstrainedError", "NotReadableError", "NotReadableError"]), "NotReadableError after 3");
t("Permission denied: no retries",          await tries(["NotAllowedError"]), "NotAllowedError after 1");

console.log(fail ? `\n${fail} camera check(s) FAILED` : `\nAll camera checks pass (${pass} passed)`);
process.exit(fail ? 1 : 0);
