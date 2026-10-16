// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 acceptance run, the photo dialog (docs/UX-BEGINNER.md 4.4 step B):
// - a whole-alphabet page opened close up on the capitals every time, with nothing saying the
//   small letters were below; each Do the next one needed a scroll again (shots r1600/04, 19).
//   Now a line says so while letters still to name are out of view, and the view he picked
//   with [-] [+] is kept for that photo.
// - after "na" was used for n, the dialog said every letter had a name, so the a was never
//   asked for. Now that part is offered again, with no letter in the field and "Two letters
//   touch here. Drag a box around each one."
// Written to fail on the code before the B16 photo fixes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { word } from '../../words/words.js';
import { closePhotoDialog, openPhotoDialog } from '../photo_dialog.js';
import { pageFont, photoFont, photoOn, shown } from './photo_dialog_fixture.js';

const dialog = () => document.querySelector('[data-anyink-dialog="photoDialog"]');
const q = (selector) => dialog()?.querySelector(selector) || null;
const action = (name) => q(`[data-anyink-photo-action="${name}"]`);
const more = () => q('[data-anyink-photo-more]');
/** The line says so: shown, and not just keeping its room (visibility hidden). */
const says = () => shown(more()) && more().style.visibility !== 'hidden';
const message = () => q('[data-anyink-photo-message]').textContent;
const pickedId = () => q('[data-anyink-picked]')?.getAttribute('data-anyink-part') || null;
const stageWidth = () => parseFloat(q('[data-anyink-photo-stage]').style.width);

beforeEach(() => photoOn());
afterEach(() => {
	closePhotoDialog();
	document.body.innerHTML = '';
});

describe('a whole page opened close up', () => {
	it('says that more letters are out of view, until they all show', () => {
		const { record, mask, image } = pageFont();
		openPhotoDialog({ record, mask, image });
		expect(says()).toBe(true);
		expect(more().textContent).toBe(word('photo.dialog.more'));
		for (let i = 0; i < 20 && shown(action('zoomOut')); i++) action('zoomOut').click();
		expect(shown(action('zoomOut'))).toBe(false);
		expect(says()).toBe(false);
	});

	it('opens again the way he left it for that photo; another photo opens close up', () => {
		const page = pageFont();
		openPhotoDialog(page);
		const close = stageWidth();
		for (let i = 0; i < 20 && shown(action('zoomOut')); i++) action('zoomOut').click();
		const whole = stageWidth();
		expect(whole).toBeLessThan(close);
		closePhotoDialog();
		openPhotoDialog(page);
		expect(stageWidth()).toBeCloseTo(whole, 0);
		expect(says()).toBe(false);
		closePhotoDialog();
		const other = pageFont();
		other.record.asset = 'img-photo0002';
		openPhotoDialog(other);
		expect(stageWidth()).toBeCloseTo(close, 0);
	});

	it('scrolled to show every letter still to name, it says nothing, and keeps its room', () => {
		const { record, mask, image } = pageFont();
		// every letter named but the capitals' first row, which is in view as it opens
		const first = record.parts.filter((p) => p.row === 0).map((p) => p.id);
		for (const part of record.parts) {
			if (!first.includes(part.id)) record.used[part.id] = { char: 'x', seq: 1 };
		}
		openPhotoDialog({ record, mask, image });
		expect(says()).toBe(false);
		expect(shown(more())).toBe(true);
		const view = q('[data-anyink-photo-view]');
		view.scrollTop = 10000;
		view.dispatchEvent(new Event('scroll'));
		expect(says()).toBe(true);
	});

	it('a photo that shows whole never says so', () => {
		const { record, mask, image } = photoFont();
		openPhotoDialog({ record, mask, image });
		expect(says()).toBe(false);
	});
});

describe('a part of two touching letters, used for one of them', () => {
	// B r e (na) H: the fourth part is two letters wide
	const parts = [
		{ id: 'p1', left: 100, top: 100, right: 200, bottom: 220, row: 0 },
		{ id: 'p2', left: 290, top: 100, right: 390, bottom: 220, row: 0 },
		{ id: 'p3', left: 480, top: 100, right: 580, bottom: 220, row: 0 },
		{ id: 'p4', left: 670, top: 100, right: 850, bottom: 220, row: 0 },
		{ id: 'p5', left: 940, top: 100, right: 1040, bottom: 220, row: 0 },
	];
	const named = (p4) => photoFont({ parts, used: { p1: 'B', p2: 'r', p3: 'e', p4, p5: 'H' } });

	it('is offered again for its other letter, with an empty field and the two-letters line', () => {
		const { record, mask, image } = named('n');
		openPhotoDialog({ record, mask, image });
		expect(pickedId()).toBe('p4');
		expect(q('[data-anyink-photo-field]').value).toBe('');
		expect(message()).toBe(word('photo.dialog.twoLetters'));
		expect(message()).not.toBe(word('photo.dialog.allNamed'));
	});

	// B16 final (the photo verifier: the re-offered part named a traced the whole "na" again, so
	// a was "na" too and the preview read "Brenananana")
	it('Trace it on it for the other letter does not trace the whole part: draw a box first', () => {
		const { record, mask, image } = named('n');
		const onTrace = vi.fn();
		openPhotoDialog({ record, mask, image, onTrace });
		const field = q('[data-anyink-photo-field]');
		field.value = 'a';
		field.dispatchEvent(new Event('input', { bubbles: true }));
		action('trace').click();
		expect(onTrace).not.toHaveBeenCalled();
		expect(dialog()).not.toBe(null);
		expect(message()).toBe(word('photo.dialog.twoLettersBox'));
	});

	it('named m (one wide letter, under twice the others): every letter has a name', () => {
		const { record, mask, image } = named('m');
		openPhotoDialog({ record, mask, image });
		expect(pickedId()).toBe(null);
		expect(message()).toBe(word('photo.dialog.allNamed'));
	});
});
