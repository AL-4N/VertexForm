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
| `--text-faint` | `#808aac` | hints, inactive labels. At least 4.5:1 on every surface, panels included (AA for small text) |
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

- `--grade-gradient`: the full scale, F to A. Score bars, the thin F to A
  bar over the closing heading.
- `--go-gradient`: amber to green. The logo's "Form", the circle that fills
  a button on hover, small marks (the eyebrow rule, the rail). Never as a
  resting fill: primary buttons and selected toggles are solid paper
  (`--paper` with `--ink` text), the current nav link is white with its
  rule drawn. The grade colours are for scores; when buttons wore them
  too, they stopped meaning anything (Nov 2026, after comparing with
  Linear, Raycast and Apple).
- Letters: 90+ A, 80 B, 70 C, 60 D, below 60 F. The trainer shows A+ from 95.
- A score is always drawn in its own colour (`gradeColor(score)`), never a
  fixed "good" or "bad" colour. Colour is never the only signal: the number
  or letter is always shown too.
- No purple, no blue-to-purple gradients.
- Light: only where it's physical. The lit 3D figure, the hero's wash in
  the live grade colour and the glow behind the Form Lab figure stay. The
  Oct 2026 glows (a light following the pointer, glowing chips, haloed
  scores, cards glowing on hover, a glow under the primary button) were
  removed in Nov 2026: next to pro sites they read as a template.
- Section labels are eyebrows, not chips: mono uppercase, `--text-dim`,
  after a short lime rule (`.tag-live`).
- Buttons: on hover a circle of ink grows from where the pointer came in
  until it fills the button, and shrinks back toward where it left
  (`js/ui/hover-fill.js` + `.btn::before` clip-path). Every button fills
  with the go gradient; the primary is solid paper at rest. Danger
  buttons fill coral. (A scanning beam with rolling letters was tried in
  Nov 2026 and dropped: the owner prefers this fill.)
- Tones: sections alternate the two navies (`--ink`, `--ink-2`), and the
  page glides from one to the other as you scroll (`site/tones.js`, a fixed
  `body::before` layer fading in and out).
  Cards, figures and 3D views keep their own panel colours.

## Type

| Role | Face | Notes |
|---|---|---|
| Display | Unbounded 500–800 | section headings in two weights (the fact 700, the rest 500 and dim, `-.045em`), the hero's "every rep" 800, h3 and names at 600. Big and confident, like the instrument it sits in |
| Body | Instrument Sans 400–700 | everything else |
| Measurements | system mono (`--mono`) | angles, times, readouts, rail labels. Tabular numbers |
| Coach notes | system handwriting (`--hand`) | only for the coach's notes on figures |

- Fonts are self-hosted (`public/fonts/`). Never load fonts from a CDN.
- Headings are sentence case. Never Title Case.
- Two-weight headings: the fact in white at 700, the rest of the sentence
  in `--text-faint` at 500 (`<span class="dim">`): "Eighteen exercises,
  each measured its own way." Short ones stay one weight.
- Questions, list labels and other small headings use the body face
  (Instrument Sans 600), not Unbounded.
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
- Kit is drawn like the floor (`prop` on a pose, `propMarkup` in
  `figures/draw.js`): the bench under a split squat's back foot, the bar
  under a dip or a row, low parallettes under an L-sit or V-sit, the pull-up bar overhead (the pull-up hangs free,
  so it has no floor line: `ground: false`). The exercise library (`exercises.html`) is the same plates,
  one per exercise, generated from the code.
- Figures sit in ruled plates (exercises, camera setup): hairlines between
  cells, no card background or radius, a drafting grid behind the drawing
  and a mono caption (FIG 01…), like plates in a manual.
- Don't make everything the same card. Vary it: a ruled list (`.also`),
  panels, a calendar grid. Empty states share one small card (History's
  "Not tried yet") rather than one empty card each.
- Buttons that start something look like it: the setup screen's Practice /
  Analyze cards carry an arrow that fills with the go gradient on hover.
- Say each thing once. The homepage had privacy in four places and three
  3D squats in a row (Oct 2026); now privacy is in the hero badges and the
  questions, and the 3D squat is the hero plus the pinned story. Before
  adding a section, check what already says it.

## Figures and marks

The stick figures (`js/figures/`) are the main visual. Keep them consistent:

- Limbs 7px, round caps and joins, stroked in the live grade colour.
  Far-side limbs at 38% opacity. Head: radius 19, filled `--ink-2`.
