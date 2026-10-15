// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize, through the real key and mouse handlers (edit_canvas/events_keyboard.js,
// events_mouse.js):
//   - a strip toggle (a checkbox) with focus no longer swallows the app's keys: Ctrl+Z undoes
//     and a tool key picks its tool, in both modes (verdict: "every app key stays dead after the
//     strip's Real font or Guide lines toggle")
//   - Simple: a press on the letter canvas leaves the toasts alone (UX-BEGINNER.md 4.0: toasts
//     last 6 s, info toasts wait their turn), so a tool key's "Switched to Oval (O)" waiting
//     behind another toast is shown after it, never lost (new problem "a tool key pressed while
//     any plain info toast shows never says 'Switched to'"). All tools: a press clears the
//     toasts, as before.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { handleMouseEvents } from '../../../edit_canvas/events_mouse.js';
import { resetToastsForTests, toast } from '../../toast/toast.js';
import { setModeForTests } from '../mode.js';
import { sampleEditor } from './controls_probe.js';

let editor;
let warn;

function press(key, options = {}) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
	handleKeyPress(event);
	handleKeyUp(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true, ...options }));
	return event;
}
function ctrl(key) {
	handleKeyPress(new KeyboardEvent('keydown', { key: 'Control', bubbles: true }));
	const event = press(key, { ctrlKey: true });
	handleKeyUp(new KeyboardEvent('keyup', { key: 'Control', bubbles: true }));
	return event;
}
function onLetter(id = 'glyph-0x41') {
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.selectedGlyphID = id;
	editor.nav.page = 'Characters';
	editor.navigate();
	editor.editCanvas = { redraw() {} };
	editor.eventHandlers.tool_addPath = {};
	editor.eventHandlers.tool_pan = { mousedown() {}, mouseup() {} };
	editor.selectedTool = 'resize';
}
function focusCheckbox() {
	const toggle = document.createElement('input');
	toggle.type = 'checkbox';
	document.body.appendChild(toggle);
	toggle.focus();
	expect(document.activeElement).toBe(toggle);
	return toggle;
}
const toastText = () =>
	document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])')?.textContent ||
	'';

beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetToastsForTests();
	editor = sampleEditor();
});
afterEach(() => {
	warn.mockRestore();
	resetToastsForTests();
	setModeForTests('all');
	Object.assign(eventHandlerData, {
		isCtrlDown: false,
		isShiftDown: false,
		isAltDown: false,
		isSpaceDown: false,
		isPanning: false,
	});
	document.body.innerHTML = '';
});

describe('a focused strip toggle (checkbox) keeps the app keys live', () => {
	it.each(['all', 'simple'])('%s: Ctrl+Z undoes the last change', (mode) => {
		setModeForTests(mode);
		onLetter();
		const shapes = editor.selectedItem.shapes.length;
		editor.selectedItem.shapes[0].x += 10;
		editor.history.addState('Moved a shape');
		const steps = editor.history.queue.length;
		focusCheckbox();
		ctrl('z');
		expect(editor.history.queue.length).toBeLessThan(steps);
		expect(editor.selectedItem.shapes).toHaveLength(shapes);
	});

	it.each(['all', 'simple'])('%s: R picks the Rectangle', (mode) => {
		setModeForTests(mode);
		onLetter();
		focusCheckbox();
		press('r');
		expect(editor.selectedTool).toBe('newRectangle');
	});

	it('a text field still keeps its keys: R types, no tool changes', () => {
		onLetter();
		const field = document.createElement('input');
		document.body.appendChild(field);
		field.focus();
		press('r');
		expect(editor.selectedTool).toBe('resize');
	});
});

describe('a press on the letter canvas and the toasts', () => {
	function canvasPress() {
		const still = { mousedown() {}, mousemove() {}, mouseup() {} };
		editor.eventHandlers.tool_resize = still;
		editor.eventHandlers.tool_addRectOval = still;
		const event = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
		handleMouseEvents(event);
		handleMouseEvents(new MouseEvent('mouseup', { button: 0, bubbles: true, cancelable: true }));
	}

	it('Simple: the toast showing stays, and a tool key waiting behind it is shown next', () => {
		vi.useFakeTimers();
		try {
			setModeForTests('simple');
			onLetter();
			toast('toast.drawingImported', { count: 2 }, { group: 'drop' });
			expect(toastText()).toContain('Brought in 2 shapes');
			press('o');
			expect(editor.selectedTool).toBe('newOval');
			canvasPress();
			expect(toastText()).toContain('Brought in 2 shapes');
			vi.advanceTimersByTime(6500);
			expect(toastText()).toContain('Switched to Oval (O)');
		} finally {
			vi.useRealTimers();
		}
	});

	it('All tools: a press clears the toast, as before', async () => {
		onLetter();
		toast('toast.merged');
		expect(document.querySelector('#toast')).toBeTruthy();
		canvasPress();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(document.querySelector('#toast')).toBe(null);
	});
});
