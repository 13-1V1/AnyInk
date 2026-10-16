// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 board-page: the letter board on the Overview page in Simple (UX-BEGINNER.md 4.2; section 10
	B10), drawn by the real Navigator in jsdom:
	  - the Overview in Simple with 'board' on is the board of the Quick font: 58 tiles in board
	    order, across the page; B5's stand-in (the Welcome card and the 95 Basic Latin tiles that
	    contradicted the rail) is gone there; All tools and B5's flagless Simple keep their pages
	  - one progress line "N of 58 ready" with its bar, then section counts (a section's count
	    once it has a ready letter, a check mark once it is done); the rail says the same count
	  - the toolbar: Use a photo... (photo), + / - Numbers & symbols (one settings step each),
	    Letter spacing... only with Try it (B12) and 3 ready letters; a new font has no filters,
	    no Letter spacing and no extra text
	  - filters only with B11's checks on and a letter that needs a look; "Needs a look" shows
	    that tile's reason and outlined fixes, the Next line's [Show me] (rule 9) opens it
	  - a tile press opens the letter with no Undo step; back on the board the tile he had open
	    has the green ring and is the one tab stop, scrolled into view
	  - the board keeps up: a change draws only that tile again, a drawing with nothing changed
	    touches nothing, Undo on the board stays on the board, and drawing again after a change
	    takes under 16 ms (one frame)
	  - a section that finishes says so once ("All small letters done. Your font can type words
	    now."); the first look at a font never does
	Written to fail first: on the code before this track the Simple Overview drew the Welcome card
	and 95 tiles (no [data-anyink-board]), and board_page.js didn't exist.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCoachActionsForTests, runCoachAction, setCoachAction } from '../../coach/actions.js';
import { getCoach, setCoachSource } from '../../coach/coach_state.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setMode, setModeForTests } from '../../mode/mode.js';
import { noFlags } from '../../mode/tests/no_flags.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { readyCount } from '../../topbar/ready_count.js';
import { word } from '../../words/words.js';
import {
	boardState,
	installBoard,
	isBoardOn,
	lastTouchedOnBoard,
	openLetterFromBoard,
	readyRuleFor,
	resetBoardForTests,
	shownTiles,
	tileOf,
	updateBoard,
} from '../board_page.js';
import { getBoardFilter, resetFiltersForTests } from '../filters.js';
import { QUICK_SET, setNumbersShown } from '../letter_set.js';
import { addLetter, boardEditor, LOOK, lookChecks, openPage, square } from './board_font.js';

let quiet = [];
beforeEach(() => {
	if (!Element.prototype.animate) {
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
	}
	if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
	resetBoardForTests();
	resetFiltersForTests();
	resetToastsForTests();
	resetCoachActionsForTests();
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'log').mockImplementation(() => {}),
	];
});
afterEach(() => {
	quiet.forEach((spy) => spy.mockRestore());
	document.body.innerHTML = '';
	setModeForTests('all');
});

/** Simple with the board's flag on (and any other flags) */
function simpleBoard(flags = {}) {
	setModeForTests('simple');
	setFeaturesForTests({ board: true, ...flags });
}

const text = (node) => (node?.textContent || '').replace(/\s+/g, ' ').trim();
const progress = (board) => text(board.querySelector('.anyink-board__progress'));
const tiles = (board) => shownTiles(board);
const charsOf = (board) => tiles(board).map((tile) => tile.getAttribute('data-anyink-char'));
const section = (board, id) => board.querySelector(`[data-anyink-board-section="${id}"]`);
const tools = (board) =>
	[...board.querySelectorAll('[data-anyink-board-tool]')].map((button) => button.textContent);

/** Opens a letter, draws one square in it as one Undo step, and goes back to the board */
function drawOn(editor, char, x = 0) {
	openLetterFromBoard(editor, char);
	editor.selectedGlyph.addOneShape(square(x));
	editor.history.addState(`drew ${char}`);
	return openPage(editor, 'Overview');
}

