// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 board-page: the board's filters (UX-BEGINNER.md 4.2 Filters).
	  - All / Needs a look / Empty, shown only with B11's 'checks' on and once a letter needs a
	    look (section 10 B10 stub: "until B11 turns on checks ... the filters stay hidden")
	  - while hidden, every letter shows ('all'), whatever was picked
	  - the pick is remembered per font for the session, never in the font; a font opened into
	    the same editor (a new History) starts on All
	  - the "Show:" row: one outlined button per filter, aria-pressed on the one in effect
	  - under "Needs a look", a tile's reason and its fix, outlined, with Looks fine to me; a fix
	    runs the check's own action the way the Next line's rule 7 does
	Written before filters.js existed (red: the module was missing).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flagsOn } from '../../mode/features.js';
import { History } from '../../../project_editor/history.js';
import {
	endBoardFilter,
	FILTERS,
	filterOptions,
	filtersShown,
	getBoardFilter,
	makeFilterBar,
	makeLookFixes,
	resetFiltersForTests,
	setBoardFilter,
	settleBoardFilter,
	shownFilter,
	tileShows,
} from '../filters.js';
import { boardFacts, boardSummary } from '../progress.js';
import { boardEditor, boardProject, LOOK, lookChecks } from './board_font.js';

beforeEach(() => resetFiltersForTests());
afterEach(() => {
	document.body.innerHTML = '';
});

const looking = () =>
	boardSummary(boardFacts(boardProject(), { checks: lookChecks(), checksOn: true }));
const none = () => boardSummary(boardFacts(boardProject()));

describe('when the filters show', () => {
	it('only with checks on and a letter that needs a look', () => {
		expect(FILTERS).toEqual(['all', 'needsLook', 'empty']);
		expect(filtersShown(looking(), flagsOn('board'))).toBe(false);
		expect(filtersShown(none(), flagsOn('board', 'checks'))).toBe(false);
		expect(filtersShown(looking(), flagsOn('board', 'checks'))).toBe(true);
	});

	it('hidden, the board shows every letter, whatever was picked', () => {
		expect(shownFilter('needsLook', looking(), flagsOn('board'))).toBe('all');
		expect(shownFilter('empty', none(), flagsOn('board', 'checks'))).toBe('all');
		expect(shownFilter('needsLook', looking(), flagsOn('board', 'checks'))).toBe('needsLook');
		expect(shownFilter('nonsense', looking(), flagsOn('board', 'checks'))).toBe('all');
	});

	it('which tiles each filter shows', () => {
		expect(['ready', 'needsLook', 'empty'].filter((s) => tileShows('all', s))).toHaveLength(3);
		expect(['ready', 'needsLook', 'empty'].filter((s) => tileShows('needsLook', s))).toEqual([
			'needsLook',
		]);
		expect(['ready', 'needsLook', 'empty'].filter((s) => tileShows('empty', s))).toEqual(['empty']);
	});

	it('their counts: All 58, Needs a look 1, Empty 51', () => {
		expect(filterOptions(looking())).toEqual([
			{ id: 'all', key: 'board.filter.all', count: 58 },
			{ id: 'needsLook', key: 'board.filter.needsLook', count: 1 },
			{ id: 'empty', key: 'board.filter.empty', count: 51 },
		]);
	});
});

describe('the pick', () => {
	it('is remembered per font for the session; a font opened into the editor starts on All', () => {
		const editor = boardEditor();
		expect(getBoardFilter(editor)).toBe('all');
		expect(setBoardFilter(editor, 'needsLook')).toBe(true);
		expect(setBoardFilter(editor, 'needsLook')).toBe(false);
		expect(getBoardFilter(editor)).toBe('needsLook');
		expect(setBoardFilter(editor, 'sideways')).toBe(false);
		// never in the font, never a step
		expect(JSON.stringify(editor.project.save())).not.toContain('needsLook');
		expect(editor.history.queue).toHaveLength(0);
		// another font in the same editor: a new History (as Ctrl+O and a backup restore make)
		editor.history = new History();
		expect(getBoardFilter(editor)).toBe('all');
	});
});

