/**
 * tones.js — the page changes colour as you move through it.
 *
 * Every section says which tone it is (data-tone="dark" | "paper" | "sage").
 * Whichever section is under the middle of the screen sets body[data-tone];
 * the CSS turns that into the page background and text colours, and since
 * those are registered custom properties (@property in site.css) the whole
 * page blends from one tone to the next instead of jumping at a hard edge.
 * Cards, figures and the 3D views keep their own dark colours throughout.
 */

export function mountTones() {
  const parts = [...document.querySelectorAll("main > [data-tone], body > footer[data-tone]")];
  if (!parts.length) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const y = innerHeight * 0.5;
    const at = parts.find((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; })
      ?? (scrollY < 10 ? parts[0] : parts[parts.length - 1]);
    const tone = at.dataset.tone;
    if (document.body.dataset.tone !== tone) document.body.dataset.tone = tone;
  };
  addEventListener("scroll", () => { raf ||= requestAnimationFrame(update); }, { passive: true });
  addEventListener("resize", () => { raf ||= requestAnimationFrame(update); });
  update();
}
