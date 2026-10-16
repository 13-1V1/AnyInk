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
- The app opens in Simple (B16); All tools is `?ui=all` or the More tools switch. Real-Chrome
  checks of All tools load `?ui=all`; `vitest-setup.js` pins jsdom tests to All tools.

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
- `src/anyink/fontcheck` (B1) — the font check on the exporter's own letter list (`export_list.js`,
  `validate.js`, `validate_kerning.js`, `export_kerning.js`), run 2 s after a change
  (`font_check.js`, 'fontCheck' topic) and after a File menu / Ctrl+E export (`export_toast.js`).
  The strip shows its first problem with Show me / Fix it (`src/anyink/preview/fix_it.js`).
  `src/anyink/words/letter_name.js` names letters ("small b"). Test page `tests/fontcheck.html`;
  real-Chrome checks `tests/*.verify.mjs` (see tests/README.md).
- `src/anyink/words` (B4) — the one vocabulary: `words.js` gathers `sets/*.js` (one file per owner;
  `word(key, vars)` throws on a missing key; `glossary`, `labelCase`), `letter_name.js`,
  `letter_set.js` (a letter set in house words, never a block name), `history_text.js`
  (`historyText(title)`: every Undo title in plain words, '' for a hidden one), `banned.js` (the 2.3
  list with plurals and -ed / -ing forms, plus 2.4 E / G's never-shown terms for strict scans;
  `scanDom`, `findUppercase`; exemptions `.anyink-quote` and `.anyink-pro-word`), `error_words.js`
  (7.7: what went wrong -> one sentence and its buttons), `word_html.js` (a key as HTML, quotes
  marked), `error_box.js` (`sayError`: Simple's error box with those buttons, the first green;
  All tools keeps upstream's box). A later B scans its Simple screens with `scanSimpleScreen` from
  `words/tests/banned_scan.js` (strict by default). Test page `tests/words.html`.
- `src/anyink/toast` (B4) — one toast voice: `toast(key, vars, { kind, action, group, tone, quotes,
  stillGood })`; upstream's `showToast` goes through `upstreamToast` and `upstream_map.js` (every
  message mapped; Simple drops an unmapped one and the scan fails on it). All tools keeps the
  classic toast (`toast_view.js` showClassic); Simple has one queue (`queue.js`), bottom right:
  undo > destructive > automatic > info, info toasts wait their turn, a stream (`group`: drop,
  file, export, toolSwitch, merge) replaces itself, an offer (info + button) survives a clear
  until its font is gone (`stillGood`), a press on the letter canvas leaves Simple's toasts alone.
  `drop_toasts.js`: a work file or an empty drawing dropped. Test page `tests/toast.html`.