describe('the Overview in Simple is the letter board', () => {
	it("58 tiles of the Quick font in board order, and nothing of B5's stand-in", () => {
		simpleBoard();
		const editor = boardEditor({ seed: false });
		const board = openPage(editor);
		expect(isBoardOn()).toBe(true);
		expect(board).not.toBeNull();
		expect(charsOf(board)).toEqual([...QUICK_SET]);
		expect(charsOf(board)).toHaveLength(58);
		const page = document.querySelector('#app__page');
		// the Welcome card, the sample's preview, the 95-tile chooser and the left area are gone
		expect(text(page)).not.toContain(word('overview.welcomeTitle'));
		expect(page.querySelector('display-canvas')).toBeNull();
		expect(page.querySelector('option-chooser, .item-chooser__wrapper')).toBeNull();
		expect(page.querySelector('.content-page__left-area, #content-page__panel')).toBeNull();
		expect(page.querySelectorAll('glyph-tile')).toHaveLength(58);
		expect(page.querySelector('.content__page').classList).toContain('anyink-board-page');
		// in sections, in order, named in house words
		expect(
			[...board.querySelectorAll('.anyink-board__section-name')].map((name) => name.textContent)
		).toEqual(['Capitals', 'Small letters', 'Punctuation']);
	});

	it('All tools keeps the Overview as it was', () => {
		setFeaturesForTests({ board: true });
		const editor = boardEditor({ seed: false });
		openPage(editor);
		expect(document.querySelector('[data-anyink-board]')).toBeNull();
		expect(text(document.querySelector('#app__page'))).toContain('Project info');
		expect(document.querySelector('display-canvas')).not.toBeNull();
	});

	it("Simple with the board's flag off keeps B5's stub (the walkthroughs that pin no flags)", () => {
		setModeForTests('simple');
		noFlags();
		const editor = boardEditor({ seed: false });
		openPage(editor);
		expect(document.querySelector('[data-anyink-board]')).toBeNull();
		expect(text(document.querySelector('#app__page'))).toContain(word('overview.welcomeTitle'));
	});
});

describe('one progress line, then section counts', () => {
	it('a new font: "0 of 58 ready", no counts, no filters, no Letter spacing, no extra text', () => {
		simpleBoard({ tryIt: true });
		const board = openPage(boardEditor({ seed: false }));
		expect(progress(board)).toBe('0 of 58 ready');
		const bar = board.querySelector('[role="progressbar"]');
		expect([bar.getAttribute('aria-valuenow'), bar.getAttribute('aria-valuemax')]).toEqual([
			'0',
			'58',
		]);
		expect(board.querySelector('.anyink-board__bar-fill').style.width).toBe('0%');
		expect(
			[...board.querySelectorAll('.anyink-board__section-count')].filter((c) => !c.hidden)
		).toHaveLength(0);
		expect(board.querySelector('.anyink-board__filters')).toBeNull();
		expect(tools(board)).toEqual(['Use a photo...', '+ Numbers & symbols']);
		// the only sentence on the board is the space note under Punctuation (4.2 Empty state)
		const sentences = [...board.querySelectorAll('p')].filter((p) => !p.hidden);
		expect(sentences.map((p) => p.textContent)).toEqual([word('board.spaceNote')]);
		expect(section(board, 'punctuation').contains(sentences[0])).toBe(true);
	});

	it('the seeded font: "7 of 58 ready"; Capitals 2 of 26, Small letters 5 of 26; the rail agrees', () => {
		simpleBoard();
		const editor = boardEditor();
		const board = openPage(editor);
		expect(progress(board)).toBe('7 of 58 ready');
		expect(text(section(board, 'capitals').querySelector('.anyink-board__section-count'))).toBe(
			'2 of 26'
		);
		expect(text(section(board, 'small').querySelector('.anyink-board__section-count'))).toBe(
			'5 of 26'
		);
		expect(section(board, 'punctuation').querySelector('.anyink-board__section-count').hidden).toBe(
			true
		);
		// the rail's "1 Letters 7/58" and the Next line's letters
		expect(text(document.querySelector('.anyink-topbar__step-count'))).toBe('7/58');
		const { ready } = readyCount(editor.project);
		expect(ready).toBe(7);
		expect(
			getCoach()
				.state()
				.letters.filter((l) => l.ready)
		).toHaveLength(7);
		// a stray line is Empty, as the letter card says
		expect(tileOf(board, 'c').getAttribute('session-state')).toBe('empty');
	});

	it('a finished section gets its check mark', () => {
		simpleBoard();
		const editor = boardEditor();
		[...".,'?!-"].forEach((char) => addLetter(editor.project, char, [square()]));
		const board = openPage(editor);
		const punctuation = section(board, 'punctuation');
		expect(punctuation.querySelector('.anyink-board__section-done').hidden).toBe(false);
		expect(punctuation.hasAttribute('data-done')).toBe(true);
		expect(section(board, 'small').querySelector('.anyink-board__section-done').hidden).toBe(true);
	});
});

