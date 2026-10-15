// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 wiring (UX-BEGINNER.md 7.6, 6.2 "Keys", section 10 B5 "the Simple key gates"): the real key
// handler (edit_canvas/events_keyboard.js) asks the one key map (keys.js) in both modes. All
// tools: P picks the Point pen and E Edit points (both modes, 7.6), the rest as upstream;
// Ctrl+O opens a saved font. Simple: Ctrl+Space, Ctrl+G, U and the layer order keys are off,
// Ctrl+E opens Use in Word once that flag is on, and a tool key that changes the tool says so.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { forgetExportFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { setSaveStatus } from '../../files/save_status.js';
import { fakeApi } from '../../files/tests/fakes.js';
import { kvClear } from '../../storage/kv.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import { arriveAt } from '../band.js';
import { FINE_TUNE_EVENT, USE_IN_WORD_EVENT } from '../doors.js';
import { setFeaturesForTests } from '../features.js';
import { getVisit, setModeForTests } from '../mode.js';
import { sampleEditor } from './controls_probe.js';

// The handler's own imports are the real ones (the vitest setup loads the app first), so each
// key is checked by what it really does: a download, a picker, a toast, an event.
const toasts = () => toastLog().filter((record) => record.source === 'key');

let editor;
let warn;

function press(key, options = {}) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
	handleKeyPress(event);
	return event;
}
function release(key, options = {}) {
	handleKeyUp(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true, ...options }));
}
/** Ctrl held, then the key, the way a real keyboard sends it */
function ctrl(key, options = {}) {
	press('Control');
	const event = press(key, { ctrlKey: true, ...options });
	release(key, { ctrlKey: true });
	release('Control');
	return event;
}
function onLetter() {
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = 'Characters';
	editor.navigate();
	editor.editCanvas = { redraw() {} };
	editor.eventHandlers.tool_addPath = {};
	editor.eventHandlers.tool_pan = { mousedown() {}, mouseup() {} };
	editor.selectedTool = 'resize';
}
const flushTimers = () => new Promise((resolve) => setTimeout(resolve, 30));
const fontFileStarted = () => toastLog().some((record) => record.key === 'toast.fontFileMaking');
async function waitFor(check, ms = 15000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return false;
}

let api;
let saved;
beforeEach(async () => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	await kvClear();
	await forgetExportFolder();
	resetToastsForTests();
	// both pickers exist (Chrome); the open picker is cancelled, the save picker never expected
	api = fakeApi({ open: [], save: undefined });
	setFileApi(api);
	saved = [];
	// upstream's download (file_io.js saveFile) tries this first: the SVG font file lands here
	window.navigator.msSaveBlob = (blob, fileName) => saved.push(fileName);
	editor = sampleEditor();
	editor.selectedGlyphID = 'glyph-0x41';
});
afterEach(() => {
	warn.mockRestore();
	resetFileApi();
	delete window.navigator.msSaveBlob;
	Object.assign(eventHandlerData, {
		isCtrlDown: false,
		isShiftDown: false,
		isAltDown: false,
		isSpaceDown: false,
		isPanning: false,
	});
	document.getElementById('hideUI')?.remove();
	document.body.innerHTML = '';
});

