/**
 * decrypt.js — the homepage's decoding text (ui/scramble.js; an idea from
 * React Bits' "Decrypted Text"): small labels, card titles, readouts and
 * section numbers decode the first time they come on screen, and the nav
 * links, buttons and switches decode again each time the pointer comes
 * onto them.
 */

import { scrambleOnView, scrambleOnHover } from "../ui/scramble.js";

const ON_VIEW = "main .tag, .ex-pop-mini, .lab-mini, .cal-caption, .r3-hud-src, .sec-index span, .ex-card h3, .mode h3, .readout-live, .readout-rows dt, .r3-rows dt, .ticker-track span:not(.ticker-outline), .foot p, .cta-band p";
const ON_HOVER = ".nav nav a, .nav-settings span, .btn, .tab-name, .r3-seg button, .voices button, .lab-presets button, .story-meter button, .foot-row > a:last-child";

export function mountDecrypt() {
  scrambleOnView([...document.querySelectorAll(ON_VIEW)]);
  scrambleOnHover([...document.querySelectorAll(ON_HOVER)]);
}
