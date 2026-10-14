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
- `src/anyink/trace` — trace image per glyph / ligature / component (`item.anyink.trace`, pixels in
  `editor.assets`): model, decode + bitmap cache, canvas draw, Resize-tool drag layer, drop / paste /
  picker import, Trace panel, which clipboard a Ctrl+V means (`clipboard_note.js`), carrying traces
  between open projects (`trace_carry.js`). Test page `tests/trace.html`.
- `src/anyink/controls/focus_release.js` — any press on the edit canvas takes the keyboard back
  from panel controls; new panel controls need no focus hand-back of their own.
- `test/` + `src/**/tests` — vitest (jsdom + vi-canvas-mock).

## ANY-INK rules
- Two-line header on every new code file, and above the GPL notice on every
  upstream file we modify (never remove upstream notices):
  `Created by: Brennan Meyer with use of Claude Code MM/DD/YYYY Santa Clarita, CA`
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
6. Files — DONE 09/23/2026 (Open / Save / Save As on File System Access with remembered handles and recents `src/anyink/files`; IndexedDB crash recovery (snapshots keyed per editor session, one Web Lock per live session, undo queue stored in the snapshot, 3 s debounce with a 15 s max-wait, at most 3 orphan snapshots per font) and a Recover card `src/anyink/recovery`, replacing localStorage auto-save (D-026, D-027); OTF/TTF/WOFF/WOFF2 export into a picked folder; `settings.anyink` block and `merge()` boolean fix; asset store `src/anyink/assets`; one `anyink` IndexedDB database `src/anyink/storage`)
7. Trace layer — DONE 09/24/2026 (`src/anyink/trace`: `item.anyink.trace` with the image Blob in `editor.assets`; drop, paste or pick a PNG / JPEG / WebP (EXIF upright, capped at 2000 px); Trace panel with opacity slider, show, invert, lock, fit; move / resize on the canvas with the Resize tool while the Trace panel is open (shapes win over the image body, its corners win over shapes); every change one undo; `.gs2` keeps only images a trace uses, crash snapshots keep all; cross-project copies carry the image; never exported; D-028; critic, fix and finalize passes 09/24/2026)
8. Auto-trace — DONE 09/24/2026 (src/anyink/autotrace: params, binarize, potrace worker + client, svg_to_shapes, trace_region, facade autotrace.js for M9, session, preview, apply, Auto-trace card in the Trace panel; D-029)
B. Beginner-proof (docs/UX-BEGINNER.md, D-031) — IN PROGRESS: B0 done 10/14/2026; B1 to B16 next, then M9.
   Brennan has never made a font: plain words, one next step per screen, nothing advanced on the main path.
   Simple screens stay behind `?ui=simple` and per-feature flags until B16 flips the default.
9. Handwriting sheet — pending (after B16; plugs into the letter board)
10. Nib brush — pending
11. Alternates — pending
12. Weight slider — pending
13. Roughen / ink bleed — pending
14. PWA — DONE 09/24/2026 by Codex (vite-plugin-pwa injectManifest, prompt-only updates, offline; automated Chrome/Edge checks in docs/PWA-VERIFICATION.md; a real desktop install by Brennan is still owed)
15. Deploy — DONE 09/24/2026 (https://13-1v1.github.io/AnyInk/, repo 13-1V1/AnyInk, .github/workflows/pages.yml: tests then build then Pages on every push to main; docs/DEPLOYMENT-2026-09-24.md)
16. End-to-end check — pending
