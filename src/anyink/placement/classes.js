// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK placement: the vertical class of every letter (UX-BEGINNER B3, 4.4). Pure: no DOM,
	no editor. Font units, y-up, the writing line at 0.

	The five guide lines come from settings.font: top line (ascent), capitals line (capHeight),
	small-letter line (xHeight), writing line (0) and tail line (descent). The letter box is upm.

	Classes (each letter is in exactly one):
	- small    a c e m n o r s u v w x z   top = small-letter line, bottom = writing line
	- tall     b d f h k l                 top = top line
	- t                                    top halfway between the small-letter and top lines
	- i                                    dot top 60 % of the way up from the small-letter line
	                                       to the top line
	- tail     g j p q y                   body top = small-letter line, tail bottom = 90 % of the
	                                       tail line; j's dot as i's
	- capital  A to Z                      top = capitals line. Q and J may hang a tail.
	- figure   0 to 9                      top = capitals line (the spec names no line for
	                                       numbers; lining numbers are as tall as capitals)
	- period   .                           12 % of the small-letter height, on the writing line
	- comma    ,                           a period with a tail reaching 40 % toward the tail line
	- apostrophe ' " `                     hangs from the capitals line, 25 % of its height
	- mark     ? !                         capitals line to writing line
	- hyphen   -                           centered on half the small-letter height; as wide as
	                                       half the small-letter height (only used to size a
	                                       photo that holds nothing else)
	- colon    :                           small-letter line to writing line
	- semicolon ;                          a colon with the comma's tail
	- bracket  ( ) [ ] { }                 top line to half the tail line, seated by its middle
	- symbol   anything else               capitals line to writing line. An accented letter
	                                       follows its case (É is a capital, é is small).
	Round letters (o c e s O C G Q S) get +1.5 % of the letter box above and below.

	Seat: how a letter alone in its row is put on the lines. 'bottom' = its body bottom on the
	class bottom (the writing line, or 1.5 % under it when round); 'top' = its ink top on the
	class top (the apostrophe); 'center' = its middle on the class middle (hyphen, brackets).

	Tails: 'always' (g j p q y , ;), 'optional' (Q J f: [It has a tail] / [No tail], or a guess),
	'never'. A letter whose tail is on has a tailBottom target, except Q: a Q tail has no line of
	its own, so Q is sized and seated by its bowl.

	Scale: only the plain letters a to z and A to Z feed a photo's median (punctuation is never
	part of a median; numbers, symbols and accented letters are used only when nothing else
	is named from that photo).
*/

/** Round letters overshoot the lines by this share of the letter box, above and below. */
export const ROUND_OVERSHOOT = 0.015;

/** The new-font metrics (glyphr_studio_project.js), used for anything missing or broken. */
export const DEFAULT_LINES = Object.freeze({
	upm: 2048,
	ascent: 1550,
	capHeight: 1480,
	xHeight: 1100,
	descent: -440,
});