describe('the pick never outlives the filters (critic: "Needs a look" stuck)', () => {
	// Written to fail first: settleBoardFilter and endBoardFilter didn't exist, and a pick was
	// kept for the session, so a later amber letter brought the board back filtered to it alone.
	it('ends when the filters hide: no letter needs a look, or the checks are off', () => {
		const editor = boardEditor();
		setBoardFilter(editor, 'needsLook');
		// a letter still needs a look: the pick stays
		expect(settleBoardFilter(editor, looking(), flagsOn('board', 'checks'))).toBe(false);
		expect(getBoardFilter(editor)).toBe('needsLook');
		// he said Looks fine to me on the last one: the filters hide, the pick ends
		expect(settleBoardFilter(editor, none(), flagsOn('board', 'checks'))).toBe(true);
		expect(getBoardFilter(editor)).toBe('all');
		// so a later amber letter finds the board on All
		expect(shownFilter(getBoardFilter(editor), looking(), flagsOn('board', 'checks'))).toBe('all');
		// 'checks' off hides them too; Empty ends the same way
		setBoardFilter(editor, 'empty');
		expect(settleBoardFilter(editor, looking(), flagsOn('board'))).toBe(true);
		expect(getBoardFilter(editor)).toBe('all');
		// nothing picked: nothing to end
		expect(settleBoardFilter(editor, none(), flagsOn('board', 'checks'))).toBe(false);
	});

	it('ends when he leaves the board (endBoardFilter); never a step, never in the font', () => {
		const editor = boardEditor();
		expect(endBoardFilter(editor)).toBe(false);
		setBoardFilter(editor, 'needsLook');
		expect(endBoardFilter(editor)).toBe(true);
		expect(getBoardFilter(editor)).toBe('all');
		expect(editor.history.queue).toHaveLength(0);
		expect(endBoardFilter(null)).toBe(false);
	});
});

describe('the "Show:" row', () => {
	it('one outlined button per filter, the one in effect pressed', () => {
		const picked = [];
		const bar = makeFilterBar(looking(), 'needsLook', (id) => picked.push(id));
		document.body.appendChild(bar);
		expect(bar.getAttribute('role')).toBe('group');
		expect(bar.textContent).toContain('Show:');
		const buttons = [...bar.querySelectorAll('button')];
		expect(buttons.map((b) => b.textContent)).toEqual(['All 58', 'Needs a look 1', 'Empty 51']);
		expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
		expect(bar.querySelector('.anyink-primary')).toBeNull();
		buttons[2].click();
		expect(picked).toEqual(['empty']);
	});
});

describe('a tile under "Needs a look"', () => {
	it('shows the reason, the fix and Looks fine to me, outlined', () => {
		const run = vi.fn();
		const part = makeLookFixes({ char: 'e', needsLook: LOOK }, run);
		document.body.appendChild(part);
		expect(part.querySelector('.anyink-board__reason').textContent).toBe(LOOK.reason);
		const buttons = [...part.querySelectorAll('button')];
		expect(buttons.map((b) => b.textContent)).toEqual(['Sit on the line', 'Looks fine to me']);
		expect(part.querySelector('.anyink-primary')).toBeNull();
		expect(part.querySelector('[role="group"]').getAttribute('aria-label')).toBe(
			'Fixes for small e'
		);
		buttons[0].click();
		expect(run).toHaveBeenLastCalledWith('fixLetter', { char: 'e', check: 'line' });
		buttons[1].click();
		expect(run).toHaveBeenLastCalledWith('looksFine', { char: 'e', check: 'line' });
	});

	it("a check's own action and args, as the Next line runs them; no look, no part", () => {
		const run = vi.fn();
		const look = { ...LOOK, action: 'fitLines', args: { line: 'xHeight' } };
		makeLookFixes({ char: 'e', needsLook: look }, run).querySelector('button').click();
		expect(run).toHaveBeenCalledWith('fitLines', { char: 'e', check: 'line', line: 'xHeight' });
		expect(makeLookFixes({ char: 'e', needsLook: null }, run)).toBeNull();
		// a check with no fix of its own still offers Looks fine to me
		const only = makeLookFixes({ char: 'e', needsLook: { id: 'x', reason: 'Odd.' } }, run);
		expect([...only.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
			'Looks fine to me',
		]);
	});

	it("a press on a fix isn't a press on the tile", () => {
		const onTile = vi.fn();
		const tile = document.createElement('div');
		tile.addEventListener('click', onTile);
		tile.appendChild(makeLookFixes({ char: 'e', needsLook: LOOK }, () => {}));
		document.body.appendChild(tile);
		tile.querySelector('button').click();
		expect(onTile).not.toHaveBeenCalled();
	});
});
