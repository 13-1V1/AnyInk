// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 (docs/SKETCH.md sections 7 and 11 step 11): the open letter's sketch looked after inside
	every item step, beside the brush's beforeStrokeStep (nib/history_hook.js). History's addState
	calls it first, so the step holds what it sorted out and Undo and Redo bring the same back.

	In S1 it does two things, and builds nothing (the rebuild arrives in S3):
	  - reconcile: built-shape tags that are foreign, stale or repeated go (sketch_record.js), so a
	    pasted copy of built shapes is plain ink
	  - the hash check: when the letter's built shapes no longer match sketch.builtHash, they were
	    changed behind the sketch's back (Edit points, Merge, a paste, ...); the sketch is set
	    aside (setAside: true) and never rebuilt, so his changes to the shapes are kept. A follow
	    plan (S3) updates the hash, so its moves never count. A sketch already set aside, or from
	    a newer app, is left alone.
	A letter with no sketch and no tagged shape costs one pass over its shapes.

	It never stops the step: a sketch whose points or pieces are the wrong kind of thing (sketchOf
	puts a v1 one right first, so this is a newer sketch) is left alone, and anything that throws
	is caught (a warning, nothing done), so History still records the step. The hook runs with the
	'sketch' flag off too, because built shapes and their tags can arrive in a work file.

	  beforeSketchStep(editor)   { untagged, setAside }: how many shapes lost their tags, and
	                             true when this step set the sketch aside (S3 says so in a toast)
*/
import { isSketchActive, sketchOf } from './model.js';
import { builtMatches, isBuiltShape, reconcile } from './sketch_record.js';

const NOTHING = Object.freeze({ untagged: 0, setAside: false });

/**
 * @param {Object} editor - the ProjectEditor
 * @returns {{untagged: Number, setAside: Boolean}}
 */
export function beforeSketchStep(editor) {
	let item = null;
	try {
		item = editor?.selectedItem;
	} catch {
		return NOTHING;
	}
	if (!Array.isArray(item?.shapes)) return NOTHING;
	try {
		const sketch = sketchOf(item);
		if (sketch && !hasSoundShape(sketch)) return NOTHING;
		if (!sketch && !item.shapes.some(isBuiltShape)) return NOTHING;
		const untagged = reconcile(item);
		if (!isSketchActive(sketch) || builtMatches(item)) return { untagged, setAside: false };
		sketch.setAside = true;
		return { untagged, setAside: true };
	} catch (error) {
		console.warn('ANY-INK sketch: the step went on without its sketch check', error);
		return NOTHING;
	}
}

/** The cheap check before anything reads the sketch: points a plain object, pieces a list (a
 * newer sketch, kept as it is, may still be any shape; the step then leaves it alone) */
function hasSoundShape(sketch) {
	const points = sketch.points;
	return (
		!!points && typeof points === 'object' && !Array.isArray(points) && Array.isArray(sketch.pieces)
	);
}
