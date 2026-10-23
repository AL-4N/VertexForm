/**
 * decrypt.js — the homepage's decoding text (ui/scramble.js; an idea from
 * React Bits' "Decrypted Text"). Kept to a few labels, once each, the first
 * time they come on screen: the small tags, the section numbers' labels and
 * the 3D view's source line. Nothing decodes on hover; repeating it on every
 * button got tiring.
 */

import { scrambleOnView } from "../ui/scramble.js";

const ON_VIEW = "main .tag, .sec-index span, .r3-hud-src";

export function mountDecrypt() {
  scrambleOnView([...document.querySelectorAll(ON_VIEW)]);
}
