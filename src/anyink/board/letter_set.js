// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	The board's letter set (UX-BEGINNER.md 4.2 "Letter set" and "Ready"), in one place. B6 + B7
	integration: the rail's ready count (topbar/ready_count.js), the Next line's letter order
	(coach/letter_order.js) and the letter header's ‹ A / C › (letter/letter_header.js) each had
	their own copy; they read this one now. B10 owns this file (section 10 B10 letter_set.js) and
	adds "+ Numbers & symbols" as a settings Undo step here.

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

	B10 (board-tiles track) owns this file now and adds:
	  boardOrder(project)       the board's letters in order: moved here from
	                            letter/letter_header.js, which re-exports it (the header's ‹ A / C ›,
	                            the board's keys and the tiles read one order)
	  BOARD_SECTIONS            the board's sections in order: { id, letters } for 'capitals',
	                            'small', 'punctuation', then 'numbers' (4.2: CAPITALS, SMALL
	                            LETTERS, PUNCTUATION, NUMBERS & SYMBOLS)
	  boardSections(project)    the sections the board shows for this font ('numbers' only once
	                            "+ Numbers & symbols" is on)
	  numbersShown(project)     true when settings.anyink.letterSet is 'quick+numbers'
	  setNumbersShown(editor, shown)   "+ Numbers & symbols" / "- Numbers & symbols" (4.2
	                            Toolbar): writes settings.anyink.letterSet and records ONE settings
	                            Undo step ("added numbers & symbols" / "hid numbers & symbols", 7.3:
	                            settings steps hold settings.anyink). The project's letters and
	                            character ranges never change: the set is a view. Hiding is
	                            destructive-looking, so Simple says it with an Undo toast
	                            ("Hid numbers & symbols. Your letters are kept." [Undo], 7.3).
	                            Returns true when the set changed (false: already so, or no font)
	  toggleNumbers(editor)     setNumbersShown(editor, !numbersShown(project)): the toolbar's one
	                            button
	The rest stays pure; setNumbersShown is the one function here that touches History and a
	toast.
*/
import { undoOffer } from '../history/undo_toast.js';
import { inkPaths } from '../spacing/outline.js';
import { toast } from '../toast/toast.js';
import { word } from '../words/words.js';


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

/** settings.anyink.letterSet with "+ Numbers & symbols" on */
const WITH_NUMBERS = 'quick+numbers';

/** 4.2: the board's sections, in board order (the last one only with "+ Numbers & symbols") */
export const BOARD_SECTIONS = Object.freeze(
	[
		{ id: 'capitals', letters: Object.freeze([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']) },
		{ id: 'small', letters: Object.freeze([...'abcdefghijklmnopqrstuvwxyz']) },
		{ id: 'punctuation', letters: Object.freeze([...".,'?!-"]) },
		{ id: 'numbers', letters: NUMBERS_SET },
	].map((section) => Object.freeze(section))
);

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
 * The board's order (4.2): ‹ A / C › in the letter view, the arrow keys on the board.
 * @param {Object} project - reads settings.anyink.letterSet
 * @returns {Array<String>}
 */
export function boardOrder(project) {
	return boardLetters(project);
}

/**
 * @param {Object} project
 * @returns {Array<Readonly<{id: String, letters: ReadonlyArray<String>}>>} the sections the board
 *   shows, in order
 */
export function boardSections(project) {
	const numbers = numbersShown(project);
	return BOARD_SECTIONS.filter((section) => section.id !== 'numbers' || numbers);
}

/**
 * @param {Object} project
 * @returns {Boolean} true when "+ Numbers & symbols" is on
 */
export function numbersShown(project) {
	return project?.settings?.anyink?.letterSet === WITH_NUMBERS;
}

/**
 * "+ Numbers & symbols" (shown true) or "- Numbers & symbols" (false): one settings Undo step.
 * Hiding never deletes a letter; Simple says so with an Undo toast (7.3).
 * @param {Object} editor - ProjectEditor (project, history)
 * @param {Boolean} shown
 * @returns {Boolean} true when the set changed
 */
export function setNumbersShown(editor, shown) {
	const project = editor?.project;
	if (!project?.settings || numbersShown(project) === !!shown) return false;
	if (!project.settings.anyink || typeof project.settings.anyink !== 'object') {
		project.settings.anyink = {};
	}
	project.settings.anyink.letterSet = shown ? WITH_NUMBERS : 'quick';
	if (typeof editor.history?.addSettingsState === 'function') {
		editor.history.addSettingsState(
			word(shown ? 'boardTile.step.addNumbers' : 'boardTile.step.hideNumbers')
		);
	}
	if (!shown) {
		toast('boardTile.toast.numbersHidden', {}, {
			kind: 'destructive',
			allTools: false,
			...undoOffer(editor),
		});
	}
	return true;
}

/**
 * The toolbar's one button: "+ Numbers & symbols", then "- Numbers & symbols".
 * @param {Object} editor
 * @returns {Boolean} true when the set changed
 */
export function toggleNumbers(editor) {
	return setNumbersShown(editor, !numbersShown(editor?.project));
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
