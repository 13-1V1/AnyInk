// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7 fix track: what a drag or a Ctrl+V on the edit canvas means, through
// upstream's real handlers (src/edit_canvas/events.js, events_keyboard.js,
// events_drag_drop_paste.js). The browser part is modeled: a Ctrl+V keydown whose default
// was not prevented is followed by a paste event carrying the system clipboard.
// Finalize: systemClipboard() models the system clipboard itself (what it holds changes
// when ANY-INK writes its copy note), and the permission API for the async read.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { eventHandlerData, initEventHandlers } from '../../../edit_canvas/events.js';
import {
	handlePasteSVGonEditCanvas,
	noteShapeCopy,
	SHAPES_ON_CLIPBOARD_TEXT,
} from '../../../edit_canvas/events_drag_drop_paste.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { clipboardCopy } from '../../../project_editor/actions.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { setDecoderForTests } from '../bitmap_cache.js';
import {
	CLIPBOARD_BLOCKED_HINT,
	DROP_HINT,
	PASTE_EVENT_WAIT_MS,
	PASTE_TEXT_HINT,
} from '../paste_drop.js';
import { getTrace } from '../trace_model.js';

let editor;
let canvas;

function glyphA() {
	return editor.project.getItem('glyph-0x41');
}

const toastText = () => document.querySelector('#toast')?.textContent || '';
const titles = () => editor.history.queue.map((entry) => entry.title);

function key(type, name, options = {}) {
	const event = new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true, ...options });
	document.body.dispatchEvent(event);
	return event;
}

/** Ctrl+<letter> through upstream's key handler, like a real key press. */
function ctrl(letter) {
	key('keydown', 'Control', { ctrlKey: true });
	const down = key('keydown', letter, { ctrlKey: true });
	key('keyup', letter, { ctrlKey: true });
	key('keyup', 'Control');
	return down;
}

/** A paste event carrying what the system clipboard holds (jsdom has no DataTransfer). */
function pasteEvent({ image = null, text = '' } = {}) {
	const event = new Event('paste', { bubbles: true, cancelable: true });
	const files = image ? [image] : [];
	Object.defineProperty(event, 'clipboardData', {
		value: {
			items: files.map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })),
			files,
			types: [...(image ? ['Files'] : []), ...(text ? ['text/plain'] : [])],
			getData: (type) => (type === 'text/plain' ? text : ''),
		},
	});
	return event;
}

/** Ctrl+V: the keydown, then (unless it was prevented) the browser's paste event. */
async function pressCtrlV(clipboard) {
	const down = ctrl('v');
	if (!down.defaultPrevented) await handlePasteSVGonEditCanvas(pasteEvent(clipboard));
	return down;
}

const photo = () => new File([new Uint8Array(32)], 'lettering.png', { type: 'image/png' });

/** Long enough for a Ctrl+V keydown to give up waiting for its paste event. */
const pastWait = () => new Promise((resolve) => setTimeout(resolve, PASTE_EVENT_WAIT_MS + 50));

/**
 * The system clipboard: `holds` is what is on it ({image} or {text}); writeText (ANY-INK's
 * copy note) replaces it; read() is the async read. Optionally the permission API too.
 * @param {Object} [options]
 * @param {Object} [options.holds] - what was copied before, e.g. { image: photo() }
 * @param {Boolean} [options.writeFails] - writeText rejects (window not focused, blocked)
 * @param {String} [options.readFails] - read() rejects with a DOMException of this name
 * @param {String} [options.permission] - what the clipboard-read permission says
 */
function systemClipboard({ holds = {}, writeFails = false, readFails = '', permission = '' } = {}) {
	const board = {
		holds,
		writeText: vi.fn(async (text) => {
			if (writeFails) throw new DOMException('Document is not focused.', 'NotAllowedError');
			board.holds = { text };
		}),
		read: vi.fn(async () => {
			if (readFails) throw new DOMException('Read permission denied.', readFails);
			const { image, text } = board.holds;
			const items = [];
			if (image) items.push({ types: [image.type], getType: async () => image });
			if (text) items.push({ types: ['text/plain'], getType: async () => new Blob([text]) });
			return items;
		}),
	};
	Object.defineProperty(navigator, 'clipboard', { value: board, configurable: true });
	if (permission) {
		const query = vi.fn(async () => ({ state: permission }));
		Object.defineProperty(navigator, 'permissions', { value: { query }, configurable: true });
	}
	return board;
}

beforeEach(() => {
	// jsdom has no Element.animate; showToast's removal timer calls it
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '<div id="editor-page__panel"></div>';
	const project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
	editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Attributes';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.editCanvas = { redraw() {} }; // no real canvas in jsdom
	canvas = document.createElement('canvas');
	document.body.appendChild(canvas);
	initEventHandlers(canvas);
	setDecoderForTests({
		decode: async () => ({ width: 300, height: 200, close() {} }),
		encode: async () => new Blob([new Uint8Array(8)], { type: 'image/webp' }),
	});
});

