// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4: each main-path toast the spec lists (UX-BEGINNER.md section 10 B4, 2.4 G) runs through its
// real call site and comes out as its words key in Simple, or as nothing where the spec says
// Simple never shows it. All tools keeps its words, except a toast both modes share (2.2).
//   history.js          "No more undo", "No more redo", "Restored deleted item", "Navigated
//                       without undo-ing"
//   trace_import.js     the photo toasts ("Added a trace image. Press Start auto-trace ...")
//   events_keyboard.js  "Values were rounded for the selected path points" (Ctrl+R)
//   recovery            "Crash recovery could not save a snapshot ...", "Open the Recover tab",
//                       "Recovered ... from ..."
//   panels/actions.js   Merge ("Uniting all glyph shapes")
//   files               "Saved project file": the status pill only
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleDropSVGonEditCanvas } from '../../../edit_canvas/events_drag_drop_paste.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { getActionData } from '../../../panels/actions.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { publish, subscribe, unsubscribe } from '../../../project_editor/pub_sub.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { AssetStore } from '../../assets/asset_store.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { getSaveStatus } from '../../files/save_status.js';
import { fakeApi, fakeFileHandle } from '../../files/tests/fakes.js';
import { B, R, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { actionInAllTools } from '../../mode/tests/all_tools_action.js';
import { showItem } from '../../preview/show_item.js';
import {
	SNAPSHOT_DELAY_MS,
	initRecovery,
	markDirty,
	restoreSession,
	setRecoveryDeps,
	stopRecovery,
} from '../../recovery/recovery.js';
import { fakeLocks } from '../../recovery/tests/fake_locks.js';
import { recClear, recSet, setStorageDriver } from '../../storage/kv.js';
import { fakeDriver } from '../../storage/tests/fake_driver.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { ADDED_MESSAGE, importTraceImage, removeTrace } from '../../trace/trace_import.js';
import { word } from '../../words/words.js';
import { resetToastsForTests, toastLog, upstreamToast } from '../toast.js';
import { mapUpstreamToast } from '../upstream_map.js';

const toasts = () => [...document.querySelectorAll('#toast')];
const live = () => toasts().filter((el) => !el.hasAttribute('data-leaving'));
const shownText = () => live().at(-1)?.textContent.replace(/\s+/g, ' ').trim() ?? '';
const lastLog = () => toastLog().at(-1);

let warn;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '';
	resetToastsForTests();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	resetToastsForTests();
	vi.useRealTimers();
	warn.mockRestore();
	setModeForTests('all');
	eventHandlerData.isCtrlDown = false;
	document.body.innerHTML = '';
});

/** The simple example font, Capital A open on the Characters page. */
function letterEditor() {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.selectedGlyph;
	editor.selectedTool = 'resize';
	return editor;
}

// --------------------------------------------------------------
// history.js
// --------------------------------------------------------------

describe('history.js', () => {
	it('"No more undo" / "No more redo": All tools as before; Simple never says them', () => {
		const editor = twoLetterEditor();
		editor.history.restoreState();
		expect(shownText()).toBe('No more undo');
		expect(lastLog()).toMatchObject({ message: 'No more undo', key: null, reason: 'all-tools' });
		editor.history.redoState();
		expect(shownText()).toBe('No more redo');

		document.body.innerHTML = '';
		setModeForTests('simple');
		editor.history.restoreState();
		editor.history.redoState();
		expect(toasts()).toEqual([]);
		expect(mapUpstreamToast('No more undo', { mode: 'simple' })).toMatchObject({
			show: false,
			reason: 'never',
		});
	});

	it('"Navigated without undo-ing": All tools as before; never in Simple', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor);
		showItem(editor, R);
		traceInto(editor, 60);
		editor.history.restoreState();
		editor.history.restoreState(); // upstream's navigation press
		expect(shownText()).toBe('Navigated without undo-ing');
		const entry = lastLog();
		expect(entry).toMatchObject({ key: null, reason: 'all-tools' });
		expect(mapUpstreamToast(entry.message, { mode: 'simple' }).show).toBe(false);
	});

	it('"Restored deleted item": All tools as before; Simple words name the letter from its characters', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor);
		showItem(editor, R);
		traceInto(editor, 60);
		getActionData('glyphActions')
			.find((data) => data.iconName === 'deleteGlyph')
			.onClick();
		editor.history.restoreState();
		expect(toasts()[0].innerHTML).toBe('Restored deleted item<br>Latin Small Letter R');
		const entry = lastLog();
		expect(entry).toMatchObject({
			key: 'toast.broughtBack',
			reason: 'all-tools',
			context: { chars: 'r' },
		});
		expect(mapUpstreamToast(entry.message, { mode: 'simple', context: entry.context }).text).toBe(
			'Brought back small r'
		);
	});
});

