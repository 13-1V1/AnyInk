// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-flow, fix pass: the quiet notes under step C's "Look right?" (docs/UX-BEGINNER.md 4.4
	step C; they work like B11's soft notes: a sentence, never a reason the letter isn't Ready).
	Pure. The photo flow puts them in its state (getFlow(editor).notes) and the photo card shows
	each one as word(key, vars); they say what the first-timer could not see for himself.

	- Two letters touch (first-timer: "na" written touching was one part; naming it n traced
	  "na", and nothing said why). A part at least TWO_WIDE_SHARE times as wide as the middle
	  width of the photo's other letter parts, and at least TWO_WIDE_ASPECT times as wide as it is
	  tall, may hold two letters. The card's own [Draw a box] is the fix, so the note names it:
	  photoFlow.note.twoLetters. touchingLetters(record, partId) is the rule, for the photo dialog
	  too.
	- Reaches past the lines (first-timer: an f written about 30 % bigger traced 2378 units tall in
	  a 2048-unit letter box, past the top line at 1550, and nothing warned him; one letter that
	  tall makes every line of the font sit further apart). Traced ink more than REACH_SHARE of the
	  letter box above the top line or below the tail line (B11's limit for "Pokes past the top or
	  tail line"): photoFlow.note.reachesAbove / reachesBelow, with the letter's name.

	  TWO_WIDE_SHARE (1.6), TWO_WIDE_ASPECT (1.25), REACH_SHARE (0.05)
	  touchingLetters(record, partId) -> Boolean
	  reachPast(shapes, font) -> 'above' | 'below' | null; shapes in font units
	  stepNotes({ record, partId, shapes, font, char }) -> frozen [{ key, vars }]
*/
import { guideLines } from '../placement/classes.js';
import { TWO_WIDE_ASPECT, TWO_WIDE_SHARE, mayBeTwoLetters } from './photo_registry.js';
import { letterPhrase, sentenceStart } from '../words/letter_name.js';

export { TWO_WIDE_ASPECT, TWO_WIDE_SHARE };

/** Ink further than this share of the letter box past the top or tail line (B11). */
export const REACH_SHARE = 0.05;

/**
 * @param {Object} record - the photo's record (photo_registry.js)
 * @param {String} partId
 * @returns {Boolean} true when the part may be two letters that touch (the registry's rule,
 *   shared with the alphabet prefill and the photo dialog)
 */
export function touchingLetters(record, partId) {
	return mayBeTwoLetters(record, partId);
}

/**
 * @param {Array<Object>} shapes - traced Paths, font units
 * @param {Object} font - project.settings.font
 * @returns {'above' | 'below' | null}
 */
export function reachPast(shapes, font) {
	let top = -Infinity;
	let bottom = Infinity;
	for (const shape of Array.isArray(shapes) ? shapes : []) {
		const [low, high] = heightOf(shape);
		if (high > top) top = high;
		if (low < bottom) bottom = low;
	}
	if (!Number.isFinite(top)) return null;
	const lines = guideLines(font);
	const slack = REACH_SHARE * lines.box;
	if (top > lines.top + slack) return 'above';
	if (bottom < lines.tail - slack) return 'below';
	return null;
}

/**
 * @param {{record?: Object, partId?: String, shapes?: Array<Object>, font?: Object,
 *   char?: String}} step
 * @returns {ReadonlyArray<{key: String, vars: Object}>}
 */
export function stepNotes({ record, partId, shapes, font, char } = {}) {
	const notes = [];
	if (touchingLetters(record, partId)) notes.push({ key: 'photoFlow.note.twoLetters', vars: {} });
	const reach = Array.isArray(shapes) && shapes.length ? reachPast(shapes, font) : null;
	if (reach) {
		const letter = sentenceStart(letterPhrase(char) || char || '');
		notes.push({
			key: reach === 'above' ? 'photoFlow.note.reachesAbove' : 'photoFlow.note.reachesBelow',
			vars: { letter },
		});
	}
	return Object.freeze(
		notes.map((note) => Object.freeze({ ...note, vars: Object.freeze(note.vars) }))
	);
}

/** A shape's lowest and highest y (its curves' own bounds, Path.maxes; else its points). */
function heightOf(shape) {
	try {
		const m = shape?.maxes;
		if (Number.isFinite(m?.yMin) && Number.isFinite(m?.yMax)) return [m.yMin, m.yMax];
	} catch {
		// fall back to the points
	}
	const ys = (shape?.pathPoints || []).map((pp) => Number(pp?.p?.y)).filter(Number.isFinite);
	return ys.length ? [Math.min(...ys), Math.max(...ys)] : [Infinity, -Infinity];
}
