/**
 * whatsnew.test.mjs — public/whats-new.html is generated from CHANGELOG.md
 * (tools/make-whatsnew.mjs). Fails if it's out of date: run
 * `node tools/make-whatsnew.mjs`, then `npm run sw`.
 */
import fs from "node:fs";
import { render, parse } from "../tools/make-whatsnew.mjs";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} ${detail}`); };
const page = fs.readFileSync(new URL("../public/whats-new.html", import.meta.url), "utf8");
const fresh = render();
check("whats-new.html matches CHANGELOG.md", page === fresh, page === fresh ? "" : "run node tools/make-whatsnew.mjs");
const rel = parse("## 9.1.0 — 2026-01-02\n\n### A group\n- one item\n  that wraps\n- two\n");
check("Changelog parsing: version, date, groups, wrapped items", rel[0].version === "9.1.0" && rel[0].date === "2026-01-02" && rel[0].groups[0].items.join("|") === "one item that wraps|two", JSON.stringify(rel));
check("No em dashes on the page", !/—/.test(fresh.replace(/<!--[\s\S]*?-->/g, "")));
console.log(`\n${fail ? `${fail} what's-new check(s) FAILED` : "All what's-new checks pass"} (${pass} passed)`);
process.exit(fail ? 1 : 0);
