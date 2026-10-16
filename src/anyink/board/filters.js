// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10: the letter board's filters (UX-BEGINNER.md 4.2 Filters): "Show: (All 58) (Needs a look 1)
	(Empty 51)". They show only with B11's 'checks' flag on and once a letter needs a look (4.2:
	"shown only once a letter needs a look"; a new font has none, so its board has no filters).
	While they are hidden every letter shows.

	Under "Needs a look" each tile shows its reason and its fix right on the tile, outlined, with
	[Looks fine to me]; the one green button stays the Next line's (principle 1). A fix runs the
	way the Next line's rule 7 runs it (coach/actions.js): the check's own action (default
	'fixLetter') with { char, check, ...args }; Looks fine to me runs 'looksFine' with { char,
	check }. B11 registers both.

	Which filter he picked lasts while he stays on the board and a letter needs a look, per font
	(the editor's History: a font opened into the same editor starts on All), never in the font
	and never an Undo step (7.3: looking around). Fix pass (critic: a later amber letter opened
	the board filtered to that one tile, and rule 9 went one letter at a time on a filter he
	never picked that time): the pick ends when the filters hide (no letter needs a look, or
	'checks' off; settleBoardFilter, each time the board is drawn) and when he leaves the board
	(endBoardFilter: a letter, Help, All tools), so the board always opens on All, the way
	"<- All letters" names it. The pick is then always the filter in effect wherever the filters
	show, which is what the Next line's rule 9 reads (coach/font_facts.js boardFilter).

	  FILTERS                        ['all', 'needsLook', 'empty']
	  filtersShown(summary, isOn)    true with 'checks' on and a letter that needs a look
	  shownFilter(chosen, summary, isOn)   the filter in effect: what he picked while the bar
	                                 shows ('needsLook' only while a letter needs a look), else
	                                 'all'
	  tileShows(filter, state)       true when a tile in that state shows under that filter
	  filterOptions(summary)         [{ id, key, count }]: All, Needs a look, Empty
	  getBoardFilter(editor) / setBoardFilter(editor, filter)
	  settleBoardFilter(editor, summary, isOn)   ends the pick when the filters hide; true when
	                                 it ended
	  endBoardFilter(editor)         ends the pick (he left the board); true when it ended
	  makeFilterBar(summary, current, onPick)   the "Show:" row: one outlined button per filter,
	                                 aria-pressed on the one in effect
	  makeLookFixes(letter, run)     a tile's reason line and its outlined buttons (letter: a
	                                 boardSummary letter with needsLook { id, reason, fixLabel,
	                                 action, args }; run(action, args))
	  resetFiltersForTests()
*/
import { isFeatureOn } from '../mode/features.js';
import { letterName } from '../words/letter_name.js';
import { word } from '../words/words.js';

/** 4.2: All / Needs a look / Empty */
export const FILTERS = Object.freeze(['all', 'needsLook', 'empty']);

const FILTER_WORDS = Object.freeze({
	all: 'board.filter.all',
	needsLook: 'board.filter.needsLook',
	empty: 'board.filter.empty',
});

/** What he picked, per font: the editor's History (or the editor) -> filter */
let chosen = new WeakMap();

/**
 * @param {{needsLook?: Number}} summary - progress.js boardSummary
 * @param {(name: String) => Boolean} [isOn]
 * @returns {Boolean}
 */
export function filtersShown(summary, isOn = isFeatureOn) {
	return isOn('checks') && Number(summary?.needsLook) > 0;
}

/**
 * @param {String} filter - what he picked
 * @param {Object} summary
 * @param {(name: String) => Boolean} [isOn]
 * @returns {'all' | 'needsLook' | 'empty'}
 */
export function shownFilter(filter, summary, isOn = isFeatureOn) {
	if (!filtersShown(summary, isOn) || !FILTERS.includes(filter)) return 'all';
	return /** @type {'all' | 'needsLook' | 'empty'} */ (filter);
}

/**
 * @param {String} filter
 * @param {String} state - progress.js tileState
 * @returns {Boolean}
 */
export function tileShows(filter, state) {
	return filter === 'all' || filter === state;
}

/**
 * @param {{total: Number, needsLook: Number, empty: Number}} summary
 * @returns {Array<{id: String, key: String, count: Number}>}
 */
export function filterOptions(summary) {
	const counts = { all: summary.total, needsLook: summary.needsLook, empty: summary.empty };
	return FILTERS.map((id) => ({ id, key: FILTER_WORDS[id], count: counts[id] || 0 }));
}

