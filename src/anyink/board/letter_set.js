// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	The board's letter set (UX-BEGINNER.md 4.2 "Letter set" and "Ready"), in one place. B6 + B7
	integration: the rail's ready count (topbar/ready_count.js), the Next line's letter order
	(coach/letter_order.js) and the letter header's ‹ A / C › (letter/letter_header.js) each had
	their own copy; they read this one now. B10 owns this file (section 10 B10 letter_set.js) and
	adds "+ Numbers & symbols" as a settings Undo step here. Pure.

	The Quick font: A to Z, a to z and . , ' ? ! - (58 letters). With "+ Numbers & symbols"
	(settings.anyink.letterSet 'quick+numbers') 0 to 9 and : ; " ( ) & @ # $ % / * join it (80).
	The space is made at export and is never a letter to make.

	Stub until B11 turns on 'checks': a letter is ready when it has ink (hasInk). 4.2's full rule
	(ink, and every check passes or "Looks fine to me" was pressed) is B11's.

	B6 + B7 finalize: one rule for ink, Ready and empty, which the rail's count, the Next line
	(coach/font_facts.js), the letter card's chip and the empty overlay all read, so no two of
	them disagree. Ink is the letter's finished shapes with an area (spacing/outline.js inkPaths:
	a stray line of one or two clicked points holds none), never the shape the Point pen is still
	drawing (pass it as open: coach/open_shape.js openPathOf). Empty is no finished shape at all,
	so a letter whose only shape is a stray line is neither empty nor Ready: the font check names
	the shape and its Fix it takes it away.

	  QUICK_SET, NUMBERS_SET    the letters, in board order (capitals, small letters,
	                            punctuation; then numbers & symbols)
	  LETTER_SETS               the names settings.anyink.letterSet holds
	  lettersInSet(letterSet)   the letters of 'quick' or 'quick+numbers' (anything else: 'quick')
	  boardLetters(project)     the letters the board shows for this font, in board order
	  finishedShapes(item, { open })   its shapes, without the one the Point pen is drawing
	  inkOf(item, { open })     the finished shapes that hold ink (paths, parts flattened)
	  hasInk(item, { open })    true when a letter has ink: Ready, until B11's checks
	  isEmptyLetter(item, { open })    true when it has no finished shape
*/
import { inkPaths } from '../spacing/outline.js';


/** 4.2: the Quick font, 58 letters */
export const QUICK_SET = Object.freeze([
	...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
	...'abcdefghijklmnopqrstuvwxyz',
	...".,'?!-",
]);

/** 4.2: "+ Numbers & symbols" */
export const NUMBERS_SET = Object.freeze([...'0123456789', ...':;"()&@#$%/*']);

/** The set names settings.anyink.letterSet holds */
export const LETTER_SETS = Object.freeze(['quick', 'quick+numbers']);

/**
 * @param {String} [letterSet] - settings.anyink.letterSet
 * @returns {Array<String>} a new array, in board order
 */
export function lettersInSet(letterSet) {
	return letterSet === 'quick+numbers' ? [...QUICK_SET, ...NUMBERS_SET] : [...QUICK_SET];
}

/**
 * @param {Object} project - GlyphrStudioProject (reads settings.anyink.letterSet)
 * @returns {Array<String>} the board's letters, in board order
 */
export function boardLetters(project) {
	return lettersInSet(project?.settings?.anyink?.letterSet);
}

/**
 * @param {Object} item - a Glyph
 * @param {{open?: Object | null}} [options] - open: the shape the Point pen is still drawing
 * @returns {Array<Object>} its shapes, without that one
 */
export function finishedShapes(item, { open = null } = {}) {
	if (!Array.isArray(item?.shapes)) return [];
	return item.shapes.filter((shape) => !!shape && shape !== open);
}

/**
 * @param {Object} item - a Glyph
 * @param {{open?: Object | null}} [options]
 * @returns {Array<Object>} the paths that hold ink, the open one left out
 */
export function inkOf(item, { open = null } = {}) {
	if (!item) return [];
	return inkPaths(item).filter((path) => path !== open);
}

/**
 * @param {Object} item - a Glyph
 * @param {{open?: Object | null}} [options]
 * @returns {Boolean}
 */
export function hasInk(item, { open = null } = {}) {
	return inkOf(item, { open }).length > 0;
}

/**
 * @param {Object} item - a Glyph
 * @param {{open?: Object | null}} [options]
 * @returns {Boolean}
 */
export function isEmptyLetter(item, { open = null } = {}) {
	return finishedShapes(item, { open }).length === 0;
}
