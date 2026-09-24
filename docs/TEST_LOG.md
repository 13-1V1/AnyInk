# ANY-INK — Test log

What was tested, what broke, what changed. Newest at the bottom.

| Date | Milestone | What ran | Result | Notes |
|---|---|---|---|---|
| 09/23/2026 | M1 fork | `npx vitest run` on upstream v2.10.5 | 30 files, 613 tests pass (46.6 s) | Baseline. |
| 09/23/2026 | M1 fork | `npm run build` | OK, 2.95 MB main chunk, 1.06 MB brotli wasm | Chunk exceeds the PWA plugin's default 2 MiB precache limit; raise it in M14. |
| 09/23/2026 | M1 fork | Dev server, landing page and editor in the built-in browser | Loads, no console errors | |
| 09/23/2026 | M2 rename | `npm run lint` | 0 errors, 5 warnings (all upstream) | One new warning (unused import) was fixed before commit. |
| 09/23/2026 | M2 rename | `npx vitest run` | 613 pass (35 s) | No test asserted the renamed strings. |
| 09/23/2026 | M2 rename | `npm run build`; landing, editor top bar, About tabs screenshotted | OK | Wordmark renders; About shows Version / Credits / License. |
| 09/23/2026 | M3 audit | `tests/index.html` served by `npm run pages` (port 5174) imports `colors.js` and `app_config.json` from `src/` | OK: page prints `#16A34A` and both version numbers, no console errors | Proves the test-page mechanism (D-019). |
| 09/23/2026 | M3 audit | Analytics loader deleted from `app.js`; `npm run lint`; `npx vitest run` | 0 errors, 5 upstream warnings; 613 pass | No reference to gtag remains in `src/`. |
| 09/23/2026 | M4 reskin | New unit tests `src/anyink/theme/tests/theme.test.js` (8) and `src/anyink/prefs/tests/prefs.test.js` (4) | 12 pass | parseToRGB, withAlpha, toggle + persistence, token cache invalidation, prefs round-trip and corrupt storage. |
| 09/23/2026 | M4 reskin | `tests/theme.html` swatch page, both canvas modes | Every text/line token at or above 3:1 on its surface; chrome text tokens at or above 4.9:1 | Contrast measured live on the page (WCAG formula). |
| 09/23/2026 | M4 reskin | Token migration by 7 parallel agents + sweep; then `npm run lint`, literal grep over `src/`, `npx vitest run` | 0 errors, 5 upstream warnings; 0 color literals outside `tokens.css`/`theme.js` (4 offscreen hit-test canvases in `tools.js` excepted); 625 pass | `colors.css` no longer linked; `colors.js` keeps only math (its exports stay for its own tests). One transient "missing export" console error during migration was a stale HMR module, gone on reload. |
| 09/23/2026 | M4 reskin | Visual QA in the dev server (800x600 pane): landing, Overview, Characters (paper and slate, fit, 35 points selected with the pen tool), Settings Project/Font/App tabs, Kerning page | All render on dark chrome with green touch and purple structure; both canvas modes legible; sliders, option choosers, PANOSE readout, hidden JSON-format row confirmed | Found and fixed: Vite served app.css and nav.css as 0 bytes after the parallel edits (stale transform cache); a touch of both files fixed it. The stale error made the editor grid collapse and the auto-fit put the glyph off-screen; unrelated to the code. |