afterEach(() => {
	document.removeEventListener('keydown', handleKeyPress);
	document.removeEventListener('keyup', handleKeyUp);
	eventHandlerData.isCtrlDown = false;
	setDecoderForTests(null);
	delete navigator.clipboard;
	delete navigator.permissions;
	vi.restoreAllMocks();
});

describe('dragging a file over the canvas (fix track)', () => {
	it('says photos can be dropped to trace over them, not "Drop a SVG file"', () => {
		canvas.dispatchEvent(new Event('dragenter', { bubbles: true, cancelable: true }));
		expect(toastText()).toBe(DROP_HINT);
	});
});

describe('Ctrl+V after copying shapes (fix track)', () => {
	function copyFirstShape() {
		editor.multiSelect.shapes.select(glyphA().shapes[0]);
		ctrl('c');
		expect(editor.clipboard?.shapes?.length).toBe(1);
		editor.multiSelect.shapes.clear();
	}

	it('pastes a photo copied elsewhere afterwards as the trace image, not the old shapes', async () => {
		const board = systemClipboard();
		copyFirstShape();
		await Promise.resolve(); // the copy note lands on the system clipboard
		const shapesBefore = glyphA().shapes.length;

		// Brennan goes to Chrome, copies a photo, comes back
		board.holds = { image: photo() };
		window.dispatchEvent(new Event('blur'));
		const down = await pressCtrlV(board.holds);

		expect(down.defaultPrevented).toBe(false); // the browser's paste event gets through
		await vi.waitFor(() => expect(getTrace(glyphA())).not.toBe(null));
		expect(glyphA().shapes.length).toBe(shapesBefore);
		expect(titles()).not.toContain('Pasted shape');
	});

	it('still pastes the shapes right away when nothing can have changed the clipboard', async () => {
		copyFirstShape();
		const shapesBefore = glyphA().shapes.length;
		const down = await pressCtrlV({ image: photo() });
		expect(down.defaultPrevented).toBe(true);
		expect(glyphA().shapes.length).toBe(shapesBefore + 1);
		expect(titles()[0]).toBe('Pasted shape');
		expect(getTrace(glyphA())).toBe(null);
	});

	it('writes a note to the system clipboard on copy, so the shapes still paste after leaving the window', async () => {
		const writeText = vi.fn(async () => {});
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		copyFirstShape();
		await Promise.resolve();
		expect(writeText).toHaveBeenCalledWith(SHAPES_ON_CLIPBOARD_TEXT(1));
		expect(SHAPES_ON_CLIPBOARD_TEXT(2)).toBe('2 shapes copied in ANY-INK');

		window.dispatchEvent(new Event('blur'));
		const shapesBefore = glyphA().shapes.length;
		await pressCtrlV({ text: SHAPES_ON_CLIPBOARD_TEXT(1) });
		expect(glyphA().shapes.length).toBe(shapesBefore + 1);
		expect(toastText()).not.toBe(PASTE_TEXT_HINT);
	});

	it('with no paste event and a clipboard that cannot be read, the shapes still paste', async () => {
		const board = systemClipboard();
		board.read.mockImplementation(async () => {
			throw new Error('the clipboard is busy');
		});
		copyFirstShape();
		await Promise.resolve();
		window.dispatchEvent(new Event('blur'));
		const shapesBefore = glyphA().shapes.length;
		ctrl('v'); // no paste event follows
		await vi.waitFor(() => expect(glyphA().shapes.length).toBe(shapesBefore + 1));
		expect(board.read).toHaveBeenCalledTimes(1);
	});

	it('a copy with nothing selected leaves no note and no shapes to paste', () => {
		const writeText = vi.fn(async () => {});
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		editor.clipboard = false;
		noteShapeCopy(editor);
		expect(writeText).not.toHaveBeenCalled();
	});

	it('with no shapes copied, pasted text still gets the hint', async () => {
		await pressCtrlV({ text: '<svg></svg>' });
		expect(toastText()).toBe(PASTE_TEXT_HINT);
	});

	// Finalize (new problem): the Copy buttons call clipboardCopy directly, so only Ctrl+C
	// wrote the note, and an older photo still on the system clipboard won after any blur.
	it('a Copy button copy, then a trip to another window: Ctrl+V pastes the shapes, not an older photo', async () => {
		const board = systemClipboard({ holds: { image: photo() } }); // copied before the shapes
		editor.multiSelect.shapes.select(glyphA().shapes[0]);
		clipboardCopy(); // what the Actions panel's Copy button runs
		editor.multiSelect.shapes.clear();
		await Promise.resolve();
		window.dispatchEvent(new Event('blur')); // Alt+Tab away and back, nothing copied there
		const shapesBefore = glyphA().shapes.length;

		await pressCtrlV(board.holds);

		expect(glyphA().shapes.length).toBe(shapesBefore + 1);
		await pastWait();
		expect(getTrace(glyphA())).toBe(null);
		expect(board.writeText).toHaveBeenCalledTimes(1);
	});

	it('when the copy note cannot be written, the copied shapes still win after leaving the window', async () => {
		const board = systemClipboard({ holds: { image: photo() }, writeFails: true });
		copyFirstShape();
		await Promise.resolve();
		window.dispatchEvent(new Event('blur'));
		const shapesBefore = glyphA().shapes.length;

		await pressCtrlV(board.holds); // the older photo is still there

		expect(glyphA().shapes.length).toBe(shapesBefore + 1);
		await pastWait();
		expect(getTrace(glyphA())).toBe(null);
	});

	// Finalize (new problem): after a blur every Ctrl+V of shapes waited on the async read,
	// which can raise Chrome's clipboard prompt when the user just wants the shapes.
	it('after leaving the window, Ctrl+V of copied shapes never raises the clipboard permission prompt', async () => {
		const board = systemClipboard({ permission: 'prompt' });
		copyFirstShape();
		await Promise.resolve();
		window.dispatchEvent(new Event('blur'));
		const shapesBefore = glyphA().shapes.length;

		ctrl('v'); // no paste event follows
		await vi.waitFor(() => expect(glyphA().shapes.length).toBe(shapesBefore + 1));
		expect(board.read).not.toHaveBeenCalled();
		expect(navigator.permissions.query).toHaveBeenCalledWith({ name: 'clipboard-read' });
	});

	it('with the clipboard permission granted, a photo copied after the shapes still wins', async () => {
		const board = systemClipboard({ permission: 'granted' });
		copyFirstShape();
		await Promise.resolve();
		board.holds = { image: photo() };
		window.dispatchEvent(new Event('blur'));
		const shapesBefore = glyphA().shapes.length;

		ctrl('v'); // no paste event follows
		await vi.waitFor(() => expect(getTrace(glyphA())).not.toBe(null));
		expect(board.read).toHaveBeenCalledTimes(1);
		expect(glyphA().shapes.length).toBe(shapesBefore);
	});
});

