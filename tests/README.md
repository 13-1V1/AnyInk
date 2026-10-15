# tests/ — minimal feature pages

One page per feature, loading only what that feature touches. Start them with
`npm run pages` (Vite on port 5174, repo root, never built). Pages import from
`../src/...`. Set `window.log = () => {}` before importing upstream modules that
call the bare `log()` helper. Vitest unit tests live beside the code in `src/`.

## Real-browser checks (`*.verify.mjs`)

Node scripts that drive real Chrome through Playwright with a throwaway profile. Each starts
its own server on a free port.

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
  banned-word scanner run in the real page (real CSS) finds in the strip, the File menu and the
  canvas (a guide line hovered) the same hits as the jsdom scan, and the whole Simple letter screen
  has 0 hits (B4; asserted since the B4 + B5 integration). Optional argument: a screenshot folder.
- `toast.verify.mjs` (`npm run verify:toast`): one toast voice (B4). `tests/toast.html`: All tools
  draws a toast where and as long as upstream did (top middle, 3 s); Simple draws it bottom right
  just above the strip, 6 s, hover pauses it, an undo toast holds while an info toast waits, a toast
  with a button holds against info, a message with no words key is dropped, file names are quotes.
  Then the dev app in Simple: the real Merge says "Merging the shapes..." then "Merged the shapes",
  Ctrl+R says nothing, a photo is turned away until B9, Ctrl+S says nothing (the save status does),
  no message dropped; the same steps in All tools keep today's words except Merge. Then the toast
  fix track in Simple: dropped photo, work file and empty drawing; an error toast holds while a tool
  key's toast waits; an offer keeps its button through a real click on the drawing surface (the
  click is checked to land on the canvas); the Recover card asks before throwing work away.
  Optional argument: a screenshot folder.
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
  Navigator.navigate, with the band in its own grid row under the top bar (B5). Optional argument:
  a screenshot folder.
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

Since B6 + B7 (10/14/2026) Simple has the top bar, the Menu and the letter view. The B5-era
walkthroughs that step through Simple's page chooser, File menu or B5 letter page
(`wiring.verify.mjs`, `b45.verify.mjs`, `mode-fixes.verify.mjs`, `words-fix.verify.mjs`) check B5's
Simple, the stub later Bs build on: since the B6 + B7 finalize they turn every feature flag off in
the page once its start page loads (`verify_standins.mjs` pinB5Simple); `b67.verify.mjs` and
`b67-fixes.verify.mjs` check Simple from B6 on. `undo.verify.mjs` and `hooks.verify.mjs` pick the
Rectangle by its key where Simple keeps it inside Fine-tune.
The B6 and B7 test pages: `topbar.html` (the bar on a bare editor), `coach.html` (every Next line
rule, flag toggles, the section 3 journey) and `letter.html` (the letter view on the sample font).
