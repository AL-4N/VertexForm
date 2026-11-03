/**
 * make-whatsnew.mjs — writes public/whats-new.html from CHANGELOG.md:
 *   node tools/make-whatsnew.mjs
 *
 * One source for the release notes: the changelog. The page shows the
 * releases from 2.2.0 on (the earlier entries are developer notes; they stay
 * in CHANGELOG.md). tests/whatsnew.test.mjs fails if the page is stale.
 */
import fs from "node:fs";
import path from "node:path";
import { shell, esc } from "./page-shell.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "whats-new.html");
const SINCE = [2, 2, 0];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** CHANGELOG.md → [{ version, date, groups: [{ title, items: [text] }] }] */
export function parse(md) {
  const releases = [];
  let rel = null, group = null, item = null;
  for (const line of md.split("\n")) {
    let m;
    if ((m = line.match(/^## (\d+\.\d+\.\d+)(?:\s+\S+\s+(\d{4}-\d{2}-\d{2}))?/))) {
      rel = { version: m[1], date: m[2] ?? null, groups: [] }; releases.push(rel); group = item = null;
    } else if (rel && (m = line.match(/^### (.+)/))) {
      group = { title: m[1].trim(), items: [] }; rel.groups.push(group); item = null;
    } else if (group && (m = line.match(/^- (.+)/))) {
      item = m[1].trim(); group.items.push(item);
    } else if (group && item != null && /^\s{2,}\S/.test(line)) {
      group.items[group.items.length - 1] += " " + line.trim();
    } else if (!line.trim()) item = null;
  }
  return releases;
}

const newer = (v) => { const p = v.split(".").map(Number); for (let i = 0; i < 3; i++) if (p[i] !== SINCE[i]) return p[i] > SINCE[i]; return true; };
const longDate = (d) => { const [y, m, day] = d.split("-").map(Number); return `${day} ${MONTHS[m - 1]} ${y}`; };
// Inline `code` and the changelog's arrows read as plain text on the page.
const inline = (t) => esc(t).replace(/`([^`]+)`/g, "$1").replace(/ → /g, " to ");

export function render() {
  const releases = parse(fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8")).filter((r) => newer(r.version));
  const body = `  <section class="section news" data-tone="dark">
    <div class="wrap">
      <div class="section-head">
        <span class="tag tag-live">What's new</span>
        <h1>What changed, <span class="dim">release by release.</span></h1>
        <p>Every change to VertexForm that you can see or hear, newest first. It's the project's changelog, so nothing here is planned work: all of it is live.</p>
      </div>
${releases.map((r) => `      <article class="news-rel" id="v${r.version.replace(/\./g, "-")}">
        <header class="news-when"><span class="news-v">${esc(r.version)}</span>${r.date ? `<time datetime="${r.date}">${longDate(r.date)}</time>` : ""}</header>
        <div class="news-body">
${r.groups.map((g) => `          <h2>${inline(g.title)}</h2>
          <ul>${g.items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`).join("\n")}
        </div>
      </article>`).join("\n")}
    </div>
  </section>`;
  return shell({
    generator: "tools/make-whatsnew.mjs from CHANGELOG.md",
    title: "What's new in VertexForm",
    description: "Every change to VertexForm you can see or hear, newest first: new exercises, skill paths, the exercise library and design changes.",
    active: "whats-new.html",
    body,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  fs.writeFileSync(OUT, render());
  console.log("whats-new.html written");
}
