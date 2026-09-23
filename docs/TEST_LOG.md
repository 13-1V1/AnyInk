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