- Floor: `--line-2`, 2px. The ideal form is green `#2ee59d`.
- Drawn in light: the 2D figures (exercise plates, the small drawings, the
  Form Lab) glow in their own stroke colour (`#fig-glow`, an SVG filter
  in the page's defs), so they read as the same light as the 3D figure.
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
- Signature moments (each tied to what VertexForm does, not decoration):
  - **"It finds you"** (`site/hero3d.js`): once per visit, after the
    calibration intro, the hero figure's tracked points pop in, then its
    bones of light draw out between them. When the engine grades a rep,
    its score counts up the scale and the figure, and the smoke around it,
    take that grade's colour.
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
    (push-ups, pike push-ups, dips, squats, lunges, Bulgarian split squats,
    pistol squats, planks, side planks, hollow holds, mountain climbers,
    jumping jacks, dead hangs, Australian rows, negative pull-ups, pull-ups,
    L-sits, V-sits); the rest say "Not tracked yet". The menu's
    "Nearest unlocks" card names the two you're closest to, what's left in
    words ("3 more reps, 2 more points on the average") and a Train button.
    The workout builder's "Plan my next unlocks" fills a routine with the
    exercises behind your nearest unlocks at their goal amounts
    (`unlockRoutine`). Tree cards are large (236 px, 42 px flowers) on a wide
    screen (up to 1600 px), with a thicker trunk.
  - **A skill's panel shows your best try as meters** (`progressOf` in
    `skills.js`): reps or seconds, and the average, each against the goal,
    from your closest real set; they fill as the panel opens, "met" when
    reached. Its Train button opens that exercise.
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
    On a wide screen (≥1180 px, motion allowed) the names become a **ring
    of cards** (`ui/picker-ring.js`), the same instrument as the homepage's
    ring: the stage stands above the centre of a tilted, elliptical ring of
    18 cards (each with its figure, number, name and best) that always
    face you; the back of the ring passes behind the stage. It turns on its
    own (0.06 rad/s), stops under the pointer, and the wheel, a drag, the
    arrow buttons or the arrow keys turn it and settle a card at the front.
    The front card is the one on the stage; a focused card turns to the
    front; Enter or a click trains it. The first time, the cards fly out
    from the stage and wind into place, then a glint runs round the ring
    both ways from the front card. A card catches a glint (a diagonal band
    of light with a faint lime edge, on its `::after`) as it turns to the
    front and when you point at it. Narrower screens and reduced motion
    keep the dial.
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
    each band's letter lighting as it passes; the letter it counted up to
    lifts off and slams down (`stamp(..., { lift: true })`, never blanking
    the dial), and the dial flashes as the stamp lands and "Go again" catches a glint. The **rep chart draws
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
  section holds still while scrolling walks one 3D squat, drawn in light
  like the hero's (a WebGL layer over the story's 2D canvas, which keeps
  the floor, points, angle and note), through the four steps and moves the
  camera round it. Progress is eased, so a flick glides.
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
- **One scroll measure** (`site/scroll-progress.js`): everything that moves
  with the scroll reads the same 0 to 1 numbers (overall, and per section),
  and the page is measured only when its layout changes, so scrolling never
  re-measures the page every frame. **The 3D stage** (`site/stage.js`) is a
  fixed canvas behind the content for a model that travels down the page;
  it shows nothing until a model is plugged in (`?stage` shows a stand-in).
- **Links land where they point**: `index.html#faq` from another page ends
  with the section under the header, even though the story and skill paths
  grow after the page loads.
- **Smooth scrolling** (Lenis, `site/smooth.js`): wheel and trackpad
  scrolling glide; touch stays native. Paused while a popup is open.
- **Headings rise in line by line** from a mask, no blur (GSAP
  SplitText, `site/scroll-fx.js`): the hero's on load, each section's the
  first time it comes on screen.
- **Cards rise in** group by group as they enter (ScrollTrigger batch), and
  the hero has depth on the way out: the copy drifts up faster than the
  page while the 3D scene sinks and fades.
- **The figure is drawn in light** (`figures/glow.js`, used by the hero's
  `figures/figure-gl.js` and the stage): the same stick figure as the
  drawings, in 3D. Each bone is a thin white-hot core inside a soft tube
  of light in the live grade colour, the head a ring that always faces
  you, a bright point on every tracked joint, a pool of its light on the
  floor, and faint trails behind the hands and feet, so a rep leaves a
  light-painting of its path. Additive, so it reads on the dark page. (A
  realistic MakeHuman mannequin was tried in Nov 2026 and dropped: the
  owner prefers the stick figure.)
- **The hero is an instrument** (wide screens, `index.html` + `site.css`):
  full screen, the figure in the middle on its protractor floor, a horizon
  line through it carrying live readings in mono (points, the measured
  angle, the rep, the view angle to a tenth of a degree), three quarters
  of an orbit round it that turns with the camera, faint crosshairs. Top
  left a mono tag; top right a two-line spec, the exercise as one huge
  lowercase word that rolls in when the figure changes exercise, the
  exercise index (01 SQUAT…) and the buttons; bottom left the headline in
  two weights ("every rep" huge); bottom right the score, big, glowing in
  its grade colour. Narrow screens stack it in reading order.