describe('the toolbar', () => {
	it('"+ Numbers & symbols": 80 tiles, one settings step, then "- Numbers & symbols"; Undo takes it back', () => {
		simpleBoard();
		const editor = boardEditor();
		const board = openPage(editor);
		const steps = editor.history.queue.length;
		board.querySelector('[data-anyink-board-tool="numbers"]').click();
		expect(charsOf(board)).toHaveLength(80);
		expect(charsOf(board).slice(58)).toEqual([...'0123456789', ...':;"()&@#$%/*']);
		expect(progress(board)).toBe('7 of 80 ready');
		expect(section(board, 'numbers')).not.toBeNull();
		expect(tools(board)).toContain('- Numbers & symbols');
		expect(editor.history.queue.length).toBe(steps + 1);
		// the press keeps the keyboard where it was
		editor.history.restoreState();
		updateBoard(board);
		expect(charsOf(board)).toHaveLength(58);
		expect(section(board, 'numbers')).toBeNull();
		expect(tools(board)).toContain('+ Numbers & symbols');
	});

	it('Letter spacing... only with Try it, and only from 3 ready letters', () => {
		simpleBoard({ tryIt: true });
		const editor = boardEditor();
		const board = openPage(editor);
		expect(tools(board)).toEqual(['Use a photo...', 'Letter spacing...', '+ Numbers & symbols']);
		const asked = vi.fn();
		setCoachAction('tryIt', asked);
		board.querySelector('[data-anyink-board-tool="letterSpacing"]').click();
		expect(asked).toHaveBeenCalledWith({ open: 'letterSpacing' }, expect.anything());
		// before B12, no door to it
		setFeaturesForTests({ tryIt: false });
		updateBoard(board);
		expect(tools(board)).not.toContain('Letter spacing...');
	});

	it('Use a photo... opens the photo picker with the letter unknown', async () => {
		simpleBoard();
		const editor = boardEditor({ seed: false });
		const board = openPage(editor);
		const photos = await import('../../photo/photo_app.js');
		const picker = vi.spyOn(photos, 'pickPhoto').mockResolvedValue(false);
		board.querySelector('[data-anyink-board-tool="usePhoto"]').click();
		await vi.waitFor(() => expect(picker).toHaveBeenCalledWith(editor, {}));
	});

	it("every button on the board is outlined: the one green button stays the Next line's", () => {
		simpleBoard({ checks: true, tryIt: true });
		setCoachSource('checks', lookChecks());
		const editor = boardEditor();
		const board = openPage(editor);
		board.querySelector('[data-anyink-board-filter="needsLook"]').click();
		expect(board.querySelectorAll('button').length).toBeGreaterThan(4);
		expect(
			board.querySelector('.anyink-primary, .button__call-to-action, fancy-button')
		).toBeNull();
	});
});

