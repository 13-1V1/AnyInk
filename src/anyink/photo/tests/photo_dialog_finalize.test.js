// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B8 + B9 finalize: the second hostile pass on the photo dialog, each as it happened in Chrome on
// the first-timer's whole-alphabet page (IMG_4131).
// - With every part named, the whole photo's name tags covered each other (a "below" tag on the
//   next row's "above" tag): which letter a tag belonged to could not be told.
// - Resizing the window while it was open gave another zoom each time, sideways scrolling and
//   the green box out of view.
// - With the keyboard, [-] or [+] hid itself while it had the focus, and the dialog's keys
//   stopped working.
// - On a part holding two touching letters nothing said so (the merged "VW", "lm", "na").
// - "Skip this part" read like skipping a letter he still had to make.
// Written to fail on the dialog before the pass.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { word } from '../../words/words.js';
import { TAG_SIZE, closePhotoDialog, openPhotoDialog, placeTags } from '../photo_dialog.js';
import { usePart } from '../photo_registry.js';
import {
	PAGE_H,
	PAGE_W,
	key,
	pageFont,
	pageParts,
	photoFont,
	photoOn,
} from './photo_dialog_fixture.js';

const dialog = () => document.querySelector('[data-anyink-dialog="photoDialog"]');
const q = (selector) => dialog()?.querySelector(selector) || null;
const action = (name) => q(`[data-anyink-photo-action="${name}"]`);
const message = () => q('[data-anyink-photo-message]').textContent;
const stageWidth = () => parseFloat(q('[data-anyink-photo-stage]').style.width);

beforeEach(() => photoOn());
afterEach(() => {
	closePhotoDialog();
	document.body.innerHTML = '';
});

const overlap = (a, b) =>
	a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

describe('name tags never cover each other', () => {
	it('every part named, the whole photo shown: no tag lies on another tag or another letter', () => {
		for (const rowGap of [6, 20, 40]) {
			const parts = pageParts({ rowGap });
			// the whole page shown in about 450 x 600 (scale 0.3), as at 1600 x 900
			const placed = placeTags(parts, {
				scale: 0.3,
				tag: TAG_SIZE,
				bounds: { width: 450, height: 600 },
			});
			const outside = [...placed.values()].filter((p) => p.spot !== 'inside');
			for (let i = 0; i < outside.length; i++) {
				for (let j = i + 1; j < outside.length; j++) {
					expect(overlap(outside[i].rect, outside[j].rect), `rowGap ${rowGap}`).toBe(false);
				}
			}
			expect(placed.size).toBe(parts.length);
		}
	});

	it('the dialog uses those places', () => {
		const parts = pageParts({ rowGap: 6 });
		const used = Object.fromEntries(
			parts.map((p, i) => [p.id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26]])
		);
		const { record, mask, image } = pageFont({ parts, used });
		openPhotoDialog({ record, mask, image });
		action('zoomOut').click();
		action('zoomOut').click();
		const scale = stageWidth() / PAGE_W;
		const placed = placeTags(parts, {
			scale,
			tag: TAG_SIZE,
			bounds: { width: stageWidth(), height: scale * PAGE_H },
		});
		for (const part of parts.slice(0, 14)) {
			const tag = q(`[data-anyink-part="${part.id}"] .anyink-photo-dialog__tag`);
			expect(tag.classList).toContain(`anyink-photo-dialog__tag--${placed.get(part.id).spot}`);
		}
	});
});

describe('a window resized while the dialog is open', () => {
	it('keeps the letters the size they were, and the green box in view', () => {
		const { record, mask, image } = pageFont();
		openPhotoDialog({ record, mask, image });
		const before = stageWidth();
		const view = q('[data-anyink-photo-view]');
		// the window gets shorter: the view is 1350 x 440 now, then 1000 x 500, then back
		for (const [w, h] of [
			[1350, 440],
			[1000, 500],
			[1000, 600],
		]) {
			Object.defineProperty(view, 'clientWidth', { configurable: true, get: () => w });
			Object.defineProperty(view, 'clientHeight', { configurable: true, get: () => h });
			window.dispatchEvent(new Event('resize'));
			expect(Math.abs(stageWidth() - before), `${w} x ${h}`).toBeLessThanOrEqual(1);
		}
	});
});

describe('the zoom buttons with the keyboard', () => {
	it('[-] pressed until the whole photo shows hands the focus on, so letter keys still work', () => {
		const { record, mask, image } = pageFont();
		openPhotoDialog({ record, mask, image });
		const out = action('zoomOut');
		out.focus();
		out.click();
		out.click();
		expect(out.hidden).toBe(true);
		expect(document.activeElement).not.toBe(out);
		expect(dialog().contains(document.activeElement)).toBe(true);
		key(document.activeElement, 'b');
		expect(q('[data-anyink-photo-field]').value).toBe('b');
	});
});

describe('two letters touching', () => {
	it('the green box on a part twice as wide as a letter says to box each one', () => {
		const parts = [
			{ id: 'p1', left: 100, top: 100, right: 200, bottom: 260, row: 0 },
			{ id: 'p2', left: 290, top: 100, right: 390, bottom: 260, row: 0 },
			{ id: 'p3', left: 480, top: 100, right: 720, bottom: 260, row: 0 },
			{ id: 'p4', left: 810, top: 100, right: 910, bottom: 260, row: 0 },
		];
		const { record, mask, image } = photoFont({ parts });
		openPhotoDialog({ record, mask, image, pick: 'p3' });
		expect(message()).toBe(word('photo.dialog.twoLetters'));
		expect(word('photo.dialog.twoLetters')).toBe(
			'Two letters touch here. Drag a box around each one.'
		);
		key(q('[data-anyink-photo-field]'), 'ArrowRight');
		expect(message()).toBe('');
		usePart(record, 'p1', { char: 'a', itemId: 'glyph-0x61' });
	});
});

describe('Skip says what it is for', () => {
	it('"Not a letter, skip it"', () => {
		const { record, mask, image } = photoFont();
		openPhotoDialog({ record, mask, image });
		expect(action('skip').textContent).toBe('Not a letter, skip it');
	});
});
