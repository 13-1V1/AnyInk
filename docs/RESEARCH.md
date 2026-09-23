# ANY-INK — Research (Phase 1)

Compiled 09/23/2026 from eight code-reading passes over upstream Glyphr Studio 2 v2.10.5
and eight library / prior-art research tracks. Raw per-track results are in the session
scratchpad; this file keeps what the design depends on. Every factual claim below maps to
an entry in [SOURCES](#sources).

## 1. What upstream already gives us (verified by reading the code)

| Need in brief | Upstream status | Where |
|---|---|---|
| Undo / redo | Full: per-item snapshots, whole-project pre/post pairs, redo queue, History panel with jump, persisted to IndexedDB, Ctrl+Z/Y | `src/project_editor/history.js` |
| Undo gaps | Font metrics and all Settings pages write directly, no history; guides panel edits no history; kern tool pushes an entry on plain click | `src/pages/settings.js`, `src/panels/guides.js`, `src/edit_canvas/tools/kern.js` |
| Kerning | Class-based `KernGroup {leftGroup[], rightGroup[], value}`; drag-to-kern tool exists on the Kerning page (drags anywhere, no hit test); value also typed in a number field; group members typed as text | `src/project_data/kern_group.js`, `tools/kern.js`, `src/pages/kerning.js` |
| Metrics | ascent/capHeight/xHeight/descent drawn as guide lines (read-only, orange-brown literals); only left/right side bearings are draggable | `src/edit_canvas/edit_canvas.js drawSystemGuidelines`, `tools/resize.js sideBearingEdit` |
| Preview | Live preview page + pop-out window; `DisplayCanvas` (draws project outlines) and `FontPreview` (builds a real OTF with font-flux-js and renders native text); pop-out subscribes to every editor event | `src/display_canvas/*`, `src/controls/font-preview/*`, `src/project_editor/pop_out_window.js` |
| Files | File System Access API already used to open (picker + drop handle) and to save `.gs2` in place; new projects fall back to download; no remembered folder; font export is download only | `src/app/open_project.js`, `src/project_editor/file_io.js`, `src/formats_io/otf/font_export.js` |
| Autosave | On every history push, whole project JSON into localStorage (5 MB cap, silently disables on quota) | `src/app/app.js addAutoSaveState` |
| GSUB export | Only `liga`; but the bundled font-flux-js 2.9.0 writes GSUB lookup types 1, 2, 3, 4, 5/6 (format 3), 8 with any feature tag | `font_export.js`, `node_modules/font-flux-js` |
| Path offset | Bezier-native offset exists (`Offset path` transform); no cusp/overlap cleanup, not hole-aware | `src/project_data/poly_segment_offset.js` |
| Boolean ops | bezier-boolean unite/subtract on cubic paths | `src/project_editor/boolean_combine.js` |
| Theme | Two hand-synced token sources (`colors.css` and `colors.js`), many literal colors in canvas code and CSS; chrome is light; no dark mode | `src/common/colors.*` |
| PWA | A manifest linked from index.html with an absolute upstream start URL, SVG-only icon, no service worker, and a Google Analytics loader | `src/manifest.json`, `src/app/app.js addTelemetry` |
| Input | Mouse events only; no pointer events, no pressure | `src/edit_canvas/events.js` |

Load-bearing code facts found by the readers:

- `Navigator.navigate()` wipes and rebuilds the whole `#app__wrapper` on every page change. An always-visible preview strip must live outside that element.
- `GlyphrStudioProject` constructor `merge()` copies only string and number leaves: booleans and unknown keys are dropped on load. Any new setting must be added to the template, and boolean settings do not round-trip today.
- Glyph, Path, PathPoint, KernGroup constructors destructure fixed argument lists and `save()` is an allow-list. New per-glyph data must be added explicitly to both.
- Non-Unicode glyph ids (`glyph-a.alt1`) are not tolerated: `validateAsHex` fails, export enumerates only character ranges. Alternates need their own collection and prefix.
- History whole-project undo assigns the snapshot object itself as the live project (aliasing bug); later edits mutate the snapshot.
- `getColorFromRGBA()` fakes alpha by blending toward white and cannot parse `hsl()`. A dark canvas needs real `rgba` or `globalAlpha`.
- Canvas is a fixed 2000x2000 bitmap, not DPR-aware.
- `validate_file_input.js` refuses project files whose version is newer than the running app version. ANY-INK must keep `version` at the upstream number (see D-002).
- Unencoded glyphs on import claim the `.notdef` slot because `isNaN(null)` is false. Must be fixed before an alternates importer exists.
- `Tool_Kern` rounds each mousemove delta to whole units, so small moves at low zoom are lost.

## 2. Track recommendations

### 2.1 Auto-trace
**Use `esm-potrace-wasm` 0.5.1** (Potrace 1.16 in a 76 KB single-file ESM WASM module, run in a module Web Worker) and do all image conditioning ourselves: grayscale, Otsu or a user threshold, optional Bradley-Roth adaptive threshold for photos, 3x3 open/close despeckle, then a pure black/white ImageData. Slider mapping: Threshold = binarization cutoff; Smoothing = `alphamax` 0 to 1.3334; Detail = `turdsize` (scaled by dpi squared) plus `opttolerance`. Output SVG goes through upstream's existing `ioSVG_convertSVGTagsToGlyph`, then `flipNS()` and `reverseWinding()` exactly like upstream's paste handler.
License: the npm field says `GPL-2.0` but the source header and upstream Potrace say "version 2, or (at your option) any later version", which is combinable into a GPL-3 work. Record this in the credits and never vendor a copy that drops that wording.
Rejected: `imagetracerjs` (quadratic splines, wobbly), VTracer (official WASM is Node-only, alpha API, 9x heavier), OpenCV.js.
Strongest objection: single-maintainer prebuilt binary of a frozen algorithm. Mitigation: it is 8 KB of C plus a build script we can rebuild from the Potrace tarball.

### 2.2 Path offset, weight, nib inking
**Add `clipper2-ts`** (Boost license, pure ESM, 34 KB gzip, Worker-safe) as the one polygon engine, plus **`fit-curve`** (MIT, Schneider algorithm, vendored as ESM) to turn polygons back into cubics.
- Weight slider: try upstream's bezier-native `makeOffsetPolySegment` first (structure-preserving). If `findIntersections()` reports self-intersections, flatten the original contours, normalize orientation, `inflatePathsD` with round joins on all contours together (so holes shrink correctly), `simplifyPathD`, then fit-curve. Badge glyphs that took the refit path.
- Nib: sample the skeleton, take the convex hull of the nib polygon placed at consecutive samples (scaled by pressure), union all hulls with NonZero fill, simplify, refit. Flat nib = rotated rectangle, round = 24-gon, pointed = thin ellipse scaled by pressure (pressure from tablet or from stroke direction when absent). One code path covers uniform and pressure strokes.
- bezier-boolean stays for user boolean ops; it is not an offset engine and keeps inverted cusps (verified).
Rejected: paper.js (upstream removed it deliberately), bezier-js (duplicates upstream Segment), Squiggy (no license).
Measured on this PC: 7 to 20 ms per glyph-sized job.

### 2.3 Tablet input and curve fitting
Pointer Events (W3C Level 3, June 2026) on Chrome/Edge Windows read the pen through Windows Ink: `pressure` (1024 steps), `tiltX/Y`, `pointerType`, `getCoalescedEvents()` for the samples between frames. The Wacom driver's "Use Windows Ink" box must be on or the pen reports as a mouse with pressure 0.5.
Pipeline: pointer events with `setPointerCapture` and `touch-action: none` and `preventDefault()` on pointerdown (so upstream's mouse handlers stay quiet) -> 1€ filter per channel (`1eurofilter`, BSD-3, timestamps in seconds) -> `simplify-js` (BSD-2) -> own corner splitter (turning angle over ~65°) -> fit-curve per run (`maxError` is a squared distance) -> map cubics onto PathPoints (`h2` = outgoing, `h1` = incoming; split joints `flat`, corners `corner`). `perfect-freehand` (MIT) only for the live ink preview while the pen is down.

### 2.4 OpenType calt and liga
**font-flux-js does it natively.** A local probe built a font with `addSubstitution({type:'contextual', feature:'calt', backtrack, input, actions})`, round-tripped it, and shaped it in Chrome: `aaaaaa` cycled base/alt1/alt2, `abab` followed the rules, `fi` ligated, and `font-feature-settings` switched each off. The emitted GSUB is one LookupType 6 lookup with ChainedSequenceContextFormat3 subtables plus LookupType 1 helper lookups: the standard Glyphs / OpenType Cookbook "sub @set1 @set1' by @set2" cycling technique.
Rules: alternates are unencoded glyphs named `uniXXXX.altN`; sets[k] = the k-th alternates of every base that has one; add `calt` rules before `liga` so feature records come out alphabetically (font-flux-js writes them in insertion order); the cycle wraps to base automatically. The preview strip and the exporter must derive from one pure `applyCycle()` function.
Verification: `harfbuzzjs` (MIT, dev-only) as a shaping oracle in vitest; Chrome A/B page; Word with Font > Advanced > "Use Contextual Alternates" ticked (Word does not apply calt by default). WordPad is gone on Windows 11 24H2.
Rejected: opentype.js (no calt in its API), fontkit (read-only), fonteditor-core, fontverter.

### 2.5 PWA, File System Access, crash recovery
- **`vite-plugin-pwa` 1.3.0** (MIT, Workbox), `registerType: 'prompt'`, `registerSW({onNeedRefresh})` shows the "Update ready, reload" toast; only a click calls `updateSW()`. Base path moves into `src/vite.config.js` as `/AnyInk/` (must equal the repo name). `globPatterns` must list wasm, woff2, png, json. Raise `maximumFileSizeToCacheInBytes` because the main chunk is over 2 MiB. Remove `src/manifest.json` and the manifest link (plugin injects its own). PNG icons 192, 512, and a 512 maskable are required for Chromium install; SVG-only is not enough.
- **Files:** no library. Extend upstream's raw File System Access code: `id` + `startIn` on every picker, handles persisted with **`idb-keyval`** (Apache-2.0, ~0.5 KB) in a separate `anyink` IndexedDB database, `queryPermission`/`requestPermission` behind a click on relaunch (Chrome 122+ offers "Allow on every visit"; installed PWAs persist automatically), `createWritable({mode:'exclusive'})` for atomic writes, `showDirectoryPicker` for the OTF export folder.
- **Crash recovery:** IndexedDB rolling snapshot keyed by project id, written on a timer while dirty, on glyph switch, and on `visibilitychange` hidden; a session record with a `dirty` flag; a Web Lock held for the tab's life so a crashed session is "dirty and lock not held". Offer restore on launch. Call `navigator.storage.persist()` once.
- **Deploy:** the Vite-documented `actions/deploy-pages` workflow; repo Pages source set to GitHub Actions.
Chromium-only limitation accepted: Firefox and Safari have no pickers; the app targets Chrome/Edge.

### 2.6 Handwriting sheet
**Vendor `js-aruco2`** (MIT, ~43 KB, two files wrapped as ESM) for fiducials and hand-roll the rest (~400 lines, in a Worker): template printed from an HTML page with CSS `@page { size: letter }` and `print-color-adjust: exact`; four ArUco `ARUCO_MIP_36h12` markers (0.5 in) at the corners with id = page*4 + corner; 1.0 in boxes in a 7x8 grid (56 per sheet), light-gray dashed borders and baseline / x-height / cap-height guides derived from the project's real metrics; labels printed below each box so they can never be traced. Capture: downscale to ~1600 px for detection, least-squares DLT homography from all detected marker corners (3 markers enough, 2 with a warning, else manual four-corner drag), inverse-mapping bilinear warp to a 200 dpi sheet, boxes computed arithmetically, per-box 4% inset crop, Bradley-Roth threshold, connected components to drop specks and border remnants, flags for empty / touches-edge / many pieces. One scale for every box (`(ascent - descent) / (0.85 * boxPx)`) so relative heights survive; never normalize per glyph. Default side bearings 8% of x-height, space = 1/4 em.
Rejected: OpenCV.js (11 to 13 MB), image-js, QR codes, PDF libraries (print-to-PDF suffices).

### 2.7 Roughen and ink bleed
In-tree module: flatten each path at `detail` spacing (upstream `Segment` helpers), displace along the normal by coherent 2D noise from **`simplex-noise`** (MIT, pinned) seeded by public-domain `mulberry32(xmur3(seed))` with a per-glyph salt, ink spread via `inflatePathsD` round joins, `unionD` NonZero, `simplifyPathsD`, write back as corner points (Glyphs' approach) or, in smooth mode, symmetric points with Catmull-Rom handles. Never fit-curve jagged output on the main thread (2 to 4 s per 200 glyphs measured). Originals kept as `glyph.roughen.originalShapes`; settings and a ROUGHEN_VERSION stored so re-application is bit-identical. Measured: 200 glyphs in ~200 ms.
Point budget: show a live point count and warn above ~1,000 points per glyph; roughened fonts are display fonts.

### 2.8 Prior art (what to steal, what to avoid)
- **Glyphs**: edit-in-context text tool, Preview Area under the canvas (draggable divider, invert, double-click a glyph to jump), Ctrl+arrow kerning with Shift x10, kern tint colors, `.ss01`/`calt` naming behind visual tabs. Gap: image opacity needs a script. We expose it as a slider.
- **FontLab 8**: lever precision drags (Shift = 1:1), live distance readouts while dragging guides, Thickness tool handles (model for nib width), Rapid tool.
- **Birdfont**: marker between letters you drag to kern, thicker marker for class kerning, backup on every save, auto-trace next to the background image.
- **Fontself**: per-glyph card with draggable baseline and margins (our review grid), Kerning Pad layout, `nnav`/`HHAV` control strings.
- **Calligraphr**: template with 4 corner markers, 300 to 600 dpi grayscale never 1-bit, per-glyph baseline/size touch-up, variants as calt with per-app enable instructions. Complaints: guide lines wrong, spacing paywalled, boxes break cursive.
- **FontForge**: Change Weight semantics (keep cap height, guard serif height, retain counters, remove overlap first, "needs a human eye"), 1-minute autosave applied on restart. Anti-pattern: its UI.
- **Upstream complaints** (GitHub issues #93, #357): metrics lines not visible in the editor, localStorage autosave limits. Both are fixed by this brief.
- **Windows install / kerning failure modes** to guard at export: name table lengths (IDs 1/2 at most 31 chars, ID 6 ASCII no spaces), name/cmap platform consistency, OS/2 fsSelection matching head.macStyle, usWin ascent/descent covering the real extremes, `.notdef` and `space` present, GPOS class kerning plus a legacy `kern` table for TTF (GDI ignores `kern` in CFF), Word needs kerning and calt switched on per document.

## 3. Dependencies to add (all GPL-3 compatible)

| Package | License | Purpose | Size |
|---|---|---|---|
| esm-potrace-wasm 0.5.1 | GPL-2.0-or-later (source header) | auto-trace | 76 KB |
| clipper2-ts 2.0.1-18 (pin exact) | BSL-1.0 | offset, union, nib sweep, roughen spread | 34 KB gz |
| fit-curve (vendor src as ESM) | MIT | polygon to cubic refit, freehand fitting | 5 KB |
| simplify-js (vendor) | BSD-2 | freehand simplification | 1 KB |
| 1eurofilter (or vendor) | BSD-3 | pen smoothing | 2 KB |
| perfect-freehand 1.2.3 (pin) | MIT | live ink preview only | 2 KB gz |
| simplex-noise 4.0.3 (pin) | MIT | roughen noise | 2 KB gz |
| js-aruco2 2.0.0 (vendor 2 files) | MIT | sheet registration marks | 43 KB |
| idb-keyval 6.3 | Apache-2.0 | handles, snapshots, prefs | 0.5 KB |
| vite-plugin-pwa 1.3.0 (dev) | MIT | service worker, manifest | dev only |
| harfbuzzjs (dev) | MIT | GSUB shaping oracle in tests | dev only |

Not added: opentype.js, fontkit, paper.js, bezier-js, OpenCV.js, seedrandom, browser-fs-access, jsPDF.

## 4. Failure modes the design must prevent

1. Trace images or roughen originals inside localStorage autosave or inside every undo snapshot (quota, memory). Keep binary assets outside the undoable project object.
2. Whole-project undo aliasing (upstream bug). Clone on restore.
3. Metric drags publishing `currentItem` per pointermove (panel thrash). Publish a narrow topic per tick, commit history once on pointerup.
4. Alternates given a Unicode value at export (breaks text). Keep them unencoded.
5. Auto-reloading the PWA on update. Prompt only.
6. Tracing a whole 600 dpi Letter scan (135 MB ImageData). Crop per box, cap the long side.
7. Pointer and mouse handlers double-firing. `preventDefault()` on pointerdown for the nib tool only.
8. Export name/OS/2 mistakes that make Windows refuse the font. Sanitize names, compute usWin from real extremes, keep `.notdef` and `space`.
9. `Tool_Kern` and slider previews pushing history per tick. One entry per gesture.
10. Version gate: bumping the upstream version number refuses upstream files. Keep `version` = 2.10.5, use `anyinkVersion` separately.

## SOURCES

Authoritative sources every claim in this document and in the built features is checked against.

**Specs and platform docs**
- OpenType GSUB table: https://learn.microsoft.com/en-us/typography/opentype/spec/gsub
- OpenType Layout common tables (coverage, chained context format 3, feature record sorting): https://learn.microsoft.com/en-us/typography/opentype/spec/chapter2
- OpenType feature registry, calt: https://learn.microsoft.com/en-us/typography/opentype/spec/features_ae#calt ; liga: https://learn.microsoft.com/en-us/typography/opentype/spec/features_ko#liga
- OpenType recommendations (kern vs GPOS, name/cmap consistency): https://learn.microsoft.com/en-us/typography/opentype/spec/recom
- OpenType name table: https://learn.microsoft.com/en-us/typography/opentype/spec/name ; OS/2: https://learn.microsoft.com/en-us/typography/opentype/spec/os2 ; kern: https://learn.microsoft.com/en-us/typography/opentype/spec/kern ; glyf point limit: https://learn.microsoft.com/en-us/typography/opentype/spec/glyf
- AFDKO feature file syntax (the cycling rule shape): https://adobe-type-tools.github.io/afdko/OpenTypeFeatureFileSpecification.html
- Glyphs, contextual alternates cycling: https://glyphsapp.com/learn/features-part-3-advanced-contextual-alternates ; OpenType Cookbook quantum randomization: https://opentypecookbook.com/common-techniques/
- Pointer Events Level 3 (W3C Recommendation 30 June 2026): https://www.w3.org/TR/pointerevents3/
- MDN PointerEvent, getCoalescedEvents, setPointerCapture, touch-action: https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent ; https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents ; https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture ; https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- Chromium pen input on Windows (WM_POINTER, pressure/1024): https://chromium.googlesource.com/chromium/src/+/main/ui/views/win/pen_event_processor.cc ; Windows POINTER_PEN_INFO: https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-pointer_pen_info
- File System Access (Chrome guide, persistent permissions, spec): https://developer.chrome.com/docs/capabilities/web-apis/file-system-access ; https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api ; https://wicg.github.io/file-system-access/ ; MDN showSaveFilePicker, createWritable, requestPermission: https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker ; https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable ; https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission ; caniuse: https://caniuse.com/native-filesystem-api
- Web Locks: https://w3c.github.io/web-locks/ ; Storage persistence and eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria ; Page Lifecycle: https://developer.chrome.com/docs/web-platform/page-lifecycle-api ; visibilitychange: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
- PWA installability (MDN, web.dev, Chrome criteria change): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable ; https://web.dev/articles/install-criteria ; https://developer.chrome.com/blog/update-install-criteria ; manifest: https://web.dev/articles/add-manifest ; maskable icons: https://web.dev/articles/maskable-icon ; custom install prompt: https://web.dev/articles/customize-install ; display_override: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display_override
- Edge PWA on Windows: https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux ; Chromium Windows PWA integration: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/windows_pwa_integration.md
- Vite PWA plugin (prompt update, periodic check, precache globs, static assets, FAQ on 2 MiB limit): https://vite-pwa-org.netlify.app/guide/prompt-for-update.html ; https://vite-pwa-org.netlify.app/guide/periodic-sw-updates.html ; https://vite-pwa-org.netlify.app/guide/service-worker-precache.html ; https://vite-pwa-org.netlify.app/guide/static-assets.html ; https://vite-pwa-org.netlify.app/guide/faq
- Vite static deploy to GitHub Pages: https://vite.dev/guide/static-deploy ; GitHub Pages custom workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages ; Vite workers and WASM: https://vite.dev/guide/features
- CSS @page size, print-color-adjust, window.print: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page/size ; https://developer.mozilla.org/en-US/docs/Web/CSS/print-color-adjust ; https://developer.mozilla.org/en-US/docs/Web/API/Window/print
- Word OpenType features UI (contextual alternates checkbox): https://support.microsoft.com/en-US/Word/font-advanced-settings ; WordPad removed in Windows 11 24H2: https://learn.microsoft.com/en-us/windows/whats-new/removed-features ; CSS font-variant-ligatures: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-ligatures

**Algorithms**
- Potrace home, man page, paper, potracelib: https://potrace.sourceforge.net/ ; https://potrace.sourceforge.net/potrace.1.html ; https://potrace.sourceforge.net/potrace.pdf ; https://potrace.sourceforge.net/potracelib.pdf
- Otsu's method: https://en.wikipedia.org/wiki/Otsu%27s_method ; Bradley and Roth 2007 adaptive threshold: https://people.scs.carleton.ca/~roth/iit-publications-iti/docs/gerh-50002.pdf ; morphological opening: https://en.wikipedia.org/wiki/Opening_(morphology) ; connected-component labeling: https://en.wikipedia.org/wiki/Connected-component_labeling
- Direct linear transformation and homography: https://en.wikipedia.org/wiki/Direct_linear_transformation ; https://en.wikipedia.org/wiki/Homography_(computer_vision) ; Heckbert 1989 warping: https://www2.eecs.berkeley.edu/Pubs/TechRpts/1989/CSD-89-516.pdf
- ArUco (Garrido-Jurado et al.): https://www.uco.es/investiga/grupos/ava/portfolio/aruco/
- Clipper2 docs (InflatePaths, ClipperOffset, JoinType, EndType, ArcTolerance, MinkowskiSum, SimplifyPaths): https://www.angusj.com/clipper2/Docs/Units/Clipper/Functions/InflatePaths.htm ; https://www.angusj.com/clipper2/Docs/Units/Clipper.Offset/Classes/ClipperOffset/_Body.htm ; https://www.angusj.com/clipper2/Docs/Units/Clipper/Types/JoinType.htm ; https://www.angusj.com/clipper2/Docs/Units/Clipper/Types/EndType.htm ; https://www.angusj.com/clipper2/Docs/Units/Clipper.Offset/Classes/ClipperOffset/Properties/ArcTolerance.htm ; https://www.angusj.com/clipper2/Docs/Units/Clipper/Functions/MinkowskiSum.htm ; https://www.angusj.com/clipper2/Docs/Units/Clipper/Functions/SimplifyPaths.htm
- Schneider curve fitting (Graphics Gems FitCurves.c): https://github.com/erich666/GraphicsGems/blob/master/gems/FitCurves.c ; Graphics Gems license: https://github.com/erich666/GraphicsGems/blob/master/LICENSE.md ; Paper.js PathFitter (closed-path handling): https://github.com/paperjs/paper.js/blob/develop/src/path/PathFitter.js
- Bezier offsetting primer: https://pomax.github.io/bezierinfo/#offsetting
- 1€ filter (Casiez): https://gery.casiez.net/1euro/
- FontForge Expand Stroke reference and splinestroke.c: https://fontforge.org/docs/techref/stroke.html ; https://github.com/fontforge/fontforge/blob/master/fontforge/splinestroke.c ; FontForge Change Weight: https://fontforge.org/docs/ui/dialogs/Styles.html ; FontForge autotrace: https://fontforge.org/docs/techref/autotrace.html
- PRNGs (mulberry32, sfc32, xmur3, public domain): https://github.com/bryc/code/blob/master/jshash/PRNGs.md
- Glyphs Roughen filter: https://handbook.glyphsapp.com/filters/roughen/ ; Illustrator Roughen: https://helpx.adobe.com/illustrator/using/reshaping-objects-effects.html ; Inkscape Jitter Nodes: http://tavmjong.free.fr/INKSCAPE/MANUAL/html/Extensions-ModifyPath.html

**Libraries**
- esm-potrace-wasm: https://github.com/tomayac/esm-potrace-wasm (license header in src/potrace.js; wrapper C in wasm/potrace.c; build.sh) ; SVGcode worker pattern: https://github.com/tomayac/SVGcode
- clipper2-ts: https://github.com/countertype/clipper2-ts (README, CHANGELOG, issue #2) ; Clipper2 releases: https://github.com/AngusJohnson/Clipper2/releases ; Clipper2-WASM fallback: https://github.com/ErikSom/Clipper2-WASM
- fit-curve: https://github.com/soswow/fit-curve ; simplify-js: https://mourner.github.io/simplify-js/ ; 1eurofilter npm: https://www.npmjs.com/package/1eurofilter ; perfect-freehand: https://github.com/steveruizok/perfect-freehand ; simplex-noise: https://github.com/jwagner/simplex-noise.js ; js-aruco2: https://github.com/damianofalcioni/js-aruco2 ; idb-keyval: https://github.com/jakearchibald/idb-keyval ; vite-plugin-pwa: https://github.com/vite-pwa/vite-plugin-pwa ; harfbuzzjs: https://github.com/harfbuzz/harfbuzzjs
- font-flux-js (repo, substitutions doc, GSUB doc): https://github.com/mattlag/Font-Flux-JS ; https://raw.githubusercontent.com/mattlag/Font-Flux-JS/main/docs/creating-substitutions.md ; https://www.glyphrstudio.com/fontfluxjs/docs/tables/GSUB.html
- bezier-boolean: https://github.com/mattlag/bezier-boolean
- GNU GPL compatibility FAQ and license list: https://www.gnu.org/licenses/gpl-faq.html#AllCompatibility ; https://www.gnu.org/licenses/license-list.html

**Prior art**
- Glyphs handbook (kerning, spacing, previewing, edit view, stylistic sets, offset curve): https://handbook.glyphsapp.com/kerning/ ; https://handbook.glyphsapp.com/spacing/ ; https://handbook.glyphsapp.com/previewing-and-testing/ ; https://handbook.glyphsapp.com/edit-view/ ; https://glyphsapp.com/learn/stylistic-sets ; https://handbook.glyphsapp.com/filters/offset-curve/
- LucasFonts Moveable Sidebearings: https://github.com/LucasFonts/Glyphs-MoveableSidebearings
- FontLab 8 metrics and kerning, precision, thickness tool: https://help.fontlab.com/fontlab/8/whats-new/whats-new-06-metrics-kerning/ ; https://help.fontlab.com/fontlab/8/whats-new/whats-new-04-consistency-precision/
- Birdfont kerning and backups: https://birdfont.org/doku/doku.php/kerning ; https://birdfont.org/doku/doku.php/backups
- Fontself kerning and spacing: https://help.fontself.com/en/articles/981232-kerning ; https://help.fontself.com/en/articles/3722881-spacing-and-kerning-for-beginners
- Calligraphr FAQ and tutorial: https://www.calligraphr.com/en/docs/faq/ ; https://www.calligraphr.com/en/docs/tutorial1/
- FontCrafter (in-browser sheet to font): https://arcade.pirillo.com/fontcrafter.html ; Handwright: https://github.com/williamzujkowski/handwright
- Inkscape trace bitmap and pencil tool: https://inkscape-manuals.readthedocs.io/en/latest/tracing-an-image.html ; https://inkscape-manuals.readthedocs.io/en/latest/pencil-tool.html ; PowerStroke: https://wiki.inkscape.org/wiki/PowerStroke
- Upstream issues: https://github.com/glyphr-studio/Glyphr-Studio-2/issues ; upstream updates page: https://www.glyphrstudio.com/help/about/updates.html
- Windows font install and name-length failure modes: https://forum.glyphsapp.com/t/not-a-valid-font-file/2891 ; https://forum.glyphsapp.com/t/no-kerning-in-office/3205 ; https://typedrawers.com/discussion/3543/long-font-names ; https://github.com/fonttools/fontbakery/issues/2179 ; TypeDrawers grunge thread: https://typedrawers.com/discussion/3724/grunge-effect
