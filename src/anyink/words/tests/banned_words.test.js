// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4: the banned-word scan (UX-BEGINNER.md 2.3, principle 2). No word on the banned list may
	appear on the Simple main path: in the visible text, title and aria-label of a Simple screen,
	in text drawn on a canvas (a fillText / strokeText spy), in a toast (a recorder on the page),
	or in a words.js entry not marked quote. Sentence case too (2.2): no text shown in capitals.

	This scans what exists today in Simple mode: the words, the Undo titles, the edit canvas's
	guide labels and drag readouts, the File menu, the preview strip with its font check line,
	the save status, the app notices, and the toasts of every Simple flow that exists (undo and
	redo, a photo, Merge, tidy points, Save, the font file export). Later Bs add their screens
	with scanSimpleScreen (./banned_scan.js) in their own test files; the todo list at the end
	names them.

	A surface that still has hits carries { pending: '<track>' }, the B4 track that cleans it:
	the test then checks the hits are still there, so the suite stays green until that track
	lands, and it turns red the day the surface is clean. To re-enable the full check, delete the
	surface's pending option. To see every pending surface's hits:
	  ANYINK_SCAN_ALL=1 npx vitest run src/anyink/words/tests/banned_words.test.js
	(PowerShell: $env:ANYINK_SCAN_ALL = '1'; npx vitest run ...)
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { makeAppTopBar } from '../../../app/menu.js';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { EditCanvas } from '../../../edit_canvas/edit_canvas.js';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { combineUniteAllGlyphPaths } from '../../../project_editor/actions.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { forgetExportFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { saveStatusText } from '../../files/save_status.js';
import {
	clearDialogs,
	fakeApi,
	fakeDirectoryHandle,
	fakeFileHandle,
} from '../../files/tests/fakes.js';
import { exportProblemsClause } from '../../fontcheck/export_toast.js';
import { runFontCheckNow } from '../../fontcheck/font_check.js';
import {
	edgeProjectJSON,
	openProject,
	square,
	twoPointShape,
} from '../../fontcheck/tests/fixtures.js';
import { PROBLEM } from '../../fontcheck/validate.js';
import { B, R, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { collectGuideLines } from '../../metrics/hit_test.js';
import { drawGuidesLayerOverlay } from '../../metrics/overlay.js';
import { guidesLayerState, resetGuidesLayerState } from '../../metrics/state.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { shownIds } from '../../mode/visibility.js';
import { noFlags } from '../../mode/tests/no_flags.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { buildFailureText, hintFor, moreText } from '../../preview/font_status.js';
import { PreviewStrip } from '../../preview/preview_strip.js';
import { showItem } from '../../preview/show_item.js';
import { resetNotices } from '../../pwa/notices.js';
import { announceOfflineReady, offerInstall, resetLaunch } from '../../pwa/register.js';
import { kvClear } from '../../storage/kv.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { importTraceImage, removeTrace } from '../../trace/trace_import.js';
import { scanTexts } from '../banned.js';
import { historyText } from '../history_text.js';
import { wordEntry, wordKeys } from '../words.js';
import { expectNoBanned, scanSimpleScreen } from './banned_scan.js';

/** B4 + B5 fix pass: these surfaces are clean, so they are scanned strict (2.4 E and G too). */
const scanStrict = (name, build, options = {}) =>
	scanSimpleScreen(name, build, { strict: true, ...options });
import { HISTORY_SAMPLES } from './history_samples.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = (path) => readFileSync(join(here, '../../..', path), 'utf8');
const VIEW = Object.freeze({ dx: 300, dy: 700, dz: 0.25 });

/** Stylesheets the scan needs, so jsdom sees the sentence-case rule (vitest skips CSS imports). */
function addStyles(...paths) {
	paths.forEach((path) => {
		const style = document.createElement('style');
		style.dataset.scan = path;
		style.textContent = css(path);
		document.head.appendChild(style);
	});
}

/** The simple example font in a real editor, Capital A open on the Characters page. */
function letterEditor() {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.selectedGlyph; // the letter record, as opening it in the app makes
	editor.selectedTool = 'resize';
	editor.view = { ...VIEW };
	Object.assign(editor.systemGuides, {
		ascent: true,
		capHeight: true,
		xHeight: true,
		baseline: true,
		descent: true,
		leftSide: true,
		rightSide: true,
	});
	return editor;
}

/** Runs the real edit canvas redraw on a fresh (spied) mock context. */
function redrawEditCanvas(editor) {
	const canvas = document.createElement('canvas');
	canvas.width = 1200;
	canvas.height = 1000;
	const ctx = canvas.getContext('2d');
	const host = { ctx, width: 1200, height: 1000, editingItemID: editor.selectedItemID };
	EditCanvas.prototype.redraw.call(host, 'test');
	return ctx;
}

/** The B1 check's font: small a has ink but no width, the question mark a 2-point shape. */
function openBroken() {
	const json = edgeProjectJSON();
	json.glyphs['glyph-0x61'] = { id: 'glyph-0x61', advanceWidth: 0, shapes: [square()] };
	json.glyphs['glyph-0x3F'] = { id: 'glyph-0x3F', advanceWidth: 500, shapes: [twoPointShape()] };
	return openProject(json);
}

async function waitFor(check, ms = 8000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return false;
}

/** The menu with the file rows: B6's Menu in Simple's top bar, the File menu otherwise */
function openFileMenu() {
	document.querySelectorAll('#app__top-bar').forEach((el) => el.remove());
	const topBar = makeAppTopBar();
	document.body.appendChild(topBar);
	const simpleMenu = topBar.querySelector('[data-anyink-control="menu"]');
	if (simpleMenu) simpleMenu.click();
	else [...topBar.querySelectorAll('.menu-entry-point')].find((b) => b.textContent === 'File').click();
	return document.querySelector('#context-menu');
}

let warn;
beforeAll(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	if (!customElements.get('preview-strip')) customElements.define('preview-strip', PreviewStrip);
	if (!customElements.get('display-canvas')) customElements.define('display-canvas', DisplayCanvas);
});
beforeEach(async () => {
	localStorage.clear();
	resetPrefsCache();
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
	vi.stubGlobal('requestAnimationFrame', (callback) => callback());
	addStyles('anyink/theme/tokens.css');
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	vi.unstubAllGlobals();
	vi.useRealTimers();
	resetFileApi();
	resetGuidesLayerState();
	resetNotices();
	resetLaunch();
	clearDialogs();
	eventHandlerData.isCtrlDown = false;
	eventHandlerData.isShiftDown = false;
	setModeForTests('all');
	document.body.innerHTML = '';
	document.head.querySelectorAll('style[data-scan]').forEach((style) => style.remove());
});

