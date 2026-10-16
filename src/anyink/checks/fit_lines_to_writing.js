// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11: "Move the line to fit your writing" (UX-BEGINNER.md 4.2, 4.8, 7.3, section 10 B11). When
	two or more of his letters on one line are more than 25 % bigger or smaller than it the same
	way, the line is wrong, not the letters: the line moves to the median of his letters on it,
	as one whole-font Undo step that also refits every automatic letter (B3's fitAllAutomatic:
	the gaps hang on the small-letter line). B15's guide-line drags record their step here too.

	Lines: 'top' (top line, ascent), 'capitals' (capHeight), 'small' (small-letter line,
	xHeight), 'tail' (descent); the font keys are taken too. The writing line never moves.

	  lineName(line)              'small' for 'small' or 'xHeight'; null for anything else
	  lineOfLetter(char)          the line a letter's size is judged by, as the checks judge it:
	                              small letters (the bodies of g j p q y, i and j without their
	                              dots) -> 'small'; b d f h k l -> 'top'; capitals and numbers
	                              -> 'capitals'; null for t (its top sits between two lines) and
	                              punctuation (never part of a median, D-034)
	  impliedLine(item, font)     { line, value, height }: value is where the line would sit if
	                              this letter were the size its line asks for: its body's height
	                              (checks.js measureLetter), round letters' overshoot taken off;
	                              height is the body's height itself, as the size check reads it;
	                              null when it says nothing
	  lineMedian(project, line, { include, editor })
	                              the median of impliedLine over the letters with ink on that
	                              line (include(item, { char, editor }) narrows them, e.g. to his
	                              ready letters), whole units; null with none
	  lineMoveWays(project, { include, editor })
	                              { small, capitals, top }: 'big' when the median of his letters
	                              on that line is more than 25 % (checks.js SIZE_SHARE) over the
	                              line, 'small' under it, else null (the line fits his letters,
	                              though a few may be off), and null too when the line can't go
	                              there (lineCanMoveTo). One pass over the letters, for the
	                              checks: offer [Move the line to fit your writing] only on a line
	                              that is off the way the letter is and can move to his writing,
	                              so right after a move the letters it flipped are offered [Match
	                              size], not a button that would only resize them
	  waysFromValues(values, font)    lineMoveWays from values gathered by line (checks/cache.js:
	                              its kept measures). Each value is a number (impliedLine's value)
	                              or { value, height, counted } (height: the body's, which the size
	                              check reads; counted false: left out of the median, as include()
	                              leaves it out, yet still a letter a pushed line must keep)
	  lineMoveWay(project, line, options)   the same for one line ('xHeight' etc. taken too)
	  extraFromMeasures(char, measures)   B10 + B11 finalize: ? and ! (capitals) and t ('between'),
	                              judged by a line but never in its median: { line, height,
	                              round, extra: true, counted: false } for lineCanMoveTo to keep;
	                              an entry with its height and round flag is judged as the size
	                              check judges it (a round letter against its line plus the
	                              overshoot)
	  lineCanMoveTo(values, font, line, value)
	                              true when the line can go to his writing (B11 fix pass): it
	                              lands on value, inside the letter box (writing taller than the
	                              letter box gets [Match size]), and every other line it pushes
	                              along keeps the letters that fit it now (pushing the capitals
	                              line past H and B made them need a look, and their own Move the
	                              line pulled it back down: the green buttons went round for
	                              ever). A plain number's height is not known (a round letter's
	                              overshoot was taken off), so it is judged both ways: a letter
	                              that may fit now must surely fit after
	  linePlan(font, line, value) the whole values the font keys take: the line at value, the
	                              lines above or below it pushed along when it passes them, so
	                              they keep their order (tail < 0 < small <= capitals <= top);
	                              {} when nothing moves. No line goes more than the letter box
	                              (upm) from the writing line, or further than it is already
	  moveLine(editor, line, value, options)
	                              one whole-font step about no letter: the lines move, every
	                              automatic letter is refit, 'fontMetrics' is published for each
	                              moved line. options: title (default "moved the <line>"), from
	                              (B15: the line was dragged there already; its value before the
	                              drag, so the step's before-copy holds it), needsALook (default
	                              fix_step.js useNeedsALook), showMe.
	                              -> { done, line, value, title, flipped }: flipped lists the
	                              letters that need a look now and didn't (Simple: a toast, 4.2)
	  fitLineToWriting(editor, lineOrItemId, options)
	                              the fix: moveLine to lineMedian, titled "moved the <line> to fit
	                              your writing"; a letter id picks its letter's line. Nothing
	                              moves (done false) when lineCanMoveTo says no, so a button the
	                              checks offered before a change resizes the letter instead
	                              (fixes.js applyFix)
