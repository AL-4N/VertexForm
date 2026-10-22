# Vendored libraries

Copied unmodified (only `sourceMappingURL` comments removed) from the
official npm packages, and served from this site. Never load them from a
CDN: everything VertexForm runs comes from its own origin and works offline.

| Library | Version | Files | License |
|---|---|---|---|
| [GSAP](https://gsap.com) | 3.15.0 | `gsap/gsap.min.js`, `ScrollTrigger.min.js`, `SplitText.min.js` | GSAP Standard "no charge" license, free including commercial use: https://gsap.com/standard-license (notice at the top of each file) |
| [Lenis](https://lenis.darkroom.engineering) | 1.3.27 | `lenis/lenis.min.js`, `lenis.css` | MIT (`lenis/LICENSE`) |
| [Three.js](https://threejs.org) | 0.180.0 | `three/three.module.min.js`, `three.core.min.js` | MIT (`three/LICENSE`) |

Three.js stays on 0.180: later releases ship no minified build, and this
site has no build step to make one.

To update: download the package tarball from `https://registry.npmjs.org/<name>/-/<name>-<version>.tgz`,
copy the same files, update this table, then `npm run sw`.