// --------------------------------------------------------------
// events_keyboard.js: Ctrl+R
// --------------------------------------------------------------

describe('events_keyboard.js (Ctrl+R with Edit points)', () => {
	function pressCtrlR() {
		const editor = letterEditor();
		editor.editCanvas = { redraw() {} };
		editor.selectedTool = 'pathEdit';
		handleKeyPress(new KeyboardEvent('keydown', { key: 'Control', cancelable: true }));
		handleKeyPress(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, cancelable: true }));
		handleKeyUp(new KeyboardEvent('keyup', { key: 'Control', cancelable: true }));
	}

	it('All tools keeps its words', () => {
		pressCtrlR();
		expect(shownText()).toBe('Values were rounded for the selected path points.');
	});

	it('Simple says nothing: ANY-INK rounds silently (2.4 G)', () => {
		setModeForTests('simple');
		pressCtrlR();
		expect(toasts()).toEqual([]);
		// Ctrl+R may be off in Simple (keys.js); either way nothing is shown, and the message,
		// when something raises it, is never shown
		expect(toastLog().filter((record) => record.shown)).toEqual([]);
		upstreamToast('Values were rounded for the selected path points.');
		expect(lastLog()).toMatchObject({ key: null, shown: false, reason: 'never' });
	});
});

// --------------------------------------------------------------
// Merge
// --------------------------------------------------------------

describe('Merge (the Attributes panel button, project_editor/actions.js)', () => {
	function pressMerge() {
		letterEditor();
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		// B5: Simple doesn't draw this icon (6.2), so it is taken as All tools draws it and
		// pressed in the test's mode (its code is the Merge Simple keeps in Shape options)
		actionInAllTools('glyphActions', 'combine_unite').onClick();
	}

	it.each(['simple', 'all'])('%s: "Merging the shapes..." then "Merged the shapes"', (mode) => {
		setModeForTests(mode);
		pressMerge();
		expect(shownText()).toBe('Merging the shapes...');
		expect(lastLog()).toMatchObject({ key: 'toast.merging', shown: true });
		vi.advanceTimersByTime(250); // the merge itself runs 200 ms later
		expect(shownText()).toBe('Merged the shapes');
		expect(lastLog()).toMatchObject({ key: 'toast.merged', shown: true });
	});
});

// --------------------------------------------------------------
// trace_import.js
// --------------------------------------------------------------

