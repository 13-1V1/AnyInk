// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 board-tiles: the board's letter set (UX-BEGINNER.md 4.2 "Letter set" and Toolbar, 7.3):
	  - the board's order lives in board/letter_set.js; the letter header re-exports the same one
	  - the sections: CAPITALS, SMALL LETTERS, PUNCTUATION, then NUMBERS & SYMBOLS once added
	  - "+ Numbers & symbols" is ONE settings Undo step ("added numbers & symbols"); Undo takes it
	    back and Redo puts it back; the font's letters and character ranges never change
	  - "- Numbers & symbols" only hides: the letters stay, one settings step, and Simple says so
	    with an Undo toast ("Hid numbers & symbols. Your letters are kept." [Undo])
	  - Undo on the board stays on the board
	Written before the code: boardSections, numbersShown, setNumbersShown and toggleNumbers did not
	exist, and boardOrder was the letter header's.
*/
import { describe, expect, it } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { word } from '../../words/words.js';
import { letterPage, setUpScreenTests, showing, shownText } from '../../letter/tests/simple_screen.js';
import { boardOrder as headerBoardOrder } from '../../letter/letter_header.js';
import {
	BOARD_SECTIONS,
	boardOrder,
	boardSections,
	numbersShown,
	NUMBERS_SET,
	QUICK_SET,
	setNumbersShown,
	toggleNumbers,
} from '../letter_set.js';

setUpScreenTests();

const corner = (x, y) => ({ p: { coord: { x, y } } });
const square = () =>
	new Path({ name: 'Ink', pathPoints: [corner(0, 0), corner(400, 0), corner(400, 400), corner(0, 400)] });

/** The board (the Overview) in Simple with 'board' on */
function onTheBoard(mode = 'simple') {
	setFeaturesForTests({ board: true });
	return letterPage({ mode, page: 'Overview' });
}

describe('the board order and its sections', () => {
	it('boardOrder is the board\'s, and the letter header re-exports the same one', () => {
		expect(headerBoardOrder).toBe(boardOrder);
		expect(boardOrder({ settings: {} })).toEqual([...QUICK_SET]);
		expect(boardOrder({ settings: { anyink: { letterSet: 'quick+numbers' } } })).toEqual([
			...QUICK_SET,
			...NUMBERS_SET,
		]);
	});

	it('three sections on a new font (26, 26, 6); numbers & symbols add a fourth (22)', () => {
		const quick = boardSections({ settings: { anyink: {} } });
		expect(quick.map((s) => s.id)).toEqual(['capitals', 'small', 'punctuation']);
		expect(quick.map((s) => s.letters.length)).toEqual([26, 26, 6]);
		const all = boardSections({ settings: { anyink: { letterSet: 'quick+numbers' } } });
		expect(all.map((s) => s.id)).toEqual(['capitals', 'small', 'punctuation', 'numbers']);
		expect(all[3].letters).toEqual(NUMBERS_SET);
		// the sections, laid end to end, are the board's order
		expect(BOARD_SECTIONS.flatMap((s) => s.letters)).toEqual(
			boardOrder({ settings: { anyink: { letterSet: 'quick+numbers' } } })
		);
	});
});

describe('"+ Numbers & symbols" is one settings Undo step', () => {
	it('adds the section in one step; Undo takes it back, Redo puts it back; no letter changes', () => {
		const editor = onTheBoard();
		const glyphs = Object.keys(editor.project.glyphs).sort();
		const ranges = JSON.stringify(editor.project.settings.project.characterRanges);
		const steps = editor.history.queue.length;

		expect(numbersShown(editor.project)).toBe(false);
		expect(setNumbersShown(editor, true)).toBe(true);
		expect(numbersShown(editor.project)).toBe(true);
		expect(editor.history.queue.length).toBe(steps + 1);
		const step = editor.history.queue[0];
		expect(step.settingsSave).toBe(true);
		expect(step.title).toBe(word('boardTile.step.addNumbers'));
		expect(step.title).toBe('added numbers & symbols');
		expect(Object.keys(editor.project.glyphs).sort()).toEqual(glyphs);
		expect(JSON.stringify(editor.project.settings.project.characterRanges)).toBe(ranges);
		expect(boardOrder(editor.project)).toHaveLength(80);

		// already on: nothing to do, no second step
		expect(setNumbersShown(editor, true)).toBe(false);
		expect(editor.history.queue.length).toBe(steps + 1);

		editor.history.restoreState();
		expect(numbersShown(editor.project)).toBe(false);
		expect(boardOrder(editor.project)).toHaveLength(58);
		// Undo on the board stays on the board
		expect(editor.nav.page).toBe('Overview');

		editor.history.redoState();
		expect(numbersShown(editor.project)).toBe(true);
		expect(editor.nav.page).toBe('Overview');
	});

	it('"- Numbers & symbols" only hides: the letters stay, one step, an Undo toast that brings it back', () => {
		const editor = onTheBoard();
		setNumbersShown(editor, true);
		// number 7 made while the section showed
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x37';
		const seven = editor.selectedGlyph;
		seven.addOneShape(square());
		editor.history.addState('drew number 7');
		editor.nav.page = 'Overview';
		const steps = editor.history.queue.length;

		expect(toggleNumbers(editor)).toBe(true);
		expect(numbersShown(editor.project)).toBe(false);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('hid numbers & symbols');
		// never deletes a letter
		expect(editor.project.getItem('glyph-0x37')?.shapes).toHaveLength(1);

		expect(shownText()).toBe(word('boardTile.toast.numbersHidden'));
		const undo = showing().querySelector('button');
		expect(undo.textContent).toBe(word('letter.toast.undo'));
		undo.click();
		expect(numbersShown(editor.project)).toBe(true);
		expect(editor.project.getItem('glyph-0x37')?.shapes).toHaveLength(1);
		expect(editor.nav.page).toBe('Overview');
	});

	it('All tools: the same one step, and no toast', () => {
		const editor = onTheBoard('all');
		setNumbersShown(editor, true);
		const steps = editor.history.queue.length;
		setNumbersShown(editor, false);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(showing()).toBeNull();
	});
});
