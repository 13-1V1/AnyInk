# tests/ — minimal feature pages

One page per feature, loading only what that feature touches. Start them with
`npm run pages` (Vite on port 5174, repo root, never built). Pages import from
`../src/...`. Set `window.log = () => {}` before importing upstream modules that
call the bare `log()` helper. Vitest unit tests live beside the code in `src/`.

## Real-browser checks (`*.verify.mjs`)

Node scripts that drive real Chrome through Playwright with a throwaway profile. Each starts
its own server on a free port.

Since B16 (10/16/2026) ANY-INK opens in **Simple** (`src/anyink/mode/mode.js` `LAUNCH_MODE`): the
address with no `ui`, the installed app's `start_url` and a reopened tab. **All tools is
`?ui=all`** for one load (or the More tools switch). Every check of All tools loads `?ui=all`;
the vitest setup (`vitest-setup.js`) loads every test page at `?ui=all`, so jsdom tests stay pinned
to All tools unless they switch. The test pages in `tests/` open in Simple too unless their address
says `?ui=all`.

Since B5, Simple (`?ui=simple`) draws no page chooser, no panel chooser and no panel, and locks
the horizontal guide lines (UX-BEGINNER 6.2, 7.6). Until the Bs that give Simple its own way
there land, the walkthroughs that run in Simple reach those screens through
`verify_standins.mjs`: `toOverview` (B10's "<- All letters"), `showTracePanel` (B9's photo
card), `pressInAllTools` (B7's Fine-tune rows), `moveGuideLines` (B15's Move the guide lines)
and `nudgeWritingLine`. In All tools each one uses the real chooser or control, as before.

- `pwa.verify.mjs` (`npm run verify:pwa`): the installable offline app on a production build.
- `pwa-storage.verify.mjs` (`npm run verify:pwa-storage`): storage on the production build.
- `menus.verify.mjs` (`npm run verify:menus`): File, Presets and Projects menus readable without
  hover, greyed-out rows and their reason included; house words in the Presets hints and the
  Projects menu (B1). Optional arguments: a screenshot folder, then another `src` folder to serve.
- `leave-warning.verify.mjs` (`npm run verify:leave`): Chrome's "Leave site?" prompt shows only
  when work would be lost: an example after looking around (empty letters too) doesn't warn, a
  changed gap or a new font name in the Settings row does, an imported font file gets the check
  (B1). Saves only to the browser's private file system.
- `notices.verify.mjs` (`npm run verify:notices`, builds first): one notice per launch, "ready
  offline" once ever, Not now remembered; the notice covers nothing on the start page, Overview,
  the editor or Settings, at 1600x900, 1280x720 and 1024x768 (B1). Optional arguments: a screenshot
  folder, then another built folder to serve.
- `b1.verify.mjs` (`npm run verify:b1`): the B1 walkthrough end to end in the dev app: guide
  lines on an empty letter, the panel chooser, an honest Real font preview, the font check
  naming a traced letter, the export toast, no leave prompt after a save, one notice at a time in
  the top bar. Optional argument: a screenshot folder. `B1_PHOTO=path/to/photo.jpg` traces a real
  photo instead of one drawn in the page.
- `guides.verify.mjs` (`npm run verify:guides`): guide lines measured from the drawn pixels: an
  empty letter's lines reach the default width with a faint right edge, narrow letters keep their
  own box, the first Pen clicks keep the lines, and the writing line holds 3:1 on screen at 125 %
  and 150 % display scale (B1). Optional argument: a screenshot folder.
- `fontcheck.verify.mjs` (`npm run verify:fontcheck`): the font check and the export toast in the
  dev app: "Exported ... to Fonts, but small b needs fixing." with Show me, the space, a point too
  far out (with what to do), gaps of 12.5 (file made, Real font shows the letters) and 40,000 (B1).
  Optional argument: a screenshot folder.
- `undo.verify.mjs` (`npm run verify:undo`): Simple undo on `tests/undo.html` and in the dev app:
  one press undoes the newest change with at most one view jump, opening letters adds no step,
  the 200-step cap; All tools keeps its navigation steps but a saved font stays saved; every
  press named by its own step's title; 250 looks around keep a trace undoable, at most 30
  "Navigated to" entries and no press that does nothing (B2).