*/
import { isSimpleMode } from '../mode/mode.js';
import { guideLines, isRoundLetter } from '../placement/classes.js';
import { fitAllAutomatic } from '../spacing/auto_space.js';
import { baseLetter } from '../spacing/letter_classes.js';
import { median } from '../spacing/measure.js';
import { whole } from '../spacing/round.js';
import { word } from '../words/words.js';
import { SIZE_SHARE, measureLetter } from './checks.js';
import { charOf } from './fix_shapes.js';
import { flippedSince, needsALookNow, sayFlipped } from './fix_step.js';

/** The font key each movable line is stored under */
export const LINE_KEYS = Object.freeze({
	top: 'ascent',
	capitals: 'capHeight',
	small: 'xHeight',
	tail: 'descent',
});
/** The words key naming each line */
const LINE_WORDS = Object.freeze({
	top: 'line.ascent',
	capitals: 'line.capHeight',
	small: 'line.xHeight',
	tail: 'line.descent',
});
/** Letters sized by the top line */
const TALL = 'bdfhkl';
/** The lines above the writing line, top down */
const ABOVE = Object.freeze(['top', 'capitals', 'small']);

/**
 * @param {String} line - 'small', 'capitals', 'top', 'tail', or a font key ('xHeight')
 * @returns {'top' | 'capitals' | 'small' | 'tail' | null}
 */
export function lineName(line) {
	if (Object.hasOwn(LINE_KEYS, line)) return line;
	const found = Object.keys(LINE_KEYS).find((name) => LINE_KEYS[name] === line);
	return found || null;
}

/**
 * The line a letter's size is judged by, as the checks judge it (checks.js measureLetter).
 * @param {String} char
 * @returns {'small' | 'top' | 'capitals' | null}
 */
export function lineOfLetter(char) {
	if (typeof char !== 'string' || [...char].length !== 1) return null;
	if (!/[\p{L}\p{Nd}]/u.test(char)) return null;
	const base = baseLetter(char);
	if (base === 't') return null;
	if (TALL.includes(base)) return 'top';
	if (/\p{Ll}/u.test(base)) return 'small';
	return 'capitals';
}

/**
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @returns {{line: String, value: Number, height: Number} | null}
 */
export function impliedLine(item, font) {
	const char = charOf(item);
	const measures = lineOfLetter(char) ? measureLetter(item, font) : null;
	return impliedFromMeasures(char, measures, font);
}

/**
 * B10 + B11 integration: impliedLine from measures already taken (checks/cache.js keeps them
 * per letter, so its pass reads the lines without measuring a letter twice).
 * @param {String} char
 * @param {Object | null} measures - checks.js measureLetter (the body is the same in any slant)
 * @param {Object} font - settings.font
 * @returns {{line: String, value: Number, height: Number} | null}
 */
export function impliedFromMeasures(char, measures, font) {
	const line = lineOfLetter(char);
	if (!line || !measures?.body) return null;
	// The body leaves out the dots of i and j, accents and specks; a tail's stops at the line
	const height = measures.body.top - measures.body.bottom;
	const round = isRoundLetter(char);
	const overshoot = round ? 2 * guideLines(font).overshoot : 0;
	const value = height - overshoot;
	return value > 0 ? { line, value, height, round } : null;
}

/**
 * B10 + B11 finalize: the letters the size check judges by a line that are never part of its
 * median (D-034): ? and ! by the capitals line, t by the height halfway between the small-letter
 * and top lines ('between'). A pushed line must keep them too (the hostile pass's C2: a and n
 * written big pushed the capitals line past a Ready ? and !).
 * @param {String} char
 * @param {Object | null} measures - checks.js measureLetter
 * @returns {{line: String, height: Number, round: Boolean, counted: false, extra: true} | null}
 */
