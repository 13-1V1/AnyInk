// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 finalize: the open letter's brush strokes sorted out inside every item step
	(UX-BEGINNER.md 7.3; second hostile pass). Upstream's paste and "Copy paths from another
	glyph" add their Undo step first and publish after, and the brush sorted pasted copies out
	on the publish (stroke_record.js reconcileStrokes), so the step held the copies' ids from
	before: every Undo or Redo across it brought them back unsorted, and sorting them again gave
	the pasted stroke a new key, so a copy taken earlier no longer found its record. History's
	addState calls this first, as it calls the spacing hook, so the step holds the ids and keys
	the letter keeps.

	  beforeStrokeStep(editor)   sorts out the open letter's strokes; returns how many shapes
	                             changed (0 with no letter open)
*/
import { reconcileStrokes, strokeRecordFinder } from './stroke_record.js';

/**
 * @param {Object} editor - the ProjectEditor
 * @returns {Number}
 */
export function beforeStrokeStep(editor) {
	let item = null;
	try {
		item = editor?.selectedItem;
	} catch {
		return 0;
	}
	if (!Array.isArray(item?.shapes)) return 0;
	return reconcileStrokes(item, { findRecord: strokeRecordFinder(editor.project) });
}