- `src/anyink/mode` (B2 + B5) — `mode.js` (B16: `'simple'` by default, `LAUNCH_MODE`; `?ui=all` or
  More tools for All tools, `?ui=simple` still works; mirrored
  to `html[data-ui-mode]`, `anyink-mode-change`, `setModeForTests`), `features.js` (15 flags, all
  off; each B turns on only its own), `visibility.js` (6.2's tables: `isShown(area, id)`; screens
  filter where they are drawn), `keys.js` (the one key map, 7.6), `band.js` (purple band, landing
  rule `arriveAt` at the top of `Navigator.navigate`), `switch.js` (`switchMode`: mode changes from
  the UI), `locks.js` (guide lines locked in Simple), `hide.js` / `sections.js` /
  `settings_rows.js` (drawing helpers), `doors.js` (Use in Word / Fine-tune events),
  `simple_labels.js` (Simple's words on today's letter page, tiles and nav until B7 / B10),
  `back_to_letters.js` ([Back to my letters] on Simple's Help and About until B6 / B15).
  `locks.js` also locks an empty letter's left edge in both modes. Simple-only behavior checks
  `isSimpleMode()` or `isShown`; All tools must behave as before. Test page `tests/mode.html`.
  `src/anyink/files/open_font.js`: Ctrl+O in both modes (opens into the font he is in; asks
  whenever the work file is behind; a backup copy first). `src/anyink/trace/photo_gate.js`:
  Simple takes, draws and grabs no photo until B9 turns 'photo' on.
- `src/anyink/history` — settings steps (`settings_snapshot.js`, also `settings.anyink` and the
  name), B2's Simple undo (`simple_undo.js`: one press undoes the newest change wherever it is),
  the 200 / 30 cap with `history.undoFloor` (`undo_cap.js`; looking around never counts, "Navigated
  to" entries thinned past 30), `item_state.js`. Test page `tests/undo.html` (`?ui=simple` for Simple).
- `src/anyink/spacing` (B3) — automatic spacing: side table and gap rule (`letter_classes.js`,
  `gap_rule.js`), `measure.js`, `outline.js`, `sides.js` (sides from the body, slant taken out, marks
  and tails hanging no closer than 0.1 G to the width), `slant.js` (the font's slant from the stems,
  `anyink.spacingSlant`; a letter's own lean), `auto_space.js` (fitSpacing, fitAllAutomatic, fitDependents,
  setExtra for the letter-spacing slider), `owner.js` (`anyink.spacing` 'auto' / 'manual'),
  `round.js`, `trace_follow.js` (the photo moves with the shapes), and `history_hook.js`, which
  History calls before every step (Simple refits automatic letters inside the step; All tools only
  marks them "set by you"). The engine imports only its own folder and the trace model. Test page
  `tests/spacing.html`.
- `src/anyink/placement` (B3) — the photo's scale (a row written at another size gets its own),
  each row's writing line sloped with the photo and every letter's body on it, the photo's
  x / y / scale for a picked part (`fit_lines.js` placePart, followPlan). Pure; B9's photo flow
  calls it; `tests/ink_parts_lite.js` is B9's reference parts finder. Test page `tests/placement.html`.
- `src/anyink/nib` (B8) — the round Brush, a pointer-event tool (`nib_tool.js`, D-014): 1€ filter
  (`filter.js`); the samples smoothed along the line by forward progress, a 1 px rope, never across
  a corner (`smooth.js`: samples under 0.25 px apart left out, so a resting pen costs nothing;
  corners near either end judged on the chords there are); the center line built as samples come
  in, its settled front frozen in pieces of at least 32 samples and 24 px (`skeleton.js`, `fit.js`;
  vendored fit-curve and simplify-js in `vendor/`); the nib swept and united 8 hulls at a time with
  clipper2-ts (`sweep.js`, `refit.js`, `ink.js`); the live picture with perfect-freehand (`preview.js`,
  `overlay.js` keeps the frozen part on a layer, `match.js`); one stroke one step (`commit.js`);
  strokes kept in `glyph.anyink.nib.strokes` `{ id, key, parts, nib, size, skeleton, at }` and each
  shape tagged `{ strokeId, strokeKey, strokePart }` (`stroke_record.js`: a pasted whole copy becomes
  a stroke of its own, a partial copy an ordinary shape; the shapes held at the last sort are the
  stroke; `path.js` keeps the tags); History sorts the open letter's strokes inside every item step
  (`history_hook.js`); the size (`brush_size.js`, `size_control.js`); the tool a letter opens with
  (`default_tool.js`: the opening Brush). D-038, D-041. Test page `tests/nib.html`;
  `tests/nib.verify.mjs`.
- `src/anyink/photo` (B9) — photos. Core: `ink_parts.js` (photoInk, parts, rows, specks; a box he
  draws reads all the ink when the pen's mask lacks it, `boxInk`), `ink_pieces.js`, `letter_ink.js`
  (only the pen's ink: smudges, shadows, ruled and margin lines, punch holes out; a letter written
  lighter and a second pen's letters kept), `photo_registry.js` (`settings.anyink.photos[assetId]`
  with the pen's stroke; guess, onlyPart, prefill, `mayBeTwoLetters`, boxes cover by their union,
  `carryPhotos`, which History's `swapProject` calls on every whole-font Undo and Redo),
  `paper_kind.js`, `smooth_detail.js`. Screens: `how_card.js`, `photo_dialog.js` (close up, [-] [+],
  tags that cover no letter or tag, "Two letters touch here"), `photo_card.js` (steps A and C, its
  quiet notes), `paint_photo.js`, `photo_card_slot.js`. Flow: `photo_flow.js` with `photo_flow_state
  / _data / _pixels / _fit / _use / _ink / _notes / _hold / _tail / _settle.js` (`_settle`: a traced letter a little off the line sits on it inside Use it's step) (addPhotoFile, startPart,
  adjustPart, useIt, cancelPart, watchPhotos; 'no-ink' vs 'no-letter'; a box edge that clips his
  own stroke keeps it; pressed dots are ink; step C's placement never saved; the one way in for the
  screens). The hub `photo_app.js` (started in `main.js`: the Next line's How and Do the next one,
  Menu > How to photograph, the empty overlay's doors via `photo_doors.js` (a done photo never
  leads), Trace again, drops and pastes in Simple via `trace/photo_gate.js`, step C in the card,
  Fine-tune > Tail via `letter_tail.js` / `photo_flow_tail.js`; it loads `photo_flow.js` on first
  use). D-039, D-040, D-041. Test pages `tests/photo.html`; `tests/b89.verify.mjs`,
  `tests/photo_ui.verify.mjs`.
- `src/anyink/letter/photo_part.js` (B8 + B9 finalize) — Fine-tune > Photo: Photo fade, Hide /
  Show photo, Photo options (Lock, Light ink on dark paper, Fit to letter box, Fit to capitals
  line, Remove photo with [Undo]); each change one step naming the letter.
- `src/anyink/letter/open_tool.js` (B8 + B9) — the Brush on an empty letter, Select on one with
  ink, Select when step C starts; the opening Brush keeps the overlay and the photo in the Next
  line.
- `src/anyink/topbar` (B6) — Simple's top bar (`simple_top_bar.js`, drawn by `menu.js`
  makeAppTopBar in Simple): logo, font name, the rail with its ready count (`ready_count.js`, the
  open Point pen shape left out, said again on a tool switch), Undo / Redo (`undo_buttons.js`, the
  tooltip names another letter), the status pill (`status_pill.js`), More tools, the Menu
  (`simple_menu.js`), the notices gap; `letters_page.js` (`goToLetters`: where the logo, "1
  Letters", "<- All letters" and "Back to my letters" go); `doors.js` are the events later Bs
  answer. Space presses a keyboard-focused button in Simple (`events_keyboard.js`). Test page
  `tests/topbar.html`.
- `src/anyink/coach` (B6) — the Next line `<anyink-coach>` under the top bar: `rules.js` (the 17
  rules of 4.0, pure), `coach_state.js` (follows the editor; `getCoach`, `setCoachFact`,
  `setCoachSource`, `noteCoach`, `showTip`; memory per font), `font_facts.js` (every font problem,
  the one ink rule), `letter_order.js`, `skips.js` (pruned when the state changes), `tips.js` (the
  Point pen's tip stays while drawing), `open_shape.js` (`openPathOf` / `openShapeOf`: the Point
  pen's open shape, read by the coach, the rail, the card, the overlay and the font check),
  `dom_probe.js` (open dialog, another green button: `.anyink-primary` or a green fancy-button),
  `actions.js` (`setCoachAction`), `coach_element.js`. Every ANY-INK dialog carries
  `data-anyink-dialog`. Test page `tests/coach.html`.
- `src/anyink/history/undo_toast.js` (B6) — every Undo / Redo press named ("Undid: traced Capital B"
  [Redo]); History calls `sayUndone`, once per press; a toast is good only while it speaks for the
  newest change (`stillGoodAfterPress`, `undoOffer` for destructive toasts' [Undo]) and goes at the
  next step (`toast.js dropStaleToasts`, `queue.js sweep`).
- `src/anyink/letter` (B7) — the letter view (Characters page in Simple): `letter_header.js`,
  `letter_card.js` (Fine-tune), `empty_overlay.js`, `view_switches.js` (Fine-tune state, the four
  switches), canvas `guide_lines.js`, `guide_letter.js`, `edges.js`, `neighbors.js` +
  `neighbor_pick.js`, tools `auto_hole.js` (hole or solid by what shows under a shape) with
  `outlines.js` (how two outlines lie) and `unite_shapes.js` (joins, islands kept), `pen_follow.js`
  (the Point pen through Undo / Redo), `point_kind.js`, `delete_toast.js` (Delete says what it took,
  [Undo]), `tool_labels.css`. The edges lock while Fine-tune is closed or a drawing tool is picked
  (`mode/locks.js`). In Simple a Point pen shape of 1 or 2 points is taken away when it ends, and
  leaving the letter mid-shape ends it on its letter (`new_path.js` endOpenShape / leaveLetter,
  called by `navigator.js` and `project_editor.js`). Test page `tests/letter.html`; seam tests use
  `letter/tests/simple_screen.js`.
- `src/anyink/board` (B10) — the letter board, Simple's home (the Overview page): `board_page.js`
  (the board: progress line, section counts, toolbar, tiles drawn again only where they changed;
  `readyRuleFor` is the rail's Ready rule; `installBoard` at boot: rule 9's [Show me], rule 16,
  finished-section toasts; opening a tile and [Show me] end that letter's look skips), `progress.js`,
  `filters.js` (All / Needs a look / Empty, a tile's reason and outlined fixes; the filter lasts only
  while he is on the board and a letter needs a look: `settleBoardFilter`, `endBoardFilter`; "+
  Numbers & symbols" shows the section it adds, in view and washed green), `tile_state.js` + `tile_state.css` (GlyphTile's board states: Empty,
  Ready, Needs a look, the last-touched ring), `board_keys.js` (type a letter, arrows, Enter),
  `board_drop.js` (photos to the photo screens, a .gs2 opens through `files/open_font.js
  openDroppedFont`), `letter_set.js` — the Quick set (58) and + Numbers & symbols (80, one settings
  step), one copy for the rail, the Next line and the letter header, and the one rule for ink,
  Ready and empty (`inkOf`, `hasInk`, `finishedShapes`, `isEmptyLetter`; the open shape is never
  ink). Test page `tests/board.html`; `tests/board_tiles.verify.mjs`, `tests/board_page.verify.mjs`.
- `src/anyink/checks` (B11) — "Needs a look" and its fixes: `checks.js` (pure, per letter, in
  CHECK_ORDER; pokes is a soft note; a Brush letter sinks by its pen line, floats by its ink, and
  the fixes seat its pen line), `body_bottom.js` (a tail letter's body: the bowl of g p q Q, an open bowl
  bridged, the joint of y, the comma's head; `penAllowance`, half the nib), `photo_walk.js` (the
  size check waits while a photo is still being traced, until 5 plain letters, Done or used up),
  `soft_notes.js`, `cache.js` (per letter, recomputed only for
  letters whose stamp changed, once per step; Move the line only where the line would move),
  `looks_fine.js` (`glyph.anyink.checksOk`, cleared when the shapes change) and
  `looks_fine_step.js` (the press, one step), `fixes.js` + `fix_step.js` + `fix_shapes.js` (each
  fix one step, wherever pressed; the one toast for letters a fix flips),
  `fit_lines_to_writing.js` (Move the line to fit your writing, only inside the letter box and
  never past letters that fit; B15 reuses it), `checks_app.js` (`initChecks` at boot: the coach's
  'checks' source, `fixLetter` and `looksFine`, the font check's problems, run after every step).
  D-042, D-043. Tests `checks/tests`; `tests/b1011.verify.mjs`.
- `src/anyink/recovery/step_states.js` (B10 + B11, D-042) — each Undo step's saved copy is its own
  record in the backup, written once ('state:<projectId>:<sessionId>:<n>'); the session record
  names them (`History.serializeForStorage({ stateRef })`); restore puts them back. A save keeps
  the live session's copies (only the record goes); writes save each copy as they go and yield.
- `src/anyink/tryit` (B12) — Try it, the preview strip grown under the top bar (never rebuilt):
  `expand.js` (open / close, Esc / [Done] / step 1, keys from the strip reach the letter only when
  the strip has no use for them via `preview/strip_keys.js`, install / uninstall of the parts below),
  `stand_ins.js` (faint outlines for letters not made yet; the legend a sentence on the hint line),
  `font_check_line.js` (B1's check as one line, "Your font builds OK."), `gap_handle.js` (the purple
  handle between two made letters; one-pair kern groups through `kerning/kern_lookup.js`, marked in
  `settings.anyink.gapFixes`; `touchFloor` where the ink touches row by row; one whole-font step),
  `letter_spacing.js` (Move all letters closer or further apart: `extra`, one step on release;
  'letterSpacing' topic), `undo_hold.js` (Undo keys held while a handle or slider is pressed),
  `gap_list.js` (Gaps you fixed: his marked pairs with ink, `"en" closer`), `word_note.js` (the
  Word note; `markWordGapStepShown()` for B14). The strip centers Try it's words on the height the
  canvas was sized to (`preview_strip.js sheetHeight`), so they never move under the pointer.
  Test page `tests/tryit.html`; `tests/tryit_gaps.verify.mjs`.
- `src/anyink/start` (B13) — the start screen (Simple's app page): `start_page.js` (the Continue
  card and its crash versions with exactly one green button, other fonts, the name field, Create,
  "Other ways to start..." to All tools' Load tab with no New), `start_state.js` (`chooseCard`,
  `countLetters`), `card_facts.js` (a backup copy's `replaced`, work file and file time: copies as
  old as their file and Replace it copies never make a crash card), `create_font.js` (the save box
  started inside the click and never awaited; the board opens either way), `replace_check.js` (a
  recent font or a work file with letters asks, with a backup copy first; a file that isn't a work
  file is never written over), `keep_backup.js`, `new_font.js` (Menu > Start a new font...: Ctrl+O's
  unsaved box, a backup copy, the start screen), `install_offer.js` (the one owner of Chrome's
  install offer: the toast once after the first Ready letter, Menu > Help, and All tools' notice,
  which goes when the offer is used anywhere and never shows in Simple; `noteFontFile()` for B14).
  Test page `tests/start.html`; `tests/b1213.verify.mjs`.
- `src/anyink/install` (B14) — Use in Word: `use_in_word_dialog.js` (font check first, folder,
  build, the card; Ctrl+E, rail step 3, Menu > Make my font file..., the Next line's [Use in Word];
  `installUseInWord` in `main.js`; one build at a time; the build is quiet (`font_export.js`
  `quiet`: no progress, folder or "Exported" toast behind the dialog, the dialog says it: no
  folder, a lapsed permission, a Cancel on a same-named file, "Press again"); the install offer
  hears of a font file once the card is back), `install_card.js` (numbered steps, step 4's short
  steps, after a rename "search <old name> Test too"), `build_names.js` ("<name> Test <n>" /
  "<Stem>-Test<n>.otf"; test families share one base cut at a word to leave room for " Test 999"
  (`familyBase`), the final font keeps a name that fits 31 whole (`finalFamily`); the test number
  in `kv`, never in the work file; each work file's test builds by name, `renamedTestNames`),
  `word_export.js` (the letters and gap fixes the file really holds), `merge_overlaps.js` (the
  export copy's overlapping shapes and self-crossing outlines made plain outlines),
  `kern_latin.js` (gap fixes listed under 'latn' too). Quotes bold by the one shared rule
  (`common/resets.css [data-anyink-quotes='bold']`). Test page `tests/getfont.html`.
- `src/anyink/fontinfo` (B15) — `font_details_dialog.js` (font name, your name, copyright, each one
  settings step; a quiet line when Word will shorten the name) and `move_lines.js` (unlocked guide
  lines on Select (`letter/open_tool.js` opens every letter on Select meanwhile); a moved line is
  one whole-font step through B11's `moveLine`; `line_gap.js` keeps the small-letter line a tenth
  of the letter box under the capitals line, hand drags only; the readout's words through
  `metrics/overlay.js setReadoutWords`, the limit through `metrics/font_metrics.js
  setMetricLimit`). Test page `tests/fontinfo.html`.
- `src/anyink/help` (B15) — Simple's Help page (`help_page.js`, `help_door.js` for
  'anyink-open-help', `help_keys.js`, `help_word_steps.js` with Use in Word's labels, names and
  step-4 short steps, and the old names after a rename; `example_font.js`: Look at an example font
  opens `?ui=simple&example=1` in a new window, opened at boot by `main.js`). Test page
  `tests/help.html`. The first full loop in real Chrome: `tests/b1415.verify.mjs`.
- `src/anyink/photo/photo_dialog.js openModal` takes any open menu away at once when an ANY-INK
  dialog opens (Menu open, then Ctrl+E).
- Feature flags on: `coach` (B6), `letterView` (B7), `brush` (B8), `photo` (B9), `board` (B10),
  `checks` (B11), `tryIt` (B12), `startScreen` (B13), `useInWord` (B14), `fontDetails` and `help`
  (B15); `alternates`, `weight`, `roughen` off until M11 to M13. Tests that check Simple "with no
  flag" (B5's stub) call `noFlags()` (`src/anyink/mode/tests/no_flags.js`).
- B16 (D-046) — `history/simple_undo.js markStepBefore` (a step that carries its own earlier state:
  one Undo after Use it on an empty letter keeps the photo; both modes, kept in crash copies);
  `photo/photo_flow_votes.js` (two-letter parts and letters far off their row's size don't size the
  photo); `checks.js twoLetters` ("may be two letters that touch" [Draw a box], added by `cache.js`
  from the photo list) and `checks/keep_weight.js` (Match size keeps the pen's width);
  `nib/raw_corners.js` and `filter.js take` (a flick keeps its corners; a fast sample goes in as it
  is); `start/name_field.js` (the suggested name picked whole on a press); `coach/rules.js
  tryItFirst` (Try it before the photo's next part, once); `start/install_offer.js photoWalkNow`;
  `pwa/notice_place.js` (under the bar when its gap is narrow); `tryit/gap_handle.js` (no faster
  than at 72 pt); `mode/locks.js` (a drawing tool's press is the tool's in both modes).
  Acceptance: `tests/beginner.verify.mjs` (`npm run verify:beginner`, UX-BEGINNER 9.4, on a probe
  build) with `tests/beginner_weight.mjs` and `tests/fixtures/brenna-loose.*`, `brenna-tight.*`;
  B16 real-Chrome checks `close_soon`, `rail_words`, `drawing_tools_lines`, `start_name`. Brennan's
  own session: `docs/GATE2.md`.
- `src/anyink/sketch` (S1, docs/SKETCH.md, D-047 + D-048) — sketched letters' pure core, flag
  `sketch` off, nothing on screen yet: `model.js` (`glyph.anyink.sketch` v1: points, pieces, parts
  line / arc / curve / spline, relations, `ON_PLACES`; `sketchOf` repairs a damaged v1 in place, an
  unreadable `v` is kept untouched; `validateSketch(sketch, { project })`; `sketchThickness` /
  `setSketchThickness`, `thicknessRange`), `hobby.js` (in-house Hobby / MetaPost spline with
  directions and per-side tension, `gripTension` / `gripPull`), `arc.js` (ends + bulge, tangent
  arcs up to 300 degrees), `curves.js` (`pieceSkeleton`: a piece as Brush skeleton cubics; give-way,
  locks, aims, live circles and let-go ovals; `pointsMap`), `extremes.js` (`lockFor`: level / plumb
  only where the curve touches and runs near it), `edge_rule.js` (the ink edge on the line:
  `inkLines`, overshoot, `edgeThickness`, a crossing point on the line itself, `placeEdgePoints`),
  `bumpy.js` (the Bumpy measure per 2,048-unit letter box; pass `{ font }`), `outline_order.js`
  (loop depth and turn), `sketch_record.js` (tags, `reconcile`, `hashBuilt`), `history_hook.js`
  (`beforeSketchStep`, called by `history.js` in both modes; never throws). Words in
  `words/sets/sketch.js`. Tests `sketch/tests` (Hobby fixture from a port of mp.w, no `mpost` here;
  the dead-end replay `dead_end_a.gs2.json`); test page `tests/sketch.html`, `npm run
  verify:sketch-page`. S3 owes: Simple's spacing refit moves built ink after `beforeSketchStep`
  (an `it.todo`), the sweep uses `edgeThickness`, Flip / Mirror turn `aim.dir`.
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
B. Beginner-proof (docs/UX-BEGINNER.md, D-031) — DONE 10/16/2026, Gate 2 next (docs/GATE2.md): B0 done 10/14/2026; B1 done 10/14/2026 (fixes in both modes: panel ids, guide lines, menu contrast, leave warning, notices in the top bar, honest Real font preview, font check with Show me / Fix it; D-032); B2 done 10/14/2026 (mode switch, Simple undo, 200 / 30 cap, looking around is never a step; D-033); B3 done 10/14/2026 (automatic spacing refit inside the step in Simple, "set by you" in All tools, letter-spacing extra, placement engine for B9; D-034); B2 + B3 critic, fix and finalize passes done 10/14/2026 (sides from the body with tails bounded, a letter's own lean, every letter on the line, sloped rows, row sizes, parts rule; real-Chrome checks `b23`, `hooks`, `undo`, `spacing`, `placement` verify scripts); B4 done 10/14/2026 (`src/anyink/words` and `src/anyink/toast`: house words at every display point Simple shares, one toast voice, the banned-word scan; D-035); B5 done 10/14/2026 (`src/anyink/mode`: visibility tables, the key map, the purple band and landing rule, guide-line locks, wired into navigator / menu / actions / tools / keys / settings / panels; D-035); B4 + B5 integration done 10/14/2026 (0 banned-word hits on every Simple page that exists, `verify:b45`); B4 + B5 critic, fix and finalize passes done 10/14/2026 (strict scans on by default, 7.7 error boxes with working buttons, Ctrl+O into the right font, "Saving..." while a write waits, Help / About with a way back, start page with one green, photos closed in Simple until B9; D-035); B6 done 10/14/2026 (`src/anyink/topbar`, `src/anyink/coach`, `history/undo_toast.js`: Simple top bar, the Next line and tips, named undo toasts, the save pill; `coach` on; D-036); B7 done 10/14/2026 (`src/anyink/letter`: header, letter card with Fine-tune, empty overlay, Simple guide lines, guide letter, edges, neighbors, auto-hole, Smooth / Corner, labeled tools; `letterView` on; D-036); B6 + B7 integration done 10/14/2026 (`verify:b67`); B6 + B7 critic, fix and finalize passes done 10/14/2026 (one ink rule, the Point pen's edges and Undo, stale toasts, Delete with [Undo], holes where shapes overlap; D-037; `verify:b67-fixes`; the B5-era walkthroughs pin B5's Simple with `pinB5Simple`); B8 done 10/15/2026 (`src/anyink/nib`: the round Brush, both modes, B / N; `brush` on; D-038); B9 done 10/15/2026 (`src/anyink/photo`: parts, registry, paper, How card, photo dialog, photo card, the flow; `photo` on; D-039); B8 + B9 integration done 10/15/2026 (the opening Brush, the photo hub, drops to the photo screens, `path.js` keeps stroke tags, photo-list images kept in the work file, Fine-tune > Tail; D-040; `verify:b89`); B8 + B9 critic, fix and finalize passes done 10/15/2026 (Fine-tune > Photo, lighter letters and a second pen, clipped strokes and bold dots, the photo list through Undo, rule 18 and the calm Brush line, a smooth slow shaky hand, a resting pen, pasted strokes through Undo, outlines kept per shape and the Undo list's size cap; D-041; `verify:photo-ui`; every check with the flags as shipped); B10 + B11 integration done 10/15/2026 (`src/anyink/board`
   and `src/anyink/checks`: the letter board as Simple's home, "Needs a look" with one-click fixes
   and Looks fine to me, one count on the board, the rail and the Next line, a dropped .gs2 opens,
   the backup keeps each Undo step's copy once; `board` and `checks` on; D-042; `verify:b1011`);
   B10 + B11 critic, fix and finalize passes done 10/15/2026 (fixed Brush letters sit on the pen line, tail
   bowls open or closed, the size check waits for 5 photo letters, Move the line inside the letter
   box, the board filter never sticks, the outlined fix while brushing, Something else ends on a
   tile or [Show me], stray dots and crossed-out letters in photos, the prefill after a skip, the
   flip toast after Use it, the backup through a save; D-043; `verify:board-page`); B12 + B13 done
   10/15/2026 (`src/anyink/tryit` and `src/anyink/start`: Try it with stand-ins, gap fixes and Letter
   spacing; the start screen, the crash card, Start a new font..., the install toast; `tryIt` and
   `startScreen` on; four tracks, the integration, critic, fix and finalize passes; D-044;
   `verify:b1213`); B14 + B15 done 10/16/2026 (`src/anyink/install`, `src/anyink/fontinfo`,
   `src/anyink/help`: Use in Word and its install card, Font details, Move the guide lines, Help;
   `useInWord`, `fontDetails` and `help` on; five tracks (factcheck, dialog, names, fontinfo, help),
   the integration, critic, fix and finalize passes; D-045; `verify:b1415`); B16 done 10/16/2026
   (section 9's automated run `verify:beginner` passes; a first-timer and an impatient walk at 1600 x
   900 and 1280 x 720, eleven fix tracks and their verifiers, then the final pass: one Undo after Use
   it keeps the photo, two touching letters need a look, Try it before the photo's next part, the
   install offer waits out a photo walk, the gap handle at small sizes, straight Brush legs, the name
   field; every real-Chrome check run one at a time; the launch default flipped to Simple; D-046).
   Gate 2 (Brennan's own session, docs/GATE2.md) run 10/16/2026: the Brush-only letter was a dead
   end, so sketched letters come first (docs/SKETCH.md, D-047, S1 to S9, flag `sketch`). S1 (model,
   curves and measures) done 10/16/2026 (D-048); S2 (Draw) next; then Gate 2b, then M9.
   Brennan has never made a font: plain words, one next step per screen, nothing advanced on the main path.
   Since B16 Simple is the launch default; All tools is `?ui=all` or More tools.
9. Handwriting sheet — pending, next after Gate 2 (plugs into the letter board)
10. Nib brush — pending
11. Alternates — pending
12. Weight slider — pending
13. Roughen / ink bleed — pending
14. PWA — DONE 09/24/2026 by Codex (vite-plugin-pwa injectManifest, prompt-only updates, offline; automated Chrome/Edge checks in docs/PWA-VERIFICATION.md; a real desktop install by Brennan is still owed)
15. Deploy — DONE 09/24/2026 (https://13-1v1.github.io/AnyInk/, repo 13-1V1/AnyInk, .github/workflows/pages.yml: tests then build then Pages on every push to main; docs/DEPLOYMENT-2026-09-24.md)
16. End-to-end check — pending