- **The atmosphere** (`site/atmosphere.js`, on the stage): slow smoke
  behind the whole page in deep navy, teal, blue and green with a faint
  warm vein (domain-warped noise at a quarter of the screen's resolution),
  brightest over the hero, drifting as you scroll, leaning away from the
  pointer, lit around the hero figure in its live grade colour. Over it,
  **ink** (`site/ink.js`, a stable-fluids simulation on the GPU): moving
  the pointer pours ink in the brand's colours along its path and stirs
  it, scrolling stirs it, and now and then a drop falls in on its own. It
  stays ink in dark water (thin, fading in a couple of seconds, never more
  than 60% cover) so text over it reads. Never purple. Reduced motion: one
  still frame of smoke, no ink.
- **The figure on the stage** (`site/stage-body.js`, wide screens): beside
  the questions its bones draw out, then your scroll scrubs one squat (a
  boxed tag on the knee reads the angle) while the camera walks round it;
  beside "Try it on your next set" it raises its arms in a jumping jack,
  ending in green at the bottom of the page. It travels with its section,
  in the free space measured beside the text.
- **The calibration intro** (`site/boot.js`): the first visit in a
  session (not a link into a section, not reduced motion). MediaPipe's 33
  points start scattered across the screen and lock onto a standing figure
  one by one, top to bottom, while a big outlined counter climbs to 33;
  the bones draw in, glowing; a scan passes down the figure; a horizon
  line runs out to both edges; then the screen splits open along it, top
  half up and bottom half down, with a flash on the line, which is where
  the hero's own horizon sits, and the hero arrives. At least 2.4 s, at
  most 5 s; it waits for the hero's 3D and the fonts.
- **Things grow out of what you clicked** (`ui/popup.js`): exercise-card
  popups, the trainer's confirms and onboarding (the page behind blurs and
  dims; closing runs back into the trigger); trainer screens grow out of
  the button or card that opened them (`showScreen`, `growFrom`), or out
  of the middle when nothing was pressed, as a panel that dissolves while
  the content rises (`wash`), so there's never an empty pause; the skill-tree panel grows out of
  the skill you picked; "Target reached" bursts out as a circle; toasts pop
  open from a dot and close back into one.
- **The footer wordmark** is as wide as the page, outlined "Vertex" and a
  gradient "Form", cut off by the bottom edge, and rises into view as you
  reach the end (scrubbed by scroll).
