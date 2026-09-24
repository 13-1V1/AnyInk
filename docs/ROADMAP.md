# ANY-INK — Roadmap

Milestones follow the brief. Each ends in a verified working state, a commit, and a
status line in CLAUDE.md. Definition of done is one line each.

## Done
1. **Fork and run** — v2.10.5 builds, 613 tests pass, runs unchanged. (09/23/2026)
2. **Rename** — no visible Glyphr branding except credits and license. (09/23/2026)
3. **Visual audit** — every text/code entry point listed and mapped in AUDIT-VISUAL.md. (09/23/2026)
4. **Reskin** — token legibility study fixed the shades; one token file drives every color;
   dark chrome; white canvas with a remembered dark toggle; `getColorFromRGBA` replaced by real
   alpha; number-only fields from the audit are readouts or hidden. Zero color literals outside
   `tokens.css`; contrast check passed. (09/23/2026)
5. **Visual editing** — history fixes with unit tests (clone on whole-project restore,
   `settings` entry kind, pre-states for item creation, kern click spam); always-active guides
   layer for metric lines; hit-tested drag kerning in a live pair view with kern lookup
   priority; tile-based kern groups; always-visible preview strip with a points slider; sliders
   for transforms and global actions. Every M5 audit row is visual and undoable and the strip
   reflows on every drag. (09/23/2026)
6. **Files** — toolchain spike logged in TEST_LOG; `merge()` boolean fix; Open / Save / Save As
   on File System Access with remembered handles, recents and a picker that starts in the last
   folder; automatic writes to the open file every 3 s while dirty and on glyph switch;
   independent IndexedDB snapshots scheduled within 3 s even while edits keep coming,
   on glyph switch and on tab hide, one record and one Web Lock per live editor session,
   and a Recover card on the Open Project page (D-026); OTF/TTF/WOFF/WOFF2 export into a picked
   folder, settled before the build, with a Replace / Keep both / Cancel dialog for files ANY-INK
   did not write (D-027); `settings.anyink` block and the asset store. Save status distinguishes
   file writes from recovery copies. The 3 s target is a scheduling bound, not a guarantee
   during suspended execution or failed/slow storage. Native picker, interactive install and
   final user acceptance are tracked separately. (09/23/2026; corrected 09/24/2026)
7. **Trace layer** — a photo or scan per glyph, ligature, or component (`item.anyink.trace`,
   pixels in the asset store) added by drop, paste, or picker (PNG / JPEG / WebP, EXIF upright,
   long side capped at 2000 px); a Trace panel with an opacity slider, show, invert, lock, and fit
   to em / cap height; move and resize on the canvas with the Resize tool while the panel is open
   (corner handles win over metric lines; shapes win over the image body), every other tool draws
   over it; every change one undo entry; saved in the `.gs2` (only images a trace uses), kept whole
   in crash snapshots, carried along by cross-project copies, never in an exported font (D-028).
   (09/24/2026; critic, fix and finalize passes 09/24/2026)
8. **Auto-trace** — an Auto-trace card in the Trace panel turns the glyph's trace image into
   editable outlines: potrace (esm-potrace-wasm 0.5.1) in a module worker, our own binarize
   (Otsu, Photo mode for uneven light, despeckle), Threshold / Smoothing / Detail sliders with
   Auto, a live dashed preview over the image while sliding (1000 px copy, 120 ms debounce,
   latest wins), Replace or Add at full resolution as one undo entry, whole shapes kept when
   they reach past the glyph box, holes kept under nonzero on the canvas and in the OTF; the
   facade `autoTraceImageData` is ready for the M9 sheet (D-029). (09/24/2026)

## The vertical slice (milestones 4 to 6) — complete 09/23/2026
One complete path: open or create a project on a themed canvas, draw a glyph, drag its
metrics and kerning while the strip updates, save to a real file, export an OTF to a folder,
and recover after a crash. Delivered; the details sit under Done above.

## Creative features (each: module, test page, unit tests, undo, format fields)
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
