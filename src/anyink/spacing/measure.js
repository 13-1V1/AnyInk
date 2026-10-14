// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 spacing: measuring a letter's ink (UX-BEGINNER 10, B3). Pure and read-only.

	  inkBounds(item)            the box around the ink (exact curve extremes); stray lines,
	                             empty shapes and components of letters with no ink don't
	                             count (outline.js inkBox). null with no ink
	  strokeEstimate(item)       how thick the pen line is: 2 x area / perimeter of the largest
	                             piece (a piece is one outline with the holes inside it, so a
	                             ring gives exactly its thickness). null with no ink
	  rowExtent(contours, y)     leftmost and rightmost ink on one row
	  inkPieces(contours)        outline.js's pieces of ink, passed on for this module's callers
	  measuredSides(item, font, slant)
	                             the side kinds for a letter the table doesn't know: a side
	                             whose ink runs within 4% of the letter box of the body's edge
	                             along at least 70% of the small-letter height is straight,
	                             30 to 70% round, less open. The edge is the body's
	                             (sides.js: a drifted dot or a tail is not a side), and a
	                             slanted hand is measured with its slant taken out
	  measuredShares(item, font, slant)
	                             those shares themselves (the test page shows them)
	  median(values), medianOver(items, valueOf)
	                             punctuation is never part of a median (B9's one scale per
	                             photo, B11's stroke note)
	Holes follow the fill rule the canvas and the font file use (nonzero): an outline is a hole
	only when it cancels the ink around it, so two brush strokes drawn across each other are
	both ink, never one cut out of the other.
*/
import { isPunctuation } from './letter_classes.js';
import { inkBox, inkPieces, itemContours } from './outline.js';
import { referenceHeight, sideBounds, slope } from './sides.js';

export { inkPieces };

/** A side runs along the edge where its ink is within this share of the letter box. */
export const EDGE_SHARE = 0.04;
/** At least this share of the small-letter height along the edge: a straight side. */
export const STRAIGHT_SHARE = 0.7;
/** At least this share (and less than STRAIGHT_SHARE): a round side. Less: open. */
export const ROUND_SHARE = 0.3;
/** Rows measured across the small-letter height. */
export const ROWS = 64;

/**
 * @param {Object} item - Glyph
 * @returns {{xMin: Number, xMax: Number, yMin: Number, yMax: Number} | null}
 */
export function inkBounds(item) {
	return item ? inkBox(item) : null;
}

/**
 * @param {Object} item - Glyph
 * @returns {Number | null} font units
 */
export function strokeEstimate(item) {
	const pieces = inkPieces(itemContours(item));
	if (!pieces.length) return null;
	const largest = pieces.reduce((best, piece) => (piece.area > best.area ? piece : best));
	if (!(largest.area > 0) || !(largest.perimeter > 0)) return null;
	return (2 * largest.area) / largest.perimeter;
}

/**
 * @param {Array<Object>} contours - from itemContours
 * @param {Number} y - the row, font units
 * @returns {{left: Number, right: Number} | null} null when the row has no ink
 */
export function rowExtent(contours, y) {
	let left = Infinity;
	let right = -Infinity;
	contours.forEach(({ points }) => {
		for (let i = 0; i < points.length; i++) {
			const [x1, y1] = points[i];
			const [x2, y2] = points[(i + 1) % points.length];
			if (y1 > y === y2 > y) continue;
			const x = x1 + ((y - y1) * (x2 - x1)) / (y2 - y1);
			left = Math.min(left, x);
			right = Math.max(right, x);
		}
	});
	return left <= right ? { left, right } : null;
}

/**
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @param {Number} [slant] - the font's slant, degrees (slant.js); 0 measures it upright
 * @returns {{left: String, right: String} | null} side kinds ('S', 'R', 'O'); null with no ink
 */
export function measuredSides(item, font, slant = 0) {
	const shares = measuredShares(item, font, slant);
	if (!shares) return null;
	return { left: sideKind(shares.left), right: sideKind(shares.right) };
}

/**
 * How much of the small-letter height each side's ink runs along the body's edge.
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @param {Number} [slant] - the font's slant, degrees; each row is measured with it taken out
 * @returns {{left: Number, right: Number} | null} shares, 0 to 1; null with no ink
 */
export function measuredShares(item, font, slant = 0) {
	const contours = itemContours(item);
	const edges = sideBounds(item, font, slant);
	if (!contours.length || !edges) return null;
	const upm = Number(font?.upm) > 0 ? Number(font.upm) : 1000;
	const band = Number(font?.xHeight) > 0 ? Number(font.xHeight) : upm / 2;
	const near = upm * EDGE_SHARE;
	const k = slope(slant);
	const turn = referenceHeight(font);
	let left = 0;
	let right = 0;
	for (let row = 0; row < ROWS; row++) {
		const y = (band * (row + 0.5)) / ROWS;
		const extent = rowExtent(contours, y);
		if (!extent) continue;
		const shift = k * (y - turn);
		if (extent.left - shift - edges.xMin <= near) left++;
		if (edges.xMax - (extent.right - shift) <= near) right++;
	}
	return { left: left / ROWS, right: right / ROWS };
}

/**
 * @param {Number} share - of the small-letter height, 0 to 1
 * @returns {'S' | 'R' | 'O'}
 */
export function sideKind(share) {
	if (share >= STRAIGHT_SHARE) return 'S';
	if (share >= ROUND_SHARE) return 'R';
	return 'O';
}

/**
 * @param {Array<Number>} values
 * @returns {Number | null} the middle value (the mean of the middle two); non-numbers skipped
 */
export function median(values) {
	const list = (values || []).filter(Number.isFinite).sort((a, b) => a - b);
	if (!list.length) return null;
	const mid = Math.floor(list.length / 2);
	return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

/**
 * The median of one value per letter, punctuation left out.
 * @param {Array<Object>} items - Glyphs
 * @param {Function} valueOf - (item) => Number | null
 * @returns {Number | null}
 */
export function medianOver(items, valueOf) {
	return median(
		(items || []).filter((item) => item && !isPunctuationItem(item)).map((item) => valueOf(item))
	);
}

/**
 * @param {Object} item - Glyph
 * @returns {Boolean} true when every character of the letter is punctuation
 */
export function isPunctuationItem(item) {
	const chars = [...(typeof item?.chars === 'string' ? item.chars : '')];
	return chars.length > 0 && chars.every(isPunctuation);
}
