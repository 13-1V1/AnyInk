// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix pass (critic finding "Simple: Help and About have no way back to the letters": a
// double-click on a letter in the strip goes back to it, but nothing on screen said so).
// UX-BEGINNER.md 4.0, the strip's rendered letters: "Double-click a letter: open it. Tooltip
// 'Double-click to work on d'". Pointing at a letter the strip can open says so, in house words,
// in both modes; a joined letter in Simple says it opens in More tools (6.3); a letter not made
// yet, a space or the empty sheet says nothing.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { findBanned } from '../../words/banned.js';
import { stripLetterTooltip } from '../letter_tooltip.js';
import { PreviewStrip } from '../preview_strip.js';

beforeAll(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	if (!customElements.get('preview-strip')) customElements.define('preview-strip', PreviewStrip);
	if (!customElements.get('display-canvas')) customElements.define('display-canvas', DisplayCanvas);
});
beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
});
afterEach(() => {
	setModeForTests('all');
	document.body.innerHTML = '';
});

const letter = (char, id) => ({ char, item: { id, chars: char, shapes: [{}] } });
const small = letter('d', 'glyph-0x64');
const question = letter('?', 'glyph-0x3F');
const joined = letter('fi', 'liga-0x66-0x69');

describe('stripLetterTooltip', () => {
	it('names the letter a double-click opens', () => {
		expect(stripLetterTooltip(small, { simple: true })).toBe('Double-click to work on small d');
		expect(stripLetterTooltip(question, { simple: false })).toBe(
			'Double-click to work on the question mark'
		);
	});

	it('a joined letter: in Simple it opens in More tools; All tools opens it as before', () => {
		expect(stripLetterTooltip(joined, { simple: true })).toBe(
			'Double-click to work on the joined letters fi in More tools'
		);
		expect(stripLetterTooltip(joined, { simple: false })).toBe(
			'Double-click to work on the joined letters fi'
		);
	});

	it('nothing to open: no tooltip', () => {
		expect(stripLetterTooltip(false)).toBe('');
		expect(stripLetterTooltip({ char: 'q', item: false })).toBe('');
		expect(stripLetterTooltip({ char: 'k', item: { id: 'kern-1' } })).toBe('');
	});

	it('says no banned word', () => {
		[small, question, joined].forEach((data) =>
			[true, false].forEach((simple) =>
				expect(findBanned(stripLetterTooltip(data, { simple }))).toEqual([])
			)
		);
	});
});

['all', 'simple'].forEach((mode) => {
	describe(`the strip's sheet (${mode})`, () => {
		it('pointing at a letter shows the tooltip; leaving the sheet takes it off', () => {
			setModeForTests(mode);
			const strip = new PreviewStrip();
			document.body.appendChild(strip);
			let hit = small;
			strip.hitTest = () => hit;
			const sheet = strip.canvasWrapper;
			sheet.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
			expect(sheet.getAttribute('title')).toBe('Double-click to work on small d');
			expect(sheet.classList.contains('is-over-glyph')).toBe(true);
			hit = false;
			sheet.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
			expect(sheet.hasAttribute('title')).toBe(false);
			hit = small;
			sheet.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
			sheet.dispatchEvent(new MouseEvent('mouseleave'));
			expect(sheet.hasAttribute('title')).toBe(false);
		});
	});
});

// B4 + B5 finalize (new problem "Strip tooltip offers 'Double-click to work on small a' over the
// letter already open, where a double-click does nothing"): the letter already open says nothing.
describe('the letter already open', () => {
	const openOn = (id) => ({ nav: { page: 'Characters' }, selectedItemID: id });

	it('has no tooltip, in both modes: a double-click there opens nothing', () => {
		[true, false].forEach((simple) => {
			expect(stripLetterTooltip(small, { simple, editor: openOn('glyph-0x64') })).toBe('');
		});
	});

	it('another letter open: the tooltip still offers this one', () => {
		expect(stripLetterTooltip(small, { simple: true, editor: openOn('glyph-0x61') })).toBe(
			'Double-click to work on small d'
		);
	});

	it('on the sheet: pointing at the open letter sets no title', () => {
		const strip = new PreviewStrip();
		document.body.appendChild(strip);
		strip.hitTest = () => small;
		strip.editor = openOn('glyph-0x64');
		strip.canvasWrapper.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
		expect(strip.canvasWrapper.hasAttribute('title')).toBe(false);
	});
});