- **Blur only where something is moving fast**: directional motion blur on
  slides, screen changes, nav glides and rolling digits (the owner's rule).
  Things arriving (headings, cards, answers, section numbers) rise cleanly
  with no blur: blur-in reveals were the most "AI template" thing on the
  page. Live background blur (a
  frosted nav) is not used: it costs every frame.
- **Stages open out of a frame** (`scroll-fx.js`): the Form
  Lab stage grows from a narrow, rounder frame to full size as you scroll
  to them (clip-path, scrubbed).
- **Coach cues show the voice** (`site/coach.js`): while a cue plays, its
  card lights in its score's colour and the play button becomes five bars
  moved by the real audio (an analyser on the coach's output).
- **Scores count up the scale on the homepage too** (`scroll-fx.js`): the
  scoring test results and example chips climb from 0 through each grade
  colour as they come into view; the example chart's bars grow up in turn.
- **The page scrolls in, not down** (`site/scenes.js`, ≥1100 px wide and
  ≥620 px tall, motion allowed). Every section is at least a full screen, a
  scene, its content centred when shorter. Where two scenes meet, the page
  holds still for one screen of scroll and the camera moves forward
  instead: the scene you leave stays where it was, grows and fades as it
  passes you; the next is already in place, coming up from small and faint.
  The hero dives into the figure (it grows about 3.6× around it). Inside a
  scene you read as usual. One transform and one opacity on the two
  sections at a boundary; scroll-progress.js measures layout boxes
  (offsets) so a measure mid-transition isn't thrown off. Narrow screens
  and reduced motion keep the plain page. Measured 60 fps (p95 16.7 ms).
- **The exercise ring** (`site/ex-ring.js`, wide screens, motion allowed):
  all eighteen exercises as cards on a tilted ring round the section's
  heading. The section holds still while the scroll turns the ring; it
  also turns slowly on its own, pauses under the pointer, and a card that
  gets keyboard focus turns to the front. Cards always face you; the back
  of the ring fades behind the heading. The five main cards open their 3D
  popup; the other thirteen link to their plate in the library. A mono
  reading names the card at the front. Narrow screens and reduced motion
  keep the grid.
- **Section rules** (`site/sections.js`): each section opens like the
  hero's instrument: "N°01" and the section name in mono on the left, a
  hairline that the scroll draws across as the section arrives, ending in
  a dot, and on the right a reading counted from the section itself ("18
  exercises", "4 steps"). Numbered as the side rail numbers them. (They
  replaced the big outlined section numbers in Nov 2026.)
- **Exercise cards do their rep on hover** (`site/card-reps.js`): the
  still figure is swapped for the trainer's live loop, coloured by its live
  score (coral at the top, green at depth), and swapped back on leave.
- **Reaching an A in the Form Lab** (`site/lab.js`): the moment your
  sliders take the score from below 90 into an A, the number stamps down,
  and a green ring shocks out.
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
  trainer), .9 s on one smooth curve that moves from the first frame,
  sized to just reach the farthest corner, with a glowing green rim riding
  its edge (scaled by transform); the old page sinks back toward the click
  and dims. No blur: blurring two full-page snapshots every frame made it
  stutter. Hovering a link to the trainer pre-renders it (speculation
  rules), so the circle opens onto a page that's already there: the inline
  `pagereveal` script in each page's head + `css/transitions.css`.
- **No custom cursor.** Tried twice in Oct 2026 and removed at the owner's
  request: the Mac pointer kept showing alongside it. Use the system pointer;
  `cursor: grab` on things you can drag.
- **Removed in Nov 2026, don't bring back**: click sparks and magnetic
  buttons (`sparks.js`, `magnet.js`), the scrolling fact strip
  (`ticker.js`: it repeated the hero and its clip count went stale), cards
  that tilt toward the pointer with a sheen (`tilt.js`), text that decodes
  from random glyphs (`decrypt.js`, `ui/scramble.js`), and the light that
  followed the pointer (`glow.js`). All were React Bits style effects; side
  by side with Linear, Raycast and Apple they were what made the page look
  generated. The closing band was a full grade-gradient wall; it's now a
  quiet close with the scale as one thin bar.
- **The hero's exercise switch is a ruler**: a hairline with the chosen
  exercise marked by a short bar in the live grade colour, not boxed tabs.
- **Not the template look.** Before adding motion, check it isn't one of
  the stock "AI site" tells: blur-in on every reveal, sparkles or confetti
  on every click, scrambled text everywhere, glow on everything, the same
  fade-up stagger on every block. Each effect should belong to one place
  and say something about measuring a body.
- Nothing loops just for decoration: the figures are always doing an
  exercise, and only while on screen.
- `prefers-reduced-motion`: everything jumps straight to its end state.
- Nothing flashes on load: the hero headline is hidden from the first
  paint until it rises (`split-wait`, set inline, never longer than 2.5 s),
  the flat fallback figure only shows if the 3D hero hasn't loaded within
  2 s, and placeholders are dim dashes, not made-up scores.
- Popups that fly a figure land it on the same pose: the exercise popup
  flies the card's still drawing (the bottom of the rep), not whichever
  frame its hover loop was on.

## Layout

- Content width 1200px, gutter `clamp(1.25rem, 4vw, 2.75rem)`.
- 1400px and up: the side rail (a ruler with one tick per section) replaces
  the header links.
- 860px and down: header links hide. 480px and down: Settings is just a gear.
- Every page works at 375px wide with no sideways scroll.
- Phones (480px and down) in the trainer: header buttons never wrap (the
  title wraps and centres; a row of actions drops below it), option rows
  put the label above its choices, and the menu's links scroll in one row.
- Loading: a skeleton of the same shape and height as the real content,
  shown only if loading takes over 150 ms.
- The footer is a small sitemap on every site page: the brand line, then
  Train, Learn and About columns of links (mono uppercase heads), and a
  credit line under a hairline. Generated pages copy it from `index.html`
  (`tools/page-shell.mjs`), so change it there.
- Other pages: the exercise library, What's new and Privacy share the
  homepage's header and footer (`tools/page-shell.mjs`); the 404 is a
  single centred block on the drafting grid with a solid homepage button
  and two outlined ones, every path absolute.
- Fonts used above the fold are preloaded in each page's head, so text
  never reflows as they arrive (keep layout shift under 0.1).
- Share card: `public/og.png` (1200 by 630), drawn by `tools/make-og.mjs`
  from the real exercise count. Canonical and share URLs are the clean
  ones (`/exercises`, not `/exercises.html`: Cloudflare redirects those).

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
- The Privacy page (`privacy.html`, `tools/make-privacy.mjs`) says this in
  plain words, and `tests/privacy.test.mjs` holds the code to it: no
  cookies, no analytics beacons, nothing POSTed. If what's stored changes,
  change the page.
