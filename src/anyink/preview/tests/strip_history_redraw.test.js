// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize (verdict "Empty preview says 'Your letters show here as you make them.' while
// a letter was just made"): the strip redrew only on its pub/sub topics, and the Rectangle and
// Oval tools publish none of them when they add a shape (upstream publishes 'currentPath' while
// dragging, before the shape is in the letter). So the sheet kept its old sentence over a letter
// that now has ink. Every change (each History step, Undo and Redo: the save status hears of
// each one) redraws the strip, in both modes.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { setModeForTests } from '../../mode/mode.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
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

describe.each(['all', 'simple'])('%s: the strip redraws after every change', (mode) => {
	function stripOn(editor) {
		const strip = new PreviewStrip();
		document.body.appendChild(strip);
		strip.attachEditor(editor);
		strip.scheduleRedraw = vi.fn();
		return strip;
	}

	it('a shape added (a History step that publishes nothing the strip hears)', () => {
		setModeForTests(mode);
		const editor = sampleEditor();
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x41';
		const shape = editor.selectedGlyph.shapes[0];
		const strip = stripOn(editor);
		strip.scheduleRedraw.mockClear();
		shape.x += 10;
		editor.history.addState('Added path: Rectangle 1');
		expect(strip.scheduleRedraw).toHaveBeenCalled();
	});

	it("another font's change doesn't redraw this strip", () => {
		setModeForTests(mode);
		const other = sampleEditor();
		const editor = sampleEditor();
		const strip = stripOn(editor);
		window.dispatchEvent(new CustomEvent('anyink-save-status', { detail: { editor: other } }));
		expect(strip.scheduleRedraw).not.toHaveBeenCalled();
	});

	it('a strip taken off the page stops listening', () => {
		setModeForTests(mode);
		const editor = sampleEditor();
		const strip = stripOn(editor);
		strip.remove();
		window.dispatchEvent(new CustomEvent('anyink-save-status', { detail: { editor } }));
		expect(strip.scheduleRedraw).not.toHaveBeenCalled();
	});
});
