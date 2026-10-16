// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S2 wiring (docs/SKETCH.md 2): the real tool column (edit_canvas/tools/tools.js), the real key
// handler (events_keyboard.js) with the sketch tool's capture listener in front of it
// (events.js), and the real mouse handler (events_mouse.js). Simple with 'sketch' on: the Brush,
// a small "Sketch" heading, Line, Arc, Spline, Circle and Rectangle with their keys printed, a
// rule, then Select; never inside Fine-tune; L picks Line; a press on the canvas goes to the sketch
// tool and never to Select's handler or the guides layer; Enter reaches an open piece before the
// key map; a second Escape goes back to Select. With the flag off, or in All tools, nothing of
// it is there. Written to fail first (no sketch tool existed in tools.js, keys.js or the events).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData, handleSketchKeyDown } from '../../../../edit_canvas/events.js';
import { handleKeyPress } from '../../../../edit_canvas/events_keyboard.js';
import { handleCanvasDoubleClick, handleMouseEvents } from '../../../../edit_canvas/events_mouse.js';
import { makeEditToolsButtons, selectTool } from '../../../../edit_canvas/tools/tools.js';
import { setFeaturesForTests } from '../../../mode/features.js';
import { setModeForTests } from '../../../mode/mode.js';
import { isVisible, sampleEditor } from '../../../mode/tests/controls_probe.js';
import { resetLetterViewForTests, setFineTuneOpen } from '../../../letter/view_switches.js';
import { scanSimpleScreen } from '../../../words/tests/banned_scan.js';
import { word } from '../../../words/words.js';
import { clearSketchToolsForTests, registerSketchTool } from '../tool_route.js';
import { SKETCH_TOOLS } from '../tool_names.js';

let editor;
let warn;

function letterPage() {
	editor = sampleEditor();
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x6E';
	editor.eventHandlers.tool_addPath = {};
	editor.eventHandlers.tool_pan = { mousedown() {}, mouseup() {} };
	editor.eventHandlers.tool_resize = { mousedown: vi.fn(), mousemove: vi.fn(), mouseup: vi.fn() };
	editor.editCanvas = { redraw: vi.fn() };
	editor.view = { dx: 100, dy: 600, dz: 0.5 };
	editor.selectedTool = 'resize';
}

function drawColumn() {
	const area = document.createElement('div');
	area.className = 'editor-page__tools-area';
	makeEditToolsButtons().forEach((element) => area.appendChild(element));
	document.body.replaceChildren(area);
	return area;
}

/** The column in order: tool ids, the heading as 'heading', rules as '|' (shown ones only) */
function columnOrder(area) {
	return [...area.children]
		.filter((el) => !el.hidden && isVisible(el))
		.map((el) => {
			if (el.dataset.anyinkTool) return el.dataset.anyinkTool;
			if (el.dataset.anyinkToolHeading) return 'heading';
			if (el.classList.contains('anyink-tool-rail__rule')) return '|';
			return '?';
		});
}

const button = (area, tool) => area.querySelector(`[data-anyink-tool="${tool}"]`);
const keyOf = (el) => el.querySelector('.anyink-tool__key')?.textContent ?? null;
const wordOf = (el) => el.querySelector('.anyink-tool__word')?.textContent ?? null;

function simpleSketch(on = true) {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, brush: true, sketch: on });
}

function mouse(type, options = {}) {
	return new MouseEvent(type, { button: 0, bubbles: true, cancelable: true, ...options });
}

function press(key, options = {}) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
	handleSketchKeyDown(event);
	if (!event.defaultPrevented) handleKeyPress(event);
	return event;
}

beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetLetterViewForTests();
	clearSketchToolsForTests();
	letterPage();
});
afterEach(() => {
	warn.mockRestore();
	clearSketchToolsForTests();
	resetLetterViewForTests();
	document.body.innerHTML = '';
	Object.assign(eventHandlerData, { isCtrlDown: false, isShiftDown: false, isAltDown: false });
	setModeForTests('all');
});