const CLASS_OF = new Map();
const put = (name, chars) => {
	for (const char of chars) CLASS_OF.set(char, name);
};
put('small', 'acemnorsuvwxz');
put('tall', 'bdfhkl');
put('t', 't');
put('i', 'i');
put('tail', 'gjpqy');
put('capital', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
put('figure', '0123456789');
put('period', '.');
put('comma', ',');
put('apostrophe', '\'"`');
put('mark', '?!');
put('hyphen', '-');
put('colon', ':');
put('semicolon', ';');
put('bracket', '()[]{}');

const ROUND = new Set('ocesOCGQS');
const TAIL_ALWAYS = new Set('gjpqy,;');
const TAIL_OPTIONAL = new Set('QJf');
const LETTER_CLASSES = new Set(['small', 'tall', 't', 'i', 'tail', 'capital']);
const PLAIN_LETTER = /^[A-Za-z]$/;

/**
 * @param {String} char - one character
 * @returns {String} the vertical class name (see the header); 'symbol' for anything unknown
 */
export function verticalClass(char) {
	if (typeof char !== 'string' || [...char].length !== 1) return 'symbol';
	const known = CLASS_OF.get(char);
	if (known) return known;
	// Accented and other cased letters follow their case
	const upper = char.toUpperCase();
	const lower = char.toLowerCase();
	if (upper !== lower) return char === upper ? 'capital' : 'small';
	return 'symbol';
}

/** @param {String} char @returns {Boolean} true for o c e s O C G Q S */
export function isRoundLetter(char) {
	return ROUND.has(char);
}

/**
 * @param {String} char
 * @returns {'always' | 'optional' | 'never'} whether the letter hangs a tail below the line
 */
export function tailKind(char) {
	if (TAIL_ALWAYS.has(char)) return 'always';
	if (TAIL_OPTIONAL.has(char)) return 'optional';
	return 'never';
}

/** @param {String} char @returns {Boolean} true for anything that is not a letter */
export function isPunctuation(char) {
	return !LETTER_CLASSES.has(verticalClass(char));
}

/** @param {String} char @returns {Boolean} true when the letter is part of a photo's median */
export function feedsScale(char) {
	return typeof char === 'string' && PLAIN_LETTER.test(char);
}

/**
 * The five guide lines and the letter box of a font, with the new-font values for anything
 * missing. The tail line is always below the writing line.
 * @param {Object} font - project.settings.font
 * @returns {{top: Number, capitals: Number, small: Number, writing: Number, tail: Number,
 *   box: Number, overshoot: Number}}
 */
export function guideLines(font) {
	const read = (key) => {
		const value = Number(font?.[key]);
		return Number.isFinite(value) ? value : DEFAULT_LINES[key];
	};
	const upm = read('upm');
	const box = upm > 0 ? upm : DEFAULT_LINES.upm;
	return {
		top: read('ascent'),
		capitals: read('capHeight'),
		small: read('xHeight'),
		writing: 0,
		tail: -Math.abs(read('descent')),
		box,
		overshoot: ROUND_OVERSHOOT * box,
	};
}

/**
 * Where a letter belongs on the lines.
 * @param {String} char
 * @param {Object} font - project.settings.font
 * @param {{tail?: Boolean}} [options] - tail: [It has a tail] (true) / [No tail] (false);
 *   left out, a letter that always has a tail has one and an optional one has none
 * @returns {{class: String, seat: 'bottom' | 'top' | 'center', top: Number | null,
 *   bottom: Number | null, center: Number | null, tailBottom: Number | null,
 *   width: Number | null, round: Boolean, tail: Boolean}} font units. top and bottom are the
 *   body's (bottom is where the body bottom sits); tailBottom is where a tail ends, null when
 *   the letter has no tail or its tail has no line; width only for the hyphen.
 */
export function lineTargets(char, font, { tail } = {}) {
	const lines = guideLines(font);
	const name = verticalClass(char);
	const kind = tailKind(char);
	const hasTail = kind === 'always' ? tail !== false : kind === 'optional' ? tail === true : false;
	const round = isRoundLetter(char);
	const iDot = lines.small + 0.6 * (lines.top - lines.small);
	const tailLine = 0.9 * lines.tail;

	let top = lines.capitals;
	let bottom = 0;
	let seat = 'bottom';
	let tailBottom = null;
	let width = null;
	switch (name) {
		case 'small':
		case 'colon':
			top = lines.small;
			break;
		case 'tall':
			top = lines.top;
			if (hasTail) tailBottom = tailLine;
			break;
		case 't':
			top = (lines.small + lines.top) / 2;
			break;
		case 'i':
			top = iDot;
			break;
		case 'tail':
			top = char === 'j' ? iDot : lines.small;
			if (hasTail) tailBottom = tailLine;
			break;
		case 'capital':
			// Q's tail has no line of its own: it is sized and seated by its bowl
			if (hasTail && char !== 'Q') tailBottom = tailLine;
			break;
		case 'period':
			top = 0.12 * lines.small;
			break;
		case 'comma':
			top = 0.12 * lines.small;
			if (hasTail) tailBottom = 0.4 * lines.tail;
			break;
		case 'semicolon':
			top = lines.small;
			if (hasTail) tailBottom = 0.4 * lines.tail;
			break;
		case 'apostrophe':
			bottom = 0.75 * lines.capitals;
			seat = 'top';
			break;
		case 'hyphen':
			top = null;
			bottom = null;
			seat = 'center';
			width = 0.5 * lines.small;
			break;
		case 'bracket':
			top = lines.top;
			bottom = 0.5 * lines.tail;
			seat = 'center';
			break;
		default:
			// figure, mark, symbol: capitals line to writing line
			break;
	}
	if (round && top !== null) {
		top += lines.overshoot;
		bottom -= lines.overshoot;
	}
	const center = name === 'hyphen' ? lines.small / 2 : (top + bottom) / 2;
	return { class: name, seat, top, bottom, center, tailBottom, width, round, tail: hasTail };
}
