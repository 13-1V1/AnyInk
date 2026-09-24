// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK kern pair layout (Milestone 5, D-010).
	Pure layout for the pair view: which sample glyphs flank the pair so kerning is judged
	inside a word, and where everything sits in em units. Drawing is in pair_view.js.

	Em space matches upstream's kern canvas: the left representative's advance ends at x = 0,
	the right representative starts at x = value. Sample glyphs continue outward using each
	glyph's advanceWidth and the kern between neighbors.
*/
import { hexesToChars } from '../../common/character_ids.js';
import { kernOffsetFor } from './kern_lookup.js';

/**
 * 'lower' | 'upper' | 'other' for a hex id.
 * @param {String} hex
 * @returns {String}
 */
export function caseOfHex(hex) {
	const char = hexesToChars(hex || '');
	if (!char) return 'other';
	const lower = char.toLowerCase();
	const upper = char.toUpperCase();
	if (lower === upper) return 'other';
	return char === lower ? 'lower' : 'upper';
}

/**
 * Sample characters to try beside a glyph, best first.
 * Lowercase pairs get 'n' (fallback 'o'), uppercase get 'H' (fallback 'O').
 * @param {String} hex
 * @returns {Array<String>} characters
 */
export function contextCharsFor(hex) {
	const kind = caseOfHex(hex);
	if (kind === 'lower') return ['n', 'o'];
	if (kind === 'upper') return ['H', 'O'];
	return ['o', 'O', 'n', 'H'];
}

/**
 * First sample glyph from the preference list that exists in the project with ink.
 * @param {Object} project - GlyphrStudioProject
 * @param {String} hex - the representative the sample sits next to
 * @returns {Object | false} Glyph
 */
export function pickContextGlyph(project, hex) {
	if (!project) return false;
	for (const char of contextCharsFor(hex)) {
		const id = `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;
		const glyph = project.getItem(id, false);
		if (glyph && glyph.shapes && glyph.shapes.length) return glyph;
	}
	return false;
}

/**
 * Positions for everything the pair view draws.
 * @param {Object} project
 * @param {Object} kernGroup - KernGroup
 * @param {{left: String|false, right: String|false}} reps - representative hex ids
 * @param {Function} [kernFn] - (leftHex, rightHex) => number; defaults to the lookup
 * @returns {{
 *   value: Number,
 *   left: {hex: String, glyph: Object|false, x: Number} | null,
 *   right: {hex: String, glyph: Object|false, x: Number} | null,
 *   leftContext: {glyph: Object, x: Number} | null,
 *   rightContext: {glyph: Object, x: Number} | null
 * }}
 */
export function layoutPairView(project, kernGroup, reps, kernFn) {
	const kern = kernFn || ((a, b) => kernOffsetFor(project, a, b));
	const value = Number(kernGroup?.value) || 0;
	const result = { value, left: null, right: null, leftContext: null, rightContext: null };
	if (!project || !kernGroup) return result;

	if (reps.left) {
		const glyph = project.getItem(`glyph-${reps.left}`, false) || false;
		const advance = glyph ? glyph.advanceWidth : project.defaultAdvanceWidth;
		result.left = { hex: reps.left, glyph, x: -advance };
		const sample = pickContextGlyph(project, reps.left);
		if (sample) {
			const sampleHex = sample.id.replace('glyph-', '');
			const x = result.left.x - kern(sampleHex, reps.left) - sample.advanceWidth;
			result.leftContext = { glyph: sample, x };
		}
	}

	if (reps.right) {
		const glyph = project.getItem(`glyph-${reps.right}`, false) || false;
		const advance = glyph ? glyph.advanceWidth : project.defaultAdvanceWidth;
		result.right = { hex: reps.right, glyph, x: value };
		const sample = pickContextGlyph(project, reps.right);
		if (sample) {
			const sampleHex = sample.id.replace('glyph-', '');
			const x = value + advance + kern(reps.right, sampleHex);
			result.rightContext = { glyph: sample, x };
		}
	}

	return result;
}
