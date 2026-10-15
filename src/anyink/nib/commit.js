// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush: one finished stroke into the open letter, as one Undo step (UX-BEGINNER.md 7.3: "Brush
	stroke | Item step 'drew a stroke on B'"). The points are inked (ink.js), each outline becomes
	its own shape named and tagged for the stroke (its id, a key no other stroke has, and which
	part it is), the skeleton is kept in glyph.anyink.nib.strokes (stroke_record.js), and then the
	step is recorded, so the step holds all of it. Copies of strokes pasted into the letter are
	sorted out first (stroke_record.js reconcileStrokes), so the new stroke's id is new. In Simple the
	step's spacing hook (B3) makes a letter's first ink automatic and fits it, inside the same
	step. Brush strokes are always ink: auto-hole (B7) is never asked about them (7.1 #5), and they
	are never merged into other shapes. Nothing is picked afterwards, so the canvas shows only ink.

	  commitStroke(editor, points, { size, pixel, skeleton })   { strokeId, shapes, ink } or null
	                                   when there is no letter or no ink; points in font units;
	                                   skeleton: the center line already built from the points
	                                   (the Brush builds it while drawing, skeleton.js), inked as
	                                   it is, so the ink is the picture he saw
	  stepTitle(item)                  "drew a stroke on Capital B"
*/
import { checkForFirstShapeAutoRSB } from '../../edit_canvas/tools/tools.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { inkSkeleton, inkStroke } from './ink.js';
import {
	addStrokeRecord,
	newStrokeKey,
	nextStrokeId,
	reconcileStrokes,
	strokeName,
	strokeRecordFinder,
	tagStroke,
} from './stroke_record.js';
import { strokePaths } from './stroke_shapes.js';

/** Items a brush can draw on: letters, joined letters and reusable parts */
const DRAWABLE = Object.freeze(['Glyph', 'Ligature', 'Component']);

/**
 * @param {Object} editor - ProjectEditor
 * @param {Array<[Number, Number]>} points
 * @param {{size: Number, pixel?: Number, skeleton?: Array}} options
 * @returns {{strokeId: Number, shapes: Array<Object>, ink: Object} | null}
 */
export function commitStroke(editor, points, { size, pixel = 0, skeleton = null }) {
	const item = editor?.selectedItem;
	if (!item || !DRAWABLE.includes(item.objType) || !Array.isArray(item.shapes)) return null;
	const ink = skeleton ? inkSkeleton(skeleton, size) : inkStroke(points, { size, pixel });
	if (!ink.contours.length) return null;
	// pasted copies of strokes sorted out first, so the new id is one no shape has (B8 + B9 fix)
	reconcileStrokes(item, { findRecord: strokeRecordFinder(editor.project) });
	const strokeId = nextStrokeId(item);
	const key = newStrokeKey();
	const shapes = strokePaths(ink.contours, { name: strokeName(strokeId) }).map((path, part) => {
		const shape = item.addOneShape(path);
		tagStroke(shape, strokeId, { key, part });
		return shape;
	});
	checkForFirstShapeAutoRSB();
	addStrokeRecord(item, { id: strokeId, key, size: ink.size, skeleton: ink.skeleton, shapes });
	editor.multiSelect?.points?.clear?.();
	editor.multiSelect?.shapes?.clear?.();
	editor.history.addState(stepTitle(item));
	editor.publish?.('currentItem', editor.selectedItem);
	return { strokeId, shapes, ink };
}

/**
 * @param {Object} item
 * @returns {String}
 */
export function stepTitle(item) {
	const name = letterPhrase(item?.chars || '') || word('history.thisLetter');
	return word('brush.step.drew', { name });
}
