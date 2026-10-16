// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 finalize: the seams the fix tracks' verifiers found still open, each on one Simple
	screen as the app draws it (UX-BEGINNER.md 4.0, 4.2, 4.3, 7.2, 7.3, principles 1 and 6):
	  one rule     the rail's count, the letter card's chip, the empty overlay and the Next line
	               read one rule for ink and empty (board/letter_set.js): the shape the Point pen
	               is still drawing is no ink anywhere, and a stray line makes a letter neither
	               Ready nor empty
	  leaving      leaving the letter view, or opening another letter, mid-shape ends the shape
	               on the letter it was in: finished from 3 points, taken away below (one step,
	               a toast that says so); "Finish the shape" below 3 points does the same
	  the line     mid-shape the Next line keeps to the drawing, even when another letter has a
	               font problem
*/
import { describe, expect, it } from 'vitest';
import { removeStopCreatingNewPathButton } from '../../../edit_canvas/tools/new_path.js';
import { deriveEditorState } from '../../coach/font_facts.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { runFontCheckNow } from '../../fontcheck/font_check.js';
import { word } from '../../words/words.js';
import { goToLetters } from '../../topbar/letters_page.js';
import {
	letterPage,
	nextButton,
	nextSentence,
	penClick,
	q,
	railText,
	settle,
	setUpScreenTests,
	shownEl,
	shownText,
	square,
} from './simple_screen.js';
import { Path } from '../../../project_data/path.js';

setUpScreenTests();

const SMALL_A = 'glyph-0x61';
const SMALL_B = 'glyph-0x62';
const pen = (editor) => editor.eventHandlers.tool_addPath;
const finishButton = () => q('#done-creating-path-button');
const cardState = () => q('.anyink-letter-card')?.dataset.anyinkCardState || null;
const overlayShown = () => shownEl(q('[data-anyink-overlay]'));
/** The rail's ready count now (the sample font has letters with ink already) */
const ready = () => Number(/(\d+)\/\d+/.exec(railText())?.[1] ?? NaN);
const corners = [
	[0, 0],
	[400, 0],
	[400, 500],
	[0, 500],
];

describe('one rule for ink and empty (rail, card, overlay, Next line)', () => {
	it('three points still open: the rail still says 0, the card Empty, the line says to close it', async () => {
		const editor = letterPage();
		await settle();
		const before = ready();
		penClick(editor, corners[0]);
		penClick(editor, corners[1]);
		penClick(editor, corners[2]);
		await settle();
		expect(pen(editor).newPath).toBeTruthy();
		expect(ready()).toBe(before);
		expect(cardState()).toBe('empty');
		expect(nextSentence()).toBe(
			word('coach.rule.closeShape', { button: word('letterTools.finishShape') })
		);
	});

	it('the shape finished with its button: the rail counts the letter at once', async () => {
		const editor = letterPage();
		await settle();
		const before = ready();
		corners.forEach((corner) => penClick(editor, corner));
		removeStopCreatingNewPathButton();
		await settle();
		expect(pen(editor).newPath).toBe(false);
		expect(ready()).toBe(before + 1);
		expect(cardState()).toBe('ready');
	});

	it('a stray line left in a letter: card Empty, no overlay, rail 0; the Next line names the shape', async () => {
		const editor = letterPage();
		await settle();
		const before = ready();
		const corner = (x, y) => ({ p: { coord: { x, y } } });
		editor.selectedItem.addOneShape(new Path({ name: 'Line', pathPoints: [corner(0, 0), corner(300, 0)] }));
		editor.history.addState('drew a line');
		editor.publish('currentItem', editor.selectedItem);
		runFontCheckNow(editor);
		await settle();
		expect(cardState()).toBe('empty');
		expect(overlayShown()).toBe(false);
		expect(ready()).toBe(before);
		expect(nextSentence()).toMatch(/^small a has a shape with only 2 points/);
		// with no overlay, the line's own button is the green one
		expect(nextButton()?.classList.contains('anyink-primary')).toBe(true);
	});

	it('on the board, a letter whose shape is still open is no ink to the Next line', () => {
		const editor = letterPage({ id: SMALL_B });
		corners.slice(0, 3).forEach((corner) => penClick(editor, corner));
		editor.nav.page = 'Overview'; // as the coach reads it, before anything else runs
		const state = deriveEditorState(editor);
		expect(state.letters.find((letter) => letter.char === 'b').ink).toBe(false);
	});
});

