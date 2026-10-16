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

## D-035: B4 and B5 build choices (house words, one toast voice, the mode switch)
**Decided:** 10/14/2026, during B4 and B5 (UX-BEGINNER.md 2, 4.0, 4.9 to 4.11, 6, 7.6, 7.7, section 10
B4 and B5): five tracks (B4 core, toasts, display points; B5 core, wiring) and their integration.
Where a choice goes past the spec's literal words it says so.
**Chose (words, `src/anyink/words`):**
- One gatherer, `words.js`, over `sets/*.js`, one file per owner; a key defined twice stops the load,
  and `word()` throws on a missing key or value, so a typo fails a test instead of a screen. The
  integration added a seam test that every key the code asks for by name exists.
- The scan matches whole words, their plurals and (finalize) their -ed and -ing forms ("glyphs",
  "kerned" and "snapshotted" hit; "Advanced" doesn't; "kerning" is its own term). A quote entry's
  text is exempt but its hint is scanned; `placeholder` and `alt` are scanned with `title` and
  `aria-label`. Toasts are scanned in Simple only: All tools keeps Glyphr Studio's wording for
  messages Simple never shows.
- Two glossary comparisons were reworded because the spec's own used a banned word: "The level
  knob on an audio noise gate" (ink cutoff) and "How far a typewriter carriage moves" (letter
  width).
- A surface with hits could be parked as `pending` (the test then asserted the hits were still
  there). The integration re-enabled every parked scan; none is left.
**Chose (one toast voice, `src/anyink/toast`):**
- Every `showToast` goes through one queue. All tools looks and times toasts as before; only these
  changed to house words there, because both modes share them: Merge ("Merging the shapes...",
  "Merged the shapes"), the two backup-copy toasts and the shared photo toasts.
- Simple never shows "No more undo/redo", "Navigated without undo-ing", Ctrl+R's rounding note or
  the Saved toast (the save status says it). A message with no words key is dropped in Simple and
  written to a hidden element whose text says "upstream", so the banned-word scan fails any Simple
  flow that drops one.
- The export check toast, in Simple, is one toast in the queue in the export's group, with [Show me]
  as its own button and the file and folder names as quotes, so it takes the place of "Exported
  ..." and its button is never lost while it waits (integration). The export's 2.5 s close leaves a
  Simple toast to the queue (it used to close the check toast that replaced it).
**Chose (shared display points, both modes):**
- Canvas guide labels, drag readouts, the File menu, the save status, the strip labels and Samples
  menu, the notices and every B1 string say the house words in both modes. Readouts read "label
  value" with no colon ("right space 88"); the tail line is never negative; a pointed-at edge's
  readout replaces the edge's own label (it used to draw over it, "Left sedge 0"). File names keep
  their look: the quote span adds no visible quotation marks. The install button says "Install".
- The empty preview ("Type something to see your letters here.", the strip and the Overview) and the
  update notice's reasons (pwa/checkpoint.js: "Couldn't save a backup copy of every open font. Press
  Save, then press Reload again.") are house words in both modes (integration).
**Chose (the mode switch, `src/anyink/mode`):**
- 6.2's tables list today's controls by the ids the code already uses; an id the table doesn't know
  shows in All tools and is hidden in Simple. Screens filter where they are drawn; the table of
  contents, `panelForPage` and `navigate` stay unfiltered. Simple hides all 9 panels at `makePanel`
  (6.2 says the panel chooser and all 9 panels).
- The landing rule runs at the top of `Navigator.navigate`, before the page is drawn (the spec put
  it in `makeAppTopBar`, which runs after the page is built). A landing visit ends on its own when
  he arrives back on a page Simple shows; More tools turned on deliberately stays on. The band shows
  only after Simple has been on, so the launch default looks as it does today.
- One key map in both modes: P picks the Point pen and E Edit points in All tools too (7.6); B keeps
  upstream's Edit points until `brush` is on; layer-order keys, Ctrl+Space and Ctrl+G are off in
  Simple; Ctrl+O opens the work file picker in both modes, asking "Your work has changes that aren't
  saved. [Save] [Cancel]" first, and "Saved. [Open a font...]" after Save (a new click). Simple's
  Ctrl+Space release changes nothing; All tools keeps upstream's release, which leaves the tool
  unset after Ctrl+Space (an upstream bug, not fixed here).
- Shape-level flips are hidden in Simple (the letter-level flips stay). The item chooser, the File
  and Help menus, the check line and the start-page tabs stay in Simple until the B that replaces
  each one lands.
- Simple's strip hides Real font and Guide lines (6.2 Strip) and treats them as off while hidden;
  the prefs are kept for All tools (integration).
- While the band shows, `--anyink-band-height` (36 px) is set on the page and the viewport-sized
  lists of content-pages.css take it off, so they don't scroll inside by the band's height
  (integration).
**Chose (integration: Simple words on the upstream pages Simple still shows):** so the scan finds 0
hits on every Simple page that exists (UX-BEGINNER 2.3 "Done when"), each until the B that replaces
it: the letter page's tool and view tooltips ("Rectangle (R)", "Fit letter", "Dark paper", "Outline
only") and its letter button ("Letter" over "small a", sentence case), until B7; letter tiles
("small a", then "Not made yet. Click to start it."; no id) and the Overview (the welcome only, no
project card with numbers and a door to Settings), until B10; the letter chooser offers letters only
(no joined letters or reusable parts) and no codes, until B7 and B10; Help shows its first tab only,
in house words, until B15's Help; the start page's Load and Examples tabs, "Recent fonts" and the
Recover card (sentence case), until B13; Simple's save status never shows a browser's own error
sentence. All tools keeps Glyphr Studio's words on every one of these. Tool and view buttons carry
`data-anyink-tool` / `data-anyink-view-tool`, so checks find them by id, never by their words.
**Chose (critic, fix and finalize passes, 10/14/2026):** a critic pass re-ran every track's findings
in real Chrome and jsdom; three fix tracks (words, toasts, mode) and a finalize pass fixed every
open finding with a test that failed on the old code first.
- Toasts in Simple: info toasts wait their turn, so an error toast always gets its 6 s; toasts
  that follow one another share a group and replace each other at once (`drop`: the drag-over hint,
  drop and paste results, photo toasts; `file`: open, save and recent-font toasts; `export`: the
  font file's toasts, the folder row's included; `toolSwitch`; `merge`). The same words again
  refresh the toast showing. An offer (an info toast with a button: the backup copy's [Save], the
  export check's [Show me], "No folder picked [Pick a folder...]") comes back after an undo toast
  pushes it aside and survives Esc and page changes, until its time is up or (finalize) its font
  is no longer the open one (`stillGood`: then it goes at the next clear, never shows from the
  line, and its button does nothing). The buttons of undo, destructive and automatic toasts end
  when a newer toast replaces them: they belong to the newest change.
- A press on the letter canvas leaves Simple's toasts alone (finalize; the toast track left it as a
  question): 4.0 gives every toast 6 s and makes info toasts wait, so a tool key's "Switched to
  Oval (O)" waiting behind another toast shows after it instead of being lost to the press that
  starts drawing. Esc and page changes still clear them; All tools clears on a press, as before.
- Photos in Simple before B9 (`trace/photo_gate.js`): a new photo is turned away ("ANY-INK can't
  use photos yet. Draw the letter with the Rectangle, Oval or Point pen for now.") and the drop
  and paste hints offer drawings only; a photo already in the font (put there in More tools) is
  neither drawn nor grabbable in Simple (finalize: nothing on a Simple screen could hide, remove or
  trace it, and it never goes in the font file). B9 turns 'photo' on and the gate opens; the
  real-browser checks that stand in for B9 (`b23`, `mode-fixes`) turn the flag on in the page.
- The start page's Recover card in Simple (until B13): Discard on a backup copy with no work file
  asks "Throw away this unsaved work? This can't be undone. [Throw it away] [Keep it]" (7.4 #1);
  Keep it is the one green button and closing the box keeps the work; the Recover tab says
  "backup copy". Finalize: each start page tab has one green button, and while the banner offers
  a backup copy its Restore is the one green (every tab button outlined); the Recover tab hides
  the banner; New, Load and Examples say font and work file (`start.*`); the drag note says "Drop
  it here"; a file the drop target can't take says 7.7's words (a drawing, an unreadable font
  file, a work file that won't open); bringing in a font file says "Bringing in letters... N of
  M"; the Windows Open and Save boxes call a .gs2 an "ANY-INK work file".
- Plain error boxes (finalize, `words/error_box.js`): in Simple every error box a file command can
  raise says the 7.7 sentence from `error_words.js` with its buttons (the first green): Save
  failed [Try again] [Save somewhere else], the file changed on disk [Save as a new file], a work
  file that won't open [Open another work file...] (Ctrl+O's command), the font file [Try again],
  anything else [Close]. The browser's own sentence goes to the console. All tools keeps
  upstream's box. The strict scan (2.4 E and G: no "project", no block names, no codes) is on by
  default for every Simple scan.
- Making a font file in Simple (until B14's Use in Word): before the folder picker opens the first
  time a toast says what to pick; a cancelled picker says "No folder picked. ..." [Pick a
  folder...], which makes the font file in that click; a refused folder says "Couldn't write to
  "Fonts". Chrome may need your OK." as the picker opens again; after a file lands in its folder
  with nothing to fix, the next step follows: "To use it in Word, open "Fonts", double-click
  "X.otf" and press Install." The File menu's "Choose where font files go..." stays in Simple
  until B14 (6.2 hides it; without it a folder picked once could never be changed).
- Ctrl+O (finalize): the picked font takes the place of the font he is in (the one the unsaved
  check guarded), never the app's import target, which with two fonts open can be the other one;
  it asks first whenever the work file doesn't hold the latest change (ink the file lacks, or,
  while the status isn't Saved, any real History step: a photo, a rename, a guide line), not
  only for ink; a backup copy is written before the font is replaced.
- "Saving..." (finalize, 4.11): the autosave's queued write (about 3 s after a change, D-030)
  marks the save status queued, so Simple says "Saving..." from the change until the write ends;
  only a font with a work file has a write to queue. A change queues the write whether or not
  crash recovery started (D-030: the two are independent).
- Simple keeps the page chooser (its four pages, "All letters / One letter / Help / About ANY-INK")
  until B6's rail ('coach') replaces it; 6.2 says "Not shown at all", but until the rail exists
  Help and About would be dead ends. Finalize: Help and About also get [Back to my letters]
  (principle 7). Simple's Help is one "Help" tab in a few sentences (pick a letter, the tools with
  the keys Simple has, Undo, Save and Open, the font file, the full manual said to use pro words)
  until B15. About keeps every credit; Simple shows the Glyphr Studio credit in house words, the
  libraries' own names as quotes and no "This project" card. All tools' Help > Keyboard shortcuts
  lists the tool keys and Ctrl+O as `keys.js` has them (P New Path, E Path Edit, Ctrl+O opens a
  saved project file), in Glyphr Studio's words.
- Keys (mode track): in Simple B picks nothing until B8's Brush (Edit points would have two keys
  and B would change tool later); Ctrl+R is off (tidy points is automatic, so Chrome keeps its
  reload key); Ctrl+E makes the .otf until 'useInWord' (the one font file row Simple shows); the
  "Switched to" toast names the key the tooltip shows (H and W say P). Simple's File menu gets
  "Open a saved font..." (Ctrl+O) now; "Start a new font..." waits for B13 (a door to a start
  screen that doesn't exist yet would break principle 8). Letter tiles' tooltips come from the
  letter's ink ("Not made yet. Click to start it.", "Changed since you opened the font."), the
  tile's own font's letter (finalize).
- Changes All tools gets on purpose, because they fix results (Brennan to confirm before Gate 2):
  Delete or Backspace with nothing picked records no Undo step; a side edge's drag or nudge stops
  at width 0; the left edge of a letter with no shapes doesn't move (finalize: it moved the right
  edge instead); Save as shows two key chips (`Ctrl+Shift`, `s`) so they don't wrap; a strip
  toggle (a checkbox) with focus no longer swallows Ctrl+Z, Ctrl+S, Ctrl+E and the tool keys; the
  strip redraws after every change (a rectangle added left its empty-sheet sentence over the new
  letter); neighbor names stop being links once they aren't drawn.
