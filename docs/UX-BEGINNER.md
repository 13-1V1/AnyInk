# ANY-INK: Beginner-proof design (UX-BEGINNER)

**Written:** 10/13/2026, after Brennan's test: "it didn't seem very easy or intuitive. it was kind of
overwhelming and made me feel lost ... make this program have cool features but stupid proof."
**Revised:** 10/14/2026, after a design review found 2 blockers, 31 major and 44 minor problems.
What changed, and what took a different route, is in section 12.
**Status:** design only. Nothing here is built yet. This is the single design ANY-INK builds next, as
milestones B0 to B16 (section 10), before the handwriting sheet (M9). Until B16 the live app keeps
opening in today's full editor; the new screens are reachable only by adding `?ui=simple` to the
address, and nothing on screen points there.
**Inputs:** the first-timer walkthrough of the live app, the jargon inventory (about 90 terms in 2,120
on-screen strings), prior-art research (Calligraphr, FontStruct, Fontself, iFontMaker, BirdFont, Glyphs
Mini, Prototypo, Procreate, Canva, GarageBand, Tinkercad, NN/G), the code map, three concepts
(Guided, Simple workspace, Letter board), two judges and the design review. Their files are in the
session scratchpad under `ux/`.
**Decision:** D-031 (section 11). D-030 is already "File autosave and recovery are independent", so
this takes the next free number.

---

## 0. The design on one page

ANY-INK opens in **Simple mode**. The home screen is the **letter board**: every letter of the font as
a big tile. Faint tiles are still to do. Tiles with his ink are done. Amber tiles **need a look**, and
each one says why in words. You never pick a "page". You open a letter, or press one of three steps
along the top: **1 Letters, 2 Try it, 3 Use in Word**. A one-sentence **"Next:" line** under the top
bar always says what to do next. Every screen has exactly one green button, and the Next line either
holds it or names it.

On a new font the Next line starts before the computer: **"First, write your letters on paper and take
one photo of the page."** The How card says exactly how (felt-tip, white paper, a finger's width
between letters, getting the photo onto the PC). Then **one photo makes many letters**: ANY-INK finds
each letter on the page, puts a green box on the next one and asks "Which letter is in the green
box?". He types the letter, presses Trace it, looks, presses Use it. All letters from one photo share
one size, so their ink weight matches, and each one lands on the guide lines and is spaced, so "aaa"
can never pile up.

Inside a letter, a finished letter shows almost nothing: its name, "Ready", **[Trace again]** and
**[Draw over it]**. Everything else (shapes, spacing edges, extra tools, view switches) sits in one
closed section, **"Fine-tune this letter"**. An empty letter shows the five labeled guide lines, a
faint guide letter and one box in the middle: "Use a photo" or "Draw with the brush".

All of Glyphr Studio is still there behind **More tools**, with a purple band and a **Back to simple**
button. Every word on the Simple screens comes from one vocabulary file,
`src/anyink/words/words.js`. A pro term appears only in small print inside a "?" hint.

