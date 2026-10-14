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
**Amended 09/23/2026 (QA):** upstream hid the ascent, cap height, x-height, and descent lines by
default, so a drag on a new project landed on a shape instead of a line. New projects now list all
seven system guides in `settings.app.guides.systemGuides`; a project file keeps whatever list it
saved (the Oblegg sample shows only baseline and side bearings until its Guides panel is changed).
`ProjectEditor.set project` syncs `editor.systemGuides` from that list on every load, not only
on import, because the guides layer hit-tests against the editor flags.
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
**Amended 09/24/2026 (M8):** Photo mode is not plain Bradley-Roth. Bradley-Roth alone hollows out
any stroke wider than its window (a marker ring in a 1000 px crop filled only 39% of its stroke),
so Photo mode also counts as ink anything darker than half the local paper brightness; that ring
now fills 100%. Details, and every slider mapping as built, are in D-029.

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
**Amended 09/23/2026 (QA):** upstream persists the undo queue to IndexedDB by project id and adopts
it on every load, so reopening a file after an unsaved session made undo apply last session's
snapshots to a project that never had them (seen: undo of "Set X height to 1050" landed on 1197).
`History.initialize` now discards the stored queue unless `adoptStoredHistory()` is called right
after the project is assigned; only the auto-save restore path calls it today, and milestone 6's
crash recovery will. Guide visibility toggles, "Add a custom guide", and guide deletion push
settings entries too, so every Guides panel action is undoable.
**Amended 09/24/2026 (M6 fix pass):** History keeps no IndexedDB store of its own any more.
`persist`, `adoptStoredHistory`, `loadStoredSnapshot` and upstream's per-project undo store are
gone. Crash recovery stores `serializeForStorage()` inside each snapshot record, next to the
project it describes, and a restore hands it back with `adoptSnapshot()`, so a queue can never
be applied to a project it does not describe (D-026). Undo and redo call `markDirty(this)` too.
A saved marker records the undo state the `.gs2` on disk holds (`markSavedState`,
`markSavedStateAt`, `isAtSavedState`). It starts empty for a new project, a sample, an
imported font or SVG and a recovered session, and at the empty queue for a project opened
from its `.gs2`. The title dot clears on undo or redo only when that state is on top again. A
save that an edit overtook records the state it actually wrote. The old `GlyphrStudio`
database stays on disk untouched: nothing reads it, and deleting data on the user's machine
automatically is not worth a few kilobytes.

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
**Amended 09/24/2026 (M8):** the SVG still goes through `ioSVG_convertSVGTagsToGlyph` with
`pathonly: false` and the transform group kept (showErrors off, so a blank image gives no
shapes and no error box), but `flipNS()` and `reverseWinding()` are replaced by one affine
mapping from image pixels to font units: `fontX = x + (px + offsetX) * scale`,
`fontY = y - (py + offsetY) * scale` (`src/anyink/autotrace/svg_to_shapes.js`). No
`reverseWinding()`: upstream's `flipNS()` already reverses the point order while it mirrors, so
upstream's `flipNS()` + `reverseWinding()` is a pure mirror, and the direct y-flip is the same
pure mirror. Outer contours run counterclockwise in font units and holes clockwise (the CFF
convention). Checked, not assumed: under the nonzero rule a traced O, A, bullseye and i keep
every hole on the edit canvas (`drawGlyph` fills `'nonzero'`) and in the exported OTF read back
with FontFlux (`svg_to_shapes.test.js`, `autotrace_export.test.js`), and a traced R exported
from the dev app and drawn by Chrome has paper in its bowl. The subscriber-id rule is unchanged.

## D-025: Delete the analytics loader
**Decided:** 09/23/2026
**Chose:** remove `addTelemetry()` and the `telemetry` setting entirely rather than leaving them
switched off.
**Because:** the brief says no telemetry, and an offline PWA must not fetch an external script.

## D-026: Crash recovery replaces localStorage auto-save
**Decided:** 09/23/2026
**Options considered:** keep upstream's localStorage auto-save (the whole project as JSON on
every edit, a "Restore" tab) | keep it and add IndexedDB snapshots beside it | replace it with
one IndexedDB snapshot per open project plus a Web Lock per live tab
**Chose:** replace. `History.updateAfterSaveState` calls `markDirty()` and nothing else;
`src/anyink/recovery` writes `{ id, name, time, dirty, hasFile, fileHandle, project, assets }`
under `session:<id>` in the `recovery` store 3 s after the last edit, on glyph switch, on
`visibilitychange` hidden and on `pagehide`, only while dirty. A successful save (any path in
`src/anyink/files/project_files.js`) calls `markClean()`, which writes `dirty: false` with no
payload. A Web Lock `anyink-project-<id>` is held for the tab's life, so "recoverable" means
dirty and lock not held. The Open Project page shows an "Unsaved work found" card above the
tabs and a Recover tab; Restore imports the snapshot, adopts the stored undo queue
(`adoptStoredHistory()`, D-018), restores assets as Blobs and the file handle, and leaves the
project unsaved. Settings > App keeps one row, "Forget crash-recovery snapshots" (audit A10);
`autoSave`, `saveLivePreviews` and "delete auto-saved backups" are gone and
`app.addAutoSaveState` is a no-op.
**Because:** localStorage is about 5 MB, synchronous, string-only, and cannot hold file handles
or image Blobs; upstream's auto-save copied the whole project on every edit and hit the quota on
real fonts (a documented upstream failure). One record per project, written only while dirty,
keeps the write volume bounded and the restore unambiguous.
**Strongest objection:** a snapshot lands at most every 3 s, so a hard kill inside that window
loses the last edit, and a crash never fires `pagehide`. Accepted: the roadmap's definition of
done is "at most a few seconds of work", and the glyph-switch and tab-hide writes cover the
common cases.
**Revisit:** if a real font's snapshot write measures above about 100 ms (then write a diff or a
per-item record), or when Chromium ships a reliable close-time hook.
**Amended 09/24/2026 (M6 critic, fix and verification passes):** one record and one lock per
project id let two editors or tabs holding the same font overwrite or delete each other's
snapshot. A save could also delete an orphan from a crashed session, switching editors released
the other editor's lock, and continuous editing never produced a snapshot. What replaces it:
- **Session-scoped keys.** Records live under `session:<projectId>:<sessionId>`. A new session
  id is minted every time a project lands in an editor (open, sample, restore, reopen of the
  same file). A session writes and deletes only its own record.
