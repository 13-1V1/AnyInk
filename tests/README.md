# tests/ — minimal feature pages

One page per feature, loading only what that feature touches. Start them with
`npm run pages` (Vite on port 5174, repo root, never built). Pages import from
`../src/...`. Set `window.log = () => {}` before importing upstream modules that
call the bare `log()` helper. Vitest unit tests live beside the code in `src/`.

## Real-browser checks (`*.verify.mjs`)

Node scripts that drive real Chrome through Playwright with a throwaway profile. Each starts
its own server on a free port.

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
