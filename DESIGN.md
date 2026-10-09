# VertexForm design

How VertexForm looks, sounds and reads. Follow this for any change to the
site (`public/index.html`) or the trainer (`public/app.html`). The values here
are the real ones in `public/css/theme.css`, `site.css`, `app.css` and
`marks.css`; if you change a token, change it here too.

## The idea

VertexForm measures bodies, so it looks like a measuring instrument: a
drafting board. Stick figures sit on a faint grid, joints get protractor
marks with the angle in a boxed mono label, and the coach writes notes by
hand with an arrow to the body part. Everything else stays quiet navy so the
grade colours carry the meaning.

The grade scale is the brand. Coral is an F, green is an A, and that
gradient appears wherever a score lives: the logo, primary buttons, score
numbers, figures, the side rail.

## Colour

| Token | Value | Use |
|---|---|---|
| `--ink` / `--bg` | `#090d1c` | page background |
| `--ink-2` | `#0d1326` | alternate sections, figure heads |
| `--surface` / `--panel` | `#121a32` | cards, panels |
| `--surface-2` / `--panel-hi` | `#18223f` | raised controls, selected states |
| `--line` / `--border` | `#222c4e` | borders, dividers |
| `--line-2` | `#2e3a63` | stronger rules, floor lines, ruler ticks |
| `--text` | `#eef1fb` | body text |
| `--text-dim` | `#a6aecb` | secondary text |
| `--text-faint` | `#737d9f` | hints, inactive labels |

Grade scale (keep in sync with `public/js/grade.js`, which maps any score to
its exact colour):

| Score | Colour | |
|---|---|---|
| 0 | `#ff4d6d` | F, coral |
| 55 | `#ff7a45` | |
| 70 | `#ffbe3d` | C, amber |
| 85 | `#c6ef4e` | B, lime |
| 100 | `#2ee59d` | A, green |

- `--grade-gradient`: the full scale, F to A. Score bars, the closing band.
- `--go-gradient`: amber to green. Primary buttons, the current item in nav.
- Letters: 90+ A, 80 B, 70 C, 60 D, below 60 F. The trainer shows A+ from 95.
- A score is always drawn in its own colour (`gradeColor(score)`), never a
  fixed "good" or "bad" colour. Colour is never the only signal: the number
  or letter is always shown too.
- No purple, no blue-to-purple gradients. Glows stay limited to the ones that
  exist (behind the hero and Form Lab figures, under the primary button);
  don't add more.

## Type

| Role | Face | Notes |
|---|---|---|
| Display | Unbounded 700/800 | headings, scores, names. `letter-spacing: -.02em` |
| Body | Instrument Sans 400–700 | everything else |
| Measurements | system mono (`--mono`) | angles, times, readouts, rail labels. Tabular numbers |
| Coach notes | system handwriting (`--hand`) | only for the coach's notes on figures |

- Fonts are self-hosted (`public/fonts/`). Never load fonts from a CDN.
- Headings are sentence case. Never Title Case.
- Body lines under 75 characters (`max-width: 60–70ch`).

## Shape

- Buttons and tabs: rounded rectangles, 9–10px radius. **No pill buttons.**
- Cards: `--r-lg` 22px (site) / `--radius` 14px (trainer). Small chips 6–8px.
- Pills (`999px`) only for things that aren't buttons: progress tracks, dots.
- Cards are outlined with 1px hairlines (`inset 0 0 0 1px var(--line)`), not
  soft drop shadows. (The hero frame's single shadow is the exception.)
- Don't make everything the same card. Vary it: a ruled list (`.also`),
  panels, a calendar grid.

## Figures and marks

The stick figures (`js/figures/`) are the main visual. Keep them consistent:

- Limbs 7px, round caps and joins, stroked in the live grade colour.
  Far-side limbs at 38% opacity. Head: radius 19, filled `--ink-2`.
- Floor: `--line-2`, 2px. The ideal form is green `#2ee59d`.
- Drafting grid behind figures: 1px lines every 24px at 6% opacity.
- Protractor (`angleMark`): thin arc, a tick every 10° (longer every 30°),
  the angle in a boxed mono label.
- Dimension marks (`levelLine`, `offsetMark`): dashed reference lines,
  uppercase mono labels ("PARALLEL", "12° OFF LINE") in a box.
- Coach notes (`coachNote`): handwriting, slightly rotated, a hand-drawn
  arrow to the body part. Green arrow for a good rep, amber for a fix. The
  note says the real cue, never filler.
- Icons are drawn SVG (stroke `currentColor`). **No emoji icons.**

## Motion

- Every screen change and moving element slides with a directional motion
  blur (`js/ui/motion.js`, `slide()`).
- Scrolling: menu-link glides and fast hand scrolls blur vertically
  (`js/site/motion-nav.js`); slow reading-speed scrolling stays sharp.
- The side rail's fill eases toward the scroll position every frame, so it
  never jumps.
- No fade-in-on-scroll for sections, no looping decorative animation.
- `prefers-reduced-motion`: everything jumps straight to its end state.

## Layout

- Content width 1200px, gutter `clamp(1.25rem, 4vw, 2.75rem)`.
- 1400px and up: the side rail (a ruler with one tick per section) replaces
  the header links.
- 860px and down: header links hide. 480px and down: Settings is just a gear.
- Every page works at 375px wide with no sideways scroll.
- Loading: a skeleton of the same shape and height as the real content,
  shown only if loading takes over 150 ms.

## Voice

- Spoken lines are the recorded Kokoro clips (`public/audio/`), never the
  browser's speech. All spoken text lives in `public/js/coaching.js`; new
  text needs `npm run voice`.
- Personalities: Chill (Heart, calm), Hype (Bella, energetic), Coach
  (Michael, firm).

## Writing

- Say what it does, in plain words. "Your webcam grades every rep from 0 to
  100", not a slogan.
- Headings state a fact ("How the scoring is tested"), not a slogan
  ("A score that means something").
- **No em dashes.** Use a colon, comma or full stop.
- Avoid: delve, leverage, seamless, robust, elevate, empower, unlock (except
  achievements), game-changer, "it's not X, it's Y", "In an era of".
- Don't force groups of three. Use as many items as there really are.
- No rhetorical questions, no filler transitions (Additionally, Moreover).
- Buttons say exactly what happens: "Save rep", "Start training".
- Errors say what went wrong and how to fix it.

## Honesty

- Every number shown is real (from the engine or the tests) or labelled as
  an example. No made-up stats, reviews or user counts.
- No "made with AI" tags, no fake testimonials.
- Nothing leaves the device: no uploads, accounts, analytics or server code.
  (Accounts and leaderboards wait until the owner asks for them.)
