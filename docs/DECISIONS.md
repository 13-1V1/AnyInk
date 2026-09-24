# ANY-INK — Decisions log

Every significant decision, with the options considered and the strongest objection.
Newest at the bottom.

## D-001: Keep upstream's internal identifiers; rename only what a user sees
**Decided:** 09/23/2026
**Argued by:** Producer (rename everything for a clean brand) vs. Architect (rename only visible text)
**Options considered:** full rename of classes/functions/keys | visible strings only
**Chose:** visible strings only. `GlyphrStudioApp`, `GlyphrStudioProject`, `getGlyphrStudioApp`,
the `GlyphrStudio` localStorage key, and project-file keys keep their upstream names.
**Because:** the brief says "no visible Glyphr branding" and "keep upstream as a remote so fixes
merge cleanly". Renaming identifiers would touch hundreds of lines and make every upstream merge a
conflict, for no user-visible gain.
**Strongest objection:** code readers see "Glyphr" everywhere. Mitigated by the CLAUDE.md note.
**Revisit if:** upstream goes dormant and merges stop mattering.

## D-002: Keep the upstream version number for file compatibility; add `anyinkVersion`
**Decided:** 09/23/2026
**Argued by:** Architect (compatibility) vs. Producer (a fresh 0.1.0 everywhere)
**Options considered:** replace `version` with ANY-INK's own | keep both
**Chose:** `app_config.json` keeps `version` = upstream Glyphr Studio version (2.10.5) and gains
`anyinkVersion` (0.1.0). The About page shows both.
**Because:** project files record the app version that saved them and the loader refuses files from
a "future" version. A fresh 0.1.0 would refuse every existing `.gs2` file saved by upstream.
**Strongest objection:** two version numbers can confuse. Mitigated by showing "Built on Glyphr
Studio 2.10.5" only on About.
**Revisit if:** the project file format diverges enough that upstream files need a migration step anyway.

## D-003: Where the Glyphr Studio credit lives
**Decided:** 09/23/2026
**Options considered:** credit on every page | About page only | About + one line on landing/Help
**Chose:** About page has Credits and License tabs (full credit, upstream links, library list).
The landing page has one sentence ("Built on Glyphr Studio v2 ... under the GPL"). The Help page
keeps one link to the upstream help site because those articles still document the shared editor.
Donation buttons, socials, blog links, the "family of products" tab, and the support email are removed.
**Because:** the brief wants no Glyphr branding except credits and license, and a GPL fork owes
clear attribution. One line on landing and one link in Help is attribution, not branding.
**Strongest objection:** purists would remove the Help link too. Kept because Brennan benefits
from upstream's docs for pen/pointer/component features that ANY-INK does not re-document.

## D-004: Do not track `dist/`; use LF line endings everywhere
**Decided:** 09/23/2026
**Chose:** `dist/` is ignored (GitHub Pages will build it). `.gitattributes` forces LF and marks
binaries; `core.autocrlf` is off for this repo.
**Because:** upstream commits `dist/`, which adds 4 MB of churn per commit and guarantees merge
conflicts. The original Windows checkout was CRLF, which broke every multi-line edit until normalized.
**Strongest objection:** merging upstream will show `dist/` as modify/delete conflicts. Resolve with
`git rm -r dist` each time.

## D-005: Project file name is just the project name
**Decided:** 09/23/2026
**Chose:** Save suggests `MyFont.gs2` instead of `MyFont - Glyphr Studio Project.gs2`. Backups
still append a date stamp. The `.gs2` extension stays so upstream files open unchanged.
**Because:** shorter, and the extension already identifies the file type.

## D-006: One token file, read by CSS and by canvas code
**Decided:** 09/23/2026
**Argued by:** Designer (two files: chrome and canvas) vs. Architect (one file per the brief)
**Options considered:** keep colors.css + colors.js | two theme files | one `tokens.css` with a chrome block and two canvas blocks, plus a `theme.js` getter
**Chose:** `src/anyink/theme/tokens.css` holds every color: chrome tokens on `:root`, canvas tokens
under `:root[data-canvas="light"]` and `:root[data-canvas="dark"]`. Canvas drawing code reads tokens
at draw time through `theme.js` (`token('--canvas-guide')` = computed style, cached, invalidated on
toggle). `colors.css` becomes aliases during migration and is deleted at the end of M4; `colors.js`
keeps only the color math.
**Because:** the brief says one file and no literals in components. Canvas code needs strings, so a
getter is the bridge; reading computed style at draw time is what makes the dark toggle repaint.
**Strongest objection:** module-level color constants in upstream canvas files must become calls.
Accepted; it is a mechanical pass.

