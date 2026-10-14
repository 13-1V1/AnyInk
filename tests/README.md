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
- `check-line.verify.mjs` (`npm run verify:check-line`): the strip's font check line at 48, 120
  and 200 pt, canvas and Real font: nothing is drawn under it, and the letters never move when it
  comes or goes (B1). Optional argument: a screenshot folder.
