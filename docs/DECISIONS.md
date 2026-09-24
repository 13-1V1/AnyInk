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
