// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S2 (docs/SKETCH.md 2): the edit canvas hands its presses and keys to the picked sketch tool
// (sketch/tools/tool_route.js). Nothing routes with the 'sketch' flag off, with another tool
// picked or on the Kerning page; a left press, every move and a double-click go to the tool in font
// units with Ctrl as "snaps off"; a middle or right press never does; keys the tool uses stop
// there, modifier keys always go on, and an Escape the tool leaves alone goes back to Select.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flagsOn } from '../../../mode/features.js';
import {
	activeSketchTool,
	clearSketchToolsForTests,
	followSketchTools,
	registerSketchTool,
	sketchKey,
	sketchPointer,
	sketchPointerOut,
	sketchToolHandler,
} from '../tool_route.js';
import { isSketchTool, SKETCH_TOOLS, toolWordKey } from '../tool_names.js';

const ON = flagsOn('sketch');
const OFF = () => false;

/** A stand-in editor: the view puts font (0, 0) at canvas (100, 500), half size */
function fakeEditor(tool = 'sketchLine', page = 'Characters') {
	const subscribers = [];
	return {
		selectedTool: tool,
		nav: { page },
		view: { dx: 100, dy: 500, dz: 0.5 },
		selectedItem: { id: 'glyph-0x6E' },
		editCanvas: { redraw: vi.fn() },
		subscribe: (entry) => subscribers.push(entry),
		publish(topic, value) {
			subscribers.filter((s) => s.topic === topic).forEach((s) => s.callback(value));
		},
	};
}

/** A handler that records what it hears */
function recorder(answers = {}) {
	const heard = [];
	const handler = {
		heard,
		down: (ev) => heard.push(['down', ev]),
		move: (ev) => heard.push(['move', ev]),
		up: (ev) => heard.push(['up', ev]),
		dblclick: (ev) => heard.push(['double', ev]),
		key: (press) => {
			heard.push(['key', press, press.name]);
			return answers[press.key] === true ? 'used' : null;
		},
		pointerOut: () => heard.push(['out']),
		toolOn: (change) => heard.push(['on', change]),
		toolOff: (change) => heard.push(['off', change]),
	};
	return handler;
}

const mouse = (type, options = {}) => new MouseEvent(type, { button: 0, ...options });
const key = (name, options = {}) => new KeyboardEvent('keydown', { key: name, ...options });

beforeEach(() => clearSketchToolsForTests());
afterEach(() => clearSketchToolsForTests());

describe('names', () => {
	it('five tools, their words keys, and nothing else is a sketch tool', () => {
		expect(SKETCH_TOOLS).toEqual([
			'sketchLine',
			'sketchArc',
			'sketchSpline',
			'sketchCircle',
			'sketchRectangle',
		]);
		expect(SKETCH_TOOLS.map(toolWordKey)).toEqual([
			'sketch.tool.line',
			'sketch.tool.arc',
			'sketch.tool.spline',
			'sketch.tool.circle',
			'sketch.tool.rectangle',
		]);
		expect(toolWordKey('resize')).toBe('tool.resize');
		['resize', 'nib', 'newPath', 'pan', '', null, undefined].forEach((tool) =>
			expect(isSketchTool(tool)).toBe(false)
		);
	});

	it('registering: only a sketch tool, an object; the undo forgets only its own handler', () => {
		expect(() => registerSketchTool('newPath', {})).toThrow(/not a sketch tool/);
		expect(() => registerSketchTool('sketchLine', null)).toThrow(/must be an object/);
		const first = recorder();
		const forget = registerSketchTool('sketchLine', first);
		expect(sketchToolHandler('sketchLine')).toBe(first);
		const second = recorder();
		registerSketchTool('sketchLine', second);
		forget();
		expect(sketchToolHandler('sketchLine')).toBe(second);
	});
});

