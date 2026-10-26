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
- No purple, no blue-to-purple gradients.
- Light and glow (Oct 2026, the owner wants more of it): a soft radial light
  follows the pointer behind the content (`site/glow.js`, green fading
  through amber); section chips are lime, tinted and glowing (the "Try it
  now" chip is the model); score numbers glow in their own colour;
  exercise cards glow green on hover; glows behind the hero and Form Lab
  figures and under the primary button stay.
- Buttons: on hover a circle grows from where the pointer came in until it
  fills the button, and shrinks back toward where it left
  (`js/ui/hover-fill.js` + `.btn::before` clip-path). Primary buttons (the
  go gradient) fill with a light circle; the others fill with the gradient.
  Danger buttons fill coral.
- Tones: sections alternate the two navies (`--ink`, `--ink-2`), and the
  page glides from one to the other as you scroll (`site/tones.js`, a fixed
  `body::before` layer fading in and out).
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
  soft drop shadows, with a faint light along the top edge (a 1px inset
  highlight and a short top-down sheen) so surfaces read machined, not
  flat. Primary buttons get a lit top edge too. Headings wrap balanced
  (`text-wrap: balance`), body text `pretty`; changing numbers are tabular. (The hero frame's single shadow is the exception.)
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
  - **Five skill paths** (`js/skills.js`): Push, Pull, Legs, Core and
    Conditioning, 32 skills. Tracked ones unlock from real saved sets
    (push-ups, squats, lunges, planks, jumping jacks); the rest say "Not
    tracked yet". Tree cards are large (236 px, 42 px flowers) on a wide
    screen (up to 1600 px), with a thicker trunk.
  - **Path cards show their tree in small** (`miniTree` in `ui/skills.js`):
    trunk, branches and the same blossoms, buds and twigs as the full tree.
  - **A path card zooms into its tree** (`zoomIntoTree` in `ui/skills.js`):
    a box with the card's little tree lifts off the card and grows to
    cover it (a small overshoot) while the other cards fade, then expands
    and travels to exactly where the tree's panel sits on the tree screen
    (slow off the mark, settling in). It hands over to the real panel, the
    rest of the screen lays out around it, and the tree blooms. Use this
    for any card that opens a screen of its own: the card becomes the
    thing it opens.
  - **The exercise picker is an instrument** (`ui/menu.js`), not a list of
    cards: a drafting-board stage where the exercise you point at does its
    rep live (big outlined index number rolling, a gauge of your best in
    its grade colour, a Train button), beside a dial of huge outlined names
    on a ruler. The pointed-at name fills with the go gradient and shows
    its hint while a glowing marker springs to it; the others tip back and
    fade by distance like a drum. The chosen name fills with ink left to
    right; the marker stretches like a needle as it travels; the old figure
    leaves through a blur as the new one arrives; the best score counts up
    the scale with its arc; the stage leans to the pointer with its grid
    sliding behind the figure. Clicking a name trains it at once, and its
    stage becomes the setup panel: the flying figure keeps doing its rep in
    step with the stage (`mountLoop`'s `start`), and lands on the setup
    demo's figure in the same pose and size.
  - **Trainer screen moments** (`ui/flair.js`), each different:
    an **exercise card becomes its setup panel** (the card stretches to the
    demo panel while its stick figure hops into the demo figure, then the
    rest drops in like dominoes); the **results grade lands like a stamp**
    (slams down, a ring of its colour shocks out, the card jolts); the
    **history board flips** (stat cards flip down in turn, charts draw their
    lines and pop their dots, unlocked achievements catch a glint); and
    **challenges deal out** from a stacked deck while the calendar's days pop
    in as a wave.
    A **new best** lands just after the grade's stamp ("New best!" pops in
    with a green pulse and amber-to-green sparks, `bestBadge`), and each
    **skill unlocked** toast carries the tree's blossom and a spark burst
    (`sparkle`).
  - **The results grade sits in a dial** (`results.js`): a protractor-style
    gauge round the letter (ticks every 10, the F to A bands marked) sweeps
    with the count-up, a bead riding its end in the live grade colour and
    each band's letter lighting as it passes; the dial flashes as the
    stamp lands and "Go again" catches a glint. The **rep chart draws
    itself** when it comes on screen (`drawRepChart`'s `p`): the target
    line runs across, each bar grows a little past its height and
    settles, its number pops, then the best rep gets a "BEST" bracket.
    The cards below land like sheets laid on the board (a slight turn,
    settling); the coach's tip rises in word by word; each fault shows
    the set as a row of dots that light on the reps it was flagged in.
  - **Results bars grow in** one after another, numbers counting up with them;
    the **menu's exercise cards rise in** the first time it shows; the **rest
    ring** refills with a spring on "+15 s" and its last 3 seconds stamp.
  - **The countdown stamps** (`ui/live.js`): 3, 2 and 1 land like the results
    grade, each with a ring climbing the scale (amber, lime, green).
  - **The skill tree blooms** (`ui/skills.js`, `.tree.growing` in
    `app.css`): each path is drawn as a tree growing up from a trunk.
    Opening one grows the branches tier by tier, then flowers open on the
    unlocked skills (paper petals, green heart), the next skill shows an
    amber bud, untracked and locked ones are bare twigs. A small blossom
    sits on each branch between two unlocked skills.
- **The hero can grade a half squat**: under the readout, a Full / Half
  squat switch (squat only) swaps in the half-squat clip, so you watch the
  same engine score it in the 70s (coral to amber) with a fix note.
- **The hero is a 3D scene** (`site/hero3d.js`, `figures/scene3d.js`): a
  simulated person does each exercise on the drafting floor; the camera
  leans toward the pointer and drag spins it; picking an exercise whips
  the camera round (about 100°) and lets it coast to a stop. Every score shown is the
  real engine's (`tools/make-rep3d.mjs`, `tests/rep3d.test.mjs`).
- **"How it works" is a pinned scroll story** (`site/story.js`): the
  section holds still while scrolling walks one 3D squat through the four
  steps and moves the camera round it. Progress is eased, so a flick glides.
  Changing step is impossible to miss: the old step's words fly up out of
  their line masks while the new step's rise in (reversed when scrolling
  back), a big outlined step number rolls over like an odometer, the fact
  chip flips, and the meter lights the step. About 3.3 screens of scroll.
- **Tones blend** (`site/tones.js`): the page colour glides between the two
  navies to the tone of the section under the middle of the screen. The
  alternate navy is a fixed layer whose opacity fades (GPU only, no page
  repaint), so section boundaries never stutter.
- **Skill paths roll past like a project carousel** (`site/paths.js`):
  the section pins and scrolling rolls through the five paths one at a
  time. A big card holding the path's real tree (the trainer's `miniTree`,
  this browser's progress if any) tips back over a drum, bending with
  scroll speed (its top and bottom edges bow in) and blurring as it goes;
  the middle column ("N°01 / 05", the name, real counts, a button into
  that tree via `app.html#tree-<id>`) swaps with it; a glossy tile with a
  grade-colour rim shows the goal skill's flower, tumbles past the other
  way and leans toward the pointer. When scrolling stops between two
  paths it glides to the nearer one. Each arriving path grows its tree
  (trunk, then branches from the ground up, then flowers and buds pop),
  its name rises in letter by letter, its tags pop and a light band
  sweeps the glass; a glare follows the pointer and the tree sits a
  little behind the frame. A tick rail along the bottom fills as you go.
  Reduced motion: a plain list.
- **Homepage setup and questions**: the trainer's three camera-setup
  steps, each a small plan drawn in stroke by stroke as it arrives; the
  questions open with a height glide while the answer unblurs (`site/faq.js`).

- **Reading progress** (`site/progress.js`): under 1400 px, where there's
  no side rail, a 2 px hairline under the header fills with the go
  gradient as you scroll, easing so jumps glide; its tip is a bead that
  brightens while moving and dims at rest.
- **Loops idle when nothing moves**: every per-frame loop on the homepage
  stops, or skips its writes, once its inputs stop changing.
- **Smooth scrolling** (Lenis, `site/smooth.js`): wheel and trackpad
  scrolling glide; touch stays native. Paused while a popup is open.
- **Headings rise in line by line** from a mask, no blur (GSAP
  SplitText, `site/scroll-fx.js`): the hero's on load, each section's the
  first time it comes on screen.
- **Cards rise in** group by group as they enter (ScrollTrigger batch), and
  the hero has depth on the way out: the copy drifts up faster than the
  page while the 3D scene sinks and fades.
- **The hero figure is lit 3D geometry** (Three.js, `figures/figure-gl.js`):
  a dark satin body lit at the edges in the grade colour (a fresnel rim on
  the standard material) with small white beads on the tracked joints, so
  it reads as a scanned figure, not a plastic toy; a key
  light casting a soft floor shadow, a rim light tinted by the grade. The
  floor grid, protractors and notes stay drawing-board 2D on top.
- **Click sparks** (`site/sparks.js`): eight short strokes in the amber to
  green colours burst from the main call-to-action buttons when clicked
  (not from every click: that read as a gimmick). **Magnetic buttons**
  (`site/magnet.js`): the hero and closing buttons lean toward the pointer
  and spring back. Both are React Bits ideas rebuilt in plain JS.
- **Things grow out of what you clicked** (`ui/popup.js`): exercise-card
  popups, the trainer's confirms and onboarding (the page behind blurs and
  dims; closing runs back into the trigger); trainer screens grow out of
  the button or card that opened them (`showScreen`, `growFrom`), or out
  of the middle when nothing was pressed; the skill-tree panel grows out of
  the skill you picked; "Target reached" bursts out as a circle; toasts pop
  open from a dot and close back into one.
- **Fact strips** (`site/ticker.js`): rows of true facts (mono, small) and
  the exercise names (huge, outlined) slide sideways only as you scroll,
  alternate rows opposite ways, leaning with scroll speed. Decorative
  (`aria-hidden`): the same facts are in the page.
- **The footer wordmark** is as wide as the page, outlined "Vertex" and a
  gradient "Form", cut off by the bottom edge, and rises into view as you
  reach the end (scrubbed by scroll).
- **Cards lean toward the pointer** (`site/tilt.js`): exercise cards, mode
  cards, coach cues and panels tilt up to 6° in perspective with a soft
  sheen that follows the pointer, and settle back on leave. Mouse only.
- **Text decodes** (`ui/scramble.js`, `site/decrypt.js`; React Bits'
  "Decrypted Text" idea): letters start as random measuring glyphs (digits,
  °, ±, ×) and settle left to right with a blur that clears. Use it
  sparingly, only when a string first loads: section-number
  labels and the 3D view's source line on the homepage, the exercise
  popup's name as it opens, and trainer screen labels the first time each
  screen opens. **Never on hover** (the owner found it repetitive), and not
  on headings or card titles, which already rise in.
- **Blur only where something is moving fast**: directional motion blur on
  slides, screen changes, nav glides and rolling digits (the owner's rule).
  Things arriving (headings, cards, answers, section numbers) rise cleanly
  with no blur: blur-in reveals were the most "AI template" thing on the
  page. Fact strips only lean with scroll speed. Live background blur (a
  frosted nav) is not used: it costs every frame.
- **Stages open out of a frame** (`scroll-fx.js`): the 3D view and the Form
  Lab stage grow from a narrow, rounder frame to full size as you scroll
  to them (clip-path, scrubbed).
- **Coach cues show the voice** (`site/coach.js`): while a cue plays, its
  card lights in its score's colour and the play button becomes five bars
  moved by the real audio (an analyser on the coach's output).
- **Scores count up the scale on the homepage too** (`scroll-fx.js`): the
  scoring test results and example chips climb from 0 through each grade
  colour as they come into view; the example chart's bars grow up in turn.
- **Section index numbers** (`site/sections.js`): on wide screens, sections
  whose heading has its row to itself get a big outlined number (01, 02…)
  and a mono label in the empty space to the right; the digits roll up as
  the section arrives, the label decodes, and the number drifts slower
  than the page.
- **Exercise cards do their rep on hover** (`site/card-reps.js`): the
  still figure is swapped for the trainer's live loop, coloured by its live
  score (coral at the top, green at depth), and swapped back on leave.
- **Reaching an A in the Form Lab** (`site/lab.js`): the moment your
  sliders take the score from below 90 into an A, the number stamps down,
  a green ring shocks out and a burst of sparks flies off it.
- **The story hands over**: as "How it works" ends, its pinned scene shrinks
  back and fades while the next section comes up. **The hero's scroll cue**
  is a short gradient line that empties as you scroll out (wide screens).
- **A drawing becomes the 3D model** (`site/expop.js`): opening an
  exercise card, its flat figure flies into the popup and lands on the 3D
  figure, which waits in the same pose seen from the side (the webcam's
  view), dissolves into it, then the camera swings round as the floor and
  protractor come up and it starts moving. Closing runs it backwards: the figure
  turns back to the flat side view and the floor fades, then the popup
  folds into the card (`openPopup(..., { beforeClose })`).
- **Page changes open as a circle** from where you clicked (home ↔
  trainer), over 1.1 s on a slow-to-fast curve, sized to just reach the
  farthest corner, with a glowing green rim riding its edge; the new page
  settles in from slightly enlarged and blurred while the old one sinks
  back and blurs: the inline `pagereveal` script in each page's head +
  `css/transitions.css` `vt-circle`.
- **No custom cursor.** Tried twice in Oct 2026 and removed at the owner's
  request: the Mac pointer kept showing alongside it. Use the system pointer;
  `cursor: grab` on things you can drag.
- **Not the template look.** Before adding motion, check it isn't one of
  the stock "AI site" tells: blur-in on every reveal, sparkles or confetti
  on every click, scrambled text everywhere, glow on everything, the same
  fade-up stagger on every block. Each effect should belong to one place
  and say something about measuring a body.
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
