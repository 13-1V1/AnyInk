// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 follow fix track (docs/SKETCH.md section 3, the edge rule: a sketched letter's ink edges sit
	on the lines). B11's size check allows a handwritten letter SIZE_SHARE (a quarter) of slack,
	because a hand never writes to the line; a sketched letter has no such excuse, so one whose
	body stands over its own line by more than the off-line share (checks.js LINE_SHARE of the
	letter box, the same share a bottom may be off the writing line) is too big, with [Match
	size], which lands it exactly (keep_weight.js weightPlan exact). Pure.

	  isAllSketched(item)          every own shape of the letter is built from its active sketch
	                               (Centerline or Outline); false for a mix, Brush, photo, parts
	                               made from another letter, or no shapes
	  isOutlineSketched(item)      isAllSketched, and every one of those shapes is built from an
	                               Outline piece (no Thickness to set: S3 finalize, the soft
	                               note's thicker / thinner leaves it out)
	  topLine(measures, lines)     where the top of the body belongs (font units): its size line
	                               (checks.js lineOf, measured from the body bottom's place), a
	                               round letter's overshoot once
	  standsOver(item, measures, lines)   true when a sketched letter's body top is more than
	                               LINE_SHARE of the letter box over topLine. Only the lines a
	                               letter is drawn to (capitals, small-letter, top); t's
	                               "between" line is a guess, never judged this way
	  topOffBy(measures, lines)    font units the body top is off topLine (+ over), or null
*/
import { isRoundLetter } from '../placement/classes.js';
import { isSketchActive, sketchOf } from '../sketch/model.js';
import { isBuiltShape, sketchIdOf, sketchKeyOf } from '../sketch/sketch_record.js';

/** Must equal checks.js LINE_SHARE (a test keeps them equal; checks.js imports this file). */
export const TOP_SHARE = 0.02;
/** The lines a sketched letter's top is judged against */
const JUDGED = new Set(['capHeight', 'xHeight', 'ascent']);

/**
 * @param {Object} item - Glyph
 * @returns {Boolean}
 */
export function isAllSketched(item) {
	if (!item?.anyink?.sketch) return false;
	let sketch = null;
	try {
		sketch = sketchOf(item);
	} catch {
		return false;
	}
	if (!sketch || !isSketchActive(sketch)) return false;
	const shapes = item.shapes || [];
	return (
		shapes.length > 0 &&
		shapes.every(
			(shape) =>
				shape?.objType === 'Path' && isBuiltShape(shape) && sketchKeyOf(shape) === sketch.key
		)
	);
}

/**
 * @param {Object} item - Glyph
 * @returns {Boolean}
 */
export function isOutlineSketched(item) {
	if (!isAllSketched(item)) return false;
	const sketch = sketchOf(item);
	const outline = new Set(
		(sketch.pieces || []).filter((piece) => piece?.use === 'outline').map((piece) => piece.id)
	);
	return (item.shapes || []).every((shape) => outline.has(sketchIdOf(shape)));
}

/**
 * @param {{char: String, line: {key: String, height: Number} | null}} measures
 * @param {{overshoot: Number}} lines - placement/classes.js guideLines
 * @returns {Number | null}
 */
export function topLine(measures, lines) {
	const { char, line } = measures || {};
	if (!line || !JUDGED.has(line.key) || !(line.height > 0)) return null;
	// lineOf adds the overshoot twice (above and below); the top line is once over the line
	return isRoundLetter(char) ? line.height - lines.overshoot : line.height;
}

/**
 * @param {Object} measures - checks.js measureLetter
 * @param {Object} lines
 * @returns {Number | null}
 */
export function topOffBy(measures, lines) {
	const at = topLine(measures, lines);
	return at === null || !measures?.body ? null : measures.body.top - at;
}

/**
 * @param {Object} item - Glyph
 * @param {Object} measures - checks.js measureLetter
 * @param {Object} lines - placement/classes.js guideLines
 * @returns {Boolean}
 */
export function standsOver(item, measures, lines) {
	const off = topOffBy(measures, lines);
	if (off === null || !(off > TOP_SHARE * lines.box)) return false;
	return isAllSketched(item);
}
