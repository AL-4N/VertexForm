/**
 * mini-tree.js — a skill path drawn small, as an SVG string: used on the
 * trainer's path cards (ui/skills.js) and the homepage's path carousel
 * (site/paths.js). No DOM, no state: give it a path from skillPath().
 */

/** Group a path's skills into rows by tier. */
export const tiersOf = (path) => {
  const rows = [];
  for (const s of path.steps) (rows[s.tier - 1] ??= []).push(s);
  return rows;
};

/** Average across-position of a skill's prerequisites already placed (0..1). */
export const avgPos = (s, pos) => {
  const xs = s.requires.map((r) => pos[r]).filter((x) => x != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.5;
};

/**
 * The card's picture of its path: the same tree as the full screen, small.
 * A trunk from the ground to the starting skills, curved branches up to the
 * skills that need them (thinner as they climb, dashed toward ones that
 * can't be tracked yet), and on each skill a blossom (unlocked), an amber
 * bud (next) or a bare twig (locked, or not tracked yet).
 */
export function miniTree(p) {
  const rows = tiersOf(p);
  const W = 200, GAP = 30, H = 26 + rows.length * GAP;
  const pos = {};
  rows.forEach((row, t) => {
    if (t) row.sort((a, b) => avgPos(a, pos) - avgPos(b, pos));
    row.forEach((s, i) => { pos[s.id] = (i + 0.5) / row.length; });
  });
  const xy = (s) => [20 + pos[s.id] * (W - 40), H - 22 - (s.tier - 1) * GAP];
  const ground = H - 6;
  const roots = p.steps.filter((s) => s.tier === 1).map(xy);
  const mx = roots.reduce((a, r) => a + r[0], 0) / roots.length;
  const curve = ([x1, y1], [x2, y2]) => { const m = (y1 + y2) / 2; return `M${x1} ${y1}C${x1} ${m} ${x2} ${m} ${x2} ${y2}`; };
  let wood = `<line x1="14" y1="${ground}" x2="${W - 14}" y2="${ground}" class="mt-ground"/>`;
  wood += roots.map((r) => `<path d="${curve([mx, ground], r)}" class="mt-wood mt-trunk"/>`).join("");
  for (const s of p.steps) {
    for (const r of s.requires) {
      const parent = p.steps.find((x) => x.id === r);
      if (!parent) continue;                                   // a prerequisite from another path
      const lit = parent.status === "done";
      wood += `<path d="${curve(xy(parent), xy(s))}" class="mt-wood${lit ? " lit" : ""}${s.status === "planned" ? " planned" : ""}" style="stroke-width:${Math.max(1.2, 4 - s.tier * 0.6)}"/>`;
    }
  }
  const mark = (s) => {
    const [x, y] = xy(s);
    if (s.status === "done") {
      const petals = [0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-3.6" rx="2.6" ry="3.8" transform="rotate(${a})" class="mt-petal"/>`).join("");
      return `<g transform="translate(${x} ${y}) scale(1.5)">${petals}<circle r="1.9" class="mt-heart"/></g>`;
    }
    if (s.status === "next") return `<g transform="translate(${x} ${y}) scale(1.5)"><path d="M0 7V2" class="mt-twig"/><ellipse cx="0" cy="-1" rx="3" ry="4.6" class="mt-bud"/></g>`;
    return `<g transform="translate(${x} ${y}) scale(1.4)" class="mt-bare"><path d="M0 6V-5M0 1l-3.5-3.5M0-2l3-3" class="mt-twig"/></g>`;
  };
  return `<svg class="mini-tree" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${wood}${p.steps.map(mark).join("")}</svg>`;
}

