// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 spacing: the gap rule (UX-BEGINNER 10, B3; D-017's 8% bearings). Pure numbers.

	The straight-side gap G is 8% of the small-letter height (88 units at the default 1,100).
	Each side of a letter gets a share of G by its kind:
	  straight 1 G, round 0.6 G, open or slanted 0.4 G; punctuation 0.6 G on both sides.
	Gaps are whole font units. (B3 fix: the spec's 0.2 G for open sides left two open sides that
	meet at the same height, t's bar and y's arm in "ty", 0.4 G apart: 35 units at 2,048, touching
	at text sizes. At 0.4 G such a pair sits 0.8 G apart, near a round pair's 1.2 G once the white
	under the arms is counted.)

	The letter-spacing extra (Try it's "Move all letters closer or further apart") is added to
	every side, from -G to +G. A side never goes below zero space unless it already was (a
	hanging f): withExtra(base, extra) = max(base + extra, min(base, 0)). So the far left end
	means letters touch, never overlap.
*/
import { whole } from './round.js';

/** G as a share of the small-letter height. */
export const GAP_SHARE = 0.08;
/** Each side kind's share of G. */
export const SIDE_SHARE = Object.freeze({ S: 1, R: 0.6, O: 0.4 });
/** Punctuation's share of G, on both sides. */
export const PUNCTUATION_SHARE = 0.6;

/**
 * @param {Object} font - settings.font
 * @returns {Number} G in font units (not rounded); with no usable small-letter height, half
 *   the letter box stands in for it
 */
export function gapUnit(font) {
	const xHeight = Number(font?.xHeight);
	if (xHeight > 0) return xHeight * GAP_SHARE;
	const upm = Number(font?.upm) > 0 ? Number(font.upm) : 1000;
	return (upm / 2) * GAP_SHARE;
}

/**
 * @param {'S' | 'R' | 'O'} kind - side kind
 * @param {Object} font - settings.font
 * @param {{punctuation?: Boolean}} [options] - punctuation gets 0.6 G whatever its kind
 * @returns {Number} the side's gap, whole font units
 */
export function sideGap(kind, font, { punctuation = false } = {}) {
	const share = punctuation ? PUNCTUATION_SHARE : SIDE_SHARE[kind] ?? SIDE_SHARE.O;
	return whole(share * gapUnit(font));
}

/**
 * @param {Object} font - settings.font
 * @returns {{min: Number, max: Number}} the letter-spacing slider's ends, whole font units
 */
export function extraRange(font) {
	const g = whole(gapUnit(font));
	return { min: -g, max: g };
}

/**
 * @param {*} value - requested extra
 * @param {Object} font - settings.font
 * @returns {Number} a whole number from -G to +G (0 for anything that isn't a number)
 */
export function clampExtra(value, font) {
	const { min, max } = extraRange(font);
	return Math.min(max, Math.max(min, whole(value)));
}

/**
 * One side with the extra added, floored at touching.
 * @param {Number} base - the side's space without the extra
 * @param {Number} extra
 * @returns {Number}
 */
export function withExtra(base, extra) {
	return Math.max(base + extra, Math.min(base, 0));
}