## D-007: App-level preferences are separate from project settings
**Decided:** 09/23/2026
**Chose:** a `src/anyink/prefs` module with its own `anyink-prefs` localStorage key (dark canvas,
preview text and size, last-used picker ids) and an `anyink` IndexedDB database via idb-keyval for
file handles, recents, and crash snapshots. Upstream's per-project `settings.app` is untouched.
**Because:** upstream stores every "app" preference inside the project file, so the canvas theme
would flip when switching projects. The brief wants the theme remembered between sessions.

## D-008: Draggable metrics are an always-active guides layer, undo via a settings snapshot
**Decided:** 09/23/2026 (amended after the completeness critique)
**Options considered:** new dedicated tool | branch in `Tool_Resize` next to side-bearing drag | always-active guide layer checked before any tool
**Chose:** a guides layer consulted in `handleMouseEvents` before the active tool gets the event:
`isMetricLineHere` (pixel tolerance divided by zoom) on mousedown captures the drag for ascender,
cap height, x-height, descender, baseline, custom guides, and the two side bearings. It draws hover
and drag states in `drawSystemGuidelines`, writes `project.settings.font.*`, publishes a new
`fontMetrics` topic per tick, and pushes one history entry of a new kind `settings` (clone of
`settings.font` and `settings.app.guides`) on release. The same layer is enabled on the kern canvas
(upstream has `drawSystemGuidelines` commented out there).
**Because:** metrics should be draggable with any tool active, the side-bearing drag proves the
pattern, and a per-drag whole-project snapshot would serialize the whole font to IndexedDB on
every release.
**Strongest objection:** a guide hit zone can steal a click meant for a point lying on the line.
Mitigated by giving points and handles priority when the pen tool is active and the pointer is
within a point's hit radius.

## D-009: Baseline drag shifts every outline; other lines clamp to keep order
**Decided:** 09/23/2026
**Chose:** dragging the baseline moves all glyph outlines by the delta (ascent and descent adjusted so
the top and bottom stay put), recorded as a whole-project change. Ascender, cap height, x-height,
descender clamp so that descent < 0 < x-height <= cap height <= ascent.
**Amended 09/23/2026 (built):** the baseline drag shifts ascent, descent, cap height, and x-height
by the same delta (`BASELINE_SHIFTED_KEYS` in `src/anyink/metrics/metrics_math.js`) so every line
stays on the letters; custom guides keep their em location; component instances are not moved
(their source glyph moves). During the drag only the line and a ghost of the current glyph move;
the shift is applied once on release.
**Because:** the brief lists the baseline as draggable, and in font units the baseline is y = 0, so the
only meaningful drag is "move the drawing relative to the baseline".

## D-010: Kerning pair view on the Kerning page, built on KernGroup
**Decided:** 09/23/2026
**Options considered:** merge a text line into the glyph edit canvas (Glyphs model) | a live pair/word view on the Kerning page + the preview strip
**Chose:** the Kerning page canvas gets a hit-tested drag on the right group's glyphs, a sample word
drawn on either side, a purple gap tint (darker for negative), Shift snaps to 10, arrows nudge. Group
membership is picked from glyph tiles into chips. A pair not in any group creates a one-by-one
KernGroup on first drag. Data model unchanged.
**Because:** re-plumbing the single-glyph canvas into a multi-glyph text canvas is the biggest
regression risk in the fork; the pair view delivers the brief's "drag the right letter" without it.
**Also:** the pair view edits the group the renderer actually uses. `calculateKernOffset` gets a
deterministic priority (one-by-one groups win over class groups) and a lookup map rebuilt when
kerning changes, so the strip and the pair view can never disagree. Alt-drag creates an exception
group for the pair. History is pushed only when a drag changed the value.
**Strongest objection:** Glyphs' in-context editing feels better. Revisit after user testing.