/** @param {Object} editor @returns {Object | null} what the memory is kept by */
function keyOf(editor) {
	const key = editor?.history || editor;
	return key && typeof key === 'object' ? key : null;
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {'all' | 'needsLook' | 'empty'} what he picked ('all' until he picks)
 */
export function getBoardFilter(editor) {
	const key = keyOf(editor);
	return (key && chosen.get(key)) || 'all';
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {String} filter - one of FILTERS
 * @returns {Boolean} true when it changed
 */
export function setBoardFilter(editor, filter) {
	const key = keyOf(editor);
	if (!key || !FILTERS.includes(filter) || getBoardFilter(editor) === filter) return false;
	chosen.set(key, filter);
	return true;
}

/**
 * The pick ends when the filters hide, so it never comes back with a later amber letter.
 * @param {Object} editor - ProjectEditor
 * @param {{needsLook?: Number}} summary - progress.js boardSummary, read with the checks
 * @param {(name: String) => Boolean} [isOn]
 * @returns {Boolean} true when a pick ended
 */
export function settleBoardFilter(editor, summary, isOn = isFeatureOn) {
	if (filtersShown(summary, isOn)) return false;
	return endBoardFilter(editor);
}

/**
 * He left the board: the next time it opens on All.
 * @param {Object} editor - ProjectEditor
 * @returns {Boolean} true when a pick other than All ended
 */
export function endBoardFilter(editor) {
	const key = keyOf(editor);
	if (!key || getBoardFilter(editor) === 'all') return false;
	chosen.delete(key);
	return true;
}

/**
 * The "Show:" row.
 * @param {Object} summary - progress.js boardSummary
 * @param {String} current - the filter in effect
 * @param {(filter: String) => void} onPick
 * @returns {HTMLElement}
 */
export function makeFilterBar(summary, current, onPick) {
	const bar = document.createElement('div');
	bar.className = 'anyink-board__filters';
	bar.setAttribute('role', 'group');
	bar.setAttribute('aria-label', word('board.filter.group'));
	const label = document.createElement('span');
	label.className = 'anyink-board__filters-label';
	label.textContent = word('board.filter.label');
	bar.appendChild(label);
	filterOptions(summary).forEach(({ id, key, count }) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'anyink-board__filter anyink-outlined';
		button.dataset.anyinkBoardFilter = id;
		button.setAttribute('aria-pressed', String(id === current));
		button.textContent = word(key, { count });
		button.addEventListener('click', () => onPick(id));
		bar.appendChild(button);
	});
	return bar;
}

/**
 * A tile's "Needs a look" part: its reason, its fix and Looks fine to me, all outlined.
 * @param {{char: String, needsLook: Object | null}} letter
 * @param {(action: String, args: Object) => void} run
 * @returns {HTMLElement | null} null when the letter needs no look
 */
export function makeLookFixes(letter, run) {
	const look = letter?.needsLook;
	if (!look) return null;
	const part = document.createElement('div');
	part.className = 'anyink-board__look';
	const reason = document.createElement('p');
	reason.className = 'anyink-board__reason';
	reason.textContent = String(look.reason || '');
	part.appendChild(reason);
	const buttons = document.createElement('div');
	buttons.className = 'anyink-board__fixes';
	buttons.setAttribute('role', 'group');
	buttons.setAttribute('aria-label', word('board.tile.fixes', { name: letterName(letter.char) }));
	const check = look.id ?? null;
	if (look.fixLabel) {
		buttons.appendChild(
			fixButton(String(look.fixLabel), 'fix', () =>
				run(look.action || 'fixLetter', { char: letter.char, check, ...(look.args || {}) })
			)
		);
	}
	buttons.appendChild(
		fixButton(word('board.tile.looksFine'), 'looksFine', () =>
			run('looksFine', { char: letter.char, check })
		)
	);
	part.appendChild(buttons);
	return part;
}

/**
 * @param {String} text
 * @param {String} kind - data-anyink-board-fix
 * @param {Function} onClick
 * @returns {HTMLButtonElement}
 */
function fixButton(text, kind, onClick) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'anyink-board__fix anyink-outlined';
	button.dataset.anyinkBoardFix = kind;
	button.textContent = text;
	button.addEventListener('click', (event) => {
		// the press is the fix's, not the tile's (a tile press opens the letter)
		event.stopPropagation();
		onClick();
	});
	return button;
}

/** Forgets every pick. */
export function resetFiltersForTests() {
	chosen = new WeakMap();
}
