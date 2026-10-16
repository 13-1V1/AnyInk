// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S2 fix track (layer wiring), the real event handlers (edit_canvas/events.js, events_mouse.js,
// events_keyboard.js) after the S2 critic:
//   - Ctrl (and Shift) for a sketch click are read from the mouse event alone: a Ctrl+E dialog
//     that swallowed the Ctrl key-up no longer leaves every later click with snapping off
//   - a right press with a piece open finishes it, like Enter; the browser's menu never shows
//     over the letter while a sketch tool is picked
//   - Esc with a menu, dropdown or dialog open is the menu's: it closes and the open piece
//     stays open; an Esc that only closes a menu leaves the sketch tool picked
//   - Space-pan in the middle of a piece: mouse up, then Space up, gives the sketch tool back
//     with the piece still open (Simple and All tools)
//   - in Simple with the sketch on, a plain wheel zooms about the cursor (Ctrl+wheel as before)
// With the flag off each behaves as before. Written to fail first.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	eventHandlerData,
	handleCanvasContextMenu,
	handleSketchKeyDown,
	handleSketchKeyUp,
} from '../../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../../edit_canvas/events_keyboard.js';
import { makeContextMenu } from '../../../../controls/dialogs/dialogs.js';
import { handleMouseEvents, handleMouseWheel } from '../../../../edit_canvas/events_mouse.js';
import { selectTool } from '../../../../edit_canvas/tools/tools.js';
import { setFeaturesForTests } from '../../../mode/features.js';
import { setModeForTests } from '../../../mode/mode.js';
import { sampleEditor } from '../../../mode/tests/controls_probe.js';
import { resetLetterViewForTests } from '../../../letter/view_switches.js';
import { clearSketchToolsForTests, registerSketchTool } from '../tool_route.js';

let editor;
let warn;

function letterPage() {
	editor = sampleEditor();
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x6E';
	editor.eventHandlers.tool_addPath = {};
	editor.eventHandlers.tool_pan = {
		mousedown() {
			eventHandlerData.isPanning = true;
		},
		mouseup() {
			// upstream's Tool_Pan.mouseup
			eventHandlerData.isPanning = false;
		},
	};
	editor.eventHandlers.tool_resize = { mousedown: vi.fn(), mousemove: vi.fn(), mouseup: vi.fn() };
	editor.editCanvas = { redraw: vi.fn() };
	editor.view = { dx: 100, dy: 600, dz: 0.5 };
	editor.selectedTool = 'resize';
}

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

function release(key, options = {}) {
	const event = new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true, ...options });
	handleSketchKeyUp(event);
	if (!event.defaultPrevented) handleKeyUp(event);
	return event;
}

/** A Line tool stand-in with a piece that opens on a press */
function lineTool() {
	const tool = { open: false, heard: [], toolOff: vi.fn() };
	tool.down = (ev) => {
		tool.open = true;
		tool.heard.push(['down', ev.snapsOff, ev.shift]);
	};
	tool.key = (p) => {
		if (p.type !== 'down') return null;
		tool.heard.push(['key', p.key]);
		if ((p.key === 'enter' || p.key === 'escape') && tool.open) {
			tool.open = false;
			return 'finished';
		}
		return null;
	};
	registerSketchTool('sketchLine', tool);
	return tool;
}

beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	// jsdom has no Web Animations: upstream's menus fade out with element.animate
	if (!Element.prototype.animate) {
		Element.prototype.animate = function () {
			const animation = { finished: Promise.resolve(), cancel() {}, onfinish: null };
			queueMicrotask(() => animation.onfinish?.());
			return animation;
		};
	}
	resetLetterViewForTests();
	clearSketchToolsForTests();
	letterPage();
});
afterEach(() => {
	warn.mockRestore();
	clearSketchToolsForTests();
	resetLetterViewForTests();
	document.body.innerHTML = '';
	Object.assign(eventHandlerData, {
		isCtrlDown: false,
		isShiftDown: false,
		isAltDown: false,
		isSpaceDown: false,
		isPanning: false,
		lastTool: false,
	});
	setModeForTests('all');
});

