// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B12 (UX-BEGINNER.md 4.6 "Move all letters closer or further apart"; 7.2 the photo moves with the
// shapes; 7.3 "Letter spacing slider release: whole-project step"; section 10 B12 unit tests
// "slider math (letters set by him move too; the floor at zero; the far end touches without
// overlap)"). Live while dragging, one whole-font step about no letter on release.
// Written to fail first: src/anyink/tryit/letter_spacing.js did not exist.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { getExtra } from '../../spacing/extra.js';
import { inkBounds } from '../../spacing/measure.js';
import { closestGap, letter, photoUnder, rect } from '../../spacing/tests/fixtures.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { historyText } from '../../words/history_text.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import {
	LETTER_SPACING_TOPIC,
	commitExtra,
	makeLetterSpacingSection,
	previewExtra,
} from '../letter_spacing.js';
import { gapsEditor } from './gaps_fixture.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

/** H and n fitted automatically, plus a letter he set himself: l, 20 units each side. */
function spacingEditor(options = {}) {
	return gapsEditor({
		letters: 'Hno',
		own: { l: { shapes: [rect(20, 0, 80, 700)], advanceWidth: 100, anyink: { spacing: 'manual' } } },
		...options,
	});
}

const sides = (item) => {
	const ink = inkBounds(item);
	return { left: ink.xMin, right: item.advanceWidth - ink.xMax };
};

describe('the slider math', () => {
	it('letters set by him move too, and every side stops at touching, never past it', () => {
		const editor = spacingEditor();
		const l = letter(editor.project, 'l');
		expect(sides(l)).toEqual({ left: 20, right: 20 });
		previewExtra(editor, 15);
		expect(sides(l)).toEqual({ left: 35, right: 35 });
		// G is 40 on this grid: his 20-unit sides stop at 0, never -20
		previewExtra(editor, -40);
		expect(sides(l)).toEqual({ left: 0, right: 0 });
		previewExtra(editor, -500); // held to the slider's end
		expect(getExtra(editor.project)).toBe(-40);
		expect(sides(l)).toEqual({ left: 0, right: 0 });
		// back to 0: his own spacing, exactly
		previewExtra(editor, 0);
		expect(sides(l)).toEqual({ left: 20, right: 20 });
	});

	it('at the far left end neighbors touch without overlapping', () => {
		const editor = spacingEditor();
		const { project } = editor;
		previewExtra(editor, -40);
		const pairs = ['Hn', 'nH', 'Hl', 'lH', 'nl', 'ln', 'on', 'no'];
		const gaps = pairs.map(([a, b]) => closestGap(letter(project, a), letter(project, b)));
		gaps.forEach((gap) => expect(gap).toBeGreaterThanOrEqual(0));
		// two straight sides meet exactly
		expect(closestGap(letter(project, 'H'), letter(project, 'l'))).toBe(0);
		expect(closestGap(letter(project, 'l'), letter(project, 'H'))).toBe(0);
	});

	it('the photo moves with the shapes', () => {
		const editor = spacingEditor();
		const l = letter(editor.project, 'l');
		setTrace(l, photoUnder(l, 30));
		const before = { photo: getTrace(l).x, ink: inkBounds(l).xMin };
		previewExtra(editor, 12);
		const moved = inkBounds(l).xMin - before.ink;
		expect(moved).toBe(12);
		expect(getTrace(l).x - before.photo).toBe(moved);
	});

	it('live ticks publish the narrow topic and record nothing', () => {
		const editor = spacingEditor();
		const heard = [];
		editor.subscribe({
			topic: LETTER_SPACING_TOPIC,
			subscriberID: 'anyink.letterSpacingTest.listen',
			callback: (data) => heard.push(data),
		});
		previewExtra(editor, 5);
		previewExtra(editor, 9);
		expect(heard).toEqual([
			{ extra: 5, dragging: true },
			{ extra: 9, dragging: true },
		]);
		expect(editor.history.queue).toHaveLength(0);
	});
});

describe('release: one whole-font step', () => {
	it('records the change from where the drag began as one step about no letter', () => {
		const editor = spacingEditor({ open: 'n' });
		const l = letter(editor.project, 'l');
		previewExtra(editor, -5);
		previewExtra(editor, -18);
		expect(commitExtra(editor, 0, -18)).toBe(true);
		expect(getExtra(editor.project)).toBe(-18);
		expect(sides(l)).toEqual({ left: 2, right: 2 });
		const queue = editor.history.queue;
		expect(queue).toHaveLength(2);
		expect(queue[1]).toMatchObject({ wholeProjectSave: true, itemID: false });
		expect(historyText(queue[1].title)).toBe('moved all letters closer');
		// the step's before-copy is the font as it was before the drag
		expect(queue[1].itemState.settings.anyink?.spacing?.extra ?? 0).toBe(0);
		// apart, and Reset, have their own words
		commitExtra(editor, -18, 10);
		expect(historyText(editor.history.queue[1].title)).toBe('moved all letters further apart');
		commitExtra(editor, 10, 0, { reset: true });
		expect(historyText(editor.history.queue[1].title)).toBe('put the letter spacing back');
		// a release where it began records nothing
		expect(commitExtra(editor, 0, 0)).toBe(false);
		expect(editor.history.queue).toHaveLength(6);
	});

	it("Undo puts every letter back and doesn't navigate", () => {
		const editor = spacingEditor({ open: 'n' });
		const l = letter(editor.project, 'l');
		previewExtra(editor, 25);
		commitExtra(editor, 0, 25);
		editor.selectedItemID = 'glyph-0x48';
		const navigate = vi.spyOn(editor, 'navigate');
		editor.history.restoreState();
		expect(getExtra(editor.project)).toBe(0);
		expect(sides(letter(editor.project, 'l'))).toEqual({ left: 20, right: 20 });
		expect(editor.selectedItemID).toBe('glyph-0x48');
		expect(navigate).not.toHaveBeenCalled();
		expect(l).toBeTruthy();
	});

	it('the open letter stays still on screen while every letter moves', () => {
		const editor = spacingEditor({ open: 'l' });
		const l = letter(editor.project, 'l');
		editor.view = { dx: 300, dy: 500, dz: 0.5 };
		const screenX = () => editor.view.dx + inkBounds(l).xMin * editor.view.dz;
		const before = screenX();
		previewExtra(editor, 30);
		expect(screenX()).toBeCloseTo(before);
		previewExtra(editor, -40);
		expect(screenX()).toBeCloseTo(before);
	});
});

