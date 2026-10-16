// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 + B11 integration: the [Looks fine to me] press (UX-BEGINNER.md 4.2 "Ready", 4.3 the
	letter card's chip, 7.3). One item Undo step about that letter, titled "said small n looks
	fine" (checks.step.looksFine), wherever it is pressed: the letter card (the letter open) or a
	board tile under "Needs a look" (another letter: fix_step.js recordLetterStep points History at
	it for the one step and puts the editor back, so the board stays the board). The record is
	looks_fine.js's (glyph.anyink.checksOk), so the step's after-copy holds it and Undo takes it
	back with the letter. Nothing to say fine (no such check, or said already): no step.

	  looksFineStep(editor, itemId, checkId)   -> { done, title, itemId, flipped }
	  runLooksFine(args, { editor })           the 'looksFine' coach action (filters.js runs it
	                                           with { char, check }; the card with { itemId,
	                                           check }). Simple with 'checks' on only
*/
import { charToHex } from '../../common/character_ids.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { word } from '../words/words.js';
import { nameOf, recordLetterStep } from './fix_step.js';
import { setLooksFine } from './looks_fine.js';

/**
 * @param {Object} editor - ProjectEditor
 * @param {String} itemId - 'glyph-0x6e'
 * @param {String} checkId - checks.js CHECK id ('offLine')
 * @returns {{done: Boolean, title: String, itemId: String, flipped: Array<String>}}
 */
export function looksFineStep(editor, itemId, checkId) {
	const item = editor?.project?.glyphs?.[itemId] || editor?.project?.ligatures?.[itemId] || null;
	if (!item || typeof checkId !== 'string' || !checkId) {
		return { done: false, title: '', itemId, flipped: [] };
	}
	const title = word('checks.step.looksFine', { letter: nameOf(item) });
	return recordLetterStep(editor, itemId, title, (letter) => setLooksFine(letter, checkId));
}

/**
 * @param {{char?: String, itemId?: String, check?: String}} args
 * @param {{editor?: Object}} [context]
 * @returns {Boolean} true when the letter now says that check looks fine
 */
export function runLooksFine(args, { editor = null } = {}) {
	if (!isSimpleMode() || !isFeatureOn('checks') || !editor) return false;
	const hex = typeof args?.char === 'string' ? charToHex(args.char) : false;
	const itemId = args?.itemId || (hex ? `glyph-${hex}` : null);
	if (!itemId) return false;
	return looksFineStep(editor, itemId, args?.check).done;
}
