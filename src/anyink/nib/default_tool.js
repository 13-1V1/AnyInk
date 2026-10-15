// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
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
	                                              (the tool stays as it is)
	  pickOpeningTool(editor, tool, pick)   picks `tool` with pick(tool) as the letter opens; a
	                                        'nib' pick is remembered as the opening Brush
	  notePickedTool(editor)                a tool he picked (tools.js switchToolTo): the Brush is
	                                        his own from now on
	  isOpeningBrush(editor)                true while the Brush is picked only because the open
	                                        letter opened with it
	  resetOpeningToolForTests()
*/
import { isEmptyLetter } from '../board/letter_set.js';
import { isFeatureOn } from '../mode/features.js';

/**
 * @param {Object} item - Glyph
 * @param {{isOn?: (flag: String) => Boolean, open?: Object}} [options] - open: the shape the Point
 *   pen is still drawing, if any
 * @returns {'nib' | 'resize' | null}
 */
export function toolForOpenedLetter(item, { isOn = isFeatureOn, open = null } = {}) {
	if (!isOn('brush')) return null;
	return !item || isEmptyLetter(item, { open }) ? 'nib' : 'resize';
}

/** editor -> the letter id the Brush was picked for by opening it */
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
	// remembered before the pick, so everyone who hears the pick reads it as the opening Brush
	if (tool === 'nib') opening.set(editor, editor.selectedGlyphID);
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
	if (!editor || editor.selectedTool !== 'nib' || !opening.has(editor)) return false;
	return opening.get(editor) === editor.selectedGlyphID;
}

export function resetOpeningToolForTests() {
	opening = new WeakMap();
	applying = false;
}
