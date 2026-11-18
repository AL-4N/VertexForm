/**
 * scroll.test.mjs — the homepage's scroll numbers (public/js/site/scroll-progress.js):
 * overall progress, each section's progress and inside values, and which
 * section sits under a line on the screen. Pure arithmetic, no browser.
 */
import { computeScroll, sectionAt } from "../public/js/site/scroll-progress.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} ${detail}`); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// A page 5000 px tall on an 800 px screen: hero, a pinned 2400 px scene, a short section.
const boxes = [
  { key: "hero", top: 0, height: 900 },
  { key: "how", top: 900, height: 2400 },
  { key: "faq", top: 3300, height: 1700 },
];
const at = (y) => computeScroll(y, 800, 5000, boxes);

check("Overall is 0 at the top", at(0).overall === 0);
check("Overall is 1 at the bottom", at(4200).overall === 1);
check("Overall is halfway at half the scroll", near(at(2100).overall, 0.5));
check("Overall stays in 0..1 past the ends", at(-50).overall === 0 && at(9999).overall === 1);
check("Overall is 0 on a page shorter than the screen", computeScroll(0, 800, 600, boxes).overall === 0);

// progress: 0 as the top comes up from the bottom of the screen, 1 as the bottom leaves the top.
check("Section progress 0 as it enters at the bottom", at(100).sections.how.progress === 0);           // its top at y+vh
check("Section progress 1 as it leaves at the top", at(3300).sections.how.progress === 1);              // its bottom at y
check("Section progress halfway when its middle is mid-screen", near(at(1700).sections.how.progress, 0.5));
// inside: 0 as its top reaches the top of the screen, 1 as its bottom reaches the bottom.
check("Pinned inside 0 when its top meets the screen top", at(900).sections.how.inside === 0);
check("Pinned inside 1 when its bottom meets the screen bottom", at(2500).sections.how.inside === 1);
check("Pinned inside halfway through its run", near(at(1700).sections.how.inside, 0.5));
check("Visible only while on screen", at(200).sections.how.visible && !at(0).sections.how.visible && !at(3400).sections.how.visible && at(3299).sections.how.visible);

check("Section under the middle of the screen", sectionAt(at(0), 0.5).key === "hero" && sectionAt(at(600), 0.5).key === "how");
check("Section under a line 40% down", sectionAt(at(3000), 0.4).key === "faq");
check("No section under a line past the page", sectionAt(computeScroll(0, 800, 5000, [{ key: "a", top: 1000, height: 100 }]), 0.5) === null);
check("sectionAt can skip boxes", sectionAt(at(1000), 0.5, (b) => b.key !== "how") === null);
check("Boxes keep their page order and index", at(0).list.map((b) => b.index).join() === "0,1,2");

console.log(`\n${fail ? `${fail} scroll check(s) FAILED` : "All scroll checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