describe('the closed section', () => {
	it('starts closed, slides from closer to further apart, and releases one step', () => {
		const editor = spacingEditor();
		const section = makeLetterSpacingSection({ getEditor: () => editor });
		document.body.appendChild(section.element);
		const details = section.element;
		expect(details.tagName).toBe('DETAILS');
		expect(details.open).toBe(false);
		expect(details.querySelector('summary').textContent).toBe(
			'Move all letters closer or further apart'
		);
		const slider = /** @type {HTMLInputElement} */ (details.querySelector('input[type=range]'));
		expect([slider.min, slider.max, slider.value]).toEqual(['-40', '40', '0']);
		const reset = details.querySelector('button');
		expect(reset.hidden).toBe(true); // nothing to reset
		slider.value = '-10';
		slider.dispatchEvent(new Event('input'));
		slider.value = '-22';
		slider.dispatchEvent(new Event('input'));
		expect(getExtra(editor.project)).toBe(-22);
		expect(editor.history.queue).toHaveLength(0);
		slider.dispatchEvent(new Event('change'));
		expect(editor.history.queue).toHaveLength(2);
		expect(historyText(editor.history.queue[1].title)).toBe('moved all letters closer');
		expect(reset.hidden).toBe(false);
		reset.click();
		expect(getExtra(editor.project)).toBe(0);
		expect(slider.value).toBe('0');
		expect(editor.history.queue).toHaveLength(4);
		// Undo of the reset: the slider follows the font
		editor.history.restoreState();
		section.refresh();
		expect(slider.value).toBe('-22');
		section.open();
		expect(details.open).toBe(true);
		section.detach();
	});
});

// B12 fix pass (finding: "Ctrl+Z during a held gap drag ... The same stale-project problem applies
// to ... letter_spacing's live drag across an Undo"). Written to fail first: the slider kept the
// extra it began from on the old font and wrote it into the new one's before-copy, and Undo keys
// went through while the slider was held.
describe('Undo during a held slider drag', () => {
	const sliderOf = (section) =>
		/** @type {HTMLInputElement} */ (section.element.querySelector('input[type=range]'));
	const slide = (slider, value, type = 'input') => {
		slider.value = String(value);
		slider.dispatchEvent(new Event(type));
	};

	it("a font swapped under the drag: the step starts from the new font's spacing", () => {
		const editor = spacingEditor();
		const section = makeLetterSpacingSection({ getEditor: () => editor });
		document.body.appendChild(section.element);
		const slider = sliderOf(section);
		slide(slider, 20);
		slide(slider, 20, 'change'); // step 1: 0 -> 20
		slide(slider, 30); // held: from 20
		editor.history.restoreState(); // Ctrl+Z got through: the font is back at 0
		expect(getExtra(editor.project)).toBe(0);
		slide(slider, 10);
		slide(slider, 10, 'change'); // step: 0 -> 10, never 20 -> 10
		expect(getExtra(editor.project)).toBe(10);
		expect(historyText(editor.history.queue[1].title)).toBe('moved all letters further apart');
		editor.history.restoreState();
		expect(getExtra(editor.project)).toBe(0);
		section.detach();
	});

	it('Ctrl+Z waits while the slider is held, and works again on release', () => {
		const editor = spacingEditor();
		const section = makeLetterSpacingSection({ getEditor: () => editor });
		document.body.appendChild(section.element);
		const slider = sliderOf(section);
		const heard = [];
		const listen = (event) => heard.push(event.key);
		document.addEventListener('keydown', listen);
		const ctrlZ = () =>
			document.body.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
			);
		slider.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		slide(slider, 12);
		ctrlZ();
		expect(heard).toEqual([]);
		slide(slider, 12, 'change');
		slider.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
		ctrlZ();
		expect(heard).toEqual(['z']);
		// a press that ends away from the slider releases them too
		slider.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		window.dispatchEvent(new MouseEvent('pointerup'));
		ctrlZ();
		expect(heard).toEqual(['z', 'z']);
		document.removeEventListener('keydown', listen);
		section.detach();
	});
});

scanSimpleScreen('Try it: letter spacing, open, moved', () => {
	const editor = spacingEditor();
	const section = makeLetterSpacingSection({ getEditor: () => editor });
	document.body.appendChild(section.element);
	section.open();
	const slider = /** @type {HTMLInputElement} */ (section.element.querySelector('input'));
	slider.value = '8';
	slider.dispatchEvent(new Event('input'));
	slider.dispatchEvent(new Event('change'));
	return section.element;
});
