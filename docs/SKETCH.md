# SKETCH: letters built like a CAD sketch

The one design ANY-INK builds for sketched letters. Written 10/16/2026 after Gate 2, revised the
same day after review (section 13). This replaces "draw it with the Brush" as the only way to make
a letter yourself. It does not replace the photo flow or the Brush; it sits beside them.

Sources: the Gate 2 run (Brennan's words below), the dead-end replay in real Chrome
(scratchpad `sketch/dead-end/`, screens 01-27), two concepts ("Sketch mode" and "Smart pen"), the
CAD and font-tool research, the code map, and the review of the first draft. Every file and
function named here was checked in the repo on 10/16/2026.

---

## 1. What went wrong at Gate 2, and the principles

### What he said

> "when to try and brush in my own letter, i did, looked horrible. looked around for what next or
> a way to improve it. lost, stuck and disappointed. i was hoping to see a way to make curved
> splines/lines and make shapes for letters like i do in solidworks. all i had was a brush...
> lame. closed it there."

### What actually happened (measured in the replay)

1. **The empty letter offered only Brush and Select.** The Point pen, Edit points, Rectangle and
   Oval exist in Simple but sit behind "Fine-tune this letter", and an empty letter has no
   Fine-tune toggle (`letter_card.js` draws it only when `state.hasShapes`). The only way in was
   the hidden P / E keys.
2. **The Brush kept his hand shake almost 1:1.** Mouse wobble of 4.5-4.8 px came out as 3.7-4.4 px
   of wobble in the ink; the stored centerline turned 28 and 25 times where a clean stroke turns
   about once.
3. **There was no way to improve it.** Edit points showed 90-94 points around the edge of the
   ink, not the few points of the line he drew. The thickness slider changed only the next stroke.
   The stored centerline (`glyph.anyink.nib.strokes[].skeleton`) is written and never read again.
4. **Nothing said what was missing or wrong.** After [Sit on the line] the wobbly a was Ready and
   the next step was [Save]. Nothing said "this is bumpy", and nothing compared his a with what an
   a looks like.

### Principles

1. **CAD-like construction.** He sketches parts every day. Letters are built the same way: lines,
   arcs, splines and circles, snapped to datums (the writing lines), joined end to end, tangent
   where they flow, corners where they turn. Two ways, same tools:
   - **Centerline** (the main way): sketch the middle of the stroke; a thickness builds the letter
     around it (a sweep path with a round profile).
   - **Outline:** sketch the outside as closed loops; loops inside loops are holes (a profile
     before an extrude).
2. **The sketch is the part; the ink is the feature.** The sketch is the source of truth. The ink
   is always rebuilt from it. In Simple you never edit the ink directly. So every letter can
   always be improved: move a point, bend a curve, change the thickness, redo one piece.
3. **A datum does what a datum does.** A Centerline point snapped to a writing line puts the
   **edge of the ink** on that line, never the middle of the stroke (section 6). One rule for ends,
   curve tops and corners.
4. **Never a dead end, never a fake Ready.** After every action the Next line names one next step.
   A letter is not Ready while a piece it needs is missing, while a stroke is bumpy, or before he
   has seen it next to the guide letter once (section 7, Compare).
5. **Plain words.** His CAD words are house words: Line, Arc, Spline, Circle, Sketch, Centerline,
   Outline, Thickness, Mirror line, Helper line, Inside loop, point, smooth, corner. Banned words
   stay banned (no "path", "node", "contour", "Bezier", "baseline", "x-height", "counter",
   "offset", "transform"). Font units never show; sizes read in inches.
6. **Simple's rules stay:** one green button per screen, everything undoable with a named Undo,
   every color a token (purple = structure, green = what you are touching), no typed numbers
   (readouts only, beside a visual control), mouse and keyboard on Windows 11 in Chrome.
7. **Findable from the first screen, quiet after that.** The sketch tools live on the tool column
   and behind the empty letter's one green door. Never behind Fine-tune. Cards show the few
   buttons that matter now; the rest sit under **More**.

---

## 2. The tools

### On the tool column (Simple, flag `sketch`)

```
+--------+
| Brush  |  B
|--------|
| SKETCH |  (small purple heading)
| Line   |  L
| Arc    |  A
| Spline |  S
| Circle |  C
|--------|
| Select |  V
+--------+
```

Keys checked against `src/anyink/mode/keys.js` on 10/16/2026 (B N V A E P H W R M O Q U taken; L
S C free). **In Simple with `sketch` on**, keys.js remaps so every shape key makes a sketch:

| Key | Simple with `sketch` on | All tools (unchanged) |
|---|---|---|
| L | Line | - |
| A | Arc (Select keeps V) | Select |
| S | Spline | - |
| C, O, Q | Circle | O / Q: Oval |
| R | Rectangle as a closed loop of 4 Lines (corners) | Rectangle |
| P | Spline (the sketch replaces the Point pen in Simple) | Point pen |
| E | Select on the sketch | Edit points |
| V | Select | Select |

T stays free (Fusion users read T as Trim; trim is left for later). The Point pen, Edit points,
Oval and Rectangle stay in All tools. "Draw it with points" leaves the empty letter (section 7).
Space stays Pan, Delete / Backspace stay Delete, Escape is caught by the sketch tool before
`closeDialogs` while a piece is open.

**Every rail button and every card button prints its key** (small gray letter in the corner), so
A, Y and X are findable without a tip.

### How every sketch tool behaves

- **Chaining, the SolidWorks way.** Every click adds a point to the open **piece**. From an open
  end, what you get depends on how the pointer leaves the end, as in SolidWorks' autotransition:
  - leave **along** the curve (within 20 degrees of the end's direction, judged once the pointer
    is 1.5x the snap radius away): the next part leaves **tangent**; a faint purple tangent line
    shows it;
  - leave **at an angle**: the next part starts at a **corner**; no tangent line shows.

  Switching tools while a piece is open (press A, S or L) follows the same rule. This is how e's
  bar meets its bowl, n's arch leaves the top of its stem and B's bowls meet the stem: at corners,
  by leaving at an angle.
- **Who gives way at a tangent join.** The part you are drawing now wins; the part before it
  bends to meet it. A Spline's end direction turns to match a following Line; an Arc followed by
  a tangent Line becomes a curve tangent at both ends (section 8). **A Line's clicked end is never
  moved.**
- **Finish a piece:** Enter, **double-click** (the last click is not doubled), a **right press**
  (S2: the browser's menu is kept away while a sketch tool is picked), or Esc (open piece); or
  click the piece's first point (closed loop; the first point grows a green ring when the pointer
  is on it, reusing `new_path.js isOverFirstPoint`). **A second Esc** with no piece open goes back
  to Select. Leaving the letter mid-piece finishes it on its own letter (the `new_path.js
  leaveLetter` pattern), and so do another tool, a save (Ctrl+S, Save As, a download) and Use in
  Word. **A stray first click** alone is let go of, never stored: by Esc, by leaving, by another
  tool (S2 finalize); a dot is deliberate (Enter on one point, or a double-click in place, "put a
  dot on small i").
- **Take back:** while a piece is open, every Undo (Ctrl+Z, Backspace, the top bar's Undo button,
  the Undo toast) takes back the last click; the top bar Undo's tooltip says "Take back the last
  point". Details and the other entry points: section 7, Undo while a piece is open.
- **Snaps** (section 6) show while hovering. **Shift** locks the next part to level, plumb or 45
  degrees (same as `path_edit.js` today). **Hold Ctrl** to turn snapping off for that click. (Not
  Alt: a lone Alt press moves focus to Chrome's menu on Windows.)
- **Readout at the cursor (Line):** while a Line part is being drawn, a small gray label next to
  the cursor shows its length and angle, "0.62 in, 90°", never typed. Lengths read as if the
  capitals were 1 in tall (the same scale as the thickness readout, section 3).
- **What it draws:** the sketch in **structure purple** (lines 1.5 px, points 7 px dots: filled =
  stuck to a line or another piece, hollow = free to move); the point or piece under the pointer
  and the picked ones in **green**; the ink rebuilt under it in the normal ink color. Helper lines
  dashed purple, never inked. Any piece that makes no ink carries a small canvas label: "helper
  line" or "gap: not filled yet" (an open Outline piece).
- **Degenerate pieces:** a 1-point Centerline piece is a **dot** (the nib alone, for i and j); a
  1-point Outline piece is removed when it ends; a 2-point Spline is stored as a Line; a Circle
  dragged less than the snap radius is a 1-point piece (dot or removed, as above).

| Tool | Key | Mouse | What you get | CAD match |
|---|---|---|---|---|
| **Line** | L | Click, click, click. **Click-drag** draws one line and ends. Pull back over the last end and away again: the next part is a **tangent arc**; do it again to go back to a line. | Straight parts with corners; tangent arcs where you pulled back | SW Line + autotransition |
| **Arc** | A | From an open end: one click sets the end, the arc leaves tangent (or from a corner, per the chaining rule). Fresh: click start, click end, then move to set the bulge and click. | A circular arc, stored as ends plus bulge (section 8), built as cubics split every 90 degrees | Tangent Arc / 3-Point Arc |
| **Spline** | S | Click points; the curve runs smoothly through them (Hobby's method, section 9). Click-and-drag on a point to aim its direction. 3-6 points is the sweet spot; the tooltip says "Fewer points, smoother curve." | A smooth curve through your points | Through-point spline |
| **Circle** | C (O, Q) | Click the center, drag the size; Shift while dragging for an oval. **Or click on one writing line, then on another:** a circle that fills the space between them (section 6). | A real circle (center and size) until a point is moved on its own | Circle / Ellipse |
| **Rectangle** | R | Click one corner, click the other | A closed loop of 4 Lines | Corner rectangle |
| **Select** | V (E) | On a sketch: pick, window-pick, drag points, grips and pieces (section 5). On ink with no sketch: today's Select. | - | Select |

**Level at the top, plumb at the side.** When a smooth Spline or Circle point snaps to a level
line (writing, small-letter, capitals, top or tail line), or is the piece's highest or lowest
point, its direction locks **level**; a point that is the piece's leftmost or rightmost, or sits on
the Mirror line, locks **plumb**. Shown as a small purple tick through the point. So the true top
of an o or an arch is the point itself, and the curve flows over it the way a SolidWorks spline
with a horizontal relation does. A drag 3x the snap radius off the line releases it ("let go of the
level").

As built in S1 (`sketch/extremes.js lockFor`, D-048):

- **Touch, not cross.** A point on a line locks only where the curve **touches** the line (both
  neighbors on one side). Where the stroke **crosses** the line (a diagonal through the
  small-letter line) the point keeps on-a-line but gets no lock, and the edge rule puts it on the
  line itself (section 6).
- **Only near level or plumb.** A level or plumb lock is added only where the curve built without
  it already runs within 25 degrees of level / plumb there, and both chords to its neighbors lie
  within 75 degrees of it (SolidWorks adds a horizontal relation only to a line already close to
  it). So a narrow peak (a teardrop's point, a pointed arch) stays free; forced level, it would
  balloon. A peak that sharp wants a corner point.
- **Every bowl's own extremes,** not only the piece's: the upper bowl of an s locks plumb on its
  left although the lower end reaches further left.
- **The Mirror line and the letter's middle lock level,** not plumb: a curve that is its own mirror
  image crosses its mirror line level (the top of an O, the bottom of a U).

### Tips (`coach/tips.js`)

- **First Line pick, on hover of the Line button, and whenever Arc is picked right after a Line
  end once the Arc tip has been seen:** "Click, click. Double-click, right-click or Enter to
  finish. Drag once for a single line. Pull back over the last end for an arc."
- **Arc** (first pick, and first on Arc right after a Line end, where its end click waits for a
  bend click after a corner): "From an open end, one click sets where the arc ends. Or click the
  start, the end, then how far it bends; that finishes the arc." While the bend waits, the cursor
  says "click to set how far it bends". (S2 finalize.)
- The sketch tips have **their own 3 a session**, apart from the other tips' 3 (S2 finalize), so
  the Brush and photo tips never use them up.
- First Spline pick: "Fewer points, smoother curve."
- First pick of anything on a sketch: "Filled dot: stuck to a line or another piece. Hollow: free
  to move." (also in the glossary)
- The first time a tag shows the top line or the tail line, it adds a few words: "tail line: where
  g, p and y hang to", "top line: where b, d, h and l reach".

### Buttons under More (no rail button; key printed on each)

- **Mirror line** (Y): click once to drop a plumb purple dashed line. From then on, every point
  drawn on one side makes its twin on the other, live and linked (section 6). Click the line and
  press Delete to remove it; the twins stay as ordinary points.
- **Helper line** (X, on a picked piece): turns the piece dashed and leaves it out of the ink.
  Press again to ink it.

---

## 3. Centerline + thickness

### What it is

An open piece (or a closed loop in Centerline use, like the ring of an o) is the middle of the
stroke. A round nib of the chosen thickness is swept along it. This is what the Brush already does
with its stored centerline, so the sweep engine is reused unchanged.

### Thickness

- **One slider, thin to thick**, alone at the top of the card on any letter with Centerline ink.
  It applies to every Centerline piece in the letter (one thickness per letter so stems match).
- **The font's thickness.** `settings.anyink.sketchThickness` (font units, `null` until first
  set). A new sketched letter starts at it; while it is `null`, at the Brush default
  (`brush_size.js brushSize(project)`: 9 % of the small-letter height, or the pen weight from the
  photos once 3 letters are traced). **The font value wins over `brushSize`** once set, so a later
  `penWeight` never changes his sketched letters. The range is the Brush's: `MIN_SHARE` 3 % to
  `MAX_SHARE` 24 % of the small-letter height.
- **Moving the slider on any letter** re-inks that letter and sets the font's thickness for every
  new sketched letter. If other sketched letters have a different thickness, the Next line asks
  "Use this thickness on all 5 sketched letters?" [Use on all] (green) [Just this one]. [Use on
  all] re-inks the letters that already exist, in chunks of a few letters per animation frame
  behind a "Rebuilding letters..." pill, as **one** whole-font history step ("set the thickness
  for every sketched letter").
- **Readout beside it, never typed:** "0.05 in wide on 1 in capitals". It is the stroke width if
  the capitals were printed 1 in tall: thickness / capitals-line height, in inches. Example: 99
  units with the capitals line at 1,400 reads "0.07 in". Its hover hint: "How wide the stroke is
  when the capitals are 1 inch tall."
- **While dragging:** the real sweep (`sweepRoundNib`, about 20 ms a stroke after the B8 + B9
  batching fix), throttled to animation frames, without the refit, so nothing jumps on release.
  On release: the refit, **one Undo step**: "changed the thickness of small n". Points pinned to a
  line move with the thickness so the ink edge stays on the line (section 6).

### Ends

- **Round** (default) or **Flat**, set for the letter in Fine-tune (the default for every end),
  and per end point in the picked point's More fold ("This end: Round / Flat").
- **Round:** `inkSkeleton` as the Brush does today. No tucking: the edge rule (section 6) already
  places a pinned end's center half a thickness inside the line, so the round cap touches the line
  at any angle.
- **Flat**, open pieces: the flattened centerline through clipper2-ts `inflatePathsD` with
  `JoinType.Round` and `EndType.Butt` (checked present in `node_modules/clipper2-ts/dist`), then
  `refitOutline` with the butt corners passed as fixed corners. **A Flat end pinned to a line is
  cut along that line**, not square to the stroke: the end is extended straight past the line and
  the ink is clipped by the line (clipper2 intersect with the half-plane), so a slanted stroke
  stands flat on the writing line with no corner hanging below.
- **Closed** Centerline pieces have no ends: `EndType.Joined` with `JoinType.Round`.
- Where an end lands on another piece ("joins"), the end is always Round, so the joint fills in
  (the bowl of a meets its stem with no nub).
- Test: the Flat-end corners stay corners after `refitOutline` (the corner points survive within 1
  unit).

### Nib shapes

v1: round only. The sweep (`sweep.js stepHull`) takes any convex polygon, so an angled flat nib is
one more polygon later (M10, "Nib brush").

### Reuse of `src/anyink/nib`

| Need | Reused as is |
|---|---|
| Centerline to cubics | `sketch/curves.js` (new) outputs `[[p0,h1,h2,p3], ...]`, the skeleton format the Brush already stores |
| Sweep + union | `sweep.js sweepRoundNib(skeleton, size)` (24-sided nib, unions 8 hulls at a time) |
| Outline to whole-number curves | `ink.js inkSkeleton` -> `refit.js refitOutline` -> `stroke_shapes.js` |
| Default and range | `brush_size.js brushSize`, `penWeight`, `MIN_SHARE` / `MAX_SHARE` |
| Slider look | `size_control.js makeBrushSection` (same thin-to-thick control) |
| Commit pattern | `commit.js commitStroke` (add shapes, tag, `checkForFirstShapeAutoRSB`, `addState`, publish) |
| Tags, Undo keys | `stroke_record.js` as the template for `sketch/sketch_record.js` |

### Overlaps in the font file

Sketched letters always overlap (one shape per piece, round ends at joins). Today only
`install/word_export.js` sets `mergeOverlaps`; the File menu and Ctrl+E write overlapping contours.
**Fix (S3):** `font_export.js glyphToContours` merges overlaps for any letter that has sketch-built
or Brush-tagged shapes, on every export path. S3's verify script exports through the File menu and
checks the file has no overlapping contours in a sketched letter.

---

## 4. Closed outline

### What it is

Each closed loop in Outline use is an outside or inside line of the letter. Nesting decides solid
or hole: depth 0 solid, depth 1 hole, depth 2 solid again (an island in a hole), and so on.

### How it is built (`sketch/build_outline.js`, pure)

1. Flatten every Outline loop of the letter. Compute each loop's depth **only among sketch
   loops** (photo, Brush and other shapes are never looked at).
2. Turn each loop to the direction its depth needs (solid = +1, hole = -1 under the nonzero rule).
3. **No crossings** (checked on the flattened loops): keep the built curves exactly, one shape per
   loop, whole numbers.
4. **Loops that cross** each other or themselves: first resolve each self-crossing loop on its own
   with clipper2 `FillRule.NonZero` (keeps both lobes of a figure-8), turn the pieces to their
   loop's role, then union everything with `FillRule.Positive`: overlapping solids join, a hole
   that pokes past its outer loop makes no ink outside the letter, an island in a hole stays.
   Refit the result with `refitOutline`. A crossing loop still raises the Next line (section 7).
5. **Never** `auto_hole.js autoHole` on built shapes: it merges holes, joins ink around holes and
   looks at every shape in the letter, which would break the one-shape-per-loop tags.
   `auto_hole.js` skips built shapes the way it skips Brush strokes.

### Words and states

- An **open** piece in Outline use is drawn purple, labeled "gap: not filled yet", and not inked.
  Next line: "The outline of small n has a gap. Click its first point to close it." [Close it]
  (joins the two ends with a Line).
- A loop that **crosses itself**: "A loop on small n crosses itself. Drag a point to untangle it."
  [Show me] (zooms to the crossing, marks it with the amber needs-a-look token).
- Holes are never named as anything but "hole" ("counter" is banned).

### Inside loop (Offset Entities, in house words)

A picture button under the picked closed loop's More fold, also offered by the Next line after the
first outer loop of a letter that needs a hole (o, a, e, B...): **[Inside loop]**. Drag inward from
the picked loop: a linked loop appears a fixed wall away, shown as a readout "wall 0.06 in"
(same 1 in capitals scale), never typed. It is built from the outer loop's built curve with
clipper2 `inflatePathsD` (negative delta, `JoinType.Round`), refit to few points. **It stays
linked:** edit the outer loop and the inside loop follows. Dragging one of the inside loop's own
points unlinks it (it becomes an ordinary loop; toast "The inside loop of small o is on its own
now." [Undo]). Default wall: the font's thickness, so an outline o matches a Centerline o.

### Circle, Spline and Line in Outline use

Same tools, same snaps. An o is a Circle plus [Inside loop], or two Circles (the inner one becomes
a hole by itself). A B is one Line-and-Arc loop plus two inner loops. A thick-and-thin o is an
inner Circle dragged as an oval (Shift) and moved off-center.

---

## 5. Editing afterwards, and fixing a Brush letter

### Select (V) on a sketched letter

```
+-------------------------------------------------------------+-------------+
|  - - - - - - - - - - - - - - - - - - - - capitals line      | small n     |
|                                                             | Thickness   |
|  - - - - - - - - - - (o)======(*) - - - small-letter line   | thin-[=O-]  |
|                   |  //        \\                           | 0.07 in wide|
|                   | //          [O]--<>--->   <- green: the  | on 1 in caps|
|                   | ||           ||    grips   picked point  |-------------|
|                   | ||           ||                         | Point       |
|  ============(*)==(*)==========(*)======== writing line     | [Smooth] Q  |
|                                                             | [Corner]    |
|  (*) filled = stuck to a line or another piece              | [Delete]    |
|  (o) hollow = free to move          green = picked          | More v      |
|  faint gray letter behind = the guide letter                | Fine-tune > |
+-------------------------------------------------------------+-------------+
```

**Picking**

| Do this | What happens |
|---|---|
| Click a point or a piece | Picks it (green) |
| **Ctrl+click** | Adds it to the pick, or takes it out |
| **Drag a window** on empty canvas, left to right | Picks what is fully inside |
| Drag a window right to left | Picks everything it touches (SolidWorks' crossing window) |
| Click empty canvas, or Esc | Clears the pick |

**Editing**

| Do this | What happens | Undo title |
|---|---|---|
| Drag a point | It moves; tangent neighbors turn with it; relations hold (section 6) | "moved a sketch point on small n" |
| Drag an **unpicked** curve | **Bend:** the curve bows toward the pointer; the app sets the directions (Figma's Bend). An **Arc** stays an arc: its ends stay put and its bulge (size) changes, as in SolidWorks. A Line moves whole, joined ends follow | "bent a curve on small n" / "moved a line on small n" |
| Drag anything in a pick that is a **whole closed loop or 2+ pieces** | **Moves the whole pick**; Shift locks it level or plumb | "moved part of small n" |
| Drag a **corner handle** of such a pick (purple squares at its box corners) | **Scales it** about the opposite corner, keeping its proportions; Shift scales freely. Thickness never scales. One step on release | "resized part of small n" |
| Drag the **edge of a Circle** | Resizes it about its center; Shift-drag makes it an oval. It stays a circle until one of its points is moved on its own | "resized a circle on small n" |
| Drag a grip on a picked smooth point | SolidWorks grips: **diamond** = direction only, **arrow** = pull (tension) only, **circle** = both. Once dragged, that point's direction is locked | "aimed a curve on small n" |
| **[Let it flow]** (shown on a picked point whose direction is locked), or double-click a grip | Clears the lock; the auto-smooth takes the point back | "let a curve flow on small n" |
| Double-click a point, or [Smooth] / [Corner] | Toggles the point kind; reuses `letter/point_kind.js` words and rules | "made a point smooth on small n" |
| Double-click a piece | Adds a point there | "added a sketch point on small n" |
| Delete on a point | Removes it; the toast names it with [Undo] (`delete_toast.js` pattern) | "deleted a sketch point on small n" |
| Delete on a picked piece or pick | Removes it; ends stay if joined to others | "deleted a piece of small n" |
| Shift while dragging | Level / plumb / 45 degree lock (as `path_edit.js`) | - |
| Arrow keys | Nudge the picked points (existing `nudge` rule); one step per key run | "nudged sketch points on small n" |

Every drag shows the live ink per tick (the real sweep for Centerline pieces, throttled to
animation frames; Outline loops drawn filled directly) and pushes **one** history step on release,
which rebuilds the real ink inside that step.

### The card on a sketched letter

Few buttons, the rest folded. In order:

- **Top, always (when the letter has Centerline ink):** Thickness and its readout.
- **A picked point:** [Smooth] [Corner] [Delete]; [Let it flow] only when its direction is
  locked. **More:** "This end: Round / Flat" (end points only).
- **A picked piece:** [Redraw this piece] [Fewer points]. **More:** Centerline / Outline switch,
  [Helper line] X, [Inside loop] (closed loops), [Mirror line] Y.
- **Fine-tune** (letter-wide, as today plus): Ends for the letter, [Make it an outline], [Show
  where the centerline was] (after Make it an outline), [Use this thickness on all letters], and
  its four switches.

### Change thickness, ends, use

- Thickness and Ends: section 3. Re-ink the whole letter, one step.
- **A letter keeps the way chosen at its door** (Centerline or Outline). The per-piece switch
  lives under the picked piece's More fold:
  - A closed loop can be either. Switching keeps the loop and changes what it means.
  - An open piece cannot be an Outline: the switch shows "Close it first" and [Close it].
- **Make it an outline** (Fine-tune, Centerline letters): every Centerline piece becomes Outline
  loops that look the same (the built ink's loops, refit to few points, corners at its notches).
  The old centerline is kept as hidden helper lines; [Show where the centerline was] in Fine-tune
  shows them. One step: "made small n an outline". The Next line then teaches the payoff once: "Now
  drag a loop's inside to make some parts thinner." [Show me] (animates dragging the inside of the
  arch down).

### Redo one piece

**[Redraw this piece]**: the picked piece turns faint; he draws a new one with any sketch tool.
When he finishes, it replaces the old one in one step and keeps its joins: its two ends snap to
the old piece's ends if they land within the snap radius. With two points picked on one piece,
only the stretch between them is redrawn.

**[Fewer points]**: refits the picked piece with about half the points, keeping corners (vendored
`simplify-js` + `fit.js`). Press again until clean. One step each.

### Fixing a Brush letter (the dead end)

```
+------------------------------------------------------------------+
| Next: The stroke on small a is bumpy. Make it a sketch you can   |
|       fix point by point.                    [Make it a sketch]  |
+------------------------------------------------------------------+
```

1. **The Brush record follows the ink first (S6, before Make it a sketch ships).**
   `stroke_record.js strokeSkeleton` today only shifts the stored centerline by the stroke's
   lower-left move, so after Match size, Shrink to fit, Flip or an Edit-points change it no longer
   matches. Every follow plan (section 7) also applies its matrix to `skeleton` and its `grow` to
   `size`.
2. **Make it a sketch.** Sweeps the stored centerline and compares it with the stroke's current
   shapes. If they differ by more than half a nib anywhere (an edit we could not follow), it takes
   a centerline from the ink instead (thinning the ink on a 2-unit grid, Zhang-Suen, in-house).
   Then: split at sharp corners (`geometry.js turnAt`), simplify (`simplify-js`, tolerance a
   quarter of the thickness) and refit each run with as few Spline points as stay inside that
   tolerance (4-8 a stroke). Adds a point at each curve's leftmost, rightmost, top and bottom with
   level or plumb locks (section 2). Ends near a writing line are pinned by the edge rule. The
   stroke becomes a Centerline piece with the same thickness. One step: "made Brush stroke 1 a
   sketch".
3. **The Bumpy check** (new B11 check, `src/anyink/checks`; measure in `sketch/bumpy.js`, S1):
   - **Measure:** sample the centerline every quarter thickness, smooth it over a window of half
     the thickness, and count **bumps**: places where the curve's turn changes side (left to
     right or back) after turning at least 8 degrees since the last change.
   - **Bumpy** when a piece has **3 or more bumps and more than 4 bumps per 1,000 font units**
     (units of a 2,048-unit letter box: a font at another upm has its length scaled by 2,048 /
     upm first, so the same drawing gets the same verdict in any font),
     and only for Brush strokes and sketch pieces longer than 6x the thickness (so the ear of r,
     a short tail, a dot, the end of a and the hook of f never count).
   - Tested on clean sketched a, r, s, e, B (0 bumpy) and on the replay's two strokes (both bumpy).
   - Every caller passes the font (`bumpyPieces(sketch, skeleton, { font: project.settings.font })`);
     without it the rate assumes a 2,048-unit letter box.
   - "Needs a look: bumpy line". Fix button: [Make it a sketch] (Brush) or [Fewer points]
     (sketch). [Looks fine to me] still works.
4. **No fake Ready.** A letter with an open Bumpy check is amber, not Ready, like every other B11
   check; "Sit on the line" no longer ends on Ready while Bumpy is open.
5. **The Brush line.** Rule 15 (nextLetter) holds the calm Brush line; while the Brush is picked
   and the last stroke is bumpy, it gains the outlined [Make it a sketch].
6. **The Brush slider** gains the same live re-ink once a stroke is a sketch. Raw Brush strokes keep
   today's "next stroke only" rule.

---

## 6. Construction and snapping

### Datums (snap targets, drawn as today's purple guide lines)

- The five writing lines from `placement/classes.js guideLines(font)`: top line, capitals line,
  small-letter line, writing line, tail line, named as the house words in
  `letter/guide_lines.js simpleGuideLines` and `words/sets/core.js` ("small-letter line", never
  "small-letters").
- **Half-way lines** (center snaps only): half-way between the writing line and the small-letter
  line, and between the writing line and the capitals line. Shown dotted only while something
  snaps to them; a Circle's center and a Bar part use them.
- **The letter's left and right edges and its middle: only while the letter's spacing is set by
  you** (`spacing/owner.js` 'manual'). While spacing is automatic (Simple's default), spacing
  moves the edges after every step, so pinning to them would chase itself; instead the ink's own
  middle shows as a temporary hint while drawing (never stored).
- The Mirror line, when there is one.

Snap radius: `metrics/hit_test.js hitZoneEm(view, HIT_ZONE_PX)`, so it is the same number of
screen pixels at every zoom.

### The edge rule (Centerline pieces): the ink edge sits on the line

One rule, written down as decision D-047 point 3:

- **A Centerline point snapped to a line puts the edge of the ink on that line.** The center goes
  half the thickness (r) inside it: above the writing and tail lines, below the small-letter,
  capitals and top lines. While a Centerline piece is drawn, these "ink lines" show faintly beside
  the real lines; the tag at the cursor still says "writing line".
- It covers **ends, curve tops and bottoms and corners alike**, at any angle: the round nib's
  lowest point is always the center minus r, so a slanted stem's round end, the bottom of an o, the
  top of n's arch and the point of a v all touch the line exactly. (A Flat end pinned to a line is
  cut along the line, section 3.)
- **Stored** as `on: 'writing', inset: 'edge'` with the point's built position. When the thickness
  changes, every `inset: 'edge'` point is placed again (line plus or minus the new r) inside the
  same step.
- **Round tops and bottoms overshoot** on top of that: a smooth point with a level lock on the
  writing, small-letter or capitals line moves outward by `guideLines(font).overshoot` (the
  code's `ROUND_OVERSHOOT` share, the same value the B11 checks and fixes use). Ends and corners
  never overshoot. Decided per point: a point inside a closed piece or between an open piece's
  ends overshoots even when it also starts another piece (the bowl bottom where q's tail
  starts). Never shown as a number.
- **The thickness the rule uses** is kept at or under the slider's thick end (`thicknessRange`)
  and the small-letter height (`edge_rule.js edgeThickness`), so the ink lines never cross,
  even after the small-letter line is moved. **The S3 sweep uses the same `edgeThickness`,** never
  the raw stored thickness, so the ink width always matches the pinned points.
- **A point where the stroke crosses its line** (its neighbors along the piece on both sides of
  the line) is not an edge: it sits on the line itself, no inset, no overshoot, whatever it stores
  (`edge_rule.js crossingPoints`, D-048). Only points that touch the line are edges.
- **Outline** points snapped to a line sit on the line itself (they are already the edge), plus
  the same overshoot for level-locked round points.
- **Checks agree:** `checks/body_bottom.js penAllowance` gives sketch-built Centerline shapes 0
  (their edge is already on the line; the half-nib allowance stays for Brush ink only). S3 adds a
  unit test that builds an o, n, v and A and runs B11 `measureLetter` on each: all sit on the line
  and are the right size, so Sit on the line never fires on a freshly sketched letter.

### Hints while drawing (Onshape-style)

- Dotted purple line when the pointer is **level** or **plumb** with another point of the sketch.
- **On a line:** the pointer sits on a datum; tag at the cursor names it ("writing line",
  "small-letter line").
- **Joins:** on an existing end ("joins") or on a piece ("on the stem" / "on the curve").
- **Middle** of a Line piece: snapping there stores an `onPiece` relation at t = 0.5, so the point
  stays at the middle when the piece changes later (B's waist follows its stem).
- **Tangent:** while the pointer leaves an open end along the curve, a faint purple tangent line
  shows the direction the next part will leave (section 2, chaining).
- **Between two lines (Circle):** click on one writing line, then on another: a circle whose ink
  edges touch both lines (Centerline: the edge rule; plus the overshoot), centered on the click.
- Hold **Ctrl**: no snapping for that click or drag (read from the mouse event only, never from
  a key flag left over from a shortcut).

As built in S2 (`sketch/tools/snap.js`, `arc_snap.js`, the fix pass):

- **Only the real line pulls.** The faint ink line is where the dot lands, never a second target,
  so the snap band is the snap radius either side of the real line.
- **After a line, edge, level / plumb or Shift snap** places the point, it is checked against the
  sketch's points again: within the radius of one it joins that point (clicking where a loop
  started closes it, never a duplicate point).
- **On a piece and level / plumb at once:** with the pointer on a piece and another point level or
  plumb with it, the point goes where that level / plumb line crosses the piece, and both
  relations are stored (A's bar: level and on both legs). Under Shift, a piece the ray crosses
  within the radius catches the point.
- **Arc tops:** the 3-point Arc's bend and a tangent arc's end (Arc, the Line's pull-back) snap so
  the arc's top or bottom sits where the edge rule puts a round top (tops to the top, capitals
  and small-letter lines; bottoms to the writing and tail lines), the line's name at the top.
  Stored as the arc's bulge / end only (S3 re-places it on a thickness change).
- **Letter edges and middle** snap only while the spacing is set by him; a letter with no
  spacing owner yet counts as automatic in Simple and as set by him in All tools.

### Relations kept after you let go (v1: drag rules, no solver)

| Relation | Made when | A drag does | Point shows |
|---|---|---|---|
| **Joined** | An end snapped onto an end or a piece | Both ends move together; an end on a piece slides along it | filled |
| **On a piece** | Snapped onto a piece, or its middle | Stays at its share `t` along the piece when the piece changes | filled |
| **Tangent** | Leaving an end along the curve, a smooth point | Turning one side turns the other; the earlier part gives way (section 2). A part that would need to be tangent at both ends becomes a curve, not an arc (section 8), so no kink appears | (no dot change) |
| **On a line** | Snapped to a datum | The point slides only along that line; drag 3x the snap radius off to break it ("let go of the writing line") | filled |
| **Level / plumb direction** | A smooth point on a level line or at an extreme (section 2) | The direction stays level / plumb; 3x the snap radius releases it | purple tick through the point |
| **Level / Plumb pair** | Placed while the level / plumb hint showed | The partner point follows on that one axis | small purple tick between them |
| **Mirrored** | Drawn with a Mirror line | The twin moves in mirror image; deleting one deletes both | both filled |

Rules are applied in a fixed order per drag (mirror, then on-a-line, then on-a-piece and joined,
then level / plumb, then tangent), once each. If two rules disagree, the later one wins and the
point turns hollow, and a toast says "Can't keep both: a point of small n let go of the writing
line." [Undo]. No loop, no solver, so nothing can lock up.

**Status:** filled purple = stuck to a line or another piece, hollow = free to move, green =
picked (the first-pick tip says so, section 2). The Next line can say "2 points of small n are
loose" with [Show me] only when a hollow point is within 3x the snap radius of a datum. No red, no
yellow: without a solver nothing is over-defined.

### Mirror line, live and linked

Draw half, the other half follows. Stored as twin points (`mirrorOf`), and the build makes **one**
piece through both halves (Fusion's lesson: mirror the points, not the finished curve), so a
symmetric O, A, V, H, U stays symmetric through every edit and Undo. `mirror.x` is a whole number;
only a follow plan (spacing, Flip, Match size) moves it, so twins never land on half units. While
spacing is automatic it is dropped by eye on the ink's middle hint.

### Left out of v1, and why

| Left out | Why |
|---|---|
| Constraint solver (FreeCAD PlaneGCS, `@salusoft89/planegcs` 1.3.0) | 866 KB unpacked plus WebAssembly, LGPL-2.0-or-later, its spline support is unfinished; drag rules give the CAD feel without it. Reconsider only if drag rules visibly fail. |
| Typed dimensions; **equal size** (B's or a's two curves), parallel, perpendicular as stored relations | Typed numbers break the visual-only rule. "Equal" is the first relation to add later. |
| Over-defined (red) / invalid states | No solver, so they cannot happen |
| Sketch fillet | Smooth points and tangent arcs already round joins |
| Trim by dragging | Needs curve-curve intersection; crossing loops already merge in the build (section 4) |
| Curvature combs | Replaced by the Bumpy check and its plain words |
| Curvature-continuous (G2) joins | Tangent (G1) is what fonts store at smooth points |
| Thickness that changes along a stroke, flat / angled nibs | M10 |
| Pasting a whole letter **with its sketch** | Needs a clipboard path that does not exist; pasted built shapes become ordinary shapes (section 7). Later, the `trace_carry.js` way. |
| Construction from other letters (reuse a bowl in b d p q) | Later; the Parts list (section 7) is the v1 start |

---

## 7. How it fits Simple

### The empty letter: one green door

```
+-------------------- small n is empty --------------------+
|                                                          |
|  [ Sketch it ]  (green)        L                         |
|      Lines, arcs and splines down the middle of the      |
|      stroke, then pick a thickness                       |
|  [ Use a photo ]               From your handwriting     |
|      or drop a photo here                                |
|                                                          |
|  or sketch the outline instead  [2-frame picture]        |
|  More ways >                                             |
+----------------------------------------------------------+
```

- **Green stays put:** [Sketch it] is green on every empty letter, unless this letter has a photo
  part waiting (T2 / T3 of the B16 run unchanged); then [Use a photo] is green and [Sketch it]
  is outlined. No "last way used" rule.
- [Sketch it] picks the Line tool with the letter's way set to Centerline. "or sketch the outline
  instead" (quiet link with a 2-frame picture: loops, then a filled letter with a hole) picks the
  Line tool with the way set to Outline.
- **More ways** (quiet fold): "Draw with the brush (freehand; you can clean it up after)", "No
  photo yet? How to take one", "Start from a part: (Stem) (Bowl) (Arch) (Bar) (Dot)".
- **Replaced:** "Draw it with points" (`empty_overlay.js BUTTONS`) is gone in Simple with `sketch`
  on; [Sketch it] takes its place. "or drop a photo here" stays as one quiet line under the photo
  door; "No photo yet? How to take one" moves into More ways.
- **Parts** drop a ready piece snapped to the writing lines: Stem (plumb Line, writing line to
  small-letter or capitals line), Bowl (Circle between the two lines), Arch (Line + curve + Line,
  the top of n), Bar (level Line on the half-way line), Dot (a 1-point dot over the small-letter
  line). One step each; then they edit like anything he drew. Besides More ways, the Next line
  offers the next missing part as its button (below).

### The guide letter while sketching

B7's guide letter (`letter/guide_letter.js`) stays faintly visible **behind the sketch** while a
sketch tool or Select-on-sketch is picked, on every sketched letter, even with ink (the Fine-tune
switch can still hide it). It is the "what an n looks like" reference the replay lacked.

**Letter parts** (`sketch/letter_parts.js`, pure data plus a matcher): for each letter of the
Quick set (58), its strokes in house words with a rough centerline in letter-relative coordinates
(x as a share of the letter's width, y on the named lines): n = stem (writing line to small-letter
line, left), arch (from the stem's top over to the writing line on the right). A stroke counts as
**drawn** when 60 % of its sample points lie within 1.5x the thickness of the ink, after the
template is scaled to the ink's box. It feeds the missing-part rule, Parts and Compare.

### Compare (the taste check)

When a letter's last missing part is drawn (or he presses [Looks done to me]), the Next line shows
**Compare** once: the guide letter darkens to an outline over his letter at matched size, and one
sentence names the biggest difference in house words, from a short fixed list measured by
`sketch/compare.js` (pure): "The arch sits lower than the small-letter line.", "The stem is shorter
than the guide's.", "The bowl is narrower than the guide's.", "Small n leans left.", "The two sides
of small o are different sizes." If nothing differs by more than a set share, it says "Small n is
close to the guide letter." Buttons: [Looks good] (green, the letter may go Ready), [Show me]
(zooms to the difference), [See it in words] (opens Try it on "nonon" style text: his letter
between its neighbors, so "looks right" has something to be measured against). Once per letter;
editing the letter shows it again on the next finish.

### The letter view with Sketch on

```
+--------------------------------------------------------------------------+
| [nib] My Font   Letters 3/58   [Undo][Redo]   (Saved)    More tools  Menu|
| Next: Small n still needs its arch, from the stem's top to the writing   |
|       line on the right.                       [Show me]  [Add an arch]  |
+------+----------------------------------------------------+--------------+
| Brush|  - - - - - - - - - - - - - - - - - capitals line   | small n      |
|  B   |                                                    | Thickness    |
|SKETCH|  - - - - - - - - (*)- - - - - - - - small-letter   | thin-[==O-]  |
| Line |               ||      .-~~-.   (faint gray guide   |   thick      |
|  L   |               ||    /        \     letter n)       | 0.07 in wide |
| Arc  |               ||   |          |                    | on 1 in caps |
|  A   |               ||   |          |                    |              |
|Spline|  ============(*)=================== writing line   | Fine-tune >  |
|  S   |                                                    |              |
|Circle|  purple = sketch     green = picked                |              |
|  C   |  tag at cursor: "writing line"                     |              |
|------|                                                    |              |
|Select|                                                    |              |
|  V   |                                                    |              |
+------+----------------------------------------------------+--------------+
```

### Card sections (`letter_card.js cardSections`)

- **`sketch`** while a sketch tool is picked or the letter has a sketch: Thickness only (when any
  Centerline piece), then Fine-tune.
- **`sketchPiece`** while a piece or point is picked: section 5's card (point: Smooth, Corner,
  Delete, [Let it flow] when locked; piece: Redraw this piece, Fewer points; the rest under More).
- `mainButtons` gets [Edit sketch] (picks Select on the sketch) on a letter that has a sketch.
- **Fine-tune's view switch "Outline only" is renamed "See-through"** (`view.displayMode`,
  `words/sets/mode.js`; same behavior), so "outline" means one thing in Simple: a letter drawn as
  closed loops ("Sketch the outline", the Outline piece use, Make it an outline). Glossary line,
  with a picture: "Outline: the letter drawn as its outside line; loops inside are holes. See-through
  only changes how the screen shows it."

### Next line rules (`coach/rules.js`)

`pick()` takes the first matching rule in array order, so each new rule has its own place:

| Name (id) | Placed | When | Next line | Button |
|---|---|---|---|---|
| pieceOpen (19) | right after dialogOpen (1) | A piece is open | "Finish the line: double-click, press Enter, or click the first point to close it." | [Done] (green, = Enter) |
| outlineGap (20) | before letterNeedsLook (7) | An Outline piece was finished open | "The outline of small n has a gap. Click its first point to close it." | [Close it] |
| loopCrosses (21) | before 7 | A loop crosses itself | "A loop on small n crosses itself. Drag a point to untangle it." | [Show me] |
| loosePoint (22) | before 7 | A hollow point is near a datum | "2 points of small n are loose." | [Show me] |
| (letterNeedsLook, 7) | unchanged | carries the B11 **Bumpy** check | "The stroke on small n is bumpy..." | [Make it a sketch] / [Fewer points] |
| missingPart (23) | right after 7 | `letter_parts` finds a stroke not drawn | "Small n still needs its arch, from the stem's top to the writing line on the right." | [Show me] (draws the missing stroke dashed), [Add an arch] (drops the part), quiet [Looks done to me] |
| thickness (24) | after 23 | Centerline ink built, font thickness never set | "Pull the thickness until small n matches the gray guide letter." | [Looks good] |
| thicknessForAll (25) | after 24 | Thickness changed and other sketched letters differ | "Use this thickness on all 5 sketched letters?" | [Use on all] (green), [Just this one] |
| compare (26) | after 25 | A letter just got its last part | Compare (above) | [Looks good], [Show me], [See it in words] |
| outlineTeach (27) | after 26 | Once, after Make it an outline | "Now drag a loop's inside to make some parts thinner." | [Show me] |

Then the existing rules from letterEmpty (8) on. **Save never comes up over an unfinished
letter:** notSaved (10) yields while the open letter has a missing part (23) or an unseen Compare
(26). A letter is not Ready while 23 or 26 is open for it (amber "still being drawn" on its tile).
No separate bumpy rule: the B11 Bumpy check carries it through rule 7, and rule 15's calm Brush
line gets [Make it a sketch] (section 5).

### Undo while a piece is open

One function, `sketch/undo_gate.js runUndo(kind)`, sits in front of **every** Undo / Redo entry:
Ctrl+Z / Ctrl+Y, Backspace, the top bar buttons (`topbar/undo_buttons.js`), the named Undo toast's
[Undo] / [Redo] (`history/undo_toast.js`), `simple_undo.js` ("newest change wherever it is"), the
whole-font Undo (History's `swapProject`) and a crash-copy restore. While a piece is open:

- **Undo** takes back the last click; with only the first point left, it cancels the piece. The
  history is not touched. The top bar Undo's tooltip reads "Take back the last point".
- **Redo** is off; tooltip "Finish the line first".
- **Anything else** (a toast's [Undo] for an older step, a whole-font Undo, a restore) first ends
  the open piece as its own step (the `new_path.js leaveLetter` way), then runs. A save (Ctrl+S,
  Save As, a download) and Use in Word do the same before the file is written (S2 finalize).
- The tool keeps its **own copy** of the point it started from (id and position). If an Undo
  removed that point, the piece makes a new point at the copy when it finishes.

### Undo titles (`words/history_text.js`, `history/undo_toast.js`)

"sketched a line on small n", "sketched an arc on small n", "sketched a spline on small n",
"sketched a circle on small n", "sketched a rectangle on small n", "closed the outline of small
n", "moved a sketch point on small n", "bent a curve on small n", "aimed a curve on small n", "let
a curve flow on small n", "made a point smooth / corner on small n", "added / deleted a sketch
point on small n", "deleted a piece of small n", "moved part of small n", "resized part of small
n", "resized a circle on small n", "changed the thickness of small n", "made the ends round / flat
on small n", "made this end round / flat on small n", "made small n an outline", "added an inside
loop to small o", "made Brush stroke 1 a sketch", "redrew a piece of small n", "used fewer points
on small n", "added a mirror line to small n", "made a helper line on small n", "dropped a stem on
small n", "set the thickness for every sketched letter", "set small n's sketch aside".

One step each; a piece's clicks are one step on finish. `simple_undo.js` and the 200 / 30 cap
(`undo_cap.js`) apply unchanged.

### Checks, spacing, export

- **Tags.** Sketch-built shapes carry `shape.anyink = { sketchId, sketchKey, sketchPart }`
  (`path.js` already keeps `shape.anyink`). One helper, `sketch/sketch_record.js isBuiltShape`;
  every place that asks "is this a Brush stroke?" asks "is this built?" too: `auto_hole.js`
  (skips built shapes), `letter_card.js` Merge and Solid / Hole (never on built shapes),
  `checks/body_bottom.js` (`penAllowance` 0 for built Centerline shapes) and `board/tile_state.js`.
- **Paste** (`sketch_record.js reconcile`, run in `beforeSketchStep`, the `reconcileStrokes`
  pattern): any tagged shape whose `sketchKey` is not this letter's sketch key, or that duplicates
  a built shape already matched, loses its tags and becomes an ordinary shape. So a pasted copy of
  built shapes is plain, editable ink in any letter, never a ghost. Pasting a whole letter with its
  sketch is left out of v1 (section 6).
- **Ink rule.** A sketch with no built ink is still **Empty** (`board/letter_set.js inkOf` and
  `spacing/measure.js inkBounds` read shapes, never the sketch). Helper lines and open Outline
  pieces are never ink.
- **Anything that changes built shapes without telling the sketch is caught, not listed.** At the
  end of every sketch step the record stores `sketch.builtHash` (shape count plus a hash of the
  rounded points of the tagged shapes). In `beforeSketchStep`, and before any rebuild, the letter's
  tagged shapes are hashed again. If they differ and the change did not come through a follow plan
  (which updates the hash), the sketch is **set aside** instead of rebuilt: toast "Small n's sketch
  is set aside. Your changes to the shapes are kept." [Undo]. The sketch stays in the file under
  `setAside: true`, never rebuilt; deleted built shapes never come back. This covers Edit points,
  the Point pen, Merge, Clear letter, Remove specks, fontFileFix, the photo flow's Use it / Trace
  again, paste, Match size's grow, the attributes panel, rotate, move_and_resize, diacritics,
  cross_item_actions and multi-letter drags, with no list to keep up to date.
- **In Simple, the presses that would edit built shapes go to the sketch:** E picks Select on the
  sketch, P picks Spline, Delete deletes the picked sketch piece, Merge and Solid / Hole are hidden
  on built shapes. Clear letter clears the sketch too, in the same step. Remove specks skips built
  shapes (a sketched dot is never a speck).
- **Moves made by other features move the sketch, then rebuild.** One function,
  `sketch/follow.js followShapes(item, plan)`, where `plan = { matrix, grow }`, called by: spacing
  (`spacing/trace_follow.js moveSideways`), `metrics/font_metrics.js shiftItemPaths` /
  `moveBaseline`, `checks/fixes.js sitOnLine`, Match size (`checks/fix_shapes.js applyPlan`),
  Shrink to fit, the B11 refit fix, Flip left-right / upside-down (`letter_card.js flip`).
  - **Centerline:** points, the Mirror line and circles go through `matrix`; thickness is never
    scaled and `grow` is dropped (a constant thickness already keeps the weight).
  - **Outline:** points go through `matrix`, then each loop's points move outward along the
    loop's own normal by `grow` (Lines and Arcs exactly, bulge unchanged; Splines by moving their
    points and keeping their locks; inside loops keep their wall). Test: Match size on an outline o
    keeps both stroke widths within 1 unit.
  - The same plan goes to the Brush stroke record (section 5).
  - Order inside a step: build the sketch, then the spacing hook (`spacing/history_hook.js`)
    refits and slides shapes and sketch together through `followShapes`.
- **Line moves (B15).** Moving the small-letter, capitals, top or tail line ("Move the guide
  lines" in Font details, `metrics/font_metrics.js`) calls `sketch/follow.js followLine(project,
  line, from, to)`: every point pinned `on` that line moves with it (keeping its `inset`), the
  affected letters rebuild in chunks behind the "Rebuilding letters..." pill, all inside the line
  move's own one whole-font step. Points not pinned stay.
- **All tools.** Editing built shapes there is allowed and sets the sketch aside (the hash rule
  above). In Simple there is no way to edit built ink directly.
- **Export:** built shapes are ordinary shapes; every export path merges a sketched letter's
  overlaps (section 3). Helper lines and the sketch never export. B14's Use in Word and the font
  check see nothing new.
- **Banned words:** every new screen passes `scanSimpleScreen` (strict). House words added to
  `words/sets/sketch.js` and the glossary: Sketch, Line, Arc, Spline, Circle, Rectangle,
  Centerline, Outline, See-through, Thickness, Ends, Round, Flat, Mirror line, Helper line, Inside
  loop, wall, piece, point, smooth, corner, grip, bend, hole, loose, joins.

---

## 8. Data model

### `glyph.anyink.sketch`

Stored on the letter (or ligature / component) beside `anyink.nib`. `project_data/glyph.js`
already clones and saves the whole `anyink` object, so every Undo step (`addState` snapshots the
item), the `.gs2` work file and crash copies carry it with no new plumbing.

```js
glyph.anyink.sketch = {
  v: 1,                       // sketch format version
  build: 1,                   // build engine version that made the current ink
  key: 'sk_8f3a',             // stable across Undo / Redo, like stroke keys
  way: 'center',              // 'center' | 'outline': chosen at the door
  thickness: 99,              // font units, whole number (shown only as inches)
  ends: 'round',              // letter default: 'round' | 'flat'
  mirror: null,               // or { x: 540 } (whole number, a plumb line)
  builtHash: 'c4:9e1f07aa',   // count + hash of the tagged shapes after the last sketch step
  points: {                   // id -> point; ids shared by pieces = joined
    p1: { x: 120, y: 50, kind: 'corner', on: 'writing', inset: 'edge', end: null },
    p2: { x: 120, y: 1050, kind: 'corner', on: 'small', inset: 'edge' },
    p3: { x: 300, y: 1066, kind: 'smooth', on: 'small', inset: 'edge',
          lock: 'level',      // 'level' | 'plumb' | null (section 2)
          aim: null },        // or { dir: 0, tin: 1, tout: 1.3 } (degrees, tension each side)
    p4: { x: 480, y: 50, kind: 'corner', on: 'writing', inset: 'edge', end: 'flat',
          mirrorOf: null },
  },
  pieces: [
    { id: 1, key: 'pc_1', use: 'center',   // 'center' | 'outline' | 'helper'
      closed: false,
      parts: [ { type: 'line', from: 'p1', to: 'p2' } ] },
    { id: 2, key: 'pc_2', use: 'center', closed: false,
      parts: [
        { type: 'line',   from: 'p5', to: 'p6' },
        { type: 'arc',    from: 'p6', to: 'p7', bulge: 0.41, tangent: true },
        { type: 'curve',  from: 'p7', to: 'p8' },     // tangent at both ends (see below)
        { type: 'spline', points: ['p8', 'p9', 'p4'] },
      ] },
    { id: 3, key: 'pc_3', use: 'center', closed: true,
      circle: { cx: 300, cy: 525, rx: 425, ry: 425 }, // live circle until a point moves alone
      parts: [ { type: 'spline', points: ['c1', 'c2', 'c3', 'c4'] } ] },
    { id: 4, key: 'pc_4', use: 'outline', closed: true,
      insideOf: 5, wall: 99,                          // linked inside loop
      parts: [] },                                    // built from piece 5
    { id: 6, key: 'pc_6', use: 'helper', hidden: true, was: 'center', closed: false,
      parts: [ /* the old centerline after Make it an outline */ ] },
  ],
  relations: [                // only the kinds in section 6
    { type: 'plumb', a: 'p1', b: 'p2' },
    { type: 'onPiece', point: 'p5', piece: 1, t: 0.5 },
  ],
  setAside: false,
  at: 1760659200000,
};

// settings.anyink.sketchThickness: font units, or null (= brush_size.js brushSize)
```

- **Arcs are ends plus a bulge,** never a literal "through" point. `bulge` = tan(sweep / 4)
  (the DXF convention: 0 = straight, 1 = half circle, sign = side). It does not depend on size, so
  moving an end keeps the arc's bulge in proportion and it can never flip or blow up. Dragging the
  arc's middle changes `bulge` only. `tangent: true` means the bulge is worked out from the
  previous part's end direction (one free end, SolidWorks' tangent arc).
- **A part that must be tangent at both ends is a `curve`,** a cubic whose two handle directions
  come from its neighbors and whose lengths come from Hobby's tension rule, shown as "curve" in
  the UI. An arc becomes a curve the moment its second end is tangent-locked (a Line chained
  tangent after it, or the Arch part). So n's arch stays smooth when one stem top is dragged up;
  S4 tests the arch with unequal stems.
- **Circles** keep `circle` until one of their points is moved on its own; then `circle` is
  dropped and the loop is an ordinary 4-point Spline.
- Coordinates are font units, whole numbers. For `inset: 'edge'` points `x` / `y` are the built
  position (line plus or minus r); the build re-places them from `on` whenever the thickness or a
  line moves. Tangency is implied by `kind: 'smooth'`, `lock` and `aim`; Joined by shared ids.
- `aim` is the S1 decision that depends on the spline engine (section 9): a direction in degrees
  and a tension per side (MetaPost's `{dir}` and `tension a and b`; 1 = normal, 0.75 to 4). The
  arrow grip's pull maps to tension (longer pull, lower tension) through `hobby.js gripTension`
  and back through `gripPull`: a handle runs from 1/4 to 1/0.75 of its normal length (measured
  about 0.34 to 1.38), and S4 draws the grip at `gripPull(gripTension(pull))`. An aim more than 90
  degrees off the way the piece runs is read turned round (`curves.js alongRun`), so it never makes
  a loop. S3's Flip and Mirror must still turn `aim.dir` (a left-right mirror makes it 180 - dir).
- **A tangent arc turns at most 300 degrees** (`arc.js MAX_TANGENT_SWEEP`); past that, or where it
  would miss a smooth join that already has a direction by more than 0.1 degree, it is built as a
  curve. "Never flips or blows up" holds for stored bulges.
- **A circle that is let go stays an oval** while its points remain locked tops and sides
  (`curves.js ellipseRing`: a quarter ellipse between each pair); one free point more and it is an
  ordinary Hobby loop.
- **`on` names** (`model.js ON_PLACES`, D-048): `top`, `capitals`, `small`, `writing`, `tail` (the
  only ones that take `inset: 'edge'`), `halfSmall`, `halfCapitals` (the half-way lines), `left`,
  `right`, `middle` (letter edges and middle, only while spacing is set by him) and `mirror`.
- **Built ink is saved too.** The shapes are ordinary letter shapes tagged
  `{ sketchId: pieceId, sketchKey, sketchPart }`. Opening a file never rebuilds; only an edit does.
- **`build` version.** When the engine changes in a way that would change the ink, `build` goes
  up. An older letter is rebuilt only on its next edit, so a reopened font looks as it was saved.
- **`v` version.** `sketch/model.js migrateSketch` upgrades older formats on load. A sketch with a
  newer `v` than the app knows is kept untouched and treated like `setAside`, with a quiet card
  line "This sketch was made by a newer ANY-INK."
- **Save / load:** `.gs2` JSON as is. Crash copies are whole-project snapshots, so they include
  it. An **open piece** lives only in the tool while drawing; a crash mid-piece loses that piece's
  unfinished clicks, never anything finished.
- **Size:** about 70 bytes a point; a full 58-letter sketched font is well under 200 KB of sketch.

---

## 9. Libraries

| Library | Use | License | Size | Decision |
|---|---|---|---|---|
| **Hobby spline, in-house** (`sketch/hobby.js`) | Smooth curve through points with a given direction at any point and a tension on each side (Knuth / MetaPost: `{dir}`, `tension a and b`, curl 1 at free ends) | ours (GPL-3.0-or-later) | about 200 lines | **Write it.** hobby-curve 0.2.1 (ISC) takes only `{x, y}` points, one global tension and `cyclic`: no direction at any point, so tangent chaining, level locks, grips and `aim` could not be built on it. Its output is used only as a test reference for the no-direction case. Chosen over Spiro: Spiro can spiral when a point is dragged far; Hobby stays calm and gives plain cubics. |
| **clipper2-ts** 2.0.1-18 | Sweep union (as now), `inflatePathsD` (Flat ends: `EndType.Butt` open, `EndType.Joined` closed; Inside loop), crossing loops (`NonZero`, `Positive`), Flat-end cut along a line | BSL-1.0 | already in | Reuse |
| **fit-curve**, **simplify-js** | Make it a sketch, Fewer points, Make it an outline | MIT / BSD-2 | already vendored in `nib/vendor` | Reuse |
| perfect-freehand 1.2.3 | (the Brush's live picture) | MIT | already in | **Not used for sketches**: its outline differs from the swept nib, so the ink would jump on release. The real sweep is fast enough per frame. |
| hobby-curve 0.2.1 | test reference only | ISC | 6.9 KB | devDependency for the S1 cross-check, never shipped |
| bezier-js 6.1.4 | (project, split, offset) | MIT | 119 KB | **Not used.** Projection for Bend and splitting are a few pure functions next to `project_data/segment.js` (`splitAtTime`, `getSplitFromXYPoint`). |
| @salusoft89/planegcs 1.3.0 | Constraint solver | LGPL-2.0-or-later | 866 KB + wasm | **Not in v1** (section 6). |
| Fontra's drag-rule table | Inspiration for the rule order | GPL-3.0 | - | Read, not copied. |

**Built in-house (pure, unit-tested):** the Hobby spline with directions and tensions; arc (ends +
bulge) to cubics, exact split every 90 degrees; curve parts; the sketch model and migration; snap
search; the edge rule (ink lines, overshoot); the drag rules; Bend; curve extremes; the Bumpy
measure; outline build (depth, orientation, crossing resolve); Inside loop link; letter parts and
Compare; the built-shape hash; Zhang-Suen thinning for Make it a sketch's fallback.

**Hobby test reference.** Expected numbers for the direction and tension cases are made once with
MetaPost (`mpost`, from TeX Live) printing the control points of small test paths, and saved as a
fixture with the `.mp` source beside it. If `mpost` is not on the machine when S1 runs, S1 says so
and installs nothing: the fixture is made where MetaPost exists, and until then the cases are
checked against Knuth's equations worked in a separate script, with that recorded in TEST_LOG.

---

## 10. Acceptance test for Brennan (Gate 2b)

Like `docs/GATE2.md`: live site, fresh Chrome profile, 1600 x 900, mouse and keyboard, a helper
who reads each card once and stays quiet. "Brennan" needs B, r, e, n, a; o is added as the round
test letter.

| # | Task card | Done when | Time limit |
|---|---|---|---|
| K1 | "Make a new font called Brennan Sketch. Sketch small o." | o has ink, a clean ring whose ink touches the writing line and the small-letter line (plus overshoot) | 1:30 |
| K2 | "Sketch small n." | n has ink: stem and arch, feet on the writing line, arch top on the small-letter line, Compare seen | 2:00 |
| K3 | "Sketch small a, r and e." | all three have ink, nothing missing | 6:00 |
| K4 | "Sketch Capital B." | B has ink | 3:00 |
| K5 | "Make n's arch a little taller." | dragged one point or bent one curve; ink followed | 0:30 |
| K6 | "Undo that, then put it back." | it went back, then came back | 0:30 |
| K7 | "Make a new font called Brennan Outline. Make small o, n, a, r, e and Capital B as outlines." | all six have ink; o, a, e, B show their holes. Inside loop allowed everywhere; Make it an outline allowed for a, r and e | 15:00 |
| K8 | "Draw small s with the Brush, then clean it up." | the s is a sketch, not bumpy | 1:30 |
| K9 | "Type Brennan in Try it, in both fonts." | Try it shows Brennan, no letters touching | 1:00 |

Total: about 31 minutes of limits; the target is under 25 minutes of real time.

**Pass:** no help asked; every card inside its limit; he never sits more than 30 s without a Next
line naming a step; he rates "looks like what I meant" 4 of 5 or better for both fonts; every
letter is Ready (no open Bumpy, missing-part or Compare). **Fail on any of:** he looks for a tool
and can't find it, a letter can't be improved, Ready on a bumpy or unfinished letter.

**Automated twin** (`tests/sketch_accept.verify.mjs`, real Chrome, built app): draws K1-K8 with
scripted clicks, then measures: no open Bumpy check on any letter; ink edges at pinned points
within 2 units of their lines (plus overshoot for round tops); B11 `measureLetter` puts every
letter on the line at the right size (Sit on the line never offered); o has 1 hole, B 2, a and e
1; K5 rebuilds in under 100 ms on release; one Undo per finished piece and per drag; the strict
banned-word scan is clean on every screen; the font file exported through the File menu has no
overlapping contours and passes the font check.

---

## 11. Build plan

Each S is one workflow run: build, unit tests, its test page, a real-Chrome check, critic, fix.
Flag `sketch` stays off until S9 turns it on (features.js gets
`{ name: 'sketch', by: 'S1', what: 'sketched letters' }`). **Every S that produces ink keeps the
sketch and the ink in sync from that S on** (follow plans and the hash land with the first ink, in
S3).

| S | Scope | New / changed files | Tests and checks | Size |
|---|---|---|---|---|
| **S1** Model, curves and measures (**done 10/16/2026**) | Fixture copy; sketch format and migration; in-house Hobby spline with directions and tensions; arc (ends + bulge) and curve parts to cubics; extremes and level / plumb locks; the edge rule math (ink lines, overshoot, re-place on thickness); Bumpy measure; outline depth and orientation (no clipper yet); tags, reconcile, `builtHash`; `beforeSketchStep` hook; words and Undo titles; flag | see S1 below | vitest on all pure math; `tests/sketch.html` draws a stored sketch and its built centerline | L |
| **S2** Draw (**done 10/16/2026**) | Line (click-drag single line, pull-back arc, readout), Arc (A), Spline, Circle (live circle, between two lines, half-way snap), Rectangle; autotransition chaining and give-way; level locks; Enter / double-click / Esc / second Esc; the undo gate for open pieces at every entry; snaps, ink lines and hints; Simple key remaps; printed keys; tips; draw layer | `sketch/tools/line.js`, `arc_tool.js`, `spline_tool.js`, `circle_tool.js`, `rect_tool.js`, `chain.js`, `snap.js`, `draw_layer.js`, `undo_gate.js`; `edit_canvas/events.js`, `events_mouse.js`, `edit_canvas.js redrawGlyphEdit`, `tools/tools.js`, `mode/visibility.js`, `mode/keys.js`, `topbar/undo_buttons.js`, `history/undo_toast.js`, `history/simple_undo.js`, `coach/tips.js` | vitest: snaps, chaining angle rule, give-way, Escape order, undo gate; `tests/sketch_draw.verify.mjs` (n's stem and arch, corners where it left at an angle) | L |
| **S3** Build and stay in sync | Centerline build (edge rule, Round / Flat, Flat cut along a line, dots, closed loops), Outline build (clipper on crossings), rebuild per step; `followShapes` plans for spacing, line shifts, Sit on the line, Match size (`grow`), Shrink to fit, refit fix, Flip; `followLine` for B15; hash detach and Simple key routing; paste reconcile; `penAllowance` 0; export merge on every path; arc tops snapped to a line re-placed on a thickness change (a `top: { on, inset }` tag on the arc part, S2 stores only the bulge / end); the card's state for a sketched letter (S2 leaves "Empty" until there is ink) and a Next line sentence while a sketch tool is picked on an empty letter; re-check the snap band against real ink; thickness slider (real-sweep preview, font thickness, Use on all in chunks); top card section; empty-letter door; rules 19, 20, 24, 25; See-through rename | `sketch/build.js`, `build_center.js`, `build_outline.js`, `thickness.js`, `follow.js`, `detach.js`, `card_section.js`; `letter/letter_card.js`, `letter/empty_overlay.js`, `letter/open_tool.js`, `letter/auto_hole.js`, `nib/default_tool.js`, `coach/rules.js`, `spacing/trace_follow.js`, `metrics/font_metrics.js`, `checks/fixes.js`, `checks/fix_shapes.js`, `checks/body_bottom.js`, `board/tile_state.js`, `formats_io/otf/font_export.js`, `words/sets/mode.js` | vitest: o / B hole counts, o / n / v / A through B11 `measureLetter`, every follow (sketch and ink within 1 unit), outline o Match size widths, hash detach, Flat corners kept; `tests/sketch_build.verify.mjs` incl. File-menu export; B3 / B10 / B11 / B14 suites green | L |
| **S4** Edit | Pick a piece and Delete it as one step (until S4 a wrong piece comes off with Undo only: say so at Gate 2b); drag rules keep a point's `onPiece` and its level / plumb pair together (S2 stores both on A's bar); Select on the sketch: window and Ctrl picks, move / scale picks, drag point, Bend (arcs keep bulge), grips, Let it flow, circle resize, add / delete point, Smooth / Corner, nudge; drag rules and the can't-keep-both toast; picked point / piece card with More | `sketch/select_tool.js`, `pick.js`, `rules.js`, `bend.js`, `grips.js`, `piece_card.js`; `letter/point_kind.js`, `letter/delete_toast.js` | vitest per drag rule and order, n arch with unequal stems, window picks; `tests/sketch_edit.verify.mjs` (K5, K6) | L |
| **S5** Guide, parts and Compare | Guide letter behind the sketch; `letter_parts.js` for the Quick set; rules 23 and 26; Save gating and "still being drawn"; Parts (More ways and the missing-part button); Try it on neighbor text | `sketch/letter_parts.js`, `compare.js`, `parts.js`; `letter/guide_letter.js`, `coach/rules.js`, `board/tile_state.js`, Try it entry | vitest: every Quick-set template matches its own guide letter and flags one removed stroke; Compare sentences on bent fixtures; `tests/sketch_guide.verify.mjs` | M |
| **S6** Brush bridge | Brush record follows every plan; Make it a sketch (with ink fallback); Bumpy check (B11) and its fixes; no Ready while bumpy; [Make it a sketch] on rule 15; Fewer points; Redraw this piece | `sketch/from_brush.js`, `thin.js`, `fewer_points.js`, `redraw.js`; `nib/stroke_record.js`, `checks/*`, `coach/rules.js` | vitest on the replay fixture: both strokes bumpy before, 4-8 points and not bumpy after; record follows Match size and Flip; `tests/sketch_brush.verify.mjs` (K8) | M |
| **S7** Outline extras | Make it an outline (hidden centerline, Show toggle, rule 27), Inside loop (linked), per-piece switch under More, Close it, rules 21 and 22, canvas labels for pieces with no ink | `sketch/to_outline.js`, `inside_loop.js`, `close_it.js`, `loose.js` | vitest: o centerline to outline gives 2 loops, 1 hole; inside loop follows outer edits; `tests/sketch_outline.verify.mjs` (K7 short) | M |
| **S8** Mirror and helper | Mirror line (twins, one built piece, whole-number x), Helper line | `sketch/mirror.js`, `helper.js` | vitest: mirror stays symmetric through drag, Flip, spacing and Undo; `tests/sketch_mirror.verify.mjs` | S |
| **S9** Integration and acceptance | Flag `sketch` on; Help and the How-to page name the sketch; the automated twin; `verify:sketch` npm script; CLAUDE.md module map; TEST_LOG | `help/*`, `package.json`, `tests/sketch_accept.verify.mjs`, docs | full vitest, every existing `*.verify.mjs`, the twin, strict scans on every Simple screen at 1600 x 900 and 1280 x 720 | M |

Order: S1 to S4 answer his complaint (he can sketch both ways, it sits right on the lines, and he
can edit it). S5 answers "looked horrible, what next" (what's missing, how it compares). S6 fixes
the Brush dead end. S7 and S8 round it out. Roughly 7 weeks for one developer; S1-S4 about 4.

### S1 in detail

**Done 10/16/2026** (D-048): `src/anyink/sketch` model, hobby, arc, curves, extremes, edge rule,
bumpy, outline order, record, History hook; words; flag `sketch` off; `tests/sketch.html` and
`npm run verify:sketch-page`. Known for S3: in Simple the spacing refit moves built ink after
`beforeSketchStep` in the same step (an `it.todo` in `sketch/tests/integration.test.js`); S3's
follow plans fix it.

**Goal:** everything later S's stand on, pure and tested, with no new screen in Simple. Nothing
visible changes with the flag off.

1. **Fixture.** Copy the dead-end replay's `saved.gs2.json` (scratchpad `sketch/dead-end/`,
   sha256 `972e30b39bc3dbe332178c7a118f9f34d7322eb199c5682aafb1a9f80e312666`) to
   `src/anyink/sketch/tests/fixtures/dead_end_a.gs2.json` (test fixture, allowed by the `.gs2`
   rule) and record its source and hash in `docs/TEST_LOG.md`. If the scratchpad copy is gone,
   remake it with the replay scripts and record the new hash.
2. **`sketch/model.js`**: `newSketch`, `migrateSketch` (v1; unknown newer `v` kept untouched),
   `validateSketch` (ids exist, parts chain, closed loops end where they start), point / piece
   helpers, `way`, `builtHash` field, `settings.anyink.sketchThickness` read / write
   (`sketchThickness(project)`: the font value or `brushSize`).
3. **`sketch/hobby.js`**: Knuth / Hobby through points with, per point, an optional given
   direction (`dir`, degrees) and tension on each side (`tin`, `tout`, 0.75-4), curl 1 at free
   open ends, cyclic or open. A given direction splits the system into independent runs, as in
   MetaPost. Returns cubics.
4. **`sketch/arc.js`**: ends + bulge to cubics, split every 90 degrees; tangent bulge from an
   incoming direction; `curve` parts (both ends tangent) as one cubic with Hobby lengths.
5. **`sketch/curves.js`**: a piece to the Brush skeleton format `[[p0,h1,h2,p3], ...]`, honoring
   corners, smooth points, `lock`, `aim` and give-way at tangent joins (the earlier part turns to
   meet a following Line).
6. **`sketch/extremes.js`**: leftmost / rightmost / top / bottom of a piece, and the level / plumb
   lock rule.
7. **`sketch/edge_rule.js`**: ink lines for a font and thickness (each line plus or minus r on its
   ink side), overshoot from `guideLines(font).overshoot` for level-locked round points, and
   `placeEdgePoints(sketch, font)` that re-places every `inset: 'edge'` point.
8. **`sketch/bumpy.js`**: the measure in section 5 (quarter-thickness samples, half-thickness
   smoothing, 8 degree bumps, 3 or more and over 4 per 1,000 units, pieces over 6x thickness).
9. **`sketch/outline_order.js`**: loop depth among sketch loops and the orientation each depth
   needs (clipper resolve comes in S3).
10. **`sketch/sketch_record.js`**: `isBuiltShape`, tags, `reconcile` (strip foreign and duplicate
    tags), `hashBuilt` / `builtMatches`.
11. **`sketch/history_hook.js`** `beforeSketchStep` beside `beforeStrokeStep`, called from
    `history/history.js`; in S1 it runs reconcile and the hash check only (rebuild arrives in S3).
12. **Words:** `words/sets/sketch.js` (all house words and tips in this doc), Undo titles in
    `words/history_text.js`, glossary lines; strict scan of the new words.
13. **Flag:** `mode/features.js` gets `sketch` (off).
14. **Test page** `tests/sketch.html`: loads a stored sketch, draws its points, parts and built
    centerline, with toggles for ink lines and extremes.

**Tests (vitest):** Hobby through every point; given directions met within 0.1 degree; tension
changes handle lengths as MetaPost does (MetaPost fixture, section 9); the no-direction case
matches hobby-curve 0.2.1 within 0.5 units; arc error under 0.03 % of the radius; bulge kept in
proportion when an end moves (never flips); the n arch as a `curve` stays smooth with stems 100
units apart; extremes of a circle, an arch and an s; the edge rule on o, n, v, A templates (ink
edge on the line within 1 unit at thickness 60, 99 and 200, overshoot on round tops only); Bumpy:
the replay fixture's two strokes are bumpy, clean a, r, s, e, B are not, a short r ear is never
counted; outline depth for o, B and an island; reconcile and hash; save / load round trip of
every field; migration of a hand-made v0. Every new file starts with the two-line header.

**Not in S1:** any tool, any screen in Simple, clipper builds, follow plans.

### S2 as built

**Done 10/16/2026** (D-049): `src/anyink/sketch/tools/` (Line, Arc, Spline, Circle, Rectangle;
chain, snap, arc_snap, snap_context, draw_layer, undo_gate, tool_route, install, on_its_letter,
mode_watch, menu_open, tool_names) and `sketch/sketched.js`; the five tools draw, chain, snap,
finish, take back, Undo and Redo in Simple with the flag on, each finished piece one step in
`glyph.anyink.sketch`, kept through a .gs2 save and reopen. Flag `sketch` off. Real-Chrome checks:
`npm run verify:sketch-draw`, `npm run verify:sketch-layer`.

Beyond the plan, from the critics: a right press finishes a piece; the plain wheel zooms in
Simple with the flag on (Brennan's call at Gate 2b); Esc closes an open menu before it touches
the piece; Space-pan gives the tool back; a stray first click is let go of on leaving; a save
and Use in Word finish the open piece; a sketched letter with no ink yet hides the empty-letter
box, opens on Line and is never "empty, use the brush" (its "Empty" card state goes with S3's ink).

Moved on: to S3, arc tops re-placed on a thickness change, the card state and the sketch-tool
sentence on an empty letter, the snap band against real ink; to S4, pick and Delete a piece and
keeping `onPiece` with level / plumb through drags; to S9, Help's list of the sketch keys.

---

## 12. Decision record (for `docs/DECISIONS.md`)

```markdown
## D-047: Sketched letters (centerline + thickness and closed outlines), from Gate 2
**Decided:** 10/16/2026, after Gate 2 (Brennan: "i was hoping to see a way to make curved
splines/lines and make shapes for letters like i do in solidworks. all i had was a brush").
Revised the same day after review. Design: docs/SKETCH.md.
**Chose:**
1. A sketch layer, `glyph.anyink.sketch`, is the source of truth for a sketched letter; its shapes
   are rebuilt from it on every step and tagged `{ sketchId, sketchKey, sketchPart }`. Simple never
   edits built shapes directly. Any change to built shapes that did not come through a follow plan
   is caught by a stored hash and sets the sketch aside with a toast and [Undo].
2. Two uses of the same pieces: Centerline (swept with the B8 round nib, one thickness per letter
   from a font thickness `settings.anyink.sketchThickness`, Round or Flat ends per end) and Outline
   (closed loops, solid or hole by nesting in a pure build; clipper only where loops cross; never
   B7 auto-hole). Fine-tune's "Outline only" becomes "See-through".
3. **The edge rule:** a Centerline point snapped to a line puts the ink edge on the line (center
   half a thickness inside), for ends, extremes and corners alike, re-placed when the thickness
   changes; round tops and bottoms add `guideLines(font).overshoot`. B11 gives built Centerline
   shapes no half-nib allowance. This replaces "tuck pinned round ends".
4. Tools on the rail, never behind Fine-tune: Line L, Arc A (Select keeps V), Spline S, Circle C
   (O and Q too), Rectangle R; in Simple, P and E go to the sketch. SolidWorks chaining: tangent
   only when leaving along the curve, the earlier part gives way, a Line's click never moves.
   Double-click or Enter finishes, a second Esc returns to Select. Ctrl suspends snaps.
5. In-house Hobby spline with per-point directions and per-side tension (hobby-curve has neither);
   arcs stored as ends plus bulge; a part tangent at both ends is a curve, not an arc.
6. No constraint solver in v1: drag rules (mirror, on a line, on a piece / joined, level / plumb,
   tangent) applied once each in a fixed order; a conflict unpins with a toast and [Undo].
7. The empty letter has one fixed green door, Sketch it (Centerline), unless a photo part waits;
   the outline door is a quiet link; Brush and Parts sit under More ways. "Draw it with points" is
   replaced.
8. A letter is not Ready while a stroke it needs is missing (per-letter part templates against the
   guide letter) or before its Compare is seen once; the Brush dead end gets Make it a sketch and a
   B11 Bumpy check (3+ bumps and over 4 per 1,000 units, long pieces only). This revises D-046's
   "a brushed letter is Ready the moment it has ink" for bumpy strokes only.
9. Other features that move shapes pass a follow plan `{ matrix, grow }` to the sketch and the
   Brush record; B15 line moves carry pinned points. Every export path merges overlaps in letters
   with sketch-built or Brush shapes.
**Rejected:** a single "smart pen" as the only tool (less like SolidWorks); Spiro (spirals on large
drags); vendoring hobby-curve (no directions); editing built ink in Simple; sketch tools behind
Fine-tune (the Gate 2 failure); per-piece thickness in v1; tucking only pinned ends; a moving
"last way used" green.
**Left for later:** solver, equal-size relation, fillet, trim, curvature combs, G2 joins,
thickness along a stroke, flat / angled nibs (M10), pasting a letter with its sketch, reusable
parts across letters.
```

---

## 13. Revision notes (10/16/2026, after review)

Blockers fixed:

- **Datum vs ink (two conflicting sink rules).** Replaced end tucking with one edge rule for every
  Centerline snap (ends, extremes, corners), stored as `inset: 'edge'`, re-placed on thickness
  change, overshoot from `guideLines(font).overshoot`; B11 `penAllowance` is 0 for built
  Centerline shapes, with an o / n / v / A `measureLetter` test (sections 3, 6, 11; D-047 point 3).
- **hobby-curve has no directions.** The spline is written in-house with per-point directions and
  per-side tension; `aim` is `{ dir, tin, tout }`; MetaPost fixture as reference (sections 8, 9, S1).
- **autoHole is the wrong building block.** Pure `build_outline.js`: depth among sketch loops only,
  orientation by depth, clipper `NonZero` per self-crossing loop then `Positive` union; never
  autoHole on built shapes (section 4).
- **Unlisted callers would lose edits.** `builtHash` checked before every sketch step and rebuild;
  any mismatch not from a follow plan sets the sketch aside; Simple routes E / P / Delete / Merge /
  Solid-Hole to the sketch (section 7).

Major problems fixed:

- Chaining: SolidWorks autotransition (tangent only along the curve), give-way rule, Line clicks
  never move (section 2).
- Level / plumb locks at snapped and extreme smooth points (section 2).
- Offset: **Inside loop** with a wall readout, linked to the outer loop; allowed in K7 (4, 10).
- Multi-pick: window pick, Ctrl+click, move and scale picks (section 5).
- Circle stays a circle; edge drag resizes; between-two-lines circle; half-way center snap (2, 5, 6).
- Double-click finishes, second Esc goes to Select, click-drag draws one line, in the first tip (2).
- Empty letter: one fixed green door, outline as a quiet link, Brush and Parts under More ways,
  "Draw it with points" replaced (section 7).
- "Outline" means one thing: Fine-tune's switch renamed See-through, glossary line. (The review's
  first option, "Edge", was not used: "left edge / right edge" is already a house word for spacing.)
- Unfinished letters: guide letter behind the sketch, per-letter part templates, missing-part rule,
  Save gated (section 7).
- "Looked horrible": Compare step with one named difference and Try it on neighbor text (7).
- Thickness consistency: font thickness default, "Use on all" offer, chunked one-step rebuild (3).
- Busy card: Thickness alone on top, three point buttons, two piece buttons, the rest under More
  or Fine-tune (section 5).
- Arcs as ends + bulge; tangent-at-both-ends parts are curves; arch test with unequal stems (5, 8).
- Next line rules placed in `pick()` order; rule 23 dropped in favor of the B11 Bumpy check;
  calm Brush line correctly named rule 15 (section 7).
- Follow and the hash move into S3, with the first ink (section 11).
- Letter edges and middle are not snap targets while spacing is automatic; `mirror.x` whole (6).
- Brush record follows every transform; Make it a sketch falls back to a centerline from the ink
  (section 5, S6).
- Follow takes a plan `{ matrix, grow }`; outline loops grow along their normals (section 7).
- Undo gate for every Undo / Redo entry while a piece is open; the tool copies its start point (7).
- Export merges overlaps on every path for sketched and Brush letters (section 3).
- B15 line moves carry pinned points in one whole-font step (section 7).
- Bumpy measure defined (count plus rate, long pieces only), tested on clean letters (5, S1).
- Paste: foreign and duplicate tags stripped; whole-letter sketch paste dropped from v1 (6, 7).

Minor problems fixed: Arc key A and Simple remaps of O / Q / R / P / E (T left free); thickness
and length readouts on a "1 in capitals" scale with a hint; [Let it flow]; middle snap stored as
`onPiece` t = 0.5, "equal" listed for later; Flat end cut along its line and per-end Round / Flat;
status-dot tip and "can't keep both" as a toast with [Undo]; printed keys and the repeated
pull-back tip; Make it an outline hides the old centerline and teaches the payoff; "small-letter
line" everywhere plus top / tail line words; letters keep their door's way, labels on pieces with
no ink; overshoot from `guideLines`; real-sweep preview instead of perfect-freehand; `EndType.Joined`
for closed pieces and a corner test; degenerate pieces defined.

Not done in this revision: the replay fixture is **not yet copied** into
`src/anyink/sketch/tests/fixtures/`, because this run may edit only this document. Its source and
sha256 are recorded in S1 step 1, which copies it first. Estimate grew from about 6 to about 7
weeks (S5 is new; S2-S4 grew).
