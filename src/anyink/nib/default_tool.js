// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8: which tool a letter opens with in the Simple letter view (UX-BEGINNER.md 4.3 Tools: the
	Brush is "Default on an empty letter", Select "Default on a letter with ink"). Pure; the letter
	view calls it when it opens a letter (letter/open_tool.js, B8 + B9 integration). Empty is the
	one rule the rail, the Next line, the card and the overlay read (board/letter_set.js
	isEmptyLetter).

	B8 + B9 integration: the Brush a letter opens with is no choice of his. The empty-letter box
	stays (its [Use a photo] is the screen's green button, 4.3) and the Next line still offers the
	photo (rule 8), while a drag on the paper draws at once. Once he picks the Brush himself
	([Draw with the brush], its tool button, B or N), the box steps aside and the line says what a
	drag does, as for every other drawing tool. This file keeps which letter the Brush was picked
	for by opening it, so the overlay, the coach and the tips read one answer:

	  toolForOpenedLetter(item, { isOn, open })   'nib' | 'resize', or null while 'brush' is off
	                                              (the tool stays as it is); S2 finalize:
	                                              'sketchLine' for an empty letter with sketch
	                                              pieces while 'sketch' is on
	  pickOpeningTool(editor, tool, pick)   picks `tool` with pick(tool) as the letter opens; a
	                                        'nib' pick is remembered as the opening Brush
	  notePickedTool(editor)                a tool he picked (tools.js switchToolTo): the Brush is
	                                        his own from now on
	  isOpeningBrush(editor)                true while the Brush is picked only because the open
	                                        letter opened with it
	  resetOpeningToolForTests()

	S3 (docs/SKETCH.md section 7, the empty letter's one green door): with 'sketch' on, every empty
	letter opens on the Line (no longer the Brush), and a letter with ink on Select. The Line picked
	this way is an opening tool as the Brush is: the door stays (its [Sketch it] or, with a photo
	part waiting, [Use the same photo] is the green button) while a click on the paper starts a
	piece at once; his own pick of any tool makes it his.

	  isOpeningTool(editor)                 true while the picked tool (the Brush or, with 'sketch'
	                                        on, the Line) is picked only because the open letter
	                                        opened with it
	  OPENING_TOOLS                         ['nib', 'sketchLine']
	S3 fix pass: a letter with a live sketch (not set aside) opened on the Line even once it had
	built ink, because Select on built shapes set the sketch aside. S4 lifts it: Select on a live
	sketch picks and drags the sketch (sketch/select_tool.js), so a sketched letter with ink opens
	on Select like any letter with ink. With 'sketch' off, nothing here changes.
*/
import { isEmptyLetter } from '../board/letter_set.js';
import { isFeatureOn } from '../mode/features.js';
import { hasSketchPieces } from '../sketch/sketched.js';

/**
 * @param {Object} item - Glyph
 * @param {{isOn?: (flag: String) => Boolean, open?: Object}} [options] - open: the shape the Point
 *   pen is still drawing, if any
 * @returns {'nib' | 'resize' | 'sketchLine' | null}
 */
export function toolForOpenedLetter(item, { isOn = isFeatureOn, open = null } = {}) {
	const sketch = isOn('sketch') === true;
	if (!isOn('brush') && !sketch) return null;
	const empty = isEmptyLetter(item, { open });
	// S4: a sketched letter with ink opens on Select, which edits its sketch (S3 opened it on
	// the Line: Select on its built shapes set the sketch aside)
	if (!item || !empty) return item ? 'resize' : sketch ? 'sketchLine' : 'nib';
	// S3: with 'sketch' on every empty letter opens on the Line (the door's [Sketch it] tool);
	// S2 finalize: a letter he sketched (no ink yet) opens on it too, to go on sketching
	return sketch || hasSketchPieces(item, { isOn }) ? 'sketchLine' : 'nib';
}

/** The tools a letter can open with that keep the door on screen (S3: the Line too) */
export const OPENING_TOOLS = Object.freeze(['nib', 'sketchLine']);

/** editor -> { id: the letter id, tool: the tool } picked by opening it */
let opening = new WeakMap();
/** true while pickOpeningTool's own pick runs */
let applying = false;

/**
 * @param {Object} editor - ProjectEditor
 * @param {String} tool - the tool the letter opens with
 * @param {(tool: String) => void} pick - picks it (tools.js switchToolTo)
 */
export function pickOpeningTool(editor, tool, pick) {
	if (!editor) return;
	// remembered before the pick, so everyone who hears the pick reads it as the opening tool
	if (OPENING_TOOLS.includes(tool)) opening.set(editor, { id: editor.selectedGlyphID, tool });
	else opening.delete(editor);
	applying = true;
	try {
		pick(tool);
	} finally {
		applying = false;
	}
}

/**
 * A tool he picked himself (the tool column, a key, the overlay's [Draw with the brush]).
 * @param {Object} editor - ProjectEditor
 */
export function notePickedTool(editor) {
	if (!applying && editor) opening.delete(editor);
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Boolean}
 */
export function isOpeningBrush(editor) {
	return editor?.selectedTool === 'nib' && isOpeningTool(editor);
}

/**
 * S3: the Brush or the Line, picked only because the open letter opened with it.
 * @param {Object} editor - ProjectEditor
 * @returns {Boolean}
 */
export function isOpeningTool(editor) {
	if (!editor || !opening.has(editor)) return false;
	const { id, tool } = opening.get(editor);
	return editor.selectedTool === tool && id === editor.selectedGlyphID;
}

export function resetOpeningToolForTests() {
	opening = new WeakMap();
	applying = false;
}