- **One Web Lock per live editor.** The lock is `anyink-session:<projectId>:<sessionId>`, held
  while that editor holds the project in this tab. Switching the current editor keeps every
  lock. Replacing the project, dropping the editor or `stopRecovery` releases it. Recoverable
  means dirty, lock free, and not live in this tab. Records from the first build
  (`session:<id>`, lock `anyink-project-<id>`) stay listable and restorable.
- **History inside the record.** Each record carries `history: serializeForStorage()` beside
  the project, and restore adopts it with `adoptSnapshot()` (D-018 amended). A restore starts a
  new session. The source record is deleted only after that session's first snapshot is
  written, so a crash right after a restore loses nothing.
- **Timers.** The 3 s trailing debounce stays. A 15 s max-wait runs from the first edit not yet
  in a snapshot, so a continuous editing streak is never more than 15 s behind. Undo and redo
  mark the project dirty too.
- **Clean sessions delete their record.** `markClean(editor)` after a save and a clean
  `pagehide` delete it; no `{dirty: false}` stubs are left behind. A save marks clean only
  when no edit landed while it was building and writing (`getDirtyGeneration()` unchanged).
- **Orphans are left alone.** Opening a project that has an orphan dirty snapshot shows one
  toast: "Unsaved work from an earlier session exists for <name>. Open the Recover tab to
  restore it." Nothing writes to, overwrites or deletes the orphan.
- **Bounded.** At most 3 dead records are kept per project id, newest first. Older ones are
  deleted when a session of that project writes its first snapshot and whenever the list is
  read. Without the Web Locks API nothing is pruned, because another tab could own any record.
