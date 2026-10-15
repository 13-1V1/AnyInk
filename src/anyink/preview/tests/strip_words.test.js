// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 (UX-BEGINNER.md 2.2, 2.4 B, 4.0 "Preview strip"): the strip's labels are a display point
// Simple shares with More tools, so they say the house words in both modes: "Guide lines" (not
// "Metrics"), "Samples" (not "Presets"), "Type anything", and nothing shown in capitals (2.2
// sentence case: the "Preview" label was uppercased by CSS). The Samples menu names its rows the
// same way ("small g with its neighbors", "26 letters"). Every word comes from src/anyink/words.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeAllContextMenus } from '../../../controls/dialogs/dialogs.js';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { findUppercase, scanDom } from '../../words/banned.js';
import { letterName } from '../../words/letter_name.js';
import { labelCase, word } from '../../words/words.js';
import { makePointsSlider } from '../points_slider.js';
import { PreviewStrip } from '../preview_strip.js';
import { makePresetRows } from '../sample_presets.js';
import { formatPt } from '../units.js';

const here = dirname(fileURLToPath(import.meta.url));
const stripCss = readFileSync(join(here, '../preview-strip.css'), 'utf8');

beforeAll(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	if (!customElements.get('preview-strip')) customElements.define('preview-strip', PreviewStrip);
	if (!customElements.get('display-canvas')) customElements.define('display-canvas', DisplayCanvas);
});

let strip;
beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	const style = document.createElement('style');
	style.textContent = stripCss; // vitest skips CSS imports; findUppercase needs the real rules
	document.head.appendChild(style);
	strip = new PreviewStrip();
	strip.build();
	document.body.appendChild(strip);
});
afterEach(() => {
	closeAllContextMenus();
	setModeForTests('all');
	document.body.innerHTML = '';
	document.head.innerHTML = '';
});

const q = (selector) => strip.querySelector(selector);

describe('preview strip labels', () => {
	it('say the house words', () => {
		expect(q('.preview-strip__eyebrow').textContent).toBe(word('strip.title'));
		const text = q('.preview-strip__text');
		expect(text.getAttribute('placeholder')).toBe(word('strip.textPlaceholder'));
		expect(text.getAttribute('aria-label')).toBe(word('strip.textLabel'));
		expect(q('.preview-strip__presets').textContent).toBe(`${word('strip.samples')} ▾`);
		expect(q('.preview-strip__presets').title).toBe(word('strip.samplesHint'));
		const toggles = [...strip.querySelectorAll('.preview-strip__toggle')].map((t) => t.textContent);
		expect(toggles).toEqual([word('strip.realFont'), labelCase(word('line.guides'))]);
		expect(toggles[1]).toBe('Guide lines');
	});

	it('show nothing in capitals: the label is sentence case (no text-transform: uppercase)', () => {
		const rule = stripCss.match(/\.preview-strip__eyebrow\s*\{[^}]*\}/)?.[0] || '';
		expect(rule).not.toBe('');
		expect(rule).not.toMatch(/uppercase/);
		expect(findUppercase(strip)).toEqual([]);
	});

	['all', 'simple'].forEach((mode) => {
		it(`say no banned word (${mode})`, () => {
			setModeForTests(mode);
			expect(scanDom(strip)).toEqual([]);
		});
	});

	it('size slider: its label and readout in house words', () => {
		const slider = makePointsSlider({ value: 36 });
		const input = slider.element.querySelector('.fancy-slider__bar');
		expect(input.getAttribute('aria-label')).toBe(word('strip.sizeLabel'));
		expect(input.title).toBe(word('strip.sizeHint'));
		expect(formatPt(36)).toBe(word('unit.pt', { size: 36 }));
		expect(formatPt(36)).toBe('36 pt');
	});
});

describe('Samples menu', () => {
	it('names the rows in house words', () => {
		const rows = makePresetRows({ currentChar: 'g' });
		expect(rows[0].name).toBe(word('strip.sampleNeighbors', { letter: letterName('g') }));
		expect(rows[0].name).toBe('small g with its neighbors');
		expect(rows[0].note).toBe(word('strip.noteThisLetter'));
		const notes = rows.map((row) => row.note);
		expect(notes).toContain(word('strip.noteLetters', { count: 26 }));
		expect(notes).toContain(word('strip.noteCapitals'));
		expect(notes).toContain(word('strip.noteSmallLetters'));
		expect(makePresetRows({ currentChar: 'A' })[0].name).toBe('Capital A with its neighbors');
	});

	it('says no banned word when it opens', () => {
		strip.openPresets();
		const menu = document.querySelector('#context-menu');
		expect(menu).toBeTruthy();
		expect([...scanDom(menu), ...findUppercase(menu)]).toEqual([]);
	});
});
