// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 spacing: what kind of side each letter has, and how wide a letter may be (UX-BEGINNER 10,
	B3). Pure: no project writes, no editor.

	Each side of a letter is one of three kinds:
	  S  straight  a stem runs up the side (H, n)
	  R  round     a bowl curves out to the side (o, the left of a)
	  O  open      the side slants or is open (A, v, the right of r)
	The table below covers every capital and small letter and the commonest punctuation.
	An accented letter uses its base letter (é is like e). Anything else is measured from its
	ink (measure.js measuredSides).

	Width limits (B11's "Width outside the limits for its type"): naturally narrow letters
	(i j l I 1 ! . , ' : ; - |) have no lower limit (B10 + B11 finalize: a Capital I or a 1
	written as one stroke is as narrow as an l, and was always "too narrow"); any other letter is too narrow under 25% of its
	own line height; every letter is too wide over 150% of the letter box.
*/

/** The three side kinds. */
export const SIDE = Object.freeze({ straight: 'S', round: 'R', open: 'O' });

/** Rows of the side table: left kind, right kind, letters. */
const SIDE_ROWS = [
	['S', 'S', 'HIMNUhilmnu!'],
	['S', 'R', 'BDPbp'],
	['S', 'O', 'EFKLRkrtf'],
	['R', 'R', 'OQSos.,?'],
	['R', 'S', 'adgqG'],
	['R', 'O', 'Cce'],
	['O', 'S', 'Jj'],
	['O', 'O', "ATVWXYZvwxyz'-"],
];

const SIDE_TABLE = new Map();
SIDE_ROWS.forEach(([left, right, chars]) => {
	[...chars].forEach((char) => SIDE_TABLE.set(char, Object.freeze({ left, right })));
});

/** Letters that are naturally narrow: no lower width limit. */
export const NARROW_LETTERS = "ijlI1!.,':;-|";

/** Lower width limit: this share of the letter's own line height. */
export const MIN_WIDTH_SHARE = 0.25;
/** Upper width limit: this share of the letter box. */
export const MAX_WIDTH_SHARE = 1.5;

const SMALL = 'acemnorsuvwxzgjpqyi';
const TALL = 'bdfhkl';

/**
 * The letter an accented letter is built on: é -> e, Ö -> O. Anything that does not break
 * down that way is returned as it is.
 * @param {String} char - one character
 * @returns {String}
 */
export function baseLetter(char) {
	if (typeof char !== 'string' || !char) return '';
	const first = [...char.normalize('NFD')][0] || char;
	return /\p{L}/u.test(first) ? first : char;
}

/**
 * The table's sides for one character, through its base letter.
 * @param {String} char - one character
 * @returns {{left: String, right: String} | null} null when the table has no entry
 */
export function tableSides(char) {
	if (!isOneChar(char)) return null;
	const found = SIDE_TABLE.get(char) || SIDE_TABLE.get(baseLetter(char));
	return found ? { left: found.left, right: found.right } : null;
}

/**
 * @param {String} char
 * @returns {Boolean} true for one punctuation mark (. , ' ? ! - : ; quotes, brackets ...)
 */
export function isPunctuation(char) {
	return isOneChar(char) && /\p{P}/u.test(char);
}

/**
 * @param {String} char
 * @returns {Boolean} true for letters with no lower width limit
 */
export function isNaturallyNarrow(char) {
	if (!isOneChar(char)) return false;
	return NARROW_LETTERS.includes(char) || NARROW_LETTERS.includes(baseLetter(char));
}

/**
 * The height of the band a letter's body fills, from the writing line up: the small-letter
 * line for small letters (tails too: their body), the top line for tall ones, halfway for t,
 * the capitals line for capitals, numbers and anything else.
 * @param {String} char - one character
 * @param {Object} font - settings.font
 * @returns {Number} font units
 */
export function lineHeightOf(char, font) {
	const xHeight = Number(font?.xHeight) || 0;
	const ascent = Number(font?.ascent) || 0;
	const capHeight = Number(font?.capHeight) || 0;
	const base = baseLetter(char);
	if (base === 't') return (xHeight + ascent) / 2;
	if (TALL.includes(base)) return ascent;
	if (SMALL.includes(base)) return xHeight;
	if (/\p{Ll}/u.test(base)) return xHeight;
	return capHeight;
}

/**
 * Width limits for a letter (a ligature uses its first letter's line).
 * @param {String} chars - the letter's characters
 * @param {Object} font - settings.font
 * @returns {{min: Number | null, max: Number}} whole font units; min is null for narrow letters
 */
export function widthLimits(chars, font) {
	const list = [...(typeof chars === 'string' ? chars : '')];
	const upm = Number(font?.upm) || 0;
	const max = Math.round(upm * MAX_WIDTH_SHARE);
	const narrow = list.length > 0 && list.every(isNaturallyNarrow);
	if (!list.length || narrow) return { min: null, max };
	return { min: Math.round(lineHeightOf(list[0], font) * MIN_WIDTH_SHARE), max };
}

/**
 * Whether a letter's width is outside its limits. A letter with no ink has no width to judge.
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @returns {'narrow' | 'wide' | null}
 */
export function widthProblem(item, font) {
	if (!hasShapes(item)) return null;
	const width = Math.round(Number(item.advanceWidth) || 0);
	const { min, max } = widthLimits(item.chars, font);
	if (min !== null && width < min) return 'narrow';
	if (width > max) return 'wide';
	return null;
}

/** @returns {Boolean} true for a string of exactly one character (one code point) */
function isOneChar(char) {
	return typeof char === 'string' && [...char].length === 1;
}

/** @returns {Boolean} true when the item has a shape with something in it */
function hasShapes(item) {
	return (item?.shapes || []).some(
		(shape) => shape?.objType === 'ComponentInstance' || shape?.pathPoints?.length > 0
	);
}