describe('leaving mid-shape ends the shape on its own letter', () => {
	it('"<- All letters" with 3 points: the shape is finished, the button gone, the pen let go', async () => {
		const editor = letterPage();
		await settle();
		const before = ready();
		corners.slice(0, 3).forEach((corner) => penClick(editor, corner));
		goToLetters(editor);
		await settle();
		expect(editor.nav.page).toBe('Overview');
		expect(pen(editor).newPath).toBe(false);
		expect(finishButton()).toBeNull();
		expect(editor.project.getItem(SMALL_A).shapes.map((shape) => shape.pathPoints.length)).toEqual([3]);
		expect(ready()).toBe(before + 1);
	});

	it('"<- All letters" with 2 points: the shape is taken away, as one step, and a toast says so', async () => {
		const editor = letterPage();
		penClick(editor, corners[0]);
		penClick(editor, corners[1]);
		const steps = editor.history.queue.length;
		goToLetters(editor);
		await settle();
		expect(pen(editor).newPath).toBe(false);
		expect(editor.project.getItem(SMALL_A).shapes).toHaveLength(0);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].itemID).toBe(SMALL_A);
		expect(shownText()).toBe(word('letterTools.droppedShapeOn', { letter: 'small a' }));
	});

	it('another letter opened with 2 points: taken away on the letter it was in', () => {
		const editor = letterPage();
		penClick(editor, corners[0]);
		penClick(editor, corners[1]);
		editor.selectedGlyphID = SMALL_B;
		expect(pen(editor).newPath).toBe(false);
		expect(editor.project.getItem(SMALL_A).shapes).toHaveLength(0);
		expect(editor.history.queue[0]).toMatchObject({
			itemID: SMALL_A,
			title: word('history.removedStray', { count: 1, letter: 'small a' }),
		});
	});

	it('"Finish the shape" with 2 points: taken away, the letter is empty again, and a toast says why', async () => {
		const editor = letterPage();
		penClick(editor, corners[0]);
		penClick(editor, corners[1]);
		removeStopCreatingNewPathButton();
		await settle();
		expect(editor.selectedItem.shapes).toHaveLength(0);
		expect(shownText()).toBe(word('letterTools.droppedShape'));
		expect(cardState()).toBe('empty');
		// a whole-number width, never one Finish set with no step (principle 5)
		expect(Number.isInteger(editor.selectedItem.advanceWidth)).toBe(true);
	});
});

describe('a finished shape with no area: a whole-number width (principle 5)', () => {
	it('three points in a row, finished with its button: the width it gets is whole', () => {
		const editor = letterPage();
		editor.project.settings.app.autoRightBearingOnFirstShape = 20;
		editor.selectedItem.advanceWidth = 0;
		penClick(editor, [0.4, 0]);
		penClick(editor, [150.3, 0]);
		penClick(editor, [300.7, 0]);
		removeStopCreatingNewPathButton();
		expect(editor.selectedItem.advanceWidth).toBeGreaterThan(0);
		expect(Number.isInteger(editor.selectedItem.advanceWidth)).toBe(true);
	});
});

describe('mid-shape, the Next line keeps to the drawing', () => {
	it("another letter's font problem waits until the shape is finished", async () => {
		const editor = letterPage({ id: SMALL_B });
		const corner = (x, y) => ({ p: { coord: { x, y } } });
		editor.selectedItem.addOneShape(new Path({ name: 'Dot', pathPoints: [corner(10, 10)] }));
		editor.history.addState('drew a dot');
		editor.selectedGlyphID = SMALL_A;
		editor.navigate();
		editor.view = { dx: 300, dy: 700, dz: 1 };
		corners.slice(0, 3).forEach((corner) => penClick(editor, corner));
		runFontCheckNow(editor);
		await settle();
		expect(nextSentence()).toBe(
			word('coach.rule.closeShape', { button: word('letterTools.finishShape') })
		);
		expect(nextButton()).toBeNull();
	});
});

describe('one green button on Help and About (principle 1)', () => {
	it.each(['About', 'Help'])(
		'%s: the page has the green "Back to my letters"; the Next line has an outlined one',
		async (page) => {
		letterPage({ page });
		await settle();
		const greenNow = [...document.querySelectorAll('.anyink-primary, fancy-button:not([secondary]):not([minimal]):not([danger]):not([disabled])')]
			.filter(shownEl)
			.filter((el) => !(el.closest('anyink-coach') && !el.classList.contains('anyink-primary')));
		expect(greenNow.map((el) => el.textContent.trim())).toEqual([word('mode.band.backToLetters')]);
		const button = nextButton();
		expect(button).not.toBeNull();
			expect(button.classList.contains('anyink-primary')).toBe(false);
		}
	);
});

describe('every square counts once its shape is finished (a guard)', () => {
	it('a square added in a step: Ready, rail 1, no overlay', async () => {
		// B10 + B11 integration: the guard is about ink; a 400-unit square on small a is also too
		// short for the checks, which this test leaves out
		setFeaturesForTests({ checks: false });
		const editor = letterPage();
		await settle();
		const before = ready();
		editor.selectedItem.addOneShape(square(100, 0, 400));
		editor.history.addState('drew a square');
		editor.publish('currentItem', editor.selectedItem);
		await settle();
		expect(cardState()).toBe('ready');
		expect(ready()).toBe(before + 1);
		expect(overlayShown()).toBe(false);
	});
});
