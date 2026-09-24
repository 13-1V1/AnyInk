# ANY-INK — Visual audit (Milestone 3)

Every place in upstream v2.10.5 where the user must type code or font data as text, and
what happens to each. Compiled 09/23/2026 from the eight subsystem readings.

Legend: **Hide** = removed or hidden in Milestone 4 (reskin). **Visual in M#** = replaced
by a visual control in that milestone; the number field stays as a secondary readout.
**Allowed** = plain words (names, sample text), permitted by the brief.

## A. Font metrics and settings

| # | Where | What is typed | Action |
|---|---|---|---|
| A1 | Settings > Font: upm, ascent, descent, capHeight, xHeight, overshoot, lineGap (`makeOneSettingsRow`, type Em) | vertical metrics as integers, no undo, no redraw | **Visual in M5**: draggable purple metric lines on the canvas; rows become live readouts; undo entry per drag |
| A2 | Settings > Font: weight (100 to 900) | number | **Visual in M12**: bound to the weight slider's named stops |
| A3 | Settings > Font: italicAngle, slope, stemv, stemh, underline / strikethrough / overline position and thickness | numbers | **Visual in M5**: sliders with readouts (underline / strike / overline as draggable lines in the preview strip is a stretch goal) |
| A4 | Settings > Font: stretch, variant | CSS keywords typed exactly | **Visual in M4**: option-chooser with the fixed keyword list |
| A5 | Settings > Font: panose | ten digits as a string | **Visual in M4**: keep only the existing PANOSE builder dialog; the text field becomes a read-only readout |
| A6 | Settings > Font: family, style, version, designer, URLs, license, copyright, trademark, description | plain words | **Allowed** |
| A7 | Settings > Project: name, versions, id | plain words / read-only | **Allowed** |
| A8 | Settings > Project: custom character range begin / end as `U+4E`, `0x4E`, or decimal | code points as text | **Visual in M5**: pick a Unicode block from the existing block list, or drag-select in the glyph grid; hex shown as readout only |
| A9 | Settings > App: formatSaveFile ("format project file for reading") | exposes JSON formatting | **Hide** in M4 (always compact) |
| A10 | Settings > App: autoSave, saveLivePreviews, "delete auto-saved backups" | localStorage concepts | **Hide** in M6 (replaced by always-on autosave and crash recovery in app preferences) |
| A11 | Settings > App: itemChooserPageSize, autoSideBearingsOnSVGDragDrop, autoRightBearingOnFirstShape, highlightPointsNear* | numeric thresholds | **Done in M4**: sliders with readouts. The two bearing sliders start at -1 because upstream treats -1 as "off". |

## B. Kerning and ligatures

| # | Where | What is typed | Action |
|---|---|---|---|
| B1 | Kerning page, add/edit group dialog: left group, right group | characters or hex ids as a string | **Visual in M5**: click glyph tiles into left / right chips |
| B2 | Kerning page, add/edit group dialog: value | number as text | **Visual in M5**: drag the right letter in the live pair view; readout only |
| B3 | Attributes panel, kern group card: value `<input-number>` | number | **Readout in M5** (bound to the drag) |
| B4 | Kerning page: find pair / delete pair dialogs (one char per side) | characters | **Visual in M5**: click two tiles, or click a pair in the pair view |
| B5 | Kerning canvas: drag anywhere changes value (no hit test), history entry on plain click | n/a | **Fix in M5**: hit-test the right glyph, guard history on real drags, accumulate sub-unit deltas |
| B6 | Ligatures page: new ligature typed as `ff`, `U+66U+66`, or `0x660x66`, optional comma list | characters or code notation | **Visual in M5**: typing plain characters stays **Allowed**; hide the hex / U+ notation; add a tile picker for untypeable characters |

## C. Glyph editing panels (canvas already drags these)