- `spacing.verify.mjs` (`npm run verify:spacing`): `tests/spacing.html`: the gap rule at 2,048 and
  1,000 units, measured sides (a drifted dot and a hooked tail hang into the space, never closer
  than 0.1 G to the width; "gg gy yg yy ig gi il li ti" row by row never touch), diagonal pairs, a
  hand leaning 20 degrees spaced like upright, the letter-spacing slider dragged to both ends (no
  overlaps, photos stay under the ink), Reset, an edge drag ("set by you"), Fit all, a letter drawn
  on the pad (B3). Optional argument: a screenshot folder.
- `placement.verify.mjs` (`npm run verify:placement`): `tests/placement.html`: the fixture photos
  placed by the photo's scale and traced by the real auto-trace; every letter's body on the
  writing line within 2 % of the letter box, stroke weights within 15 %, tails kept; the page
  draws each row's sloped writing line (B3).
- `b23.verify.mjs` (`npm run verify:b23`): B2 and B3 together in the dev app, in Simple and in All
  tools: a photo of an a, and e and n from one photo, placed the way B9 will and traced with
  Replace; widths, side spaces and writing-line offsets; "aen naan" in Real font with no
  pile-ups (measured row by row); switching letters adds no step; Undo twice. Writes
  `numbers.json` beside the screenshots. `B23_A_PHOTO=path` traces a real photo of an a.
- `hooks.verify.mjs` (`npm run verify:hooks`): the Undo hooks in the dev app: in Simple a step on
  a letter others are made from refits them as one step (Ctrl+Z / Ctrl+Y move all of them), 40
  nudges keep every earlier step, Use it 'replace' on a letter made from another, dragging and
  arrow-nudging the guide lines (one step about no letter; Undo from another letter stays put;
  40 quick presses on one line are one step), Delete letter undone in one press; a Simple list
  restored through the real Recover card under All tools undoes and redoes every step (B2, B3).
  Optional argument: a screenshot folder.
- `check-line.verify.mjs` (`npm run verify:check-line`): the strip's font check line at 48, 120
  and 200 pt, canvas and Real font: nothing is drawn under it, and the letters never move when it
  comes or goes (B1). Optional argument: a screenshot folder.
- `words.verify.mjs` (`npm run verify:words`): `tests/words.html` lists every words.js key with its
  text, hint, pro word and feature, none says a banned word, Help's glossary shows the landed words
  in 2.1's order, every Undo title has its plain words; then the dev app with `?ui=simple`: the
  banned-word scanner run in the real page (real CSS) finds in the strip, Simple's Menu (the top
  bar's, B6) and the canvas the same hits as the jsdom scan; the left edge pointed at says
  "left space" with no number, pressed and dragged about 12 px it reads "left space N", then the
  drag is undone (B16); the whole Simple letter screen has 0 hits (B4; asserted since the B4 + B5
  integration). Optional argument: a screenshot folder.
- `toast.verify.mjs` (`npm run verify:toast`): one toast voice (B4). `tests/toast.html`: All tools
  draws a toast where and as long as upstream did (top middle, 3 s); Simple draws it bottom right
  just above the strip, 6 s, hover pauses it, an undo toast holds while an info toast waits, a toast
  with a button holds against info, a message with no words key is dropped, file names are quotes.
  The test page opens in All tools (`?ui=simple` for Simple). Then the dev app in Simple: the real
  Merge says "Merging the shapes..." then "Merged the shapes", 8 px above the zoom bar (D-036; 16 px
  above the strip on a page with no zoom bar), Ctrl+R says nothing, a photo opens the photo card at
  step C ("Look right? Press Use it...", no toast) and Cancel takes it out, Ctrl+S says nothing (the
  save status does), no message dropped; the same steps in All tools (`?ui=all`) keep today's words
  except Merge, and the photo's toast still shows 1 s later (B16). Then the toast fix track in
  Simple: a dropped photo opens the photo card; a dropped work file and empty drawing say what they
  are; an error toast holds while a tool key's toast waits; an offer keeps its button through a
  real click on the drawing surface (the click is checked to land on the canvas); after a reload
  the start screen's card for never-saved work asks before Throw it away (one green Keep it), Keep
  it keeps the card, Throw it away takes it off (B13). Optional argument: a screenshot folder.