What the design takes from each concept:
- **Letter board** (the feasibility judge's pick): the board is home, with tile states, reasons in words
  and one-click fixes. There is only one editing surface, so every later milestone plugs in once.
- **Guided** (the beginner judge's pick): the step rail, now three steps; the photo card ("Look right?
  Use it"); spacing by letter type; the Use in Word card with numbered test builds; choosing where to
  save when the font is created.
- **Simple workspace**: the ordered coach rules (first match wins); gap fixes by dragging a handle
  between two letters in the preview; a photo button that is never greyed out; the before/after
  Looks drawer.

```
  Start screen ──Create / Continue──> LETTER BOARD (home) <──── "<- All letters" ────┐
                                        |  click a tile / type a letter / drop a photo  |
                                        v                                               |
                                     LETTER VIEW (one editing screen) ──────────────────┘
  Top bar on both:  [1 Letters] -- [2 Try it] -- [3 Use in Word]    Undo  Redo  Saved  More tools  Menu
                         board        big preview    make the .otf + install steps
```

---

## 1. Principles

Every Simple-mode screen must pass all eight. Section 9 checks them.

1. **One obvious next step.** Every screen state has exactly one solid green button (class
   `.anyink-primary`). If an open dialog, card or overlay holds the action, its button is the green
   one and the Next line has no button of its own: its sentence names the button to press. Otherwise
   the Next line's button is the green one. Every other button, including one that repeats a step, is
   outlined. *Test:* the automated run (9.4) counts exactly one visible `.anyink-primary` in every
   screen state, and the agent first-timer (9.1) names the right button from a screenshot alone on
   every screen. *One exemption (D-037):* a drawing tool picked on an empty letter, before its first
   point, has no green button: the next step is a click or a drag on the paper, and the Next line
   says exactly that ("Click on the paper to drop your first point."). A green button there would
   be a second way to do nothing. Upstream's green `fancy-button` counts as a green button too.
2. **Plain words.** No word on the banned list (2.3) appears on the main path, including toasts and
   words drawn on the canvas. The pro term, if shown at all, is small print inside a "?" hint
   ("writing line (pro word: baseline)"). *Test:* the banned-word scan (2.3) finds zero hits.
3. **Look and drag; never type numbers.** In Simple mode there are no number fields. Numbers appear only
   as live readouts while something is being dragged. Typing is for names, test words and naming a
   letter in a photo. *Test:* zero `input[type=number]` or `<input-number>` elements are visible in
   Simple mode.
4. **Undo everything; confirm almost nothing.** Every change is one Undo step, named in plain words
   ("Undid: traced B"). Looking around (opening a letter, the board, Try it, a dialog) is never an
   Undo step. Undo and Redo are on-screen buttons. A confirm box appears only for the five things Undo
   cannot bring back (7.4).
5. **Good defaults, whole numbers.** Anything the app makes (size, placement on the lines, spacing,
   width) looks right with no tuning, and every width and point it writes is a whole number. *Test:* in
   the exported font every made letter has a width above 0 and whole-number points, and "Brennan Hand"
   set with no gap fixes has no overlapping letters. **Overlap** means two neighboring letters'
   outlines intersect with an area above 0; letters he pushed together himself with a gap fix don't
   count.
6. **Never silently wrong.** If something can't work, say so in one sentence with a fix button. Never
   grey out a control without a sentence saying why. Never quietly fall back to something else. If an
   action changes a letter he isn't looking at, a toast says which.
7. **Always a way home.** The step rail, "<- All letters" and Undo are on every editor screen. More
   tools is one click away and one click back.
8. **No doors to unbuilt rooms.** A button, menu row, coach sentence, tip or Help entry appears only
   when its feature works. Each one is tagged with a feature flag in `src/anyink/mode/features.js`, and
   each B turns on only its own flag when it lands. Until M9 ships there is no "handwriting sheet"
   anywhere.

---

## 2. House vocabulary

### 2.1 Glossary (shown in Help > "What these words mean")

Each entry is tagged with the feature that ships it; Help shows only entries whose feature has landed
(principle 8).

| ANY-INK word | Means | Everyday comparison | Pro word (small print only) | Shown from |
|---|---|---|---|---|
| **letter** | Any single drawn character: letters, numbers, punctuation | One stamp in a rubber-stamp set | glyph, character | B4 |
| **letter set** | A group of letters to make, e.g. "Capitals" | | character range, Unicode block | B10 |
| **shape** | One closed outline in a letter | One cut-out piece of a vinyl decal | path, contour | B4 |
| **hole** | A shape that cuts out instead of filling (the middle of o) | A Blender boolean Difference | counter, reverse winding | B7 |
| **point** | A dot on a shape's edge you drag to reshape it | A vertex in Blender | path point, node | B7 |
| **curve handle** | The arm on a point that bends the curve | Blender curve handles | control point, Bezier handle | B7 |
| **smooth / corner** | A point where the curve flows / turns sharply | | symmetric/flat, corner | B7 |
| **guide lines** | The five lines every letter is drawn on | Kids' handwriting paper | metrics, vertical metrics | B4 |
| **writing line** | The line letters sit on | The ruled line on notebook paper | baseline | B4 |
| **small-letter line** | How tall a, c, e, x are | The dashed middle line on handwriting paper | x-height | B4 |
| **capitals line** | How tall H and E are | | cap height | B4 |
| **top line** | How high b, d, h reach | | ascender, ascent | B4 |
| **tail line** | How low g, p, y reach | | descender, descent | B4 |
| **letter box** | The square every letter is drawn in. Every percentage in this document is a share of its height: 2,048 units at the default settings (the top line to the tail line covers 1,990 of them) | A sheet of graph paper | em, em square | B4 |
| **units** | Ruler ticks inside the letter box (readouts only) | Graph-paper squares | font units, UPM | B4 |
| **left space / right space** | Built-in gap on each side of a letter | Clearance between parts nested on a sheet | side bearings, LSB/RSB | B7 |
| **letter width** | Ink plus both spaces: how far the next letter moves over | A typewriter carriage advance | advance width | B7 |
| **letter spacing** | Every gap in the font, made closer or further apart at once | | tracking (global side bearings) | B12 |
| **gap fix** | The gap between two particular letters, like "en", made closer or wider | Nudging one clip on a timeline | kerning | B12 |
| **photo** | Your handwriting under the letter; never in the font file | Tracing paper | trace image, trace layer | B9 |
| **ink cutoff** | How dark something must be to count as ink | An audio noise-gate threshold | threshold | B9 |
| **brush** | Drag to draw ink | A felt-tip marker | nib, stroke | B8 |
| **versions** | Two or three takes of one letter that take turns as you type | Alternate takes of a vocal | alternates, calt | M11 |
| **boldness** | How heavy the strokes are | | weight, offset | M12 |
| **ink texture** | Rough edges and ink bleed | Cheap paper soaking up ink | roughen, distress | M13 |
| **work file** | Your ANY-INK file (Brennan Hand.gs2). It holds everything you made. It is **not** the font; Word can't use it | A .blend file | project file | B4 |
| **Save** | Keeps your work file up to date | Saving a .blend | save project | B4 |
| **font file** | The .otf you install in Windows, made in step 3, Use in Word | Exporting a .glb from Blender | OTF export | B14 |
| **backup copy** | The hidden safety copy kept in the browser | A game's autosave slot | recovery snapshot | B13 |
| **More tools** | Everything Glyphr Studio can do | Blender's full UI vs a simple add-on panel | Expert mode | B5 |

### 2.2 Word rules

- **Scope.** Every string on the Simple main path lives in `src/anyink/words/words.js` as
  `{ text, hint, pro, feature }`: screens, coach sentences, tips, toasts, dialogs, words drawn on the
  canvas and the File menu. Code asks for words by key (`word('line.baseline')`) and never writes such
  a label inline. Internal ids never change (D-001).
- **More tools** keeps Glyphr Studio's own wording, except at display points it shares with Simple
  (canvas guide labels, drag readouts, the File menu, toasts), which always use the house word. Moving
  every More tools label to house words is a separate, optional step (W in section 10) with its own
  estimate.
- **Sentence case everywhere.** No CSS `text-transform: uppercase` on any heading, label or button, so
  "Photo of your small r" never shows as "PHOTO OF YOUR R". A letter name is always written in full:
  "small r", "Capital R". The scan (2.3) fails on any computed uppercase transform in Simple.
- American spelling (neighbor, color). Buttons start with a verb ("Use it", "Go to r"). Coach lines are
  one sentence. No exclamation marks except the one celebration ("Your font works. Type something!").
- Letter names come from `letterName(char)`: "Capital B", "small b", "period", "comma", "apostrophe",
  "question mark", "exclamation mark", "hyphen", "space", "number 7". Unicode names ("Latin Small
  Letter A") never appear in Simple mode.
- Units: "pt" for type size; inches for anything physical (letter height on paper, the 8.5 x 11 in
  sheet); "units" only in drag readouts. Never metric.
- **Undo titles, one rule.** New ANY-INK actions write plain titles ("traced B", "drew a stroke on B",
  "moved e and n closer"). Existing code keeps its titles (More tools auto-trace still writes
  "Auto-traced N shapes (P points)", which `apply.test` checks). Everything shown on screen goes
  through `historyText(title)`, which maps existing titles by pattern (2.4 G). An unknown title shows
  as "your last change".
- **Toasts, one voice.** Every toast goes through `src/anyink/toast/toast.js`, one queue, with a
  words.js key. Upstream `showToast` is routed through it (B4); in Simple an upstream message with no
  mapping is not shown, and the scripted-flow test (2.3) fails on it.

### 2.3 Banned on the main path

glyph, character, item, path, subpath, contour, node, Bezier, winding, clockwise, counter, kern,
kerning, kern group, bearing, side bearing, advance, em, UPM, ascent, ascender, descent, descender,
x-height, cap height, baseline, metrics, component, instance, ligature, Unicode, hex, U+, 0x, code
point, PANOSE, OpenType, TrueType, CFF, OTF, TTF, WOFF, snapshot, upstream, threshold, glyph box,
bounding box, transform, skew, offset path.

Every word is banned outright; there are no "only as a noun" rules, because a scanner can't tell. The
only two exemptions are marked in the markup:
- `.anyink-pro-word`: small print inside a "?" hint.
- `.anyink-quote`: an exact label from Windows or Word, or a file name, shown in quotes ("Kerning for
  fonts", "Use Contextual Alternates", "Show more options", "BrennanHand-Test1.otf"). Each quote is a
  words.js entry with `quote: true`, so the list of exemptions is reviewable in one place.

`src/anyink/words/tests/banned_words.test.js` (jsdom) fails on any whole-word, case-insensitive hit in:
- the visible text, `title` and `aria-label` of every Simple screen state;
- **canvas text**: it spies on `CanvasRenderingContext2D.prototype.fillText` and `strokeText`, so
  guide labels (`edit_canvas.js` `drawGuideLabel`), drag readouts (`metrics_math.js` `LIVE_LABELS`,
  `metrics/overlay.js`) and handle labels are scanned;
- **toasts**: it records every message through the toast module during scripted Simple flows (create,
  photo, brush, undo and redo, save, Try it, Use in Word, crash card);
- every `words.js` entry not marked `quote`.

### 2.4 The full jargon map

Action key: **Rename** = shown with the house word. **Hide** = not in Simple mode (still in More tools).
**Gone** = removed in both modes, done automatically. **Hint** = kept, with a "?" explanation.

**A. Letters and the font**

| Pro term(s) | House word | Simple mode | Action and notes |
|---|---|---|---|
| glyph | letter | "Letter" | Rename on the main path (223 hits overall; `move_and_resize.js`, `panels/actions.js`, `diacritics.js`) |
| character, Characters page | letter, "Letters" | Letter view | Rename (147 hits; `settings_project.js`, `kerning.js`) |
| item, item chooser, Previous/Next item | letter | "< A" / "C >" | Rename (99 hits) |
| ligature | joined letters | Hidden | Hide |
| component, root, instance, link/unlink | reusable part, original part, linked copy | Hidden | Hide |
| composite glyph | none | Hidden | Hide (More tools only) |
| diacritic, accented, combining marks | accented letters | Hidden | Hide; "Accented letters" set in More tools |
| font family, style, subfamily, typeface | font name; style (Regular) | "Font name" only | Rename; style fixed to Regular in Simple |
| project name + font family | one "font name" | One field | Merge: the field writes both |
| monospace | same-width letters | Hidden | Hide |
| weight (100 to 900) | boldness | Boldness slider (M12) | Rename; number becomes named steps |
| italic angle, slope, oblique | slant | Hidden | Hide |
| stem v/h, stretch, variant, small-caps | none | Hidden | Hide |
| underline/strike/overline position, thickness | none | Hidden | Hide; defaults used |
| PANOSE, Family Kind | none | Hidden | Hide |

**B. Lines and spacing**

| Pro term(s) | House word | Simple mode | Action and notes |
|---|---|---|---|
| baseline | writing line | Canvas label | Rename; hint "(pro word: baseline)" |
| x-height | small-letter line | Canvas label | Rename |
| cap height | capitals line | Canvas label | Rename |
| ascent, ascender | top line | Canvas label | Rename |
| descent, descender | tail line | Canvas label | Rename; never shown as a negative number |
| metrics, key metrics | guide lines | "Guide lines" | Rename (strip toggle "Metrics" too) |
| overshoot | none | Gone | Done automatically for round letters (+1.5% of the letter box) |
| line gap | space between lines | Hidden | Hide |
| side bearing, LSB, RSB, bearings | left space / right space | Purple edges and shading inside Fine-tune | Rename |
| advance width | letter width | Readout while dragging | Rename; set automatically |
| kerning, kern, kern value | gap fix | Purple handle in Try it | Rename; no numbers |
| kern group, left/right group | gap rule | Hidden | Hide; Simple makes one-pair rules only |
| exception group (Alt-drag) | just this pair | Hidden | Hide |
| UPM, Units per Em | grid size | Hidden | Hide |
| em, em square, "1em" | letter box | Letter box (rare) | Rename |
| font units | units | Drag readouts only | Rename |

**C. Shapes and drawing**

| Pro term(s) | House word | Simple mode | Action and notes |
|---|---|---|---|
| path, subpath | shape | "Shape 1", "Shape 2" | Rename (187 hits) |
| outline | outline | "Outline only" view switch | Keep |
| point, path point, node | point | Edit points tool (Fine-tune) | Rename (drop "path") |
| handle, control point, h1/h2 | curve handle | Canvas only | Rename; number boxes hidden |
| Bezier | curve | Gone | Never shown |
| point type symmetric / flat / corner | smooth (even) / smooth / corner | [Smooth] [Corner] buttons | Rename; "smooth (even)" only in More tools |
| winding, clockwise, reverse winding | Solid / Hole | Solid / Hole switch | Rename; holes made automatically (7.1 #5) |
| counter | hole | "Hole" | Rename |
| Combine: Unite / Divide / Subtract / Exclude / Intersect | Merge shapes / Cut apart / Cut out / Keep the non-overlap / Keep the overlap | "Merge overlapping shapes" only | Rename; the other four are More tools |
| skew | slant | Hidden | Hide |
| offset path | thicken / thin | Thinner / Thicker (M12) | Rename |
| Transforms panel | Slant & rotate | Hidden | Hide |
| transform origin | resize from | Hidden | Hide |
| lock / maintain aspect ratio | keep proportions | Hidden | Hide (Shift-drag keeps proportions) |
| Δ width, Δ height | width change, height change | Hidden | Hide |
| "Round all path point and handle position values" | tidy points | Gone | Done automatically on every ANY-INK write |
| flip horizontal / vertical | flip left-right / flip upside-down | Fine-tune > Shape options | Rename |
| layers, layer order | Shapes (front-to-back) | Shapes list in Fine-tune | Rename |
| bounding box, x-max | edges of the drawing | Gone | Never shown |
| ANY-INK clipboard vs OS clipboard | copy / paste | Ctrl+C / Ctrl+V | Hide the difference |
| circular reference | "A part can't contain itself." | More tools only | Reword |

**D. Pages, panels and tools**

| Pro term(s) | House word | Simple mode |
|---|---|---|
| Overview | Letter board | The home screen |
| headings "Design glyphs", "Refine", "Settings & more" | "Draw", "Fine-tune", "Settings & help" | Hidden (More tools page chooser) |
| Attributes | Details | Replaced by the letter card |
| Layers | Shapes | Fine-tune > Shapes |
| Trace | Photo | Fine-tune > Photo, and the photo card |
| Context characters | Neighbor letters | "Neighbors" switch in Fine-tune |
| Character info | Letter info | Hidden |
| Quality checks | Cleanup warnings | Replaced by "Needs a look" (B11) |
| History | Undo history | Replaced by Undo/Redo buttons and toasts |
| Guides | Guide lines | Hidden; lines locked (7.6); Move the guide lines (4.8) |
| Global actions | Change all letters | Hidden; "Move all letters closer or further" lives in Try it |
| Live preview: Render flavor, Glyph sets, permutations, Pangrams, Glyph bounding box | Try it: Samples, Every letter | Try it (4.6) |
| Tools New path, Path edit, Add path point, Resize, New rectangle, New oval | Point pen, Edit points, Add a point, Select, Rectangle, Oval | Select always; Point pen, Edit points, Rectangle, Oval inside Fine-tune; "Add a point" hidden |
| Kerning tool "Adjust kern value" | Drag a gap | Hidden |
| Zoom: 1 pixel = 1 em; fit a full Em; Pan; Paper / slate; fill / outline | Actual size; Fit letter; Move view; Dark paper; Outline only | Zoom and Fit letter always; "Dark paper" and "Outline only" switches inside Fine-tune; Actual size and the Pan button hidden (Space-drag still pans) |
| chips, tiles | letter tags, tiles | More tools only |
| Cross-project actions, source/destination | Copy between fonts, from / to | Hidden |

**E. Codes, file formats and settings**

| Pro term(s) | House word | Simple mode |
|---|---|---|
| Unicode, code point, hex, U+, 0x, HTML entity | none | Never shown |
| character range, Unicode block (Basic Latin, Latin Supplement, ...) | letter set (Capitals, Small letters, Punctuation, Numbers & symbols, Accented letters) | Board sections; codes never shown |
| control characters, non-graphic | none | Never shown |
| Unicode names ("Latin Capital Letter A") | "Capital A" | `letterName()` everywhere |
| OTF / TTF / WOFF / WOFF2 / SVG font | font file (.otf) | "Make my font file"; others in More tools |
| OpenType, TrueType, CFF | none | Never shown |
| SVG | drawing (.svg) | Dropping an .svg on a letter still brings its shapes in; no buttons |
| .gs2, project file, JSON, .txt | your work file (.gs2) | File name only |
| Font metadata, manufacturer, trademark, URLs | Font details (name, your name, copyright) | Three fields |
| Version, Initial version, Project ID, Semantic Versioning | none | Hidden |
| Export composite glyphs, Unlink instances, Export unedited items, Directly drag curves, item chooser size, Highlight points near x=0 | none | Hidden |
| "Add default Side Bearings when importing an SVG file" | "Add spacing to brought-in drawings" | Hidden (always on in Simple) |

**F. Photo and auto-trace**

| Pro term(s) | House word | Simple mode |
|---|---|---|
| trace image, trace layer | photo | Photo card, photo dialog, Fine-tune > Photo |
| Fit to em / Fit to cap height | Fit to letter box / Fit to capitals line | Fine-tune > Photo options |
| "Top left ... Size ... font units" readout | none | Gone |
| Draw glyph as outline | (use the "Outline only" view switch) | Gone from the photo controls |
| glyph box, "Only inside the glyph box" | the part of the photo you picked | Replaced by the photo dialog (4.4) |
| Threshold | Ink cutoff | Adjust > "less ink / more ink" |
| Replace outlines / Add to outlines | Use it / Add to my shapes instead | Use it (primary), link for add |
| Mode Scan / Photo | Paper: Flat scan / Phone photo | Adjust; picked automatically (B9) |
| opacity | Photo fade | Fine-tune > Photo |
| invert | Light ink on dark paper | Adjust and Photo options |
| Smoothing, Detail | one slider, "Smooth --o-- Detailed" | Adjust (both sliders stay in More tools) |
| Remove specks | Remove specks | Adjust |

**G. Saving and app words**

| Pro term(s) | House word | Simple mode |
|---|---|---|
| snapshot, crash-recovery snapshot | backup copy | Start-screen card only |
| "Not yet protected", "File changes pending", "Recovery copy saved", "Not saved to a file" | Saved / Saving... / Not saved yet / Couldn't save | Status pill (4.11) |
| "upstream" sample | "the original Glyphr Studio sample" | Help > Look at an example |
| "Protecting your work...", "Persistent recovery is unavailable" | "Saving a backup...", "Backups don't work in this window. Press Save before closing." | Banner |
| History titles ("Toggled path winding to Clockwise", "Changed point 3 to symmetric", "Nudged kern group ...", "Auto-traced 3 shapes (412 points)", "Navigated to ...") | "made shape 2 a hole", "made a point smooth", "moved a and v closer", "traced B", (navigation entries are never shown) | Toast and tooltip text |
| Toasts: "Restored deleted item", "Navigated without undo-ing", "Values were rounded for the selected path points", "Uniting all glyph shapes", "Added a trace image. Press Start auto-trace ...", "Crash recovery could not save a snapshot ...", "Open the Recover tab", "Saved project file" | "Brought back small c", (never shown), (never shown: ANY-INK rounds silently), "Merged the shapes", (replaced by the photo card), "Couldn't save a backup copy. Press Save to keep your work.", (removed in Simple), "Saved" (status pill only, no toast) | Toast module (B4) |

---

## 3. The beginner's journey

**Target:** from first launch to typing "Brennan Hand" in Word in his own handwriting in **20 minutes
or less**, not counting the few minutes away from the screen to write the letters and photograph them
(the How card at 0:01 sends him off to do that). The **first win**, one of his own letters on screen,
comes **within 5 minutes** of launch. After M9, the whole alphabet from a handwriting sheet takes **60
minutes or less**, including printing and writing.

Every "Next:" sentence below is what the rules in 4.0 produce at that moment.
`src/anyink/coach/tests/journey.test.js` replays this table and checks each sentence (B6).

| Clock | He sees | He does | Clicks |
|---|---|---|---|
| 0:00 | Start screen: "Make a new font". Name it: [My Font] [Create my font]. Under it: "Next, Windows asks where to keep your work file. Documents is fine. This is your work file, not the font. You'll make the font for Word in step 3." | Types "Brennan Hand", presses Create my font. The Windows save dialog suggests Documents\Brennan Hand.gs2; presses Save | 2 + typing |
| 0:01 | The letter board, every tile faint, one line "0 of 58 ready". Status "Saved". Rule 11: "First, write your letters on paper and take one photo of the page." [How] | Presses How. The How card (4.4) says: black felt-tip on plain white paper; letters about 1 in tall; a finger's width between letters; for a first try, the letters of "Brennan Hand" once each, **B r e n a H d**, or the whole alphabet on one page; even light, phone straight above; then email it to yourself or use Phone Link and save it to Downloads | 1 |
| (away) | | Writes B r e n a H d, takes the photo, saves it to Downloads | |
| 0:02 | The How card is still open | Presses [I have my photo]. The Windows picker opens in Downloads; picks the photo | 2 |
| 0:03 | The photo dialog: the whole page, seven parts outlined in thin purple, the first one in a green dashed box. "Which letter is in the green box? [ ]" | Types B. It reads "That's: Capital B". Presses Trace it | key + 1 |
| 0:03 | The letter view for Capital B: his B sitting on the guide lines, capital-sized, with a green dashed outline over the ink. The card: "Look right?" [Use it], "Wrong part? [Draw a box]". Rule 3: "Look right? Press Use it. Wrong part? Press Draw a box." | Presses Use it. The card shrinks to "Capital B · Ready" [Trace again] [Draw over it]. The strip shows his B. Rule 12: "This photo has 6 more letters." [Do the next one] | 1 |
| 0:04 to 0:08 | For r, e, n, a, H, d: the photo dialog boxes the next part | Do the next one, types the letter, Trace it, Use it. After r, a toast: "Traced r. Also resized B to match the photo." (one size for the whole photo) | 3 + key each |
| 0:08 | All seven letters of "Brennan Hand" are ready. Rule 13: "Try your letters in a sentence." [Try it] | Presses Try it. The big preview shows "Brennan Hand" in his letters | 1 |
| 0:09 | The "en" gap looks wide. Pointing between e and n shows a purple handle: "drag to close or open this gap" | Drags it closer and lets go. Toast "Moved e and n closer [Undo]". A line appears under the preview: "Word needs one setting for gap fixes. Use in Word will show you." | 1 drag |
| 0:10 | Rule 4: "Happy with how it looks? Make a font file for Word." [Use in Word] | Presses it. The dialog: "Make a new folder inside Documents, for example My Fonts (Chrome won't let you pick Documents itself), then choose Allow." [Pick a folder...] | 1 |
| 0:11 | Windows folder picker, then Chrome's "Let site edit files?" | Makes "My Fonts" inside Documents, selects it, presses Allow, then Make my font file | 4 |
| 0:12 | "Made BrennanHand-Test1.otf. In Word it's called Brennan Hand Test 1." Four numbered steps; step 4 (the gap-fix setting) is highlighted | Step 1: File Explorer, Documents > My Fonts. Step 2: double-clicks the file, presses Install | (Windows) |
| 0:15 | Steps 3 and 4 | Closes Word completely, opens it, picks Brennan Hand Test 1, presses Ctrl+D > Advanced, ticks "Kerning for fonts" | (Word) |
| 0:18 | Types "Brennan Hand": his handwriting, nothing overlapping, the en gap closed | Done | |

**Coming back tomorrow:** launch from the desktop icon. "Continue: Brennan Hand · saved yesterday
[Continue]". One click, plus Chrome's one-time "Allow" for the file. He's back on the board where he
left off. Rule 15 suggests the next empty letter ("Next: small b."), in a to z order, then A to Z, then
punctuation.

**After M9:** rule 11 on a new font becomes "Fastest way: print a handwriting sheet, write on it, take a
photo. [Print my sheet]". Dropping the sheet photo fills the board. The board switches to "Check sheet
letters" with the scan beside each result, then Try it, then Use in Word. Same three steps; no second
numbered path.

---

## 4. Screens

Wireframes show the finished state after B16 (for example the Brush tool, which arrives in B8). Window
target: 1600 x 900, works down to 1280 x 720. All colors come from `tokens.css`.

**Color jobs.** Solid green fill with white text is reserved for the one primary button
(`.anyink-primary`). Every other "what you're touching" use of green is an outline only: the active
tool, the picked shape and point, the last-touched tile, a hovered edge. Purple = structure (guide
lines, curve handles, gap handles, photo parts in the dialog, the More tools band). Amber
(`--warning`, aliased as `--attention`) = needs a look, always with an "!" and a word, never color
alone.

### 4.0 The frame shared by every editor screen

```
+------------------------------------------------------------------------------------------------------------+
| ANY-INK  Brennan Hand  (1 Letters 7/58)--(2 Try it)--(3 Use in Word)    [Undo] [Redo]  * Saved  More tools  Menu v |
| Next: This photo has 4 more letters.                   [ Do the next one ]   Something else            x |
|       Tip: The faint photo stays under the letter for comparing. It never goes in the font file.          |
+------------------------------------------------------------------------------------------------------------+
|                                                                                                            |
|                             page area: the letter board (4.2) or the letter view (4.3)                     |
|                                                                                                            |
+------------------------------------------------------------------------------------------------------------+
| Try it: [ Brennan Hand___________ ] [Samples v]  36 pt --o--  [Big preview]  |  B r e n n a n  H a n d    |
+------------------------------------------------------------------------------------------------------------+
```

**Top bar** (row 1, rebuilt by `makeAppTopBar` on every navigate; the Simple branch lives in
`src/anyink/topbar/`):

| Control | Label | Action |
|---|---|---|
| Logo | "ANY-INK" | Goes to the letter board |
| Font name | "Brennan Hand" | Opens Font details (4.8) |
| Step 1 | "1 Letters 7/58" (ready / total) | Goes to the letter board. Green outline when on the board or in a letter |
| Step 2 | "2 Try it" | Opens Try it (4.6) over the current screen |
| Step 3 | "3 Use in Word" | Opens the Use in Word dialog (4.7) |
| Undo | "Undo" with an arrow icon; tooltip "Undo: traced B" | Undoes the newest change wherever it is (7.3); toast "Undid: traced B [Redo]". Disabled tooltip: "Nothing to undo yet" |
| Redo | "Redo"; tooltip "Redo: traced B" | Redoes; toast "Redid: traced B" |
| Status pill | "Saved" / "Saving..." / "Not saved yet [Save]" / "Couldn't save [Fix]" (4.11) | The Save / Fix buttons inside it act (outlined) |
| More tools | "More tools" | Turns on All tools mode (section 6) |
| Menu | "Menu" | Opens the menu (4.9) |

Below 1440 px the rail shows "1 2 3" plus the current step's name. Nothing is ever locked; every
step can be clicked at any time.

**Next line** (row 2): `<anyink-coach>`. Its state lives in `src/anyink/coach/coach_state.js`, so a
rebuilt top bar re-renders it instantly with no flicker. It holds one sentence, at most one button, a
quiet **"Something else"** link and "x".
- **The button** is green unless an open card or overlay already holds a green button; then it shows
  outlined (principle 1). Rules 1, 2, 3, 5 and 8 have no button at all, because the action is already on
  screen.
- **Something else** moves the coach to the next rule that matches and remembers the skip (per
  suggestion, for example "next letter: c" or "this photo") until the state behind it changes or the
  session ends. Skips live in memory, never in the font.
- **"x"** hides the line for this session; a small "Next" chip at the end of the rail brings it back.
  While it is hidden, a screen with no card or overlay may have no green button; that is his choice, and
  the one-green test runs with the line showing.
- **Tips** use the same voice: a first-use tip is a quiet "Tip:" beside the sentence, in the same
  row (D-037: the line is one row tall with or without a tip, so the page never moves), never a
  floating callout. At most 3 tips in the first session, never a tip that repeats the sentence beside
  it, and each disappears after his next action, except the Point pen's, which stays while its shape
  is being drawn (its clicks are one action). Seen tips are kept in prefs (`tipsSeen`); Menu > Help >
  "Show tips again" resets them. There is no tour.

The rules are checked in this order; the first match wins. "Ready" is defined in 4.2. While a
Point pen shape is open in the letter view the line keeps to it (rule 8's drawing sentences: "Keep
clicking to drop points, then press Finish the shape." and, from 3 points, "Click your first point,
or press Finish the shape."), ahead of rule 6, with no button (D-036, D-037). Rule 6 says the first
font problem not skipped; each problem keeps its own skip (D-037).

| # | When | Sentence | Button |
|---|---|---|---|
| 1 | Any ANY-INK dialog is open (photo dialog, How card, Use in Word, Font details) | (none: the line is empty; the dialog has its own green button) | none |
| 2 | Letter view: photo card step A | "Choose the photo that has your small r on it." | none (the card holds [Choose a photo...]) |
| 3 | Letter view: photo card step C | "Look right? Press Use it. Wrong part? Press Draw a box." | none (the card holds [Use it]) |
| 4 | Try it is open, 3 or more letters are ready, and letters changed since the last font file | "Happy with how it looks? Make a font file for Word." | [Use in Word] |
| 5 | Try it is open (otherwise) | "Type anything to try your letters. Press Done when you're finished." | none ([Done] is green) |
| 6 | The background font check found a problem (4.6) | "small a has a problem the font file can't hold." | [Fix it] |
| 7 | Letter view: this letter needs a look | The reason: "Capital B floats above the writing line." | The fix, e.g. [Sit on the line] (the card has [Looks fine to me]) |
| 8 | Letter view: this letter is empty | "Capital B is empty. Use a photo of it, or draw it with the brush." | none (the canvas overlay holds the green button) |
| 9 | Board: some letters need a look | "2 letters need a look." | [Show me] |
| 10 | The work file isn't saved and the font has ink | "Your work isn't saved yet." | [Save] |
| 11 | No letter has ink and the font has no photo (before M9) | "First, write your letters on paper and take one photo of the page." (after M9: "Fastest way: print a handwriting sheet, write on it, take a photo.") | [How] (after M9: [Print my sheet]) |
| 12 | A photo in this font has parts not used yet, and "Done with this photo" wasn't pressed | "This photo has 4 more letters." | [Do the next one] |
| 13 | 3 or more letters of the Try-it text are ready, and Try it hasn't been opened since the last change to a ready letter | "Try your letters in a sentence." | [Try it] |
| 14 | 3 or more letters are ready, letters changed since the last font file, and either Try it was opened since that change or 10 or more letters changed | "Make a font file and try your letters in Word." | [Use in Word] |
| 15 | An empty letter is left in the set | Letter view: "Capital B looks done. Next: small c." Board: "Next: small c." While the Brush is picked on a letter with ink (he may still be drawing): "When Capital B looks right, go to small c." with the button outlined (B8 + B9 finalize) | [Go to c] / [Make c] |
| 16 | Every letter in the set is ready and Numbers & symbols isn't added | "All 58 letters are ready. Add numbers & symbols next?" | [Add numbers & symbols] |
| 17 | Otherwise (everything ready, font file up to date) | "Your font is up to date. Type something in Try it." | [Try it] |
| 18 | Every letter ready, while rules 13, 14, 16 and 17 can't show (their flags are off; B8 + B9 finalize: the line went blank) | "All 58 letters are ready." | none |

**Next empty letter (rule 15)**, in this order: letters of the Try-it text; then a to z; then A to Z;
then punctuation; then numbers & symbols when added. Each Try-it letter gets **one turn**: once the
coach has suggested it and he did something else, it drops back into the normal order, so the coach
never keeps chasing an H that isn't in any photo.

The Try-it text starts as the font name. The How card asks for exactly those letters, so on the main
path every Try-it letter is in the photo.

**Preview strip** (existing `<preview-strip>`, Simple controls):

| Control | Label | Action |
|---|---|---|
| Text field | "Try it:" placeholder "Type anything". Starts as the font name | Live preview, as today. While it has focus it shows a green outline and the caption "Typing in Try it", and tool keys don't fire |
| Samples | "Samples" menu: My name (the font name), Every letter, Small letters, aaa eee ooo, "The quick brown fox jumps over the lazy dog", "Dear Mom, the banana bread was amazing." | Replaces the text. This is the only Samples control; Try it uses the same menu |
| Size | "36 pt" slider, 12 to 144 pt | As today |
| Big preview | "Big preview" with an expand icon | Opens Try it (4.6) |
| Rendered letters | His letters. Letters not made yet are faint outlined stand-ins (about 15% ink, no box). Until 5 letters are ready, a small legend at the right end reads "gray = not made yet" | Double-click a letter: open it. Tooltip "Double-click to work on d" |

Hidden in Simple: "Real font", "Metrics", "Presets" (renamed Samples), and the font-check chip (in
Simple the Next line carries it, rule 6).

**Toasts** sit bottom-right above the strip and last 6 s (hover pauses them). One shows at a time.
Kinds, highest priority first: undo/redo ("Undid: traced B [Redo]"), destructive ("Cleared B
[Undo]"), automatic ("Made shape 2 a hole [Make it solid]", "Traced r. Also resized B to match the
photo."), info ("ANY-INK works offline now."). A toast with a button is never replaced by an info
toast; info toasts wait their turn. In Simple, pressing a tool key shows "Switched to Rectangle (R)".

### 4.1 Start screen (replaces the four-tab Open Project page in Simple mode)

```
+------------------------------------------------------------------------------------------+
|                                        ANY-INK                                           |
|                                                                                          |
|  Continue where you left off                                                             |
|  +------------------------------------------------------------------------------------+  |
|  |  Brennan Hand                                  saved yesterday      [ Continue ]  |  |
|  +------------------------------------------------------------------------------------+  |
|  Other fonts:  Test Caps  .  Old Hand                           Open a saved font...     |
|  ------------------------------------------------------------------------------------    |
|  Make a new font                                                                         |
|  Name it:  [ My Font_____________________ ]   [ Create my font ]                         |
|            Next, Windows asks where to keep your work file. Documents is fine.           |
|            This is your work file, not the font. You'll make the font for Word in step 3.|
|  ------------------------------------------------------------------------------------    |
|  Other ways to start...                                   Built on Glyphr Studio 2 (GPL) |
+------------------------------------------------------------------------------------------+
```

After a crash, the same card changes; there is never a second card or a second green button:

```
|  +------------------------------------------------------------------------------------+  |
|  |  ! Brennan Hand has changes from Tuesday 3:40 PM that aren't in its work file.     |  |
|  |  [ Continue with them ]                              Open the saved file instead   |  |
|  +------------------------------------------------------------------------------------+  |
```

| Control | Shown when | Action |
|---|---|---|
| Continue card: font name, "saved yesterday", [Continue] (green) | A recent work file exists and no backup copy is newer than it | Asks Chrome for file permission inside the click, then opens the font on the board. If refused: "Chrome needs your OK to open this file. Press Continue again and choose Allow." First-time hint under the button: "Chrome may ask to let ANY-INK edit this file. Choose Allow on every visit." |
| Crash version of the card: "<font> has changes from <day> <time> that aren't in its work file." [Continue with them] (green), "Open the saved file instead" (link) | A backup copy is newer than its work file | Continue with them restores the backup (D-026) and then asks for the file permission, so autosave writes the restored work into the file. Open the saved file instead opens the older file; the newer changes stay in the backup list (Other ways to start), up to the last 3 per font |
| No-file crash card: "Unsaved work from <day> <time>: <font>." [Continue with it] (green), "Throw it away" (link) | A backup copy has no work file | Continue with it restores it with status "Not saved yet [Save]". Throw it away asks the only start-screen confirm: "Throw away this unsaved work? This can't be undone. [Throw it away] [Keep it]" |
| Other fonts: up to 3 recent names; "Open a saved font..." | Always (the link shows even with recents) | A name opens that font; "Open a saved font..." opens the Windows file picker for .gs2 |
| Name it field `#input__new-project-name` | Always | Default "My Font", or "My Font 2", "My Font 3"... when a recent font already has that name |
| [Create my font] `#button__create-new-project`. Green when there's no Continue card, outlined otherwise | Always | Inside the click: starts `showSaveFilePicker` (suggested "<name>.gs2", start in Documents) **without awaiting it**, creates the font and opens the board. When the picker resolves, the file is written and the status reads "Saved". If cancelled: "Not saved yet [Save]" and rule 10. No error. **If the picked file is one of his recent fonts or an existing work file with letters in it**, nothing is written yet: "That replaces your font "Brennan Hand" (12 letters). [Use a new name] [Replace it]". Use a new name reopens the save dialog (a new click). Replace it first keeps a backup copy of the old file, then writes |
| "Other ways to start..." | Always | Opens the original tabs (import a font or SVG, the full backups list, examples) under the purple More tools band |
| Drop a .gs2 anywhere | Always | Opens it |

**Install offer:** not on the start screen. It appears once, as a toast, after the first letter
becomes Ready or after the first font file, whichever is first: "Install ANY-INK as an app so it opens
from your desktop. [Install] [Not now]". Not now is remembered; after that, install lives in Menu >
Help.

"ANY-INK works offline now." is shown once, ever, as a toast. The update notice today reads "Update
ready. Reload after protecting open projects in recovery." with the button "Update and reload"
(`pwa/register.js`). B4 rewords it to "A new version of ANY-INK is ready. Your work is kept.
[Reload]"; it still never reloads by itself (D-020).

### 4.2 The letter board (home)

The Overview page in Simple mode (`src/anyink/board/`, mounted in the Overview right area; the page id
stays `Overview`).

```
+------------------------------------------------------------------------------------------------------------+
| (top bar)                                                                                                  |
| Next: 1 letter needs a look.                                           [ Show me ]   Something else    x  |
+------------------------------------------------------------------------------------------------------------+
| YOUR LETTERS   7 of 58 ready   [######......................................................]              |
| Show: (All 58)  (Needs a look 1)  (Empty 51)            [ Use a photo... ] [ Letter spacing... ] [ + Numbers & symbols ] |
|                                                                                                            |
| CAPITALS   2 of 26                                                                                         |
|  +--------+ +--------+ +- - - - -+ +- - - - -+ +- - - - -+ +- - - - -+                                     |
|  |   B    | |   H    | :    A    : :    C    : :    D    : :    E    :   ...                              |
|  | (ink)  | | (ink)  | : (faint) : : (faint) : : (faint) : : (faint) :                                    |
|  | Ready  | | Ready  | :  Empty  : :  Empty  : :  Empty  : :  Empty  :                                    |
|  +--------+ +--------+ +- - - - -+ +- - - - -+ +- - - - -+ +- - - - -+                                     |
| SMALL LETTERS   4 of 26                                                                                    |
|  +--------+ +- - - - -+ +- - - - -+ +--------+ +========+                                                  |
|  |   a    | :    b    : :    c    : |   d    | |  e  !  |   ...                                            |
|  | Ready  | :  Empty  : :  Empty  : | Ready  | |Needs a look                                               |
|  +--------+ +- - - - -+ +- - - - -+ +--------+ +========+                                                  |
| PUNCTUATION                                                                                                |
|  :  .  :  :  ,  :  :  '  :  :  ?  :  :  !  :  :  -  :          The space between words is made for you.    |
+------------------------------------------------------------------------------------------------------------+
| (strip)                                                                                                    |
```

**Letter set:** the board shows the **Quick font**: A to Z, a to z and the punctuation . , ' ? ! -,
which is 58 letters. The space between words is made automatically at export (one quarter of the letter
box wide, D-017) and never shown as a tile. "+ Numbers & symbols" adds a NUMBERS & SYMBOLS section (0
to 9 and : ; " ( ) & @ # $ % / *) and raises the total. The project's character ranges don't change;
the board's set is a view stored in `settings.anyink.letterSet` (`'quick'` or `'quick+numbers'`). Each
toggle is one settings Undo step (7.3).

**Tiles** (96 x 112 px), built on `GlyphTile` with its `session-state` attribute grown into these states:

| State | Look | Caption |
|---|---|---|
| Empty | A faint outlined system-font letter (about 15% ink), dashed border | "Empty" |
| Ready | His ink | "Ready" (the tooltip says "from a photo" or "drawn") |
| Sheet (after M9) | His ink | "Ready" (tooltip "from your sheet") |
| Needs a look | His ink, amber border, "!" | "Needs a look". Tooltip gives the reason: "Floats above the writing line" |
| Has versions (after M11) | Badge "x3" | |
| Last touched | Green outline ring | |

Click a tile, or **type its letter** (b opens small b, Shift+B opens Capital B, punctuation keys
too; arrow keys move between tiles and Enter opens): the letter view. Drop a photo on a tile: that
letter, with the photo dialog when the photo has more than one part (4.4). Hover: "Capital B · Ready ·
from a photo" or "small e · Needs a look: floats above the writing line".

**Ready** means the letter has ink and every check (B11) passes, or he pressed [Looks fine to me] on
each one that doesn't. "Looks fine to me" is stored per letter and per check (`glyph.anyink.checksOk`)
and is cleared only when the letter's shapes change. **Soft notes** ("Thicker than your other
letters") never take Ready away and never turn a tile amber; they show as a quiet line in the letter
card. If a later change flips a letter he isn't looking at, a toast says so: "Moving the line made 3
letters need a look. [Show me]".

**Progress:** one line, "N of 58 ready", with a bar. A section heading shows its own count ("Small
letters 4 of 26") only once that section has a ready letter. A finished section gets a check mark and
a one-time toast ("All small letters done. Your font can type words now.").

**Filters:** All / Needs a look / Empty, shown only once a letter needs a look. Under "Needs a look",
each tile shows its reason and its fix buttons right on the tile, outlined ([Sit on the line], [Fit
spacing], [Remove 3 specks], [Match size], [Looks fine to me]); the one green button stays the Next
line's.

**Toolbar** (at most four buttons; after M9 "Handwriting sheet..." is added first):

| Button | Shown when | Action |
|---|---|---|
| Use a photo... | Always | Windows image picker, then the photo dialog (4.4) with the letter unknown |
| Letter spacing... | 3 or more letters are ready | Opens Try it with "Move all letters closer or further apart" open |
| + Numbers & symbols | Always | Adds that section. Becomes "- Numbers & symbols" (hides the section; never deletes letters) |

**Drops:** a photo on a tile goes to that letter. A photo on blank board space opens the photo dialog
with the letter unknown (after M9, a photo whose four corner marks are found starts the sheet import
instead). A .gs2 opens it. Anything else gets one sentence: "ANY-INK takes photos (PNG, JPEG, WebP)
and ANY-INK work files (.gs2)."

**Undo on the board** undoes the newest change without leaving the board: "Undid: traced B [Show me]".

**Empty state** (a new font): every tile is Empty, there is one progress line, no filters and no
"Letter spacing...". The strip shows the font name as faint stand-ins with the "gray = not made yet"
legend. Rule 11 asks for the photo. No extra text block.

### 4.3 The letter view (one editing screen)

The Characters page in Simple mode. The left area's PAGE / EDITING / PANEL buttons are replaced by a
back button and the letter's name, and the panel slot always shows the **letter card**
(`src/anyink/letter/`).

**Empty letter:**

```
+------------------------------------------------------------------------------------------------------------+
| (top bar)                                                                                                  |
| Next: Capital B is empty. Use a photo of it, or draw it with the brush.             Something else      x  |
+--------------------------------+---------+---------------------------------------------------------------+
| [<- All letters]   Capital B   |  Brush  |  top line - - - - - - - - - - - - - - - - - - - - - - - - - -  |
|                    [< A] [C >] |    B    |  capitals line - - - - - - - - - - - - - - - - - - - - - - -   |
|--------------------------------|  Select |              ,----.                                           |
|  Capital B            Empty    |    V    |              |    )    (faint outlined guide letter B)        |
|                                |         |  small-letter line - - - - - - - - - - - - - - - - - - - - -  |
|                                |         |              |----.       +-------------------------------+   |
|                                |         |              |    )       |  Capital B is empty.          |   |
|                                |         |  writing line ====='===    |  [ Use the same photo ] [thumb]|  |  <- green
|                                |         |                            |  [ Choose another photo... ]  |   |
|                                |         |  tail line - - - - - - -   |  [ Draw with the brush ]      |   |
|                                |         |                            |  or drop a photo here         |   |
|                                |         |                            |  No photo yet? How to take one |  |
|                                |         |                            +-------------------------------+   |
|                                |         |   [-] --o-- [+]  [Fit letter]                                 |
+--------------------------------+---------+---------------------------------------------------------------+
| (strip)                                                                                                    |
```

The overlay's first button is the green one: **[Use the same photo]** (with a thumbnail) when a photo
in this font has parts not used yet, otherwise **[Use a photo]**. The other buttons are outlined. The
card has no buttons of its own on an empty letter, so nothing on the screen is repeated. The overlay
hides while the photo card is running. A photo he pressed "Done with this photo" on never leads
(B8 + B9 finalize): a photo not done comes first, and when only a done photo has parts left the
order is [Choose another photo...] (green), [Use the same photo] (outlined), [Draw with the brush].

**Ready letter (the normal state):**

```
+--------------------------------+---------+---------------------------------------------------------------+
| [<- All letters]   small a     |  Brush  |  top line - - - - - - - - - - - - - - - - - - - - - - - - -   |
|                    [< z] [b >] |  Select |  capitals line - - - - - - - - - - - - - - - - - - - - - - -  |
|--------------------------------|         |  small-letter line - - - - - - -  ____  - - - - - - - - - - -  |
|  small a              Ready    |         |                                  /    \   |                    |
|                                |         |                                 |  (o)  |  |   (his a, the     |
|  [ Trace again ] [ Draw over it ]        |                                  \____/|  |    faint photo    |
|                                |         |  writing line ====================================  under it)  |
|  > Fine-tune this letter       |         |  tail line - - - - - - - - - - - - - - - - - - - - - - -       |
|                                |         |   [-] --o-- [+]  [Fit letter]                                 |
+--------------------------------+---------+---------------------------------------------------------------+
```

**Fine-tune open:**

```
+--------------------------------+---------+---------------------------------------------------------------+
|  small a              Ready    |  Brush  |  (as above, plus: purple left and right edges with the spaces |
|  [ Trace again ] [ Draw over it ]  Select |   shaded light purple, and his n faintly on each side,       |
|  v Fine-tune this letter       |  Edit   |   labeled "Your n, shown for comparing" the first time)       |
|    Photo   Photo fade --o--    |  points |                                                               |
|            [Hide photo]        |  Point  |                                                               |
|            > Photo options     |   pen   |                                                               |
|    Shapes  Shape 1   Solid     |Rectangle|                                                               |
|            Shape 2 [Solid|Hole]|  Oval   |                                                               |
|            > Shape options     |         |                                                               |
|    Spacing Automatic. Drag the |         |                                                               |
|            purple edges to set |         |                                                               |
|            it yourself.        |         |   [-] --o-- [+]  [Fit letter]                                 |
|    Open in More tools          |         |   Dark paper (o)  Outline only (o)  Neighbors (*)  Guide letter (o) |
+--------------------------------+---------+---------------------------------------------------------------+
```

**Header row:**

| Control | Label | Action |
|---|---|---|
| Back | "<- All letters" | The board, scrolled to this tile |
| Name | "Capital B" from `letterName()` | |
| Previous / Next | "< A" / "C >" | The previous or next letter in the board order |

**Letter card sections.** A section shows only when it applies; nothing is greyed out.

| Section | Shown when | Controls and labels | Actions |
|---|---|---|---|
| Header | Always | Name + state chip: "Empty", "Ready", or "Needs a look: <reason>" with [Looks fine to me] (outlined). A soft note shows as a quiet line: "Note: thicker than your other letters." | The fix button for "Needs a look" is in the Next line (rule 7), not repeated here |
| Main buttons | The letter has shapes and no photo card step is open | [Trace again] (only when it has a photo), [Draw over it] (picks the Brush; after B8) | Trace again opens the photo dialog for this letter on its photo |
| Photo card | Running | Steps A and C (4.4) | |
| Fine-tune this letter | The letter has shapes. Closed by default; stays as he left it for the session | **Photo:** "Photo fade" slider; [Hide photo] / [Show photo]; "Photo options" (closed): Lock the photo (on), Light ink on dark paper, Fit to letter box, Fit to capitals line, Remove photo. **Shapes:** one row per shape, "Shape 1 · Solid", with a [Solid / Hole] switch on the picked shape; "Shape options" (closed): Merge overlapping shapes, Flip left-right, Flip upside-down, Clear letter. **Spacing:** "Automatic. Drag the purple edges to set it yourself." or "Set by you. [Back to automatic]". **Tail** (g j p q y, Q J f only): [It has a tail] / [No tail]. **This point** (Edit points with one point picked): [Smooth] [Corner]. "Open in More tools" (link) | Each change is one Undo step. Clear letter: toast "Cleared B [Undo]". Tail re-seats the letter (B3) |
| Brush | The Brush tool is active (B8) | "Size: thin --o-- thick". After M10: nib pictures [Round] [Flat] [Pointed] and "Angle" | Sets the brush for new strokes |
| Versions | After M11 | Tabs [1] [2] [3] [+ Add a version] | 5.2 |
| Style | After M12 / M13 | [Thinner] [Thicker]; "Ink texture >" | 5.2 |

**Tools** (left column, icon with the word under it and the key in small print):

| Tool | Label | Key | Shown | Notes |
|---|---|---|---|---|
| nib (B8) | Brush | B | Always | Default on an empty letter. Tip once: "Undo removes the last stroke." (the Next line already says "Drag on the paper to draw. Each drag is one stroke."; B8 + B9 finalize) |
| resize | Select | V | Always | Default on a letter with ink. A drag on empty canvas shows "To draw, pick the Brush." The photo is locked after Use it, so Select never moves it by accident |
| pathEdit | Edit points | E | Fine-tune open | Tip: "Drag a point to reshape it. Press Smooth to round a corner." (D-037: a clicked shape has no round handles) |
| newPath | Point pen | P | Fine-tune open | Caption under the icon: "click to place points". Tip: "Click to drop points. Hold and drag to bend the curve. Click the first point to finish." (stays while the shape is open). A shape ended with 1 or 2 points ("Finish the shape", another tool, another letter or page) is taken away as one step: "A shape needs at least 3 points, so that one was taken away." Leaving the letter view or opening another letter mid-shape ends the shape on its own letter (D-037) |
| newRectangle | Rectangle | R | Fine-tune open | Tip: "Drag to draw. Draw one inside another to cut a hole." |
| newOval | Oval | O | Fine-tune open | Same tip |

"Add a point" (pathAddPoint) is More tools only. Pressing the key of a tool inside Fine-tune opens
Fine-tune and picks the tool, with the "Switched to ..." toast.

**Canvas:**
- **Guide lines** span the full canvas width, labeled at the left in plain words: top line, capitals
  line, small-letter line, writing line (drawn heavier), tail line. They are locked in Simple mode (no
  drag, no arrow-key nudge) except while "Move the guide lines" is on (4.8). Today they span only the
  letter's width, so an empty letter (width 0) shows none; B1 fixes that in both modes.
- **Guide letter:** a faint outlined system-font letter (Segoe UI, about 15% ink) sized to the right
  lines. It shows on an empty letter and stays while he draws with the Brush, until he leaves the
  letter. "Guide letter" switch in Fine-tune.
- **Edges and spaces** (only while Fine-tune is open): two purple vertical edges at the left and right
  of the letter width, with the spaces between ink and edge shaded light purple. Hover an edge: it gets
  a green outline and the label "left space". Dragging shows a readout ("right space 88") and, on
  release, makes one Undo step and switches spacing to "Set by you" (7.2).
- **Neighbors** (only while Fine-tune is open; on by default once n or H is ready): his n faintly on
  each side of a small letter, his H for a capital. The first time, each is labeled "Your n, shown for
  comparing"; the switch's tooltip says "Shows your n on each side, to judge the spacing". Drawn by a
  view-only override in `context_characters.js`, so it never writes to the letter or the font.
- **The drawing never jumps:** automatic spacing moves the shapes, the photo and the view by the same
  amount in the same frame, so the ink stays still under his pointer and only the edges move.
- **View controls** (bottom right): zoom "-" slider "+" and "Fit letter" always. Inside Fine-tune, four
  real on/off switches named for the thing they show: "Dark paper", "Outline only", "Neighbors",
  "Guide letter". Space-drag and the middle mouse button pan.

**Drop a photo anywhere on this screen:** it becomes this letter's photo; the photo dialog opens if it
has more than one part, otherwise step C runs.

### 4.4 Photos: the How card, the photo card and the photo dialog

`src/anyink/photo/`. A photo can hold one letter or a whole page. Three pieces work together: the
**How card** (getting a good photo), the **photo dialog** (which part of the photo is which letter) and
the **photo card** in the letter card (pick a photo; look at the result).

**The How card** (a dialog; opened by rule 11's [How], by "No photo yet? How to take one" in the
empty-letter overlay and step A, and from Help):

```
+--------------------------------------------------------------------------+
|  How to photograph your letters                                   [x]    |
|  1. Use a black felt-tip pen (a Sharpie works) on plain white printer   |
|     paper, not lined notebook paper.                                     |
|  2. Write every letter about 1 inch tall, all the same size, with a      |
|     finger's width between letters, a thumb's width between rows.        |
|  3. For a first try, write the letters in "Brennan Hand" once each:      |
|     B r e n a H d. Or write the whole alphabet: capitals in rows, then   |
|     small letters in rows, then . , ' ? ! -                              |
|  4. Lay the page flat in even light. Hold the phone straight above it    |
|     and take one photo. More than one page? Take one photo of each.      |
|  5. Get the photo onto this PC: email it to yourself, or use Phone Link, |
|     and save it to Downloads.                                            |
|  [ I have my photo ]  (green)                     [ Close ]              |
+--------------------------------------------------------------------------+
```

Item 3 lists the distinct letters of the Try-it text (which starts as the font name). [I have my photo]
opens the Windows image picker (it starts in Downloads), then the photo dialog with the letter unknown,
or with the letter known when the card was opened from a letter.

**Step A, pick** (photo card, in the letter card; reached by [Use a photo] when the font has no photo,
or by [Choose another photo...]):

```
|  Photo of your small r                               |
|  [ Choose a photo... ]   (green)                     |
|  Photos in this font:  [thumb] [thumb]               |  <- newest first, up to 6; click one to use it
|  No photo yet? How to take one >                     |
|  [ Cancel ]                                          |
```

**Step B, the photo dialog.** It opens whenever a photo has **two or more parts**, whatever the gaps
between them, and whenever the letter isn't known yet (4.5). Only a photo with exactly one part, opened
from a letter, skips it and goes straight to step C.
- **Parts.** Ink pieces are joined into one part when their left-to-right spans overlap by at least half
  the narrower piece **and** they also share their height (up and down they overlap by half the
  shorter piece: a crossbar, a pen lift), or one of them is a **dot** (no wider and no taller than 40 %
  of a typical piece) sitting above or below the other within 60 % of a typical piece's height, its
  middle at most 30 % of that height to the side (a drifted or slanted dot). A dot joins only the
  nearest such piece. So i, j, !, ?, :, ; and a dotted i each stay one part, and letters written one
  under the other on a whole-alphabet page never join (B3 finalize: the left-to-right rule alone made
  every column one part). Pieces too small to be anything (a speck, B11's rule) are ignored. Parts are
  sorted into rows by vertical overlap: rows top to bottom, parts left to right. The reference is
  `src/anyink/placement/tests/ink_parts_lite.js`.
- **The view.** The whole photo fills the dialog (about 1000 x 600 px), unless its letters would show
  under 56 px tall there: then it opens close up (filling the width when that is enough, else about
  80 px letters), scrolls up and down, and keeps the green box in view; [-] [+] under the photo and
  Ctrl + the wheel zoom (B9 photo-ui fix). A window resized while it is open keeps the letters the size
  they were (B8 + B9 finalize). Each part has a thin purple outline. Parts already used carry their
  letter's name tag ("B"), placed where it covers no other letter and no other tag. One part has a
  **green dashed box**: the guess, which is the first unused part in reading order. On a part that
  may hold two letters written touching (twice a letter's width), the sentence under the photo says
  "Two letters touch here. Drag a box around each one." Junk the finder can tell from a pen's ink
  (ruled and margin lines, punch holes, a hand's shadow, a crossed-out letter) is never a part he is
  asked about; a letter written lighter than the rest, or with a second pen, is still a letter
  (B8 + B9 finalize).
- **Picking.** Clicking a part picks it. Dragging anywhere draws a new box, with a crosshair cursor. The
  photo is not on the edit canvas here, so a drag can never move the photo. A box always reaches the
  ink he sees, even ink the parts finder left out (a lighter letter, a second pen). Boxes he drew and
  used round two touching letters together cover the part the finder made of them, so it isn't
  offered again.

Letter known (opened from a letter):

```
+--------------------------------------------------------------------------+
|  Which part is your small r?                                      [x]    |
|  +--------------------------------------------------------------------+  |
|  |  [B]   ( r )    e     n     a     H     d                          |  |
|  |         ^ green dashed box; [B] = used, tagged                     |  |
|  +--------------------------------------------------------------------+  |
|  Click a letter in the photo, or drag a box around it.                   |
|  [ Trace it ]  (green)                                [ Cancel ]         |
+--------------------------------------------------------------------------+
```

Letter unknown (a photo dropped on the board, "Use a photo..." on the board, the How card, or rule 12's
[Do the next one]):

```
|  Which letter is in the green box?  [ r ]   That's: small r              |
|  [ Trace it ]  (green)    Not a letter, skip it    Done with this photo  |
```

The field takes one character and says what it understood ("That's: small l" vs "That's: Capital I").
When the last two letters named from this photo were next to each other in the alphabet (a, then b), the
field starts filled with the next one (c), so a written-out alphabet goes by with Enter, but only on the
part right after the last one named, never on a part that may hold two touching letters or the part
after one, a skipped part or one far smaller than a letter (B8 + B9 finalize: after j and k it put l on
"lm", then m on the n). When the letter is known, the guess is never a lone dot of the pen (a photo
whose letter the edge cut), and a photo opened from a letter skips the dialog only when its one part
is letter-sized. Trace it opens
that letter's view at step C. "Done with this photo" stops rule 12 for this photo; the unused parts
stay available through "Use the same photo". After M9, a photo whose four corner marks are found starts
the sheet import instead.

**Step C, result** (photo card; tracing starts on its own with the automatic ink cutoff, under 1 s):

```
|  Look right?                                         |      canvas: the photo, moved and scaled so the
|  [ Use it ]  (green)            [ Cancel ]           |      part sits on r's lines, with the green
|  Wrong part?  [ Draw a box ]                         |      dashed traced outline on top
|  This replaces your 2 shapes. Undo brings them back. |  <- only when the letter already has shapes
|  Add to my shapes instead                            |  <- only when the letter already has shapes
|  > Adjust                                            |
|     Ink cutoff   less ink --o-- more ink   [Auto]    |
|     Smooth --o-- Detailed                            |
|     [x] Remove specks                                |
|     [ ] Light ink on dark paper                      |
|     Paper: (Flat scan) (Phone photo)  picked for you |
```

- **Wrong part? [Draw a box]** is always there. It reopens the photo dialog for this letter.
- **Quiet notes** under the buttons, one line each: "This part may be two letters that touch. If so,
  press Draw a box and drag a box around each one." and "small f reaches far above the top line, so
  lines of text in your font will sit further apart." (B9 photo-flow fix; shown since the B8 + B9
  finalize).
- **The canvas** fits a tall result and every guide line in view when a part's result is first ready
  (once per part; Adjust re-traces leave his view alone).
- **Smooth --o-- Detailed** is one slider. It moves potrace's smoothing and detail settings together
  along one curve (the mapping table is part of B9); More tools keeps the two separate sliders.
- **Paper** is picked by B9's detector: a JPEG with camera fields in its EXIF, or a page whose paper
  brightness varies by more than a set amount across the image, gets Phone photo; anything else gets
  Flat scan (D-016 amended).

**Placement** (B3) happens before he sees the result, in `photo_flow.js`, by moving and scaling this
letter's photo record (`trace.x/y/scale`) before tracing, so the traced shapes land in place. It never
runs inside `applyAutoTrace`.
- **One size for the whole photo, unless a row was written at another size.** The photo's scale is the
  median, over every letter named from it so far, of (that letter's line height / its ink height); line
  heights by letter class are in B3. When a new letter is named, the scale is recomputed. A row written
  clearly bigger or smaller (15 % or more off the page's usual size, judged only against rows that
  share kinds of letter with it) gets its own size, faded in from 7 % so a messy hand's wobble keeps one
  size; capitals rows take the size of the small-letter row next to them (D-034). Earlier letters from the same photo that he hasn't
  changed since tracing (flag `anyink.photoFit`) are resized to the new scale in the same Undo step, and
  the toast names them ("Traced r. Also resized B to match the photo."), only when the change is more
  than 3%. Letters from one photo therefore always share one ink weight. The scale is stored with the
  photo in `settings.anyink.photos[assetId]`, together with its parts and which letter used which part.
- **One writing line per row, sloped with the photo.** In a row with 3 or more parts, the row's writing
  line runs through the bottoms of its parts at the photo's one slope (a phone held a little off square
  turns every row alike). **Every letter's body bottom sits on the writing line**, wherever on the page
  it was written (D-034: keeping the wobble put a third of a neat page past B11's 2 % limit and repeated
  it in every word). Tails (g, p, y, a long f, the tail of Q or J) hang below on their own. The row line
  serves where a letter's shape can't show its body: j and y, a tail with no bowl, a bowl that closes
  clearly above a tight row line.
- **Rows with 1 or 2 parts:** the bottom of the letter's body sits on the writing line. For tail letters
  (g j p q y, and Q J f when [It has a tail] is on) the body bottom is the lowest row where the ink still
  spans at least half the letter's width. Fine-tune > Tail ([It has a tail] / [No tail]) re-seats the
  letter if the guess was wrong.

**Use it:** puts the shapes in, rounds every point to whole units, sets spacing to Automatic and fits
it (the photo moves with the shapes, 7.2), fades the photo to 25% and **locks** it, and sets
`anyink.photoFit`. The first time, the tip line says "The faint photo stays under the letter for
comparing. It never goes in the font file." Undo: one step titled "traced r" (an item step, or a
whole-project step when earlier letters from the photo were resized).

**Cancel** at step A, B or C: removes the photo if this card added it, and puts back the previous
photo and its position. The letter's shapes never change. No Undo step.

**Never greyed out.** The old "Only inside the glyph box" rule is gone in Simple mode; the part picked
in the photo dialog is the area traced.

**No ink found:** "No ink found in that part. Drag Ink cutoff toward more ink, or draw the box again.
[Draw a box]" with Adjust opened so Ink cutoff shows. **No letter found** (the part holds only
ruled-line bits, specks or a punch hole, where more ink can't help): "No letter found in that part.
Draw the box again around the letter. [Draw a box]", Adjust left as it was. An ink cutoff he set by
hand that never gave a letter starts on Auto again at the next part (B8 + B9 finalize: dragged to the
"more ink" end on a part with nothing to find, it stayed, and the next letters traced as filled
boxes). Nothing changes in the letter. **Unsupported file:** see 7.7.

### 4.5 A photo dropped on the board

This is the photo dialog with the letter unknown (4.4, step B). A photo with a single part still opens
the dialog, with that part boxed, so he can type which letter it is. Editor keys are blocked while any
ANY-INK dialog is open (capture phase, as in `pwa/register.js`), so typing "B" in the field never
switches to the Brush.

### 4.6 Try it (step 2)

The preview strip grows to fill the page area. The top bar stays; the strip element is never rebuilt.
Esc, [Done] or Step 1 closes it (`src/anyink/tryit/`).

```
+------------------------------------------------------------------------------------------------------------+
| (top bar: step 2 outlined green)                                                                           |
| Next: Happy with how it looks? Make a font file for Word.            [ Use in Word ]   Something else   x  |
+------------------------------------------------------------------------------------------------------------+
|  Try it                                                                                         [ Done ]  |
|  +------------------------------------------------------------------------------------------------------+  |
|  |                                                                                                      |  |
|  |      Brennan  Ha|nd      (his letters, 72 pt; "|" = purple gap handle under the pointer)            |  |
|  |                                                                                                      |  |
|  +------------------------------------------------------------------------------------------------------+  |
|  Gap between two letters looks off? Point between them and drag the purple handle.                         |
|  Word needs one setting for gap fixes. Use in Word will show you.          (after the first gap fix)       |
|  Type: [ Brennan Hand______________________ ]  [Samples v]   Size 72 pt ----o----   Guide lines (o)        |
|  > Move all letters closer or further apart                                                                |
|  > Gaps you fixed (2)                                                                                      |
|  Your font builds OK.                                                                                      |
+------------------------------------------------------------------------------------------------------------+
```

| Control | Action |
|---|---|
| Big preview and the hint line | First thing on screen. The hint is the only instruction |
| Type field, Size, Samples | Shared with the strip; one Samples menu |
| Guide lines | A switch; draws the five lines on the type |
| Move all letters closer or further apart (closed) | A slider, "closer --o-- further apart", and [Reset]. Live while dragging; on release, one whole-project Undo step, "moved all letters closer". It adds the same extra space to both sides of **every** letter, automatic or set by him, stored apart from each letter's fitted gap (`settings.anyink.spacing.extra`). A side never goes below zero space unless it already was (a hanging f), so the far left end means letters touch, never overlap. Photos move with the shapes (7.2) |
| Gap handle | Point between two made letters: a purple handle with the tooltip "drag to close or open this gap". Drag is live; release writes a one-pair rule (a kern group with one left and one right letter) as a whole-project Undo step, "moved e and n closer", so undo never jumps pages. Double-click the handle: removes that gap fix. The first gap fix shows the "Word needs one setting" line, until Use in Word has shown its step 4 once |
| Gaps you fixed (closed) | Each fix as words ("en" closer / further); [x] removes it (one Undo step) |
| Stand-ins | Letters not made yet as faint outlined letters; double-click opens that letter |
| Font check line | "Your font builds OK." or "small a has a problem the font file can't hold. [Fix it]". The check (B1) runs 2 s after the last change on the **real exporter's list of letters for the whole font**, not only the letters in the preview, and names the letter. Never falls back silently |
| Done | Closes Try it (green when rule 5 applies, otherwise outlined) |

After M11: a "Versions take turns" switch (on by default). After M12/M13: a "Looks" drawer (5.2).

### 4.7 Use in Word (step 3)

A dialog (`src/anyink/install/`). Editor keys are blocked while it's open. Ctrl+E opens it in Simple.

**Before making a file:**
```
+--------------------------------------------------------------------------+
|  Use your font in Word                                            [x]    |
|  This makes a font file (.otf) that you install in Windows.              |
|  Your work file stays as it is.                                          |
|                                                                          |
|  Font files go in:  (no folder yet)     [ Pick a folder... ]             |
|  Make a new folder inside Documents, for example "My Fonts"              |
|  (Chrome won't let you pick Documents itself), then choose Allow.        |
|                                                                          |
|  ! 51 letters aren't made yet. In Word they won't be in your handwriting.|
|  ! 1 letter needs a look.  [Show me]                                     |
|                                                                          |
|  [ Make my font file ]  (green)                                          |
+--------------------------------------------------------------------------+
```

**After making it** (only the steps, and the gap-fix step only when gap fixes exist):
```
+--------------------------------------------------------------------------+
|  Made "BrennanHand-Test3.otf".                                    [x]    |
|  In Word it's called "Brennan Hand Test 3".                              |
|   1. Open File Explorer, then Documents > "My Fonts".                    |
|   2. Double-click "BrennanHand-Test3.otf", then press Install.           |
|      If you installed "Brennan Hand Test 2" earlier, you can uninstall   |
|      it first so Word's font list stays short.  How >                    |
|   3. Close Word completely, open it again, and pick                      |
|      "Brennan Hand Test 3" from the font list.                           |
| +------------------------------------------------------------------------+
| | 4. Turn on your gap fixes: in Word press Ctrl+D, open "Advanced", and  |  <- highlighted
| |    tick "Kerning for fonts". "Set As Default" keeps it for new files.  |
| +------------------------------------------------------------------------+
|  [ Done ]  (green)                                                       |
|  > When you're happy with it                                             |
+--------------------------------------------------------------------------+
```

"When you're happy with it" (closed) holds: [Make the final font] (named "Brennan Hand"), "Why
'Test 3'?", "Remove old test fonts: how", and "A web app can't install fonts for you, so these steps
are yours." After M11, a highlighted step 5 appears only when a letter has versions: tick "Use
Contextual Alternates" on the same Advanced tab. Word's own labels and file names are `.anyink-quote`
(2.3).

| Control | Action |
|---|---|
| Pick a folder... | `showDirectoryPicker` inside the click (D-027), then Chrome's "Let site edit files?" (Allow). Remembered; afterwards the line reads `Font files go in: "My Fonts" [Change]`. Only the folder's name is known, never its full path. If the picker comes back with nothing (cancelled, or Chrome refused a system folder such as Documents, Desktop or Downloads): "No folder picked. Make a new folder inside Documents (Chrome won't let you pick Documents itself) and choose it." |
| Step 1 | Uses the real folder name. "Documents >" assumes he followed the tip; the app can't know the parent folder |
| Make my font file | Runs the font check first; if a letter fails, no file is made and the dialog shows "small a has a problem the font file can't hold. [Fix it]". Otherwise builds the OTF with family "<name> Test <n>" and file "<NameNoSpaces>-Test<n>.otf", one click, no format choice. **Letters with no shapes are left out** (except space), and a space a quarter of the letter box wide is added to the file if the font has none; the work file itself is not changed, so no Undo step is made (B1 exporter options) |
| Test number n | Kept in app storage (`kv`), keyed by font name, outside the font: it only counts up and is never undone or restored from a backup. n = 1 + the larger of the stored number and the highest "Test<N>" file already in the folder |
| Uninstall line in step 2 | Shown when an earlier test number exists, with that exact name. "How" opens the Settings steps (8, step 9) |
| Why "Test 3"? | "Windows hangs on to old copies of a font. A new number each time means Word always shows your latest letters." |
| Remove old test fonts: how | "Windows Settings > Personalization > Fonts, search Brennan Hand Test, click one, then Uninstall." |
| Make the final font (outlined) | Family "Brennan Hand", file "BrennanHand-Regular.otf". Overwrites an older final file ANY-INK made without asking (it wrote it); a file ANY-INK didn't write gets the existing Replace / Keep both / Cancel dialog (D-027). Extra line: "If an older Brennan Hand is installed, uninstall it first." |
| Errors | "Couldn't write to "My Fonts". Chrome may need your OK. [Try again] [Pick a different folder]" |

Family names are kept to 31 characters or fewer; a long font name is shortened before " Test n".
TTF, WOFF, WOFF2 and SVG fonts are More tools only.

### 4.8 Font details, and moving the guide lines

```
+------------------------------------------------------------+
|  Font details                                       [x]    |
|  Font name   [ Brennan Hand______________ ]                |
|  Your name   [ Brennan Meyer_____________ ]                |
|  Copyright   [ Copyright 2026 Brennan Meyer ]              |
|  Numbers & symbols   (o) off                               |
|  Accented letters and more are in More tools.              |
|  [ Move the guide lines... ]                               |
|  [ Done ]  (green)                                         |
+------------------------------------------------------------+
```

Font name writes both the project name and the font family. Copyright fills itself from Your name and
the year until he edits it. "Numbers & symbols" is the same control as the board's button. Each field
change is one settings Undo step when the field loses focus; settings Undo steps now also cover
`settings.anyink` and the project name (7.3).

**Move the guide lines...** closes the dialog, opens the current letter (or n if he's on the board),
and shows a purple banner: "Guide lines unlocked. Drag a line to move it for every letter. Letters keep
their size, and they'll be checked again. Undo puts it back. [Done]". The top, capitals, small-letter
and tail lines become draggable, with readouts. The writing line stays locked in Simple mode, because
moving it shifts every letter (D-009). Releasing a line makes **one** whole-project Undo step that also
refits every automatic letter (their gaps depend on the small-letter line), then the checks rerun, and
a toast reports any letters that now need a look ("3 letters now look small for their line. [Show
me]").

### 4.9 Menu

| Group | Item | Action |
|---|---|---|
| File | Save (Ctrl+S) | Save, or the save dialog the first time |
| | Save as... | Save as |
| | Open a saved font... (Ctrl+O) | File picker. If the work has changes not in the file: "Your work has changes that aren't saved. [Save] [Cancel]". After Save finishes, the box reads "Saved. [Open a font...]", a new click, so Chrome's one-dialog-per-click rule is never broken |
| | Start a new font... | Start screen; same check as above |
| | Make my font file... (Ctrl+E) | Use in Word (4.7) |
| Font | Font details... | 4.8 |
| | Move the guide lines... | 4.8 |
| View | Dark paper (switch) | Canvas theme |
| | More tools | All tools mode on |
| Help | How to make a font | Help page (4.10) |
| | How to photograph your letters | The How card (4.4) |
| | What these words mean | Help > glossary |
| | Use your font in Word | Help > the section 8 steps |
| | Keyboard keys | Help > keys |
| | Show tips again | Resets `tipsSeen` |
| | Install ANY-INK as an app | Only if not installed |
| | About ANY-INK | About (credits: Glyphr Studio, Potrace, esm-potrace-wasm, libraries) |

### 4.10 Help page (Simple)

One page, five sections, each entry tagged with its feature (principle 8):
1. **How a font gets made:** the three steps in three short paragraphs, and the How card text.
2. **What these words mean:** the 2.1 glossary, generated from `words.js`, filtered to landed features.
3. **Get your font into Windows and Word:** the section 8 steps.
4. **Keyboard keys:** Undo Ctrl+Z, Redo Ctrl+Y, Save Ctrl+S, Open Ctrl+O, Make font file Ctrl+E,
   Copy / Paste Ctrl+C / Ctrl+V; tools B Brush, V Select, E Edit points, P Point pen, R Rectangle,
   O Oval (the same in both modes, 7.6); on the board, type a letter to open it; Delete (removes the
   picked shape), Space-drag (move the view), Esc (close).
5. **More:** "Look at an example font" (opens the Simple sample in a new window), "Show tips again",
   "Full manual (Glyphr Studio's help site, uses pro words)" (the D-003 link), "About and credits".

### 4.11 Save status, banners and the More tools band

| Status pill | When | Leave-site warning? |
|---|---|---|
| "Saved" (green dot) | The work file holds the latest change | No |
| "Saving..." | A file write is queued or running (normally a few seconds; not a guarantee, D-030) | Yes |
| "Not saved yet [Save]" (amber dot) | No work file has been picked | Yes, once there's any ink |
| "Couldn't save [Fix]" (red dot) | The last file write failed | Yes. Fix opens: "Couldn't save to Brennan Hand.gs2. A backup copy is kept. [Try again] [Save somewhere else]" |

Backup copies are silent; they appear only on the start screen after a crash. When browser storage is
unavailable, a banner shows: "Backups don't work in this window. Press Save before closing."

**More tools band** (purple, under the top bar, whenever All tools mode is on): "More tools: every
Glyphr Studio tool is showing, with Glyphr Studio's own words. [Back to simple]".

---

## 5. How every feature maps into the design

### 5.1 Existing features

| Feature (where it is today) | Simple mode | More tools |
|---|---|---|
| Open Project page: New / Load / Recover / Examples tabs (`open_project.js`) | Start screen (4.1); Load, the backups list and Examples behind "Other ways to start..." | Original tabs |
| Overview page (`overview.js`) | Letter board (4.2) | Original Overview |
| Characters page | Letter view (4.3) | Original page |
| Ligatures, Components pages | Hidden | As today |
| Kerning page + pair view (M5, `src/anyink/kerning`) | Gap handle in Try it; one-pair rules only | Kerning page; its pairs include the Simple ones |
| Live preview page | Try it (4.6) | As today |
| Global actions | Hidden; "Move all letters closer or further apart" lives in Try it | As today |
| Settings page | Font details (4.8) | Full Settings |
| Help / About | Help page (4.10) / About | Same |
| Attributes panel: glyph card numbers, auto-fit, 16 action icons | Letter card: Fine-tune > Spacing and Shape options; Undo/Redo in the top bar | As today |
| Layers panel | Fine-tune > Shapes | As today |
| Trace panel (M7) | Fine-tune > Photo, the photo card and the photo dialog | As today |
| Auto-trace card (M8) | Photo card step C; Adjust holds its controls (one Smooth / Detailed slider) | Card as built |
| Context characters panel | "Neighbors" switch in Fine-tune (view-only) | As today |
| Transforms panel | Hidden | As today |
| History panel | Undo/Redo buttons + named toasts | As today |
| Guides panel, custom guides | Lines locked; Move the guide lines (4.8) | As today |
| Character info panel | Hidden | As today |
| Quality checks panel | Needs-a-look checks (B11) | As today |
| Metric-line drags (M5) | Locked; unlocked by Move the guide lines | Always draggable |
| Side-space drags (M5) | Edge drags inside Fine-tune | Same |
| Preview strip (M5) | Strip, simplified (4.0) + Try it | All toggles |
| Paper / slate theme (M4) | "Dark paper" switch | Same |
| Files: Save, Save as, autosave, recents (M6, D-030) | Save at Create, status pill, Continue card | File menu |
| Crash recovery (M6, D-026) | The Continue card's crash version | Recover tab |
| Export OTF/TTF/WOFF/WOFF2/SVG + export folder (M6, D-027) | Use in Word: OTF only, numbered test builds, letters with no shapes left out | File menu, all formats, unchanged |
| Font / SVG import | Hidden (dropping an .svg on a letter still brings its shapes in) | Load tab |
| Two projects and cross-project actions (D-021) | Hidden | Projects menu |
| PWA install / update / offline (M14) | Install offer once as a toast, update notice, offline toast once | Same |

### 5.2 Upcoming milestones

Each one appears only when it works (principle 8), plugs into one of three slots (a tool, the letter
card, or Try it), and keeps the house words.

**M9 Handwriting sheet: the front door, inside step 1.**
- Board toolbar gains a first button, "Handwriting sheet...". On a new font, rule 11 becomes "Fastest
  way: print a handwriting sheet, write on it, take a photo. [Print my sheet]".
- *Print* (dialog): letter sets as chips (Quick font already ticked; "+ Numbers & symbols"); "Write 3
  versions of a, e, o, t, s for a natural look" switch (fills Versions once M11 exists; before M11, only
  the first copy is used and the switch is hidden); [Print my sheet] opens the browser's print dialog
  for a US Letter (8.5 x 11 in) page.
- The **sheet coaches him on the paper itself:** "Use a black felt-tip pen", "Sit letters on the dark
  line", "Small letters reach the dashed line", "Keep tails above the bottom line", "Take the photo in
  even light, straight on, with all four corner squares showing". The helplines are labeled with the
  same five line names.
- *Photo:* drop the sheet photo anywhere on the board. "Reading your sheet..." shows four corner dots
  turning green as they're found. A missing corner is circled: "Corner 3 not found. Retake the photo
  with the whole page showing." Fewer than two found: drag the four corners by hand (D-017).
- *Check:* the board switches to "Check sheet letters", flagged ones first. Each tile shows scan |
  result with [Keep] [Trace again] [Draw it myself]; Trace again opens the photo card at step C.
  [Keep all good ones] ends it. One scale for the whole sheet, never the first letter's (D-017), the
  same rule as one size per photo (4.4). Every letter is seated on the writing line and spaced
  automatically (B3). Then: "Your font works. Type something!" [Try it].
- No second numbered rail. The dialog title carries "Letters > Handwriting sheet".

**M10 Nib brush: extends the B8 Brush tool.**
- The Brush section gains nib pictures [Round] [Flat (calligraphy)] [Pointed], "Angle" as a dial, and
  "Pen pressure" (switched on automatically when a pen tablet is detected).
- Strokes stay editable: "Edit strokes" lets him drag a stroke's center line, and changing the nib
  re-inks **brush strokes only**. Each stroke is its own shape tagged with its stroke id (B8), so traced
  shapes are never touched. In Try it, "Change the brush for every letter" re-inks every brush stroke in
  the font (one Undo step).
- "Turn into shapes" (flatten) lives in Brush > Brush options; it is the only place strokes merge.

**M11 Alternates = "Versions".**
- Letter card Versions tabs: [1] [2] [3] [+ Add a version]. A new version starts as a copy of version 1
  so he can trace or redraw over it. Board tiles get an "x3" badge.
- Try it: a "Versions take turns" switch (on by default), and "aaa eee ooo" shows the cycling.
- Use in Word card: a highlighted step 5 ("Use Contextual Alternates") appears only when a letter has
  versions.
- Versions share their letter's spacing and gap fixes unless changed (D-013).

**M12 Weight = "Boldness".**
- Letter card Style: [Thinner] [Thicker], each about 3% of stroke weight, one Undo step, in place.
- Try it gains a **Looks** drawer (closed by default) with "Boldness: thinner --o-- bolder", a live
  before / after split of the type, and [Make a bold copy of my font]. That saves a new font, "Brennan
  Hand Bold", through the save dialog and never touches the original (brief section 5.4).
- Letters reshaped by the fallback method get a soft note "Reshaped by Boldness: check it" with
  [Looks fine to me].

**M13 Roughen = "Ink texture".**
- Looks drawer: "Rough edges none --o-- a lot", "Ink bleed none --o-- a lot", [Shuffle], with the
  live before / after.
- [Apply to whole font], [Apply to this letter] (from a letter), [Remove ink texture]. The originals are
  always kept, so Remove always works.

**M16 End-to-end check** becomes section 9 run on the full flow: sheet to installed font with versions,
gap fixes and a Bold copy.

---

## 6. Simple vs All tools

### 6.1 The switch

- **Where:** "More tools" in the top bar, Menu > View > More tools, and "Open in More tools" inside
  Fine-tune. **Back:** "[Back to simple]" on the purple band, always visible while it's on.
- **Default, until B16:** the app opens in **All tools** (today's screens), exactly as the live app
  does now. Simple mode is reachable only by adding `?ui=simple` to the address (on the live site or
  `npm run dev`); nothing on screen points there. So every B can be deployed without changing what
  Brennan sees on launch, and he never meets a half-built Simple mode.
- **Default, from B16:** ANY-INK **always opens in Simple mode.** All tools lasts until he turns it off
  or closes the app. A forgotten switch must never greet him with the pro workspace the next day.
- **Stored** in `src/anyink/mode/mode.js` (`getMode()` / `setMode()`), mirrored to `html[data-ui-mode]`
  the way `theme.js` mirrors the canvas theme. Changing mode calls `navigate()`. The launch default is
  one constant, flipped in B16.
- **More tools shows the original Glyphr Studio screens** with their own words (2.2), and the purple
  band.

### 6.2 What Simple mode hides

| Area | Hidden in Simple | Kept in Simple |
|---|---|---|
| Pages | Ligatures, Components, Kerning, Live preview, Global actions, Settings, the dead "Import & export" entry | Overview (as the board), Characters (as the letter view), Help, About |
| Page chooser | Not shown at all | Rail + "<- All letters" |
| Panels | Panel chooser and all 9 panels | Letter card (uses the `Attributes` and `Trace` ids internally) |
| Attribute icons (16) | Copy, paste, clear clipboard, add path, add component, get paths, get paths from another project, round, unite (as an icon), delete glyph, export SVG, import SVG | Undo/Redo (top bar); Merge, Flip x2, Clear letter (Fine-tune > Shape options); Ctrl+C / Ctrl+V |
| Number fields | All: width, spaces, bulk-edit x/y/w/h, shape x/y/w/h, point x/y, curve handle x/y, locks | Drag readouts |
| Tools | Add a point; Pan button; Actual size; live-preview pop-out | Brush and Select always; Edit points, Point pen, Rectangle, Oval inside Fine-tune; zoom, Fit letter; Dark paper and Outline only switches inside Fine-tune |
| Keys | Ctrl+Space (hides the whole UI), Ctrl+G (SVG font export), arrow-nudge of the horizontal guide lines | Ctrl+Z/Y/S/O/C/V; Ctrl+E opens Use in Word; tool keys (7.6); Delete with a selection; Space-drag; Esc; typing a letter on the board |
| Menus | Projects menu; TTF, WOFF, WOFF2, SVG font export; Choose export folder (moved into Use in Word) | Menu (4.9) |
| Settings | Everything except font name, your name, copyright and Numbers & symbols | Font details |
| Start page | Tabs, import, Examples, backups list (behind "Other ways to start...") | Start screen |
| Strip | Real font, Metrics, Presets name, font-check chip | Text, Samples, size, Big preview |
| Photo | "Top left... font units" readout; "Only inside the glyph box"; Replace / Add pair; "Draw glyph as outline" (the Outline only switch does it) | Photo fade, Hide, Trace again, Photo options; Use it |
| Shapes / points | Point type "smooth (even)"; boolean ops other than Merge; layer order arrows | Solid / Hole, Smooth / Corner |
| Words | Every banned word (2.3) | House words |

### 6.3 How hidden pages stay reachable

- **Filter only where screens are drawn**, never in data or navigation: `makePageChooserContent`,
  `makePanelChooserContent`, `getActionData`, `makeEditToolsButtons` plus a gate inside `selectTool` /
  `switchToolTo`, `makeFileMenuData`, the settings rows, and the hotkeys in `events_keyboard.js`. The
  `tableOfContents` getter, `panelForPage()` and `navigate()` stay unfiltered, because `makePageContent`
  throws on a missing entry.
- **Landing on a hidden page** in Simple mode (undo of a More tools change via `history.js`
  `applyItemState`, a link row in a card, a cross-project import) is never blocked. The page renders,
  More tools turns on for that visit, and the band reads: "Undo took you to one of the More tools
  pages. [Back to my letters]". The check lives in `makeAppTopBar`, which runs on every
  navigate.
- **Simple's own changes never land elsewhere.** Gap fixes, letter spacing and guide lines record
  whole-project or settings steps, which don't navigate on undo. Letter edits record on the Characters
  page, which is visible. Undo from the board stays on the board (7.3).
- **Board tile clicks** are handled by the board itself (letters only). **Strip double-click** on a
  joined letter or reusable part (possible only after More tools use) shows the tooltip "Open More tools
  to edit this".
- **Tests:** the vitest setup pins mode `'all'`, so the existing suite (recounted at B0; the 10/13
  review counted 119 files and 1,897 tests) keeps seeing upstream behavior, apart from the tests a B
  rewrites on purpose and lists (for example B4's label tests). New Simple tests opt in with
  `setModeForTests('simple')`.

---

## 7. Error-proofing

### 7.1 Dead ends removed (walkthrough confusion points)

| # | Walkthrough dead end | Fix | Milestone |
|---|---|---|---|
| 1 | A traced letter gets width 0; "eee" piles up | Use it places, rounds and spaces in the same Undo step; the preview shows the true width; the font check names any letter with ink and no width | B1, B3, B9, B11 |
| 2 | "1 shape lies outside the glyph box", Replace greyed out | The part picked in the photo dialog replaces the glyph-box rule; Use it is never greyed | B9 |
| 3 | An empty letter shows no guide lines | Lines span the canvas (all modes), labeled; guide letter | B1, B7 |
| 4 | Dragging does nothing with Select or Edit points; Pen makes stray lines | Brush first and default; Pen renamed "Point pen" ("click to place points") and kept inside Fine-tune; a sentence on a dead drag | B7, B8 |
| 5 | Holes need "winding" | In Simple only, a Rectangle, Oval or Point pen shape is made a hole or solid by what shows under it: drawn on ink it is a hole, on paper solid. Where shapes nest neatly that is the depth rule (odd depth = hole, even = solid): a shape inside an o is a hole, a dot inside that hole is solid again, and a bullseye alternates. Where shapes overlap (D-036 fix, D-037): holes that overlap become one hole (an island they ring stays ink); a hole drawn where solid shapes overlap merges those shapes first when that changes nothing that shows elsewhere, else it stays solid with a toast that says so; shapes drawn first inside a new shape get their role again in the same step. Toast "Made shape 2 a hole [Make it solid]"; Solid / Hole switch. Brush strokes are always ink | B7 |
| 6 | File / Presets menu text black on dark | Token fix | B1 |
| 7 | "Real font" quietly shows a system font | The preview uses true widths; the font check runs on the whole font and names the letter | B1 |
| 8 | Photo feature hidden behind "PANEL Attributes" | Use a photo on every empty letter; drop anywhere; rule 11 and the How card on a new font | B7, B9 |
| 9 | Export jargon, no next step | Use in Word dialog with numbered steps | B14 |
| 10 | Save status reads like an error | File chosen at Create; four plain states | B6, B13 |
| 11 | Help is a dead end | Next line, tips in the Next line, glossary Help | B6, B15 |
| 12 | Coming back looks like starting over; "Leave site?" when saved | Continue card; leave warning only when the file is behind | B1, B13 |
| 13 | Overview jargon | Letter board | B10 |
| 14 | Trace and Live preview jargon | House words; photo card; Try it | B4, B9, B12 |
| 15 | Wall of numbers and icons | Numbers hidden; a ready letter shows two buttons; the rest in Fine-tune | B5, B7 |
| + | Panel chooser can't open Context characters, Character info, Quality checks | The chooser stores ids and `makePanel` compares ids | B1 |
| + | Three pop-ups on first launch, offline notice twice, Install every launch | One notice at a time; offline once ever; Not now remembered; install offered after the first ready letter | B1, B13 |

### 7.2 Results that can't come out broken

- **Whole numbers:** ANY-INK code (placement, spacing, brush, edge drags) writes whole-unit point
  positions and widths. `FontPreviewBuilder` uses each existing letter's own width, rounded the way the
  exporter's `sanitizeInt` does, **even when it is 0**; only a letter that doesn't exist falls back to
  the default width (`font_preview.js:521, 532, 547, 592`). The upstream data model is **not** rounded
  on every edit; that would change upstream paths and tests.
- **Font check:** `src/anyink/fontcheck/` runs over the exporter's own list of letters (one shared
  function, so the check and the export can never disagree) and names the failing letter: a width or
  point that isn't a whole number in range after rounding, a shape with fewer than 3 points, or ink
  with a width of 0. It runs in both modes, 2 s after the last change.
- **Spacing owner flag:** `glyph.anyink.spacing = 'auto' | 'manual'`. When absent it means "manual", so
  old and imported fonts are never re-spaced behind his back (D-002 style default). Letters first given
  a drawn shape (a Point pen click, before it has ink) or ink in Simple mode start as "auto" (D-037).
  [Back to automatic] sets "auto".
- **Who sets "manual":** an edge drag sets it inside `guides_layer.js` `finishDrag`, and an arrow-key
  side nudge inside `onKeyDown`, **before** their `addState` call, so the refit hook sees "manual" and
  leaves the drag alone. In More tools, any Undo step that changes a letter's left space or width
  (Attributes fields, side-bearing drags, moving shapes, Transforms, Global actions, auto-fit) flips that
  letter to "manual" in the same hook.
- **Refit on release only, in Simple only:** a hook at the top of `History.addState` (the same choke
  point as `markDirty`, D-018) refits an "auto" letter **before** the step is captured, so the refit and
  the edit are one Undo step, never one per drag tick. In More tools the hook never refits; it only
  flips the flag as above.
- **The photo moves with the letter:** whenever spacing moves the shapes sideways (a fit, a refit, a
  left-edge drag, the letter-spacing slider), `item.anyink.trace.x` moves by the same amount in the same
  Undo step, so the faint photo stays under the ink and Trace again traces the right spot.
- **Checks** (B11) run per letter on release and are cached.
- **Space** is added at export (a quarter of the letter box) when the font has none; the work file is
  not changed.

### 7.3 Undo

- Undo and Redo are always on screen; Ctrl+Z / Ctrl+Y work on every page.
- **One press undoes the newest change, wherever it was.** In a letter view, if that change was on
  another letter, the view moves to that letter and undoes it in the same press. On the board, the board
  stays and the toast offers [Show me]: "Undid: traced r [Show me]". There is no "navigated without
  undoing" press in Simple.
- **Looking around is never an Undo step.** In Simple, opening an empty letter creates its record with
  no Undo step (the exporter leaves out letters with no shapes, 4.7), and creation-only steps are
  skipped by Undo and never toasted. Undo steps name the letter they changed.
- Destructive actions use an Undo toast, not a confirm: Clear letter, delete a shape, remove photo,
  remove a gap fix, remove ink texture, - Numbers & symbols (which only hides).
- **Size limit:** the Undo list keeps the newest 200 steps and at most 30 font-wide (whole-project)
  steps; older steps drop off the old end. Looking around never counts toward 200 or 30 (All tools'
  "Navigated to" entries and the empty-letter records it makes when a letter is opened), so browsing
  never pushes a real change out of Undo; past 30 "Navigated to" entries, only the ones that merely pass
  the view along are thinned out (D-033). B10 and B12 measure the backup write time on a 58-letter
  traced font with the list at its fullest against D-026's 100 ms point.

| Action | Undo step |
|---|---|
| Open a letter, the board, Try it, any dialog; pick or cancel a photo | None |
| Use it (photo) | Item step "traced r"; whole-project when earlier letters from the photo were resized |
| Brush stroke | Item step "drew a stroke on B" |
| Shape edits, Solid / Hole, Merge, Flip, Clear letter, delete a shape | Item step |
| Edge drag or arrow nudge; Back to automatic | Item step |
| A fix button (Sit on the line, Match size, Remove specks, Shrink to fit, Fix it); Looks fine to me | Item step |
| Gap fix drag or removal | Whole-project step |
| Letter spacing slider release | Whole-project step |
| Move a guide line; Move the line to fit your writing | Whole-project step (lines + refit of automatic letters) |
| Font name, your name, copyright, Numbers & symbols | Settings step (settings steps now cover `settings.anyink` and the project name, not only `settings.font` and guides) |
| Make my font file; the test number; the space letter | None (the number lives in app storage; the space is added in the file only) |

### 7.4 Confirmations (the only five)

1. Throw away a backup copy that has no work file (start screen): "Throw away this unsaved work? This
   can't be undone."
2. Replace a file ANY-INK didn't write (existing Replace / Keep both / Cancel dialog, D-027).
3. Forget all backup copies (More tools > Settings).
4. Open or start another font while the work has changes not in its file: "[Save] [Cancel]".
5. Create my font onto an existing work file with letters in it: "That replaces your font "Brennan
   Hand" (12 letters). [Use a new name] [Replace it]" (a backup copy of the old file is kept either way).

### 7.5 Recovery and leaving

- Backup copies run as built (D-026, D-030). The start-screen crash card appears only when one is newer
  than its file, or has no file.
- The browser's "Leave site?" warning is driven by the save status (`getSaveStatus`), not by the
  `stopPageNavigation` setting: it shows only when the status isn't "Saved" and the font has ink. The dev
  override stays.

### 7.6 Keys and accidents

- **One tool-key map in both modes** (`src/anyink/mode/keys.js`): B Brush (N too), V Select (A too),
  E Edit points, P Point pen (H and W too), R Rectangle (M too), O Oval (Q too), U Add a point (More
  tools only). Upstream letters stay wherever they don't collide. What changes from upstream: B and P no
  longer pick Edit points, and E no longer picks Add a point. Help lists them all.
- In Simple, the key of a tool inside Fine-tune opens Fine-tune and picks it, and every key that
  switches tools shows a toast: "Switched to Rectangle (R)". While the strip's text field has focus, tool
  keys don't fire, and the field shows a green outline and "Typing in Try it".
- **On the board**, typing a letter opens that tile (Shift for capitals); arrows move, Enter opens.
- **Ctrl+E** opens Use in Word in Simple (no direct export under the real name). **Ctrl+G** (SVG font
  export) and **Ctrl+Space** (hide the whole UI) are off in Simple.
- **Ctrl+O** opens a saved font (file picker) in both modes, matching DESIGN_DOC section 6, instead of a
  new window.
- **Guide lines are locked in Simple mode**, only the horizontal kinds `'metric'` and `'baseline'`, at
  the two gates: `handleGuidesLayerEvent` (`guides_layer.js:54`) for drags and `onKeyDown`
  (`guides_layer.js:273`) for arrow nudges. The side-space edges on the same layer stay draggable. Move
  the guide lines unlocks the horizontal lines; the writing line stays locked.
- **The photo is locked** after Use it in Simple, so a Select drag never moves it (Photo options >
  Lock the photo turns it off).
- **Delete** acts only on a picked shape or point.
- **Dialogs** block editor keys in the capture phase (as `pwa/register.js:110-117` does).

### 7.7 Plain error messages

| Situation | Message | Buttons |
|---|---|---|
| Any picker cancelled | (nothing), except the export folder (below) | |
| No export folder picked | "No folder picked. Make a new folder inside Documents (Chrome won't let you pick Documents itself) and choose it." | [Pick a folder...] |
| File permission refused on Continue | "Chrome needs your OK to open this file. Press Continue again and choose Allow." | [Continue] |
| Save failed | "Couldn't save to Brennan Hand.gs2. A backup copy is kept." | [Try again] [Save somewhere else] |
| File changed by another window or app | "Brennan Hand.gs2 was changed somewhere else. Save your work as a new file so nothing is lost." | [Save as a new file] |
| HEIC photo | "That's an iPhone HEIC photo, which Chrome can't open. Send it as a JPEG instead: on the iPhone, Settings > Camera > Formats > Most Compatible." | [Choose another photo] |
| Other unsupported file | "ANY-INK takes photos (PNG, JPEG, WebP) and ANY-INK work files (.gs2)." | |
| No ink in the picked part | "No ink found in that part. Drag Ink cutoff toward more ink, or draw the box again." | [Draw a box] |
| No letter in the picked part (only specks or ruled-line bits) | "No letter found in that part. Draw the box again around the letter." | [Draw a box] |
| Font file can't be built | "small a has a problem the font file can't hold." | [Fix it] (rounds and refits that letter, one Undo step) |
| Export folder not writable | "Couldn't write to "My Fonts". Chrome may need your OK." | [Try again] [Pick a different folder] |
| Backups unavailable | "Backups don't work in this window. Press Save before closing." | [Save] |
| Backup write failed | "Couldn't save a backup copy. Press Save to keep your work." | [Save] |
| Navigation failed (upstream error page) | "Something went wrong showing this screen. Your work is safe." | [Back to my letters] |

---

## 8. Getting the font into Windows and Word

This is the text behind the Use in Word card (4.7) and in Help, in plain words. Word's and Windows'
own labels are quoted exactly and marked `.anyink-quote` (2.3).

1. **Make it.** In ANY-INK press **3 Use in Word**, then **Make my font file**. The first time, pick a
   folder: make a new folder called **My Fonts** inside Documents (Chrome won't let you pick Documents
   itself), select it, and choose **Allow**. ANY-INK writes "BrennanHand-Test1.otf" there.
2. **Find it.** Open File Explorer, then Documents > My Fonts.
3. **Install it.** Double-click **BrennanHand-Test1.otf**. A preview window opens; press **Install** at the
   top. (Or right-click the file and choose **Install**; on Windows 11 it may be under **Show more
   options**.) If an earlier test (for example "Brennan Hand Test 1" when installing Test 2) is
   installed, you can uninstall it first so Word's list stays short (step 9).
4. **Restart Word.** Close Word completely and open it again. Fonts installed while Word is open don't
   show up.
5. **Use it.** In Word's font box, type **Brennan Hand Test 1** and pick it. Type your name.
6. **Gap fixes** (only if you fixed the gap between two letters; the card highlights this step): in Word
   press **Ctrl+D**, open the **Advanced** tab, and tick **Kerning for fonts**. Press **Set As Default**
   to keep it for new documents.
7. **Versions** (after M11, only if a letter has versions; highlighted too): on that same Advanced tab,
   tick **Use Contextual Alternates**.
8. **Next time:** each new font file gets a new number (Test 2, Test 3...). Windows hangs on to old copies,
   and a new name means Word always shows your latest letters. When you're happy, press **Make the final
   font**; it is named plain "Brennan Hand".
9. **Clean up old tests:** Windows **Settings > Personalization > Fonts**, search "Brennan Hand Test",
   click one, then **Uninstall**. Do this before installing the final font if an older "Brennan Hand" is
   installed.

ANY-INK can't install fonts itself (no web app can), so the card says so in plain words.

**Fact-check before B14 ships** (FACTCHECK_LOG entries with sources, owner B14; the card's wording
follows the answers):
- Double-click a font file, then Install; right-click Install; the Windows 11 "Show more options"
  placement. Source: https://support.microsoft.com/en-us/office/add-a-font-b7c5f17c-4426-4b53-967f-455339c564c1.
- Word must be restarted to see a newly installed font.
- Word Ctrl+D > Advanced > "Kerning for fonts" (off by default) and "Use Contextual Alternates"; "Set As
  Default". Source: https://support.microsoft.com/en-US/Word/font-advanced-settings (already pending for
  M11).
- Settings > Personalization > Fonts > Uninstall.
- Windows keeping an old copy of a same-named font (the reason for numbered builds). Source: the FontLab
  cache thread cited in the prior-art research; confirm on Brennan's PC during B16.
- **What Word shows for a letter the font doesn't have** (a box, or the letter in another font). The
  card only promises "they won't be in your handwriting" until this is checked.
- **Whether Word cuts off ink that reaches past the top line or the tail line**, or adds space between
  lines instead. If it cuts it off, the exporter sets the font's clipping lines from the real highest and
  lowest ink (B14), and the "pokes past" check becomes a soft note.
- **Overlapping shapes in an OTF draw as solid ink in Word** (brush strokes stay separate shapes, B8).
  If not, Use in Word merges each letter's brush strokes in a copy at export.
- Chrome's folder picker refuses Documents, Desktop and Downloads themselves.
- iPhone Settings > Camera > Formats > Most Compatible (HEIC message).

---

## 9. Acceptance test

### 9.1 Setup

- Windows 11, Chrome, a **fresh profile**, the deployed build (or `vite preview` of the release build),
  in Simple mode (`?ui=simple` before B16 flips the default).
- Paper with **B r e n a H d** written as the How card asks: black felt-tip, about 1 in tall, a finger's
  width apart, in one row. A phone photo of it (JPEG) already on the PC in Downloads.
- **Testers, in order:** the automated run (9.4); then an agent role-playing a first-timer who may read
  only what the screen shows; then Brennan, at Gate 2.
- **The agent first-timer passes** when, on every screen of the script, it names the button to press
  from the screen alone and is right, needs no hint, and never reports a word it doesn't understand.
- **Observer rules (Brennan's run):** read each task card aloud, then say nothing. No hints. If he asks
  for help, note it and give the smallest possible hint. Note every pause over 10 s, every wrong click,
  and every "what does this mean?". Time each task.

### 9.2 Script

| # | Task card (read aloud) | Pass when | Time limit |
|---|---|---|---|
| T1 | "Make a new font called Brennan Hand." | The board is showing; Documents\Brennan Hand.gs2 exists; status "Saved" | 1:00 |
| T2 | "Make the capital B from your photo." | B is "Ready"; its body bottom is within 2% of the letter box (41 units at the defaults) of the writing line; width > 0; one Undo brings back the empty B (no shapes, photo kept) | 3:00 |
| T3 | "Make the rest of the letters in your photo." | r, e, n, a, H, d all Ready; no Needs-a-look left, or each fixed or marked "Looks fine to me"; stroke weight of all seven within 15% of their median | 4:00 |
| T4 | "Draw a small o yourself." | o has ink and a width; it was drawn with the Brush, not traced | 3:00 |
| T5 | "Type Brennan Hand and check that it looks right." | Try it shows "Brennan Hand"; no overlap (principle 5) | 1:30 |
| T6 | "One gap looks too wide. Make it closer." | A gap fix exists for that pair; nothing else changed | 1:30 |
| T7 | "Undo that, then put it back." | The gap fix is gone, then back, using on-screen buttons or keys | 0:30 |
| T8 | "Get your font into Word and type your name." | A .otf in his chosen folder; installed; Word lists "Brennan Hand Test 1"; "Brennan Hand" types in his letters with no overlap | 5:00 |
| T9 | "Close ANY-INK. Open it again and get back to your font." | On the board with his letters, after Continue (+ Chrome's Allow) | 0:30 |
| T10 | (observer) Two crash cases, below | As below | 1:00 each |

The limits for T1 to T9 add up to 20:00.

**T10, spelled out.**
- *a. No work file:* in a new font whose save dialog was cancelled at Create, trace one letter. Wait 10 s
  (backups are written a few seconds after a change; D-030). Open Chrome's Task Manager (Shift+Esc),
  pick the ANY-INK tab, press End process. Ask: "Open ANY-INK again." Pass: the start screen shows the
  crash card, and [Continue with it] brings the letter back.
- *b. With a work file:* in the saved Brennan Hand, change a letter, wait 10 s, end the process the same
  way, reopen. Pass: either the crash card appears and [Continue with them] restores the change, or
  [Continue] opens the file and the change is in it (autosave got there first).

### 9.3 Pass / fail

One rule for time: **every task within its limit and a total of 20:00 or less = pass. A total of 20:01
to 30:00 = a fix pass in B16 and a re-run. Over 30:00 = redesign the slowest screen.** On top of time,
the build passes only if all of these hold:
- T1 to T9 finished with **zero help requests**.
- **3 or fewer wrong turns** in total (a click that leads away from the task and needs Back or Undo).
- **No dead end:** at every pause the screen showed one green button, or a Next sentence naming one,
  that moved the task forward (observer ticks per screen; the agent first-timer checks the same). With
  a drawing tool picked on an empty letter, the Next sentence saying where to click or drag counts
  (principle 1's exemption).
- **No jargon:** zero banned words (2.3) seen on the main path (the automated scan, plus the observer).
- **Correct result:** the Word text in T8 has no overlap (principle 5), and the letters sit on one line.
- **Feeling:** Brennan answers "How lost did you feel, 1 (never) to 5 (totally)?" with **2 or lower**, and
  "Would you use this to make the rest of the alphabet?" with yes.

Any failure becomes a fix item in B16 and the failed task is re-run.

### 9.4 Automated checks (run before every Gate 2 attempt)

- `tests/beginner.verify.mjs` (Playwright, headless): runs T1 to T7 and the file part of T8 against the
  built app with `?ui=simple`, with stand-ins for the Windows pickers (as the walkthrough did) and real
  drops of two fixtures:
  - `tests/fixtures/brenna-loose.jpg`: B r e n a H d with gaps wider than a capital's height;
  - `tests/fixtures/brenna-tight.jpg`: the same letters with gaps of about a quarter of the
    small-letter height (about 1/8 in at 1 in letters), plus a dotted i at the end.
  Both must give one part per letter (8 for the tight one, the dotted i as one part) and open the photo
  dialog. Asserts: status "Saved"; each letter Ready; its body bottom within 2% of the letter box of the
  writing line; integer widths; stroke weights within 15% of their median; the photo still lines up
  under the ink after Use it, after an edge drag and after a letter-spacing change; the exported OTF
  loads, every letter in "Brennan Hand" has width > 0, letters with no shapes are absent, and there is no
  overlap (principle 5); exactly one visible green button (`.anyink-primary`, or a green
  `fancy-button`) in every screen state, none with a drawing tool picked on an empty letter before its
  first point (principle 1's exemption); zero banned words in
  visible text, canvas text and toasts; zero number inputs visible; no element with an uppercase text
  transform.
- `src/anyink/words/tests/banned_words.test.js` (jsdom): every Simple screen state, canvas text through
  the `fillText` spy, every toast in the scripted flows, every `words.js` entry not marked `quote`.
- `src/anyink/coach/tests/journey.test.js`: replays section 3 and checks every Next sentence.
- The full vitest suite (existing tests pinned to All tools mode) and `tests/pwa.verify.mjs` (the
  `#input__new-project-name` and `#button__create-new-project` ids still exist).

### 9.5 Record

Results go into `docs/TEST_LOG.md`: date, build hash, per-task time / pass / notes, help requests,
wrong turns, and Brennan's two answers.

---

## 10. Build plan

Each B is one workflow: plan, build in a test page, integrate, verify. Each new code file gets the
two-line header, and every upstream file a B modifies gets it above the GPL notice. New modules live
under `src/anyink/<feature>/` with a test page in `tests/` and unit tests in the module's `tests/`
folder. Nothing is committed without Brennan's go. Days are rough working days.

**Three rules keep the live app safe while this is built:**
- **Simple stays behind a flag until B16.** `mode.js` (B5) opens in All tools by default; `?ui=simple`
  turns Simple on for that load. Redeploying after any B therefore never changes what Brennan sees on
  launch.
- **Feature flags.** `src/anyink/mode/features.js` holds one flag per feature (`coach`, `letterView`,
  `brush`, `photo`, `board`, `checks`, `tryIt`, `startScreen`, `useInWord`, `fontDetails`, `help`). Each
  B turns on only its own flag. Every button, menu row, coach rule, tip and Help entry names its flag
  and is hidden while it's off (principle 8), so no B shows a door to a later B.
- **Stubs are named.** Where a B needs something a later B builds, the B's section names the stand-in it
  uses, and its "Done when" can be checked with only what exists at that point.

| B | Name | Main modules | Days | Unlocks |
|---|---|---|---|---|
| B0 | Housekeeping | (docs, fixtures) | 0.5 | A clean start |
| B1 | Fix what's broken (**done 10/14/2026**) | `fontcheck/`, fixes in existing files | 2.5 | Correct results in both modes |
| B2 | Undo that never surprises (**done 10/14/2026**) | `history/` | 2.5 | One press = one change, anywhere |
| B3 | Spacing and placement engine (**done 10/14/2026**) | `spacing/`, `placement/` | 3.5 | Traced and drawn letters type correctly |
| B4 | House words and one toast voice (**done 10/14/2026**) | `words/`, `toast/` | 2.5 | No jargon on the main path |
| B5 | Mode switch, gates and keys (**done 10/14/2026**) | `mode/` | 3 | Simple mode exists (behind `?ui=simple`) |
| B6 | Top bar, Next line, tips, undo toasts, save status (**done 10/14/2026**) | `topbar/`, `coach/`, `history/undo_toast.js` | 3 | Always a next step |
| B7 | Letter view (**done 10/14/2026**) | `letter/` | 4 | A calm editing screen |
| B8 | Brush (round) (**done 10/15/2026**) | `nib/` | 2.5 | Drag to draw |
| B9 | Photos: How card, photo dialog, photo card (**done 10/15/2026**) | `photo/` | 4 | One photo makes many letters |
| B10 | Letter board (**done 10/15/2026**) | `board/` | 3 | Home with progress |
| B11 | Checks and fixes (**done 10/15/2026**) | `checks/` | 2.5 | Needs a look, with one-click fixes |
| B12 | Try it and gap fixes (**done 10/15/2026**) | `tryit/` | 3 | Test and fix gaps visually |
| B13 | Start screen (**done 10/15/2026**) | `start/` | 2.5 | Create, Continue, crash card |
| B14 | Use in Word | `install/` | 2.5 | The full loop to Word |
| B15 | Font details, guide lines, Help | `fontinfo/`, `help/` | 2 | Settings and help in plain words |
| B16 | Turn Simple on, and Gate 2 | (mode default, docs) | 2.5 | Simple is the default |

About **46 working days** before M9. The first complete photo-to-Word loop in Simple exists after
**B14** (start screen B13, board B10, photos B9, Try it B12, Use in Word B14), reachable with
`?ui=simple`; B15 adds settings and Help, and B16 makes Simple the default. An optional step **W**
(about 4 days, any time after B16) moves the More tools screens to house words with pro hints.

### B0. Housekeeping

- Settle the uncommitted `src/anyink/autotrace/binarize.js` and `tests/binarize.test.js` changes from the
  other session (finish and commit, or revert) before any B touches `autotrace/`.
- Recount the suite (`npx vitest run`) and record files and tests in TEST_LOG; every count in this
  document defers to that number.
- CLAUDE.md: mark M14 (PWA) and M15 (Deploy) done, as the commits show, and list B0 to B16 as the next
  milestones. Append D-031 (section 11) to DECISIONS.md. Point DESIGN_DOC section 2 here.
- Fixtures: `tests/fixtures/brenna-loose.jpg` and `brenna-tight.jpg` (9.4), photographed from real
  felt-tip handwriting, plus a single-letter photo and a dark-ink-on-light-board photo.
- **Done when:** the working tree holds only these changes; the suite is green; the counts are recorded.

### B1. Fix what's broken (no new screens; both modes)

**DONE 10/14/2026** (four tracks, integration, a critic pass and a fix pass; choices in D-032; numbers
in TEST_LOG). Beyond the plan below, the fix pass added an interim [Fix it] on the strip line (a width,
a space with no width, a letter's own stray shapes; one Undo step each, B3 and B11 replace it), one
sentence saying what to do when there is no Fix it, guide lines that hold 3:1 on displays scaled to
125 % and 150 %, and app notices as one line in the top bar (B6 decides their final place).

- **Panel ids.** `navigator.js` `makePanelChooserContent` passes each panel's **id** (the key of
  `listOfPanels()`: `Attributes`, `Layers`, `Trace`, `ContextCharacters`, `Transforms`, `History`,
  `Guides`, `CharacterInfo`, `QualityChecks`) and its label; `makeNavButton_Panel(id, label, icon)`
  stores the id in `nav.panel` and renders the label. `panels.js` `makePanel` compares ids
  (`'ContextCharacters'`, `'CharacterInfo'`, `'QualityChecks'` instead of the display names). Every
  other `nav.panel === '<display name>'` comparison is switched (grep). Tests in
  `navigator_panels.test.js`: every panel offered on every page opens with non-empty content, and
  `panelForPage` keeps the choice.
- **Guide lines on empty letters.** `edit_canvas.js` `drawSystemGuidelines` draws lines
  `max(itemXMax, project.defaultAdvanceWidth)` long, so they show on a letter of width 0, in every mode.
- **Menu contrast.** File and Presets menu rows readable without hover (tokens / menu CSS only).
- **Leave-site warning.** `app.js` `updateWindowUnloadEvent` uses `getSaveStatus()`: warn only when the
  status isn't "Saved" and some letter has shapes. The dev override stays.
- **Notices.** `pwa/register.js`: one notice at a time; "ready offline" once ever (app pref); Install
  "Not now" remembered.
- **The preview tells the truth.** `font_preview.js:521`: an existing letter uses its own width, rounded
  like the exporter's `sanitizeInt`, even when it is 0; only a missing letter falls back to the default
  width. The same rounding at lines 532, 547 and 592.
- **Font check** (new, `src/anyink/fontcheck/`):
  - `export_list.js`: the exporter's list of letters (`shouldExportItem` plus options), moved out of
    `font_export.js` into one shared function that both the export and the check call.
  - `validate.js`: per letter, after the exporter's rounding: width a whole number from 0 to 65,535;
    every point a whole number within plus or minus 32,767; every shape has at least 3 points; width
    above 0 when the letter has ink. Returns `[{ itemId, problem }]`.
  - `font_check.js`: runs `validate` 2 s after the last change and publishes a new `fontCheck` topic
    (`pub_sub.js`).
  - Display in B1: the preview strip shows one line, "small a has a problem the font file can't hold.
    [Show me]" (Show me opens that letter), and the File menu export shows a toast naming the letters.
    The export itself still runs in All tools mode, as today. Letter names come from a first
    `src/anyink/words/letter_name.js`, which B4 builds on.
- **Exporter options.** `font_export.js` accepts `{ omitEmptyLetters, addSpaceIfMissing, familyName,
  fileName }` for one export, without touching settings or history. `omitEmptyLetters` leaves out every
  letter with no shapes except space; `addSpaceIfMissing` adds a space a quarter of the letter box wide
  to the built file only. All default off, so the File menu export is unchanged; B14 turns them on.
- **Upstream files touched:** `navigator.js`, `panels.js`, `edit_canvas.js`, `font_preview.js`,
  `font_export.js`, `app.js`, `pub_sub.js`, the menu CSS / `tokens.css`. **ANY-INK files:**
  `pwa/register.js`, `preview_strip.js`.
- **Stubs:** none. [Fix it] comes with B3's refit and B11; until then the strip offers [Show me] only.
  (Fix pass: an interim [Fix it] (`preview/fix_it.js`) covers widths, the space and stray shapes;
  B3's refit replaces its `fittedWidth`.)
- **Test page:** `tests/fontcheck.html` loads a sample, breaks one letter three ways (a fractional
  width, ink with width 0, a 2-point shape) and shows the strip line and the export toast. The unload
  check reuses `tests/recovery.html`.
- **Unit tests:** the panel probe; preview rounding (654.338 builds as 654; 0 stays 0, so "eee" piles up
  in the preview exactly as in the font); each validator rule names the right letter; the check and the
  export use the same list; `omitEmptyLetters` (open C, which creates it, then export: no C in the font);
  `addSpaceIfMissing` (space advance 512 at the default 2,048 grid; settings and history unchanged); the
  unload rule; notice-once.
- **Done when:** walkthrough items 6 (menu contrast), 7 (silent system-font fallback) and 12 (leave
  warning) and the panel bug are gone; the new tests pass; the full suite, `npm run lint` and
  `npm run build` are clean; the app with no flag looks as before apart from these fixes.

### B2. Undo that never surprises

**DONE 10/14/2026** (one track, the B2 + B3 integration, then a critic pass, a fix pass and a finalize
pass; choices in D-033; numbers in TEST_LOG). It also fixed B1's leftover: in All tools a "Navigated
to" step no longer marks a saved work file pending. The later passes: every press is named by its
own step's title; looking around never counts toward the size limit (past 30 "Navigated to" entries
the ones that only pass the view along leave); Delete letter in Simple undoes in one press; a
font-wide step names no letter, so Undo from another letter stays put; held arrow presses on one
guide line are one step in Simple; All tools never drops a real step whose letter's earlier state
isn't right under it.

- `src/anyink/history/`: `simple_undo.js` (in Simple, one press undoes the newest change wherever it is:
  the view moves to that letter in the same press, or stays on the board and returns a [Show me]
  target), `undo_cap.js` (newest 200 steps, at most 30 whole-project steps, dropped from the old end;
  looking around not counted; "Navigated to" entries thinned past 30), `history_helpers.js` (which
  entries are looking around), `item_state.js` (a letter's state in a font copy).
- `src/anyink/mode/`: the bare `mode.js` (get / set, launch default `'all'`, `?ui=simple`,
  `setModeForTests`) and an empty `features.js`, because this is the first B whose behavior differs in
  Simple. B5 builds the rest of the folder on them.
- **Upstream files touched:** `history.js` (`restoreState` uses `simple_undo` in Simple; creation-only
  steps are skipped; whole-project pre/post steps take the changed letter's id instead of the previous
  top entry's), `project_editor.js` (the `selectedGlyph` getter creates an empty letter with no history
  entries in Simple). **ANY-INK:** `settings_snapshot.js` (settings steps also capture
  `settings.anyink` and the project name).
- **Stubs:** none; `tests/undo.html` drives a bare editor with two letters.
- **Unit tests:** trace B, go to r, trace r, then Undo twice restores both, with one view jump per press
  and no "navigated" press; opening 10 empty letters adds 0 steps; a creation step is never toasted; the
  cap drops the oldest; a letter-set toggle and a name change undo as settings steps; the existing
  history tests stay green under `'all'`.
- **Done when:** these pass in Simple test mode and the full suite is green. Days: 2.5.

### B3. Spacing and placement engine

**DONE 10/14/2026** (spacing, placement and hooks tracks, the B2 + B3 integration, then a critic pass
with a first-timer lens that built fonts from handwriting photos, a fix pass and a finalize pass;
choices in D-034; numbers in TEST_LOG). Beyond the plan below: automatic letters made from the
changed letter are refit in the same Undo step (as parts of it); unknown `settings.anyink` keys are
kept on load (for B9's photo records); [Fix it] fits an automatic letter; a dropped SVG's step is
recorded after its placing; sides come from the letter's body with the slant taken out, marks and
tails hanging no further than 0.1 G inside the letter's width; open sides get 0.4 G; every letter's
body sits on the writing line, rows slope with the photo and a row written at another size gets its
own; the parts rule needs pieces to share their height or be a dot. Placement is a library until
B9: `tests/b23.verify.mjs` stands in for B9's photo flow (placePart into the photo record, the picked
part as the traced area).

- `src/anyink/spacing/`:
  - `letter_classes.js`: the side table below, and width limits per letter type.
  - `measure.js`: ink bounds and a stroke estimate (2 x area / perimeter of the largest piece);
    punctuation is never part of a median.
  - `auto_space.js`: `fitSpacing(item, project)`, `fitAllAutomatic(project)`, and the letter-spacing
    `extra` with its per-side floor (4.6).
  - `owner.js`: the `glyph.anyink.spacing` flag and who sets "manual" (7.2).
  - `round.js`: whole-unit points and widths.
  - `history_hook.js`: the hook at the top of `addState`. Simple: refit "auto" letters. All tools: flip
    a letter to "manual" when the step changed its left space or width. Never refits in All tools.
  - `trace_follow.js`: moves `item.anyink.trace.x` by the same amount whenever spacing moves the shapes.
  - `outline.js`, `sides.js`, `slant.js` (finalize): the ink as outlines; a letter's sides from its
    body with the slant taken out and marks and tails bounded; the font's slant from the stems (and a
    letter's own lean where it differs by more than 2 degrees).
- `src/anyink/placement/`: `classes.js` (vertical class per letter, below), `photo_scale.js` (the photo's
  scale: the median rule, a row written at another size, and the "earlier untouched letters follow"
  rule, 4.4), `seat.js` (each row's writing line, sloped with the photo; every letter's body bottom on
  it; the tail rule and its override), `fit_lines.js` (computes the photo's x/y/scale so the picked part
  lands on its lines).
- **Gap rule:** the straight-side gap G = 8% of the small-letter height (D-017; 88 units at the default
  1,100). Round sides get 0.6 G, open or slanted sides 0.4 G (D-034; the plan said 0.2 G), punctuation
  0.6 G. A side is measured on the letter's body: dots, accents and tails don't set it but may hang
  into its space, up to 0.1 G inside the letter's width (in the font's slant, so no two automatic
  letters ever touch). The letter-spacing
  slider adds `extra` per side, from -G to +G, stored in `settings.anyink.spacing = { extra }`; a side
  never goes below zero space unless it already was.
- **Width limits** (used by B11): letters that are naturally narrow (i j l ! . , ' : ; - |) have no lower
  limit; any other letter is flagged under 25% of its own line height; every letter is flagged over 150%
  of the letter box.
- **Side classes** (left/right; S straight, R round, O open or slanted). Letters not in the table are
  measured: a side whose ink runs within 4% of the box along at least 70% of the small-letter height is
  S, 30 to 70% is R, else O.

  | | Letters |
  |---|---|
  | S/S | H I M N U h i l m n u ! |
  | S/R | B D P b p |
  | S/O | E F K L R k r t f |
  | R/R | O Q S o s . , ? |
  | R/S | a d g q G |
  | R/O | C c e |
  | O/S | J j |
  | O/O | A T V W X Y Z v w x y z ' - |

- **Vertical classes** (target top and bottom, from the five lines). Each letter is in exactly one:
  - Small letters (a c e m n o r s u v w x z): top = small-letter line, bottom = writing line.
  - Tall (b d f h k l): top = top line.
  - t: halfway between the small-letter and top lines.
  - i: dot top at 60% of the way up from the small-letter line to the top line.
  - Tails (g j p q y): body top = small-letter line, tail bottom = 90% of the tail line; j's dot as i's.
  - Capitals: top = capitals line. Q and J are capitals whose tail may hang below the writing line.
  - Punctuation: . and , sized to 12% of the small-letter height, with the comma's tail reaching 40%
    toward the tail line. ' starts at the capitals line, 25% of its height. ? and ! use the capitals
    line. - is centered on half the small-letter height.
  - Round letters (o c e s O C G Q S) get +1.5% of the letter box above and below.
  - The bottom used for seating is always the **body** bottom (4.4): ink below the writing line is
    ignored when finding it, so Q, J and a dropping f keep their tails.
- **`apply.js`** gains options only: `applyAutoTrace(..., { round: true, title })`. Placement never runs
  inside it; in Simple the refit comes from the hook. More tools auto-trace is unchanged.
- **Upstream files touched:** `history.js` (the hook call at the top of `addState`). **ANY-INK:**
  `guides_layer.js` (set "manual" in `finishDrag` and in the `onKeyDown` side nudge, before their
  `addState`), `apply.js` (options).
- **Stubs:** none; pure functions plus the hook, tested with `setModeForTests('simple')`.
- **Test page:** `tests/spacing.html`: draw / trace fixtures, show edges and the class, slide `extra`.
- **Unit tests:** class table; measured fallback; gap math at 1,000 and 2,048 grid sizes; refit inside one
  Undo; an edge drag in Simple doesn't snap back; in All tools an Attributes left-space edit, a moved
  shape, a Transforms move, Global actions side bearings and auto-fit each flip "manual" and never refit;
  whole-number output; placement of a, g, B, Q, f and a period; one scale per photo with B, r, e, n, a,
  H, d from one fixture (stroke weights within 15%); the photo stays aligned after a fit, a left-edge drag
  and a letter-spacing change; the slider moves "manual" letters too and stops at touching.
- **Done when:** these pass and the full suite is green.

### B4. House words and one toast voice

**DONE 10/14/2026** (core, toast and display-points tracks, then the B4 + B5 integration, a critic
pass, three fix tracks (words, toasts, mode) and a finalize pass; choices in D-035; numbers in
TEST_LOG). Beyond the plan below: the integration gave the upstream pages Simple still shows until
their B lands (the Overview, the letter chooser, the letter page's tooltips and letter button,
Help's first tab, the start page's Load and Examples tabs, the Recover card) their Simple words, so
the scan finds 0 hits on every Simple page that exists; Simple's save status never shows a
browser's own error sentence; the empty preview and the update notice's reasons are house words in
both modes. The later passes: the scan is strict by default (2.4 E and G: no "project", block
names or codes) and catches -ed and -ing forms; every error box a file command raises says 7.7's
words with working buttons ([Try again], [Save somewhere else], [Save as a new file], [Open
another work file...], [Pick a folder...]); "Saving..." shows while a write waits (4.11); the
start page has one green button per tab and says font and work file; Help is one tab in house
words and Help and About have [Back to my letters]; letter sets are named in house words; an
Undo that changes a letter away from its page says which; toasts in Simple wait their turn and
a press on the canvas leaves them be, and an offer goes when its font does; photos stay closed in
Simple (not taken, drawn or grabbed) until B9.

- `src/anyink/words/`: `words.js` (keys to `{ text, hint, pro, feature, quote }`), `letter_name.js`
  (started in B1), `history_text.js` (pattern map for existing titles), `banned.js`, and
  `tests/banned_words.test.js` (2.3: DOM, the `fillText` / `strokeText` spy, the toast recorder).
- `src/anyink/toast/`: `toast.js` (one queue, priorities, words keys) and `upstream_map.js` (known
  upstream `showToast` messages mapped to keys; unmapped ones are dropped in Simple and fail the test).
  Upstream `showToast` is routed through it.
- **Main-path call sites** (all mapped in this B): `history.js` ("Restored deleted item", "Navigated
  without undo-ing", "No more undo"), `trace_import.js` ("Added a trace image. Press Start auto-trace
  ..."), `events_keyboard.js` ("Values were rounded for the selected path points"), the recovery module
  ("Crash recovery could not save a snapshot ...", "Open the Recover tab"), `panels/actions.js` ("Uniting
  all glyph shapes", used by Merge), the files module ("Saved project file", which becomes the status pill
  only).
- **Shared display points switched to words** (both modes): canvas guide labels (`edit_canvas.js`
  `drawGuideLabel`), `metrics_math.js` `METRIC_LABELS` and `LIVE_LABELS`, `metrics/overlay.js`, the File
  menu rows (`menu.js` `makeFileMenuData`), `save_status.js` text, `preview_strip.js` labels, and the
  update notice in `pwa/register.js` (4.1).
- **Tests:** the label tests that read changed text switch to ids or keys (each is listed in the B4
  plan, for example `metrics_math` and the files toast tests). `apply.test` keeps its title. About keeps
  the "Peter Selinger" and "Thomas Steiner" credits.
- **Stubs:** the scan runs on what exists (canvas labels, menus, toasts, `words.js`); each later B adds
  its screens to it.
- **Test page:** `tests/words.html` lists every key with its text, hint, pro word and feature.
- **Carried from B1** (strings B1 put on screen that B4 moves into `words.js`): the font check messages
  (`fontcheck/validate.js`, `validate_kerning.js`), "Show me", "Fix it", "N more letters and N gaps
  need fixing too.", the three what-to-do sentences (`preview/font_status.js` hintFor), "Can't show your
  font yet: ...", "the gap between X and Y", the export toast's ", but ... needs fixing.", the notices
  in `pwa/register.js`, the Presets hints ("this letter", "26 letters", "capitals", "small letters") and
  "Open another font first". `history_text.js` maps the new Undo titles ("gave small b a width",
  "fixed the width of small b", "removed 2 stray shapes from small b", "gave the space a width") and
  upstream's "Navigated to Latin Small Letter B" (B1's Show me records it). Still on screen from
  upstream: "advance width" and "bearings" in the Attributes panel, and the install offer's wording.
- **Done when:** zero banned-word hits on what exists; every listed toast maps to a key; the full suite
  is green.

### B5. Mode switch, gates and keys

**DONE 10/14/2026** (core and wiring tracks, then the B4 + B5 integration, the critic, fix and
finalize passes; choices in D-035; numbers in TEST_LOG). Beyond the plan below: Simple hides all 9
panels at `makePanel`; Simple's strip hides Real font and Guide lines and turns off what they turn
on (the prefs are kept for All tools); a page drawn with the band takes the band's height off its
viewport-sized lists. The later passes: Simple keeps the page chooser (its four pages) until B6's
rail; B, Ctrl+R are off in Simple until the Brush; Ctrl+E makes the .otf until Use in Word; Simple's
File menu has Open a saved font... and (until B14) Choose where font files go...; Ctrl+O opens into
the font he is in and asks whenever its work file is behind; in both modes Delete with nothing
picked is no step, an edge stops at width 0 and an empty letter's left edge doesn't move, and a
strip toggle with focus no longer swallows the app's keys (Brennan to confirm these All tools
changes before Gate 2, D-035).

- `src/anyink/mode/` (on top of B2's `mode.js`): `html[data-ui-mode]` and the `navigate()` call on a
  change, `features.js` (the flags), `visibility.js` (shown pages, panels,
  actions, tools, menu rows and settings rows per mode), `keys.js` (the one key map, 7.6), `band.js`
  (the purple band and the hidden-page landing rule).
- **Upstream files touched:** `navigator.js` (page and panel chooser filters), `panels/actions.js`
  `getActionData`, `tools.js` (`makeEditToolsButtons`, a gate in `selectTool` / `switchToolTo`),
  `events_keyboard.js` (the key map in both modes; in Simple: Ctrl+Space off, Ctrl+G off, Ctrl+E to Use
  in Word once that flag is on; Ctrl+O opens a font), `menu.js` (`makeFileMenuData`, Projects menu, the
  band in `makeAppTopBar`), `settings_font.js`, `settings_project.js`, `settings_app.js`, the vitest setup
  file (pin `'all'`).
- **ANY-INK file:** `guides_layer.js`: in Simple, lock only kinds `'metric'` and `'baseline'` at
  `handleGuidesLayerEvent` and `onKeyDown`; edges stay draggable.
- **Stubs:** with every feature flag off, Simple is today's Characters page minus the hidden controls,
  reachable only by `?ui=simple`.
- **Test page:** `tests/mode.html` toggles the mode on a sample project and lists the visible controls.
- **Unit tests:** visibility tables; the key map in both modes; the Simple key gates; the landing rule
  (undo to a Kerning entry turns on the band); horizontal lines locked and edges not; with no flag the
  visible controls equal today's.
- **Done when:** these pass and the full suite is green under `'all'`.

### B6. Top bar, Next line, tips, undo toasts, save status

**DONE 10/14/2026** (top bar and coach tracks, the B6 + B7 integration, which turned `coach` on,
then the critic, fix and finalize passes the same day; choices in D-036 and D-037; numbers in
TEST_LOG). Beyond the plan below: History names every press itself, Ctrl+Z included; app notices
sit in the bar's gap; the strip's font-check line is gone in Simple; the tip sits beside the
sentence in one row, so the page never moves; toasts sit above the canvas's zoom bar; one letter
set (`board/letter_set.js`) and one rule for ink, Ready and empty for the rail, the Next line, the
letter card and the overlay; an undo toast whose button no longer acts goes at the next step and
never holds a destructive toast back; Delete and Clear letter say what they took, with [Undo]; the
strip's Try-it text starts as the font name; Space presses a keyboard-focused top-bar button.

- `src/anyink/topbar/simple_top_bar.js`: logo, font name, rail with the ready count, Undo / Redo
  buttons, status pill, More tools, Menu.
- `src/anyink/coach/`: `rules.js` (pure: state in, `{ sentence, button, action, primary }` out, the 17
  rules of 4.0), `coach_state.js` (`makeEditorTracker` subscriptions: whichGlyphIsSelected, currentItem,
  traceLayer, autoTrace, projectFile, kernPairs, fontMetrics, fontCheck), `coach_element.js`
  (`<anyink-coach>`, registered in `registerCustomComponents` in `src/app/main.js`), `skips.js`
  ("Something else"), `tips.js` (the Tip line, at most 3 in the first session, `tipsSeen`).
- `src/anyink/history/undo_toast.js`: named undo / redo toasts through `historyText`, with [Show me] on
  the board (B2).
- `save_status.js`: the four Simple states.
- **Upstream file touched:** `menu.js` (`makeAppTopBar` Simple branch).
- **Stubs:** each rule names its feature flag and is skipped while the flag is off; rules are tested
  against fake state. `journey.test.js` replays section 3 on fake state here and on the real screens in
  B16.
- **Test page:** `tests/coach.html` steps a fake font through every rule and the section 3 journey.
- **Unit tests:** each rule and its order; the one-green rule (the Next line's button is outlined
  whenever a card, overlay or dialog primary exists); skips; the next-letter order and one turn per
  Try-it letter; the toast text map; status states.
- **Done when:** these pass and `journey.test.js` passes on fake state.

### B7. Letter view

**DONE 10/14/2026** (letter card, letter canvas and letter tools tracks, the B6 + B7 integration,
which turned `letterView` on, then the critic, fix and finalize passes the same day; choices in
D-036 and D-037; numbers in TEST_LOG). Beyond the plan below: the edges lock while Fine-tune is
closed or a drawing tool is picked; in Simple every Point pen point is an Undo step and closing a
shape finishes it ("bent a curve" for a closing drag); the Point pen follows Undo and Redo, even
mid-press; a shape of 1 or 2 points is taken away when it ends, and leaving the letter mid-shape
ends it on its own letter; the font check waits while a shape is open in the letter view; holes
are made by what shows under a shape (overlapping holes merge, overlapping solids under a new hole
merge when safe); the Solid / Hole switch shows only when Hole would act; the Neighbors switch
waits for his n or H; the dead `'components'` branch was removed rather than turned on (names
unchanged).

- `src/anyink/letter/`: `letter_header.js`, `letter_card.js` (sections per 4.3, Fine-tune closed by
  default), `empty_overlay.js`, `guide_lines.js`, `guide_letter.js`, `edges.js` (only while Fine-tune is
  open; the flag is set by `guides_layer.js`, B3), `auto_hole.js` (Simple only; odd nesting depth =
  hole), `point_kind.js`, `neighbors.js`, `view_switches.js`, `tool_labels.css`.
- **Upstream files touched:** `characters.js` (Simple left area), `panels.js` (the panel slot draws the
  letter card in Simple; `nav.panel` stays `'Attributes'` or `'Trace'`), `edit_canvas.js` (guide-letter
  pass, Simple lines and labels, shading), `tools.js` (word labels, "Point pen" caption, Fine-tune
  grouping), `new_basic_path.js` / `new_path.js` (call `autoHole` after a shape is created, in Simple
  only; also fixes their lowercase 'components' comparison), `context_characters.js` (a view-only
  override that draws his n or H without writing to the letter or the font).
- **Stubs:** until B8 and B9 turn on `brush` and `photo`, the empty overlay offers only "Draw it with
  points" (the Point pen) and the card hides [Draw over it] and [Trace again].
- **Test page:** `tests/letter.html`, one letter on a bare editor.
- **Unit tests:** card sections per state; Fine-tune hides edges, neighbors and the extra tools;
  auto-hole (a shape inside another becomes a hole, a dot inside that hole stays solid, a bullseye
  alternates, overlapping shapes stay solid, brush strokes never change); edges set "manual" and don't
  snap back; the view pans with a refit; toggling Neighbors doesn't mark the file changed.
- **Done when:** these pass and the full suite is green. Days: 4.

### B8. Brush (round), the first half of M10

**DONE 10/15/2026** (brush track, then the B8 + B9 integration, which turned `brush` on, a critic
and fix pass, and the B8 + B9 finalize; choices in D-038, D-040 and D-041; numbers in TEST_LOG).
The finalize made a slow shaky hand as smooth as a quick one, a pen resting mid-stroke cheap, a
turn just before a stroke's end sharp, pasted strokes keep their own ids through Undo, and a letter
with hundreds of strokes quick to change. Beyond the plan below: the Brush is in both modes (B / N,
after New path in All tools, 7.6); an empty letter opens with the Brush picked while its overlay
still offers [Use a photo] and the brush (the opening Brush), and his own pick of it puts the
overlay away; the card's Brush section shows while it is picked; [Draw over it] goes while it is
picked; `path.js` keeps a stroke's tag through Undo, snapshots and saves.

- `src/anyink/nib/` (the folder DESIGN_DOC already reserves): pointer capture with `setPointerCapture`
  and coalesced events (D-014); the 1€ filter; simplify; fit-curve; inking by D-015's path (a round nib
  swept along the stroke, the hulls unioned with clipper2-ts, then refit); perfect-freehand **only** for
  the live preview while the button is down (RESEARCH 2.3); whole-unit points. Each stroke becomes its
  own shape tagged with its stroke id, and its skeleton is stored in `glyph.anyink.nib.strokes`, so M10
  can re-ink strokes without touching traced shapes. Strokes are never merged into other shapes; they
  merge only at "Turn into shapes" (M10).
- Default size 9% of the small-letter height; "Size: thin --o-- thick". One Undo step per stroke: "drew
  a stroke on B".
- **Upstream files touched:** `tools.js` (Brush button, keys B / N), the edit-canvas event wiring for one
  pointer-event tool.
- **Stubs:** none.
- **Test page:** `tests/nib.html`.
- **Unit tests:** stroke to outline; a closed loop keeps its hole; whole numbers; one Undo per stroke;
  strokes stay separate from traced shapes; the live preview and the final ink match within 2% of the
  stroke width.
- **Search first:** the libraries are the ones M10 already vetted (FACTCHECK_LOG); no new ones.
- **Done when:** these pass; `brush` flag on.

### B9. Photos: How card, photo dialog, photo card

**DONE 10/15/2026** (photo-core, photo-ui and photo-flow tracks, then the B8 + B9 integration,
which turned `photo` on and wired the screens to the flow, the Next line and the letter card;
choices in D-039 and D-040; numbers in TEST_LOG). Beyond the plan below: `photo_app.js` is the hub
(rule 11's How, rule 12's Do the next one, Menu > How to photograph, the overlay's buttons, Trace
again, drops and pastes on a letter); step C's outline draws on the app canvas; rule 3 names the
card's green button when there is nothing to use; the card gives its green up while a dialog is
open over it; the work file keeps the images of the photo list; Fine-tune > Tail re-seats a
traced letter in one step. The finalize built Fine-tune > Photo (4.3: Photo fade, Hide photo,
Photo options) and fixed the second hostile pass: lighter letters and a second pen, the m's stem and
the n's leg a box edge clips, bold dots, touching letters in the prefill and the dialog, Done photos,
the photo list through Undo, Cancel after a save, the no-ink advice, and the dialog's tags, resize and
keys (D-041).

- `src/anyink/photo/`: `how_card.js`, `photo_card.js` (steps A and C), `photo_dialog.js` (step B: the
  parts view, click to pick, drag a box with a crosshair, the letter field with its guess, Skip this part,
  Done with this photo), `ink_parts.js` (joining pieces into parts, rows, the speck filter; B3's
  `src/anyink/placement/tests/ink_parts_lite.js` is the reference rule, 4.4),
  `photo_registry.js` (`settings.anyink.photos`: parts, which letter used which part, the scale, done;
  one image id per photo: the B3 stand-in added the same photo twice and got two),
  `photo_flow.js` (import, then placement (B3), then the automatic trace of the part, then the result,
  then Use it via `applyAutoTrace` with `{ round: true, title: 'traced r' }`), `paper_kind.js` (the Flat
  scan / Phone photo detector), `smooth_detail.js` (the one-slider mapping table).
- **Reused:** `trace/trace_import.js`, `trace_model.js`, `trace_fit.js` (also its lock),
  `autotrace/autotrace.js` (`autoTraceImageData` on the part), `autotrace_session.js`,
  `preview_draw.js`, the `autotrace_panel.js` sliders inside Adjust. `trace_region.js` takes the part's
  rectangle instead of the glyph box in Simple.
- **Upstream files touched:** none. The box is drawn in the photo dialog, not on the edit canvas, so the
  trace layer can never catch the drag (`events_mouse.js` stays as it is).
- **Stubs:** before B10, the board entry points (drop on the board, Use a photo..., rule 12 from the
  board) are tested from `tests/photo.html` only.
- **Test page:** `tests/photo.html` with both B0 fixtures, the single-letter photo and a HEIC file.
- **Unit tests:** parts on the tight and loose fixtures (the dotted i is one part); rows; the guess and
  the alphabet prefill; Skip and Done; Use it is one Undo step that restores the earlier shapes; Cancel
  removes the photo it added and puts back the old one; "Add to my shapes"; the photo is locked after Use
  it; the paper detector picks Phone photo for the phone fixture; no-ink message; HEIC message.
- **Done when:** these pass and the photo walk turns the loose fixture into seven Ready letters in
  `tests/photo.html`. Days: 4.

### B10. Letter board

**DONE 10/15/2026** (board-page and board-tiles tracks, then the B10 + B11 integration, which turned
`board` and `checks` on together, and the critic, fix and finalize passes; D-042, D-043). The board
is Simple's Overview: 58 tiles (80 with "+ Numbers & symbols"), one progress line, the rail and the
Next line counting with one Ready rule, type a letter to open it, drops to the photo dialog or a
work file, Undo that stays on the board, and a filter that lasts only while he is on it. Checks:
`tests/b1011.verify.mjs`, `tests/board_page.verify.mjs`, `tests/board_tiles.verify.mjs`.

- `src/anyink/board/`: `board_page.js` (the Overview right area in Simple), `tile_state.js` (extends
  `GlyphTile` `session-state`), `progress.js` (one line, then section counts), `filters.js`,
  `board_keys.js` (type a letter to open it, arrows, Enter), `board_drop.js` (routing to the photo
  dialog), `letter_set.js` (Quick set, + Numbers & symbols, as a settings Undo step).
- **Upstream files touched:** `overview.js` (Simple branch), `glyph_tile.js` (states, caption, badge).
  **ANY-INK:** `trace_drop.js` (board drop routing).
- **Stubs:** until B11 turns on `checks`, Ready = has ink and the filters stay hidden.
- **Test page:** `tests/board.html` with a seeded font in every state.
- **Unit tests:** tile states; keys open the right tile (b, Shift+B, period); drop routing; progress
  counts; Undo on the board stays on the board; re-rendering 58 tiles under 16 ms; the backup write time
  on a 58-letter traced font (against D-026's 100 ms point).
- **Done when:** these pass. Days: 3.

### B11. Checks and fixes

**DONE 10/15/2026** (checks and fixes tracks, then the B10 + B11 integration and the critic, fix and
finalize passes; D-042, D-043). One "Needs a look" for the board, the rail, the letter card and the
Next line, each check with its one-press fix and [Looks fine to me]; the rules the spec left open
(Brush letters by the pen's line when they sink and when fixed, tails by their body, pen-dot specks, the size check waiting for
the photo, Move the line only inside the letter box) are in D-043. Pokes is a soft note (D-042).

- `src/anyink/checks/`: `checks.js` (pure, per letter, each returning `{ id, reason, fix }`),
  `soft_notes.js`, `cache.js` (recompute only the letter named by the narrow topic, on release),
  `fixes.js`, `looks_fine.js` (`glyph.anyink.checksOk`, cleared when the letter's shapes change),
  `fit_lines_to_writing.js` (the "Move the line to fit your writing" fix: moves that line to the median
  of his ready letters on it, as one whole-project step that also refits automatic letters with B3's
  `fitAllAutomatic`; B15's guide-line drags reuse it).
- **Checks** (every one also offers [Looks fine to me]):
  - Ink with no width: [Fit spacing].
  - Hangs past its edges by more than 5% of the letter box (not f, j or tails): [Fit spacing].
  - Body bottom more than 2% of the letter box off the writing line (not tails; punctuation only . and ,):
    [Sit on the line].
  - More than 25% bigger or smaller than its line: [Move the line to fit your writing] when 2 or more
    ready letters on the same line are off the same way, otherwise [Match size].
  - Width outside the B3 limits for its type: [Fit spacing].
  - Specks: a piece smaller than a quarter of (stroke estimate) squared that doesn't sit directly above
    or below another piece: [Remove N specks]. Dots of i, j, !, ?, : and ; are never specks.
  - Pokes past the top or tail line by more than 5% of the letter box: [Shrink to fit]. If the section 8
    fact-check shows Word doesn't cut it off, this becomes a soft note.
  - Font-file problem (B1): [Fix it] (rounds and refits that letter).
- **Soft note** (never removes Ready, never turns a tile amber): stroke estimate more than 35% off the
  median of 5 or more ready letters, punctuation left out of both.
- **Stubs:** none.
- **Test page:** reuses `tests/board.html`.
- **Unit tests:** i, j, !, ., ', a dotted i and a felt-tip i dot are never flagged as specks or as too
  narrow; a long g tail and a Q tail; each fix, including the fit-lines helper (one step, Undo puts the
  line and the refits back); Looks fine to me persists and clears on a shape change; a toast when a later
  change flips another letter's state.
- **Done when:** these pass; the `checks` flag on. Days: 2.5.

### B12. Try it and gap fixes

**DONE 10/15/2026** (tryit-strip and tryit-gaps tracks, then the B12 + B13 integration, which turned
`tryIt` on, and the critic, fix and finalize passes; D-044). The strip grows into Try it under the top
bar; stand-ins with the legend as a sentence under the sheet; the purple gap handle, its floor where the
ink touches row by row; one step per drag with Undo held while pressed; Gaps you fixed lists only his
own fixes; the Word note says nothing is needed until B14; the words never move under the pointer.

- `src/anyink/tryit/`: `expand.js` (the strip grows; never rebuilt), `letter_spacing.js` (the closed
  section; `extra` for every letter, the per-side floor, the photo follows; one whole-project step on
  release), `gap_handle.js` (hover hit test via `preview/hit_test.js`; one-pair kern groups through
  `kern_lookup`; one whole-project step), `gap_list.js`, `stand_ins.js` (faint outlined letters and the
  legend), `word_note.js` ("Word needs one setting for gap fixes"), `font_check_line.js` (B1's check,
  "Your font builds OK").
- **Files touched:** `preview_strip.js`, `layout.js`, `kern_lookup.js` (ANY-INK); `pub_sub.js` (topic).
  No upstream page.
- **Stubs:** before B14, the Next line's [Use in Word] (rule 4) is hidden by its flag; the Word note says
  "Word needs one setting for gap fixes." without the pointer to step 3.
- **Test page:** `tests/tryit.html`.
- **Unit tests:** handle hit test; a one-pair rule written and removed; undo doesn't navigate; slider math
  (letters set by him move too; the floor at zero; the far end touches without overlap); stand-ins; the
  Word note appears after the first gap fix; the backup write time with a dozen gap fixes.
- **Done when:** these pass. Days: 3.

### B13. Start screen

**DONE 10/15/2026** (start and install tracks, then the B12 + B13 integration, which turned
`startScreen` on, and the critic, fix and finalize passes; D-044). The start screen with one green
button; Create with the save box never awaited; the replace check that never writes over a file it
can't keep a copy of; the crash card only for copies newer than their work file; Menu > Start a new
font...; "Other ways to start..." on Load; one owner of Chrome's install offer (the toast, Menu > Help,
and All tools' notice, which never shows in Simple).

- `src/anyink/start/`: `start_page.js` (the Continue card and its crash versions, other fonts with "Open a
  saved font..." always, the name field with a non-colliding default, Create with the picker not awaited,
  the replace check, "Other ways to start..."), `install_offer.js` (the install toast after the first
  Ready letter or the first font file).
- **Upstream files touched:** `open_project.js` (Simple branch; keeps both ids;
  `importProjectDataAndNavigate` still reads the name input), `app.js`. **ANY-INK files:**
  `recents_ui.js`, `recovery_ui.js`, `pwa/register.js` (the install offer moves to the toast).
- **Stubs:** before B14, the install offer fires only on the first Ready letter.
- **Test page:** `tests/start.html`.
- **Unit tests:** Create with a cancelled or never-resolving picker still opens the board; picking a
  recent file or an existing work file with letters asks confirmation 5 and keeps a backup copy; the
  Continue permission path; each crash-card version, with exactly one green button; `pwa.verify.mjs`
  green.
- **Done when:** these pass. Days: 2.5.

### B14. Use in Word

- `src/anyink/install/`: `use_in_word_dialog.js`, `build_names.js` (the test number from `kv` and a scan
  of the folder, only counting up; the 31-character limit; final names), `install_card.js` (numbered
  steps; step 4, and step 5 after M11, highlighted and only when needed; the uninstall line; "When you're
  happy with it").
- **Upstream files touched:** none new (`font_export.js` options are from B1; the Ctrl+E route is B5's).
  **ANY-INK:** `export_folder.js` (the "No folder picked" sentence).
- **Docs:** the section 8 FACTCHECK_LOG entries, answered before this B ships; the card's wording
  follows them.
- **Stubs:** none.
- **Test page:** `tests/getfont.html`.
- **Unit tests:** the number never goes down after an Undo or a backup restore; "Test4" already in the
  folder makes the next one 5; letters with no shapes are left out and a space is added; a broken letter
  blocks the build with its name; step 4 only with gap fixes; the empty-letter count.
- **Done when:** these pass, the fact-checks are logged, and the first full loop runs with `?ui=simple`.
  Days: 2.5.

### B15. Font details, guide lines, Help

- `src/anyink/fontinfo/`: `font_details_dialog.js`, `move_lines.js` (the unlock banner; one
  whole-project step that also refits every automatic letter, through B11's helper; checks rerun and a
  toast reports changes).
- `src/anyink/help/`: `help_page.js` (the glossary from `words.js`, filtered by feature flags; the How
  card text; the keys).
- **Upstream files touched:** `help.js`, `menu.js`.
- **Stubs:** none.
- **Test pages:** `tests/fontinfo.html`, `tests/help.html`.
- **Unit tests:** Font details writes the name to both places as a settings step; moving a line refits
  automatic letters in the same step and Undo puts both back; Help shows no entry whose flag is off.
- **Done when:** these pass. Days: 2.

### B16. Turn Simple on, and Gate 2

Run section 9.4 and the agent first-timer with `?ui=simple`, fix what fails and re-run. Then flip the
launch default in `mode.js` to Simple, redeploy, and run Brennan's Gate 2 session (9.2). Fix what fails
and re-run the failed tasks. Then update DESIGN_DOC section 2 (journey) to point here, ROADMAP (B0 to
B16 done), CLAUDE.md (milestones, new modules, test pages) and TEST_LOG.

### After B16: the remaining roadmap

| Milestone | Where it lands | Change from the old plan |
|---|---|---|
| M9 Handwriting sheet | Step 1: board toolbar, rule 11, Check mode on the board (5.2) | Its review grid is the board's Check mode (saves about 2 days); uses B3 placement and spacing with one scale per sheet |
| M10 Nib brush | Extends B8's Brush: Flat / Pointed nibs, angle, pressure, re-ink brush strokes only, Turn into shapes | Round brush and stroke storage already done |
| M11 Alternates | Letter card Versions, board "x3", Try it "Versions take turns", Use in Word step 5 | Same data plan (D-013) |
| M12 Weight | Letter card Thinner / Thicker; Try it Looks drawer; "Make a bold copy" | No page of its own |
| M13 Roughen | Looks drawer: Rough edges, Ink bleed, Shuffle, Apply / Remove | No page of its own |
| M14, M15 | Done (PWA and GitHub Pages deploy; CLAUDE.md corrected in B0). Redeploying after any B is safe because Simple stays behind `?ui=simple` until B16 | |
| M16 End-to-end | Section 9 on the full flow: sheet, versions, gap fixes, Bold copy, crash recovery | |
| W (optional) | More tools screens in house words, pro words in hints | About 4 days; not needed for Gate 2 |

**Rules every B follows:**
- Read the mode only where screens are drawn.
- Keep the ids from D-001 and the two start-screen ids.
- Subscriber ids are `anyink.<module>.<purpose>`, never a substring of another.
- Drags publish a narrow topic per tick and push one history entry on release.
- Every color is a token; solid green fill only on `.anyink-primary`.
- Every user-facing string on the Simple path comes from `words.js`.
- Turn on only your own feature flag.
- The existing suite stays green under `'all'`, apart from tests the B lists as rewritten.

---

## 11. Decision record (append to docs/DECISIONS.md in B0)

```
## D-031: Beginner-proof design: Simple mode with the letter board as home
**Decided:** 10/13/2026, after Brennan's 10/13 test ("overwhelming ... made me feel lost ... make this
program have cool features but stupid proof"); revised 10/14/2026 after a design review. Numbered
D-031 because D-030 is file autosave.
**Options considered:** (1) Guided: a job-first front door with wizards, a separate Letter desk editor,
and the full editor as a "Workbench"; (2) Simple workspace: one dense screen with the board, canvas,
letter card, coach and strip together; (3) Letter board: the board is home, one cut-down editing
screen, everything else behind an expert switch. Two judges scored them: a beginner advocate (Guided 8,
Letter board 7.5, Simple workspace 6) and a feasibility review (Letter board 8, Simple workspace 7,
Guided 5.5).
**Chose:** the Letter board as the base, with Guided's three-step rail (Letters, Try it, Use in Word),
photo card and install card, and Simple workspace's ordered coach rules, gap handle and never-greyed
photo button. A ready letter shows two buttons; everything else sits in one closed "Fine-tune this
letter" section. One photo makes many letters through a photo dialog that boxes each part in turn.
Simple mode becomes the default only in B16, once every Simple screen exists; until then it sits
behind ?ui=simple and per-feature flags, so the live app never shows a half-built mode. "More tools"
shows every Glyphr Studio tool under a purple band with a one-click way back. One vocabulary file
(src/anyink/words/words.js) supplies every word on the Simple path; internal ids never change
(D-001). Results are made correct by construction:
- one scale per photo (the median over its named letters, earlier untouched letters follow) and one
  writing line per row, so letters from one photo share their ink weight, the same rule D-017 sets
  for the sheet;
- automatic spacing with a per-letter owner flag; the refit runs only in Simple, and any spacing
  change made in More tools marks the letter "set by you";
- the photo moves with the shapes whenever spacing moves them;
- whole-number widths, a font check that runs on the exporter's own list of letters, and an export
  that leaves out letters with no shapes;
- per-letter checks with one-click fixes, each with "Looks fine to me"; soft notes never block Ready;
- brush strokes stay separate shapes tagged with stroke ids, inked by D-015's nib path
  (perfect-freehand only for the live preview), so M10 can re-ink them without touching traced shapes.
Built as B0 to B16 before M9; M9 to M13 then plug into the board, the letter card or Try it.
**Because:** the walkthrough showed two kinds of failure: results that look done but are broken (a
traced letter with width 0, a preview that silently shows a system font), and a pro workspace that
gives a first-timer no next step. The board gives a visible finish line and one obvious next action.
One editing surface means each later milestone is built once, not twice. Filtering only where screens
are drawn keeps upstream merges simple; the existing tests run pinned to All tools, apart from the
label tests B4 rewrites and the files each B lists, and about 20 upstream files gain small,
headed edits. This onboarding is for Brennan himself, so it fits the brief's "no onboarding for
strangers".
**Strongest objection:** about 46 working days before the handwriting sheet, the feature that makes a
full font fastest. Two layers of words and modes also add places for drift. Mitigation: the first
photo-to-Word loop runs behind ?ui=simple after B14; the banned-word test (including toasts and canvas
text) and the vocabulary file stop drift; More tools keeps every upstream capability one click away.
**Revisit if:** Brennan turns on More tools every session (make it remember); automatic spacing on
real handwriting needs regular manual fixes (move to measured spacing from his n and o); his
handwriting's proportions keep tripping the size check (fit the guide lines to his first photo
automatically); or the acceptance run in UX-BEGINNER.md section 9 fails twice on the same task
(redesign that screen, not the words).
```

---

## 12. Revision notes (10/14/2026)

The design review raised 2 blockers, 31 major and 44 minor problems. All of them are addressed. Where a
fix took a different route from the one the review suggested, or part of a suggestion was left out, it
is listed under "Different route, or left on purpose".

**What changed**
- **Photos (blockers).** The box step no longer depends on gap width: the photo dialog opens whenever a
  photo has two or more parts, with a guessed box already drawn; pieces that overlap left to right stay
  one part (i, j, !, ?, :). Step C always has "Wrong part? [Draw a box]". The How card and step A say
  "a finger's width between letters". "Which letter is this?" became the same dialog, with "Skip this
  part", "Done with this photo" and an alphabet prefill, and rule 12 walks through a photo's letters one
  by one. The box is drawn in the dialog, not on the edit canvas, so the photo can't be dragged by
  mistake; the photo is also locked after Use it.
- **Build order (blocker).** Simple stays behind `?ui=simple` until B16; per-feature flags hide every
  door to a later B; stubs are named per B. The false "B1 to B7 plus B10" loop claim is replaced (the
  loop exists after B14). The plan grew from B1 to B12 (23 days) to B0 to B16 (about 46 days): checks
  split from the board, the start screen and Use in Word split, undo got its own B, Brush moved before
  the photo card, and B2 now creates the bare `mode.js` the later tests need.
- **The Next line.** The 17 rules are re-ordered and complete: open dialogs and photo steps first, then
  problems, then progress-based Try it and Use in Word moments, the photo walk, and the next empty letter
  (capitals included; each Try-it letter gets one turn). The journey in section 3 was re-timed to what
  the rules produce, and `journey.test.js` replays it. "Something else" skips a suggestion; "x" still
  hides the line. Unsaved work ranks below the photo steps. Tips moved into the Next line (at most 3 in
  the first session).
- **First run.** A new font's first step is "write your letters on paper and take one photo", with a How
  card ending in [I have my photo]. Install is offered later, as a toast.
- **Words.** The .gs2 is "your work file" everywhere; "font file" means only the .otf; the start screen
  says so. "Get font" became "Use in Word", "Marks" became "Punctuation", "Pen" became "Point pen",
  "Bigger" became "Big preview", "See-through" became "Photo fade", "Change line heights" became "Move
  the guide lines", "pair spacing" became "gap fix". View toggles are real switches named for the thing.
  Every "More" disclosure is named for its contents. "The space between words is made for you." No
  uppercase headings. The word scope is now the Simple main path; More tools wording is optional step W.
- **Banned-word test.** Quoted Windows and Word labels and file names are an explicit `.anyink-quote`
  exemption; noun-only rules are gone; canvas text is scanned through a `fillText` spy; every toast in
  the scripted flows is recorded, and all upstream toasts go through one queue.
- **One green button.** One owner per screen state, written once in principle 1 and counted the same way
  by the test: the open card, overlay or dialog wins; otherwise the Next line. Solid green fill is only
  for that button; other green uses are outlines; the Try-it dots on tiles are gone.
- **The letter view.** A ready letter shows only its name, Ready, [Trace again] and [Draw over it].
  Shapes, spacing edges, neighbors, extra tools and view switches sit in "Fine-tune this letter". The
  empty letter has one overlay and no repeated buttons. [Fit again] is gone while spacing is automatic.
- **Ready and checks.** Every check has [Looks fine to me]; the thickness check is a soft note; a toast
  says when a change flips another letter. Thresholds no longer flag i, l, j, !, the period or the
  apostrophe, and i or j dots are never specks. The size check can offer "Move the line to fit your
  writing" instead of shrinking his handwriting. The bottom limit is 2% in both the check and T2.
- **Placement and spacing.** One scale per photo and one writing line per row (D-017's rule; stroke
  weights tested within 15%); tails are kept by seating on the body. Placement stays out of
  `applyAutoTrace`. The photo moves with the shapes on every fit, refit, edge drag and spacing change.
  Edge drags set "manual" inside `guides_layer.js` before `addState`; the refit hook runs only in
  Simple, and More tools spacing changes mark letters "manual". In Simple only the horizontal lines are
  locked. The letter-spacing slider moves every letter, with a floor at touching. Moving a guide line
  refits automatic letters in the same Undo step.
- **Undo.** One press undoes the newest change wherever it is; on the board it stays on the board.
  Opening a letter adds no step; creation steps are skipped; settings steps cover `settings.anyink` and
  the project name; the undo list is capped; every new action's Undo kind is listed (7.3); photo Cancel
  is defined.
- **Use in Word.** Only the numbered steps show after a build; the "Kerning for fonts" step is numbered,
  highlighted and shown only when gap fixes exist, and Try it mentions it at the first gap fix. The
  test number lives in app storage and the folder scan, never in the font. Ctrl+E goes to the dialog;
  Ctrl+G is off in Simple. Letters with no shapes are left out of the file; the space is added to the
  file only. Folder-picking text covers Chrome's block on Documents and its Allow prompt.
- **Font check.** It runs on the exporter's own list for the whole font, names the letter, and the
  preview builder no longer turns a width of 0 into the default width.
- **Start screen.** One card for Continue and crash recovery, never two green buttons; the name field
  never suggests a name that collides; picking an existing work file asks first (confirmation 5);
  "Open a saved font..." always shows; Open with unsaved work uses two separate clicks.
- **Smaller fixes.** One Smooth / Detailed slider; a paper-type detector; board keys open tiles; a toast
  when a key switches tools; the strip shows when it has the keyboard; one key map in both modes; filters,
  counters and "Letter spacing..." hidden until useful; faint outlined stand-ins with a one-time legend;
  neighbors labeled the first time and drawn view-only; auto-hole in Simple only, by nesting depth; the
  glossary filtered by landed features; Font details shows only the Numbers & symbols switch; T10 and
  the pass rule spelled out (limits add to 20:00); "overlap" defined; the agent first-timer replaces
  "a stranger"; the letter box defined once (2,048 units); counts deferred to B0's recount; the update
  notice's real wording quoted with its planned change; M14 and M15 recorded as done (CLAUDE.md fixed in
  B0); B1 also fixes `makePanel`.

**Different route, or left on purpose**
- **No crop-box layer in `events_mouse.js`.** The review asked for one ahead of the trace layer. Moving
  the box into the photo dialog removes the conflict at its root and touches no upstream mouse code.
- **The "uninstall Test 2" line is optional, not a numbered step.** Numbered names already avoid the
  Windows cache problem; making it mandatory would add a trip to Settings to every test build. The line
  names the exact old font, so it is easy when he wants it.
- **"Move all letters closer or further apart" stays,** inside a closed section of Try it, because
  joined-up handwriting needs letters to touch. The gap handle stays the first thing he sees.
- **The "pokes past the line" check keeps its Shrink to fit button,** now with Looks fine to me. Whether
  Word cuts off the ink is a fact-check item (section 8); if it doesn't, the check becomes a soft note.
- **The "Kerning for fonts" exemption is markup, not a word list:** the test skips only `.anyink-quote`
  entries, which are reviewable in `words.js`.
- **Overlapping brush strokes stay separate shapes in the font file,** pending the section 8
  fact-check; merging at export is the fallback.
- **The schedule was not cut** to fit the old 23 days; the honest estimate is about 46, recorded as
  D-031's strongest objection. Step W (More tools wording) is the first thing to drop if time is short.