// --------------------------------------------------------------
// Words
// --------------------------------------------------------------

describe('words.js', () => {
	it("no entry says a banned word (a quote entry's text is exempt, its hint is not)", () => {
		const hits = [];
		wordKeys().forEach((key) => {
			const { text, hint, like, quote } = wordEntry(key);
			const texts = [quote ? '' : text, hint, like].filter(Boolean);
			hits.push(...scanTexts(texts, `word:${key}`, { strict: true }));
		});
		expectNoBanned(hits);
	});

	it('every Undo title comes out in plain words', () => {
		const shown = HISTORY_SAMPLES.map(({ title, context }) => historyText(title, context));
		expectNoBanned(scanTexts(shown, 'undo title', { strict: true }));
	});
});

// --------------------------------------------------------------
// Canvas text
// --------------------------------------------------------------

describe('canvas text', () => {
	scanStrict('the edit canvas: a letter with its guide labels on', () => {
		const editor = letterEditor();
		editor.project.settings.app.guides.systemShowLabels = true;
		redrawEditCanvas(editor);
		return null;
	});

	scanStrict('the edit canvas: pointing at a side edge', () => {
		const editor = letterEditor();
		editor.project.settings.app.guides.systemShowLabels = false;
		['lsb', 'rsb'].forEach((side) => {
			guidesLayerState.hover = side;
			redrawEditCanvas(editor);
		});
		return null;
	});

	scanStrict('drag readouts: pointing at and dragging every guide line', () => {
		const editor = letterEditor();
		const canvas = document.createElement('canvas');
		canvas.width = 1200;
		canvas.height = 1000;
		const ctx = canvas.getContext('2d');
		const item = editor.selectedItem;
		const { font, app } = editor.project.settings;
		const lines = collectGuideLines({
			font,
			systemGuides: editor.systemGuides,
			guides: app.guides,
			item,
		});
		lines.forEach((line) => {
			Object.assign(guidesLayerState, {
				line,
				hover: line.id,
				dragging: false,
				pointer: { x: 200, y: 200 },
			});
			drawGuidesLayerOverlay(ctx, editor.view, item);
			Object.assign(guidesLayerState, {
				dragging: line.id,
				baselineDelta: line.kind === 'baseline' ? 20 : 0,
			});
			drawGuidesLayerOverlay(ctx, editor.view, item);
		});
		return null;
	});
});

// --------------------------------------------------------------
// Shared display points
// --------------------------------------------------------------