describe('when nothing routes', () => {
	it('the flag off: no press, move or key reaches the tool, and the canvas is not redrawn', () => {
		const handler = recorder({ enter: true });
		registerSketchTool('sketchLine', handler);
		const editor = fakeEditor();
		expect(activeSketchTool(editor, { isOn: OFF })).toBe(null);
		['down', 'move', 'up', 'double'].forEach((type) =>
			expect(sketchPointer(type, mouse('mousedown'), { editor, isOn: OFF })).toBe(false)
		);
		expect(sketchKey('down', key('Enter'), { editor, isOn: OFF })).toBe(false);
		expect(sketchPointerOut(editor, { isOn: OFF })).toBe(false);
		expect(handler.heard).toEqual([]);
		expect(editor.editCanvas.redraw).not.toHaveBeenCalled();
	});

	it('another tool picked, or the Kerning page', () => {
		const handler = recorder();
		registerSketchTool('sketchLine', handler);
		expect(sketchPointer('down', mouse('mousedown'), { editor: fakeEditor('resize'), isOn: ON })).toBe(
			false
		);
		const kerning = fakeEditor('sketchLine', 'Kerning');
		expect(sketchPointer('down', mouse('mousedown'), { editor: kerning, isOn: ON })).toBe(false);
		expect(handler.heard).toEqual([]);
	});

	it("a middle or right press is never the tool's (the middle button pans)", () => {
		const handler = recorder();
		registerSketchTool('sketchLine', handler);
		const editor = fakeEditor();
		expect(sketchPointer('down', mouse('mousedown', { button: 1 }), { editor, isOn: ON })).toBe(false);
		expect(sketchPointer('up', mouse('mouseup', { button: 2 }), { editor, isOn: ON })).toBe(false);
		expect(handler.heard).toEqual([]);
	});
});

describe('presses', () => {
	it('a left press goes to the tool in font units, y up, then the canvas redraws', () => {
		const handler = recorder();
		registerSketchTool('sketchArc', handler);
		const editor = fakeEditor('sketchArc');
		const used = sketchPointer('down', mouse('mousedown', { detail: 1 }), {
			editor,
			at: { x: 150, y: 400 },
			isOn: ON,
		});
		expect(used).toBe(true);
		const [[name, ev]] = handler.heard;
		expect(name).toBe('down');
		expect(ev).toMatchObject({
			type: 'down',
			tool: 'sketchArc',
			x: 100,
			y: 200,
			cx: 150,
			cy: 400,
			button: 0,
			detail: 1,
			shift: false,
			ctrl: false,
			snapsOff: false,
			item: editor.selectedItem,
			editor,
		});
		expect(editor.editCanvas.redraw).toHaveBeenCalledWith('sketchTool');
	});

	it('Ctrl held turns the snaps off for that press (from the event only, S2 finalize); Shift is passed', () => {
		const handler = recorder();
		registerSketchTool('sketchLine', handler);
		const editor = fakeEditor();
		sketchPointer('move', mouse('mousemove', { ctrlKey: true }), { editor, at: { x: 0, y: 0 }, isOn: ON });
		sketchPointer('down', mouse('mousedown', { ctrlKey: true, shiftKey: true }), {
			editor,
			at: { x: 0, y: 0 },
			isOn: ON,
		});
		sketchPointer('up', mouse('mouseup', { shiftKey: true }), { editor, at: { x: 0, y: 0 }, isOn: ON });
		const [move, down, up] = handler.heard.map(([, ev]) => ev);
		expect(move.snapsOff).toBe(true);
		expect(down).toMatchObject({ snapsOff: true, ctrl: true, shift: true });
		expect(up).toMatchObject({ snapsOff: false, shift: true });
	});

	it('a double-click goes to doubleClick; the pointer leaving goes to pointerOut', () => {
		const handler = recorder();
		registerSketchTool('sketchSpline', handler);
		const editor = fakeEditor('sketchSpline');
		expect(sketchPointer('double', mouse('dblclick', { detail: 2 }), { editor, at: { x: 100, y: 500 }, isOn: ON })).toBe(true);
		expect(sketchPointerOut(editor, { isOn: ON })).toBe(true);
		expect(handler.heard.map(([name]) => name)).toEqual(['double', 'out']);
		expect(handler.heard[0][1]).toMatchObject({ x: 0, y: 0, detail: 2 });
	});

	it('a sketch tool with no handler yet still keeps the press from Select', () => {
		const editor = fakeEditor('sketchCircle');
		expect(sketchPointer('down', mouse('mousedown'), { editor, at: { x: 1, y: 1 }, isOn: ON })).toBe(true);
	});

	it('an unknown type or a view not fitted yet hands nothing on', () => {
		const handler = recorder();
		registerSketchTool('sketchLine', handler);
		const editor = fakeEditor();
		expect(sketchPointer('wheel', mouse('wheel'), { editor, isOn: ON })).toBe(false);
		editor.view = { dx: 0, dy: 0, dz: 0 };
		expect(sketchPointer('down', mouse('mousedown'), { editor, isOn: ON })).toBe(true);
		expect(handler.heard).toEqual([]);
	});
});

