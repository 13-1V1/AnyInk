# ANY-INK — Design document

Single source of truth for what the studio builds. Written 09/23/2026 after the research
phase. Decisions referenced as D-nnn live in [DECISIONS.md](DECISIONS.md).

## 1. Purpose

Brennan draws, spaces, and exports his own fonts by clicking, dragging, and looking.
ANY-INK is Glyphr Studio 2 with a dark minimal skin, an ink-on-paper canvas, draggable
metrics and kerning, an always-on preview strip, real file handling, and six creative
tools: trace layer, auto-trace, handwriting sheet, nib brush, weight slider, alternates,
and roughen. It installs as a PWA and runs offline.

## 2. The user's journey

**Since B16 (10/16/2026) the journey is `docs/UX-BEGINNER.md`.** ANY-INK opens in Simple mode, and
UX-BEGINNER section 3 (the first-time journey, minute by minute) and section 4 (every screen) are the
source of truth: the start screen, the letter board, photos to letters, the Brush, Try it with its gap
handle, Use in Word, crash recovery, and the Next line that names one step at a time. Section 9 is the
acceptance test (`tests/beginner.verify.mjs` runs its automated part; `docs/GATE2.md` is Brennan's own
session).

The journey below is the **All tools** one (More tools, or `?ui=all`): the original Glyphr Studio
screens with the M4 to M8 additions, kept for pro work.

1. **Launch** with `?ui=all`, or turn on More tools. If the last session ended unclean, a card offers
   "Recover unsaved work". Otherwise: New project, Open (file picker starting in the last
   folder), Reopen recent, or Examples.
2. **Draw** on a white canvas with dark outlines. Green marks what is being touched:
   selected points, the active tool, the current glyph tile. Purple marks structure:
   handles, guide lines, metrics lines, kern indicators. A one-click toggle turns the
   canvas dark; the choice is remembered.
3. **Space and size**: drag the purple ascender / cap / x-height / descender lines; the
   preview strip at the bottom re-flows as they move. Drag side bearings on the canvas
   (with Resize or Path edit; a drawing tool's press is always the tool's, B16).
4. **Kern**: on the Kerning page, a live pair view shows the pair inside real words; drag
   the right letter. Arrow keys nudge. The strip updates.
5. **Creative tools** (each its own page or panel): drop a photo to trace over it; auto-trace
   it with three sliders; draw with the Brush (B / N). Still to come (M9 to M13): the
   handwriting sheet, more nibs, a Bold with the weight slider, alternates, roughen.
6. **Save** goes straight to the open file (autosave every few seconds while dirty and on
   every glyph switch). **Export OTF** writes into a folder picked once and remembered.
7. **Update**: when a new version is deployed, a small "Update ready, reload" toast appears.
   Nothing reloads by itself.

## 3. Architecture

Upstream systems stay where they are and are reskinned. New code lives under
`src/anyink/`, one folder per job, each with a test page under `tests/` and unit tests
beside it. Modules talk to upstream through its public functions (`getCurrentProjectEditor`,
`editor.publish`, `editor.history.addState`, `ioSVG_convertSVGTagsToGlyph`).

```
src/anyink/
  theme/        tokens.css (ALL colors, chrome + canvas blocks), theme.js (token() getter for canvas code, canvas toggle)
  prefs/        app-level preferences (dark canvas, sample text, recent handles) in localStorage + idb-keyval
  metrics/      draggable metric lines: hit test, drag branch, settings history entry, 'fontMetrics' topic
  kerning/      pair view on the Kerning page: hit-tested drag, word context, tile pickers
  preview/      <preview-strip> element outside #app__wrapper, points slider, text, metrics lines, alt cycling
  files/        open / save / save-as / export-to-folder on File System Access, handle store, recents
  recovery/     dirty flag, timer + glyph-switch snapshots to IndexedDB, Web Lock, restore card
  assets/       binary assets (trace images) kept beside the project, embedded on save
  trace/        trace layer: image per glyph, opacity, lock, move/scale handles
  autotrace/    params, binarize (Otsu, Bradley-Roth, despeckle), potrace worker + client, svg_to_shapes,
                trace_region, facade (autotrace.js, also the M9 sheet's entry), session, preview, apply, card
  sheet/        template page, ArUco detection (vendored js-aruco2), homography, warp worker, box split, review grid
  nib/          pointer capture, 1€ filter, simplify, corner split, fit-curve, nib inking (clipper2-ts), flatten
  geometry/     shared: flatten path, refit (fit-curve), clipper helpers, extrema insertion
  weight/       weight slider: native offset fast path, Clipper fallback, before/after, new project or in place
  alternates/   'alt-' collection, tabs UI, applyCycle(), export rules (calt), kerning inheritance
  roughen/      prng.js, roughen.js (simplex-noise + clipper2-ts), originals kept, seed / reroll
  pwa/          registerSW prompt, install menu item, update toast
```

