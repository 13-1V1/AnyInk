// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7 finalize: a press on the edit canvas takes the keyboard back. Upstream
// cancels the canvas's mousedown, so the browser never moved focus: a Trace panel toggle
// reached with Tab (or any panel field) kept the keyboard after a click on the image, so
// Ctrl+Z, the arrow nudges and the tool keys stopped working and Space flipped the toggle.
// Runs the real canvas mouse handler (handleMouseEvents) and the real key handler.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { handleMouseEvents } from '../../../edit_canvas/events_mouse.js';
import { Tool_Resize } from '../../../edit_canvas/tools/resize.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { deepActiveElement, releaseFocus } from '../../controls/focus_release.js';
import { resetGuidesLayerState } from '../../metrics/state.js';
import { resetTraceLayerState, traceLayerState } from '../trace_layer.js';
import { getTrace, setTrace } from '../trace_model.js';

// 400 x 200 font units, top-left at (50, 450): spans x 50..450, y 250..450
const TRACE = Object.freeze({
	asset: 'img-focustst',
	width: 200,
	height: 100,
	x: 50,
	y: 450,
	scale: 2,
	opacity: 0.4,
	visible: true,
	locked: false,
	invert: false,
});

let editor;

function makeEditor() {
	editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(simpleExampleProject);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Trace';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.selectedTool = 'resize';
	editor.eventHandlers.tool_resize = new Tool_Resize();
	editor.selectedItem.shapes = []; // in jsdom a shape covers its whole box; keep the image clear
	editor.view = { dx: 100, dy: 500, dz: 0.5 };
	editor.editCanvas = { redraw() {} }; // no real canvas in jsdom
	setTrace(editor.selectedItem, { ...TRACE });
	editor.history.addState('Added a trace image');
}

/** Canvas pixels for a font-unit point. */
function px(fu) {
	const v = editor.view;
	return { x: v.dx + fu.x * v.dz, y: v.dy - fu.y * v.dz };
}

function mouse(type, p) {
	return { type, offsetX: p.x, offsetY: p.y, button: 0, buttons: type === 'mouseup' ? 0 : 1 };
}

function key(type, name, options = {}) {
	const event = new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true, ...options });
	(document.activeElement || document.body).dispatchEvent(event);
	return event;
}

/** Press and release on the canvas at a font-unit point. */
function clickCanvas(fu) {
	handleMouseEvents(mouse('mousedown', px(fu)));
	handleMouseEvents(mouse('mouseup', px(fu)));
}

/** What the Trace panel's Invert toggle does when Space flips it. */
function invertWithSpace(box) {
	box.checked = !box.checked;
	setTrace(editor.selectedItem, { ...getTrace(editor.selectedItem), invert: box.checked });
	editor.history.addState('Inverted the trace image colors');
}

beforeEach(() => {
	resetTraceLayerState();
	resetGuidesLayerState();
	document.body.innerHTML = '<div id="editor-page__panel"></div>';
	document.addEventListener('keydown', handleKeyPress);
	document.addEventListener('keyup', handleKeyUp);
	makeEditor();
});

afterEach(() => {
	document.removeEventListener('keydown', handleKeyPress);
	document.removeEventListener('keyup', handleKeyUp);
	eventHandlerData.isCtrlDown = false;
});

describe('a press on the canvas takes the keyboard back (finalize)', () => {
	it('after Tab + Space on a Trace panel toggle, a click on the image lets Ctrl+Z undo it', () => {
		const box = document.createElement('input');
		box.type = 'checkbox';
		document.body.appendChild(box);
		box.focus(); // reached with Tab, so the panel's mouse hand-back does not apply
		invertWithSpace(box);
		expect(getTrace(editor.selectedItem).invert).toBe(true);

		handleMouseEvents(mouse('mousedown', px({ x: 250, y: 350 })));
		expect(traceLayerState.dragging).toBe('move'); // the trace layer took this press
		expect(document.activeElement).toBe(document.body);
		handleMouseEvents(mouse('mouseup', px({ x: 250, y: 350 })));

		key('keydown', 'Control', { ctrlKey: true });
		key('keydown', 'z', { ctrlKey: true });
		key('keyup', 'z', { ctrlKey: true });
		key('keyup', 'Control');
		expect(getTrace(editor.selectedItem).invert).toBe(false);
		expect(box.checked).toBe(true); // Space never reached the toggle again
	});

	it('an arrow key moves the image after a click, instead of going to the focused toggle', () => {
		const box = document.createElement('input');
		box.type = 'checkbox';
		document.body.appendChild(box);
		box.focus();

		clickCanvas({ x: 250, y: 350 });
		key('keydown', 'ArrowRight');
		key('keyup', 'ArrowRight');
		expect(getTrace(editor.selectedItem).x).toBe(TRACE.x + 1);
	});

	it('lets go of a field inside a control with a shadow root (upstream number fields)', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const inner = document.createElement('input');
		host.attachShadow({ mode: 'open' }).appendChild(inner);
		inner.focus();
		expect(deepActiveElement()).toBe(inner);

		clickCanvas({ x: 600, y: 600 }); // empty paper, away from the image

		expect(deepActiveElement()).toBe(document.body);
	});

	it('does nothing when the page already has the keyboard', () => {
		expect(document.activeElement).toBe(document.body);
		expect(releaseFocus()).toBe(false);
		clickCanvas({ x: 600, y: 600 });
		expect(document.activeElement).toBe(document.body);
	});
});
