// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 7 "Anything that changes built shapes without telling the sketch is
	caught, not listed", D-047 point 1): when a letter's built shapes no longer match the hash its
	last sketch step stored (sketch_record.js builtMatches), something changed them behind the
	sketch's back: Edit points, the Point pen, Merge, Clear letter, Remove specks, a paste, the
	photo flow, Match size's grow, rotate, the attributes panel, a multi-letter drag... A follow
	plan (follow.js) moves the sketch with its ink and stores the hash again, so its moves never
	count. Then the sketch is set aside instead of rebuilt: his changes to the shapes are kept,
	the sketch stays in the file under setAside: true and is never rebuilt, and deleted built
	shapes never come back.

	The toast "Small n's sketch is set aside. Your changes to the shapes are kept." [Undo] comes
	once the step is recorded (History records it right after its hooks), so [Undo] takes back
	exactly that step while it is the newest change (history/undo_toast.js undoOffer). Only in
	Simple with the 'sketch' flag on (its words ship with it); All tools allows editing built
	shapes and sets the sketch aside quietly (SKETCH.md section 7 "All tools").

	  isDetached(item)                     an active sketch whose built shapes don't match
	  setAside(item, { editor, say })      sets the sketch aside; true when it did. say (default
	                                       true): the toast after the step
	  detachIfChanged(item, { editor, say })   isDetached then setAside; true when it set it aside
*/
import { undoOffer } from '../history/undo_toast.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { toast } from '../toast/toast.js';
import { letterPhrase, sentenceStart } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { isSketchActive, sketchOf } from './model.js';
import { builtMatches } from './sketch_record.js';

/**
 * @param {Object} item
 * @returns {Boolean}
 */
export function isDetached(item) {
	const sketch = sketchOf(item);
	return isSketchActive(sketch) && !builtMatches(item);
}

/**
 * @param {Object} item
 * @param {{editor?: Object, say?: Boolean}} [options]
 * @returns {Boolean}
 */
export function setAside(item, { editor = null, say = true } = {}) {
	const sketch = sketchOf(item);
	if (!isSketchActive(sketch)) return false;
	sketch.setAside = true;
	if (say && editor && isFeatureOn('sketch') && isSimpleMode()) sayLater(editor, item);
	return true;
}

/**
 * @param {Object} item
 * @param {{editor?: Object, say?: Boolean}} [options]
 * @returns {Boolean}
 */
export function detachIfChanged(item, options = {}) {
	if (!isDetached(item)) return false;
	return setAside(item, options);
}

/** The toast once the step that set it aside is the newest one */
function sayLater(editor, item) {
	const letter = sentenceStart(letterPhrase(item?.chars || '') || word('history.thisLetter'));
	queueMicrotask(() => {
		try {
			toast('sketch.toast.setAside', { letter }, { kind: 'destructive', ...undoOffer(editor) });
		} catch (error) {
			console.warn('ANY-INK sketch: the set-aside toast was not shown', error);
		}
	});
}
