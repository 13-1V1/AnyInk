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
- `test/` + `src/**/tests` — vitest (jsdom + vi-canvas-mock).

## ANY-INK rules
- Two-line header on every new code file, and above the GPL notice on every
  upstream file we modify (never remove upstream notices):
  `Created by: Brennan Meyer with use of Claude Code MM/DD/YYYY Santa Clarita, CA`
  `brennanmmeyer@gmail.com`
  Use the real date the file is written. JSON and the manifest skip it.
- New features are their own modules under `src/anyink/<feature>/`, each with a
  minimal test page in `tests/`. `tests/` is never in the production build.
- Purely visual: no code panels, no feature-file editing, no font data as text.
  Number fields only as secondary readouts beside a visual control.
- All colors are theme tokens in one file. No hard-coded colors in components.
  Green `#16A34A` = what you're touching. Purple `#7C3AED` = structure.
- Units: font units for glyph coords, points for type size, inches for anything
  physical. No metric in the UI.
- Never commit font project files (`*.gs2`) or exported fonts, except test fixtures.
- Studio docs live in `docs/`: BRIEF, RESEARCH, DECISIONS, DESIGN_DOC, ROADMAP,
  TEST_LOG, FACTCHECK_LOG, AUDIT.

## Milestones
1. Fork and run — DONE 09/23/2026 (builds, 613 tests pass, runs unchanged).
2. Rename — DONE 09/23/2026 (visible branding, About credits, new nib icon + wordmark; internal identifiers kept, see docs/DECISIONS.md D-001)
3. Visual audit — pending
4. Reskin — pending
5. Visual editing (metrics, kerning, preview strip, undo gaps) — pending
6. Files (FSA open/save, autosave, crash recovery, OTF export, format) — pending
7. Trace layer — pending
8. Auto-trace — pending
9. Handwriting sheet — pending
10. Nib brush — pending
11. Alternates — pending
12. Weight slider — pending
13. Roughen / ink bleed — pending
14. PWA — pending
15. Deploy (GitHub Pages) — pending
16. End-to-end check — pending