describe('filters (B11 checks)', () => {
	it('hidden until checks are on and a letter needs a look', () => {
		// B10 + B11 integration: 'checks' is on in the app now; this is the board without it
		simpleBoard({ checks: false });
		setCoachSource('checks', lookChecks());
		const board = openPage(boardEditor());
		expect(board.querySelector('.anyink-board__filters')).toBeNull();
		expect(progress(board)).toBe('7 of 58 ready');
		expect(tileOf(board, 'e').getAttribute('session-state')).toBe('ready');
	});

	it('with checks on: small e is amber, 6 of 58 ready, and Needs a look shows its reason and fixes', () => {
		simpleBoard({ checks: true });
		setCoachSource('checks', lookChecks());
		const fixed = vi.fn();
		setCoachAction('fixLetter', fixed);
		const editor = boardEditor();
		const board = openPage(editor);
		expect(progress(board)).toBe('6 of 58 ready');
		expect(tileOf(board, 'e').getAttribute('session-state')).toBe('needsLook');
		const filters = [...board.querySelectorAll('[data-anyink-board-filter]')];
		expect(filters.map((b) => b.textContent)).toEqual(['All 58', 'Needs a look 1', 'Empty 51']);
		expect(board.querySelector('.anyink-board__look')).toBeNull();

		filters[1].click();
		expect(charsOf(board)).toEqual(['e']);
		expect(boardState(board).filter).toBe('needsLook');
		const look = board.querySelector('.anyink-board__look');
		expect(text(look.querySelector('.anyink-board__reason'))).toBe(LOOK.reason);
		const buttons = [...look.querySelectorAll('button')];
		expect(buttons.map((b) => b.textContent)).toEqual(['Sit on the line', 'Looks fine to me']);
		buttons[0].click();
		expect(fixed).toHaveBeenCalledWith({ char: 'e', check: 'line' }, { editor });
		// a fix press never opens the letter
		expect(editor.nav.page).toBe('Overview');

		board.querySelector('[data-anyink-board-filter="empty"]').click();
		expect(charsOf(board)).toHaveLength(51);
		expect(charsOf(board)).toContain('c');
		board.querySelector('[data-anyink-board-filter="all"]').click();
		expect(charsOf(board)).toHaveLength(58);
	});

	it("the Next line's [Show me] (rule 9) opens the board on Needs a look, from a letter too", () => {
		simpleBoard({ checks: true });
		setCoachSource('checks', lookChecks());
		const editor = boardEditor();
		openPage(editor);
		openLetterFromBoard(editor, 'B');
		expect(editor.nav.page).toBe('Characters');
		expect(runCoachAction('showNeedsLook', null, { editor })).toBe(true);
		expect(editor.nav.page).toBe('Overview');
		const board = document.querySelector('[data-anyink-board]');
		expect(charsOf(board)).toEqual(['e']);
	});

	it("the board's Ready rule gives the rail the board's count (readyCount's isReady)", () => {
		simpleBoard({ checks: true });
		setCoachSource('checks', lookChecks());
		const editor = boardEditor();
		const board = openPage(editor);
		expect(progress(board)).toBe('6 of 58 ready');
		expect(readyCount(editor.project, { isReady: readyRuleFor(editor) })).toEqual({
			ready: 6,
			total: 58,
		});
		// checks off: ink alone, as the rail counts today
		setFeaturesForTests({ checks: false });
		expect(readyCount(editor.project, { isReady: readyRuleFor(editor) }).ready).toBe(7);
	});

	it('"Empty" with every letter inked says so instead of showing nothing', () => {
		simpleBoard({ checks: true });
		setCoachSource('checks', lookChecks());
		const editor = boardEditor({ seed: false });
		QUICK_SET.forEach((char) => addLetter(editor.project, char, [square()]));
		const board = openPage(editor);
		board.querySelector('[data-anyink-board-filter="empty"]').click();
		expect(charsOf(board)).toEqual([]);
		expect(text(board.querySelector('.anyink-board__nothing'))).toBe(word('board.filter.noneEmpty'));
		board.querySelector('[data-anyink-board-filter="all"]').click();
		expect(board.querySelector('.anyink-board__nothing')).toBeNull();
		expect(charsOf(board)).toHaveLength(58);
	});

	it('when no letter needs a look any more, the board shows every letter again', () => {
		simpleBoard({ checks: true });
		let looking = ['e'];
		setCoachSource('checks', (_item, { char }) => (looking.includes(char) ? LOOK : null));
		const board = openPage(boardEditor());
		board.querySelector('[data-anyink-board-filter="needsLook"]').click();
		expect(charsOf(board)).toEqual(['e']);
		looking = [];
		getCoach().refresh();
		updateBoard(board);
		expect(board.querySelector('.anyink-board__filters')).toBeNull();
		expect(charsOf(board)).toHaveLength(58);
	});
});