describe('Ctrl and Shift come from the mouse event', () => {
	it('a Ctrl key-up the page never heard leaves snapping on for the next click', () => {
		simpleSketch();
		const tool = lineTool();
		selectTool('sketchLine');
		// a dialog's window-level listener ate the Ctrl key-up: upstream's flag is stuck
		Object.assign(eventHandlerData, { isCtrlDown: true, isShiftDown: true });
		handleMouseEvents(mouse('mousedown'));
		expect(tool.heard.at(-1)).toEqual(['down', false, false]);
		handleMouseEvents(mouse('mousedown', { ctrlKey: true, shiftKey: true }));
		expect(tool.heard.at(-1)).toEqual(['down', true, true]);
	});

	it('a stuck Ctrl never turns the next key into a Ctrl key: L still picks Line', () => {
		simpleSketch();
		selectTool('resize');
		eventHandlerData.isCtrlDown = true;
		press('l');
		expect(editor.selectedTool).toBe('sketchLine');
		expect(eventHandlerData.isCtrlDown).toBe(false);
		// a real Ctrl press still counts
		press('Control', { ctrlKey: true });
		expect(eventHandlerData.isCtrlDown).toBe(true);
		handleMouseEvents(mouse('mousemove'));
		expect(eventHandlerData.isCtrlDown).toBe(false);
	});
});

describe('a right press', () => {
	it('with a piece open finishes it, as Enter does; the browser menu stays away', () => {
		simpleSketch();
		const tool = lineTool();
		selectTool('sketchLine');
		handleMouseEvents(mouse('mousedown'));
		expect(tool.open).toBe(true);
		const right = mouse('mousedown', { button: 2 });
		handleMouseEvents(right);
		expect(tool.open).toBe(false);
		expect(tool.heard.at(-1)).toEqual(['key', 'enter']);
		expect(right.defaultPrevented).toBe(true);
		const menu = mouse('contextmenu', { button: 2 });
		handleCanvasContextMenu(menu);
		expect(menu.defaultPrevented).toBe(true);
		// still the Line tool, nothing given to Select
		expect(editor.selectedTool).toBe('sketchLine');
		expect(editor.eventHandlers.tool_resize.mousedown).not.toHaveBeenCalled();
	});

	it('with no piece open does nothing; the flag off leaves the right press and menu as before', () => {
		simpleSketch();
		const tool = lineTool();
		selectTool('sketchLine');
		handleMouseEvents(mouse('mousedown', { button: 2 }));
		expect(tool.open).toBe(false);
		expect(editor.selectedTool).toBe('sketchLine');

		simpleSketch(false);
		editor.selectedTool = 'resize';
		const menu = mouse('contextmenu', { button: 2 });
		handleCanvasContextMenu(menu);
		expect(menu.defaultPrevented).toBe(false);
	});
});