| # | Where | What is typed | Action |
|---|---|---|---|
| C1 | Glyph card: advance width, left / right side bearing | numbers | **Readout** (side bearings already drag on canvas; advance width follows). M4 keeps fields as secondary readouts |
| C2 | Path / point / handle cards: x, y, w, h, h1, h2 | numbers | **Readout** (canvas drags them). M4 |
| C3 | Component instance card: translate, resize, rotation | numbers | **Readout** with canvas drag. M4 |
| C4 | Transforms panel: skew angle / distance, offset distance, rotation, each with Apply | type then apply blind | **Done in M5**: skew angle / distance and rotation are sliders that apply on release (one undo entry each, no Apply); offset keeps its slider + Apply because upstream rebuilds the outline; offset distance becomes the Weight slider in M12 |
| C5 | Guides panel: custom guide location, grid divisions | numbers | **Visual in M5**: drag custom guides on canvas; grid divisions slider |
| C6 | Guides panel: custom guide color picker | color | **Hide** in M4: all guides use the purple structure token |
| C7 | Zoom readout (disabled input) | percentage | **Visual in M4**: zoom slider with readout |
| C8 | Edit canvas: paste raw SVG markup as text (canvas is contenteditable for this) | SVG code | **Hide** in M7: keep SVG *file* drop; image and SVG import go through the trace layer / auto-trace |
| C9 | Quality checks panel thresholds | numbers | **Visual in M4**: small sliders (low priority) |

## D. Preview and global actions

| # | Where | What is typed | Action |
|---|---|---|---|
| D1 | Live preview panel: font size and line gap in px | numbers | **Visual in M5**: points slider in the preview strip |
| D2 | Live preview text and `{{swadesh_207_short}}` placeholder codes | sample text | **Allowed** for text; placeholder codes replaced by the existing pangram / glyph-set buttons (M5) |
| D3 | Global actions: move x/y, scale factors, resize deltas, skew angle, side bearings, monospace width | numbers applied blind to the whole font | **Done in M5**: slider rows with live readouts and Reset; Apply kept for the batch / one undo step; the preview strip re-flows after Apply |
| D4 | Global actions: character range filter shows hex begin/end | read-only | **Allowed** as readout |

## E. Names and files (allowed)

New project name, component name, path name, context string: **Allowed** (plain words).
Project file is `.gs2` JSON but the user never sees or edits it.

## F. What upstream already has (so the brief's "add only if missing" items resolve)

- **Undo / redo**: present and thorough (see RESEARCH §1). Gaps to close in M5: metrics, guides, settings, item creation pre-states, kern click spam, aliasing bug on whole-project restore, Ctrl+Z only on edit-canvas pages.
- **Kerning drag**: present on the Kerning page (blind drag of the selected group). M5 adds hit-testing, a live pair / word view, and tile-based membership.
- **Metrics lines**: drawn, not draggable; side bearings drag. M5 adds drags for ascender, cap height, x-height, descender, and baseline (baseline drag shifts every outline, see D-009).
- **Preview**: full page and pop-out exist with live updates. M5 turns the pop-out's subscribe-to-everything pattern into a persistent bottom strip.
- **Trace layer**: absent. Built in M7.
- **File System Access**: open and in-place save exist; Save As for new projects, remembered folder, folder export, IndexedDB crash recovery are added in M6.

## G. Hard-coded colors to migrate in M4

Counted from the readings: index.html inline styles (9 literals), app.css (3), app-pages.css (about 20 hsla tints), editor-pages.css (4 whites, 1 black), content-pages.css (4), panels.css (6), nav.css (1), pop-out-window.css (5), dialogs.css (3), fancy-button.css (7), glyph-tile.css (4), info-bubble (6, in CSS and JS), input-number.css (2), option-chooser / option-toggle (2), resets.css (7), guide.js (5 rgb constants), draw_edit_affordances.js (6), context_characters.js (5), draw_paths.js (4), display_canvas.js (4), tools.js (5), events_keyboard.js (2), fancy_slider.js (hue-shifting accent), graphics.js (1), action_buttons.js and card_path_point.js (token picks baked into SVG at module load), plus the two duplicated ramp files themselves. Undefined tokens referenced today: `--blue-l98`, `--green-l98`, `--enabled-text`, `--animate-slide-in`, `--global-outline-style`.
