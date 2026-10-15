// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix pass (critic finding "After touching the strip, Ctrl+Z, Ctrl+S, Ctrl+E and tool keys
// do nothing"): the strip keeps only the keys its own controls use. Keys typed into the text field,
// Escape, a slider's arrows and a button's Enter / Space stay in the strip; every other key a strip
// button, checkbox or the size slider has focus for reaches the app (document, where
// events_keyboard.js listens), so after [Fix it] Ctrl+Z undoes it ("Undo puts it back"), and
// Ctrl+S, Ctrl+E and R work, in both modes (the strip is shared).
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { PreviewStrip } from '../preview_strip.js';
import { stripOwnsKey } from '../strip_keys.js';

beforeAll(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	if (!customElements.get('preview-strip')) customElements.define('preview-strip', PreviewStrip);
	if (!customElements.get('display-canvas')) customElements.define('display-canvas', DisplayCanvas);
});

let reached;
const listen = (event) => reached.push(event.key);
beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	reached = [];
	document.addEventListener('keydown', listen);
});
afterEach(() => {
	document.removeEventListener('keydown', listen);
	setModeForTests('all');
	document.body.innerHTML = '';
});

function makeStrip() {
	const strip = new PreviewStrip();
	document.body.appendChild(strip);
	strip.checkLine.show({
		text: 'small e has a width below zero.',
		itemId: 'glyph-0x65',
		fixable: true,
	});
	return strip;
}

/** Presses a key on an element of the strip; true when the app's listener got it. */
function press(element, key, init = {}) {
	const before = reached.length;
	element.dispatchEvent(
		new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
	);
	return reached.length > before;
}

const fixIt = (strip) => strip.checkLine.element.querySelectorAll('.anyink-notice__button')[1];
const showMe = (strip) => strip.checkLine.element.querySelectorAll('.anyink-notice__button')[0];

['all', 'simple'].forEach((mode) => {
	describe(`the strip lets the app's keys through (${mode})`, () => {
		beforeEach(() => setModeForTests(mode));

		it('from [Fix it] and [Show me]: Ctrl+Z, Ctrl+Y, Ctrl+S, Ctrl+E, R and Delete reach the app', () => {
			const strip = makeStrip();
			[fixIt(strip), showMe(strip)].forEach((button) => {
				expect(press(button, 'z', { ctrlKey: true })).toBe(true);
				expect(press(button, 'y', { ctrlKey: true })).toBe(true);
				expect(press(button, 's', { ctrlKey: true })).toBe(true);
				expect(press(button, 'e', { ctrlKey: true })).toBe(true);
				expect(press(button, 'r')).toBe(true);
				expect(press(button, 'Delete')).toBe(true);
			});
		});

		it('from the size slider: Ctrl+Z and tool keys reach the app; its arrows stay with it', () => {
			const strip = makeStrip();
			const slider = strip.slider.input;
			expect(press(slider, 'z', { ctrlKey: true })).toBe(true);
			expect(press(slider, 'v')).toBe(true);
			[
				'ArrowLeft',
				'ArrowRight',
				'ArrowUp',
				'ArrowDown',
				'Home',
				'End',
				'PageUp',
				'PageDown',
			].forEach((key) => expect(press(slider, key), key).toBe(false));
			expect(press(slider, 'ArrowRight', { shiftKey: true })).toBe(false); // the 10 pt nudge
		});

		it('from Samples and a toggle: Ctrl+Z reaches the app; Enter and Space press the control', () => {
			const strip = makeStrip();
			const toggle = strip.realFontToggle.input;
			[strip.presetsButton, toggle].forEach((control) => {
				expect(press(control, 'z', { ctrlKey: true })).toBe(true);
				expect(press(control, 'Enter')).toBe(false);
				expect(press(control, ' ')).toBe(false);
			});
		});

		it('typing in the text field stays in the strip, and so does Escape', () => {
			const strip = makeStrip();
			['r', 'e', 'Delete', 'ArrowLeft', ' '].forEach((key) =>
				expect(press(strip.textInput, key), key).toBe(false)
			);
			expect(press(strip.textInput, 'z', { ctrlKey: true })).toBe(false); // the field's own undo
			expect(press(showMe(strip), 'Escape')).toBe(false);
		});
	});
});

describe('stripOwnsKey', () => {
	const make = (tag, attributes = {}) => {
		const element = document.createElement(tag);
		Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
		return element;
	};
	const owns = (target, key, init = {}, isTextTarget) =>
		stripOwnsKey(
			{ target, key, ctrlKey: false, metaKey: false, altKey: false, ...init },
			{ isTextTarget }
		);

	it('a text field or the real-font sheet owns every key', () => {
		expect(owns(make('input', { type: 'text' }), 'r')).toBe(true);
		expect(owns(make('textarea'), 'z', { ctrlKey: true })).toBe(true);
		const sheet = make('font-preview');
		expect(owns(sheet, 'r', {}, (t) => t === sheet)).toBe(true);
	});

	it('a button owns Enter and Space only, never with Ctrl', () => {
		const button = make('button');
		expect(owns(button, 'Enter')).toBe(true);
		expect(owns(button, ' ')).toBe(true);
		expect(owns(button, 'Enter', { ctrlKey: true })).toBe(false);
		expect(owns(button, 'r')).toBe(false);
	});

	it('a range slider owns its moving keys, Shift too, but not with Ctrl, Alt or Meta', () => {
		const slider = make('input', { type: 'range' });
		expect(owns(slider, 'ArrowUp')).toBe(true);
		expect(owns(slider, 'ArrowUp', { shiftKey: true })).toBe(true);
		expect(owns(slider, 'ArrowUp', { ctrlKey: true })).toBe(false);
		expect(owns(slider, 'z', { ctrlKey: true })).toBe(false);
	});

	it('Escape is always the strip own; nothing without a target', () => {
		expect(owns(make('div'), 'Escape')).toBe(true);
		expect(stripOwnsKey({ key: 'z' })).toBe(false);
	});
});
