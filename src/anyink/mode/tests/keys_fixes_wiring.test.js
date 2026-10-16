// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix track, through the real key handler (edit_canvas/events_keyboard.js) and the real
// History (UX-BEGINNER.md 7.3 "no press that does nothing", 7.6, 6.2 "Keys", 6.3):
//   - Delete and Backspace act only on a picked shape or point (7.6): with nothing picked they
//     add no Undo step ("Deleted path: undefined") in either mode
//   - Ctrl+R in Simple is off: no Undo step, and the press is left to the browser (reload)
//   - Ctrl+E in Simple makes the .otf even for a font imported from a .woff (Simple shows only
//     the .otf row); All tools keeps the imported format
//   - Redo that lands on a page Simple hides says Redo took him there, not Undo
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { getActionData } from '../../../panels/actions.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { forgetExportFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { fakeApi } from '../../files/tests/fakes.js';
import { B, twoLetterProject } from '../../history/tests/two_letters.js';
import { kvClear } from '../../storage/kv.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import { arriveAt, backToSimple, bandState, makeBand } from '../band.js';
import { flagsOn, setFeaturesForTests } from '../features.js';
import { getVisit, setModeForTests } from '../mode.js';
import { sampleEditor } from './controls_probe.js';

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
function ctrl(key, options = {}) {
	press('Control');
	const event = press(key, { ctrlKey: true, ...options });
	release(key, { ctrlKey: true });
	release('Control');
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
	editor.multiSelect.shapes.clear();
	editor.multiSelect.points.clear();
}
const steps = () => editor.history.queue.map((entry) => entry.title);
async function waitFor(check, ms = 15000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return false;
}

beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetToastsForTests();
	editor = sampleEditor();
});
afterEach(() => {
	warn.mockRestore();
	resetFileApi();
	Object.assign(eventHandlerData, {
		isCtrlDown: false,
		isShiftDown: false,
		isAltDown: false,
		isSpaceDown: false,
		isPanning: false,
	});
	document.body.innerHTML = '';
});

describe('Delete and Backspace act only on a picked shape or point (7.6)', () => {
	it.each(['simple', 'all'])('%s: an empty letter, nothing picked: no Undo step', (mode) => {
		setModeForTests(mode);
		onLetter('glyph-0x62');
		const before = steps();
		['Delete', 'Delete', 'Delete', 'Backspace'].forEach((key) => {
			const event = press(key);
			release(key);
			expect(event.defaultPrevented, key).toBe(true);
		});
		expect(steps()).toEqual(before);
	});

	it('simple: a letter with an unpicked shape: the shape stays, no step', () => {
		setModeForTests('simple');
		onLetter();
		const shapes = editor.selectedItem.shapes.length;
		expect(shapes).toBeGreaterThan(0);
		const before = steps();
		press('Delete');
		editor.selectedTool = 'pathEdit';
		press('Delete');
		expect(editor.selectedItem.shapes).toHaveLength(shapes);
		expect(steps()).toEqual(before);
	});

	// B6 + B7 finalize: with Edit points picked, a shape picked with no point picked (the letter
	// card's Shapes list picks it so) is a picked shape: Simple's Delete takes it, as one step
	it('simple: Edit points, a shape picked and no point: Delete takes that shape, one step', () => {
		setModeForTests('simple');
		onLetter();
		const shapes = editor.selectedItem.shapes.length;
		const before = steps().length;
		editor.selectedTool = 'pathEdit';
		editor.multiSelect.shapes.select(editor.selectedItem.shapes[0]);
		press('Delete');
		expect(editor.selectedItem.shapes).toHaveLength(shapes - 1);
		expect(steps()).toHaveLength(before + 1);
	});

	it.each(['all'])('%s: a letter with an unpicked shape: the shape stays, no step', (mode) => {
		setModeForTests(mode);
		onLetter();
		const shapes = editor.selectedItem.shapes.length;
		expect(shapes).toBeGreaterThan(0);
		const before = steps();
		press('Delete');
		editor.selectedTool = 'pathEdit';
		editor.multiSelect.shapes.select(editor.selectedItem.shapes[0]);
		press('Delete');
		expect(editor.selectedItem.shapes).toHaveLength(shapes);
		expect(steps()).toEqual(before);
	});

	it.each(['simple', 'all'])('%s: a picked shape is deleted, one step', (mode) => {
		setModeForTests(mode);
		onLetter();
		const shapes = editor.selectedItem.shapes.length;
		editor.multiSelect.shapes.select(editor.selectedItem.shapes[0]);
		const before = steps().length;
		press('Delete');
		expect(editor.selectedItem.shapes).toHaveLength(shapes - 1);
		expect(steps()).toHaveLength(before + 1);
	});
});