export function extraFromMeasures(char, measures) {
	if (!measures?.body) return null;
	const base = typeof char === 'string' ? baseLetter(char) : '';
	const line = char === '?' || char === '!' ? 'capitals' : base === 't' ? 'between' : null;
	if (!line) return null;
	const height = measures.body.top - measures.body.bottom;
	return height > 0 ? { line, height, round: false, counted: false, extra: true } : null;
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @param {String} line
 * @param {{include?: Function, editor?: Object}} [options]
 * @returns {Number | null} whole font units
 */
export function lineMedian(project, line, { include = null, editor = null } = {}) {
	const name = lineName(line);
	if (!name || !project?.settings?.font) return null;
	return medianOf(countedValues(impliedEntries(project, { include, editor })[name]));
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @param {{include?: Function, editor?: Object}} [options] - as lineMedian
 * @returns {{small: String | null, capitals: String | null, top: String | null}} each 'big',
 *   'small' or null
 */
export function lineMoveWays(project, { include = null, editor = null } = {}) {
	const font = project?.settings?.font;
	if (!font) return { small: null, capitals: null, top: null };
	return waysFromValues(impliedEntries(project, { include, editor }), font);
}

/**
 * lineMoveWays from impliedLine values already gathered by line.
 * @param {{small?: Array<Number | Object>, capitals?: Array<Number | Object>,
 *   top?: Array<Number | Object>}} values - numbers, or { value, height, counted }
 * @param {Object} font - settings.font
 * @returns {{small: String | null, capitals: String | null, top: String | null}}
 */
export function waysFromValues(values, font) {
	const ways = { small: null, capitals: null, top: null };
	const lines = guideLines(font);
	Object.keys(ways).forEach((name) => {
		const middle = medianOf(countedValues(values?.[name]));
		const now = lines[name];
		if (middle === null || !(now > 0)) return;
		let way = null;
		if (middle > now * (1 + SIZE_SHARE)) way = 'big';
		else if (middle < now * (1 - SIZE_SHARE)) way = 'small';
		if (way && lineCanMoveTo(values, font, name, middle)) ways[name] = way;
	});
	return ways;
}

/**
 * @param {Object} values - by line, as waysFromValues takes them
 * @param {Object} font - settings.font
 * @param {String} line
 * @param {Number} value - where the line would go (font units)
 * @returns {Boolean} true when the line lands on value and no line it pushes along leaves a
 *   letter that fits it now
 */
export function lineCanMoveTo(values, font, line, value) {
	const name = lineName(line);
	if (!name || !font || !Number.isFinite(Number(value))) return false;
	const now = currentLines(font);
	const plan = linePlan(font, name, value);
	const after = { ...now };
	Object.keys(LINE_KEYS).forEach((key) => {
		if (Object.hasOwn(plan, LINE_KEYS[key])) after[key] = plan[LINE_KEYS[key]];
	});
	// Clamped at the letter box: the line can't go where his writing is
	if (after[name] !== whole(value)) return false;
	// t's line, halfway between the small-letter and top lines, moves with either
	now.between = (now.small + now.top) / 2;
	after.between = (after.small + after.top) / 2;
	const slack = 2 * guideLines(font).overshoot;
	// Every letter judged by a line that changes keeps fitting it: the letters of the lines it
	// pushes along, and on the moved line itself the ones no median counts (? ! t)
	return [...ABOVE, 'between']
		.filter((other) => after[other] !== now[other])
		.every((other) =>
			(values?.[other] || [])
				.filter((entry) => other !== name || entry?.extra === true)
				.every(
					(entry) =>
						!fits(entry, now[other], slack, 'maybe') || fits(entry, after[other], slack, 'sure')
				)
		);
}

/**
 * @param {Object} project
 * @param {String} line - 'small', 'capitals', 'top' or their font keys
 * @param {{include?: Function, editor?: Object}} [options]
 * @returns {'big' | 'small' | null}
 */
export function lineMoveWay(project, line, options = {}) {
	const name = lineName(line);
	if (!name || name === 'tail') return null;
	return lineMoveWays(project, options)[name];
}

/**
 * @param {Object} font - settings.font
 * @param {String} line
 * @param {Number} value - font units
 * @returns {Object<String, Number>} font key -> whole value, only the keys that change
 */
export function linePlan(font, line, value) {
	const name = lineName(line);
	const wanted = whole(value);
	if (!name || !Number.isFinite(Number(value))) return {};
	const now = currentLines(font);
	const next = { ...now };
	// No line goes past the letter box, or further past it than it is already
	const box = guideLines(font).box;
	if (name === 'tail') {
		next.tail = Math.min(Math.max(wanted, Math.min(-box, now.tail)), -1);
	} else {
		next[name] = Math.min(Math.max(wanted, 1), Math.max(box, now.top));
		const at = ABOVE.indexOf(name);
		// Lines above it never sit under it; lines below it never sit over it
		ABOVE.slice(0, at).forEach((above) => (next[above] = Math.max(next[above], next[name])));
		ABOVE.slice(at + 1).forEach((below) => (next[below] = Math.min(next[below], next[name])));
	}
	const plan = {};
	Object.keys(LINE_KEYS).forEach((key) => {
		if (next[key] !== now[key]) plan[LINE_KEYS[key]] = next[key];
	});
	return plan;
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {String} line
 * @param {Number} value - font units (rounded to whole)
 * @param {{title?: String, from?: Number | Object, needsALook?: Function | null,
 *   showMe?: Function}} [options]
 * @returns {{done: Boolean, line: String | null, value: Number | null, title: String,
 *   flipped: Array<String>}}
 */
export function moveLine(editor, line, value, options = {}) {
	const name = lineName(line);
	const title =
		options.title || (name ? word('fixes.step.movedLine', { line: lineWord(name) }) : '');
	const result = { done: false, line: name, value: null, title, flipped: [] };
	const history = editor?.history;
	const font = editor?.project?.settings?.font;
	if (!name || !font || typeof history?.addWholeProjectChangePreState !== 'function') return result;
	if (options.from !== undefined) putBack(font, name, options.from);
	const plan = linePlan(font, name, value);
	if (!Object.keys(plan).length) return result;

	const needsALook = options.needsALook;
	const before = needsALookNow(editor, needsALook);
	history.addWholeProjectChangePreState(title, { itemID: null });
	writePlan(editor, font, plan);
	// Simple: the spacing hook refits them as the step closes, keeping the open letter's ink
	// still on screen; All tools' hook never refits, so it happens here
	if (!isSimpleMode()) fitAllAutomatic(editor.project);
	history.addWholeProjectChangePostState();
	const open = editor.project.getItem?.(editor.selectedItemID);
	if (open) editor.publish?.('currentItem', open);

	result.done = true;
	result.value = whole(font[LINE_KEYS[name]]);
	result.flipped = flippedSince(before, editor, { needsALook });
	sayFlipped(editor, result.flipped, { by: 'line', showMe: options.showMe });
	return result;
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {String} lineOrItemId - a line, or a letter id ('glyph-0x61': its letter's line)
 * @param {{include?: Function, needsALook?: Function | null, showMe?: Function}} [options]
 * @returns {{done: Boolean, line: String | null, value: Number | null, title: String,
 *   flipped: Array<String>}}
 */
export function fitLineToWriting(editor, lineOrItemId, options = {}) {
	const project = editor?.project;
	const item = project?.getItem?.(lineOrItemId) || project?.glyphs?.[lineOrItemId] || null;
	const name = item ? lineOfLetter(charOf(item)) : lineName(lineOrItemId);
	const none = { done: false, line: name, value: null, title: '', flipped: [] };
	if (!name || !project?.settings?.font) return none;
	const entries = impliedEntries(project, { include: options.include, editor });
	const value = medianOf(countedValues(entries[name]));
	if (value === null || !lineCanMoveTo(entries, project.settings.font, name, value)) return none;
	const title = word('fixes.step.moveLine', { line: lineWord(name) });
	return moveLine(editor, name, value, { ...options, title });
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

/**
 * Every letter's impliedLine, by line, in one pass, with the body height the size check reads
 * and whether include() counts it in the median.
 * @returns {{small: Array<Object>, capitals: Array<Object>, top: Array<Object>}} each
 *   { value, height, counted }
 */
function impliedEntries(project, { include, editor }) {
	const font = project.settings.font;
	const entries = { small: [], capitals: [], top: [], between: [] };
	Object.values(project.glyphs || {}).forEach((item) => {
		const char = charOf(item);
		const judged = lineOfLetter(char) || char === '?' || char === '!' || baseLetter(char) === 't';
		const measures = judged ? measureLetter(item, font) : null;
		const extra = extraFromMeasures(char, measures);
		if (extra) {
			entries[extra.line].push(extra);
			return;
		}
		const implied = impliedFromMeasures(char, measures, font);
		if (!implied) return;
		const counted = typeof include !== 'function' || !!include(item, { char: item.chars, editor });
		entries[implied.line].push({ ...implied, counted });
	});
	return entries;
}

/** @returns {Array<Number>} the values a median counts: numbers, and entries not left out */
function countedValues(list) {
	return (list || [])
		.filter((entry) => typeof entry === 'number' || entry?.counted !== false)
		.map((entry) => (typeof entry === 'number' ? entry : entry?.value));
}

/**
 * Whether a letter fits a line as the size check judges it (checks.js: its body within 25 %
 * of the line). An entry's height is exact; a plain number's isn't known (a round letter's
 * overshoot was taken off it), so 'maybe' is true when it fits either way, 'sure' when both.
 * @param {Number | {value: Number, height?: Number}} entry
 * @param {Number} line - the line's height
 * @param {Number} slack - a round letter's overshoot, above and below
 * @param {'maybe' | 'sure'} how
 * @returns {Boolean}
 */
function fits(entry, line, slack, how) {
	if (!(line > 0)) return false;
	const height = Number(typeof entry === 'number' ? NaN : entry?.height);
	if (Number.isFinite(height) && typeof entry?.round === 'boolean') {
		// the size check's own line: a round letter's has its overshoot over and under it
		const target = line + (entry.round ? slack : 0);
		return height >= (1 - SIZE_SHARE) * target && height <= (1 + SIZE_SHARE) * target;
	}
	const low = (1 - SIZE_SHARE) * line;
	const high = (1 + SIZE_SHARE) * line;
	if (Number.isFinite(height)) return height >= low && height <= high;
	const value = Number(typeof entry === 'number' ? entry : entry?.value);
	if (!Number.isFinite(value)) return false;
	if (how === 'maybe') return value + slack >= low && value <= high;
	return value >= low && value + slack <= high;
}

/** @returns {{top: Number, capitals: Number, small: Number, tail: Number}} whole font units */
function currentLines(font) {
	const now = {};
	Object.entries(LINE_KEYS).forEach(([key, fontKey]) => {
		now[key] = whole(font?.[fontKey]);
	});
	return now;
}

/** @returns {Number | null} whole font units */
function medianOf(values) {
	const middle = median(values);
	return middle === null ? null : whole(middle);
}

/** @returns {String} 'small-letter line' */
function lineWord(name) {
	return word(LINE_WORDS[name]);
}

/** Writes the plan, a line at a time in an order that keeps them in order, and says so. */
function writePlan(editor, font, plan) {
	const keys = Object.keys(plan);
	const up = keys.some((key) => plan[key] > whole(font[key]));
	const order = ['ascent', 'capHeight', 'xHeight', 'descent'];
	(up ? order : [...order].reverse()).forEach((key) => {
		if (!Object.hasOwn(plan, key)) return;
		font[key] = plan[key];
		editor.publish?.('fontMetrics', { key, value: plan[key], font });
	});
}

/**
 * B15: the line was dragged to its new place already; the step's before-copy needs it where it
 * was. from: the line's value before the drag, or { fontKey: value } for every line it moved.
 */
function putBack(font, name, from) {
	if (from && typeof from === 'object') {
		Object.entries(from).forEach(([key, value]) => {
			if (Object.values(LINE_KEYS).includes(key) && Number.isFinite(Number(value))) {
				font[key] = whole(value);
			}
		});
		return;
	}
	if (Number.isFinite(Number(from))) font[LINE_KEYS[name]] = whole(from);
}
