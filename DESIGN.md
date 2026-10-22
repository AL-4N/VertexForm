# VertexForm design

How VertexForm looks, sounds and reads. Follow this for any change to the
site (`public/index.html`) or the trainer (`public/app.html`). The values here
are the real ones in `public/css/theme.css`, `site.css`, `app.css` and
`marks.css`; if you change a token, change it here too.

## The idea

VertexForm measures bodies, so it looks like a measuring instrument: a
drafting board. Stick figures sit on a faint grid, joints get protractor
marks with the angle in a boxed mono label, and the coach writes notes by
hand with an arrow to the body part. Everything else stays quiet navy so the grade
colours carry the meaning. (A graphite-and-paper palette was tried in
Oct 2026 and dropped: the owner prefers this navy.)

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
| `--paper` | `#eef1fb` | the light circle that fills a primary button on hover |

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
- `--go-gradient`: amber to green. Primary buttons, selected toggles, the
  current item in nav, the logo's "Form", the hover fill of other buttons.
- Letters: 90+ A, 80 B, 70 C, 60 D, below 60 F. The trainer shows A+ from 95.
- A score is always drawn in its own colour (`gradeColor(score)`), never a
  fixed "good" or "bad" colour. Colour is never the only signal: the number
  or letter is always shown too.
- No purple, no blue-to-purple gradients. Glows stay limited to the ones that
  exist (behind the hero and Form Lab figures, under the primary button).
- Buttons: on hover a circle grows from where the pointer came in until it
  fills the button, and shrinks back toward where it left
  (`js/ui/hover-fill.js` + `.btn::before` clip-path). Primary buttons (the
  go gradient) fill with a light circle; the others fill with the gradient.
  Danger buttons fill coral.
- Tones: sections alternate the two navies (`--ink`, `--ink-2`), and the
  page glides from one to the other as you scroll (`site/tones.js`).
  Cards, figures and 3D views keep their own panel colours.

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
- 3D view (`js/site/rep3d.js`, homepage): the same figure rules in
  perspective. Drafting grid on the floor (25 cm squares, fading out), a
  protractor ring around the figure with the webcam's position marked,
  floor shadows, and the knee protractor drawn in the plane of the leg.
  Far limbs recede to 38%. Drawn on a canvas with its own small camera,
  no 3D library. Every score it shows comes from the engine (the clip's
  data is made and checked by `tools/make-rep3d.mjs` / `tests/rep3d.test.mjs`).

## Motion

- Every screen change and moving element slides with a directional motion
  blur (`js/ui/motion.js`, `slide()`).
- Scrolling: menu-link glides and fast hand scrolls blur vertically
  (`js/site/motion-nav.js`); slow reading-speed scrolling stays sharp.
- The side rail's fill eases toward the scroll position every frame, so it
  never jumps.
- Signature moments (each tied to what VertexForm does, not decoration):
  - **"It finds you"** (`site/hero3d.js`): once per visit, the 3D hero
    figure's tracked points pop in, then the bones grow out between them.
    When the engine grades a rep, its score counts up the scale and the
    figure takes that grade's colour.
  - **Written notes** (`coachNote` with `write`): the coach's note is penned
    in line by line, then its arrow draws to the body part. Only when the
    cue is new.
  - **Gauge settle** (`spring` in `ui/motion.js`): values that jump (a Form
    Lab preset, the live grade badge) swing a little past and settle, like a
    needle.
  - **Count up the scale** (`results.js`): the final score counts from 0,
    taking each grade colour on the way, the letter dropping in at each grade.
  - **Rolling digits** (`ui/digits.js`): changed digits roll up or down with
    a vertical motion blur (dashboard stats, the live rep counter).
  - **Gliding toggles** (`ui/segmented.js`): one highlight slides between a
    toggle group's options with a horizontal motion blur.
  - **A path card zooms into its tree** (`zoomIntoTree` in `ui/skills.js`):
    a box with the card's little tree map lifts off the card and grows to
    cover it (a small overshoot), holds a beat, then takes the whole screen
    slow to fast (`cubic-bezier(.7, 0, .84, 0)`), and the tree screen
    takes over as it fades. Use this card-to-full-screen zoom for any card
    that opens a whole screen of its own.
  - **The skill tree blooms** (`ui/skills.js`, `.tree.growing` in
    `app.css`): each path is drawn as a tree growing up from a trunk.
    Opening one grows the branches tier by tier, then flowers open on the
    unlocked skills (paper petals, green heart), the next skill shows an
    amber bud, untracked and locked ones are bare twigs. A small blossom
    sits on each branch between two unlocked skills.
- **The hero is a 3D scene** (`site/hero3d.js`, `figures/scene3d.js`): a
  simulated person does each exercise on the drafting floor; the camera
  leans toward the pointer and drag spins it. Every score shown is the
  real engine's (`tools/make-rep3d.mjs`, `tests/rep3d.test.mjs`).
- **"How it works" is a pinned scroll story** (`site/story.js`): the
  section holds still while scrolling walks one 3D squat through the four
  steps and moves the camera round it. Progress is eased, so a flick glides.
- **Tones blend** (`site/tones.js`): the page colour glides between the two
  navies to the tone of the section under the middle of the screen
  (registered custom properties), never a hard edge.
- **Smooth scrolling** (Lenis, `site/smooth.js`): wheel and trackpad
  scrolling glide; touch stays native. Paused while a popup is open.
- **Headings rise in line by line** from a mask, with a little blur (GSAP
  SplitText, `site/scroll-fx.js`): the hero's on load, each section's the
  first time it comes on screen.
- **Cards rise in** group by group as they enter (ScrollTrigger batch), and
  the hero has depth on the way out: the copy drifts up faster than the
  page while the 3D scene sinks and fades.
- **The hero figure is lit 3D geometry** (Three.js, `figures/figure-gl.js`):
  capsule limbs and head in the grade colour with a slight glow, a key
  light casting a soft floor shadow, a rim light tinted by the grade. The
  floor grid, protractors and notes stay drawing-board 2D on top.
- **Click sparks** (`site/sparks.js`): eight short strokes in the amber to
  green colours burst from where you click. **Magnetic buttons**
  (`site/magnet.js`): the hero and closing buttons lean toward the pointer
  and spring back. Both are React Bits ideas rebuilt in plain JS.
- **Things grow out of what you clicked** (`ui/popup.js`): exercise-card
  popups, the trainer's confirms and onboarding (the page behind blurs and
  dims; closing runs back into the trigger); trainer screens grow out of
  the button or card that opened them (`showScreen`, `growFrom`), or out
  of the middle when nothing was pressed; the skill-tree panel grows out of
  the skill you picked; "Target reached" bursts out as a circle; toasts pop
  open from a dot and close back into one.
- **Page changes open as a circle** from where you clicked (home ↔
  trainer): the inline `pagereveal` script in each page's head +
  `css/transitions.css` `vt-circle`.
- **A custom cursor** (`site/cursor.js`, site only) replaces the system
  pointer: a dot exactly under the mouse and a ring that trails it, opens
  over links, and over draggable or openable areas becomes a disc that
  says "Drag" or "Open". `difference` blend, mouse only. Inside an open
  popup (top layer, above the ring) the system pointer comes back.
- Nothing loops just for decoration: the figures are always doing an
  exercise, and only while on screen.
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