describe('trace_import.js (the photo toasts)', () => {
	const jpeg = () => new File([new Uint8Array(16)], 'handwriting.jpg', { type: 'image/jpeg' });
	beforeEach(() => {
		document.body.innerHTML = '<div id="editor-page__panel"></div>';
		setDecoderForTests({
			decode: async () => ({ width: 400, height: 800, close() {} }),
			encode: async (_bitmap, options) =>
				new Blob([`${options.width}x${options.height}`], { type: 'image/webp' }),
		});
	});
	afterEach(() => setDecoderForTests(null));

	it("Simple, before B9's photo card: a photo is turned away with what to do instead", async () => {
		// fix track: Simple has no Trace panel, auto-trace, fade, hide or remove (principle 8),
		// so a photo dropped on a letter used to sit there, a dead end
		setModeForTests('simple');
		const editor = letterEditor();
		const steps = editor.history.queue.length;
		expect(await importTraceImage(jpeg(), { editor })).toBe(false);
		expect(lastLog()).toMatchObject({ key: 'toast.photoNotYet', shown: true });
		expect(shownText()).toBe(
			"ANY-INK can't use photos yet. Draw the letter with the Rectangle, Oval or Point pen for now."
		);
		expect(editor.selectedItem.anyink?.trace).toBeFalsy();
		expect(editor.history.queue.length).toBe(steps);
		// the drop on the canvas goes the same way, and so does a photo with no letter open
		const drop = new Event('drop', { cancelable: true });
		drop.dataTransfer = { files: [jpeg()] };
		handleDropSVGonEditCanvas(drop);
		await vi.waitFor(() => expect(lastLog()).toMatchObject({ key: 'toast.photoNotYet' }));
		expect(editor.selectedItem.anyink?.trace).toBeFalsy();
		// All tools is as it was
		setModeForTests('all');
		expect(await importTraceImage(jpeg(), { editor })).toBe(true);
	});

	it('Simple: added, replaced, taken off, each by its key', async () => {
		setModeForTests('simple');
		setFeaturesForTests({ photo: true }); // B9's photo card lets photos in
		const editor = letterEditor();
		expect(await importTraceImage(jpeg(), { editor })).toBe(true);
		expect(lastLog()).toMatchObject({ key: 'toast.photoAdded', shown: true });
		expect(shownText()).toBe(word('toast.photoAdded', { letter: 'Capital A' }));
		expect(await importTraceImage(jpeg(), { editor })).toBe(true);
		expect(shownText()).toBe(word('toast.photoReplaced'));
		expect(removeTrace({ editor })).toBe(true);
		expect(shownText()).toBe(word('toast.photoRemoved'));
	});

	it('Simple: an iPhone photo and a file that is not a photo say why, by key', async () => {
		setModeForTests('simple');
		setFeaturesForTests({ photo: true });
		const editor = letterEditor();
		await importTraceImage(new File([new Uint8Array(4)], 'IMG_1.HEIC', { type: 'image/heic' }), {
			editor,
		});
		expect(lastLog()).toMatchObject({ key: 'toast.photoHeic', shown: true });
		await importTraceImage(new File(['hi'], 'notes.txt', { type: 'text/plain' }), { editor });
		expect(lastLog()).toMatchObject({ key: 'toast.photoWrongType', shown: true });
	});

	it('All tools: the added toast keeps pointing at Start auto-trace; shared toasts use house words', async () => {
		const editor = letterEditor();
		await importTraceImage(jpeg(), { editor });
		expect(toasts()[0].innerHTML).toBe(ADDED_MESSAGE);
		expect(ADDED_MESSAGE).toContain('Start auto-trace');
		await importTraceImage(jpeg(), { editor });
		expect(shownText()).toBe('Replaced the photo');
	});
});

// --------------------------------------------------------------
// recovery
// --------------------------------------------------------------