describe('shared display points', () => {
	scanStrict('the File menu', () => {
		noFlags(); // the File menu Simple had before B6's Menu (scanned in topbar_words.test.js)
		setFileApi(fakeApi({ open: [], save: fakeFileHandle('Brennan Hand.gs2') }));
		letterEditor();
		const menu = openFileMenu();
		// B5 (6.2 Menus): Simple's File menu is the rows visibility.js shows there (Save, Save
		// as..., the .otf font file; B4 + B5 fix pass: the mode track may add rows), scanned all
		const rows = [...menu.querySelectorAll('[data-anyink-row]')];
		const shown = shownIds('menuRow', { mode: 'simple' })
			.filter((id) => id.startsWith('file.') && !id.startsWith('file.heading'))
			.map((id) => id.slice('file.'.length));
		expect(rows.map((row) => row.dataset.anyinkRow)).toEqual(shown);
		expect(shown).toEqual(expect.arrayContaining(['save', 'save-as', 'font-otf']));
		return menu;
	});

	scanStrict('the preview strip, with the font check line', async () => {
		noFlags(); // the line Simple had before B6; since B6 the Next line says it (coach_words)
		addStyles('anyink/preview/preview-strip.css', 'anyink/preview/preview-notice.css');
		const editor = openBroken();
		const strip = document.createElement('preview-strip');
		document.body.appendChild(strip);
		strip.hidden = false;
		strip.attachEditor(editor);
		runFontCheckNow(editor);
		const line = () => strip.querySelector('.preview-strip__check');
		expect(await waitFor(() => line() && !line().hidden, 2000)).toBe(true);
		expect(line().textContent).toMatch(/question mark .*1 more letter needs fixing too/);
		return strip;
	});

	scanStrict('the font check sentences', () => {
		const { project } = openBroken();
		const problem = (itemId, kind) => ({ itemId, problem: kind, message: '' });
		return {
			root: null,
			texts: {
				'font check': [
					...Object.values(PROBLEM).map((kind) => hintFor(kind, false)),
					moreText(1),
					moreText(2, 1),
					moreText(0, 2, true),
					buildFailureText(null),
					buildFailureText({ name: 'small a' }),
					exportProblemsClause(
						[problem('glyph-0x61', PROBLEM.inkNoWidth), problem('glyph-0x3F', PROBLEM.shape)],
						project
					),
				],
			},
		};
	});

	scanStrict('the save status, in every state', () => {
		const states = [];
		['none', 'pending', 'saving', 'saved', 'failed'].forEach((file) =>
			['none', 'pending', 'saved', 'failed'].forEach((recovery) =>
				states.push(saveStatusText({ revision: 1, file, recovery, error: '' }))
			)
		);
		return { root: null, texts: { 'save status': states } };
	});

	// B12 + B13 integration: in Simple the install offer is a toast now (start/install_offer.js),
	// scanned in start/tests/install_offer.test.js; Simple puts up no install notice
	scanStrict('the app notices: ready offline, and no install notice', () => {
		announceOfflineReady();
		expect(document.querySelectorAll('.anyink-pwa-notice')).toHaveLength(1);
		const shown = document.body.cloneNode(true);
		resetNotices();
		resetLaunch();
		document.body.innerHTML = '';
		const event = new Event('beforeinstallprompt', { cancelable: true });
		event.prompt = async () => {};
		event.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
		offerInstall(event);
		expect(document.querySelectorAll('.anyink-pwa-notice')).toHaveLength(0);
		document.body.append(...shown.childNodes);
		return document.body;
	});
});

// --------------------------------------------------------------
// Toasts in the Simple flows that exist today
// --------------------------------------------------------------

