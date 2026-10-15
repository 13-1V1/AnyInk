// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 (UX-BEGINNER.md 4.3 letter card "Brush": "Size: thin --o-- thick"; 10 B8 "Default size 9%
	of the small-letter height"): the brush's size. It is a share of the small-letter height, kept
	for this computer (an app pref, D-007), so it follows the guide lines and is never an Undo
	step; strokes are whole font units wide. The control is a slider with words at its ends, no
	number to type (principle 3).
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { getPref, resetPrefsCache } from '../../prefs/prefs.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import {
	BRUSH_PREF,
	DEFAULT_SHARE,
	MAX_SHARE,
	MIN_SHARE,
	brushShare,
	brushSize,
	resetBrushForTests,
	setBrushShare,
} from '../brush_size.js';
import { makeBrushSize } from '../size_control.js';

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	resetBrushForTests();
	document.body.innerHTML = '';
});
afterEach(() => {
	localStorage.clear();
	resetPrefsCache();
});

describe('the brush size', () => {
	it('starts at 9 % of the small-letter height, a whole number of units', () => {
		const { project } = twoLetterEditor();
		expect(DEFAULT_SHARE).toBe(0.09);
		expect(brushShare()).toBe(0.09);
		expect(brushSize(project)).toBe(45);
		project.settings.font.xHeight = 1100;
		expect(brushSize(project)).toBe(99);
	});

	it('is kept for this computer, between thin and thick, and never in the font', () => {
		const editor = twoLetterEditor();
		const steps = editor.history.queue.length;
		setBrushShare(0.15);
		expect(getPref(BRUSH_PREF)).toBe(0.15);
		expect(brushSize(editor.project)).toBe(75);
		setBrushShare(5);
		expect(brushShare()).toBe(MAX_SHARE);
		setBrushShare(-1);
		expect(brushShare()).toBe(MIN_SHARE);
		expect(editor.history.queue.length).toBe(steps);
		expect(JSON.stringify(editor.project.save())).not.toContain('brush');
	});

	it('a damaged pref falls back to the default', () => {
		localStorage.setItem('anyink-prefs', JSON.stringify({ [BRUSH_PREF]: 'wide' }));
		resetPrefsCache();
		resetBrushForTests();
		expect(brushShare()).toBe(DEFAULT_SHARE);
	});
});

describe('Size: thin --o-- thick', () => {
	it('a slider with its words at the ends and no number to type', () => {
		const control = makeBrushSize();
		document.body.appendChild(control);
		const words = [...control.querySelectorAll('span')].map((span) => span.textContent);
		expect(words).toEqual(['Size', 'thin', 'thick']);
		const slider = control.querySelector('input[type="range"]');
		expect(slider).not.toBeNull();
		expect(slider.getAttribute('aria-label')).toBe('Brush size');
		expect(control.querySelector('input[type="number"], input-number')).toBeNull();
		expect(Number(slider.value)).toBeCloseTo(DEFAULT_SHARE, 5);
	});

	it('moving it sets the size for new strokes', () => {
		const control = makeBrushSize();
		document.body.appendChild(control);
		const slider = control.querySelector('input[type="range"]');
		slider.value = '0.2';
		slider.dispatchEvent(new Event('input'));
		expect(brushShare()).toBe(0.2);
		expect(brushSize(twoLetterEditor().project)).toBe(100);
	});

	scanSimpleScreen('the Brush size control', () => {
		setFeaturesForTests({ brush: true });
		const control = makeBrushSize();
		document.body.appendChild(control);
		return control;
	});
});