describe('recovery (backup copies)', () => {
	let restoreDriver;
	let restoreDeps;
	let driver;
	let editor;
	let now;

	function fakeProject(id, name = 'Test Font') {
		const glyphs = { 'glyph-0x41': { advanceWidth: 600 } };
		return {
			settings: { project: { id, name } },
			glyphs,
			save: () => ({ settings: { project: { id, name } }, glyphs: structuredClone(glyphs) }),
		};
	}

	beforeEach(async () => {
		vi.useFakeTimers();
		driver = fakeDriver();
		restoreDriver = setStorageDriver(driver);
		await recClear();
		now = 1_000_000;
		editor = {
			subscribers: {},
			project: fakeProject('p1'),
			assets: new AssetStore(),
			loadedFileHandle: false,
			setProjectAsUnsaved: vi.fn(),
			saveProjectFile: vi.fn(),
			multiSelect: { shapes: { clear() {} }, points: { clear() {} } },
			history: {
				isRestoring: false,
				serializeForStorage: () => ({ version: 3, queue: [], redoQueue: [] }),
				adoptSnapshot: () => true,
			},
			publish,
			subscribe,
			unsubscribe,
		};
		const locks = fakeLocks();
		let id = 0;
		// every piece but the toast, which stays the module's own (toast.js)
		restoreDeps = setRecoveryDeps({
			getEditor: () => editor,
			getEditors: () => [editor],
			locks: () => locks,
			now: () => now,
			importProject: vi.fn(),
			makeSessionId: () => `s${++id}`,
		});
	});
	afterEach(() => {
		stopRecovery();
		restoreDeps();
		restoreDriver();
	});

	it.each(['simple', 'all'])(
		'%s: a failed backup write says so in house words, with a Save button',
		async (mode) => {
			setModeForTests(mode);
			driver.failWhen((op) => op === 'set');
			initRecovery();
			markDirty(editor.history);
			await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
			expect(lastLog()).toMatchObject({ key: 'toast.backupFailed', shown: true });
			expect(shownText()).toBe(`${word('toast.backupFailed')} Save`);
			live()[0].querySelector('button').click();
			expect(editor.saveProjectFile).toHaveBeenCalledTimes(1);
		}
	);

	it.each([
		['simple', 'Opened the backup copy of Crashed Font from 7 minutes ago'],
		['all', 'Opened the backup copy of Crashed Font from 7 minutes ago'],
	])('%s: opening a backup copy names it', async (mode, text) => {
		setModeForTests(mode);
		await recSet('session:x', {
			id: 'x',
			name: 'Crashed Font',
			time: now - 7 * 60000,
			dirty: true,
			project: {},
		});
		await restoreSession('session:x');
		expect(lastLog()).toMatchObject({ key: 'toast.backupOpened', shown: true });
		expect(shownText()).toBe(text);
	});

	it('"Open the Recover tab": All tools as before; removed in Simple (2.4 G)', async () => {
		const orphan = {
			id: 'p1',
			name: 'Test Font',
			time: now - 60000,
			dirty: true,
			hasFile: true,
			project: fakeProject('p1').save(),
		};
		await recSet('session:p1', orphan);
		setModeForTests('simple');
		initRecovery();
		await vi.advanceTimersByTimeAsync(10);
		expect(toasts()).toEqual([]);
		expect(lastLog()).toMatchObject({ source: 'key', key: null, shown: false });

		stopRecovery();
		document.body.innerHTML = '';
		setModeForTests('all');
		initRecovery();
		await vi.advanceTimersByTimeAsync(10);
		expect(shownText()).toBe(
			'Unsaved work from an earlier session exists for Test Font. Open the Recover tab to restore it.'
		);
	});
});

// --------------------------------------------------------------
// files: Save
// --------------------------------------------------------------

describe('files (Save)', () => {
	afterEach(() => resetFileApi());

	async function save() {
		setFileApi(fakeApi({ open: [], save: new Error('the picker must not open') }));
		const editor = letterEditor();
		editor.loadedFileHandle = fakeFileHandle('Brennan Hand.gs2');
		editor.setProjectAsUnsaved();
		expect(await editor.saveProjectFile()).toBe(true);
		return editor;
	}

	it('Simple: no toast; the save status says it (the status pill, 2.4 G)', async () => {
		setModeForTests('simple');
		const editor = await save();
		expect(toasts()).toEqual([]);
		expect(lastLog()).toMatchObject({ key: null, shown: false, reason: 'all-tools only' });
		expect(getSaveStatus(editor).file).toBe('saved');
	});

	it('All tools: "Saved Brennan Hand.gs2", as before', async () => {
		await save();
		expect(shownText()).toBe('Saved Brennan Hand.gs2');
	});
});
