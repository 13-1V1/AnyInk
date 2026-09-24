# ANY-INK

Personal, purely visual font editor. Fork of Glyphr Studio 2, renamed, reskinned,
shipped as an installable PWA. One user (Brennan). Not a public product.
Platform: Windows 11, Chrome or Edge only (PWA install + File System Access API).

## Upstream
- Forked from https://github.com/glyphr-studio/Glyphr-Studio-2 at tag **v2.10.5**
  (commit 54dfa065) on 09/23/2026.
- Git remote `upstream` = the original repo, full history kept. To pull fixes:
  `git fetch upstream --tags` then `git merge v2.x.y` (only if it merges cleanly).
- License: GPL-3.0-or-later (`LICENSE-gpl-3.0.txt`). Keep every upstream
  copyright notice. Credit Glyphr Studio in the About screen.
- `dist/` is NOT tracked in this fork (upstream commits it). GitHub Pages builds it.

## Commands
- `npm run dev` — Vite dev server on `src/` (port 5173, launch config `anyink-dev`).
- `npm run build` — production build to `dist/`.
- `npx vitest run` — run the suite once (`npm test` is watch mode).
  Upstream baseline at fork: 30 files, 613 tests, all pass.
- `npm run lint` / `npm run fix` — eslint.
- `npm run pages` — Vite on port 5174 serving the minimal test pages in `tests/` (launch config `anyink-tests`).

## Layout (upstream, details in src/README.md)
- `src/project_data` — font data model. Project > Settings / Kerning / Components /
  Ligatures / Glyphs > ComponentInstance / Path > PathPoint. Pure data, no UI.
- `src/project_editor` — ProjectEditor: selection, view, history (undo), file_io, nav.
- `src/edit_canvas` + `tools/` — glyph drawing canvas and tools.
- `src/display_canvas` — text layout and live preview rendering.
- `src/panels`, `src/controls` — UI panels and custom elements.
- `src/pages` — app pages (kerning, ligatures, settings, live preview, global actions).
- `src/formats_io` — OTF / SVG import and export (font-flux-js).
- `src/app` — boot, menu, open project, app config, samples.
- `src/samples` — sample `.gs2` projects. Project file = `.gs2` (JSON).
- `src/anyink/files` (pickers, in-place save, recents, export folder), `src/anyink/recovery`
  (dirty flag, IndexedDB snapshots, Web Lock, Recover card), `src/anyink/assets` (image Blobs on
  the editor, base64 in the `.gs2`), `src/anyink/storage` (idb-keyval-style `kv` + `recovery`
  stores in one `anyink` database). Test pages: `tests/files.html`, `recovery.html`,
  `assets.html`, `storage.html`.
- `test/` + `src/**/tests` — vitest (jsdom + vi-canvas-mock).

## ANY-INK rules
- Two-line header on every new code file, and above the GPL notice on every
  upstream file we modify (never remove upstream notices):
  `Created by: Brennan Meyer with use of Codex MM/DD/YYYY Santa Clarita, CA`
  `brennanmmeyer@gmail.com`
  Use the real date the file is written. JSON and the manifest skip it.
- New features are their own modules under `src/anyink/<feature>/`, each with a
  minimal test page in `tests/`. `tests/` is never in the production build.
- Pub/sub subscriber ids are `anyink.<module>.<purpose>` and never a substring of another
  (upstream unsubscribe matches substrings). New topics go in `src/project_editor/pub_sub.js`.
- Drags publish a narrow topic per tick and push ONE history entry on release
  (`addState` for items, `addSettingsState` for metrics/guides, whole-project pre/post for bulk).
- Purely visual: no code panels, no feature-file editing, no font data as text.
  Number fields only as secondary readouts beside a visual control.
- All colors are theme tokens in one file. No hard-coded colors in components.
  Green `#16A34A` = what you're touching. Purple `#7C3AED` = structure.
- Units: font units for glyph coords, points for type size, inches for anything
  physical. No metric in the UI.
- Never commit font project files (`*.gs2`) or exported fonts, except test fixtures.
- Studio docs live in `docs/`: BRIEF, RESEARCH (with SOURCES), AUDIT-VISUAL, DECISIONS,
  DESIGN_DOC, ROADMAP, TEST_LOG, FACTCHECK_LOG, and later AUDIT. Read DESIGN_DOC and
  DECISIONS before building any milestone.
- No telemetry, ever. The upstream analytics loader was deleted (D-025).

## Milestones
1. Fork and run — DONE 09/23/2026 (builds, 613 tests pass, runs unchanged).
2. Rename — DONE 09/23/2026 (visible branding, About credits, new nib icon + wordmark; internal identifiers kept, see docs/DECISIONS.md D-001)
3. Visual audit — DONE 09/23/2026 (docs/AUDIT-VISUAL.md; every text/code entry point mapped to a milestone)
4. Reskin — DONE 09/23/2026 (tokens.css is the only color source; theme.js token() for canvas code; paper/slate toggle remembered in app prefs; see docs/THEME.md)
5. Visual editing — DONE 09/23/2026 (guides layer src/anyink/metrics, pair view src/anyink/kerning, <preview-strip> src/anyink/preview, sliders src/anyink/controls, history settings entries src/anyink/history)
6. Files — DONE 09/23/2026 (Open / Save / Save As on File System Access with remembered handles and recents `src/anyink/files`; IndexedDB crash recovery with a Web Lock per tab and a Recover card `src/anyink/recovery`, replacing localStorage auto-save (D-026, D-027); OTF/TTF/WOFF/WOFF2 export into a picked folder; `settings.anyink` block and `merge()` boolean fix; asset store `src/anyink/assets`; one `anyink` IndexedDB database `src/anyink/storage`)
7. Trace layer — implemented 09/24/2026 (commit b1aee2f7, isolated trace tests).
8. Auto-trace — implemented in working tree 09/24/2026; real worker/WASM tracing and browser OTF rendering verified. Binarization moved into worker in the critic fix pass.
9. Handwriting sheet — pending
10. Nib brush — pending
11. Alternates — pending
12. Weight slider — pending
13. Roughen / ink bleed — pending
14. PWA — implementation and automated verification in this fix pass; see docs/PWA-VERIFICATION.md for exact install/offline/update evidence and remaining interactive checks.
15. Deploy (GitHub Pages) — existing baseline published; the 09/24 critic fixes have not been deployed.
16. End-to-end check — pending

## Critic fix pass — 09/24/2026
- The original M6 DONE label omitted real file autosave. The fix adds a 3-second maximum
  scheduling interval and glyph-switch writes, independent 3-second IndexedDB recovery,
  revision-aware save status, serialized saves, and external-file-change detection.
- Background saves never prompt or download. Expired permission and write conflicts leave
  recovery intact; use Save to grant permission or Save As to preserve both versions.
- `src/anyink/files/{autosave,save_queue,save_status,save_status_element}.js` own these pieces.
  File fingerprints travel with recovery snapshots. Old recovery records require manual Save.
- Tests: `tests/autosave.html` (real origin-private browser files/IndexedDB),
  `tests/critic-recovery.test.js`, `src/anyink/files/tests/autosave.test.js`,
  `tests/font-release.test.js` (Windows native loading/rendering), `tests/pwa.test.js`.
- Three seconds is the scheduling bound under normal execution; suspended tabs, slow storage,
  unavailable permissions and failures cannot guarantee a hard wall-clock data-loss bound.
- Consult docs/FIX-REPORT-2026-09-24.md for acceptance results. GUI font installation and
  typing in Word are separate from the verified private Windows font-loader test.
- Keep context here (AGENTS.md); do not update the legacy CLAUDE.md.
