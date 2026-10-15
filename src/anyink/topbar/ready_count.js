// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: the rail's ready count, "1 Letters 7/58" (UX-BEGINNER.md 4.0 Top bar, 4.2 Letter set and
	Ready). Pure.

	The board's letter set is the Quick font: A to Z, a to z and . , ' ? ! - (58 letters). With
	"+ Numbers & symbols" (settings.anyink.letterSet 'quick+numbers') 0 to 9 and : ; " ( ) & @ # $
	% / * join it. The space is made at export and never counted.

	Stub until B10 / B11: a letter is ready when it has ink (a shape). 4.2's full rule (ink, and
	every check passes or "Looks fine to me" was pressed) needs B11's checks; pass isReady to
	count that way once they land.

	  QUICK_SET, NUMBERS_SET      the letters, in board order
	  boardLetters(project)       the letters the board shows for this font
	  hasInk(item)                true when a letter has at least one shape
	  readyCount(project, { isReady, open })   { ready, total }; open: the shape the Point pen
	                              is still drawing, never ink (B6 + B7 finalize, letter_set.js)
*/
import { charToHex } from '../../common/character_ids.js';
import { boardLetters, hasInk, NUMBERS_SET, QUICK_SET } from '../board/letter_set.js';

// B6 + B7 integration: the sets, the board's letters and the "has ink" stub are board/letter_set.js's
export { boardLetters, hasInk, NUMBERS_SET, QUICK_SET };

/**
 * The letter's record, without making one (opening a letter makes it; counting never does).
 * @param {Object} project
 * @param {String} char
 * @returns {Object | false}
 */
function letterOf(project, char) {
	const hex = charToHex(char);
	if (!hex || typeof project?.getItem !== 'function') return false;
	return project.getItem(`glyph-${hex}`) || false;
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @param {{isReady?: (item: Object, char: String) => Boolean, open?: Object | null}} [options] -
 *   isReady default: hasInk, without the open shape
 * @returns {{ready: Number, total: Number}}
 */
export function readyCount(project, { open = null, isReady = (item) => hasInk(item, { open }) } = {}) {
	const letters = boardLetters(project);
	let ready = 0;
	letters.forEach((char) => {
		const item = letterOf(project, char);
		if (item && isReady(item, char)) ready++;
	});
	return { ready, total: letters.length };
}
