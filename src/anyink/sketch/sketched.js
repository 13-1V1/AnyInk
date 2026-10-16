// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 finalize: does a letter have a sketch to show? Until S3 builds ink from the sketch, a letter
	he sketched has pieces and no ink; the screens that would call it empty (the empty-letter box,
	the tool it opens with, the Next line's facts) ask here first. Only with the 'sketch' flag on,
	so with it off every screen reads the letter as before.

	  hasSketchPieces(item, { isOn })   true when the flag is on and the item's sketch is active
	                                    (not set aside, not from a newer app) with a piece
*/
import { isFeatureOn } from '../mode/features.js';
import { isSketchActive, sketchOf } from './model.js';

/**
 * @param {Object | null} item - Glyph (or ligature / component)
 * @param {{isOn?: (flag: String) => Boolean}} [options]
 * @returns {Boolean}
 */
export function hasSketchPieces(item, { isOn = isFeatureOn } = {}) {
	if (!item || !isOn('sketch')) return false;
	const sketch = sketchOf(item);
	return isSketchActive(sketch) && Array.isArray(sketch.pieces) && sketch.pieces.length > 0;
}