- Finalize, smaller choices: in Simple the space and the no-break space are made a quarter of the
  letter box wide when opened (the width the font file gives them), so opening the space never
  needs fixing; an Undo or Redo that changes a letter while Help, About or the Overview shows says
  which ("Undid: added a rectangle on Capital B [Show Capital B]", kind undo; B6 adds the general
  undo toasts); a work file dropped off a letter page says Ctrl+O; the strip's tooltip says
  nothing over the letter already open; a mode switch on the start page keeps the typed font name
  and the tab; in Simple the install offer waits until a font is open (B13 moves it to after the
  first ready letter).
**Rejected:**
- `it.skip` for parked scans: a skip never says when its surface is clean.
- Letting a tool key's toast replace a plain info toast at once (finalize): that needs every error
  toast marked so it isn't replaced, and 4.0 says info toasts wait their turn; keeping Simple's
  toasts through a canvas press shows the tool toast in its turn instead.
- A "Take the photo off" action in Simple before B9: UI for a screen B9 replaces; not drawing the
  photo is enough (it never goes in the font file).
- Hiding the letter chooser's range switch in Simple: a second letter set enabled in More tools
  would then be unreachable; codes are dropped instead.
- Blocking a page Simple hides: 6.3 says landing is never blocked.
**Why:** principle 2 (plain words, the scan at zero), principle 8 (no doors to unbuilt rooms), 6.1
(All tools as it is today, apart from the shared display points).
**Affects:** `src/anyink/words`, `src/anyink/toast`, `src/anyink/mode`, `files/open_font.js`,
`files/autosave.js`, `trace/photo_gate.js`, the upstream files listed in TEST_LOG's B4 + B5 rows; B6 (undo toasts, the More tools button calls
`turnOnMoreTools`, toast placement), B7 (`tool.*` words, Fine-tune door), B9, B10, B13, B14, B15
(`setGuideLinesMoving`, Help keys from `keysShown`).
**Revisit if:** a later screen can't be worded without a pro term (the exemptions would have to
grow past quotes and pro-word small print), upstream adds a toast or a control (the inventory and
toast-map tests fail until it is classified), or B16 flips the launch default (the band's
"only after Simple" rule and the All tools snapshot change then).

## D-036: B6 and B7 build choices (top bar, Next line, undo toasts, the letter view)
**Decided:** 10/14/2026, during B6 and B7 (UX-BEGINNER.md 4.0, 4.3, 4.11, 7.2, 7.3, section 10 B6
and B7): five tracks (top bar, coach, letter card, letter canvas, letter tools) and their
integration, which turned on `coach` (B6) and `letterView` (B7) and checked the seams in one Simple
screen in real Chrome (`tests/b67.verify.mjs`). Where a choice goes past the spec's literal words it
says so.
**Chose (B6, the frame):**
- Undo and Redo grey out with `aria-disabled` and a tooltip that says why ("Nothing to undo yet"),
  not `disabled`, so the reason still shows on hover. History names every press itself
  (`history.js` calls `sayUndone`), Ctrl+Z and the buttons alike, once per press; the Redo toast has
  no button (on the board it has [Show me]); an undo toast takes the place of an automatic one
  ("Made shape 2 a hole") at once, as 4.0's kinds say.
- The Menu's stand-ins reuse the visibility ids of the rows they stand for (`file.font-otf`,
  `file.font-folder`, `help.help-page`) until B14 and B15 land; error boxes open under the bar's
  first row; the rail is a `div` with `role="navigation"` (upstream styles and reads every `<nav>`).
- App notices sit inside the bar's flexible gap between the rail and Undo
  (`data-anyink-slot="notices"`), centered on its row; next to the status pill they covered Undo.
- Next line: rule 9 also speaks in the letter view once no letter is empty; rule 10 fires on "Not
  saved yet" and "Couldn't save", not "Saving..."; rule 6 says the font check's own sentence (D-032);
  rule 8 names only the ways to fill a letter that exist (before B8 and B9: "Draw it with points");
  rule 15 never suggests the letter already open; a change counts only when the save status counts a
  step and a letter changed. In Simple the strip's font-check line is gone (the Next line says it),
  as 6.2 lists.
- The Tip line keeps its room while no tip shows. A tip goes after his next press, and the page
  moved 22 px under the pointer when it did, so the second Point pen click landed off; the line
  under the sentence is now always one Tip line tall (an empty band when there is no tip).
- `coach.css` gives its rules an id's weight (`anyink-coach:is(*, #anyink-coach-weight)`) so the
  bar's button rule never takes the green off the line's button. Narrowing the bar's rule instead
  was tried in integration and dropped: the line's buttons lost `margin: 0` and the row grew 1.6 px
  when a button came, moving the page.
- Simple's toasts sit just above the canvas's zoom bar on the letter page (CSS anchor positioning,
  Chrome and Edge, D-001), and above the strip elsewhere; at the strip they covered the zoom bar
  and, inside Fine-tune, the view switches for their 6 s.
- One letter set for the app: `src/anyink/board/letter_set.js` (B10 owns it and adds the settings
  step); the rail's count, the Next line's order and the header's ‹ A / C › read it. "Ready" is
  "has ink" until B11.
**Chose (B7, the letter view):**
- Fine-tune is closed by default and stays as he left it for the session. On a letter with no
  shapes its edges, neighbors and switches stay hidden even when open; its tools still show (they
  are how ink gets there). The letter header's steps add no Undo step. The four switches replace
  upstream's Outline and Dark paper view tools (`visibility.js` replacedBy 'letterView').
- The side edges move only while they show: with Fine-tune closed they lock (`mode/locks.js`), and
  with a drawing tool picked (Point pen, Rectangle, Oval, later the Brush) a press there draws. In
  Chrome a Point pen click landed on the left edge, which automatic spacing had moved under the ink,
  and dragged it.