- `screens.verify.mjs` (`npm run verify:screens`): the display points Simple shares with More tools
  (B4), in both modes: the canvas guide labels and drag readouts ("small-letter line 1100", "tail
  line 440", "Left space 0"), the File menu rows with file names and types as quotes, the strip
  ("Preview" in sentence case, "Type anything", "Samples"; Real font and Guide lines in All tools
  only since the B4 + B5 integration) and its Samples menu, the save status, the three app notices.
  Optional argument: a screenshot folder.
- `b45.verify.mjs` (`npm run verify:b45`): B4 and B5 together in the dev app. Before and after
  screenshots of All tools (Characters page, File menu, guide labels, save status, strip; "before"
  is the last commit's `src/`, exported to a temp folder) and checks that All tools keeps its
  controls; then Simple: hidden pages, panels, tools, actions, menu rows and settings rows gone,
  the keys per the map, the writing lines locked and the edges draggable, an Undo that lands on
  Kerning with the purple band and Back to my letters, every toast in plain words with none
  dropped, and the banned-word scan at 0 on every Simple page (start page tabs, Overview, letter
  page, letter chooser, Help, About; strict since the finalize pass). The finalize pass added:
  one green button per start page tab, a font file brought in on the Load tab (every progress line
  scanned), [Back to my letters] on Help and About, the sentence before the first folder picker,
  and in All tools the strip's redraw after a rectangle and Ctrl+Z with a strip toggle focused.
  Optional argument: a screenshot folder.
- `mode.verify.mjs` (`npm run verify:mode`): `tests/mode.html` on the sample font: All tools at
  launch shows all of today's controls and no band; Simple shows today's Characters page minus what
  UX-BEGINNER 6.2 hides, with `html[data-ui-mode]` following; More tools after Simple shows the
  purple band (real CSS: contrast, sentence case, no banned word, an outlined button) and Back to
  simple works; Simple's Undo of a More tools gap change lands on Kerning with the landing band, and
  Back to my letters returns, and Redo lands there again saying Redo did it; the key map in both
  modes ("Switched to Rectangle (R)" in Simple, H says P; U, B, Ctrl+R and Ctrl+G off; Ctrl+E makes
  the .otf); a flag preview adds only its own control; then the dev app: `?ui=simple` mirrors
  to `html[data-ui-mode]`, and `turnOnMoreTools` / `backToSimple` redraw the real page through
  Navigator.navigate, with the band in its own grid row under the top bar (B5). Since B16 it checks
  B5's stub with every flag turned off in the page, opens the test page with `?ui=all` for "All
  tools at launch", and checks that the dev app with no `?ui` opens in Simple and `?ui=all` in All
  tools. Optional argument: a screenshot folder.
- `wiring.verify.mjs` (`npm run verify:wiring`): the B5 wiring in the dev app. All tools: a letter
  page shows exactly the controls jsdom recorded before the wiring
  (`src/anyink/mode/tests/today_controls.json`), P / E / U / B / V pick their tools, Ctrl+Space hides
  the UI, Ctrl+G downloads the SVG font file, Ctrl+O opens the work file picker (no new window), the
  small-letter line drags. Simple: the page chooser with Simple's four pages (kept until B6's rail),
  no panel chooser or panel, 5 tools and 6 view controls, File and Help menus with Save, Save
  as..., Open a saved font... and the .otf font file only, 0 banned-word
  hits on the whole letter screen (asserted since the B4 + B5 integration), R says "Switched to Rectangle (R)", U / Ctrl+Space / Ctrl+G do
  nothing, the guide lines stay put while the right edge drags, Ctrl+O with unsaved ink asks first.
  Then the landing rule with real clicks and keys on the Simple v2 example (Kerning, Back to
  simple, Ctrl+Z, Back to my letters). Optional argument: a screenshot folder.
- `mode-fixes.verify.mjs` (`npm run verify:mode-fixes`): the B4 + B5 mode fix track in the dev app.
  Simple keeps the page chooser ("All letters", "One letter", "Help", "About ANY-INK") so Help and
  About are no dead end; an empty letter's edges aren't grabbed and its width stays 0 (All tools:
  never below 0); Delete, Backspace and Ctrl+R with nothing picked add no Undo step (Ctrl+R is left
  to Chrome in Simple); B picks nothing until the Brush and H says "Switched to Point pen (P)"; a
  photo's corner on an empty letter's edge resizes the photo; tiles say "Changed since you opened
  the font." / "Not made yet. Click to start it." by ink; the File menu has Open a saved font...,
  key chips on one line, and a font from a .woff names and makes the .otf with Ctrl+E; Ctrl+Y that
  lands on Kerning says "Redo took you to ..."; the Open Project page follows a mode switch.
  (Finalize: the photo step turns B9's 'photo' flag on, since Simple draws no photo before B9.)
  Optional argument: a screenshot folder.
- `words-fix.verify.mjs` (`npm run verify:words-fix`): the B4 + B5 words fix track in the dev app:
  the strip passes the app's keys on (Ctrl+Z after Fix it, Samples or the slider), Simple's four
  save states and their tooltips, one label on a pointed-at edge, no neighbor letters on Simple's
  canvas, the empty preview's two sentences, the Overview's sample on paper, the strip's
  "Double-click to work on ..." tooltip, the start page's drawing line. Optional argument: a
  screenshot folder.
- `b67.verify.mjs` (`npm run verify:b67`): B6 and B7 together in the dev app, with the flags as the
  app has them (`coach`, `letterView` on). Simple, a new font, small a: the Simple top bar, the
  Next line ("small a is empty. Draw it with points.", no button of its own) and the empty
  overlay, one green button (the overlay's), 0 banned words (strict); an app notice inside the
  bar's gap; "Draw it with points": plain clicks at fixed screen points (one Undo step a point,
  the canvas never moves, "Finish the shape" the one green button while drawing), the closing
  click moving (no error, the button goes), a second shape inside it a hole (paper in the middle,
  "Made shape 2 a hole [Make it solid]" above the zoom bar, covering no switch); Fine-tune open:
  the purple edges show and take the pointer, closed: hidden and the pointer passes; Ctrl+Z names
  the press ("Undid: ..." [Redo]) in the hole toast's place; the status pill as he saves (Not
  saved yet [Save] -> Saving... -> Saved; Couldn't save [Fix] and its box) with the leave warning
  agreeing each time. Then All tools before (the last commit's `src/`) and after: the same
  controls and the same pixels. Optional argument: a screenshot folder.

- `b67-fixes.verify.mjs` (`npm run verify:b67-fixes`): the B6 + B7 finalize pass, every finding the
  fix tracks' verifiers left open, with real mouse and keys in Simple: Space on a keyboard-focused
  "1 Letters" goes to the letters and Space after a mouse click on Undo pans; the Point pen keeps
  its shape through Ctrl+Z at points between whole units (five letters) and through Ctrl+Z with
  the mouse held; three open points leave the rail's count alone and "Finish the shape" adds the
  letter at once; "<- All letters" with 2 points takes the shape away with a toast and the font
  check runs on the board, with 3 it finishes it; "Finish the shape" with 2 points; "Cleared ..."
  [Undo] at once after Ctrl+Z; two like undos and the toast's [Redo]; Delete with [Undo] and a
  Shapes row picked with Edit points; a hole where three rectangles overlap; Help and About with
  one green button; the strip's Try-it text is the font name; the Fix box's one green; "Finish the
  shape" merged into a hole leaves no ghost picked. Optional argument: a screenshot folder.

- `nib.verify.mjs` (`npm run verify:nib`): the B8 Brush. `tests/nib.html`: B picks the Brush; a
  real mouse drag draws a stroke whose live picture and ink match within 2 % of the stroke width
  (an S, an o with paper in its middle, a thick stroke), one Undo step a stroke, each stroke its own
  tagged shape with whole-number points, Undo / Redo, the size slider, All tools draws too; then
  the dev app in Simple (a stroke on small a: "drew a stroke on small a", Ready, automatic spacing,
  0 banned words, Ctrl+Z / Ctrl+Y) and All tools' tool column. Optional argument: a screenshot
  folder.
- `b89.verify.mjs` (`npm run verify:b89`): B8 and B9 together in the dev app, with the flags as the
  app has them (`brush`, `photo` on). The Brush: an empty letter opens with it picked while the
  overlay offers [Use a photo] (the one green) and the brush; a closed loop keeps its hole, whole
  numbers, automatic spacing, one Undo step a stroke, strokes never merged; [Draw with the brush].
  The photo walk on the loose B r e n a H d fixture with real clicks and keys: Next line [How],
  the How card, [I have my photo] (a stand-in for the Windows picker hands over the fixture; it
  must start in Downloads), the dialog boxes each letter, the letter typed, Trace it, step C in
  the letter card with [Use it] the one green, Use it, rule 12's [Do the next one]; seven letters
  Ready on the writing line; "Brennan Hand" in the strip and in the real font (the exporter's own
  build) with no letters touching, evenly spaced, on one line. A whole-alphabet phone photo for
  small z from step A (the letter known, Phone photo picked); an iPhone HEIC photo's plain
  sentence and [Choose another photo]; a one-part photo straight to step C. All tools before (the
  last commit's `src/`, `B89_BEFORE=skip` for none) and after: the same controls but the Brush, the
  same pixels outside the tool column. Optional argument: a screenshot folder.

- `photo_ui.verify.mjs` (`npm run verify:photo-ui`): the B9 photo screens' fix pass in the dev app
  (the first-timer's findings 1 to 5): the dialog's x closes it with a real mouse from all three
  ways in; every button keeps its box under hover, focus and a press; a whole-alphabet page opens
  close up at 1600 x 900 and 1280 x 720 with readable letters, scrolls only up and down, zooms with
  [-] [+] and Ctrl + the wheel, and no name tag covers a letter; no ink at step C opens Adjust; step C
  fits a tall result in view. Optional argument: a screenshot folder.

- `b89_final.verify.mjs` (`npm run verify:b89-final`): the B8 + B9 finalize in the dev app. The
  first-timer's notebook alphabet page in the photo dialog with every part named: no name tag on
  another tag on the whole photo; a window resized while it is open keeps the letters their size;
  [+] by the keyboard hands the focus on; "Two letters touch here." on a touching pair; Skip reads
  "Not a letter, skip it". The Brush on small b after one stroke: "When small b looks right, go
  to ..." with the button outlined. Fine-tune > Photo on a traced e: a real drag of Photo fade is
  one step, Hide photo, Photo options, Remove photo and its [Undo]. Ctrl+Z / Ctrl+Y across a
  whole-font step ([No tail]) keep the photo list. After "Done with this photo", an empty letter's
  overlay leads with [Choose another photo...]. Optional argument: a screenshot folder.
  `b23.verify.mjs` takes the photo screens' route off for its Trace-panel stand-in, and
  `b45.verify.mjs` sends its photo to the photo screens (B9) instead of expecting it turned away.

- `board_tiles.verify.mjs` (`npm run verify:board-tiles`): the B10 board's tiles, keys and drops
  (every tile state, b / Shift+B / . open their letters, the arrows and Enter, 7 isn't on the
  board yet, a photo held over a tile, dropped on blank space or on a tile), Undo on the board, and
  the backup write measured on a 58-letter traced font. Optional argument: a screenshot folder.

- `b1011.verify.mjs` (`npm run verify:b1011`): B10 and B11 together in the dev app, with the flags
  as the app ships them ('board' and 'checks' on). A new font opens on the board (58 faint to-do
  tiles); b opens small b; a handwriting photo dropped on the board is walked into seven letters
  through the photo dialog; two letters broken on purpose turn amber with plain reasons; the Next
  line, the rail and the board say one count; [Show me], a tile's [Sit on the line] (one step, the
  board stays), Ctrl+Z on the board, [Looks fine to me], the card's chip and the Next line's
  [Match size]; the font check finds nothing; a dropped .gs2 asks first with unsaved work and
  opens otherwise; the backup write after a step on a 58-letter traced font with the Undo list at
  its fullest (D-042); All tools before (the last commit, git archive) and after: the same
  Overview and letter page, pixel for pixel. Optional argument: a screenshot folder.
- `board_page.verify.mjs` (`npm run verify:board-page`): the B10 + B11 finalize's board filter and
  numbers section in the real app (Simple, real checks): [Show me] picks Needs a look; Looks fine
  to me on every amber letter hides the filters; Ctrl+Z on the board stays on All; a letter made
  amber later, or a letter left and come back to, finds the board on All; "+ Numbers & symbols" on
  a filtered board goes to All with the new section in view and washed green; Ctrl+Z / Ctrl+Y take
  it away and bring it back into view. Optional argument: a screenshot folder.
- `b1011_final.verify.mjs` (`npm run verify:b1011-final`): the B10 + B11 finalize in the real app
  (Simple, flags as shipped): small n typed on the board opens with the Brush, one stroke under the
  line gives "sinks" with [Sit on the line] outlined, green once V picks Select, and the press puts
  the pen's line on the writing line; Something else on the filtered board leaves the count with
  no button and the tile brings the fix back; Save keeps the backup's saved copies, the next write
  sends one; the notebook photo's crossed-out Q is skipped as junk and the prefill stops after a
  skipped VW. Optional argument: a screenshot folder.
- `beginner.verify.mjs` (`npm run verify:beginner`): UX-BEGINNER 9.4, run before every Gate 2
  attempt. It builds the app with `src/vite.config.js` plus one probe module (the script's own
  build plugin puts the app's modules on `window.__anyinkModules`; `dist/` is never touched) and
  serves it at `/AnyInk/`; Chrome, no `?ui` (Simple is the launch default; `BEGINNER_SEARCH=?ui=simple`
  pins it), each task's wall-clock time printed at the end, stand-ins for Windows' save box (Documents) and
  folder box (Documents\My Fonts) in the browser's private file area. T1 to T7 and the file part of
  T8 with real drops of `tests/fixtures/brenna-loose.jpg` and `brenna-tight.jpg` (drawn handwriting
  photos with answer keys, copies of `src/anyink/photo/tests/fixtures/brenna-*-phone.*`): one part
  per letter (8 for the tight one, the dotted i one part), every letter Ready on the writing line,
  whole numbers, stroke weights within 15 % of their median (or no further off than the photo
  itself shows, `tests/beginner_weight.mjs`: the drawn pen wobbles 7 %, so the fixture's e is 12 %
  thin on the paper; each letter's pen kept as written within 10 %), one Undo after Use it leaves
  the empty B with its photo, the photo under the ink after Use
  it, a left-edge drag and a letter-spacing change, the e|n gap fixed and undone and redone with
  the top bar's buttons, the .otf read back (family, widths, empty letters left out, no overlap);
  in every screen state exactly one green button (none with the Brush on an empty letter before
  its first mark; with the Brush still picked on a drawn letter, one green or none and the Next
  line's one button outlined, D-043 / D-046), no banned word, no number input, nothing in capitals; every canvas text and
  toast scanned. A failed result check is listed and the run goes on, so one run shows them all.
  `BEGINNER_DIST=<folder>` reuses a probe build. Optional argument: a screenshot folder.
- `drawing_tools_lines.verify.mjs` (`npm run verify:drawing-tools-lines`): All tools (`?ui=all`), a drawing tool's press is the tool's
  (B16, `mode/locks.js`): New path clicks on the writing line make points, New rectangle from the
  right edge and New oval from the small-letter line draw shapes and move no line; Resize still
  drags the right edge.
- `close_soon.verify.mjs` (`npm run verify:close-soon`): B16, Chrome closed 300 ms or 1.5 s after a
  change, its only tab, Leave pressed: the reopened start screen shows the crash card holding the
  change (no work file, and with one). `CLOSE_SOON_ROOT=<folder>` serves another copy of `src/`.
- `start_name.verify.mjs` (`npm run verify:start-name`): B16, no `?ui` opens Simple's start screen
  with the name field holding the keyboard and "My Font" picked; a click on its text, in the empty
  space after it or a slow press, then typing, gives "Brennan Hand"; a click inside his own name
  places the caret.
- `rail_words.verify.mjs` (`npm run verify:rail-words`): B16, the top bar's rail at 1600, 1440, 1280
  and 1024 px with a long font name: every step keeps its words down to 1280; below, the current
  step's name and the others' numbers with tooltips; nothing overlaps, runs off the window or
  scrolls sideways.

Since B10 + B11 (10/15/2026) the letter board is Simple's home and the checks are on: a check
that opens Simple's Overview finds the board, and a B5-era check that wants B5's Overview turns
'board' off in its page (as `pinB5Simple` does). The B6 to B9 walkthroughs (`b67`, `b67-fixes`,
`b89`, `b89_final`) and B10's `board_tiles` draw toy letters (a square, a scribble, clicked
points) that the checks rightly call "Needs a look": they turn 'checks' off in the page once its
start page loads (`verify_standins.mjs` pinBeforeChecks); `b1011.verify.mjs` checks Simple with
the checks on. `b89.verify.mjs`'s All tools comparison expects the Brush only when the last
commit lacks it (as `b67.verify.mjs` does).

Since B8 + B9 (10/15/2026) the Brush and photos are on, and every check runs with the flags as the
app ships them (B8 + B9 finalize: `b67.verify.mjs` no longer turns `brush` and `photo` off; its
empty letter offers [Use a photo] and reaches the Point pen by its key, P).
The B8 and B9 test pages: `nib.html` (the Brush on a bare letter) and `photo.html` (the photo flow
on a new font in Simple, with stand-ins for the dialog and step C; "Walk the whole photo", "HEIC
photo", "Box on bare paper").

Since B6 + B7 (10/14/2026) Simple has the top bar, the Menu and the letter view. The B5-era
walkthroughs that step through Simple's page chooser, File menu or B5 letter page
(`wiring.verify.mjs`, `b45.verify.mjs`, `mode-fixes.verify.mjs`, `words-fix.verify.mjs`) check B5's
Simple, the stub later Bs build on: since the B6 + B7 finalize they turn every feature flag off in
the page once its start page loads (`verify_standins.mjs` pinB5Simple); `b67.verify.mjs` and
`b67-fixes.verify.mjs` check Simple from B6 on. `undo.verify.mjs` and `hooks.verify.mjs` pick the
Rectangle by its key where Simple keeps it inside Fine-tune.
The B6 and B7 test pages: `topbar.html` (the bar on a bare editor), `coach.html` (every Next line
rule, flag toggles, the section 3 journey) and `letter.html` (the letter view on the sample font).

Since S1 (10/16/2026, docs/SKETCH.md, D-047) `sketch.html` shows the sketch model with no app
screen: five stored sketches (`src/anyink/sketch/tests/fixtures/stored_sketches.js`) placed by the
edge rule, built by `curves.js` and swept with the Brush's round nib, with toggles for ink lines,
extremes, ink and handles. `sketch.verify.mjs` (`npm run verify:sketch-page`) checks in Chrome that
it draws, that the curves pass through every point and that every given direction is met; it
starts its own server, or uses a running `npm run pages` with `SKETCH_ORIGIN=http://localhost:5174`.
The `sketch` flag stays off until S9.

Since S2 (10/16/2026) `sketch_draw.html` is the real Characters page in Simple with the `sketch`
flag on for that page only: the five sketch tools on the tool column (Line L, Arc A, Spline S,
Circle C, Rectangle R), snaps and their tags, chaining, the draw layer, and one Undo step per
finished piece (`?standin=1` swaps in a stand-in that proves only the wiring).
`sketch_draw.verify.mjs` (`npm run verify:sketch-draw`) runs the real app on its own Vite server,
turns the flag on from the page (`mode/features.js setFeaturesForTests`), and in Simple sketches
small n (stem, arch, stem), o (Circle between two lines), s (Spline), A (Lines) and a box
(Rectangle); it checks the stored pieces, the join kinds, one step per piece, Undo with a piece
open and after, Redo, Esc twice, saving and reopening the .gs2, All tools with the flag on, and
that with the flag off the tool column and the keys P / E / L / S / C / R are as before.
`sketch_layer_fixes.verify.mjs` (`npm run verify:sketch-layer`) checks the draw layer and wiring
fixes in Chrome: a finished sketch stays drawn on Select, on the Brush and after leaving the
letter (nothing with the flag off), Ctrl after a shortcut never sticks, a right press finishes a
piece, Esc closes the Menu first, Space-pan gives the tool back, the plain wheel zooms in Simple
with the flag on, and the Circle, Rectangle and Arc size readouts.