describe('the Needs a look filter never sticks (critic: shots/d6-board-after-new-amber.png)', () => {
	// Written to fail first: the pick was kept for the session and came back whenever any letter
	// needed a look, so a later amber letter opened the board on that one tile alone, and rule 9
	// went one-letter-at-a-time on a filter he never picked this time.
	const shownOnBoard = () => getCoach().state().boardFilter;

	it('Looks fine to me on the last amber tile ends the pick; a later amber letter finds the board on All', () => {
		simpleBoard({ checks: true });
		let looking = ['e'];
		setCoachSource('checks', (_item, { char }) => (looking.includes(char) ? LOOK : null));
		const editor = boardEditor();
		const board = openPage(editor);
		expect(runCoachAction('showNeedsLook', null, { editor })).toBe(true);
		expect(charsOf(board)).toEqual(['e']);
		// every amber tile said Looks fine to me: the filters hide, every letter shows
		looking = [];
		getCoach().refresh();
		updateBoard(board);
		expect(board.querySelector('.anyink-board__filters')).toBeNull();
		// later small r floats (still on the board)
		looking = ['r'];
		getCoach().refresh();
		updateBoard(board);
		expect(boardState(board).filter).toBe('all');
		expect(charsOf(board)).toHaveLength(58);
		expect(getBoardFilter(editor)).toBe('all');
		expect(
			board.querySelector('[data-anyink-board-filter="all"]').getAttribute('aria-pressed')
		).toBe('true');
		// the Next line asks as it does for a first one: "1 letter needs a look." [Show me]
		expect(shownOnBoard()).toBe('all');
		expect([getCoach().line().rule, getCoach().line().action]).toEqual([9, 'showNeedsLook']);
	});

	it('leaving the board ends the pick: back from a letter, the board is All again', () => {
		simpleBoard({ checks: true });
		setCoachSource('checks', lookChecks(['e', 'r']));
		const editor = boardEditor();
		let board = openPage(editor);
		board.querySelector('[data-anyink-board-filter="needsLook"]').click();
		expect(charsOf(board).sort()).toEqual(['e', 'r']);
		// the amber e's tile opens small e
		tileOf(board, 'e').click();
		expect(editor.nav.page).toBe('Characters');
		expect(getBoardFilter(editor)).toBe('all');
		// "<- All letters": every letter, the filter bar on All, the Next line's [Show me]
		board = openPage(editor, 'Overview');
		expect(boardState(board).filter).toBe('all');
		expect(charsOf(board)).toHaveLength(58);
		expect(shownOnBoard()).toBe('all');
		expect(getCoach().line().action).toBe('showNeedsLook');
	});

	it('the critic\'s path: Show me, fixed them all, drew a floating letter, back on the board: All', () => {
		simpleBoard({ checks: true });
		let looking = ['e'];
		setCoachSource('checks', (_item, { char }) => (looking.includes(char) ? LOOK : null));
		const editor = boardEditor();
		openPage(editor);
		runCoachAction('showNeedsLook', null, { editor });
		looking = [];
		getCoach().refresh();
		updateBoard(document.querySelector('[data-anyink-board]'));
		// he draws small o, floating, in its letter view
		openLetterFromBoard(editor, 'o');
		editor.selectedGlyph.addOneShape(square(0));
		editor.history.addState('drew o');
		looking = ['o'];
		getCoach().refresh();
		const board = openPage(editor, 'Overview');
		expect(boardState(board).filter).toBe('all');
		expect(charsOf(board)).toHaveLength(58);
		expect(tileOf(board, 'o').getAttribute('session-state')).toBe('needsLook');
		expect(shownOnBoard()).toBe('all');
	});

	// B10 + B11 finalize (verdict "new problem"): the switch to All tools is the only thing that
	// ends the pick when he presses More tools on the board (the page stays Overview). Written to
	// fail first with that branch taken out of installBoard's MODE_EVENT listener
	it('a switch to All tools ends the pick: back in Simple, the board is All', () => {
		simpleBoard({ checks: true });
		setCoachSource('checks', lookChecks(['e', 'r']));
		const editor = boardEditor();
		let board = openPage(editor);
		board.querySelector('[data-anyink-board-filter="needsLook"]').click();
		expect(getBoardFilter(editor)).toBe('needsLook');
		setMode('all');
		setMode('simple');
		board = openPage(editor, 'Overview');
		expect(getBoardFilter(editor)).toBe('all');
		expect(boardState(board).filter).toBe('all');
		expect(charsOf(board)).toHaveLength(58);
	});

	// B10 + B11 finalize (critic: "Something else hides a letter's fix for the session"). Written
	// to fail first: a skip lasted until the letter's state changed, so an amber tile he opened
	// showed no fix on the Next line, and [Show me] passed over the letters he had skipped
	it("opening an amber tile, or [Show me], brings back a skipped letter's fix", () => {
		simpleBoard({ checks: true, letterView: true });
		setCoachSource('checks', lookChecks(['e']));
		const editor = boardEditor();
		const board = openPage(editor);
		runCoachAction('showNeedsLook', null, { editor });
		expect(getCoach().line()).toMatchObject({ rule: 9, args: { char: 'e' } });
		getCoach().skip();
		expect(getCoach().line().args?.char).not.toBe('e');
		// [Show me] again: e's fix is back
		runCoachAction('showNeedsLook', null, { editor });
		expect(getCoach().line()).toMatchObject({ rule: 9, args: { char: 'e' } });
		getCoach().skip();
		// the amber tile opens small e: its fix on the line (rule 7)
		tileOf(board, 'e').click();
		expect(editor.nav.page).toBe('Characters');
		expect(getCoach().line()).toMatchObject({ rule: 7, args: { char: 'e' } });
	});

	it('Show me from a letter still opens the board on Needs a look (leaving never undoes the press)', () => {
		simpleBoard({ checks: true });
		setCoachSource('checks', lookChecks());
		const editor = boardEditor();
		openPage(editor);
		openLetterFromBoard(editor, 'B');
		runCoachAction('showNeedsLook', null, { editor });
		const board = document.querySelector('[data-anyink-board]');
		expect(boardState(board).filter).toBe('needsLook');
		expect(charsOf(board)).toEqual(['e']);
		expect(shownOnBoard()).toBe('needsLook');
	});
});