## D-011: Preview strip renders with the canvas engine; OTF flavor on demand
**Decided:** 09/23/2026
**Chose:** a `<preview-strip>` element mounted in `index.html` next to `#app__wrapper` (so navigation
rebuilds cannot destroy it), a bottom grid row, `DisplayCanvas` per tick, subscribed to item, kern,
metrics, and alternates topics; a toggle switches to `FontPreview` (real OTF via font-flux-js,
rebuilt on release only) to prove export behavior including calt cycling. Size slider in points
(stored px = pt * 96 / 72), editable text, presets, double-click a glyph to jump to it.
**Because:** the OTF renderer rebuilds a whole font per change and cannot run per pointermove.
**Amended 09/23/2026 (built):** `<preview-strip>` is a light-DOM element fixed to the window bottom
(150 px); `<html>` carries `--anyink-strip-height` (0px hidden, 150px shown) and `#app__wrapper`
subtracts it. `DisplayCanvas` gained `hi-dpi` and `show-metric-lines` attributes. Sample text and
size live in app prefs (`previewText`, `previewPt`, `previewRealFont`, `previewMetrics`). Real-font
mode rebuilds at most every 400 ms.

## D-012: Files on the raw File System Access API with idb-keyval; binary assets beside the project
**Decided:** 09/23/2026
**Chose:** extend upstream's file code (no library), pickers with `id` and `startIn`, handles in
IndexedDB, permission re-request behind a click, exclusive writables, directory handle for OTF export.
Trace images are Blobs on the editor, referenced by id from glyphs, embedded as base64 only in the
saved `.gs2` and stored as Blobs in crash snapshots.
**Because:** upstream already does the hard part; images inside the undoable project object would be
copied into every history snapshot and blow the storage quota (a documented upstream failure).

## D-013: Alternates are a new top-level collection with the `alt-` prefix
**Decided:** 09/23/2026
**Options considered:** entries in `ligatures` with a feature tag | a new `alternates` collection
**Chose:** `alternates['alt-<hex>-<n>']` mirroring the ligature code paths (getItem, addItemByType,
forEachItem, save, hydrate, history page branch, chooser). Export as unencoded `uniXXXX.altN` glyphs
with calt chaining rules from font-flux-js; the strip and the exporter share one `applyCycle()`.
Kerning is inherited by expanding class members to alternate names at export.
**Because:** non-hex ids break upstream's lookup and export enumeration, and ligatures carry `liga`
semantics that alternates must not have.

## D-014: Pointer events only for the nib tool; mouse events elsewhere
**Decided:** 09/23/2026
**Chose:** the nib brush registers pointer listeners, calls `preventDefault()` on pointerdown, uses
`setPointerCapture`, `touch-action: none`, and `getCoalescedEvents`. All other tools keep upstream's
mouse events.
**Because:** converting the whole canvas would touch every tool's assumptions about `event.button`
and risk double dispatch; only the nib needs pressure.

## D-015: Geometry stack: upstream offset first, clipper2-ts fallback, fit-curve refit
**Decided:** 09/23/2026
**Chose:** one new polygon engine (clipper2-ts, Boost license, pinned) and fit-curve (vendored).
Weight: native offset when it does not self-intersect, else flatten, inflate all contours together,
simplify, refit, badge. Nib: hull sweep + union + refit. Roughen: flatten, noise displace, inflate,
union, simplify, corner points. bezier-boolean stays for user boolean ops.
**Because:** measured 7 to 20 ms per glyph; no maintained JS library does structure-preserving
Bezier offsetting; upstream removed paper.js on purpose.
**Strongest objection:** refit loses the designer's point structure. Mitigated by keeping originals,
badging refit glyphs, and never re-offsetting a refit result.

## D-016: Auto-trace on esm-potrace-wasm with our own binarization
**Decided:** 09/23/2026
**Chose:** potrace WASM in a module worker; Otsu default threshold, Bradley-Roth adaptive mode,
open/close despeckle; sliders map to alphamax, turdsize (dpi-scaled), opttolerance. Credit Potrace
(Peter Selinger, GPL-2.0-or-later) on the About page.
**Because:** Potrace is what Inkscape and FontForge use and produces the fewest nodes on type.

