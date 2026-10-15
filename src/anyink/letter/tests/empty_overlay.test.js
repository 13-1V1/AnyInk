// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 empty-letter overlay (UX-BEGINNER.md 4.3 "Empty letter"): one box in the middle of an empty
	letter's canvas says the letter is empty and holds the screen's one green button (principle 1;
	the card has no buttons of its own then). Until B8 and B9 turn on 'brush' and 'photo' it offers
	only "Draw it with points", which picks the Point pen (a Fine-tune tool, so Fine-tune opens,
	7.6). It goes once the letter has a shape, and while a shape tool is picked.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { flagsOn, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showWordsError } from '../../words/error_box.js';
import { word } from '../../words/words.js';
import { makeEmptyOverlay, overlayButtons, overlayShows } from '../empty_overlay.js';
import { makeLetterCard, resetLetterCardForTests } from '../letter_card.js';
import { isFineTuneOpen, resetLetterViewForTests } from '../view_switches.js';

const square = () =>
	new Path({
		name: 'Square',
		pathPoints: [
			{ p: { coord: { x: 100, y: 0 } } },
			{ p: { coord: { x: 500, y: 0 } } },
			{ p: { coord: { x: 500, y: 400 } } },
			{ p: { coord: { x: 100, y: 400 } } },
		],
	});

function openB({ simple = true, letterView = true } = {}) {
	setModeForTests(simple ? 'simple' : 'all');
	setFeaturesForTests({ letterView });
	const editor = twoLetterEditor();
	editor.selectedGlyphID = B;
	editor.selectedGlyph;
	editor.selectedTool = 'resize';
	return editor;
}

const overlay = () => document.querySelector('[data-anyink-overlay]');
const shown = () => !!overlay() && !overlay().hidden;
const greens = () => [...document.querySelectorAll('.anyink-primary')];

beforeEach(() => {
	resetLetterViewForTests();
	resetLetterCardForTests();
});
afterEach(() => {
	document.body.innerHTML = '';
});

describe('what the overlay offers', () => {
	it('before the brush and photos: only "Draw it with points"', () => {
		expect(overlayButtons(flagsOn())).toEqual(['drawPoints']);
	});

	it('the brush, once B8 lands, takes its place', () => {
		expect(overlayButtons(flagsOn('brush'))).toEqual(['drawBrush']);
	});
});

describe('the overlay on an empty letter', () => {
	it('says the letter is empty and holds the one green button', () => {
		const editor = openB();
		document.body.appendChild(makeLetterCard(editor));
		document.body.appendChild(makeEmptyOverlay(editor));
		expect(shown()).toBe(true);
		expect(overlay().textContent).toContain(word('letter.overlay.empty', { name: 'Capital B' }));
		expect(greens().map((button) => button.textContent.trim())).toEqual([
			word('letter.overlay.drawPoints'),
		]);
	});

	it('"Draw it with points" picks the Point pen and opens Fine-tune; the overlay steps aside', () => {
		const editor = openB();
		document.body.appendChild(makeEmptyOverlay(editor));
		document.querySelector('[data-anyink-overlay-action="drawPoints"]').click();
		expect(editor.selectedTool).toBe('newPath');
		expect(isFineTuneOpen()).toBe(true);
		expect(shown()).toBe(false);
		// back to Select on the still-empty letter: the overlay is back
		editor.selectedTool = 'resize';
		editor.publish('whichToolIsSelected', 'resize');
		expect(shown()).toBe(true);
	});

	it('goes once the letter has a shape', () => {
		const editor = openB();
		document.body.appendChild(makeEmptyOverlay(editor));
		editor.selectedItem.addOneShape(square());
		editor.publish('currentItem', editor.selectedItem);
		expect(shown()).toBe(false);
	});

	it('follows the open letter: another empty letter, its own name', () => {
		const editor = openB();
		document.body.appendChild(makeEmptyOverlay(editor));
		editor.selectedGlyphID = 'glyph-0x72';
		expect(overlay().textContent).toContain(word('letter.overlay.empty', { name: 'small r' }));
	});

	it('never shows in All tools or before the letter view lands', () => {
		expect(overlayShows(openB({ simple: false }))).toBe(false);
		expect(overlayShows(openB({ letterView: false }))).toBe(false);
		expect(overlayShows(openB())).toBe(true);
	});
});

// B6 + B7 fix pass (letter-card track)
describe('one green button, even with a dialog open (fix: two showed under the Fix box)', () => {
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
	const overlayButton = () => document.querySelector('[data-anyink-overlay-action]');

	it("a dialog over the empty letter takes the green: the overlay's button is outlined until it closes", async () => {
		const editor = openB();
		document.body.appendChild(makeEmptyOverlay(editor));
		await settle();
		expect(overlayButton().classList.contains('anyink-primary')).toBe(true);
		// the save pill's [Fix] opens Simple's error box (#error) with its own first button
		const box = showWordsError(
			{ key: 'error.saveFailed', vars: { file: 'Brennan Hand.gs2' }, buttons: ['error.button.tryAgain'] },
			{}
		);
		await settle();
		expect(shown()).toBe(true);
		expect(overlayButton().classList.contains('anyink-primary')).toBe(false);
		expect(overlayButton().classList.contains('anyink-outlined')).toBe(true);
		expect(greens().filter((button) => !box.contains(button))).toEqual([]);
		// closing the box gives the green back
		box.remove();
		await settle();
		expect(overlayButton().classList.contains('anyink-primary')).toBe(true);
		expect(greens()).toHaveLength(1);
	});

	it('an overlay drawn while a dialog is already open starts outlined', async () => {
		const editor = openB();
		const dialog = document.createElement('div');
		dialog.setAttribute('data-anyink-dialog', 'howCard');
		document.body.appendChild(dialog);
		document.body.appendChild(makeEmptyOverlay(editor));
		await settle();
		expect(greens()).toEqual([]);
	});
});

describe('the overlay follows the ink, as the card does (fix: one Point pen click made it Ready)', () => {
	// B6 + B7 finalize (verdict: "the card says Empty and the overlay says 'is empty' while the
	// card lists Shape 1 and the Next line names it"): one rule (board/letter_set.js): a stray
	// line is no ink (the card's chip says Empty) but it is a finished shape, so the letter isn't
	// empty: the overlay steps aside and the Next line's [Fix it] for it is the green button
	it('a letter whose only shape is a finished stray line: the overlay steps aside', () => {
		const editor = openB();
		editor.selectedItem.addOneShape(
			new Path({
				name: 'Line',
				pathPoints: [{ p: { coord: { x: 100, y: 100 } } }, { p: { coord: { x: 300, y: 100 } } }],
			})
		);
		document.body.appendChild(makeEmptyOverlay(editor));
		expect(shown()).toBe(false);
	});

	it('while the Point pen is drawing the first shape it stays aside (the tool is picked)', () => {
		const editor = openB();
		const open = editor.selectedItem.addOneShape(
			new Path({ name: 'Path 1', pathPoints: [{ p: { coord: { x: 100, y: 100 } } }] })
		);
		editor.eventHandlers.tool_addPath = { newPath: open };
		editor.selectedTool = 'newPath';
		document.body.appendChild(makeEmptyOverlay(editor));
		expect(shown()).toBe(false);
	});
});