describe('Ctrl+R', () => {
	it('Simple: no Undo step, and the press stays with the browser', () => {
		setModeForTests('simple');
		onLetter();
		editor.multiSelect.shapes.select(editor.selectedItem.shapes[0]);
		const before = steps();
		const event = ctrl('r');
		expect(event.defaultPrevented).toBe(false);
		expect(steps()).toEqual(before);
		editor.selectedTool = 'pathEdit';
		expect(ctrl('r').defaultPrevented).toBe(false);
		expect(steps()).toEqual(before);
	});

	it('All tools: rounds and records it, as today', () => {
		onLetter();
		editor.multiSelect.shapes.select(editor.selectedItem.shapes[0]);
		const before = steps().length;
		expect(ctrl('r').defaultPrevented).toBe(true);
		expect(steps()).toHaveLength(before + 1);
	});
});

describe('Ctrl+E on a font imported from a .woff', () => {
	let api;
	beforeEach(async () => {
		await kvClear();
		await forgetExportFolder();
		api = fakeApi({ open: [], save: undefined });
		setFileApi(api);
		// what font_import.js stores for a .woff
		editor.project.settings.project.exportFormat = 'woff';
	});

	it('Simple: makes the .otf, the one font file row Simple shows', async () => {
		setModeForTests('simple');
		setFeaturesForTests({ useInWord: false }); // B14 + B15 integration: Simple before B14
		onLetter();
		expect(ctrl('e').defaultPrevented).toBe(true);
		expect(await waitFor(() => api.calls.download.length > 0)).toBe(true);
		expect(api.calls.download[0].fileName).toMatch(/\.otf$/);
	}, 20000);

	it('All tools: the imported format, as today', async () => {
		onLetter();
		ctrl('e');
		expect(await waitFor(() => api.calls.download.length > 0)).toBe(true);
		expect(api.calls.download[0].fileName).toMatch(/\.woff$/);
	}, 20000);
});

describe('Redo that lands on a page Simple hides says Redo did it (6.3)', () => {
	const KERN = 'kern-1';
	const NO_FLAGS = flagsOn();

	/** A gap nudged in More tools, undone from Simple (landing), then Back to my letters. */
	function gapUndoneFromSimple() {
		const data = twoLetterProject().save();
		data.kerning = { [KERN]: { leftGroup: ['0x42'], rightGroup: ['0x72'], value: 0 } };
		editor = new ProjectEditor();
		editor.project = new GlyphrStudioProject(data);
		setCurrentProjectEditor(editor);
		editor.navigate = () => arriveAt(editor.nav.page, { isOn: NO_FLAGS });
		editor.editCanvas = { redraw() {} };
		editor.nav.page = 'Kerning';
		editor.selectedKernGroupID = KERN;
		editor.selectedKernGroup.value += 10;
		editor.history.addState(`Nudged kern group ${KERN} by 10`);
		setModeForTests('simple');
		editor.nav.page = 'Characters';
		editor.selectedItemID = B;
		ctrl('z');
		expect(getVisit()).toEqual({ page: 'Kerning', cause: 'undo' });
		backToSimple({ editor, isOn: NO_FLAGS });
		expect(editor.nav.page).toBe('Characters');
		expect(editor.project.kerning[KERN].value).toBe(0);
	}

	it.each([
		['Ctrl+Y', () => ctrl('y')],
		['Ctrl+Shift+Z', () => ctrl('Z', { shiftKey: true })],
	])('%s', (name, redo) => {
		gapUndoneFromSimple();
		redo();
		expect(editor.project.kerning[KERN].value).toBe(10);
		expect(editor.nav.page).toBe('Kerning');
		expect(getVisit()).toEqual({ page: 'Kerning', cause: 'redo' });
		expect(bandState().textKey).toBe('mode.band.landedRedo');
		expect(makeBand().textContent).toContain(word('mode.band.landedRedo'));
		expect(word('mode.band.landedRedo')).toMatch(/^Redo /);
	});

	it('the Redo button', () => {
		gapUndoneFromSimple();
		const redo = getActionData('allActions').find((data) => data.iconName === 'redo');
		redo.onClick();
		expect(getVisit()).toEqual({ page: 'Kerning', cause: 'redo' });
		expect(bandState().textKey).toBe('mode.band.landedRedo');
	});
});