describe('tool keys, both modes (7.6)', () => {
	it.each(['all', 'simple'])(
		'%s: P Point pen, E Edit points, B and N the Brush (B8 landed), V/A Select',
		(mode) => {
			setModeForTests(mode);
			onLetter();
			const picks = {};
			['p', 'h', 'w', 'e', 'b', 'n', 'v', 'a', 'r', 'm', 'o', 'q'].forEach((key) => {
				editor.selectedTool = 'none';
				press(key);
				release(key);
				picks[key] = editor.selectedTool;
			});
			expect(picks).toEqual({
				p: 'newPath',
				h: 'newPath',
				w: 'newPath',
				e: 'pathEdit',
				// B8 + B9 integration: the Brush landed; B and N pick it in both modes (7.6)
				b: 'nib',
				n: 'nib',
				v: 'resize',
				a: 'resize',
				r: 'newRectangle',
				m: 'newRectangle',
				o: 'newOval',
				q: 'newOval',
			});
		}
	);

	it.each(['all', 'simple'])('%s, before B8 (the brush flag off): B as the fix track left it', (mode) => {
		setModeForTests(mode);
		setFeaturesForTests({ brush: false });
		onLetter();
		editor.selectedTool = 'none';
		press('b');
		release('b');
		expect(editor.selectedTool).toBe(mode === 'all' ? 'pathEdit' : 'none');
	});

	it('All tools: U picks Add a point; Simple: U does nothing', () => {
		onLetter();
		press('u');
		expect(editor.selectedTool).toBe('pathAddPoint');
		setModeForTests('simple');
		onLetter();
		press('u');
		expect(editor.selectedTool).toBe('resize');
	});

	it('Simple: a key that changes the tool says "Switched to Rectangle (R)"; the same tool again says nothing', () => {
		setModeForTests('simple');
		onLetter();
		press('r');
		expect(toasts().map((t) => t.key)).toEqual(['mode.toolSwitched']);
		expect(toasts()[0].text).toBe('Switched to Rectangle (R)');
		expect(toasts()[0].shown).toBe(true);
		press('m');
		expect(toasts()).toHaveLength(1);
		press('o');
		expect(toasts().map((t) => t.text)).toEqual([
			'Switched to Rectangle (R)',
			word('mode.toolSwitched', { tool: word('tool.newOval'), key: 'O' }),
		]);
	});

	it('All tools: no toast for a tool key', () => {
		onLetter();
		press('r');
		expect(toasts()).toEqual([]);
	});

	it('Simple with the letter view on: a Fine-tune tool key opens Fine-tune; Select does not', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		onLetter();
		const opened = [];
		const listen = (event) => opened.push(event.detail.tool);
		window.addEventListener(FINE_TUNE_EVENT, listen);
		press('e');
		press('v');
		window.removeEventListener(FINE_TUNE_EVENT, listen);
		expect(opened).toEqual(['pathEdit']);
	});

	it('tool keys never fire with Ctrl held (Ctrl+R rounds, Ctrl+A selects)', () => {
		setModeForTests('simple');
		onLetter();
		ctrl('r');
		expect(editor.selectedTool).toBe('resize');
		expect(toasts()).toEqual([]);
	});
});

describe('Ctrl+Space (hide the whole UI)', () => {
	function ctrlSpace() {
		press('Control');
		press(' ', { ctrlKey: true });
		const shown = !!document.getElementById('hideUI');
		release(' ', { ctrlKey: true });
		release('Control');
		return shown;
	}

	it('All tools: hides the UI, as today', () => {
		onLetter();
		expect(ctrlSpace()).toBe(true);
	});

	it('Simple: off, and it does not start panning either', () => {
		setModeForTests('simple');
		onLetter();
		expect(ctrlSpace()).toBe(false);
		expect(eventHandlerData.isPanning).toBeFalsy();
	});

	it('Simple: letting go of Ctrl+Space leaves the tool as it was', () => {
		setModeForTests('simple');
		onLetter();
		editor.selectedTool = 'newRectangle';
		ctrlSpace();
		expect(editor.selectedTool).toBe('newRectangle');
	});

	it('Simple: Space alone still pans (Space-drag)', () => {
		setModeForTests('simple');
		onLetter();
		press(' ');
		expect(editor.selectedTool).toBe('pan');
		release(' ');
	});
});

describe('Ctrl+G (the SVG font file)', () => {
	it('All tools: makes it, as today', async () => {
		onLetter();
		ctrl('g');
		await flushTimers();
		expect(saved).toHaveLength(1);
		expect(saved[0]).toMatch(/\.svg$/);
	});

	it('Simple: off', async () => {
		setModeForTests('simple');
		onLetter();
		ctrl('g');
		await flushTimers();
		expect(saved).toEqual([]);
	});
});