## D-017: Handwriting sheet uses ArUco markers and no OpenCV
**Decided:** 09/23/2026
**Chose:** vendored js-aruco2 (MIT), least-squares homography, CPU warp in a worker, arithmetic box
split, one scale per sheet, defaults 8% x-height bearings and 1/4 em space; manual four-corner drag
fallback when fewer than two markers are found.
**Because:** OpenCV.js is 11 to 13 MB for four functions that fit in 400 lines.

## D-018: History fixes: clone on whole-project restore, settings entry kind, dirty hook
**Decided:** 09/23/2026
**Chose:** `restoreState`/`redoState` construct a new project from the snapshot's save; add a
`settings` entry kind; `History.addState` calls the recovery module's `markDirty()`.
**Because:** the aliasing bug makes the next undo a no-op after a redo; metrics need cheap undo;
one choke point covers every future edit.

## D-019: Test pages live in `tests/` with their own Vite root
**Decided:** 09/23/2026
**Chose:** `tests/` at the repo root with `tests/vite.config.js` (root = repo, so pages import
`../src/...`). Production builds keep Vite rooted at `src/`, so `tests/` can never ship.

## D-020: PWA via vite-plugin-pwa in prompt mode; base path equals the repo name
**Decided:** 09/23/2026
**Chose:** `base: '/AnyInk/'` in `src/vite.config.js`, generateSW with explicit glob patterns, raised
precache size limit, PNG icons 192 / 512 / 512 maskable, `display_override` with standalone fallback,
`registerType: 'prompt'`, update toast, install menu item, Google Analytics loader deleted.
**Because:** prompt mode is the only mode that never reloads on its own.

## D-021: Keep upstream's two-project editing and cross-project actions
**Decided:** 09/23/2026
**Chose:** keep the machinery, reskinned, with the Projects menu simplified to "Switch project"
and "Open another project". The weight slider's "whole font to a new project" reuses
`addProjectEditorAndSetAsImportTarget`. The preview strip re-subscribes when the selected editor
changes.
**Because:** the brief lists multi-project copy/paste under "keep", and it is the cleanest way
to make a new project.

## D-022: GitHub repo is `AnyInk`; base path comes from the Vite config
**Decided:** 09/23/2026
**Chose:** the public repo will be named `AnyInk` (the brief's code name), so the Pages URL is
`https://<user>.github.io/AnyInk/` and `base` is `/AnyInk/`. `base` moves into `src/vite.config.js`
(overridable with an `ANYINK_BASE` environment variable for local previews); the `--base` CLI
flags leave `package.json` in M14. The repo is created before M15; `origin` is added then.
**Because:** manifest scope, service-worker scope, and asset URLs all derive from one base.

## D-023: Image decoding rules for trace, auto-trace, and sheets
**Decided:** 09/23/2026
**Chose:** decode with `createImageBitmap(file, { imageOrientation: 'from-image' })` so phone
photos keep their EXIF rotation; accept PNG, JPEG, and WebP only, with a clear message for
anything else (HEIC from iPhones cannot be decoded by Chrome); cap the long side (2000 px for a
trace layer, 1600 px for marker detection, full resolution only for the sheet warp); keep the
decoded bitmap, not the original file, and cache one `ImageBitmap` per glyph for the redraw loop.
**Because:** a rotated sheet detects markers but yields a wrong homography; oversized ImageData
freezes the tab.

## D-024: One SVG hand-off path for every tracer; unique subscriber ids
**Decided:** 09/23/2026
**Chose:** auto-trace and the handwriting sheet both call potrace with `pathonly: false` and feed
the full SVG (including its transform group) through upstream's `ioSVG_convertSVGTagsToGlyph`,
then `flipNS()` and `reverseWinding()`, exactly like upstream's paste handler. Pub/sub subscriber
ids in ANY-INK modules are prefixed `anyink.` and never a substring of another id, because
upstream's `unsubscribe` matches by substring.
**Because:** `pathonly: true` returns bare paths in tenth-pixel y-up units with no transform;
mixing the two paths produced contradictory research sketches.

## D-025: Delete the analytics loader
**Decided:** 09/23/2026
**Chose:** remove `addTelemetry()` and the `telemetry` setting entirely rather than leaving them
switched off.
**Because:** the brief says no telemetry, and an offline PWA must not fetch an external script.