Upstream files we modify (header added, notices kept): `index.html` (strip mount, theme
link), `navigator.js` (strip stays), `edit_canvas.js` (trace pass, nib pass, metric handles,
tokens), `tools/resize.js` (metric drag branch), `tools/kern.js` (hit test), `history.js`
(settings entry kind, clone on restore, dirty hook), `pub_sub.js` (new topics),
`glyphr_studio_project.js` and `glyph.js` (new fields, boolean merge fix), `font_export.js`
(alternates + calt, folder export), `text_block.js` (cycle), `file_io.js`, `open_project.js`,
`menu.js`, `settings*.js` (readouts), `guides.js`, `colors.css` / `colors.js` (become aliases
of the token file, then deleted), the CSS files (tokens).

## 4. Data model

The project file stays `.gs2` JSON, version `2.10.5` semantics (D-002). Additions are
tolerated by upstream (dropped on its re-save) and defaulted by ANY-INK when absent.

```
settings.anyink = {
  formatVersion: 1,
  canvasTheme: 'light' | 'dark'      // also mirrored in app prefs; project value wins when opened
  previewText, previewPt,
  nibDefaults: { shape, width, thickness, angle, pressure },
  roughenDefaults: { size, detail, spread, seed },
  sheet: { templateVersion, pages: [{ id, homography, threshold, speck, overrides }] },
  spacing: { extra }                  // B3: letter-spacing slider, whole font units, -G..+G
  // keys the template doesn't know yet (B9's photos[assetId]) are kept as loaded
}
glyphs[id].anyink = {                 // only emitted when non-empty (Glyph.save allow-list extended)
  nib:     { strokes: [{ points: [{x, y, pressure}], cap }], settings: {...} }
  roughen: { originalShapes: [shapeSave...], settings: { seed, size, detail, spread, smooth, version } }
  trace:   { asset: 'img-…', width, height, x, y, scale, opacity, visible, locked, invert }
           // M7 (D-028): px size of the stored image; x, y = top-left corner in font units
           // (y-up); scale = font units per image pixel; opacity 0.05 to 1
  altOf:   'glyph-0x61'  (on alternates)   /  alternates: ['alt-0x61-1', ...] (on bases)
  spacing: 'auto' | 'manual'          // B3: who owns the spacing; absent means 'manual'
  spacingExtra: { left, right }       // B3: the share of the letter-spacing extra each side holds
  spacingSlant: 20                    // B3: the font's slant (whole degrees) it was fitted with; absent when 0
}
alternates = { 'alt-0x61-1': GlyphSave, ... }   // new top-level collection, mirrors 'ligatures' code paths
assets   = { 'img-…': { type: 'image/png', data: base64 } }   // written on save only (D-011)
```

Binary assets live on the ProjectEditor (Blobs), not inside `GlyphrStudioProject`, so undo
snapshots and history persistence never copy images. Crash snapshots store them as Blobs.

History gains a lightweight `settings` entry kind (clone of `settings.font` + guides) for
metric and guide drags, and whole-project restores clone instead of aliasing (D-018).

## 5. Correctness strategy

