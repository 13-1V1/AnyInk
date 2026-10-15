// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 finalize: Fine-tune > Photo (UX-BEGINNER.md 4.3), the piece of the letter card B9 left
	unbuilt (integration NEEDS item 1): Photo fade, Hide photo / Show photo, and Photo options
	(Lock the photo, Light ink on dark paper, Fit to letter box, Fit to capitals line, Remove
	photo). Each change is one Undo step naming the letter; Remove photo has an Undo toast.
	Written to fail on the card before the pass (no Photo part in Fine-tune).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { fitBands } from '../../trace/trace_fit.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import {
	fineTuneParts,
	letterCardState,
	makeLetterCard,
	resetLetterCardForTests,
} from '../letter_card.js';
import { resetPhotoPartForTests } from '../photo_part.js';
import { resetLetterViewForTests, setFineTuneOpen } from '../view_switches.js';

const PHOTO = {
	asset: 'img-ph0to001',
	width: 400,
	height: 300,
	x: 10,
	y: 900,
	scale: 3,
	opacity: 0.25,
	locked: true,
};

function openB() {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true });
	const editor = twoLetterEditor();
	editor.selectedGlyphID = B;
	const item = editor.selectedGlyph;
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	item.addOneShape(
		new Path({
			name: 'Square',
			pathPoints: [corner(100, 0), corner(500, 0), corner(500, 400), corner(100, 400)],
		})
	);
	setTrace(item, { ...PHOTO });
	editor.history.addState('set up the test letter');
	setFineTuneOpen(true, editor);
	const card = makeLetterCard(editor);
	document.body.appendChild(card);
	return { editor, card };
}

const q = (selector) => document.querySelector(selector);
const photo = (editor) => getTrace(editor.project.getItem(B));
const newest = (editor) => editor.history.queue[0]?.title;

beforeEach(() => {
	resetLetterViewForTests();
	resetLetterCardForTests();
	resetPhotoPartForTests();
	resetToastsForTests();
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});
afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('Fine-tune > Photo', () => {
	it('shows first in Fine-tune on a letter with a photo, never on one without', () => {
		const { editor } = openB();
		expect(fineTuneParts(letterCardState(editor))[0]).toBe('photo');
		expect(q('[data-anyink-fine="photo"]')).not.toBeNull();
		setTrace(editor.project.getItem(B), null);
		expect(fineTuneParts(letterCardState(editor))).not.toContain('photo');
	});

	it('Photo fade: each tick shows, the release is one Undo step naming the letter', () => {
		const { editor } = openB();
		const before = editor.history.queue.length;
		const slider = q('[data-anyink-photo-input="fade"]');
		expect(Number(slider.value)).toBe(25);
		slider.value = '40';
		slider.dispatchEvent(new Event('input'));
		slider.value = '60';
		slider.dispatchEvent(new Event('input'));
		expect(photo(editor).opacity).toBe(0.6);
		expect(editor.history.queue.length).toBe(before);
		slider.dispatchEvent(new Event('change'));
		expect(editor.history.queue.length).toBe(before + 1);
		expect(newest(editor)).toBe('set the photo fade of Capital B');
		editor.history.restoreState();
		expect(photo(editor).opacity).toBe(0.25);
	});

	it('Hide photo and Show photo, a step each', () => {
		const { editor } = openB();
		q('[data-anyink-photo-action="hide"]').click();
		expect(photo(editor).visible).toBe(false);
		expect(newest(editor)).toBe('hid the photo of Capital B');
		q('[data-anyink-photo-action="show"]').click();
		expect(photo(editor).visible).toBe(true);
		expect(newest(editor)).toBe('showed the photo of Capital B');
	});

	it('Photo options: lock, light ink, the two fits and Remove photo with its Undo toast', () => {
		const { editor } = openB();
		q('[data-anyink-toggle="photoOptions"]').click();
		const lock = q('[data-anyink-photo-input="lock"]');
		expect(lock.checked).toBe(true);
		lock.checked = false;
		lock.dispatchEvent(new Event('change'));
		expect(photo(editor).locked).toBe(false);
		expect(newest(editor)).toBe('unlocked the photo of Capital B');
		const light = q('[data-anyink-photo-input="lightInk"]');
		light.checked = true;
		light.dispatchEvent(new Event('change'));
		expect(photo(editor).invert).toBe(true);
		q('[data-anyink-photo-action="fitBox"]').click();
		const box = fitBands(editor.project.settings.font).em;
		expect(photo(editor).y).toBe(box.top);
		expect(newest(editor)).toBe('fit the photo of Capital B to the letter box');
		q('[data-anyink-photo-action="fitCaps"]').click();
		expect(newest(editor)).toBe('fit the photo of Capital B to the capitals line');
		const shapes = editor.project.getItem(B).shapes.length;
		q('[data-anyink-photo-action="remove"]').click();
		expect(photo(editor)).toBe(null);
		expect(newest(editor)).toBe('took the photo off Capital B');
		expect(editor.project.getItem(B).shapes.length).toBe(shapes);
		expect(document.body.textContent).toContain(
			word('letter.toast.photoRemoved', { name: 'Capital B' })
		);
		editor.history.restoreState();
		expect(photo(editor)?.asset).toBe(PHOTO.asset);
	});
});

scanSimpleScreen('letter card, Fine-tune > Photo with its options open', () => {
	openB();
	q('[data-anyink-toggle="photoOptions"]').click();
	return q('.anyink-letter-card');
});
