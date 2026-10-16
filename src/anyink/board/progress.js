// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10: the letter board's progress (UX-BEGINNER.md 4.2 Letter set, Ready, Progress). Pure:
	letters' facts in, counts out.

	One rule for every count (D-037): each letter's facts come from the coach's own letterFacts
	(coach/font_facts.js), so the board, the rail's "7/58" (topbar/ready_count.js) and the Next
	line read ink, Ready and "needs a look" the same way. Ready is ink and no check that needs a
	look (B11's checks, only while 'checks' is on); until then, ink.

	A tile is in one of three states, so the counts always add up to the total:
	  'ready'      Ready (4.2 Tiles: his ink)
	  'needsLook'  ink, and a check (B11) says it needs a look: amber, with its reason
	  'empty'      no ink yet: nothing drawn, or only a stray line (the letter card says "Empty"
	               then too, D-037), or a shape the Point pen is still drawing
	Sections, in board order: Capitals (A to Z), Small letters (a to z), Punctuation (. , ' ? !
	-), then Numbers & symbols when "+ Numbers & symbols" is on. A section shows its own count
	("4 of 26") only once it has a ready letter, and is done when every letter in it is ready.

	  sectionList()             [{ id, nameKey, toastKey }] in board order (the letters of each
	                            are letter_set.js BOARD_SECTIONS, the board-tiles track's)
	  sectionOf(char)           'capitals' | 'small' | 'punctuation' | 'numbers'
	  tileState(fact)           'ready' | 'needsLook' | 'empty'
	  boardFacts(project, { checks, checksOn, editor, open })   the board's letters, each
	                            { char, ink, shapes, ready, needsLook, drawing }, in board order
	  boardSummary(letters)     { total, ready, needsLook, empty, fraction, letters, sections };
	                            letters: each fact with its state and section; sections: [{ id,
	                            nameKey, toastKey, letters, total, ready, needsLook, empty,
	                            showCount, done }] (only sections with letters)
	  doneSections(summary)     the ids of the finished sections
	  newlyDone(before, after)  the ids done in after that weren't in before
*/
import { letterFacts, letterItem } from '../coach/font_facts.js';
import { BOARD_SECTIONS, boardLetters } from './letter_set.js';

/** The words of each of 4.2's sections (letter_set.js BOARD_SECTIONS holds their letters) */
const SECTION_WORDS = Object.freeze({
	capitals: { nameKey: 'board.section.capitals', toastKey: 'board.toast.capitalsDone' },
	small: { nameKey: 'board.section.small', toastKey: 'board.toast.smallDone' },
	punctuation: { nameKey: 'board.section.punctuation', toastKey: 'board.toast.punctuationDone' },
	numbers: { nameKey: 'board.section.numbers', toastKey: 'board.toast.numbersDone' },
});

/**
 * 4.2's sections, in board order, with their words.
 * @returns {Array<Readonly<{id: String, nameKey: String, toastKey: String}>>}
 */
export function sectionList() {
	return BOARD_SECTIONS.map((section) =>
		Object.freeze({ id: section.id, ...(SECTION_WORDS[section.id] || SECTION_WORDS.punctuation) })
	);
}

/**
 * @param {String} char
 * @returns {String} the id of the section it is in ('capitals', 'small', 'punctuation',
 *   'numbers'); a letter in none of them (never on the board) counts as punctuation
 */
export function sectionOf(char) {
	const section = BOARD_SECTIONS.find((one) => one.letters.includes(char));
	return section ? section.id : 'punctuation';
}

/**
 * @param {{ink?: Boolean, ready?: Boolean, needsLook?: Object | null}} fact
 * @returns {'ready' | 'needsLook' | 'empty'}
 */
export function tileState(fact) {
	if (!fact?.ink) return 'empty';
	if (fact.needsLook) return 'needsLook';
	return fact.ready ? 'ready' : 'empty';
}

/**
 * The board's letters, read the coach's way (one rule for ink and Ready).
 * @param {Object} project - GlyphrStudioProject
 * @param {Object} [options] - as coach/font_facts.js letterFacts takes them
 * @param {Function | null} [options.checks] - B11: (item, { char, editor }) => needsLook | null
 * @param {Boolean} [options.checksOn]
 * @param {Object} [options.editor]
 * @param {Object | null} [options.open] - the shape the Point pen is still drawing
 * @returns {Array<Object>} facts, in board order; reading never makes a letter's record
 */
export function boardFacts(
	project,
	{ checks = null, checksOn = false, editor = null, open = null } = {}
) {
	if (!project) return [];
	return boardLetters(project).map((char) =>
		letterFacts(letterItem(project, char), char, { checks, checksOn, editor, open })
	);
}

/**
 * @param {Array<Object>} letters - facts in board order (boardFacts, or the coach's state.letters)
 * @returns {Object} the summary
 */
export function boardSummary(letters = []) {
	const counted = (list) => {
		let ready = 0;
		let needsLook = 0;
		let empty = 0;
		list.forEach((letter) => {
			if (letter.state === 'ready') ready++;
			else if (letter.state === 'needsLook') needsLook++;
			else empty++;
		});
		return { total: list.length, ready, needsLook, empty };
	};
	const placed = letters.map((fact) =>
		Object.freeze({ ...fact, state: tileState(fact), section: sectionOf(fact.char) })
	);
	const sections = sectionList()
		.map((section) => {
			const inIt = placed.filter((letter) => letter.section === section.id);
			const counts = counted(inIt);
			return Object.freeze({
				...section,
				letters: inIt,
				...counts,
				showCount: counts.ready > 0,
				done: counts.total > 0 && counts.ready === counts.total,
			});
		})
		.filter((section) => section.total > 0);
	const counts = counted(placed);
	return Object.freeze({
		...counts,
		fraction: counts.total ? counts.ready / counts.total : 0,
		letters: placed,
		sections,
	});
}

/**
 * @param {Object} summary - boardSummary
 * @returns {Array<String>} the ids of the finished sections
 */
export function doneSections(summary) {
	return (summary?.sections || []).filter((section) => section.done).map((section) => section.id);
}

/**
 * @param {Array<String> | null} before - doneSections earlier (null: nothing seen yet)
 * @param {Array<String>} after - doneSections now
 * @returns {Array<String>} the sections finished since; none when nothing was seen before
 */
export function newlyDone(before, after) {
	if (!Array.isArray(before)) return [];
	return after.filter((id) => !before.includes(id));
}