describe('keys', () => {
	it('a key the tool uses stops there and redraws; one it leaves goes on', () => {
		const handler = recorder({ enter: true });
		registerSketchTool('sketchLine', handler);
		const editor = fakeEditor();
		expect(sketchKey('down', key('Enter'), { editor, isOn: ON })).toBe(true);
		expect(sketchKey('down', key('l'), { editor, isOn: ON })).toBe(false);
		expect(handler.heard.map(([, press, name]) => [name, press.key])).toEqual([
			['Enter', 'enter'],
			['l', 'l'],
		]);
		expect(handler.heard[0][1]).toMatchObject({ type: 'down', tool: 'sketchLine', shift: false });
		expect(editor.editCanvas.redraw).toHaveBeenCalledTimes(1);
	});

	it('Ctrl and Shift reach the tool and always go on, even when it says it used them', () => {
		const handler = recorder({ control: true, shift: true });
		registerSketchTool('sketchLine', handler);
		const editor = fakeEditor();
		expect(sketchKey('down', key('Control', { ctrlKey: true }), { editor, isOn: ON })).toBe(false);
		expect(sketchKey('up', new KeyboardEvent('keyup', { key: 'Shift' }), { editor, isOn: ON })).toBe(false);
		expect(handler.heard.map(([, press]) => [press.type, press.key])).toEqual([
			['down', 'control'],
			['up', 'shift'],
		]);
		expect(editor.editCanvas.redraw).toHaveBeenCalledTimes(2);
	});

	it("Escape with a piece open is the tool's; a second Escape (the tool leaves it) goes back to Select", () => {
		let pieceOpen = true;
		const handler = recorder();
		handler.key = (press) => {
			if (press.key !== 'escape' || !pieceOpen) return null;
			pieceOpen = false;
			return 'finished';
		};
		registerSketchTool('sketchLine', handler);
		const editor = fakeEditor();
		const onEscape = vi.fn();
		expect(sketchKey('down', key('Escape'), { editor, isOn: ON, onEscape })).toBe(true);
		expect(onEscape).not.toHaveBeenCalled();
		expect(sketchKey('down', key('Escape'), { editor, isOn: ON, onEscape })).toBe(false);
		expect(onEscape).toHaveBeenCalledTimes(1);
		// a key-up Escape never switches
		sketchKey('up', new KeyboardEvent('keyup', { key: 'Escape' }), { editor, isOn: ON, onEscape });
		expect(onEscape).toHaveBeenCalledTimes(1);
	});
});

describe('picking and leaving a tool', () => {
	it('toolOff / toolOn tell the tools; Space-pan in the middle of a piece is no change', () => {
		const line = recorder();
		const arc = recorder();
		registerSketchTool('sketchLine', line);
		registerSketchTool('sketchArc', arc);
		const editor = fakeEditor('sketchLine');
		followSketchTools(editor);
		editor.publish('whichToolIsSelected', 'pan');
		editor.publish('whichToolIsSelected', 'sketchLine');
		expect(line.heard).toEqual([]);
		editor.publish('whichToolIsSelected', 'sketchArc');
		expect(line.heard).toEqual([['off', { to: 'sketchArc' }]]);
		expect(arc.heard).toEqual([['on', { from: 'sketchLine' }]]);
		editor.publish('whichToolIsSelected', 'resize');
		expect(arc.heard.at(-1)).toEqual(['off', { to: 'resize' }]);
	});
});