- **Tests that run the real thing.** Vitest keeps upstream's 613 tests green. Each new
  module gets unit tests (pure functions: binarize, homography, cycle rules, roughen
  determinism, offset fallbacks, fitting) and an export round-trip test (export with
  font-flux-js, reopen, assert GSUB / GPOS content; harfbuzzjs shapes `aaa` to
  base/alt1/alt2).
- **Test pages in `tests/`** load one module on a bare page (Vite config rooted at the repo,
  never in the production build).
- **Fact check** every user-visible claim (help text, export notes such as "turn on
  Contextual Alternates in Word") against SOURCES; log in FACTCHECK_LOG.md.
- **Verification in the real world**: exported OTF installed on Windows, typed in Word and
  Chrome; PWA installed from GitHub Pages; tab killed mid-edit and recovered.

## 6. Interaction model

- Dark chrome, white canvas by default, dark canvas on toggle.
- Green `#16A34A` for touch: selection, active tool, primary buttons, current glyph. Purple
  `#7C3AED` for structure: handles, guides, metrics, kern marks. Where a hue fails contrast
  on a surface, the token file holds a lighter or darker shade of the same hue (checked on
  white canvas, dark canvas, dark chrome).
- Every drag: publish a narrow topic per tick, one history entry on release, Shift snaps to
  10, arrow keys nudge 1 (Shift 10). Live readouts next to the thing being dragged.
- Keyboard shortcuts stay upstream's plus: Ctrl+O open, Ctrl+Shift+S save as, Ctrl+E export.
- Pen tablets: Pointer Events for the nib tool with pressure and coalesced samples; the rest of
  the app keeps mouse events (D-014).
- Units: font units for coordinates, points for preview size, inches on the printable sheet.

## 7. Non-goals

Variable fonts, color fonts, poster mockups, collaboration, cloud sync, plugins, Firefox or
Safari support, mobile layouts, renaming upstream identifiers, re-documenting upstream's
editor features, accounts, telemetry.

## 8. Rules for new modules (from the completeness critique)

- Pub/sub subscriber ids are `anyink.<module>` and never a substring of another id (upstream's
  `unsubscribe` matches substrings).
- Images are decoded with `createImageBitmap(file, { imageOrientation: 'from-image' })`, limited to
  PNG / JPEG / WebP, size-capped, and cached as `ImageBitmap` per stored asset Blob (D-023; M7's
  `src/anyink/trace/bitmap_cache.js`, so glyphs that share an image share one bitmap). The cache
  keeps the 4 most recently drawn bitmaps and closes the rest, so memory stays flat across a
  whole alphabet of traces.
- A press on the edit canvas takes the keyboard back from panel controls
  (`src/anyink/controls/focus_release.js`); a new panel control never has to hand focus back itself.
- Every tracer hands SVG to `ioSVG_convertSVGTagsToGlyph` with the transform intact, then maps
  image pixels to font units with one affine y-flip (`fontY = y - py * scale`); no
  `reverseWinding()` (D-024 amended 09/24/2026, D-029).
- `calculateKernOffset` gets a lookup map and a deterministic priority (one-by-one groups win).
- Any picker or permission request runs synchronously inside the click handler, before async
  work (transient user activation).
- New settings keys go under `settings.anyink` in the constructor template; `merge()` is fixed to
  copy booleans (with a test) before the first fork boolean is stored.
- A toolchain spike (module worker, inlined WASM, clipper2-ts, PWA plugin under `root: src/`) runs
  as the first task of M6 and is logged in TEST_LOG.md.
- Unmapped upstream areas (`src/common`, `src/lib`, `cross_item_actions.js`, `quality_checks.js`,
  `boolean_combine.js`, the page files) are read when a milestone first touches them.

## 9. Risks carried into the build

1. Preview strip performance while dragging: use the canvas renderer per tick, the OTF
   renderer only on release.
2. Refit changes point structure on the Clipper fallback path (weight, nib, roughen): badge
   such glyphs and keep originals.
3. Single-maintainer libraries (font-flux-js, clipper2-ts, esm-potrace-wasm): pin versions,
   keep each behind one small module, keep the break-glass notes from research.
4. GitHub Pages base path must equal the repo name exactly.