describe('"+ Numbers & symbols" always shows what it added (critic: shots/46-numbers-added.png)', () => {
	// Written to fail first: on a board filtered to Needs a look the press changed only the counts;
	// the new section stayed behind the filter, so the press looked like it did nothing.
	it('on a board filtered to Needs a look: back to All, the new section scrolled into view and marked', () => {
		simpleBoard({ checks: true });
		setCoachSource('checks', lookChecks());
		const editor = boardEditor();
		const board = openPage(editor);
		board.querySelector('[data-anyink-board-filter="needsLook"]').click();
		expect(charsOf(board)).toEqual(['e']);
		const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
		board.querySelector('[data-anyink-board-tool="numbers"]').click();
		expect(boardState(board).filter).toBe('all');
		expect(charsOf(board)).toHaveLength(80);
		const numbers = section(board, 'numbers');
		expect(numbers).not.toBeNull();
		expect(scrolled.mock.contexts).toContain(numbers);
		expect(numbers.hasAttribute('data-anyink-new')).toBe(true);
		expect(
			board.querySelector('[data-anyink-board-filter="all"]').getAttribute('aria-pressed')
		).toBe('true');
		expect(getBoardFilter(editor)).toBe('all');
		// "- Numbers & symbols" hides it again: nothing to show, nothing scrolled
		scrolled.mockClear();
		board.querySelector('[data-anyink-board-tool="numbers"]').click();
		expect(section(board, 'numbers')).toBeNull();
		expect(scrolled).not.toHaveBeenCalled();
	});

	it("Redo brings the section back into view too; a font that already has it says nothing", () => {
		simpleBoard();
		const editor = boardEditor();
		const board = openPage(editor);
		board.querySelector('[data-anyink-board-tool="numbers"]').click();
		editor.history.restoreState();
		updateBoard(board);
		expect(section(board, 'numbers')).toBeNull();
		const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
		editor.history.redoState();
		updateBoard(board);
		expect(scrolled.mock.contexts).toContain(section(board, 'numbers'));
		// another board on the same font, numbers already there: no mark, no scroll to them
		scrolled.mockClear();
		const again = openPage(editor, 'Overview');
		expect(section(again, 'numbers').hasAttribute('data-anyink-new')).toBe(false);
		return Promise.resolve().then(() => {
			expect(scrolled.mock.contexts).not.toContain(section(again, 'numbers'));
		});
	});

	it('any other way in (the 7 key\'s [Add numbers & symbols]) shows them too, a frame later', async () => {
		simpleBoard({ checks: true });
		setCoachSource('checks', lookChecks());
		const editor = boardEditor();
		const board = openPage(editor);
		board.querySelector('[data-anyink-board-filter="needsLook"]').click();
		const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
		expect(setNumbersShown(editor, true)).toBe(true);
		await vi.waitFor(() => expect(charsOf(board)).toHaveLength(80));
		expect(boardState(board).filter).toBe('all');
		expect(scrolled.mock.contexts).toContain(section(board, 'numbers'));
	});

	it("rule 16's [Add numbers & symbols] in a letter: the board, with the new section in view", async () => {
		simpleBoard();
		const editor = boardEditor();
		openPage(editor);
		openLetterFromBoard(editor, 'B');
		const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
		expect(runCoachAction('addNumbers', null, { editor })).toBe(true);
		expect(editor.nav.page).toBe('Overview');
		const board = document.querySelector('[data-anyink-board]');
		expect(charsOf(board)).toHaveLength(80);
		await Promise.resolve();
		const numbers = section(board, 'numbers');
		expect(scrolled.mock.contexts).toContain(numbers);
		// the new section's place wins over the letter he had open last
		expect(scrolled.mock.contexts.at(-1)).toBe(numbers);
		expect(numbers.hasAttribute('data-anyink-new')).toBe(true);
	});
});