describe('Esc with a menu open is the menu\'s', () => {
	function openMenu(kind) {
		// the real ones: upstream's makeContextMenu (a <dialog id="context-menu"> shown with no
		// open attribute, as Simple's Menu is) and a nav dropdown
		const menu =
			kind === 'nav'
				? document.createElement('nav')
				: makeContextMenu([{ name: 'Save', onClick() {} }], 10, 10);
		if (kind === 'simple') menu.dataset.anyinkMenu = 'simple';
		if (kind === 'nav') menu.textContent = 'menu';
		document.body.appendChild(menu);
		return menu;
	}

	['simple', 'nav'].forEach((kind) => {
		it(`${kind}: the open piece stays open and the tool never hears the Esc`, () => {
			simpleSketch();
			const tool = lineTool();
			selectTool('sketchLine');
			handleMouseEvents(mouse('mousedown'));
			openMenu(kind);
			const esc = press('Escape');
			expect(tool.open).toBe(true);
			expect(tool.heard.some(([what, key]) => what === 'key' && key === 'escape')).toBe(false);
			expect(esc.defaultPrevented).toBe(false);
			expect(editor.selectedTool).toBe('sketchLine');
		});
	});

	it('no piece open: an Esc that closes the menu leaves the sketch tool picked', () => {
		simpleSketch();
		lineTool();
		selectTool('sketchLine');
		openMenu('simple');
		press('Escape');
		expect(editor.selectedTool).toBe('sketchLine');
		// with nothing open, the next Esc is the tool's again (and a second one goes to Select)
		document.body.innerHTML = '';
		press('Escape');
		expect(editor.selectedTool).toBe('resize');
	});

	it('an ANY-INK dialog open counts too', () => {
		simpleSketch();
		const tool = lineTool();
		selectTool('sketchLine');
		handleMouseEvents(mouse('mousedown'));
		const box = document.createElement('div');
		box.setAttribute('data-anyink-dialog', 'useInWord');
		document.body.appendChild(box);
		press('Enter');
		expect(tool.open).toBe(true);
	});
});

describe('Space-pan in the middle of a piece', () => {
	function spacePan() {
		press(' ', { code: 'Space' });
		expect(editor.selectedTool).toBe('pan');
		// he drags with the mouse and lets go of it first (Tool_Pan.mouseup clears isPanning)
		editor.eventHandlers.tool_pan.mousedown();
		editor.eventHandlers.tool_pan.mouseup();
		// Space still held: the key repeats
		press(' ', { code: 'Space', repeat: true });
		press(' ', { code: 'Space', repeat: true });
		release(' ', { code: 'Space' });
	}

	it('Simple: the sketch tool comes back and the piece is still open', () => {
		simpleSketch();
		const tool = lineTool();
		selectTool('sketchLine');
		handleMouseEvents(mouse('mousedown'));
		spacePan();
		expect(editor.selectedTool).toBe('sketchLine');
		expect(tool.open).toBe(true);
		expect(tool.toolOff).not.toHaveBeenCalled();
		expect(eventHandlerData.lastTool).toBe(false);
	});

	it('Simple, from Select: Select comes back', () => {
		simpleSketch();
		selectTool('resize');
		spacePan();
		expect(editor.selectedTool).toBe('resize');
	});

	it('All tools: Select comes back once, never "no tool"', () => {
		setModeForTests('all');
		setFeaturesForTests({ sketch: false });
		selectTool('resize');
		spacePan();
		expect(editor.selectedTool).toBe('resize');
	});
});

describe('the wheel', () => {
	const wheel = (options = {}) =>
		new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true, ...options });

	it('Simple with the sketch on: a plain wheel zooms about the cursor', () => {
		simpleSketch();
		const zoom = vi.spyOn(editor, 'updateViewZoom').mockImplementation(() => {});
		const event = wheel();
		handleMouseWheel(event);
		expect(zoom).toHaveBeenCalledTimes(1);
		expect(zoom.mock.calls[0][0]).toBe(1.1);
		expect(event.defaultPrevented).toBe(true);
		handleMouseWheel(wheel({ deltaY: 100 }));
		expect(zoom.mock.calls[1][0]).toBe(0.9);
	});

	it('the flag off (and All tools): a plain wheel does nothing, Ctrl+wheel zooms as before', () => {
		simpleSketch(false);
		const zoom = vi.spyOn(editor, 'updateViewZoom').mockImplementation(() => {});
		handleMouseWheel(wheel());
		expect(zoom).not.toHaveBeenCalled();
		handleMouseWheel(wheel({ ctrlKey: true }));
		expect(zoom).toHaveBeenCalledTimes(1);
		setModeForTests('all');
		setFeaturesForTests({ sketch: true });
		handleMouseWheel(wheel());
		expect(zoom).toHaveBeenCalledTimes(1);
	});
});