- **Storage failures.** `kv.js` retries a failed IndexedDB call once on a fresh connection and
  never switches to memory at runtime. `rec*` calls reject and `kv*` calls are best effort.
  Read-modify-write lists (recents, exported files) read with `kvGetStrict`, so a failed read
  never truncates them. A failed snapshot write toasts at most once a minute ("Crash recovery
  could not save a snapshot (...). Save your work with Ctrl+S.") and is kept in
  `getRecoveryStatus().lastError`. A failed Forget says why and keeps the live timers.
- **One list on screen.** The banner and the Recover tab re-list on every
  `anyink-recovery-change` event: restore, discard, forget, a session ending, or a superseded or
  pruned record. They never disagree. A listing that fails says so on the tab instead of
  "Nothing to recover".
**Because:** per-project records made "which unsaved work is newest" ambiguous as soon as one
font was open twice, and each hazard above lost or hid unsaved work. D-026's bounded-writes
goal holds per session, and the per-project cap keeps the store bounded.

## D-027: Recent files and export folder are remembered handles, permission behind a click
**Decided:** 09/23/2026
**Options considered:** remember paths as strings (impossible: the API never exposes a path) |
ask for the file every time | persist `FileSystemHandle` objects in IndexedDB and re-request
permission when they are used
**Chose:** persist handles. `src/anyink/files/handles.js` stores `lastProject`, the recent
projects list (`handle.isSameEntry` dedupe, newest first, cap 8) and `exportFolder` under
`handle:` keys in the `kv` store. Every use goes through `ensurePermission(handle, mode)`:
`queryPermission` first, `requestPermission` only while `navigator.userActivation.isActive`; a
`SecurityError` maps to `'prompt'` and the UI asks for one more click. Pickers carry an `id`
(`anyink-projects`, `anyink-export`) and `startIn` = the last project handle, else Documents.
Save writes in place with `createWritable({ mode: 'exclusive' })` and retries plain on
TypeError; a denied or missing recent is dropped from the list with a toast. Fonts export into
the remembered folder ("Choose export folder..." in the File menu); without a folder or without
the API they download as before. Every project that lands in an editor (picker, recents, drag and
drop, upstream's chooser) goes through `noteProjectOpened`, so recents never miss a path.
**Because:** the File System Access API grants permission per handle per session unless the
user picks "Allow on every visit" (Chrome 122+) or the app is installed, and `requestPermission`
outside a user gesture throws. Handles are structured-cloneable, so IndexedDB is the only place
they survive a reload.
**Strongest objection:** each relaunch can cost one extra click per file until the "every visit"
grant or the PWA install (M14) removes it. Accepted: one click beats a picker dialog every time.
**Revisit:** at M14, when the installed PWA persists permissions; drop the "click once more"
toast if it never shows there.
**Amended 09/24/2026 (M6 critic, fix and verification passes):**
- **Destination first.** An export settles where the file goes inside the click or Ctrl+E
  keydown, before the font is built (`prepareExportDestination`). A remembered folder gets
  its permission check, which may prompt. No folder, or a refused one, opens the folder picker.
  The build can outlast the click's transient activation because the write needs none.
- **Outcomes.**
  - No File System Access or no directory picker: the font downloads.
  - Picker cancelled: "Export cancelled". Nothing is built or downloaded.
  - Click expired or permission left at 'prompt': "Click Export again..." and no download.
  - A failed write: the entry it just created is removed (no 0-byte font left behind), and
    the font downloads with the reason in plain words.
- **Same-named files.** The exact export ANY-INK left there is replaced silently: the normal
  edit and re-export loop. `exportedFiles` in `kv` (cap 50) remembers
  `{ handle, size, lastModified, projectId }` for every export. `isSameEntry` compares paths
  only, so the file there now must still have that size and modification time, and the new
  export must come from the same project. Anything else opens "<file> already exists in
  <folder>." with Replace, Keep both (`<name> (n).otf`, next free number) or Cancel; closing
  the dialog counts as Cancel. That covers a downloaded or imported font, a file restored from
  a backup at the same path, an export another program changed, and another project's export
  with the same name. Importing a font takes it off the list.
- **`.gs2`-only in-place saves.** A v1 `.txt` or any other file opened by picker, drag and drop
  or upstream's chooser never becomes the save target. Its first Save goes to Save As with
  `<name>.gs2` suggested, starting in its folder. It is kept out of recents and remembered only
  as the place Save As starts, so "recents never miss a path" now means every `.gs2`.
- **Save errors say what happened.**
  - Moved file: Save As once.
  - Not allowed: Save As once.
  - Locked by another window: close that window.
  - Anything else: the message.
  - A SecurityError from a picker: one more click.
  Every file command runs through `runFileCommand`, so failures land in the error box and never
  as unhandled rejections. That covers the menu rows, Ctrl+S, Ctrl+Shift+S (Save as), Ctrl+E and
  the Open page's "Open a project file..." button.
- **Edit during a save.** The title dot and the crash snapshot stay, and History records the
  state the file holds, so undo back to it clears the dot.
**Limit:** "ANY-INK wrote it" is size plus modification time, not a content hash. A different
file with the same size and the same modification time at the same path would be replaced
without asking. That does not happen in practice, because a restored or copied file carries its
own older time.

## D-028: Trace layer data and interaction
**Decided:** 09/24/2026
**Options considered:**
- *Data:* a separate layer object (a project-level `traces` collection keyed by item id, or a
  special non-exported shape inside `glyph.shapes`) | the trace on the item itself,
  `item.anyink.trace` (glyphs, ligatures and components are all `Glyph` objects).
- *Interaction:* an always-on drag with any tool, like the guides layer (D-008) | panel-gated:
  only while the Trace panel is open | panel-gated and limited to the Resize tool.
**Chose:** `item.anyink.trace = { asset, width, height, x, y, scale, opacity, visible, locked,
invert }`. `x, y` is the image's top-left corner in font units (y-up), `scale` is font units per
image pixel (aspect always kept), `width, height` are the stored image's pixels, opacity runs
0.05 to 1. Every write goes through `setTrace`, which keeps only those ten fields, so no Blob or
ImageBitmap can reach a glyph or its undo snapshots. The pixels are a Blob in `editor.assets`
(D-012). Import decodes once (D-023): PNG / JPEG / WebP only, EXIF upright, long side capped at
2000 px, re-encoded to WebP 0.92 (PNG where WebP cannot be encoded). The canvas draws from an
`ImageBitmap` cache keyed by that Blob. A new image fills ascent to descent, top edge on the
ascent, left edge at 0; a replaced image keeps the old top-left corner and height. The `.gs2`
writes only the assets some trace still uses (`collectReferencedAssetIds`, which also scans
`alternates` for M11). Crash snapshots keep every asset, because undo can bring a removed trace
back. The font and SVG exports never read `anyink`, and the glyph tiles and the preview strip
draw outlines only.
The canvas layer (`trace_layer.js`, right after the guides layer in `handleMouseEvents`) moves
and resizes the image only when all of these hold: the Trace panel is open, the trace is visible
and unlocked, and the Resize tool (the arrow) is selected. Every other tool always draws over the
image, and with those tools the canvas shows the purple frame without handles. The corner
handles win over a metric line running through them (`traceHandleHasPriority` in `findLineAt`),
while the body and edges let the line win. **Amended 09/24/2026 (M7 finalize):** a shape
under the pointer, or a selected shape's resize handle, wins over the image body, so shapes
drawn over the image can be selected with the arrow; the image's corner handles still win over
shapes, and the image moves only from an empty part of it (`shapeWinsAt`). Pressing an empty
part of the image clears the shape selection, as a press on empty paper does. The arrow keys
nudge the image only while nothing is selected. Each change is one history entry: a drag on
release, a burst of arrow presses on the last key-up, the opacity slider on release, and each
toggle, fit, add, replace and remove. Any other key or any press on the page first writes a
pending nudge entry, so switching items never loses one.
Also amended in the finalize pass, around the layer:
- **Keyboard.** Any press on the edit canvas takes the keyboard back from a panel control
  (`src/anyink/controls/focus_release.js`, called from `handleMouseEvents`). Upstream cancels
  that mousedown, so a toggle reached with Tab kept the keys: Ctrl+Z and the nudges went
  nowhere and Space flipped the toggle.
- **Paste.** Chrome sends a paste to the focused element, which is the page body while
  editing, so the page listens too (`handlePasteOnPage`; text fields keep their own pastes).
  Copied shapes win a Ctrl+V until the window loses focus after a copy whose note reached the
  system clipboard; then an image there is newer and becomes the trace
  (`src/anyink/trace/clipboard_note.js`). Every copy writes the note, Copy buttons included;
  when it cannot be written, the shapes win. With shapes copied, the async clipboard read
  (only when no paste event came) runs only if Chrome already allows it, so Ctrl+V never
  raises the permission prompt in front of the shapes. A refused read says so in a toast.
- **Cross-project copies** bring the image into the other project's asset store
  (`carryTraceAsset`), and "Scale items to match destination Em size" scales the trace with
  the outline it was traced for (`resizeWithTrace`).
**Because:**
- The data rides on machinery that already exists. History clones the whole Glyph, so every
  trace change is undoable with no new entry kind, and `Glyph.save` carries the trace into the
  `.gs2` and crash snapshots. Ligatures and components get it for free, and deleting a glyph
  takes its trace with it (the next save drops the unused image). A separate layer object would need its own undo kind, its own
  save path, and cleanup when an item is deleted or renamed.
- The panel gate exists because the image sits under the whole glyph, so an always-on drag
  would steal nearly every click from the tools. The guides layer can be always on because a
  line is a few pixels wide.
- The Resize-tool gate came out of integration. The first build let any tool except a mid-path
  pen grab the image. That swallowed the first click of New path, New rectangle and New oval,
  and the Add point click, on the very panel the import opens after adding an image, so "draw
  over it" from the brief failed.
- The corner exception exists because the default placement puts all four corners on metric
  lines (ascent, descent, left side), so a new image could be moved but never resized.
- Shapes win over the image body because the critic pass showed the first rule's cost: with the
  Trace panel open, shapes drawn over the image could not be selected with the arrow at all,
  which was this decision's first "revisit" condition.
**Strongest objection:** with the Resize tool, a big image mostly covered by ink is hard to grab,
because a press on a shape now selects the shape; the image moves from its empty paper or its
corners, or from the arrow keys once it is clicked. Also, each item gets exactly one trace.
Accepted: the panel's hint says so, the corners always work, and one reference image per glyph
is what the brief asks for.
**Revisit:** if tracing sessions show the image hard to grab under a finished glyph (then add a
move handle at its center), if M9 sheet scans need more than one image per glyph (their assets
must also join the saved set, or a save drops them), or when M8 auto-trace reads the image (it
should use the same asset Blob and `bitmap_cache`).

## D-029: Auto-trace pipeline and controls
**Decided:** 09/24/2026 (Milestone 8)
**Options considered:**
- *Preview:* temporary shapes written into the glyph (every slider tick an undo entry or a
  history hack) | a separate preview pane | an overlay drawn on the edit canvas over the image.
- *Which part of the image:* the whole image | the pixels inside the glyph box (the first
  contract) | the glyph box plus a margin, keeping whole shapes whose middle is in the box.
- *Direction of the outlines:* upstream's paste recipe (`flipNS()` + `reverseWinding()`) | one
  affine pixel-to-font-unit mapping.
- *The trace's own Invert colors:* flip what is traced (what you see is traced) | ignore it.
- *Photo mode:* Bradley-Roth alone | Bradley-Roth plus "darker than half the local paper".
- *Where binarize runs:* in the potrace worker | on the main thread.
**Chose:**
- **Pipeline** (`src/anyink/autotrace/`): pixels read from the trace's asset Blob through the
  bitmap cache (`trace_pixels.js`, copied out at once; a miss decodes once and closes) ->
  `binarize.js` (Rec. 601 gray with alpha on white, Otsu, optional Bradley-Roth, 3x3 open then
  close) -> pure black-on-white pixels -> `potrace.worker.js` (esm-potrace-wasm 0.5.1, module
  worker, `init()` once) -> `svg_to_shapes.js` -> upstream Paths in font units. The facade
  `autotrace.js` is the one entry point: `autoTraceTrace` for the Trace panel,
  `autoTraceImageData` for the M9 sheet. The client (`potrace_client.js`) is latest-wins: one
  request runs, only the newest waits, an older one rejects with `.stale`, and an AbortSignal
  rejects as stale too. The worker is created lazily, so nothing vitest loads imports the WASM.
- **Sliders** (0 to 100 % each, with a readout; no typed numbers):
  - *Threshold* = the gray cutoff 0..255 (100 % = 255). *Auto* is Otsu, and the slider then
    shows the value the image picked. Scan mode: darker than the cutoff is ink, and on Auto an
    image whose two tones are closer than 40 gray levels has no ink (blank paper grain never
    becomes specks). Photo mode: Bradley-Roth (window 1/8 of the long side, t = 0.15) OR darker
    than half the local paper brightness; moving Threshold off Auto shifts both cutoffs by
    (threshold - auto) / 510.
  - *Smoothing* 0..1 -> potrace `alphamax` 0..1.3334 (default 0.75 -> 1.0, potrace's own).
  - *Detail* 0..1 -> `opttolerance` 0.5 falling in a straight line to 0.05, and `turdsize` =
    round((0.03 x upm x (1 - detail))^2 / scale^2) pixels, where scale is font units per pixel of
    the image potrace sees. The smallest kept speck is set in font units, so the same Detail
    gives the same result for a 500 px or a 2000 px image of the same letter.
  - `turnpolicy` minority, `pathonly` false, `extractcolors` false, potrace's `opticurve` 1.
  - Toggles: *Remove specks* (despeckle), *Light ink on dark paper* (inverts the gray first),
    *Only inside the glyph box*. Scan / Photo mode buttons.
- **Preview**: one session per editor (`autotrace_session.js`). A control change re-traces 120
  ms after the last input, latest wins, and the last result stays up while the next one runs.
  Previews trace a copy shrunk to a long side of 1000 px, kept between slider moves so a drag
  does not re-read the image; a preview shrunk below 2/3 skips despeckle (its 3x3 would erase pen
  lines the full-size trace keeps). The overlay is a dashed outline plus an 18 % fill, nonzero,
  in the canvas touch green (`--canvas-selection`: #16A34A on paper, #22C55E on slate), only
  while the Trace panel is open and only on the session's editor and item (by object or id).
  Nothing enters history until Replace or Add.
- **Apply** re-traces at full resolution (after one painted frame, so "Tracing at full size..."
  shows first), then one history entry "Auto-traced N shapes (P points)"; a Replace that
  removes component instances is one whole-project entry so undo brings the "used in" lists
  back. The shapes are copies (`Path.save()`), named "Auto-trace 1, 2, ...". The trace image
  is never touched. The session then ends.
- **Region**: *Only inside the glyph box* (default on) traces the box (0 to the advance width,
  descent to ascent) plus 1/4 em on every side, then keeps the whole shapes whose bounding-box
  middle is in the box; a shape inside another shape's bounding box (a counter) goes with it.
  A box that does not reach the image is a plain-words error. Off: the whole image.
- **Placement and winding**: `fontX = x + (px + offsetX) * scale`, `fontY = y - (py + offsetY) *
  scale`, with the crop offset and the downscale factor folded in; no `reverseWinding()` (D-024
  amended). Points potrace leaves in the middle of a straight edge (within 0.06 px) are dropped.
- **Trace flags**: the Trace panel's *Invert colors* is a look for the slate canvas and never
  changes what is traced; *Light ink on dark paper* describes the image itself. A hidden or
  locked trace can be auto-traced: the image is the input, Show and Lock only govern drawing
  and dragging it.
- **The session ends** on an item switch, a panel or page change (with or without
  `navigate()`), the app-level page, a switch to the other open project, or the trace's
  removal; moving, resizing or replacing the image (or changing the box while the box option is
  on) re-traces. The options last used carry to the next session in this app session, so an
  alphabet from one scan keeps its settings.
- **Upstream fix found on the way**: `Glyph.save()` now copies `usedIn` and `gsub`; it returned
  the live arrays, so whole-project undo snapshots shared them and an in-place splice changed
  old snapshots (regression test `src/project_data/tests/glyph_save_arrays.test.js`).
**Because:**
- The overlay costs nothing in history and draws what the user is about to make, in the touch
  color, over the image they are matching. A preview written into the glyph would have fought
  undo, the recovery snapshots and the preview strip.
- Cutting the image at the box edge cut the leg of an R that reached 14 font units past its
  advance width with a flat edge. With the margin and the whole-shape rule, the applied R
  matches the image's ink bounds within 0.2 font units on every side.
- The affine mapping is one formula for the panel, the sheet and the tests, and it is the same
  mirror as upstream's recipe (checked contour by contour on five fixtures).
- Invert colors exists so dark ink shows on the slate canvas; if it flipped the trace, turning
  on slate would trace the paper.
- Font-unit speck sizes keep Detail meaning the same thing at any image size; the 1000 px
  preview keeps a slider drag near 25 ms of work on a 2000 x 1500 photo.
**Strongest objection:** the full-size binarize runs on the main thread: applying a whole
2000 x 1500 photo in Photo mode was one 183 ms long task (the first preview of it, 102 ms,
mostly the one-time read and shrink). Also, potrace's `opttolerance` is in pixels, so a shrunk
preview can show fewer points than the applied result (97 vs 133 on a whole 2000 px image; box
crops match within a point or two), and letters that touch in a word scan are one shape, kept
or dropped together. Accepted: images are capped at 2000 px, the progress line shows first,
box crops are much smaller, and the readout after apply is the real count.
**Revisit:** if applies feel slow (move binarize into the worker and transfer the mask), if
touching letters in real scans need a split tool, or if the M9 sheet wants the whole-shape rule
for its boxes (it calls `autoTraceImageData` on its own crops today and would reuse
`keepShapesInGlyphBox`).

## D-030: File autosave and recovery are independent
**Decided:** 09/24/2026, critic fix pass authorized by Brennan.
**Options considered:** save only to IndexedDB | put file writes in the recovery queue | independent file/recovery queues.
**Chose:** independent 3-second maximum scheduling intervals, plus glyph-switch writes. Manual and automatic file writes share per-editor ordering and an origin-wide Web Lock. File System Access exclusive streams protect the write itself. A file fingerprint (metadata plus SHA-256 in Chrome/Edge) detects external changes before replacing content and travels in recovery records.
**Because:** a slow disk write must not block the browser recovery copy. Comparing each editor's revision and History identity prevents a completed save from clearing newer edits or a different project. Background saves only query existing permission; they never prompt, download or redirect to Save As. An unknown older recovery baseline requires manual Save before autosave resumes.
**Strongest objection:** serializing all project writes across this origin can delay unrelated file saves. This personal two-project editor favors safety; recovery remains independent. Storage latency and suspended pages mean the 3-second scheduler is not a hard durability SLA.
**User feedback:** persistent top-bar status distinguishes saved file, pending edits, recovery copy and failure. Conflicts direct the user to Save As; text is assigned through textContent.
**Sources:** Chrome File System Access guide, https://developer.chrome.com/docs/capabilities/web-apis/file-system-access ; existing project reader/writer/recovery modules inspected before extending them.
**Revisit:** if real large-image project saves starve other files, use per-file identity locks without weakening conflict detection.

## D-031: Beginner-proof design: Simple mode with the letter board as home
**Decided:** 10/13/2026, after Brennan's 10/13 test ("overwhelming ... made me feel lost ... make this
program have cool features but stupid proof"); revised 10/14/2026 after a design review. Numbered
D-031 because D-030 is file autosave.
**Options considered:** (1) Guided: a job-first front door with wizards, a separate Letter desk editor,
and the full editor as a "Workbench"; (2) Simple workspace: one dense screen with the board, canvas,
letter card, coach and strip together; (3) Letter board: the board is home, one cut-down editing
screen, everything else behind an expert switch. Two judges scored them: a beginner advocate (Guided 8,
Letter board 7.5, Simple workspace 6) and a feasibility review (Letter board 8, Simple workspace 7,
Guided 5.5).
**Chose:** the Letter board as the base, with Guided's three-step rail (Letters, Try it, Use in Word),
photo card and install card, and Simple workspace's ordered coach rules, gap handle and never-greyed
photo button. A ready letter shows two buttons; everything else sits in one closed "Fine-tune this
letter" section. One photo makes many letters through a photo dialog that boxes each part in turn.
Simple mode becomes the default only in B16, once every Simple screen exists; until then it sits
behind ?ui=simple and per-feature flags, so the live app never shows a half-built mode. "More tools"
shows every Glyphr Studio tool under a purple band with a one-click way back. One vocabulary file
(src/anyink/words/words.js) supplies every word on the Simple path; internal ids never change
(D-001). Results are made correct by construction:
- one scale per photo (the median over its named letters, earlier untouched letters follow) and one
  writing line per row, so letters from one photo share their ink weight, the same rule D-017 sets
  for the sheet;
- automatic spacing with a per-letter owner flag; the refit runs only in Simple, and any spacing
  change made in More tools marks the letter "set by you";
- the photo moves with the shapes whenever spacing moves them;
- whole-number widths, a font check that runs on the exporter's own list of letters, and an export
  that leaves out letters with no shapes;
- per-letter checks with one-click fixes, each with "Looks fine to me"; soft notes never block Ready;
- brush strokes stay separate shapes tagged with stroke ids, inked by D-015's nib path
  (perfect-freehand only for the live preview), so M10 can re-ink them without touching traced shapes.
Built as B0 to B16 before M9; M9 to M13 then plug into the board, the letter card or Try it.
**Because:** the walkthrough showed two kinds of failure: results that look done but are broken (a
traced letter with width 0, a preview that silently shows a system font), and a pro workspace that
gives a first-timer no next step. The board gives a visible finish line and one obvious next action.
One editing surface means each later milestone is built once, not twice. Filtering only where screens
are drawn keeps upstream merges simple; the existing tests run pinned to All tools, apart from the
label tests B4 rewrites and the files each B lists, and about 20 upstream files gain small,
headed edits. This onboarding is for Brennan himself, so it fits the brief's "no onboarding for
strangers".
**Strongest objection:** about 46 working days before the handwriting sheet, the feature that makes a
full font fastest. Two layers of words and modes also add places for drift. Mitigation: the first
photo-to-Word loop runs behind ?ui=simple after B14; the banned-word test (including toasts and canvas
text) and the vocabulary file stop drift; More tools keeps every upstream capability one click away.
**Revisit if:** Brennan turns on More tools every session (make it remember); automatic spacing on
real handwriting needs regular manual fixes (move to measured spacing from his n and o); his
handwriting's proportions keep tripping the size check (fit the guide lines to his first photo
automatically); or the acceptance run in UX-BEGINNER.md section 9 fails twice on the same task
(redesign that screen, not the words).

## D-032: B1 build choices (font check, letter names, notices)
**Decided:** 10/14/2026, during B1 (UX-BEGINNER.md section 10) and its critic fix pass. Small choices
the build made where the spec text left room; each is easy to reverse, and Gate 2 can overrule any of
them.
**Chose:**
- Letter names follow UX-BEGINNER 2.2: "Capital A", "small a", "number 1", "the question mark",
  "joined letters fi" (`src/anyink/words/letter_name.js`).
- A 1- or 2-point shape that curves is not a font-check problem; a straight one is. Oblegg's ff, ffi
  and ffl joins are curved 2-point shapes the font file holds fine, and the literal "at least 3
  points" rule raised 3 false alarms on that sample.
- `addSpaceIfMissing` also replaces a space that has no shapes and width 0 (clicking the space tile
  makes exactly that, and today's export writes it 0 wide). The check flags a space (and a no-break
  space) whose width rounds to 0: "The space has no width, so your words would run together." (fix
  pass; it first left an empty space alone).
- The font library already adds a space a quarter of the letter box wide (named "space") to a font
  without one, so today's exports already carry a 512-wide space at 2,048; the option makes it ours
  (`uni0020`).
- Each font-check message names the actual problem ("small b has ink but no width, so the next
  letter would sit on top of it.") instead of the generic "has a problem the font file can't hold".
  The strip shows it as is. The export toast keeps the export's own words and carries on: "Exported
  BrennanHand-Regular.otf to Fonts, but small b needs fixing. [Show me]", amber edge, 12 s; the
  words come from the export writer's record (`export_folder.js` getLastExportMessage), so a "Keep
  both" name or a download fallback is said as it happened.
- Panels are stored by id (`ContextCharacters`, `CharacterInfo`, `QualityChecks`); old names in saved
  state or the dev `currentPanel` setting still open the right panel.
- Custom guide lines span as far as the system guide lines. A letter whose width is still 0 (a new
  letter, and one being drawn, until B3 spaces it) gets lines at least the default letter width and a
  faint right edge there; a letter with a width keeps its own box (fix pass: the span was first keyed
  on "no shapes", so the first Pen click shrank the lines to stubs).
- Guide line strength is worked out from the tokens so the writing line and the side edges reach 3:1.
  On a display scaled above 100 % the browser stretches the canvas and smooths each 1 px line, so the
  alpha is raised by what the stretch can lose (1 - 1 / (2 x scale)); when even a solid 1 px line
  can't hold 3:1 (125 %), the line is drawn 2 canvas px thick (`guide_strength.js`
  systemGuideStroke). Chosen over a canvas buffer at the display's own scale, which would sharpen
  everything on the canvas (not a B1 change) and draw 2.25 times the pixels on every redraw.
- App notices (install, ready offline, update, offline problem) are one line in the top bar's empty
  middle, just left of the save status (`pwa/notice_place.js`), where they cover nothing on any page;
  toasts still show over them. Fix pass: bottom right, 80 px up, covered the zoom bar; above the
  strip, letter tiles and Settings buttons. B6 decides where notices finally live.
- One app notice per launch: the first one shown takes the launch, update and problem notices
  included, so the install offer and "ready to open offline" never follow another notice; "ready
  offline" never waits in line (`waits: false`) and is said on a later launch instead.
- The strip line gets [Fix it] only where it really changes something (`fix_it.js` canFixProblem):
  a width, a space with no width, and stray shapes in the letter itself (not in a letter it is made
  from). It acts only if the problem is still there (the line can be 2 s old). Otherwise one sentence
  says what to do ("Show me, then drag the far point back near the letter."). The count names gaps as
  gaps ("2 more letters and 1 gap need fixing too.").
- While the line shows, only the corner of the sheet under it is cut out of the letters (clip-path),
  in canvas and Real font mode; the letters never move when it comes or goes (fix pass: a 40 px band
  across the whole sheet made them jump 20 px).
- The Real font preview writes gaps as the font file holds them (`export_kerning.js`, rounded and
  pulled into range), like the export, so a gap of 12.5 no longer stops it. Its "Can't show your
  font yet" naming of a gap is now a safety net, named the font check's way (`kernSubject`).
- Opening a letter never changes it: `new_path.js` gives a one-shape letter its first width only from
  the path's Done button, not on every selection.
- Leave-site check: a font with no work file warns when anything its work file would hold differs
  from what it was loaded as (ink, widths, gaps, settings), comparing only the settings the loaded
  copy has, and not counting the empty records opening a letter makes. The check is installed once at
  start, so imported font files have it too, and an import makes the imported font History's starting
  point. View toggles that mirror the canvas's own view buttons (Trace panel "Draw glyph as outline")
  are not font changes, like the canvas button; guide visibility already goes through History.
- Menus and the Presets hints use house words where B1 touched them ("Open another font first",
  "26 letters", "capitals", "small letters"); the "Editing" label on the open font's tinted card
  uses its own token (`--chrome-text-on-tint`, 5:1).
**Because:** each keeps a first-timer from a false alarm or a dead end without adding a screen.
**Strongest objection:** the per-problem messages and the curve exception make the check less
literal than the spec; a straight 2-point shape and a curved one now behave differently.
**Revisit if:** a curved 2-point shape ever breaks a font file or the preview, or B4's vocabulary
test wants every message from one sentence pattern; the 2 px guide lines on 125 % displays read as
too heavy (then give the edit canvas a buffer at the display's own scale); or a .ttf export ever
fails on a component moved more than 32,767 units (the check doesn't look at composite offsets).

## D-033: B2 build choices (undo that never surprises)
**Decided:** 10/14/2026, during B2 (UX-BEGINNER.md section 10, 7.3), the B2 + B3 integration, and
the critic, fix and finalize passes that followed. Small choices the build made where the spec
text left room; each is easy to reverse, and Gate 2 can overrule any of them.
**Chose:**
- "Navigated to" steps are found by upstream's own title (every navigator passes "Navigated to
  ..." to `addState`) and then marked `navigation: true` on the entry, which crash recovery keeps.
  Simple records none. All tools keeps them, because upstream's undo reads the step under the
  newest one, but they never change the saved state: no title dot, no "pending" work file, no
  backup write; on a saved font the saved marker moves onto them (the B1 leftover).
- Simple undoes an item step from that letter's own newest older state (an older step of it, a
  whole-font copy that holds it, or the undo floor), so no navigation step is needed. Navigation
  and creation-only steps left over from All tools are passed over in the same press, never
  named, and leave the list; the empty letter records they made stay.
- Simple names every press by the step's own title: a whole-font step by its "before" entry's
  title ("Undid: moved all letters closer"), never the internal marker.
- Simple records no "Automatically navigated to" step when a letter is deleted (the Delete
  buttons), so one Undo brings the letter back; one left from All tools is passed over.
- The size limit keeps the newest 200 steps and at most 30 whole-font steps, in both modes. A
  pre / post pair counts once and always leaves together; a step with parts (B3) counts once and
  leaves whole. It is checked once a step is complete, so an action that fails between pre and
  post costs nothing. Dropped steps are written into `history.undoFloor`, which Undo falls back
  to; `initialProject` stays the font as loaded, because the leave-site check compares against
  it. The saved marker moves or clears when its step drops off.
- Looking around is never a step, so it never counts toward 200 or 30: "Navigated to" entries
  and the creation-only pairs All tools records when a letter is opened are left out of the
  count, and browsing can never push a real change out of Undo. Past 30 "Navigated to" entries
  (`MAX_NAVIGATION_ENTRIES`), the oldest ones that only pass the view along leave: an entry
  right under another "Navigated to" entry, taken out alone when the letter under it differs
  from the one above, else together with the one above (so "Navigated to B" never lands right on
  B's own step, a press that would do nothing). An entry right under a real step always stays
  (All tools' undo reads it). A saved marker on one that leaves moves to the entry above (the
  same font). Each "Navigated to" entry holds a copy of one letter, so 30, not 200: 600 looks
  around at 200 grew the backup to 4.3 MB and its write to 85-170 ms.
- A whole-font step takes the id of the letter that was open, or one passed in `{ itemID }`.
  `{ itemID: null }` names no letter, so Undo from another letter stays where it is: the
  letter-spacing slider, gap fixes, the guide lines, and (Simple) moving the writing line pass
  it. All tools keeps upstream's naming of the open letter for the writing line, as before.
  With no letter open, All tools keeps upstream's top-step id and Simple names none.
- All tools takes the step on top for upstream's "navigated without undoing" only when it is a
  real "Navigated to" step or upstream's "Automatically navigated to" step. Any other step whose
  letter's earlier state isn't right under it is undone from that letter's own newest older
  state, never dropped: a list made in Simple (which records no navigation steps) used after a
  crash restore or a mode switch, a real step right over a deletion (the deletion waits for the
  next press), and a letter opened with no "Navigated to" step (the item links on a letter's
  card, a double-click on a context character). That last one changes All tools: upstream's
  first press moved the view and dropped the change, so a trace on such a letter could never be
  undone; it is now undone and stays redo-able (`history_deletion.test.js` pins it).
- Simple: quick presses of an arrow key on one guide line (each within `BURST_MS`, 1 second, of
  the last, nothing else in between) are one step, so a held key can never fill the 30
  whole-font limit (31 presses had pushed every earlier step out). All tools keeps one step per
  press.
- Settings steps also save `settings.anyink` and the project name. Undo and redo change those two
  only where that one step changed them, so an older settings step never wipes later data (photo
  records, the letter-spacing extra).
- In Simple an Undo press with nothing to undo shows no toast; `restoreState` / `redoState` return
  `{ done, title, itemID, page, moved, showMe }` for B6's toast.
- Opening a letter with no record in Simple makes the empty record with no step; All tools still
  records that step, marked creation-only (it counts toward neither limit; at most one per
  letter).
**Because:** one press must change one thing he can see, and looking around must never look like
work to save.
**Strongest objection:** finding navigation steps by a title string ties B2 to upstream's wording;
if upstream renames it, those steps become ordinary steps again (navigation_steps.test.js fails
first). And the All tools change for letters opened without a navigation step breaks "All tools
exactly as today" in one place, on purpose: the old behavior silently lost a change.
**Revisit if:** upstream changes the navigation title; or B10 / B12 measure the backup write over
D-026's 100 ms with the list at its fullest (200 steps, 30 whole-font copies and 30 "Navigated
to" entries), then lower the limits; or Gate 2 wants All tools' old undo back for letters opened
without a navigation step.

## D-034: B3 build choices (spacing, placement and the refit hook)
**Decided:** 10/14/2026, during B3 (UX-BEGINNER.md section 10, 4.4, 4.6, 7.2): three tracks
(spacing, placement, hooks), their integration, and the critic, fix and finalize passes that
followed (a first-timer lens built fonts from handwriting photos in real Chrome and measured them).
Where a choice goes past the spec's literal words it says so.
**Chose (spacing, `src/anyink/spacing`):**
- Open sides get 0.4 G, not the spec's 0.2 G: at 0.2 G two open sides meeting at the same height
  ("ty", t's bar and y's arm) sat 0.4 G apart, 35 units at 2,048, touching at text sizes. Now
  0.8 G, near a round pair's 1.2 G once the white under the arms is counted.
- A side is measured on the letter's body, not its ink box (`sides.js`). A mark above the body
  (an i or j dot wherever it drifted, an accent) and ink below the writing line (the tails of g
  j p q y, Q, J) don't set a side; a small piece (no more than a quarter of the small-letter
  height either way) is a mark even when it dips just under the stem's top. Before, a drifted
  dot or a hooked tail widened the box and opened holes ("mi n i mum").
- Marks and tails may hang into the space the gap rule gives that side, but stop 0.1 G short of
  the letter's own width; ink further out moves the side out just enough. Unbounded, tails ran
  into each other (gj, jj, yj, gg overlapped in the exported fonts) and a drifted dot sat on the
  l beside it. The limit holds for all of the ink in the font's slant, the frame every letter
  shares, so no two automatic letters can ever touch, even when each leans its own way (an
  upright l beside a slanted i's dot overlapped by 36 units before). The price: a letter leaning
  5 degrees or more off the rest gets a little more room on the side its top leans toward (in a
  messy hand "in" 236 -> 323 units against a median of 195); and a tail that hooks far left (a
  long j hook) opens a wide gap before its letter again ("aj" 497 against a median of 179 in the
  neat lens hand; 512 before B3, 164 with the tails unbounded but then gj, jj and yj overlapped).
  Spacing one letter at a time can't do better: only the letter before knows whether there is
  room under it. A later automatic pair fix (kerning only the pairs whose tails would meet, B12
  or after) could let tails hang freely. The space counts the letter-spacing extra, so at the
  slider's far left end hangs touch at most.
- A slanted hand is measured as if it stood upright: the font's slant is read from the stems
  (only letters with a straight side in the side table vote; stems leaning up to 50 degrees
  count), and each automatic letter keeps the slant it was fitted with in
  `anyink.spacingSlant` (whole degrees), so it rides along in Undo steps and the work file. The
  slant moves only when the stems disagree with it by more than 1.5 degrees, and a slant change
  refits every automatic letter inside the same Undo step. A letter whose own stems lean more
  than 2 degrees off the font's is measured by its own lean (one slant for every letter pushed
  a tall l that leaned 5 degrees more than the rest 158 units from its neighbors). An upright
  letter with nothing hanging measures exactly like its ink box, so upright fonts space as
  before.
- Punctuation gets 0.6 G on both sides, whatever its table kind; every Unicode punctuation mark
  counts, & included. Accented letters are spaced as their base letter (é as e).
- Each letter keeps `anyink.spacingExtra = { left, right }`, the share of the letter-spacing extra
  its sides hold now, so moving the slider back gives the exact spacing back after a side stopped
  at touching. A letter with no record is taken to hold the whole extra.
- The slider leaves letters with no ink, and the space, alone. It moves "set by you" letters by
  whole steps without rounding their points. A "set by you" letter may keep a width of 0 (the
  font check names it); a fitted letter always gets at least 1.
- The settings template gains `settings.anyink.spacing = { extra: 0 }`, and keys of
  `settings.anyink` the template doesn't know yet (B9's `photos`) are kept as loaded: `merge()`
  dropped them on load and in every whole-font Undo copy.
- A component of a letter with no ink adds no ink (it used to count as ink at x = 0, so an
  automatic letter made from an empty one walked right by G on every step).
- The engine imports only its own folder and the trace model (`imports.test.js`). The font check
  sits in an import loop (validate -> ... -> preview/font_status -> validate) that stops a page
  that loads it first, so `outline.js` restates the stray-shape rule and a test keeps the two
  rules equal.
- The Real font strip gives a missing space a quarter of the letter box, as the exporter does (it
  showed the default letter width, 1,024 at 2,048, against the file's 512).
**Chose (placement, `src/anyink/placement`):**
- Every letter's body bottom sits on the writing line, wherever on the page it was written (the
  spec kept each letter's height above or below the row line as written; on a neat page that put
  a third of the letters past B11's 2 % "Sit on the line" limit, and the wobble repeated in every
  word). The row's line serves where a shape can't show its body (j, y, a tail with no bowl), for
  the tail guess and for sizing.
- Each row's writing line slopes with the photo: one slope for the whole photo (a phone held a
  little off square turns every row alike), from the letters' bottoms only (marks under 40 % of
  the typical letter height don't vote), level with fewer than 4 bottoms, a rough slope that one
  letter in four written high or low can't move, then a fine one through the rest; cut back to 6
  degrees. A letter's bottom is measured as the photo would have it held square, but never more
  than 1 % of the letter box from its lowest ink (the traced letter keeps the photo's turn, so at
  5 degrees an A whose feet ended up level floated 56 units).
- Rows written at another size get their own (the spec said one size per photo; a page that
  starts big and runs out of room made letters alternate big and small in every word). Rows are
  compared only through kinds of letter they share, and only through letters whose whole height
  is their body (a tail letter's bowl or an i's dot varies too much: high-closing p and g bowls
  made a row look written smaller and grew it 5 %), so capital rows and small-letter rows of a
  whole-alphabet page are never compared directly; the capitals take the size of the small-letter
  row next to them. A row's own size counts in full from 15 % off the page's usual size, not
  at all within 7 % (a messy hand's rows wobble that much), faded in between, believed in part
  until its row has 5 letters or every part in it is named; so naming letters one by one never
  swings earlier letters bigger then smaller (before: x1.21, x0.83, x1.18 ...). Ink weight then
  differs by row where the size does (B11's stroke note).
- The body bottom of a letter with a tail, in order: the bottom of its bowl hole plus one stroke
  (exact for g p q Q), unless the row has a writing line and the bowl ends more than 4 % of the
  body and more than 2.5 times the photo's usual scatter off it (a handwritten bowl often closes
  above the line: p's top had landed at 820 against n's 1,068), then the row line; else the row
  or partner line; the literal "lowest row at half the width" rule only when it agrees within
  15 % with the size the other letters give; else that size; alone in a photo, the split its
  guide lines give.
- A Q, J or f whose tail the guess left off (less than 15 % of the body) but whose ink still
  hangs under its body sits on its body: a Q on its bowl, a J or f on its row or partner line
  when the dip is more than the photo's usual scatter. His [No tail] puts it back on its ink.
- A letter with a tail is sized by its body, not top to tail (tails vary far more). The row line
  leaves out g j p q y, Q J f until [No tail] is known, the apostrophe, the hyphen and brackets.
- Follow rule: each earlier letter is compared with its own current size, so small changes can't
  add up; a letter also re-seats when the row line moved more than 0.5 % of the letter box; a
  follower keeps its left ink edge where spacing put it.
- Parts of a photo (the 4.4 rule, B9's reference in `tests/ink_parts_lite.js`): two ink pieces
  are one letter only when they overlap left to right by half the narrower one and also share
  their height (a crossbar, a pen lift), or one is a dot close above or below the other, its
  middle at most 0.3 of a letter's height to the side (i j ! ? : ;); a dot joins only the
  nearest piece. The spec's left-to-right rule alone joined every column of a whole-alphabet page
  into one part (9 parts for 25 letters); now every lens photo gives one part per letter.
- Classes the spec doesn't name: numbers sit on the capitals line; brackets, colon and semicolon
  get classes; any other symbol is a capitals-line symbol; a hyphen-only photo is sized by the
  hyphen's width.
- Known limits: the traced letters keep the photo's turn (nothing straightens them; B9 could turn
  the photo by the fitted slope before tracing); a g or p written clearly high or low in an
  otherwise tight row keeps its wobble, as j and y do; a dropping f alone in its photo has no tail
  until he presses [It has a tail]. Spacing: a crossbar written with a gap above its stem counts as
  a mark (it may hang, bounded, rather than set the side).
**Chose (the hook, `spacing/history_hook.js`, and integration):**
- A letter with no owner becomes "auto" in the hook when a Simple step gives it its first ink
  (measured ink, so a part made from an empty letter is not ink), so every way of inking a letter
  (trace, shapes, paste, later the brush) is covered in one place.
- The refit moves the view by what it moved, so the ink and photo stay still on screen and the
  edges come to the ink.
- All tools never writes a flag on a letter without one and flips only letters already "auto".
  A letter left exactly where the fitter puts it stays "auto" ([Fix it] fits an automatic letter
  instead of guessing a width). A letter's earlier state is measured with the font's letters, so
  ink that comes only from another letter (a component) is not read as "moved".
- The photo follows a left-edge drag in Simple only; in All tools it stays put, as before B3
  (the "All tools as today" rule; UX-BEGINNER 7.2 names no mode). The fitter's own moves (a
  refit, the slider) always move the photo.
- Automatic letters made from the changed letter (components) are refit in the same step, as
  "parts" of it: one item entry per refit letter under the open letter's, all with one step key,
  no whole-font copy. One press undoes or redoes the whole step in both modes, a crash restore
  keeps it, and the 200-step limit counts it once (a whole-font copy per step had let 31 nudges
  push every older step out, with an 18 MB backup).
- In Simple every whole-font step ends with every automatic letter at its fit (Use it on a
  letter holding a part made from another letter left it off its fit), and moving the
  small-letter line or the grid with automatic letters on the page is one whole-font step about
  no letter, refit inside it.
- A dropped or pasted SVG is placed (upstream's side bearings) before its step is recorded:
  upstream recorded first, so Redo lost the placing and Simple's refit was undone by it. This also
  changes Redo in All tools (it now gives back the placed shapes); Gate 2 to confirm.
**Because:** letters he makes must type correctly with no tuning (principle 5), and nothing he set
himself may move behind his back.
**Strongest objection:** placement and spacing now go well past the spec's literal rules, with
thresholds tuned on generated handwriting pages (seven hands, tilts to 6 degrees, rows shrinking
to 60 %), so real photos may find cases they miss; and every spacing rule now reads the slant and
the body, so a letter's sides are no longer its plain ink box.
**Revisit if:** real handwriting photos land letters more than 2 % of the letter box off the line
(B11's limit) or rows off size by more than 10 %; a dropping f alone keeps landing off; Brennan
fixes automatic spacing by hand on most letters (D-031's measured-spacing fallback); or a hand
whose letters lean very differently still opens holes.