describe('the tool column', () => {
	it('Simple with the sketch: Brush, the Sketch heading, the five tools with their keys, a rule, Select', () => {
		simpleSketch();
		const area = drawColumn();
		expect(columnOrder(area)).toEqual(['nib', 'heading', ...SKETCH_TOOLS, '|', 'resize']);
		expect(area.querySelector('[data-anyink-tool-heading]').textContent).toBe(word('sketch.rail.heading'));
		expect(SKETCH_TOOLS.map((tool) => keyOf(button(area, tool)))).toEqual(['L', 'A', 'S', 'C', 'R']);
		expect(SKETCH_TOOLS.map((tool) => wordOf(button(area, tool)))).toEqual(
			['line', 'arc', 'spline', 'circle', 'rectangle'].map((name) => word(`sketch.tool.${name}`))
		);
		expect(button(area, 'sketchLine').title).toBe(`${word('sketch.tool.line')} (L). ${'Straight lines with corners. Click, click; double-click or Enter to finish.'}`);
		SKETCH_TOOLS.forEach((tool) => expect(button(area, tool).dataset.anyinkToolGroup).toBeUndefined());
		expect(keyOf(button(area, 'resize'))).toBe('V');
	});

	it('Fine-tune opening adds its tools under Select and leaves the sketch tools where they are', () => {
		simpleSketch();
		const area = drawColumn();
		setFineTuneOpen(true);
		expect(columnOrder(area)).toEqual([
			'nib',
			'heading',
			...SKETCH_TOOLS,
			'|',
			'resize',
			'|',
			'pathEdit',
			'newPath',
			'newRectangle',
			'newOval',
		]);
	});

	it('picking a sketch tool from its button; the button turns green (picked)', () => {
		simpleSketch();
		const area = drawColumn();
		button(area, 'sketchArc').click();
		expect(editor.selectedTool).toBe('sketchArc');
		expect(button(area, 'sketchArc').classList.contains('editor-page__tool-selected')).toBe(true);
	});

	it('the flag off: Simple\'s column as before; All tools never shows them; a sketch tool can\'t be picked', () => {
		simpleSketch(false);
		expect(columnOrder(drawColumn())).toEqual(['nib', 'resize']);
		selectTool('sketchLine');
		expect(editor.selectedTool).toBe('resize');
		setModeForTests('all');
		setFeaturesForTests({ sketch: true });
		const area = drawColumn();
		SKETCH_TOOLS.forEach((tool) => expect(button(area, tool)).toBe(null));
		expect(area.querySelector('[data-anyink-tool-heading]')).toBe(null);
	});

	it('Simple before the letter view: the sketch tools follow the Brush in the plain column', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: false, brush: true, sketch: true });
		const ids = [...drawColumn().querySelectorAll('button')].map((el) => el.dataset.anyinkTool);
		expect(ids.slice(ids.indexOf('nib'), ids.indexOf('nib') + 6)).toEqual(['nib', ...SKETCH_TOOLS]);
	});
});

// the column, a sketch tool picked: its words, tooltips and keys say only house words (strict)
scanSimpleScreen('the tool column with the sketch tools, Line picked', () => {
	letterPage();
	setFeaturesForTests({ letterView: true, brush: true, sketch: true });
	const area = drawColumn();
	selectTool('sketchLine');
	return area;
});