- The Point pen in Simple: every point placed is its own Undo step, a plain click too (upstream
  records a point only when the pointer moves while pressed, so a clicked shape left no step: the
  work file never showed changed, spacing never ran, Undo couldn't take it back). Closing the shape
  on its first point finishes it as the button does (first width, "Finish the shape" goes); the
  step a closing drag makes is "bent a curve" (upstream's "Added new path" would say "Undid: added a
  shape" while the shape stays). While a shape is open "Finish the shape" is the screen's green
  button, and the font check waits until it is finished (it said "small a has ink but no width"
  with [Fix it] mid-shape). All tools keeps upstream's Point pen.
- Auto-hole: odd nesting depth is a hole, even is solid; only the new shape is turned round, a
  shape that only overlaps a solid takes its direction, brush strokes never change. A Point pen
  shape is judged once finished, never mid-draw. The Solid / Hole switch shows on the picked shape
  only when Hole would act (`canBeHole`): a shape with nothing around it can't be a hole.
- Neighbors: his n beside small letters and marks, his H beside capitals and numbers (numbers stand
  on the capitals line), drawn view-only in `letter/neighbors.js`, not by upstream's context
  characters (they are saved in the font). The first-time label and the switch's tooltip name the
  letter in full ("Your small n, shown for comparing"; 2.2), where the spec says "Your n". The
  Neighbors switch isn't there until his n or H is made.
- Upstream's lowercase `'components'` page check in the shape tools never ran; turned on as written
  it would name a part's shapes after how many parts the font has, so the dead branch was removed
  and names stay as they are in both modes (the spec said "fix"; Brennan to confirm).
**Changes All tools gets on purpose (Brennan to confirm before Gate 2):** closing a Point pen shape
on its first point with the pointer moving no longer throws in `path_edit.js` (it read a point it
was never given); the handle bends as upstream meant.
**Rejected:**
- A Tip line that floats over the page: it would cover "← All letters".
- Deferring the font check while drawing in All tools too: All tools stays as it is (6.1).
- Leaving the B5 tests that describe Simple "with no flag" to fail: they now pin every flag off
  (`mode/tests/no_flags.js`), so the stub path stays checked.
**Why:** principle 1 (one green button), 6 (say what happened), 7.3 (every change one named step),
4.3 ("the drawing never jumps"), 6.1 (All tools as it is today).
**Affects:** `src/anyink/topbar`, `src/anyink/coach`, `src/anyink/letter`, `src/anyink/board`,
`history/undo_toast.js`, `mode/locks.js`, `mode/visibility.js`, `fontcheck/font_check.js`,
`pwa/notice_place.js`, `preview/preview_strip.js`, `toast/toast.css`; upstream `history.js`,
`menu.js`, `characters.js`, `panels.js`, `edit_canvas.js`, `tools.js`, `new_basic_path.js`,
`new_path.js`, `path_edit.js`; B8 (`shape.anyink.strokeId`, the Brush button, `nib` locks the
edges), B9 (`anyink-trace-again`, Fine-tune > Photo, the overlay's photo buttons), B10 (the letter
set's settings step, "← All letters" scrolls to the tile), B11 (Ready, "Needs a look"), B12 (the
Try-it text starts as the font name), B14, B15 (the doors in `topbar/doors.js`).
**Revisit if:** the Tip line's empty band reads as a gap in the Gate 2 walkthrough (then a fixed
two-line Next line with the tip beside the sentence), a later B adds a drawing tool (add it to
`DRAWING_TOOLS` in `locks.js`), or Chrome drops anchor positioning.

## D-037: B6 and B7 finalize choices (one ink rule, the Point pen's edges, stale toasts)
**Decided:** 10/14/2026, in the B6 + B7 finalize pass, after the critic pass and the four fix
tracks (top bar, coach, letter card, letter tools) left 14 findings open and 7 new problems; each
is fixed with a test seen failing first (UX-BEGINNER.md 4.0, 4.2, 4.3, 7.1 #5, 7.2, 7.3, 7.6,
principles 1, 5 and 6). Where a choice goes past the spec's literal words it says so.
**Chose:**
- **One rule for ink, Ready and empty** (`board/letter_set.js`: `inkOf`, `hasInk`,
  `finishedShapes`, `isEmptyLetter`), read by the rail's count, the Next line, the letter card's
  chip and the empty overlay. Ink is finished shapes with an area; the shape the Point pen is still
  drawing (`coach/open_shape.js openPathOf`) is no ink on any page. Empty is no finished shape, so
  a letter whose only shape is a stray line is neither empty nor Ready: the card says "Empty" and
  lists the shape, the overlay steps aside, and the Next line's rule 6 names the shape with the
  one green [Fix it]. The coach leaves out the font check's "ink but no width" for a letter with
  no ink (it is never true there); the check itself, and All tools, are unchanged. The rail's
  count is said again when the Point pen lets go of a shape (`whichToolIsSelected`), since
  "Finish the shape" records no step.
- **Principle 1's one exemption:** a drawing tool picked on an empty letter, before its first
  point, has no green button; the Next line says where to click or drag. Written into principle
  1, 9.3 and 9.4. The screen probe counts upstream's green `fancy-button` as a green button
  (Help's and About's "Back to my letters"); the Fix box's first button also carries
  `.anyink-primary`.
- **The Point pen's edges:** a shape that ends with 1 or 2 points and no curve (the font check's
  stray rule) is taken away as one step ("removed a stray shape from small a") with the automatic
  toast "A shape needs at least 3 points, so that one was taken away." ("... the one on small e
  ..." when he is leaving it); the Point pen stays picked. Leaving the letter view, or opening
  another letter, mid-shape ends the shape on its own letter before the view moves (finished from
  3 points), from `Navigator.navigate` and `ProjectEditor.selectedGlyphID` (`leaveLetter`); the
  step is the letter view's even when the page is already set to where he is going. The spec
  said nothing about a shape too small to keep; leaving it made a stray line that the card, the
  rail and the coach read three ways.
- **The Point pen through Undo:** points measured from the first point match within 1.5 font
  units (B3 rounds each point at the first step with an area, which moves an offset by up to 1);
  an Undo during a press matches the shape without the unrecorded point and ends the press, so its
  release records nothing; a press with no shape held starts one. "Finish the shape" on a shape
  merged into the hole it crossed picks the merged hole.
- **Stale toasts** (`toast/queue.js`): a toast whose stillGood says no keeps no place: the next
  toast shows at once and the stale one is never put back in the line; `sweep()` takes it down at
  the next step (`toast.js dropStaleToasts`, called by `undo_toast.js` on the save status event).
  A toast with a button or a stillGood is drawn anew even when its words repeat, so two like Undo
  presses each own their [Redo]. Destructive toasts' [Undo] (`undo_toast.js undoOffer`) takes back
  their own step only while it is the newest change.
- **Delete says what it took** in Simple (7.3): "Deleted a shape from small n." / "Deleted 2
  points from small a." [Undo] (`letter/delete_toast.js`, called from upstream `actions.js`).
  A Shapes row lets go of picked points, and with Edit points picked and a shape picked but no
  point, Delete takes the shape (7.6 "a picked shape or point"); All tools as before.
- **Space** on a button or link focused from the keyboard (`:focus-visible`), outside the edit
  canvas, presses it in Simple ("1 Letters", the logo, Undo, "<- All letters"); a button focused
  by a mouse click keeps Space as hold-to-pan, so Space right after a click on Undo never undoes
  again. All tools keeps upstream's Space.
- "Back to my letters" on Help and About goes where "1 Letters" goes once the Simple top bar is
  on (`topbar/letters_page.js`); with every flag off it opens Simple home, as in B5.
- **The Next line:** rule 6 shows the first font problem not skipped and every problem keeps its
  own skip, so a skip lasts while another letter's problem shows first; while a Point pen shape is
  open in the letter view the drawing line comes ahead of rule 6; rule 8's "empty" is no finished
  shape.
- **Tips:** the tip sits beside the sentence in one 41 px row (the coach fix track's choice,
  which D-036 named as the alternative to the empty Tip band; it supersedes D-036's band). The
  Edit points tip is "Drag a point to reshape it. Press Smooth to round a corner." (4.3 said "Drag
  a round handle to bend the curve"; a clicked shape has none). The Point pen's tip stays while
  its shape is open; any other tip goes after his next action.
- **Spacing:** in Simple a letter starts automatic at its first drawn shape (a path with a point,
  a Point pen click), not only at its first ink, so every step of the shape holds the flag (the
  card never says "Set by you" on a letter he has just started; an Undo mid-shape keeps it); a part
  made from another letter counts only once it brings ink (D-034); an old letter that had a shape
  and no owner is never touched.
- **Auto-hole** (supersedes D-036's "only the new shape is turned round"): the role comes from
  what shows under the shape; a join that rings an island keeps the island as a shape of its own
  running the other way (`unite_shapes.js`), so it shows what it showed; when no two of the solids
  under a new hole can be joined, all of them are joined as one group when that is safe as a group.
- **Font check:** it waits for an open shape only in the letter view (`font_check.js`), so it
  runs on the board.
- **The strip's Try-it text** starts as the font's name in Simple once the Next line is on (4.0
  Preview strip; B12 owns the rest of Try it), by the coach's own rule (`defaultTryItText`), and is
  not written to the prefs; All tools, and Simple before B6, keep the sample sentence.
**Rejected:**
- Counting a stray line as "no ink" in the font check itself: All tools' strip would change.
- Leaving a 1- or 2-point shape as a stray line: the card, the rail and the coach disagreed about
  it, and "Finish the shape" gave the letter a width with no step.
- Taking a too-small shape away with no step: the next Undo would bring back a state that was
  never on screen.
- Space on any focused button: Chrome keeps the focus on a clicked button, so Space-drag right
  after a click on Undo would have pressed it again.
- Matching the Point pen's shape by its place in the list and its point count alone: a shape
  another tool drew in that place could be taken for it.
- A green button for "drawing tool picked on an empty letter": it would repeat what the paper
  does, and two ways to begin is the confusion principle 1 is for.
**Changes All tools gets:** none. Every change above is behind `isSimpleMode()` or on a
Simple-only screen; `tests/b67.verify.mjs` F still finds the same controls and 0 of 1,440,000
pixels changed.
**Why:** principles 1, 5, 6 and 7; 7.2 (results that can't come out broken); 7.3 (destructive
actions use an Undo toast; every change one named step).
**Affects:** `board/letter_set.js`, `coach/open_shape.js`, `coach/font_facts.js`, `coach/rules.js`,
`coach/tips.js`, `coach/coach_state.js`, `coach/dom_probe.js`, `topbar/ready_count.js`,
`topbar/simple_top_bar.js`, `letter/letter_card.js`, `letter/empty_overlay.js`,
`letter/pen_follow.js`, `letter/auto_hole.js`, `letter/unite_shapes.js`, `letter/delete_toast.js`
(new), `history/undo_toast.js`, `toast/queue.js`, `toast/toast.js`, `mode/back_to_letters.js`,
`fontcheck/font_check.js`, `spacing/history_hook.js`, `preview/preview_strip.js`,
`words/error_box.js`, word sets `letter.js`, `letter_tools.js`, `coach.js`; upstream
`new_path.js`, `navigator.js`, `project_editor.js`, `actions.js`, `events_keyboard.js`; B8 (keep
brush strokes out of the drop rule: a stroke has curves, and `anyink.strokeId` marks it), B10 (the
board replaces the Overview stand-in the rail and "Back to my letters" go to), B11
(`readyCount(project, { isReady, open })`), B12 (Try it reads the same text).
**Revisit if:** the drop toast reads as a scolding in the Gate 2 walkthrough (then keep the pen
open and say "Click at least one more point"), B8's Brush makes 1- or 2-point strokes without
curves, or the board replaces the Overview stand-in.

## D-038: B8 build choices (the round Brush)
**Decided:** 10/15/2026, by the B8 brush track, recorded by the B8 + B9 integration
(UX-BEGINNER.md 4.3 Tools and Brush, 7.1 #4 and #5, 7.3, section 10 B8; D-014, D-015, D-024;
RESEARCH 2.3). Every number below is measured in `src/anyink/nib/tests` and `tests/nib.verify.mjs`.
**Chose:**
- **Pointer events only** (D-014): main button or pen tip; nothing for the middle button, the
  eraser, a second finger or Space-pan; a stroke is dropped when the press is cancelled or the
  letter changes mid-press. Coalesced samples are all used.
- **The center line:** the 1€ filter per channel in screen pixels (min cutoff 1.5 Hz, beta 0.02,
  d-cutoff 1; it catches up when the pen stops, so the stroke ends where the pen did); simplify-js;
  split where the pen turns more than 65 degrees at one point; fit-curve with the tolerance in
  half-tolerances (that brings back Schneider's "refine within twice the tolerance" step: a round
  dot went from 12 curves to 4); whole font units.
- **The ink** (D-015): a 24-sided round nib swept along the center line, one hull per step, all
  hulls united with clipper2-ts; ink runs counterclockwise and holes clockwise (D-024); the refit
  keeps corners only at notches; a point is smooth only when its handles are exactly in line
  (otherwise upstream adds fractions when the letter reloads). Inking an S stroke takes about 12 ms.
- **The live picture:** perfect-freehand along the same center line, only while the button is down
  (RESEARCH 2.3), on a see-through canvas over the edit canvas, cleared the frame after the ink is
  drawn; cut into pieces with a round dot on each end where perfect-freehand leaves paper gaps
  (sharp bends, curls tighter than the nib). Picture vs ink: within 2 % of the stroke width (1.0 to
  1.9 % measured in Chrome, in font units). The older part of a stroke can still shift about 2 % of
  the width as it refits while drawing (about 1 px at normal zoom); freezing it is left for M10.
  *Amended 10/15/2026 (the B8 + B9 fix pass and finalize, D-041):* the samples are smoothed along
  the line before the fit (smooth.js), the center line is built as the samples come in and its
  settled front is frozen (skeleton.js), so the picture no longer shifts, and the nib pieces are
  joined 8 at a time; a stroke record also keeps key and parts, each shape strokeKey and
  strokePart, and pasted copies become strokes of their own.
- **What a letter keeps:** each stroke is its own shape (two or more for a stroke with a hole),
  tagged `shape.anyink.strokeId` and named "Brush stroke N"; its center line is kept in
  `glyph.anyink.nib.strokes` `{ id, nib: 'round', size, skeleton, at }`, so M10 can ink it again.
  Strokes never go through auto-hole and are never merged (Merge leaves them out, D-040); they
  merge only at M10's "Turn into shapes".
- **One Undo step per stroke:** "drew a stroke on small a", in both modes.
- **Size:** 9 % of the small-letter height by default, 3 % to 24 % on "Size: thin --o-- thick";
  an app pref, never an Undo step (it changes the pen, not the font).
- **Both modes** (7.6, B5's `visibility.js` and `keys.js`): the Brush button in All tools sits
  after New path; B and N pick it in both modes (B picked Edit points in All tools before B8).
- **Libraries** (FACTCHECK_LOG, pinned exactly): clipper2-ts 2.0.1-18 (BSL-1.0), perfect-freehand
  1.2.3 (MIT), 1eurofilter 1.3.0 (BSD-3-Clause); fit-curve 0.2.0 (MIT) and simplify-js 1.2.4
  (BSD-2-Clause) vendored as ES modules under `src/anyink/nib/vendor/` with their license text.
  Credited on About; their license texts ship as `src/public/THIRD-PARTY-NOTICES.txt` (D-040).
**Rejected:**
- perfect-freehand for the final ink: its outline is a picture, not whole-unit curves that M10
  can re-ink (RESEARCH 2.3).
- Merging a stroke into the shapes it crosses: a traced letter's shapes would change under a
  brush stroke, and M10 could not re-ink the stroke alone.
- Mouse events for the Brush: no pen pressure, tilt or coalesced samples later (D-014).
**Why:** 7.1 #4 (dragging must draw), principle 5 (whole numbers, good defaults), 7.3.
**Affects:** `src/anyink/nib/` (new), `words/sets/brush.js`, upstream `tools.js`, `events.js`,
`events_mouse.js`; M10 (nibs, Edit strokes, Turn into shapes).
**Revisit if:** the picture vs ink passes 2 % at a zoom Brennan uses, a pen tablet makes strokes
the filter lags behind, or M10 needs the skeleton frozen while drawing.

## D-039: B9 build choices (photos: parts, the registry, the paper, the screens, the flow)
**Decided:** 10/15/2026, by the B9 photo-core, photo-ui and photo-flow tracks, recorded by the
B8 + B9 integration (UX-BEGINNER.md 4.4, 4.5, 7.3, 7.7, section 10 B9; D-016, D-023, D-029,
D-034).
**Chose (photo-core):**
- **Parts** (`photo/ink_parts.js`) follow B3's stand-in rule (`placement/tests/ink_parts_lite.js`)
  with five changes, each caught by a test: a speck is a piece under a quarter of the stroke
  squared that sits over or under no other piece (B11's rule; a share of the photo's area dropped
  a felt-tip i dot on a big page and the periods of a scan); the typical letter height counts only
  pieces at least 3 strokes tall; a piece touching the photo's edge is dropped when it is more
  than 3 letter heights long, or a letter height long with a stroke unlike the pen's (a table or a
  frame line); two dots join only when one is right over the other (". , ' ? ! - : ;" stay
  apart); rows allow for a tilted page. Masks are never saved; `attachMasks` finds them again.
- **The registry** `settings.anyink.photos[assetId]`: parts, which letter used which part (and in
  what order), skipped parts, done, the one scale, the paper and light-ink settings, how the parts
  were found (`find`, fixed when the photo came in) and a byte fingerprint (two FNV-1a passes), so
  the same photo added twice keeps one image id. A box he draws and uses covers the parts with
  60 % of their box inside it. The guess is the first part not used, skipped, drawn or covered; the
  alphabet prefill follows two neighbours (a, b -> c).
- **Paper** (`paper_kind.js`): a camera shot needs 2 of the 4 exposure fields in its EXIF (Make and
  Model alone don't count); otherwise a paper brightness spread over 20 (`PHONE_SPREAD`; measured:
  scans 7 to 8, an evenly lit photo 9 to 16, phone photos 32 to 37) means Phone photo; light ink
  on dark paper is guessed too. EXIF is read from the picked file's own bytes (the stored copy is
  re-encoded WebP and has none).
- **Smooth --o-- Detailed** (`smooth_detail.js`): a frozen 5-row table from smoothing 0.95 /
  detail 0.25 to smoothing 0.45 / detail 0.88, with auto-trace's own defaults (0.75 / 0.6) in the
  middle; neither end reaches potrace's extremes.
**Chose (photo-ui):**
- **The How card** lists the Try-it text's letters once each ("Brennan Hand" -> B r e n a H d);
  [I have my photo] calls the picker inside the press; the card stays open only when the picker
  was cancelled.
- **The photo dialog:** a click picks a part (6 px round it counts); a drag draws a box with a
  crosshair (mouse events: the photo is never on the edit canvas, so the box can't move it), which
  tightens to the ink inside it ("No ink found in that part..." over bare paper); arrow keys move
  the green box in reading order; a letter key pressed anywhere in the dialog lands in the field;
  Enter is Trace it; a box he drew is stored only at Trace it; Escape cancels; editor keys and
  paste / copy / cut are stopped in the capture phase and a dropped file can't open in the tab;
  with nothing left to trace, Done with this photo is the green button and a sentence says why.
  The whole photo fills the dialog, as 4.4 says.
- **The photo card:** steps A and C, Adjust closed at first and remembered for the session; one
  green button (Use it; [Draw a box] when no ink was found; a failure's own fix; else Cancel).
**Chose (photo-flow):**
- **The part's region** is its rectangle with 25 % of its long side (at least 8 px) of paper round
  it; other letters' ink inside it is painted with the paper's middle colour, grown 2 px, never
  over the part; only the part's whole shapes are kept (Simple; All tools keeps the glyph box).
- **Placement** (B3) comes before tracing, with the photo locked during step C; "as traced" is an
  ink print (`photoFit.ink`) that any real edit breaks, so nothing has to remember to clear a flag.
- **Use it** is one step "traced small r": the shapes rounded to whole units, spacing set to
  automatic (even on a letter he had spaced himself) and fitted, the photo faded to 0.25 and
  locked; when earlier letters follow the photo's new size the step is whole-font (applyAutoTrace
  runs through a proxy editor with its Undo steps muted inside one before / after pair) and a toast
  names them. The registry is read again after Undo and Redo (`watchPhotos`), since an item step
  doesn't hold `settings.anyink`.
- **Adjust** re-traces 120 ms after the last change, newest wins; his paper and light-ink picks
  are kept with the photo. **Cancel** at A, B or C puts the letter's earlier photo back and takes
  out photos the screens added that no letter uses, with no step. HEIC is caught by its type, its
  name or its first bytes. Every change publishes 'autoTrace'.
**Rejected:**
- A share of the photo's area as the speck size (see above); joining any two nearby dots.
- Re-reading EXIF from the stored image (it has none).
- Storing a drawn box as soon as it is drawn: Cancel would leave a part behind.
- A flag on a traced letter that edits must clear (the ink print can't be forgotten).
**Why:** 4.4 (one photo makes many letters, one size per photo, plain results), 7.3, 7.7.
**Affects:** `src/anyink/photo/` (new), `autotrace/trace_region.js` (regionFor, keepShapesFor),
word sets `photo.js`, `photo_flow.js`; B10 (drops on the board), B11 (checks per letter), M9.
**Revisit if:** real felt-tip photos (B0's `tests/fixtures/brenna-loose.jpg` and
`brenna-tight.jpg`, still owed) split letters with pen lifts or join touching letters more than
the synthetic fixtures do, ruled paper's lines become ink in Phone photo mode, or the dialog's
whole-photo view makes letters too small to pick on a portrait page (D-040, open).

## D-040: B8 and B9 integration choices (the opening Brush, the photo hub, the seams)
**Decided:** 10/15/2026, in the B8 + B9 integration, which turned on `brush` and `photo` together
and joined the four tracks' screens to the B6 Next line and the B7 letter view (UX-BEGINNER.md
principles 1, 6, 8; 4.0, 4.3, 4.4, 7.2, 7.6, 7.7).
**Chose:**
- **The opening Brush** (`letter/open_tool.js`, `nib/default_tool.js`): in the Simple letter view
  an empty letter opens with the Brush picked and a letter with ink with Select (4.3 Tools), after
  the press that opened it (a microtask: Undo moving to another letter has undone by then); a tool
  picked in between wins, a Point pen shape still open is never cut short, and step C's letter
  opens with Select (when step C starts on the letter already open with a drawing tool picked,
  Select is picked then: found in Chrome, the opening Brush stayed through step C). The Brush picked this way is no choice of his: the empty overlay stays with
  [Use a photo] the one green button, the Next line still says "Use a photo of it, or draw it with
  the brush" (the coach reads no tool for it), and its tip waits; a drag on the paper outside the
  overlay draws at once. His own pick ([Draw with the brush], the tool button, B or N; told by
  `tools.js switchToolTo`) puts the overlay away, the line says "Drag on the paper to draw. Each
  drag is one stroke." and the tip shows. 4.3 asks for both the Brush as the empty letter's
  default and the overlay's green [Use a photo]; this keeps both.
- **The photo screens' hub** (`photo/photo_app.js`, started at boot): rule 11's [How] and Menu >
  How to photograph your letters open the How card; [I have my photo] and [Choose a photo...] open
  the picker in the press (id 'anyink-photo', in Downloads the first time; `trace_import.js
  pickImageFile` is shared); a photo goes in with no step, then the dialog (letter unknown from
  the How card and rule 12, known from a letter), or step C at once for a one-part photo opened
  from a letter; the dialog's Trace it starts the flow; the flow's changes draw step C in the
  photo card; rule 12's [Do the next one] opens the dialog on that photo; [Trace again] opens it on
  the letter's own photo with its part boxed (step A when the photo isn't in the registry). A
  photo that can't be used shows 7.7's words in Simple's error box with its fix ([Choose another
  photo] opens the picker again). Skip, Done and a box he drew mark the work file behind
  (`recovery.js markDirty`), with no step.
- **Light modules for the letter view:** the overlay opens the photo screens through window
  events (`photo/photo_doors.js`), reads the card through `photo/photo_card_slot.js` and draws
  its thumbnail with `photo/paint_photo.js`; `autotrace/preview_draw.js` gets step C's shapes
  registered at boot (`setPhotoPreview`); the hub loads `photo_flow.js` on first use. Importing
  the hub or the card from the letter view made an import loop (the font check's `validate.js`
  still loading when the Next line's actions read it), and the test setup, which loads the app
  shell first, would have loaded the tracer before a test could put its stand-ins in place.
- **The empty overlay** (4.3): [Use the same photo] with its thumbnail and [Choose another
  photo...] when a photo of the font has parts not used yet (done or not), else [Use a photo];
  then [Draw with the brush], "or drop a photo here" and "No photo yet? How to take one"; it hides
  while the photo card runs or step C is on.
- **The letter card:** the Photo card section holds the card's own element while it runs (main
  buttons hidden); the Brush section ("Size: thin --o-- thick") shows while the Brush is picked,
  except while the photo card shows; [Draw over it] goes while the Brush is picked (it would do
  nothing); Merge leaves brush strokes out.
- **Fine-tune > Tail** (4.3, 4.4; the photo-flow track's hand-off): on a letter traced from a part
  of a photo in the photo list whose letter may hang a tail (g j p q y, Q J f), [It has a tail] /
  [No tail], the one it is now pressed (his pick once he made one, else what the ink shows: a tail
  when it reaches more than 5 % of the letter box below the writing line; `photo/letter_tail.js`);
  a press re-places the part at the letter's own scale with his pick (B3 placePart) and moves the
  shapes and the photo up or down together (applyFollow; the left ink edge and the spacing stay),
  storing the pick with the photo, in one whole-font step ("said small g has no tail"), since the
  pick lives in `settings.anyink`; a letter still as traced stays as traced
  (`photo/photo_flow_tail.js`).
- **One green button:** the photo card gives its green up, outlined, while a dialog is open over
  it (the photo dialog from step A or Draw a box, the error box), as the overlay does.
- **The Next line:** rule 3 with nothing to use names the card's green button ("Press Draw a box on
  the card."; the card tells the coach its status and green button); rule 8 has the Brush's
  sentence; rule 12 counts the registry's way (a skipped or covered part is no "more letters"),
  only for photos whose image is in the font. The duplicate "No ink found..." word is one key
  (`photoFlow.noInk`).
- **Drops and pastes** in Simple go to the photo screens (`trace/photo_gate.js setPhotoRoute`):
  a photo on a letter becomes that letter's photo (4.3), never the Trace panel Simple doesn't
  have. The words Simple said before B9 ("can't use photos yet", the drawings-only hints,
  `upstream_map.js withoutPhoto`, `trace_import.js turnPhotoAway`) are gone.
- **Seams fixed:** `project_data/path.js` keeps a shape's `anyink` data (the stroke id) through
  `save()` and the constructor, only when non-empty, so a stroke stays a stroke after Undo, a
  crash snapshot and a save; the work file keeps the image of every photo in the photo list
  (`trace_model.js collectReferencedAssetIds`), not only images a trace uses (D-028), so a photo
  with letters still to name opens again tomorrow; `edit_canvas.js sXcX / sYcY` draw a point on
  the canvas's left or top edge at 0 (upstream's `|| view.dx` drew it at the view's origin: the
  Brush's spikes through the ink); the Brush's cursor is a crosshair from the moment it is picked;
  All tools Help lists the Brush; the photo dialog draws the stored photo (the flow's pixels are
  a plain object that neither createImageBitmap nor putImageData takes, so "Loading the photo..."
  never went away in Chrome).
- **Credits:** About > Credits names the Brush's five libraries; their license texts in full ship
  beside the app as `src/public/THIRD-PARTY-NOTICES.txt` (the BSD licenses ask it of a built app).
**Rejected:**
- Select as the empty letter's tool: 4.3 says the Brush, and 7.1 #4 says a drag must draw.
- Hiding the overlay whenever the Brush is picked: the opening Brush would hide the photo's way
  in on every empty letter.
- Keeping the "before B9" words behind the flag: principle 8 removes doors once the room is
  built; the gate still reads the flag for the drawing, so a "before B9" test can turn it off.
- Measuring the real font's spacing by each letter's shadow on the line: slanted handwriting
  overlaps there; `tests/b89.verify.mjs` measures row by row.
**Changes All tools gets:** the Brush button after New path and B / N picking it (7.6, D-038);
the work file keeps photo-list images (no change unless a photo list exists, which only Simple
makes); a point exactly on the canvas's left or top edge draws there. `tests/b89.verify.mjs` D
finds the same controls but the Brush, and 0 changed pixels outside the tool column.
**Open (not built in B8 + B9):** Fine-tune > Photo (Photo fade, Hide photo, Photo options: Lock,
Light ink on dark paper, Fit, Remove photo; 4.3); the dialog's view of a portrait whole-alphabet
page shows letters 20 to 45 px tall (cropping to the writing, or a zoom, would make them bigger;
the spec's whole-photo view is kept). *Closed 10/15/2026:* the dialog opens close up (the photo-ui fix pass) and
Fine-tune > Photo is built (D-041).
**Why:** principles 1, 5, 6, 7, 8; 4.3, 4.4, 7.2, 7.7.
**Affects:** `letter/open_tool.js` (new), `letter/empty_overlay.js`, `letter/letter_card.js`,
`letter/letter.css`, `nib/default_tool.js`, `photo/photo_app.js`, `photo_doors.js`,
`photo_card_slot.js`, `paint_photo.js`, `letter_tail.js`, `photo_flow_tail.js` (new),
`photo/photo_card.js`, `photo_dialog.js`,
`photo_flow.js` (photoPixels), `coach/rules.js`, `coach/font_facts.js`, `coach/coach_state.js`,
`trace/photo_gate.js`, `trace/trace_import.js`, `trace/trace_model.js`, `toast/upstream_map.js`,
`autotrace/preview_draw.js`, word sets `coach.js`, `letter.js`, `photo.js`, `toasts.js`; upstream
`path.js`, `edit_canvas.js`, `cursors.js`, `tools.js`, `characters.js`, `help.js`, `about.js`,
`main.js`; B10 (drops on the board go to the same hub), B16 (the 9.1 walkthrough).
**Revisit if:** Brennan reads the opening Brush with the overlay as two ways at once in the Gate 2
walkthrough (then open with Select and let [Draw with the brush] pick the Brush), or B13 picks the
work file at Create (then rule 10 stops coming before rule 12 on a new font).

## D-041: B8 and B9 finalize choices (the second hostile pass)
**Decided:** 10/15/2026, in the B8 + B9 finalize, after the critic pass (four verifiers re-ran
every finding plus variants in real Chrome and jsdom) and four fix tracks (brush, photo-core,
photo-ui, photo-flow) whose verdicts left 17 findings open and 13 new problems. Every one below has
a regression test seen failing on the code before this pass (UX-BEGINNER.md principles 1, 5, 6,
7.2, 7.3, 4.0, 4.3, 4.4, 7.7; D-026, D-033, D-038, D-039, D-040).
**Chose (photos, which ink is a letter's):**
- **A letter written lighter** (`letter_ink.js` step 2b): a piece binarize found that is at least
  LIGHT_SHARE (0.3) as dark as the page's ink, that the page cut kept under RESCUE_SHARE (half) of,
  is cut again against its own darkness and goes back in whole when it is letter-shaped (its
  stroke 0.5 to 2 pens, at least half a typical letter tall, at most 3 long); darkness alone never
  drops it then.
- **A second pen** (the felt-tip ran dry): when 3 or more letter-shaped pieces share one color
  other than the page's ink, that color is a pen too; its letters and its dots stay. Ruled and
  margin lines and punch holes still go (thin, or colored and no letter shape).
- **A box he drags reads what he sees** (`ink_parts.js boxInk`): when the pen's mask holds under
  BOX_INK_SHARE (0.35) of the ink binarize found in the box, the box reads all of it (in the
  dialog and when the flow cuts its mask), so Draw a box always reaches a lighter or other-pen
  letter.
- **His stroke a box edge clips** (`photo_flow_ink.js clippedOwnStroke`): a cut end along one box
  edge for more than ALONG_SHARE (2.5) pens is his own stroke when the ink across that edge goes on
  for under CLIP_SHARE (0.3) of a pen, or under HALF_SHARE (0.5) when the rest of his letter joins
  it within END_SHARE (1.5) pens of an end. The m's box at 486 and 488 keeps its first stem, the
  n's at 1092 and 1095 its leg; the a's box at 1090, 1095 and 1100 still loses the n's leg.
- **A pressed dot** (`keepPenPieces`): a round, full blob is a dot up to DOT_SHARE (3.1) pens across
  on its own (a period; a punch hole is 3.4 and up) and up to DOT_BESIDE_SHARE (4.5) over or under
  a stroke in the same part (i, j, !, ?).
- **The pen in the record** (`photo_registry.js` record.pen, findInk's stroke): a letter's part is
  at least LETTER_PENS (2.5) strokes long, so a lone dot is never the guess for a letter nor the
  "only part" that skips the dialog (`onlyPart`, now what `photo_app.js choosePart` asks).
**Chose (photos, the registry and the flow):**
- **Two touching letters, one rule** (`mayBeTwoLetters`: at least 1.6 times the middle width of
  the photo's other parts and 1.25 times as wide as tall), read by the step C note, the dialog's
  "Two letters touch here. Drag a box around each one." and the prefill, which never fills in such
  a part, the part after one named from it, a skipped part or one far smaller than a letter.
- **Covered** is the union of the boxes he drew and used (60 % of the part), so "na" boxed as n
  and a is not offered again.
- **The photo list through Undo** (`history.js swapProject` calls `carryPhotos`, in both modes):
  the live list goes onto the font a whole-font Undo or Redo brings back; only a use's tail pick
  follows the font brought back (it is the Tail step's own change).
- **No letter vs no ink** (flow code 'no-letter', status still 'no-ink'): a part with binarize's
  ink but none of it a letter's, or a trace of only specks and ruled-line bits, says "No letter
  found in that part. Draw the box again around the letter." and leaves Adjust shut; "No ink
  found ..." now names "Ink cutoff", the control that shows. A cutoff he set by hand is kept for
  the photo's next part only once a trace at it gave a letter.
- **Cancel** that takes a photo's record out marks the work file behind (recovery `markDirty`):
  a backup or save after a Skip may hold it.
- **Done photos** (`photo_doors.js samePhoto`, the overlay): a photo not done comes first; a done
  photo with parts left makes [Choose another photo...] the green button and [Use the same photo]
  outlined.
**Chose (photo screens):** name tags placed in reading order, each blocking the rest; a window
resize keeps the letters' screen size (a ResizeObserver on the view, else the window's resize);
a zoom button that hides with the focus hands it on; step C's notes show on the card as quiet
lines; "Skip this part" reads "Not a letter, skip it".
**Chose (Next line):** rule 18, "All 58 letters are ready." with no button while rules 13, 14, 16
and 17 can't show; rule 15 with the Brush picked on a letter with ink says "When small b looks
right, go to small i." with its button outlined; the Brush tip is only "Undo removes the last
stroke."
**Chose (the letter card):** Fine-tune > Photo (`letter/photo_part.js`): Photo fade (faint --o--
strong, one step on release), [Hide photo] / [Show photo], Photo options (Lock the photo, Light ink
on dark paper, Fit to letter box, Fit to capitals line, Remove photo with an Undo toast), each one
step naming the letter; a fit works whether or not the photo is locked.
**Chose (the Brush):**
- **Progress, not travel** (`smooth.js`): the Gaussian and the corners read how far a point on a
  rope ROPE_PX (1 px) long, pulled by the pen, has moved: shaking within the rope moves it nowhere,
  a real turn as far as the pen goes. At 10 and 25 px/s with 2 px of shake the o's edge is as
  smooth as a steady one's (ripple 0.04 to 0.05 px, 20 to 29 curves; was 0.13 and 109).
- **A resting pen**: samples closer than MIN_STEP_PX (0.25 px) to the last kept one are left out
  (the last comes back as the stroke's end), so frames stay at 1 ms through a 20 s hold (were 214
  ms).
- **Corners near either end** are judged on the chords there are (a third of the reach at least):
  a 12 px flick after a sharp turn keeps its tip within 2 px (was 3.6).
- **Freezes by distance**: a frozen piece covers at least CUT_PX (24) screen pixels of the line
  forward unless MAX_TAIL_SAMPLES (256) wait, so a slow stroke isn't many tiny curves.
- **Pasted strokes** (`stroke_record.js`): the shapes a letter held when its strokes were last
  sorted out are the stroke; only shapes that came in since are copies, so a copy pasted after the
  original lost its hole (or its ink) is its own stroke. History sorts the open letter out at the
  top of every item step (`nib/history_hook.js`), so the step holds the sorted ids and keys and
  Undo and Redo bring the same ones back.
**Chose (cost):** each path's flat outline is kept until the path changes (`spacing/outline.js`, a
stamp of its points and handles) and holes are found only among outlines whose box holds them;
the Undo list keeps at most MAX_UNDO_POINTS (400,000) points of shapes, oldest steps leaving
first into the undo floor, never the newest. 500 strokes on one letter: a stroke's step at the
499th 250 ms (was 2,339), the crash copy 55.8 MB (was 191.7). A 58-letter traced font (about 5,000
points) keeps all 200 steps and 30 whole-font steps.
**Chose (tests):** every suite and real-browser check runs with the flags as the app ships them;
flags are forced off only in tests of the flag gate itself (`b67.verify.mjs` reaches the Point pen
by P, its overlay offers [Use a photo]).
**Rejected:**
- Trimming a box's cut end at the thinnest neck, or by geodesic distance to each letter's body:
  on the real photos the m's stem, the n's leg and the a's touch are alike there; a box edge
  through the middle of his stroke (the m's at 490 of a stem at 485..493) still loses the half
  inside, as before.
- A wider Gaussian by speed: a quick hand's long, gentle waves are his curve; what a slow shaky
  hand needs is distance measured forward.
- A worker for the release (D-038's numbers stand); tagging copies inside upstream's clipboard
  code; seating a letter on its traced ink after tracing (placement comes before tracing, D-039,
  and the part's mask now holds only the letter's ink, which is what is traced).
**Open:** the board's drops (B10), faint stand-ins in the strip (B12), the "not saved" rule
before rule 12 on a new font (B13), the real felt-tip photos (B0), the opening Brush beside the
overlay's photo button (Gate 2, D-040), a turn 6 px from a stroke's start (0.3 px wider than
before the fix pass).
**Why:** principles 1, 5, 6, 7; 4.0, 4.3, 4.4, 7.2, 7.3, 7.7.
**Affects:** `photo/letter_ink.js`, `ink_parts.js`, `photo_registry.js`, `photo_flow.js`,
`photo_flow_data.js`, `photo_flow_ink.js`, `photo_flow_notes.js`, `photo_flow_state.js`,
`photo_card.js`, `photo_dialog.js`, `photo_app.js`, `photo_doors.js`; `letter/photo_part.js`
(new), `letter_card.js`, `empty_overlay.js`, `letter.css`; `coach/rules.js`; `nib/smooth.js`,
`skeleton.js`, `stroke_record.js`, `history_hook.js` (new); `spacing/outline.js`;
`history/undo_cap.js`; upstream `project_editor/history.js`; word sets `photo.js`,
`photo_flow.js`, `coach.js`, `letter.js`.
**Revisit if:** real felt-tip photos split letters at the rescue's darkness floor, a second pen's
ruled-line bits come back as letters, Brennan finds the m@490 case in practice, or a font's
whole-font steps run past 400,000 points.

## D-042: B10 and B11 integration choices (one "Needs a look", the backup's saved copies, the seams)
**Decided:** 10/15/2026, in the B10 + B11 integration, which turned on `board` and `checks`
together and joined the four tracks (board-page, board-tiles, checks, fixes) to the Next line, the
rail, the letter card, the photo screens and crash recovery (UX-BEGINNER.md principles 1, 6, 8;
4.0 rules 7 and 9, 4.2, 4.3, 7.2, 7.3; D-026, D-033, D-037).
**Chose:**
- **One "Needs a look" everywhere** (`checks/checks_app.js`, started in `main.js`): the app's checks
  cache follows the current editor and reads the font check's last problems; it is the Next line's
  'checks' source, so rules 7 and 9, the coach's letters, the board's tiles and counts (which read
  the coach's letters) and the rail (which counts with the board's `readyRuleFor`) can't disagree;
  the letter card reads the same cache. `fixLetter` and `looksFine` are the Next line's and the
  tiles' actions. Checked in Chrome: the board and the rail said the same count at every step (7,
  5, 6, 5, 6, 7), and the Next line's letters agreed where read (7, 5, 7).
- **The letter card** (4.3 Header): the chip says "Needs a look: floats above the writing line" in
  the tile's amber, the full sentence as its tooltip; under it [Looks fine to me] (outlined) and
  each soft note as a quiet line. The fix stays the Next line's (rule 7), never repeated in the
  card. Never while a Point pen shape on the letter is still open.
- **Looks fine to me is one item step** (`checks/looks_fine_step.js`, "said small n looks fine"),
  from the card or a tile; on a tile the board stays the board (fix_step.js points History at the
  letter for that one step).
- **Move the line only where it would move** (the fixes track's need 1, in `cache.js`): [Move the
  line to fit your writing] needs 2 letters off the same way (checks.js) and the middle of his
  letters on that line off that way too (`fit_lines_to_writing.js lineMoveWays`, read from the
  kept measures through `impliedFromMeasures` / `waysFromValues`, so nothing is measured twice).
  Right after the line moved, the letters it flipped get [Match size].
- **One voice for a letter a change flips** (4.2, principle 6): the fixes' own toast
  (`fix_step.js sayFlipped`: "Moving the line made 2 letters need a look." [Show me]) for a fix or
  a moved line. `cache.js`'s CHECKS_CHANGE_EVENT gets no toast of its own, so nothing is said twice.
- **Rule 9 on a board already showing Needs a look** (`coach/rules.js nextLookOnBoard`; the coach
  reads the board's filter): [Show me] would do nothing there, yet 4.2 keeps the one green button
  on the Next line (principle 1). The line takes the letters one at a time in rule 7's words ("small
  e is too tall for the small-letter line." [Match size]); Something else moves to the next letter;
  once every one is skipped rule 9 says nothing there. On All, the count and [Show me] as before.
- **One word for "Needs a look"**: tiles use the checks' `checks.state.needsLook`;
  `boardTile.caption.needsLook` is gone.
- **The backup's saved copies, a record each** (D-026's revisit, the board-tiles track's need 3,
  their first option; D-033's limits stand): every Undo step's saved copy of a letter or of the
  whole font, and the font as it was opened, is its own record in the 'recovery' store
  (`recovery/step_states.js`, key 'state:<projectId>:<sessionId>:<n>'), written the first time a
  write names it and deleted when the list no longer holds it; the session's record names them
  (`History.serializeForStorage({ stateRef })`: `itemStateRef`, `initialProjectRef`). Deleting a
  session's record deletes its copies; a copy whose record is gone is swept when the backups are
  listed (never one of a live session here or in another tab); a restore puts the copies back
  before History adopts the list, and a missing copy restores the font without its Undo list. In
  Chrome on a 58-letter traced font with the list at its fullest (200 steps, 30 about the whole
  font): before, every write 1,090 ms for 38.9 MB (Simple); now a write after a step on a letter
  26 to 34 ms (Simple and All tools, two runs) and after a step about the whole font (two new
  copies) 56 to 60 ms; the session's record 0.7 to 1.3 MB (the font, and the undo floor once
  steps fall off the old end: it changes, so it is always copied). A session that starts
  with a long list (a restored backup) writes every copy once, about 2.8 s on that font, right
  after the restore (in the background; the font is already on screen).
- **A work file dropped on the board opens** (4.2 Drops, the board-tiles track's need 4;
  `files/open_font.js openDroppedFont`): the file's handle is taken during the drop
  (`getAsFileSystemHandle` works only then), so Save writes back to it; Ctrl+O's box first when the
  work file is behind ([Save] [Cancel]); after Save it opens with no second click (a drop needs no
  picker); with no handle the dropped file is read and the font has no work file yet; a file
  ANY-INK can't read says 7.7's sentence.
- **Pokes is a soft note** (the checks track's choice, `checks.js POKES_IS_NOTE`): the exporter
  sets the font's clipping lines from the real highest and lowest ink (font-flux-js
  usWinAscent / usWinDescent), so Word cuts nothing off (section 8); as a check it turned 8 of 58
  letters of a neat traced alphabet amber. `pokesAsNote: false` brings back [Shrink to fit].
- **Tests that pin an earlier B** (B5's Overview, B7's card on toy letters) turn `board` or
  `checks` off for themselves; the export toast and the first photo test wait as long as a full
  suite's load needs (they timed out at 8 s and 5 s there, never alone).
**Open:** a letter flipped by a change that isn't a fix (the photo flow's "Also resized B", a
whole-font Undo) is said only by that change's own toast; rule 9's guided line on the filtered
board is new behavior for Gate 2; the photo doesn't follow a Select-tool resize of a traced
letter, while Match size scales both; a real Explorer drag's handle (the headless check drops a
made File, so it takes the no-handle path); the first write after a restore (2.8 s once).
**Why:** principles 1, 6, 8; 4.0, 4.2, 4.3, 7.2, 7.3; D-026's own revisit rule.
**Affects:** `checks/checks_app.js` (new), `looks_fine_step.js` (new), `cache.js`,
`fit_lines_to_writing.js`; `recovery/step_states.js` (new), `recovery.js`, `snapshot.js`; upstream
`project_editor/history.js`; `letter/letter_card.js`, `letter.css`; `topbar/simple_top_bar.js`;
`board/board_page.js`, `board_drop.js`, `tile_state.js`; `coach/rules.js`, `font_facts.js`;
`files/open_font.js`; `mode/features.js`; `app/main.js`; word set `board_tiles.js`.
**Revisit if:** Brennan reads rule 9's guided line as a second Show me, a photo-flow resize turns a
letter amber with nothing said, or a backup write after a step goes past 100 ms on a real font.

## D-043: B10 and B11 finalize choices (the hostile pass and its verifiers)
**Decided:** 10/15/2026, in the B10 + B11 finalize, after the first-timer and critic runs, the
four fix tracks (board-page, checks, fixes, and the integration) and their verifiers
(UX-BEGINNER.md principles 1, 6, 8; 4.0 rules 7, 9, 15; 4.2; 4.4; 7.2; 7.3; D-026, D-034, D-041,
D-042).
**Chose:**
- **The checks' rules the spec left open** (the checks track, `checks/checks.js`,
  `body_bottom.js`):
  - A Brush letter sinks by the line the pen drew, its center (`penAllowance`: half the stroke's
    own nib, from `glyph.anyink.nib.strokes`), and floats by its ink, each within 2 % of the
    letter box like every body; the fixes seat the pen's line (`fix_shapes.js seatLine`), so a
    fixed Brush letter sits where one drawn to the line does, its round end half a nib under it,
    and clears both ways at once. The verifier's "tolerance stacks" (ink up to about 91 units
    under the line reads Ready) is this rule, kept on purpose: judging the ink would call a pen
    that stops a pixel under the line "sinks" (a mouse drag ends within a few pixels, and the
    Brush has no snap). Judging floating by the pen's line too was tried and dropped: a round
    stroke whose ink touches the line (the nib check's a) read "floats".
  - A tail letter is judged by its body: the bowl of g p q Q (placement's counter rule, then the
    ink of two Brush strokes together, then a bowl that stops short of closing by up to a stroke,
    `BOWL_GAP`), the joint of y, the head of , ;. A bowl or a joint gets half a stroke and a
    stroke more room; j, and J f with their tail on, only float when all the ink is above the line.
  - A pen-sized dot beside a plain letter or number (not i j, not accented) is a speck: about
    round, at most 2 strokes across, under a quarter of the biggest piece, clear of the others. A
    tap straight over or under a letter is not one (B11).
  - A comma with a head floats or sinks by its half-width row; a small comma or a slash never sinks
    unless all of it is under the line.
  - Capital I and 1 are naturally narrow (`spacing/letter_classes.js NARROW_LETTERS`), and an
    automatic letter already at its fit is never offered [Fit spacing] for its width (it would do
    nothing).
- **The size check waits for the photo** (`checks/photo_walk.js`): a letter still exactly as
  traced from a photo with free parts and no Done has no size check until 5 plain letters are named
  from it (`SETTLED_LETTERS`; 3 was not enough: the verifier's walk e H r B d a n, the two letters
  written too big first, called the r "too short" with a green [Match size] and flipped two letters
  later). A median of 5 holds with 2 of them written off. Done with this photo, or the photo used
  up, ends the wait at once (the Done press marks the font changed, which the board, the Next line
  and the checks follow). A letter he resized himself keeps that size (it is his change, judged like
  any other); it doesn't follow the photo's scale afterwards.
- **Move the line** (the fixes track, `fit_lines_to_writing.js`): only inside the letter box, and
  never pushing another line past letters that fit it now (`lineCanMoveTo`); a [Move the line]
  left over from before a change resizes the pressed letter instead. Every press of a check's fix
  runs the font check at once (`fixes.js`), so [Fix it] clears with no 2 s wait.
- **The board's filter lasts only while he is on the board and a letter needs a look**
  (`board/filters.js settleBoardFilter`, `endBoardFilter`; the board-page track): the board always
  opens on All; a switch to All tools ends it (a More tools visit doesn't). "+ Numbers & symbols"
  goes back to All and scrolls the new section into view, washed green for 1.6 s.
- **The Next line and the Brush** (`coach/rules.js brushingOpen`, `font_facts.js`): while the Brush
  is the tool on a letter with ink (picked, or the one the letter opened with once it has ink), he
  may still be drawing, so no rule gives that letter a green button: rule 7 says its problem with
  the fix outlined, rule 9 in the letter view outlines [Show me], rule 15 says "When small b looks
  right, go to small c." outlined. The letter card's chip shows as always. Chosen over holding the
  check until he leaves: then a letter that sinks would say nothing until the board.
- **Something else on a look ends when he asks again** (`coach_state.js forgetLookSkips`): opening
  a tile and [Show me] end that letter's (or every) look skip. On a board filtered to Needs a look
  with every letter skipped, rule 9 says the count with no button (the tiles hold the fixes), never
  a green way on to a letter not on screen.
- **Photos** (`photo/`):
  - A stray pen dot joins the piece above it only as the dot of ! or ? (`ink_parts.js`: within 0.4
    of the typical height under it, its middle under the piece's lowest ink), so it never stretches
    a letter's part, seats it in the air or splits a row.
  - A traced letter the checks would call a little off the line (at most 5 % of the letter box)
    settles on it, photo too, inside Use it's step (`photo_flow_settle.js`); placement and the
    check read the bottom two ways (the photo's turn, the tracer's smoothing).
  - The toast after Use it names the letters the trace made need a look, in the same toast, with
    [Show me] (4.2: "a toast says so"), and a list names two letters and then how many more.
  - A crossed-out letter is junk (`photo_flow_ink.js isScribbledOut`: as one pen-wide line its ink
    runs 4 box diagonals or more and fills half its box; the notebook's Q 5.3 and 0.67, the
    fixtures' letters 2.8 and 0.42 at most), skipped as it comes in and remembered as junk
    (`photo_registry.js markJunk`, `record.junk`).
  - The alphabet prefill stops at a letter-sized part he skipped (it may be a letter he passed
    over: after U with VW skipped, X was filled in as "V"); the finder's junk and a skipped mark
    never stop it. An l written touching an m is as wide as an M, so it isn't caught as two
    letters; the prefill no longer runs on past it once he skips it.
- **The backup keeps a live session's saved copies through a save** (`recovery.js`,
  `step_states.js pending`): Save deletes the session's record, not its copies, so the next write
  sends only what is new (the critic: 0.85 s and a 0.4 s freeze after every save); a clean session
  that ends, or a tab that closes clean, takes its copies with it, and the orphan sweep takes any
  left. Each copy is saved as it is written and the page gets a turn every 12 ms of work, so the
  first write after a restore no longer runs as one long task.
**Open (Gate 2, Brennan's call):** rule 9's one-at-a-time line on a filtered board (D-042); tool
keys inside a letter view right after the board taught "type a letter to open it" (7.6 says the
keys pick tools there, with a toast); the outlined fix while the Brush is picked. Not B10 or B11:
the faint photo doesn't follow a Select-tool resize of a traced letter (Match size moves both); a
real Explorer drag of a .gs2 still needs a manual check (the headless check drops a made File).
**Why:** principles 1, 6, 8; 4.0, 4.2, 4.4, 7.2, 7.3; D-026's revisit rule.
**Affects:** `checks/checks.js`, `body_bottom.js`, `photo_walk.js`, `cache.js`, `fix_shapes.js`,
`fixes.js`, `fit_lines_to_writing.js`; `coach/rules.js`, `font_facts.js`, `coach_state.js`;
`board/board_page.js`, `filters.js`, `board.css`; `photo/ink_parts.js`, `photo_flow.js`,
`photo_flow_use.js`, `photo_flow_settle.js` (new), `photo_flow_ink.js`, `photo_registry.js`; word
set `photo_flow.js`; `spacing/letter_classes.js`; `recovery/recovery.js`, `step_states.js`.
**Revisit if:** Brennan reads an outlined fix as "nothing to do", a real photo's crossed-out letter
is offered or a real letter is skipped as junk, or a backup write after a save goes past 100 ms.

## D-044: B12 and B13 build choices (Try it, gap fixes, the start screen, the install offer)
**Decided:** 10/15/2026, in the B12 + B13 tracks (tryit-strip, tryit-gaps, start, install), the
integration and the finalize, after the critic pass and its verifiers (UX-BEGINNER.md principles
1, 6, 8; 4.1, 4.6, 7.1, 7.3, 7.4, 7.5; D-026, D-034, D-035, D-036).
**Chose:**
- **Try it is the strip, grown** (`tryit/expand.js`): a class on the same strip, sheet and
  renderer, never rebuilt; 72 pt by default; Esc, [Done] or step 1 closes it; the rail marks
  step 2 as the current step while it is open. Opening it is never an Undo step.
- **His letters never move under him** (`preview/preview_strip.js sheetHeight`): in Try it the
  words are centered on the sheet's height when the canvas was last sized to it (opening, a
  window resize, a new renderer), never the live height. Opening Letter spacing or Gaps you fixed
  still makes the sheet shorter; the canvas keeps its size and is clipped by the sheet, so the
  words stay where they were (a centered line sits a little low until the next resize). Chosen
  over a fixed sheet with a scrolling page, which would push the sections off screen.
- **Keys under Try it** (`expand.js`, `preview/strip_keys.js stripOwnsKey`): a plain key from
  inside the strip reaches the letter under it only when the strip has no use for it (the text
  field, a slider's arrows, Enter / Space on a button, Esc stay in the strip); Delete, arrows and
  tool keys from a button, summary or switch are stopped. Ctrl / Alt / Meta presses (Undo, Redo,
  Save) always reach the app.
- **The stand-ins' legend in Try it** is a sentence after the hint under the sheet ("Gray
  letters aren't made yet. Double-click one to make it."), at the hint's size and color; the
  small strip keeps its corner tag. Both go once 5 letters are Ready.
- **Gap fixes are his own** (`kerning/kern_lookup.js`): a fix made with the handle is a one-pair
  kern group marked in `settings.anyink.gapFixes` by pair (`'0x65|0x6E'`), kept through save,
  Undo copies and clones; "Gaps you fixed" lists only marked pairs of two single letters that
  both have ink, so an imported font's own rules and joined-letter ids never show. Rows read
  `"en" closer` / `"ol" further apart`, the letter names as the tooltip.
- **How close a drag may bring two letters** (`tryit/gap_handle.js touchFloor`): where their ink
  touches, read row by row over the height both letters share (512 rows), so a letter tucks under
  an overhang (To, Ty, Wa, Yo); where no row is shared, where their boxes meet; a pair already
  closer stays where it is. The letter-spacing slider keeps its own per-side floor.
- **One step per drag, Undo waits** (`tryit/undo_hold.js`): Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z are
  held while the gap handle or the letter-spacing slider is pressed; a font swapped mid-drag drops
  the drag (the handle) or starts the step from the new font (the slider); the before copy
  always gets its after copy, even if the write throws.
- **The rows under the sheet keep their space**: the Word note and Gaps you fixed are hidden by
  visibility, not removed, and change only on release, never mid-drag.
- **The Word note before B14** reads "Word needs one setting for gap fixes. Nothing to do now:
  you will be shown it when you put your font in Word." With `useInWord` on it ends "Use in Word
  will show you." as the spec says.
- **A toast's second, plain button** (`toast/toast.js options.dismiss`): for the install toast's
  [Not now]; the first button stays the only colored one.
- **Menu > Start a new font...** (`start/new_font.js`): with unsaved work, Ctrl+O's box first
  ([Save] green, [Cancel]); then a backup copy, then the start screen; Create there makes the new
  font in the same editor with no work file (`open_project.js` clears the old file handle) and an
  empty Undo list.
- **Which backup copy makes the crash card** (`start/start_state.js`, `card_facts.js`): Replace
  it's copies (`replaced: true`, `keep_backup.js`) are kept under Other ways to start... >
  Recover and never make a card; a copy as old as its work file or older (the recent-fonts time,
  or the file's own `lastModified` when Chrome already lets ANY-INK read it) doesn't count (7.5);
  when neither time is known, a copy with a work file still shows the card, the safe way.
- **What Create may write over** (`start/replace_check.js`): a new or empty file at once; a work
  file (Glyphr Studio 2 `settings.project` with a version, id or name, or Glyphr Studio 1
  `projectsettings.versionnum`) with no letters that isn't a recent font at once; a recent font or
  a work file with letters asks (confirmation 5, a backup copy first); anything else with
  something in it (not JSON, or JSON that isn't a font, such as another program's settings file)
  is never written over: the box says it stays as it is and offers only [Use a new name].
- **"Other ways to start..."** opens All tools' open page on Load with the New tab hidden
  (`open_project.js tabsFromStartScreen`), so there is no second Create; All tools on its own
  still opens on New.
- **One owner of Chrome's install offer** (`start/install_offer.js`, `pwa/register.js`): held in
  both modes; the All tools notice, Simple's toast and Menu > Help all ask it there, and whichever
  is pressed first uses it up and the others go (`onInstallOfferGone` closes the notice). Simple
  never shows the notice: a switch to Simple puts it away (the Menu row holds the offer), and a
  switch back to All tools offers it again while the offer is still held and Not now was never
  chosen.
**Open:** B14 calls `markWordGapStepShown()` (`tryit/word_note.js`) and `noteFontFile()`
(`start/install_offer.js`) and turns `useInWord` on; the Recover list still shows a Replace it
copy as an ordinary backup copy (`recovery/snapshot.js describeSession` could pass `replaced`
through); the install toast's real trigger can't be raised on a dev server (unit tests cover it).
**Why:** principles 1, 6, 8; 4.1, 4.6, 7.1, 7.3, 7.4 #5, 7.5.
**Affects:** `src/anyink/tryit/*`, `src/anyink/start/*`, `preview/preview_strip.js`,
`subscriptions.js`, `layout.js`, `kerning/kern_lookup.js`, `toast/toast.js`, `toast_view.js`,
`topbar/simple_top_bar.js`, `files/open_font.js`, `pwa/register.js`, `app/open_project.js`,
`app/main.js`; word sets `tryit.js`, `tryit_gaps.js`, `start.js`.
**Revisit if:** Brennan reads a clipped sheet as a bug, wants a gap closer than touching, or a
crash card comes back for a font he saved.
