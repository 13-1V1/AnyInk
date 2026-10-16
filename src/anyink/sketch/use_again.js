// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 finalize (docs/SKETCH.md section 7 "set aside"): the way back from a set-aside sketch. A
	press of V and a drag on built ink (until S4 brings Select on the sketch), Edit points, a
	paste... changes the built shapes behind the sketch's back and the sketch is set aside
	(detach.js); his changed shapes are kept. [Use the sketch again] on the card takes the
	sketch back: the shapes built from it (as he changed them) go, the ink is built from the
	sketch again, and the sketch is live, as ONE step ("used small n's sketch again"). Shapes he
	drew himself (no tag of this sketch) stay. Undo puts the set-aside letter back.

	  canUseAgain(item)              a set-aside sketch (not one from a newer ANY-INK) with pieces
	  useSketchAgain(editor, item)   the step; false when there is nothing to take back
*/
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { rebuildItem } from './build.js';
import { isNewerSketch, sketchOf } from './model.js';

/**
 * @param {Object} item - Glyph
 * @returns {Boolean}
 */
export function canUseAgain(item) {
	const sketch = sketchOf(item);
	return (
		!!sketch &&
		sketch.setAside === true &&
		!isNewerSketch(sketch) &&
		Array.isArray(sketch.pieces) &&
		sketch.pieces.length > 0
	);
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {Object} [item] - the letter (the open one by default)
 * @returns {Boolean}
 */
export function useSketchAgain(editor, item = editor?.selectedItem) {
	if (!item || !canUseAgain(item)) return false;
	const sketch = sketchOf(item);
	sketch.setAside = false;
	sketch.at = Date.now();
	try {
		// forced: the built shapes are his changed ones; the sketch's own ink takes their place
		rebuildItem(item, { project: editor.project, editor, force: true });
	} catch (error) {
		sketch.setAside = true;
		console.warn('ANY-INK sketch: the sketch could not be used again', error);
		return false;
	}
	const letter = letterPhrase(item.chars ?? '') || word('history.thisLetter');
	editor.history?.addState?.(word('sketch.step.usedAgain', { letter }));
	editor.publish?.('currentItem', item);
	return true;
}
