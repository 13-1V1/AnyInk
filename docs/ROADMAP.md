# ANY-INK — Roadmap

Milestones follow the brief. Each ends in a verified working state, a commit, and a
status line in CLAUDE.md. Definition of done is one line each.

## Done
1. **Fork and run** — v2.10.5 builds, 613 tests pass, runs unchanged. (09/23/2026)
2. **Rename** — no visible Glyphr branding except credits and license. (09/23/2026)
3. **Visual audit** — every text/code entry point listed and mapped in AUDIT-VISUAL.md. (09/23/2026)

## The vertical slice (milestones 4 to 6)
One complete path: open or create a project on a themed canvas, draw a glyph, drag its
metrics and kerning while the strip updates, save to a real file, export an OTF to a folder,
and recover after a crash.

4. **Reskin** — first task: a token legibility study (contrast of green and purple on white
   canvas, dark canvas, dark chrome; 1 px lines and handle fills) that fixes the exact shades.
   Then one token file drives every color; dark chrome; white canvas with a remembered dark
   toggle; `getColorFromRGBA` replaced by real alpha; number-only fields from the audit become
   readouts or hidden. Done when the app has zero color literals outside `tokens.css` and the
   design:accessibility-review contrast check passes.
5. **Visual editing** — first task: history fixes with unit tests (clone on whole-project
   restore, `settings` entry kind, pre-states for item creation, kern click spam). Then the
   always-active guides layer for metric lines, hit-tested drag kerning in a live pair view with
   kern lookup priority, tile-based kern groups, always-visible preview strip with a points
   slider, sliders for transforms and global actions. Done when every action in the audit's M5
   rows is visual and undoable, and the strip reflows on every drag.
6. **Files** — first task: toolchain spike (module worker, inlined WASM, clipper2-ts, PWA plugin
   under `root: src/`; results in TEST_LOG). Then `merge()` boolean fix, Open / Save / Save As on
   File System Access with remembered folders, autosave on timer and glyph switch, IndexedDB
   crash recovery with restore card, OTF export to a picked folder, `settings.anyink` block and
   the asset store. Done when killing the tab mid-edit loses at most a few seconds of work.

## Creative features (each: module, test page, unit tests, undo, format fields)
7. **Trace layer** — image per glyph with opacity, lock, move/scale; saved in the project,
   never exported.
8. **Auto-trace** — potrace worker with threshold / smoothing / detail sliders and a live
   overlay; result placed on the baseline.
9. **Handwriting sheet** — printable Letter template with ArUco corners; photo or scan in;
   straighten, split, trace, place, default bearings; review grid with accept / retrace /
   redraw.
10. **Nib brush** — pointer capture with pressure, smoothed and fitted skeleton, flat / round /
    pointed nib inking, re-ink on setting change, flatten to outline.
11. **Alternates** — `alt-` collection, tabs UI, calt cycling on export (verified with harfbuzzjs
    and in Word), strip shows cycling, kerning inherited.
12. **Weight slider** — live before/after in the strip, whole font to a new project, selection
    in place, native offset with Clipper fallback and review badges.
13. **Roughen / ink bleed** — roughness, spread, seed with reroll, originals kept, point budget.

## Ship
14. **PWA** — vite-plugin-pwa prompt mode, icons, manifest, update toast, offline verified on
    `vite preview`.
15. **Deploy** — GitHub Pages workflow, install on Brennan's PC from the live URL.
16. **End-to-end check** — sheet to installed font; alternates, kerning, Bold; crash recovery.

## Studio phases after the slice
Phase 5 (robustness and polish) and Phase 6 (senior-engineer audit) run after milestone 13
and again before Gate 2, per the software-studio process.
