/**
 * make-privacy.mjs — writes public/privacy.html:   node tools/make-privacy.mjs
 *
 * What VertexForm does with your camera and your data, in plain words. Every
 * line is checked against the code: storage.js (localStorage), replay-store.js
 * (IndexedDB), pose.js (where the model comes from), stats.js (Reset all),
 * the audio voice pack. tests/privacy.test.mjs fails if the page is stale.
 */
import fs from "node:fs";
import path from "node:path";
import { shell } from "./page-shell.mjs";
import { CDN } from "../public/js/pose.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "privacy.html");
const host = (u) => new URL(u).host;

const SECTIONS = [
  ["Your camera", [
    "The pose model runs in your browser. It looks at each frame, finds 33 points on your body, and the frame is gone: nothing is recorded, saved or sent anywhere.",
    "The camera is on only while you're training, and Back turns it off at once.",
  ]],
  ["What's kept, and where", [
    "Your settings, saved sets (scores and the faults flagged), bests, skills, routines and challenges are kept in this browser's local storage.",
    "Rep replays are skeleton points, not video, kept in this browser's IndexedDB. Unsaved ones are deleted 7 days after the set; saved ones stay until you delete them.",
    "Nothing is kept on a server. There's no account, so there's nothing to sign in to or recover on another device.",
  ]],
  ["What your browser downloads", [
    "The site itself, from Cloudflare, which hosts it.",
    `The pose model, the first time you train: its code from ${host(CDN)} and the model file from storage.googleapis.com. Like any download, those servers see an ordinary request from your browser. The trainer then keeps a copy, so later visits work offline.`,
    "The coach's voice clips, from this site, as each line is first played.",
  ]],
  ["What isn't here", [
    "No analytics, no tracking scripts, no cookies, no ads.",
    "No uploads of any kind: not video, not photos, not your scores.",
  ]],
  ["Taking your data with you, or erasing it", [
    "History, then Export CSV, saves every set as a spreadsheet.",
    "History, then Reset all, erases everything VertexForm has kept in this browser, saved replays included. Clearing this site's data in your browser's settings does the same.",
  ]],
];

export function render() {
  const body = `  <section class="section legal" data-tone="dark">
    <div class="wrap">
      <div class="section-head">
        <span class="tag tag-live">Privacy</span>
        <h1>Your video stays <span class="dim">on your device.</span></h1>
        <p>What VertexForm does with your camera and your data, in plain words. If anything here ever stops being true, this page changes first.</p>
      </div>
${SECTIONS.map(([h, items]) => `      <section class="legal-part">
        <h2>${h}</h2>
        <ul>${items.map((t) => `<li>${t}</li>`).join("")}</ul>
      </section>`).join("\n")}
    </div>
  </section>`;
  return shell({
    generator: "tools/make-privacy.mjs",
    title: "Privacy: VertexForm",
    description: "VertexForm runs its pose model in your browser: no video is recorded or uploaded, and your scores stay in this browser. No accounts, analytics or cookies.",
    active: "privacy.html",
    body,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  fs.writeFileSync(OUT, render());
  console.log("privacy.html written");
}