describe('Ctrl+E (the font file)', () => {
	it.each(['all', 'simple'])(
		'%s with no flag: makes the font file, as today',
		async (mode) => {
			setModeForTests(mode);
			onLetter();
			const event = ctrl('e');
			expect(event.defaultPrevented).toBe(true);
			expect(await waitFor(() => api.calls.download.length > 0)).toBe(true);
			expect(api.calls.download[0].fileName).toMatch(/\.otf$/);
		},
		20000
	);

	it('Simple with Use in Word on: opens Use in Word and makes no file', async () => {
		setModeForTests('simple');
		setFeaturesForTests({ useInWord: true });
		onLetter();
		const opened = [];
		const listen = (event) => opened.push(event.detail);
		window.addEventListener(USE_IN_WORD_EVENT, listen);
		ctrl('e');
		window.removeEventListener(USE_IN_WORD_EVENT, listen);
		await flushTimers();
		expect(opened).toEqual([{ cause: 'key' }]);
		expect(fontFileStarted()).toBe(false);
		expect(api.calls.download).toEqual([]);
	});

	it('All tools with Use in Word on: still the font file (Use in Word is Simple only)', async () => {
		setFeaturesForTests({ useInWord: true });
		onLetter();
		ctrl('e');
		expect(await waitFor(() => api.calls.download.length > 0)).toBe(true);
	}, 20000);
});

describe('Ctrl+O (open a saved font, 7.6)', () => {
	it.each(['all', 'simple'])('%s: the work file picker, never a new window', async (mode) => {
		setModeForTests(mode);
		const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
		onLetter();
		setSaveStatus(editor, { file: 'saved' });
		const event = ctrl('o');
		expect(await waitFor(() => api.calls.open.length === 1, 2000)).toBe(true);
		expect(opened).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
		opened.mockRestore();
	});

	it('works on a page with no canvas too (Overview)', async () => {
		document.body.innerHTML = '<div id="app__wrapper"></div>';
		editor.nav.page = 'Overview';
		setSaveStatus(editor, { file: 'saved' });
		ctrl('o');
		expect(await waitFor(() => api.calls.open.length === 1, 2000)).toBe(true);
	});

	it('work not in its file: the box asks first, and no picker opens yet', async () => {
		onLetter();
		ctrl('o');
		await flushTimers();
		expect(api.calls.open).toEqual([]);
		expect(document.querySelector('#modal-dialog').textContent).toContain(word('open.unsaved'));
	});
});

describe('layer order keys', () => {
	function twoShapes() {
		onLetter();
		const glyph = editor.selectedItem;
		glyph.addOneShape({ name: 'one', objType: 'Path', pathPoints: [] });
		glyph.addOneShape({ name: 'two', objType: 'Path', pathPoints: [] });
		editor.multiSelect.shapes.select(glyph.shapes.at(-2));
		return glyph;
	}
	const order = (glyph) => glyph.shapes.map((shape) => shape.name).slice(-2);

	it('All tools: Ctrl+] moves the picked shape up, as today', () => {
		const glyph = twoShapes();
		ctrl(']');
		expect(order(glyph)).toEqual(['two', 'one']);
	});

	it('Simple: Ctrl+] and Ctrl+[ are off; ] still picks the next shape', () => {
		setModeForTests('simple');
		const glyph = twoShapes();
		ctrl(']');
		expect(order(glyph)).toEqual(['one', 'two']);
		editor.multiSelect.shapes.select(glyph.shapes.at(-1));
		ctrl('[');
		expect(order(glyph)).toEqual(['one', 'two']);
		editor.multiSelect.shapes.select(glyph.shapes.at(-2));
		press(']');
		expect(editor.multiSelect.shapes.members.map((shape) => shape.name)).toEqual(['two']);
	});
});

describe('Undo from the keys takes the landing rule its cause (6.3)', () => {
	it('Simple: Ctrl+Z that lands on a page Simple hides says Undo took him there', () => {
		onLetter();
		editor.navigate = () => arriveAt(editor.nav.page);
		editor.nav.page = 'Kerning';
		editor.history.addState('a change on the Kerning page');
		editor.nav.page = 'Characters';
		setModeForTests('simple');
		ctrl('z');
		expect(editor.nav.page).toBe('Kerning');
		expect(getVisit()).toEqual({ page: 'Kerning', cause: 'undo' });
	});
});
