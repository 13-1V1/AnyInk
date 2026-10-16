// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 finalize (thickness-card verifier): with a sketch tool picked, the sketch's key route
	(edit_canvas/events.js handleSketchKeyDown, document capture) took the keys of a focused range
	slider first. Esc during a Thickness drag picked Select, which rebuilt the card and removed the
	slider; Chrome then fired its change and the dragged thickness was recorded. The arrows never
	moved the slider at all. A focused slider now keeps its own keys: the arrows, Home, End, Page
	Up / Down always, and Esc while it is being dragged (data-anyink-dragging).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData, handleSketchKeyDown } from '../../../../edit_canvas/events.js';
import { selectTool } from '../../../../edit_canvas/tools/tools.js';
import { setFeaturesForTests } from '../../../mode/features.js';
import { setModeForTests } from '../../../mode/mode.js';
import { sampleEditor } from '../../../mode/tests/controls_probe.js';
import { resetLetterViewForTests } from '../../../letter/view_switches.js';
import { clearSketchToolsForTests, registerSketchTool } from '../tool_route.js';
import { sliderOwnsKey } from '../../../controls/slider_keys.js';

let editor;
let tool;

function slider({ dragging = false } = {}) {
	const input = document.createElement('input');
	input.type = 'range';
	if (dragging) input.dataset.anyinkDragging = 'true';
	document.body.append(input);
	input.focus();
	return input;
}

function press(key, target) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	Object.defineProperty(event, 'target', { value: target });
	handleSketchKeyDown(event);
	return event;
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetLetterViewForTests();
	clearSketchToolsForTests();
	editor = sampleEditor();
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x6E';
	editor.eventHandlers.tool_addPath = {};
	editor.eventHandlers.tool_resize = { mousedown: vi.fn(), mousemove: vi.fn(), mouseup: vi.fn() };
	editor.editCanvas = { redraw: vi.fn() };
	editor.view = { dx: 100, dy: 600, dz: 0.5 };
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, brush: true, sketch: true });
	tool = { heard: [], toolOff: vi.fn(), down() {}, key: (p) => (tool.heard.push(p.key), 'used') };
	registerSketchTool('sketchLine', tool);
	selectTool('sketchLine');
});
afterEach(() => {
	clearSketchToolsForTests();
	resetLetterViewForTests();
	document.body.innerHTML = '';
	Object.assign(eventHandlerData, { isCtrlDown: false, isShiftDown: false, isAltDown: false });
	setModeForTests('all');
	vi.restoreAllMocks();
});

describe('a focused slider keeps its keys from the sketch tool', () => {
	it('Esc during a Thickness drag never reaches the sketch tool (no Select, no step)', () => {
		const input = slider({ dragging: true });
		const event = press('Escape', input);
		expect(event.defaultPrevented).toBe(false);
		expect(tool.heard).toEqual([]);
		expect(editor.selectedTool).toBe('sketchLine');
	});

	it('the arrows, Home and End move the slider, never the sketch', () => {
		const input = slider();
		for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'PageUp']) {
			expect(press(key, input).defaultPrevented).toBe(false);
		}
		expect(tool.heard).toEqual([]);
	});

	it('Esc on a slider that is not being dragged still reaches the sketch tool', () => {
		const input = slider();
		press('Escape', input);
		expect(tool.heard.length).toBe(1);
	});

	it('sliderOwnsKey: only a range input, only its keys', () => {
		const input = slider({ dragging: true });
		expect(sliderOwnsKey(input, { key: 'ArrowUp' })).toBe(true);
		expect(sliderOwnsKey(input, { key: 'Escape' })).toBe(true);
		expect(sliderOwnsKey(input, { key: 'l' })).toBe(false);
		const button = document.createElement('button');
		expect(sliderOwnsKey(button, { key: 'ArrowUp' })).toBe(false);
		expect(sliderOwnsKey(null, { key: 'ArrowUp' })).toBe(false);
	});
});