describe('keys', () => {
	it('L picks Line, A Arc, P Spline, O Circle, R Rectangle, E Select; the tool key toast names it', () => {
		simpleSketch();
		const seen = [];
		[
			['l', 'sketchLine'],
			['a', 'sketchArc'],
			['p', 'sketchSpline'],
			['o', 'sketchCircle'],
			['r', 'sketchRectangle'],
			['e', 'resize'],
		].forEach(([key, tool]) => {
			press(key);
			seen.push(editor.selectedTool);
			expect(editor.selectedTool, key).toBe(tool);
		});
		expect(seen).toHaveLength(6);
	});

	it('the flag off: L does nothing, A is Select, P the Point pen', () => {
		simpleSketch(false);
		press('l');
		expect(editor.selectedTool).toBe('resize');
		press('p');
		expect(editor.selectedTool).toBe('newPath');
		press('a');
		expect(editor.selectedTool).toBe('resize');
	});

	it('Enter reaches the open piece first; a key the tool leaves (L) still switches tools', () => {
		simpleSketch();
		const heard = [];
		registerSketchTool('sketchArc', {
			key: (p) => (heard.push(p.name), p.key === 'enter' ? 'finished' : null),
		});
		selectTool('sketchArc');
		const enter = press('Enter');
		expect(enter.defaultPrevented).toBe(true);
		press('l');
		expect(editor.selectedTool).toBe('sketchLine');
		expect(heard).toEqual(['Enter', 'l']);
	});

	it('Escape with a piece open finishes it; the second Escape goes back to Select', () => {
		simpleSketch();
		let open = true;
		registerSketchTool('sketchLine', {
			key: (p) => {
				if (p.key !== 'escape' || !open) return null;
				open = false;
				return 'finished';
			},
		});
		selectTool('sketchLine');
		press('Escape');
		expect(editor.selectedTool).toBe('sketchLine');
		press('Escape');
		expect(editor.selectedTool).toBe('resize');
	});

	it('typing in a text field is never the tool\'s', () => {
		simpleSketch();
		const key = vi.fn(() => 'used');
		registerSketchTool('sketchLine', { key });
		selectTool('sketchLine');
		const field = document.createElement('input');
		document.body.appendChild(field);
		field.focus();
		handleSketchKeyDown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(key).not.toHaveBeenCalled();
	});
});

describe('the mouse', () => {
	it('a press, a move and a release go to the sketch tool in font units, never to Select\'s handler', () => {
		simpleSketch();
		const heard = [];
		registerSketchTool('sketchLine', {
			down: (ev) => heard.push(['down', ev.x, ev.y, ev.snapsOff]),
			move: (ev) => heard.push(['move', ev.x, ev.y, ev.snapsOff]),
			up: (ev) => heard.push(['up', ev.x, ev.y, ev.snapsOff]),
		});
		selectTool('sketchLine');
		handleMouseEvents(mouse('mousemove', { clientX: 0 }));
		const at = (event, x, y) => {
			Object.defineProperty(event, 'offsetX', { value: x });
			Object.defineProperty(event, 'offsetY', { value: y });
			return event;
		};
		handleMouseEvents(at(mouse('mousemove'), 150, 500));
		handleMouseEvents(at(mouse('mousedown', { ctrlKey: true }), 150, 500));
		handleMouseEvents(at(mouse('mouseup'), 200, 400));
		expect(heard.slice(-3)).toEqual([
			['move', 100, 200, false],
			['down', 100, 200, true],
			['up', 200, 400, false],
		]);
		expect(editor.eventHandlers.tool_resize.mousedown).not.toHaveBeenCalled();
		expect(editor.eventHandlers.tool_resize.mouseup).not.toHaveBeenCalled();
		expect(editor.editCanvas.redraw).toHaveBeenCalledWith('sketchTool');
	});

	it('a double-click goes to the sketch tool only', () => {
		simpleSketch();
		const dblclick = vi.fn();
		registerSketchTool('sketchSpline', { dblclick });
		handleCanvasDoubleClick(mouse('dblclick', { detail: 2 }));
		expect(dblclick).not.toHaveBeenCalled();
		selectTool('sketchSpline');
		const event = mouse('dblclick', { detail: 2 });
		handleCanvasDoubleClick(event);
		expect(dblclick).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
	});

	it('the flag off: the press goes to Select\'s handler as before', () => {
		simpleSketch(false);
		const down = vi.fn();
		registerSketchTool('sketchLine', { down });
		editor.selectedTool = 'sketchLine'; // left picked from a session with the flag on
		handleMouseEvents(mouse('mousedown'));
		expect(down).not.toHaveBeenCalled();
		expect(editor.eventHandlers.tool_resize.mousedown).toHaveBeenCalled();
	});
});
