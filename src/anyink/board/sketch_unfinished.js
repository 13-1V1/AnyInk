// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 fix pass (door-coach track): a sketched letter that is plainly missing strokes is never
	Ready and never "looks done". Found in Chrome: Capital B's stem alone read Ready (1/58 on the
	rail) with rule 24 saying "Pull the thickness until Capital B matches the gray guide letter.",
	and small i's stem alone gave "small i looks done. Next: Capital H."

	S5 brings the real rule (letter_parts.js, rule 23 missingPart, the 'still being drawn' state).
	Until then this is a stand-in on the guide letter's box: the letter's ink against where the
	guide letter sits (placement/classes.js lineTargets, the lines the guide letter is sized to)
	and the narrowest a letter may be (spacing/letter_classes.js MIN_WIDTH_SHARE of its own line
	height, B11's width limit, naturally narrow letters excepted). Pure; only with 'sketch' on, and
	only for a letter whose sketch is active and has built ink, so every other letter reads as
	before.

	  plainly missing      what it says
	  'dot'   i, j         the ink never rises above the small-letter line (half way to the dot)
	  'short' any letter   the ink is under MIN_HEIGHT_SHARE of the guide letter's body height
	  'narrow' not i j l I 1 ! ...   the ink is under MIN_WIDTH_SHARE of the letter's line height

	It reads as B11's "Needs a look" (id SKETCH_UNFINISHED, no fix, "Looks fine to me" honored), so
	the board, the rail and the Next line agree without a state of their own until S5.

	  SKETCH_UNFINISHED                       the look's id
	  MIN_HEIGHT_SHARE                        0.6
	  unfinishedReason(item, char, { font, isOn, open })   'dot' | 'short' | 'narrow' | null
	  unfinishedLook(item, char, { font, isOn, open })     { id, reason, short } | null
*/
import { isLooksFine } from '../checks/looks_fine.js';
import { isFeatureOn } from '../mode/features.js';
import { guideLines, lineTargets } from '../placement/classes.js';
import { builtShapes } from '../sketch/sketch_record.js';
import { isSketchActive, sketchOf } from '../sketch/model.js';
import {
	baseLetter,
	isNaturallyNarrow,
	lineHeightOf,
	MIN_WIDTH_SHARE,
} from '../spacing/letter_classes.js';
import { letterPhrase, sentenceStart } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { inkOf } from './letter_set.js';

export const SKETCH_UNFINISHED = 'sketchUnfinished';
/** Under this share of the guide letter's body height, the letter is plainly short */
export const MIN_HEIGHT_SHARE = 0.6;
/** i and j: the ink must rise this share of the way from the small-letter line to the dot */
const DOT_SHARE = 0.5;
const DOTTED = new Set(['i', 'j']);

/**
 * @param {Object | null} item - Glyph
 * @param {String} char
 * @param {{font?: Object, isOn?: (flag: String) => Boolean, open?: Object | null}} [options]
 * @returns {'dot' | 'short' | 'narrow' | null}
 */
export function unfinishedReason(
	item,
	char,
	{ font = null, isOn = isFeatureOn, open = null } = {}
) {
	if (!item || isOn('sketch') !== true) return null;
	if (typeof char !== 'string' || [...char].length !== 1) return null;
	if (!/[\p{L}\p{N}]/u.test(char)) return null;
	const sketch = sketchOf(item);
	if (!isSketchActive(sketch) || !builtShapes(item, sketch.key).length) return null;
	const box = boxOf(inkOf(item, { open }));
	if (!box) return null;
	const base = baseLetter(char);
	const targets = lineTargets(base, font);
	if (DOTTED.has(base)) {
		const small = guideLines(font).small;
		if (box.yMax < small + DOT_SHARE * (Number(targets.top) - small)) return 'dot';
	} else {
		const body = Number(targets.top) - Number(targets.bottom);
		if (body > 0 && box.yMax - box.yMin < MIN_HEIGHT_SHARE * body) return 'short';
	}
	if (!isNaturallyNarrow(char)) {
		const min = MIN_WIDTH_SHARE * lineHeightOf(char, font);
		if (min > 0 && box.xMax - box.xMin < min) return 'narrow';
	}
	return null;
}

/**
 * @param {Object | null} item
 * @param {String} char
 * @param {Object} [options] - unfinishedReason's
 * @returns {{id: String, reason: String, short: String} | null}
 */
export function unfinishedLook(item, char, options = {}) {
	const why = unfinishedReason(item, char, options);
	if (!why || isLooksFine(item, SKETCH_UNFINISHED)) return null;
	const letter = sentenceStart(letterPhrase(char) || char);
	if (why === 'dot') {
		return {
			id: SKETCH_UNFINISHED,
			reason: word('sketch.next.missingPart', { letter, part: word('sketch.part.dot') }),
			short: word('sketch.unfinished.tipDot'),
		};
	}
	return {
		id: SKETCH_UNFINISHED,
		reason: word(why === 'short' ? 'sketch.unfinished.short' : 'sketch.unfinished.narrow', {
			letter,
		}),
		short: word('sketch.unfinished.tipLooks'),
	};
}

/**
 * @param {Array<Object>} paths
 * @returns {{xMin: Number, xMax: Number, yMin: Number, yMax: Number} | null}
 */
function boxOf(paths) {
	let box = null;
	paths.forEach((path) => {
		const m = path?.maxes;
		if (!m || ![m.xMin, m.xMax, m.yMin, m.yMax].every(Number.isFinite)) return;
		if (!box) box = { xMin: m.xMin, xMax: m.xMax, yMin: m.yMin, yMax: m.yMax };
		else {
			box.xMin = Math.min(box.xMin, m.xMin);
			box.xMax = Math.max(box.xMax, m.xMax);
			box.yMin = Math.min(box.yMin, m.yMin);
			box.yMax = Math.max(box.yMax, m.yMax);
		}
	});
	return box;
}
