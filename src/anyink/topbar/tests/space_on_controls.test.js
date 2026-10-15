// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 finalize (UX-BEGINNER.md 4.0 Top bar, principle 6 and 7): in the letter view, Space on a
	focused top-bar button ("1 Letters", the logo, Undo) or the letter header's "<- All letters"
	presses it, as it does on every other page. The edit canvas read Space as "hold to pan" on every
	edit-canvas page and swallowed the press, so the button did nothing, without a word. Space-drag
	still pans when the focus is not on a button or a link. All tools keeps today's keys (6.1).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests } from '../../toast/toast.js';

let editor;
let warn;
let panned;

function onLetter(mode) {
	setModeForTests(mode);
	editor = sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.selectedGlyphID = 'glyph-0x61';
	editor.nav.page = 'Characters';
	editor.navigate();
	editor.editCanvas = { redraw() {} };
	panned = 0;
	editor.eventHandlers.tool_pan = { mousedown: () => panned++, mouseup() {} };
	editor.selectedTool = 'resize';
}

function space() {
	const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
	handleKeyPress(event);
	handleKeyUp(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
	return event;
}

beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetToastsForTests();
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
	Object.assign(eventHandlerData, { isSpaceDown: false, isPanning: false, isCtrlDown: false });
	document.body.innerHTML = '';
});

describe('Simple letter view: Space on a focused button presses it', () => {
	it.each([
		['the rail "1 Letters"', '[data-anyink-step="letters"]'],
		['the logo', '[data-anyink-control="logo"]'],
		['Undo', '[data-anyink-control="undo"]'],
	])('%s: the press is the browser\'s (no pan, nothing swallowed)', (name, selector) => {
		onLetter('simple');
		const button = document.querySelector(selector);
		expect(button).not.toBeNull();
		button.focus();
		expect(document.activeElement).toBe(button);
		const event = space();
		expect(event.defaultPrevented).toBe(false);
		expect(panned).toBe(0);
		expect(eventHandlerData.isPanning).toBe(false);
		expect(eventHandlerData.isSpaceDown).toBe(false);
	});

	it('with the focus on the page, not a button, Space still pans', () => {
		onLetter('simple');
		document.activeElement?.blur?.();
		const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
		handleKeyPress(event);
		expect(event.defaultPrevented).toBe(true);
		expect(panned).toBe(1);
	});
});

describe('All tools: Space keeps today\'s meaning', () => {
	it('a focused button: Space still pans, as upstream has it', () => {
		onLetter('all');
		const button = document.createElement('button');
		document.body.appendChild(button);
		button.focus();
		const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
		handleKeyPress(event);
		expect(event.defaultPrevented).toBe(true);
		expect(panned).toBe(1);
	});
});