describe('toasts', () => {
	scanStrict('undo and redo', ({ toasts }) => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor);
		showItem(editor, R);
		traceInto(editor, 60);
		const shapes = () => [B, R].map((id) => editor.project.glyphs[id].shapes.length);
		expect(shapes()).toEqual([1, 1]);
		editor.history.restoreState();
		editor.history.restoreState();
		editor.history.restoreState(); // nothing left to undo
		expect(shapes()).toEqual([0, 0]);
		editor.history.redoState();
		editor.history.redoState();
		editor.history.redoState(); // nothing left to redo
		expect(shapes()).toEqual([1, 1]);
		toasts.flush();
		return null;
	});

	scanStrict('adding and taking off a photo', async ({ toasts }) => {
		document.body.innerHTML = '<div id="editor-page__panel"></div>';
		setDecoderForTests({
			decode: async () => ({ width: 400, height: 800, close() {} }),
			encode: async (_bitmap, options) =>
				new Blob([`${options.width}x${options.height}`], { type: 'image/webp' }),
		});
		const editor = letterEditor();
		const photo = new File([new Uint8Array(16)], 'handwriting.jpg', { type: 'image/jpeg' });
		// B8 + B9 integration: the "can't use photos yet" toast retired with B9; the app sends a
		// photo on a letter to the photo screens (their own scans: photo/tests), and with no route
		// set the trace layer's own toasts speak
		expect(await importTraceImage(photo, { editor })).toBe(true);
		expect(await importTraceImage(photo, { editor })).toBe(true);
		expect(removeTrace({ editor })).toBe(true);
		expect(toasts.flush()).toHaveLength(3); // added, replaced, taken off
		return null;
	});

	scanStrict('Merge (combine every shape of the letter)', ({ toasts }) => {
		letterEditor();
		vi.useFakeTimers({ toFake: ['setTimeout'] }); // the merge itself waits 200 ms; not run
		combineUniteAllGlyphPaths();
		expect(toasts.flush()).toEqual(['Merging the shapes...']); // B4 toast track
		return null;
	});

	scanStrict('tidy points (Ctrl+R) with the Edit points tool', ({ toasts }) => {
		const editor = letterEditor();
		editor.editCanvas = { redraw() {} }; // no canvas on the page: holding Ctrl redraws it
		editor.selectedTool = 'pathEdit';
		handleKeyPress(new KeyboardEvent('keydown', { key: 'Control', cancelable: true }));
		handleKeyPress(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, cancelable: true }));
		handleKeyUp(new KeyboardEvent('keyup', { key: 'Control', cancelable: true }));
		// B4 toast track: never shown in Simple, ANY-INK rounds silently (UX-BEGINNER 2.4 G)
		expect(toasts.flush()).toEqual([]);
		return null;
	});

	scanStrict('Save, to the work file already open', async ({ toasts }) => {
		setFileApi(fakeApi({ open: [], save: new Error('the picker must not open') }));
		const editor = letterEditor();
		editor.loadedFileHandle = fakeFileHandle('Brennan Hand.gs2');
		editor.setProjectAsUnsaved();
		expect(await editor.saveProjectFile()).toBe(true);
		// B4 toast track: "Saved" is the status pill only in Simple, no toast (UX-BEGINNER 2.4 G)
		expect(toasts.flush()).toEqual([]);
		return null;
	});

	scanStrict(
		'making the font file when a letter needs fixing',
		async ({ toasts }) => {
			openBroken();
			setFileApi(fakeApi({ open: [], save: undefined, directory: fakeDirectoryHandle('Fonts') }));
			openFileMenu();
			const rows = [...document.querySelectorAll('#context-menu .context-menu-row')];
			// B4: the row by its id (menu.js data-anyink-row), not its words
			rows.find((row) => row.querySelector('[data-anyink-row="font-otf"]')).click();
			// B4 integration: in Simple the check is one toast in the queue, [Show me] its button
			const check = () =>
				[...document.querySelectorAll('#toast[data-anyink-toast="simple"]')].find(
					(toast) => !toast.hasAttribute('data-leaving') && toast.textContent.includes('small a')
				);
			expect(await waitFor(() => !!check())).toBe(true);
			expect(check().querySelector('.anyink-toast__action').textContent).toBe('Show me');
			expect(check().dataset.tone).toBe('warning');
			// B4 toast track: font_export.js and export_folder.js speak through toast/upstream_map.js,
			// the file and folder names as quotes ("…" to the recorder, like scanDom skips them)
			expect(toasts.flush()).toEqual(
				expect.arrayContaining([
					'Making the font file...',
					'Exported "…" to "…"',
					'Exported "…" to "…", but the question mark and small a need fixing. Show me',
				])
			);
			return check();
		},
		{ timeout: 15000 }
	);
});

// --------------------------------------------------------------
// Screens and flows later Bs add (each adds its scan with scanSimpleScreen)
// --------------------------------------------------------------

// B5 (the More tools band, Back to simple, the tool-key toast): mode/tests/band_words.test.js
// B6 (the top bar, the Menu, the status pill, undo toasts): topbar/tests/topbar_words.test.js;
//   the Next line, its every rule and tip: coach/tests/coach_words.test.js
// B7 (the letter header, letter card, Fine-tune, the empty overlay): letter/tests/letter_page.test.js;
//   the canvas words: letter/tests/letter_canvas_words.test.js; the tools: auto_hole_tools.test.js
// B6 + B7 together, one Simple letter screen as the app draws it: letter/tests/b67_seams.test.js;
//   the finalize pass's toasts (Delete with [Undo], a shape too small taken away):
//   letter/tests/delete_toast.test.js
describe('later screens', () => {
	it.todo('the brush: drawing a stroke, its toast (B8)');
	it.todo('photos: the How card, the photo dialog, the photo card (B9)');
	it.todo('the letter board (B10)');
	it.todo('Needs a look: reasons and fixes (B11)');
	it.todo('Try it and gap fixes (B12)');
	it.todo('the start screen, Create and Continue, the crash card and its toasts (B13)');
	it.todo('Use in Word, the font file and the install steps (B14)');
	it.todo('Font details, Move the guide lines, Help (B15)');
});