describe('opening letters, and coming back', () => {
	it('a tile press opens its letter with no Undo step', () => {
		simpleBoard();
		const editor = boardEditor();
		const board = openPage(editor);
		const steps = editor.history.queue.length;
		tileOf(board, 'g').click();
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedGlyphID).toBe('glyph-0x67');
		expect(editor.history.queue.length).toBe(steps);
	});

	it('back on the board, that tile has the green ring and is the one tab stop', () => {
		simpleBoard();
		const editor = boardEditor();
		const board = openPage(editor);
		const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
		tileOf(board, 'g').click();
		const back = openPage(editor, 'Overview');
		expect(lastTouchedOnBoard(editor)).toBe('g');
		const ringed = tiles(back).filter((tile) => tile.hasAttribute('last-touched'));
		expect(ringed.map((tile) => tile.getAttribute('data-anyink-char'))).toEqual(['g']);
		const stops = tiles(back).filter((tile) => tile.getAttribute('tabindex') === '0');
		expect(stops.map((tile) => tile.getAttribute('data-anyink-char'))).toEqual(['g']);
		return Promise.resolve().then(() => {
			expect(scrolled.mock.contexts.some((tile) => tile === tileOf(back, 'g'))).toBe(true);
		});
	});

	it('a letter opened any other way (the Next line, the letter view) is touched when he leaves it', () => {
		simpleBoard();
		const editor = boardEditor();
		openPage(editor);
		installBoard();
		editor.selectedGlyphID = 'glyph-0x6B';
		openPage(editor, 'Characters');
		const back = openPage(editor, 'Overview');
		expect(tileOf(back, 'k').hasAttribute('last-touched')).toBe(true);
	});

	it('a new font has no ring, and its first tile is the tab stop', () => {
		simpleBoard();
		const board = openPage(boardEditor({ seed: false }));
		expect(tiles(board).filter((tile) => tile.hasAttribute('last-touched'))).toHaveLength(0);
		const stops = tiles(board).filter((tile) => tile.getAttribute('tabindex') === '0');
		expect(stops.map((tile) => tile.getAttribute('data-anyink-char'))).toEqual(['A']);
	});
});

