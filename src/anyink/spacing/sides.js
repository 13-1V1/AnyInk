// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 fix: where a letter's sides are, for spacing (UX-BEGINNER 10, B3; 7.2). Pure and read-only:
	the shapes always stay exactly as written.

	A side is measured on the letter's body, with the slant taken out.
	  The body: the pieces of ink whose bottom is below 60% of the letter's own line height (the
	    small-letter line for small letters, the top line for tall ones, halfway for t, the
	    capitals line for capitals, numbers and other symbols), and every other piece that comes
	    down lower than the top of those (a crossbar drawn as its own stroke), unless it is small
	    (no wider and no taller than MARK_SIZE of the small-letter height: an i dot written low,
	    dipping just under the stem's top). A mark sitting above the body is not a side: an i or
	    j dot wherever it drifted, an accent, the ring of Å. Ink below the writing line is
	    not a side either: the tail of g j p q y, of Q and J, a tail that hooks left.
	  How far marks and tails may hang (B3 finalize: unbounded, they ran into the neighbors'
	    tails and ascenders, gj jj yj gg overlapping): into the space the gap rule gives that
	    side, but never closer than HANG_CLEAR x G to the end of it, the letter's own width. Ink
	    further out moves the side out just enough. So an automatic letter's ink never leaves
	    its width, and two hangs that meet at the same height keep at least 0.2 G apart (every
	    side gets at least 0.4 G). The space is the one with the letter-spacing extra in it, so
	    at the slider's far left end hangs touch at most, never overlap.
	  Punctuation, a letter with no line height, and a letter the rules leave nothing of (drawn
	    far off its lines) are measured on all of their ink.
	  The slant: a slanted hand is measured as if it stood upright. Every point is moved left by
	    tan(slant) x its height above the turning height, half the small-letter height, so the
	    small letters' middles stay where they are. Two neighbors measured that way sit the same
	    distance apart at every height as the same two letters written upright. (auto_space.js
	    picks the slant: the font's, or the letter's own lean when it leans its own way.)
	Upright, with no mark and no ink below the writing line, the sides are exactly the ink box's
	(curve extremes): a font written upright and inside its lines is spaced as before.

	  bodyBand(chars, font)          { low: 0, high: the line height } | null (punctuation, or no
	                                 line height)
	  referenceHeight(font)          the turning height
	  slope(degrees)                 tan of the slant (0 for anything that isn't a number)
	  sideBounds(item, font, slant, space, frameSlant)
	                                 { xMin, xMax } | null with no ink: the body's left and right
	                                 ends, slant taken out, font units. space: { left, right },
	                                 the space beside each side; left out, marks and tails hang
	                                 without a limit (the body alone, for measuring side kinds).
	                                 frameSlant: the font's slant; the hang limit holds for all of
	                                 the ink in that frame, which every letter shares, so a letter
	                                 measured by its own lean still never meets its neighbor
*/
import { gapUnit } from './gap_rule.js';
import { isPunctuation, lineHeightOf } from './letter_classes.js';
import { inkBox, inkPieces, itemContours } from './outline.js';

/** A piece whose bottom is below this share of the line height holds the body. */
export const BODY_SHARE = 0.6;
/** A mark or tail stops this many G short of the end of the space beside its letter. */
export const HANG_CLEAR = 0.1;
/** A piece this share of the small-letter height or smaller, both ways, is a mark (a dot). */
export const MARK_SIZE = 0.25;

/**
 * @param {*} degrees - the slant, positive leaning right
 * @returns {Number} how far right the ink moves per unit up
 */
export function slope(degrees) {
	const angle = Number(degrees);
	if (!Number.isFinite(angle) || angle === 0) return 0;
	return Math.tan((angle * Math.PI) / 180);
}

/**
 * @param {Object} font - settings.font
 * @returns {Number} half the small-letter height (half of half the letter box with none)
 */
export function referenceHeight(font) {
	const xHeight = Number(font?.xHeight);
	if (xHeight > 0) return xHeight / 2;
	const upm = Number(font?.upm) > 0 ? Number(font.upm) : 1000;
	return upm / 4;
}

/**
 * The band a letter's body fills: the writing line up to its own line (the tallest of a joined
 * letter's).
 * @param {String} chars - the letter's characters
 * @param {Object} font - settings.font
 * @returns {{low: Number, high: Number} | null} null for punctuation or no usable line
 */
export function bodyBand(chars, font) {
	const letters = [...(typeof chars === 'string' ? chars : '')].filter(
		(char) => !isPunctuation(char)
	);
	if (!letters.length) return null;
	const high = Math.max(...letters.map((char) => Number(lineHeightOf(char, font)) || 0));
	return high > 0 ? { low: 0, high } : null;
}

/**
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @param {Number} [slant] - degrees, positive leaning right: what the body is measured with
 * @param {{left: Number, right: Number}} [space] - the space beside each side, font units:
 *   marks and tails may hang into it, up to HANG_CLEAR x G short of its end. Left out: no limit
 * @param {Number} [frameSlant] - degrees: the slant every letter of the font shares (the
 *   font's), in which no ink may come closer than that to the letter's width, so two letters
 *   that each lean their own way still never meet; slant when left out
 * @returns {{xMin: Number, xMax: Number} | null} null with no ink
 */
export function sideBounds(item, font, slant = 0, space, frameSlant = slant) {
	const box = inkBox(item);
	if (!box) return null;
	const exact = { xMin: box.xMin, xMax: box.xMax };
	const k = slope(slant);
	const band = bodyBand(item?.chars, font);
	const contours = itemContours(item);
	const body = band ? bodyContours(contours, band, font) : null;
	const turn = referenceHeight(font);
	/** Every piece of ink, measured with a slant taken out */
	const allWith = (kk) => (kk ? extremes(contours, kk, turn, -Infinity) || exact : exact);
	let measured;
	if (!k && (!body || (!body.trimmed && box.yMin >= band.low))) measured = exact;
	else measured = (body && extremes(body.contours, k, turn, band.low)) || allWith(k);
	return space ? hangInside(measured, allWith(slope(frameSlant)), space, font) : measured;
}

/**
 * The body's sides, moved out where a mark or tail would hang too far.
 * @param {{xMin: Number, xMax: Number}} body
 * @param {{xMin: Number, xMax: Number}} all - every piece of ink, measured in the font's frame
 * @param {{left: Number, right: Number}} space
 * @param {Object} font
 * @returns {{xMin: Number, xMax: Number}}
 */
function hangInside(body, all, space, font) {
	const clear = HANG_CLEAR * gapUnit(font);
	const reach = (side) => {
		const room = Number(space?.[side]);
		return Number.isFinite(room) ? Math.max(0, room - clear) : 0;
	};
	return {
		xMin: Math.min(body.xMin, all.xMin + reach('left')),
		xMax: Math.max(body.xMax, all.xMax - reach('right')),
	};
}

/**
 * The outlines of the body's pieces (marks above it left out).
 * @param {Array<Object>} contours - itemContours
 * @param {{low: Number, high: Number}} band
 * @param {Object} font - settings.font
 * @returns {{contours: Array<Object>, trimmed: Boolean} | null} null when no piece reaches the
 *   body (a letter drawn far off its lines: all of it counts)
 */
function bodyContours(contours, band, font) {
	const pieces = inkPieces(contours);
	const reach = band.low + BODY_SHARE * (band.high - band.low);
	const main = pieces.filter((piece) => piece.yMin < reach);
	if (!main.length) return null;
	const top = Math.max(...main.map((piece) => piece.yMax));
	const small = MARK_SIZE * smallLetterHeight(font);
	const isMark = (piece) =>
		piece.yMin >= top || (piece.xMax - piece.xMin <= small && piece.yMax - piece.yMin <= small);
	const kept = pieces.filter((piece) => main.includes(piece) || !isMark(piece));
	return {
		contours: kept.flatMap((piece) => piece.contours),
		trimmed: kept.length < pieces.length,
	};
}

/** @returns {Number} the small-letter height (half the letter box with none) */
function smallLetterHeight(font) {
	const xHeight = Number(font?.xHeight);
	if (xHeight > 0) return xHeight;
	return (Number(font?.upm) > 0 ? Number(font.upm) : 1000) / 2;
}

/**
 * The left and right ends of some outlines at or above a line, slant taken out.
 * Where an outline crosses the line, the crossing counts.
 * @param {Array<Object>} contours
 * @param {Number} k - slope
 * @param {Number} turn - the height that stays put
 * @param {Number} low - ink below this doesn't count
 * @returns {{xMin: Number, xMax: Number} | null} null when no ink is left
 */
function extremes(contours, k, turn, low) {
	let xMin = Infinity;
	let xMax = -Infinity;
	const take = (x, y) => {
		const upright = x - k * (y - turn);
		if (upright < xMin) xMin = upright;
		if (upright > xMax) xMax = upright;
	};
	contours.forEach(({ points }) => {
		points.forEach(([x1, y1], index) => {
			const [x2, y2] = points[(index + 1) % points.length];
			if (y1 >= low) take(x1, y1);
			if ((y1 - low) * (y2 - low) < 0) take(x1 + ((low - y1) * (x2 - x1)) / (y2 - y1), low);
		});
	});
	return xMin <= xMax ? { xMin, xMax } : null;
}
