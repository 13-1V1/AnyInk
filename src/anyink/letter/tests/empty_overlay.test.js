// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 empty-letter overlay (UX-BEGINNER.md 4.3 "Empty letter"): one box in the middle of an empty
	letter's canvas says the letter is empty and holds the screen's one green button (principle 1;
	the card has no buttons of its own then). It goes once the letter has a shape, and while a
	shape tool is picked. B8 + B9 finalize: the suite runs with the flags as the app ships them
	('brush' and 'photo' on: [Use a photo] or [Use the same photo] first); only the B7 button
	"Draw it with points" (shown while 'brush' is off) pins the flags off, as the gate it tests.
	A photo he said he is done with never makes [Use the same photo] the green button (second
	hostile pass: after Done with this photo it still led on to trace another of its parts).
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { flagsOn, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showWordsError } from '../../words/error_box.js';
import { word } from '../../words/words.js';
import { addPhoto, getPhoto, markDone } from '../../photo/photo_registry.js';
import { ROW } from '../../photo/tests/photo_dialog_fixture.js';
import { makeEmptyOverlay, overlayButtons, overlayShows } from '../empty_overlay.js';
import { makeLetterCard, resetLetterCardForTests } from '../letter_card.js';
import { isFineTuneOpen, resetLetterViewForTests } from '../view_switches.js';

// S4 turned 'sketch' on; these tests read Simple as B16 shipped it, with the
// flag off (the sketch's own column, keys and door are the S2 / S3 tests)
beforeEach(() => {
	setFeaturesForTests({ sketch: false });
});

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

function openB({ simple = true, letterView = true, beforeBrush = false } = {}) {
	setModeForTests(simple ? 'simple' : 'all');
	// the flags as the app ships them; beforeBrush: the B7 overlay ("Draw it with points")
	setFeaturesForTests({
		letterView,
		...(beforeBrush ? { brush: false, photo: false } : {}),
	});
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

	// B8 + B9 integration (4.3 "Empty letter"): the photo buttons come first, the first green
	it('photos, once B9 lands: [Use a photo], or [Use the same photo] and [Choose another photo...]', () => {
		expect(overlayButtons(flagsOn('brush', 'photo'))).toEqual(['usePhoto', 'drawBrush']);
		expect(overlayButtons(flagsOn('brush', 'photo'), { samePhoto: true })).toEqual([
			'useSamePhoto',
			'chooseAnother',
			'drawBrush',
		]);
		expect(overlayButtons(flagsOn('photo'))).toEqual(['usePhoto', 'drawPoints']);
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
			word('letter.overlay.usePhoto'),
		]);
	});

	it('before the Brush: "Draw it with points" picks the Point pen and opens Fine-tune; the overlay steps aside', () => {
		const editor = openB({ beforeBrush: true });
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
			{
				key: 'error.saveFailed',
				vars: { file: 'Brennan Hand.gs2' },
				buttons: ['error.button.tryAgain'],
			},
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

// B8 + B9 finalize (second hostile pass): after "Done with this photo" the overlay's green button
// was still [Use the same photo], and it led on to trace another of that photo's parts
describe('a photo he is done with', () => {
	function withPhoto(editor, { done }) {
		const blob = new Blob([new Uint8Array(16)], { type: 'image/webp' });
		const asset = editor.assets.add(blob, { type: 'image/webp' });
		addPhoto(editor.project, { asset, width: 1500, height: 520, parts: ROW, paper: 'photo' });
		if (done) markDone(getPhoto(editor.project, asset));
		return asset;
	}
	const actions = () =>
		[...document.querySelectorAll('[data-anyink-overlay-action]')].map((b) =>
			b.getAttribute('data-anyink-overlay-action')
		);

	it('[Choose another photo...] is the green button, and [Use the same photo] stays outlined', () => {
		const editor = openB();
		withPhoto(editor, { done: true });
		document.body.appendChild(makeEmptyOverlay(editor));
		expect(actions()).toEqual(['chooseAnother', 'useSamePhoto', 'drawBrush']);
		expect(greens().map((button) => button.textContent.trim())).toEqual([
			word('letter.overlay.chooseAnother'),
		]);
	});

	it('a photo not done yet keeps [Use the same photo] first and green', () => {
		const editor = openB();
		withPhoto(editor, { done: false });
		document.body.appendChild(makeEmptyOverlay(editor));
		expect(actions()).toEqual(['useSamePhoto', 'chooseAnother', 'drawBrush']);
		expect(overlayButtons(flagsOn('brush', 'photo'), { samePhoto: true, done: true })).toEqual([
			'chooseAnother',
			'useSamePhoto',
			'drawBrush',
		]);
	});
});