describe('keeping up', () => {
	it('a change draws that tile again; the other 57 tiles stay the same elements', () => {
		simpleBoard();
		const editor = boardEditor();
		const board = openPage(editor);
		const before = new Map(
			tiles(board).map((tile) => [tile.getAttribute('data-anyink-char'), tile])
		);
		const quietTiles = tiles(board).filter((tile) => tile.getAttribute('data-anyink-char') !== 'B');
		const changed = [];
		const watcher = new MutationObserver((records) =>
			records.forEach((record) => changed.push(record.target))
		);
		quietTiles.forEach((tile) => watcher.observe(tile, { attributes: true }));
		addLetter(editor.project, 'm', [square()]);
		updateBoard(board);
		watcher.takeRecords().forEach((record) => changed.push(record.target));
		watcher.disconnect();
		expect(progress(board)).toBe('8 of 58 ready');
		expect(tileOf(board, 'm').getAttribute('session-state')).toBe('ready');
		// every tile is the element it was (made once, changed in place)
		tiles(board).forEach((tile) =>
			expect(tile).toBe(before.get(tile.getAttribute('data-anyink-char')))
		);
		const touched = [...new Set(changed.map((t) => t.getAttribute('data-anyink-char')))];
		expect(touched.sort()).toEqual(['m']);
	});

	it('drawing again with nothing changed touches nothing on the page', () => {
		simpleBoard();
		const board = openPage(boardEditor());
		const watcher = new MutationObserver(() => {});
		watcher.observe(board, {
			attributes: true,
			childList: true,
			subtree: true,
			characterData: true,
		});
		updateBoard(board);
		updateBoard(board);
		expect(watcher.takeRecords()).toEqual([]);
		watcher.disconnect();
	});

	it('Undo on the board stays on the board, and the board follows it', () => {
		simpleBoard();
		const editor = boardEditor();
		openPage(editor);
		const board = drawOn(editor, 'm');
		expect(progress(board)).toBe('8 of 58 ready');
		const navigate = vi.spyOn(editor, 'navigate');
		editor.history.restoreState();
		expect(editor.nav.page).toBe('Overview');
		expect(navigate).not.toHaveBeenCalled();
		updateBoard(board);
		expect(progress(board)).toBe('7 of 58 ready');
		expect(tileOf(board, 'm').getAttribute('session-state')).toBe('empty');
		expect(document.querySelector('[data-anyink-board]')).toBe(board);
		expect(text(document.querySelector('.anyink-topbar__step-count'))).toBe('7/58');
	});

	it('a change is drawn a frame later without being asked (the save status, every step)', async () => {
		simpleBoard();
		const editor = boardEditor();
		openPage(editor);
		const board = drawOn(editor, 'm');
		editor.history.restoreState();
		await vi.waitFor(() => expect(progress(board)).toBe('7 of 58 ready'));
	});

	it('drawing again after a change takes under 16 ms (one frame) for 58 tiles', () => {
		simpleBoard();
		const editor = boardEditor();
		const board = openPage(editor);
		const times = [];
		const letter = addLetter(editor.project, 'm', []);
		for (let round = 0; round < 12; round++) {
			letter.shapes = round % 2 ? [] : [square(round * 10)];
			times.push(updateBoard(board));
		}
		times.sort((a, b) => a - b);
		const median = times[Math.floor(times.length / 2)];
		console.info(
			`board redraw after a change: median ${median.toFixed(2)} ms, worst ${times
				.at(-1)
				.toFixed(2)} ms`
		);
		expect(median).toBeLessThan(16);
		expect(boardState(board).ms).toBeGreaterThan(0);
	});
});

describe('a finished section says so once', () => {
	const done = () => toastLog().filter((t) => t.key === 'board.toast.punctuationDone');

	it('"All punctuation done." when the last one is made; Undo and Redo say nothing more', () => {
		simpleBoard();
		const editor = boardEditor();
		[...".,'?!"].forEach((char) => addLetter(editor.project, char, [square()]));
		openPage(editor);
		expect(done()).toHaveLength(0);
		let board = drawOn(editor, '-');
		updateBoard(board);
		expect(done()).toHaveLength(1);
		expect(done()[0].text).toBe('All punctuation done.');
		editor.history.restoreState();
		updateBoard(board);
		editor.history.redoState();
		board = openPage(editor, 'Overview');
		updateBoard(board);
		expect(done()).toHaveLength(1);
	});

	it('the first look at a font with a finished section says nothing', () => {
		simpleBoard();
		const editor = boardEditor({ seed: false });
		[...'abcdefghijklmnopqrstuvwxyz'].forEach((char) =>
			addLetter(editor.project, char, [square()])
		);
		const board = openPage(editor);
		updateBoard(board);
		expect(section(board, 'small').hasAttribute('data-done')).toBe(true);
		expect(toastLog().filter((t) => t.key === 'board.toast.smallDone')).toHaveLength(0);
	});

	it('the small letters: "Your font can type words now."', () => {
		simpleBoard();
		const editor = boardEditor({ seed: false });
		[...'abcdefghijklmnopqrstuvwxy'].forEach((char) => addLetter(editor.project, char, [square()]));
		openPage(editor);
		drawOn(editor, 'z');
		const said = toastLog().filter((t) => t.key === 'board.toast.smallDone');
		expect(said.map((t) => t.text)).toEqual([
			'All small letters done. Your font can type words now.',
		]);
	});
});

describe("the Next line's other board button", () => {
	it('rule 16 [Add numbers & symbols] adds the section as one settings step', () => {
		simpleBoard();
		const editor = boardEditor();
		const board = openPage(editor);
		const steps = editor.history.queue.length;
		expect(runCoachAction('addNumbers', null, { editor })).toBe(true);
		expect(charsOf(board)).toHaveLength(80);
		expect(editor.history.queue.length).toBe(steps + 1);
	});
});