describe('a paste with the page focused, not the canvas (finalize)', () => {
	// Chrome fires the paste event at the focused element, which is the page body while
	// editing (a press on the canvas never focuses it). Only the canvas listened, so every
	// Ctrl+V went through the async clipboard read and its permission prompt.
	it('reaches the trace layer through the paste event, with no clipboard read', async () => {
		const board = systemClipboard({ holds: { image: photo() } });
		const down = ctrl('v');
		expect(down.defaultPrevented).toBe(false);
		const paste = pasteEvent(board.holds);
		document.body.dispatchEvent(paste); // where Chrome sends it

		await vi.waitFor(() => expect(getTrace(glyphA())).not.toBe(null));
		expect(paste.defaultPrevented).toBe(true);
		await pastWait();
		expect(board.read).not.toHaveBeenCalled();
	});

	it('a paste into a text field stays in the field', async () => {
		systemClipboard({ holds: { image: photo() } });
		const input = document.createElement('input');
		document.body.appendChild(input);
		input.focus();
		const paste = pasteEvent({ image: photo(), text: 'A' });
		input.dispatchEvent(paste);

		expect(paste.defaultPrevented).toBe(false);
		await pastWait();
		expect(getTrace(glyphA())).toBe(null);
		expect(toastText()).toBe('');
	});

	it('on a page with no edit canvas, a paste does nothing', async () => {
		editor.nav.page = 'Overview';
		const paste = pasteEvent({ image: photo() });
		document.body.dispatchEvent(paste);

		expect(paste.defaultPrevented).toBe(false);
		await pastWait();
		expect(getTrace(glyphA())).toBe(null);
		expect(toastText()).toBe('');
	});
});

describe('a clipboard the browser will not let ANY-INK read (finalize)', () => {
	function copyFirstShape() {
		editor.multiSelect.shapes.select(glyphA().shapes[0]);
		ctrl('c');
		editor.multiSelect.shapes.clear();
	}

	it('says so, instead of doing nothing', async () => {
		systemClipboard({ readFails: 'NotAllowedError' });
		ctrl('v'); // no paste event follows
		await vi.waitFor(() => expect(toastText()).toBe(CLIPBOARD_BLOCKED_HINT));
		expect(getTrace(glyphA())).toBe(null);
	});

	it('copied shapes still paste', async () => {
		systemClipboard({ readFails: 'NotAllowedError' });
		copyFirstShape();
		await Promise.resolve();
		window.dispatchEvent(new Event('blur'));
		const shapesBefore = glyphA().shapes.length;
		ctrl('v');
		await vi.waitFor(() => expect(glyphA().shapes.length).toBe(shapesBefore + 1));
		expect(toastText()).not.toBe(CLIPBOARD_BLOCKED_HINT);
	});
});
