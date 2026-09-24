// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	SNAPSHOT_DELAY_MS,
	getDirtyGeneration,
	initRecovery,
	setRecoveryDeps,
	stopRecovery,
} from '../../anyink/recovery/recovery.js';
import { recClear, recGet } from '../../anyink/storage/kv.js';
import { getCurrentProjectEditor, setCurrentProjectEditor } from '../../app/main.js';
import { eventHandlerData } from '../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../edit_canvas/events_keyboard.js';
import { createComponent } from '../../pages/components.js';
import { createLigatures } from '../../pages/ligatures.js';
import { Glyph } from '../../project_data/glyph.js';
import { GlyphrStudioProject } from '../../project_data/glyphr_studio_project.js';
import { Guide } from '../guide.js';
import {
	HISTORY_FORMAT_VERSION,
	deserializeHistoryEntry,
	serializeHistoryEntry,
} from '../history.js';
import { ProjectEditor } from '../project_editor.js';

// jsdom has no IndexedDB: crash recovery (when a test starts it) writes to kv.js's
// in-memory fallback. History itself keeps no storage of its own any more.

const square = {
	name: 'Square',
	pathPoints: [
		{ p: { coord: { x: 100, y: 100 } } },
		{ p: { coord: { x: 300, y: 100 } } },
		{ p: { coord: { x: 300, y: 300 } } },
		{ p: { coord: { x: 100, y: 300 } } },
	],
};

function makeProject() {
	return new GlyphrStudioProject({
		settings: {
			project: {
				name: 'History Test',
				id: 'g2_HISTORYTEST',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F' }],
			},
			font: {
				family: 'HistTest',
				upm: 1000,
				ascent: 800,
				descent: -200,
				capHeight: 700,
				xHeight: 500,
			},
			app: { autoSave: false },
		},
		glyphs: {
			'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 600, shapes: [square] },
			'glyph-0x42': { id: 'glyph-0x42', advanceWidth: 620, shapes: [square] },
		},
		ligatures: {},
		components: {},
		kerning: { 'kern-0': { leftGroup: ['0x41'], rightGroup: ['0x42'], value: -50 } },
	});
}

/**
 * @param {String} [page]
 * @param {Object} [options]
 * @param {Boolean} [options.fromFile] - opened from its .gs2 (the open paths set the handle
 *   before the project), so undo back to the opened state clears the title dot. Without a
 *   file the project matches nothing on disk and the dot stays (M6 verification, finding 8).
 */
function makeEditor(page = 'Characters', { fromFile = false } = {}) {
	let editor;
	if (fromFile) {
		editor = new ProjectEditor();
		editor.loadedFileHandle = { kind: 'file', name: 'History Test.gs2' };
		editor.project = makeProject();
	} else {
		editor = new ProjectEditor({ project: makeProject() });
	}
	setCurrentProjectEditor(editor);
	editor.nav.page = page;
	return editor;
}

function watchTopics(editor, topics, id) {
	const seen = [];
	topics.forEach((topic) => {
		editor.subscribe({
			topic,
			subscriberID: `${id}.${topic}`,
			callback: (data) => seen.push({ topic, data }),
		});
	});
	return seen;
}

function keyDown(key) {
	handleKeyPress(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}
function keyUp(key) {
	handleKeyUp(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}

// jsdom has no Web Animations API; upstream's toast / dialog close path calls element.animate()
if (!Element.prototype.animate) Element.prototype.animate = () => ({});

let warn;
beforeEach(() => {
	document.title = 'ANY-INK';
	// editor.navigate() without an #app__wrapper only warns; keep test output quiet
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	eventHandlerData.isCtrlDown = false;
	eventHandlerData.isShiftDown = false;
});

// --------------------------------------------------------------
// Settings entries
// --------------------------------------------------------------

describe('History: settings entries', () => {
	it('addSettingsState then restoreState restores settings.font in place and publishes', () => {
		const editor = makeEditor('Characters', { fromFile: true });
		const font = editor.project.settings.font;
		const seen = watchTopics(
			editor,
			['fontMetrics', 'guides', 'editCanvasView'],
			'anyink.histtest.a'
		);

		font.xHeight = 560;
		editor.history.addSettingsState('Dragged x-height');

		expect(editor.history.length).toBe(1);
		expect(editor.history.queue[0].settingsSave).toBe(true);
		expect(editor.history.queue[0].itemState).toBe(false);
		expect(editor.history.queue[0].settingsState.font.xHeight).toBe(560);
		expect(document.title.endsWith(' •')).toBe(true);

		editor.history.restoreState();

		expect(editor.project.settings.font).toBe(font);
		expect(font.xHeight).toBe(500);
		expect(editor.history.queue.length).toBe(0);
		expect(editor.history.redoQueue.length).toBe(1);
		expect(seen.map((s) => s.topic)).toEqual(['fontMetrics', 'guides', 'editCanvasView']);
		expect(seen[0].data).toBe(font);
		expect(seen[1].data).toBe(editor.project.settings.app.guides);
		expect(document.title.endsWith(' •')).toBe(false);

		editor.history.redoState();
		expect(font.xHeight).toBe(560);
		expect(editor.history.queue.length).toBe(1);
		expect(editor.history.redoQueue.length).toBe(0);
		expect(seen.filter((s) => s.topic === 'fontMetrics').length).toBe(2);
	});

	it('steps back through several settings entries to the initial project', () => {
		const editor = makeEditor();
		const font = editor.project.settings.font;
		font.xHeight = 560;
		editor.history.addSettingsState('one');
		font.xHeight = 600;
		editor.history.addSettingsState('two');
		font.ascent = 850;
		editor.history.addSettingsState('three');

		editor.history.restoreState();
		expect(font.ascent).toBe(800);
		expect(font.xHeight).toBe(600);
		editor.history.restoreState();
		expect(font.xHeight).toBe(560);
		editor.history.restoreState();
		expect(font.xHeight).toBe(500);
		editor.history.restoreState(); // nothing left: toast, no throw
		expect(font.xHeight).toBe(500);
	});

	it('restores guides and re-syncs editor.systemGuides in place', () => {
		const editor = makeEditor();
		const guides = editor.project.settings.app.guides;
		const systemGuides = editor.systemGuides;
		// New projects show every metric line (D-009 amendment)
		const allSeven = ['ascent', 'capHeight', 'xHeight', 'baseline', 'descent', 'leftSide', 'rightSide'];
		expect(guides.systemGuides).toEqual(allSeven);
		expect(systemGuides.xHeight).toBe(true);

		guides.systemGuides.splice(guides.systemGuides.indexOf('xHeight'), 1);
		editor.systemGuides.xHeight = false;
		guides.custom.push(new Guide({ name: 'Overshoot', location: 520, visible: true }));
		editor.history.addSettingsState('Hid x-height, added a guide');

		editor.history.restoreState();
		expect(editor.project.settings.app.guides).toBe(guides);
		expect(guides.systemGuides).toEqual(allSeven);
		expect(guides.custom.length).toBe(0);
		expect(editor.systemGuides).toBe(systemGuides);
		expect(systemGuides.xHeight).toBe(true);

		editor.history.redoState();
		expect(guides.systemGuides).not.toContain('xHeight');
		expect(systemGuides.xHeight).toBe(false);
		expect(guides.custom.length).toBe(1);
		expect(guides.custom[0]).toBeInstanceOf(Guide);
		expect(guides.custom[0].visible).toBe(true);
	});

	it('interleaves with item entries without mixing them up', () => {
		const editor = makeEditor();
		const font = editor.project.settings.font;
		const glyph = () => editor.project.glyphs['glyph-0x41'];

		glyph().advanceWidth = 650;
		editor.history.addState('Width 650');
		font.xHeight = 560;
		editor.history.addSettingsState('x-height 560');
		glyph().advanceWidth = 700;
		editor.history.addState('Width 700');
		expect(editor.history.length).toBe(3);

		editor.history.restoreState();
		expect(glyph().advanceWidth).toBe(650);
		expect(font.xHeight).toBe(560);

		editor.history.restoreState();
		expect(font.xHeight).toBe(500);
		expect(glyph().advanceWidth).toBe(650);

		editor.history.restoreState();
		expect(glyph().advanceWidth).toBe(600);
		expect(editor.history.queue.length).toBe(0);

		editor.history.redoState();
		editor.history.redoState();
		editor.history.redoState();
		expect(glyph().advanceWidth).toBe(700);
		expect(font.xHeight).toBe(560);
		expect(editor.history.length).toBe(3);
	});

	it('inherits the item and page of the entry below it for the History panel', () => {
		const editor = makeEditor();
		editor.history.addState('Touch A');
		editor.history.addSettingsState('Metrics');
		expect(editor.history.queue[0].itemID).toBe('glyph-0x41');
		expect(editor.history.queue[0].page).toBe('Characters');
	});
});

// --------------------------------------------------------------
// Whole project entries
// --------------------------------------------------------------

describe('History: whole-project restore', () => {
	it('restores a fresh project object, never the snapshot itself', () => {
		const editor = makeEditor();
		const glyph = () => editor.project.glyphs['glyph-0x41'];

		editor.history.addWholeProjectChangePreState('Bulk change');
		glyph().advanceWidth = 900;
		editor.history.addWholeProjectChangePostState();
		expect(editor.history.length).toBe(1);

		const preSnapshot = editor.history.queue[1].itemState;
		expect(preSnapshot).toBeInstanceOf(GlyphrStudioProject);

		editor.history.restoreState();
		expect(glyph().advanceWidth).toBe(600);
		expect(editor.project).not.toBe(preSnapshot);
		expect(editor.history.queue.length).toBe(0);
		expect(editor.history.redoQueue[0].length).toBe(2);

		// Editing the live project must not leak into the snapshot kept for redo
		glyph().advanceWidth = 123;
		expect(preSnapshot.glyphs['glyph-0x41'].advanceWidth).toBe(600);
		expect(editor.history.redoQueue[0][0].itemState.glyphs['glyph-0x41'].advanceWidth).toBe(900);

		editor.history.redoState();
		expect(glyph().advanceWidth).toBe(900);
		expect(editor.project).not.toBe(editor.history.queue[0].itemState);
		expect(editor.history.length).toBe(1);

		// Undo again still works (the aliasing bug made this a no-op)
		editor.history.restoreState();
		expect(glyph().advanceWidth).toBe(600);
	});

	it('publishes fontMetrics and guides after a whole-project restore', () => {
		const editor = makeEditor();
		const seen = watchTopics(editor, ['fontMetrics', 'guides'], 'anyink.histtest.b');
		editor.history.addWholeProjectChangePreState('Bulk');
		editor.project.settings.font.ascent = 900;
		editor.history.addWholeProjectChangePostState();
		editor.history.restoreState();
		expect(editor.project.settings.font.ascent).toBe(800);
		expect(seen.map((s) => s.topic)).toEqual(['fontMetrics', 'guides']);
	});
});

// --------------------------------------------------------------
// Creation pre / post states
// --------------------------------------------------------------

describe('History: creation pre-states', () => {
	it('undo removes a just-created component and the project was marked unsaved', () => {
		const editor = makeEditor('Components', { fromFile: true });
		document.title = 'ANY-INK';

		const component = createComponent('Accent');
		expect(typeof component).not.toBe('string');
		expect(editor.project.components[component.id]).toBe(component);
		expect(editor.selectedComponentID).toBe(component.id);
		expect(editor.history.length).toBe(1);
		expect(editor.history.queue[0].title).toBe('_whole_project_change_post_state_');
		expect(editor.history.queue[1].title).toBe('Created component Accent');
		expect(document.title).toBe('ANY-INK •');

		editor.history.restoreState();
		expect(editor.project.components[component.id]).toBeUndefined();
		expect(Object.keys(editor.project.components).length).toBe(0);
		// nothing left to show on the Components page, so undo lands on Characters
		expect(editor.nav.page).toBe('Characters');
		expect(editor.history.queue.length).toBe(0);
		expect(document.title).toBe('ANY-INK');

		editor.history.redoState();
		expect(editor.project.components[component.id]).toBeDefined();
	});

	it('undo removes just-created ligatures as one step', () => {
		const editor = makeEditor('Ligatures');
		const { created, errors } = createLigatures(['ff', 'fi']);
		expect(errors).toEqual([]);
		expect(created.map((lig) => lig.id)).toEqual(['liga-f-f', 'liga-f-i']);
		expect(editor.selectedLigatureID).toBe('liga-f-i');
		expect(editor.history.length).toBe(1);
		expect(editor.history.queue[1].title).toBe('Created 2 ligatures');

		editor.history.restoreState();
		expect(editor.project.ligatures['liga-f-f']).toBeUndefined();
		expect(editor.project.ligatures['liga-f-i']).toBeUndefined();
		expect(editor.nav.page).toBe('Characters');
	});

	it('rejects bad ligature sequences without touching history (plain characters only)', () => {
		const editor = makeEditor('Ligatures');
		let result = createLigatures(['f']);
		expect(result.created).toEqual([]);
		expect(result.errors.length).toBe(1);
		expect(editor.history.queue.length).toBe(0);

		createLigatures(['ff']);
		expect(editor.history.length).toBe(1);
		result = createLigatures(['ff']);
		expect(result.created).toEqual([]);
		expect(result.errors[0]).toContain('already exists');
		expect(editor.history.length).toBe(1);

		// U+ notation is no longer parsed: it is just four characters
		result = createLigatures(['U+66U+66']);
		expect(result.created.length).toBe(1);
		expect(result.created[0].gsub).toEqual([...'U+66U+66'].map((c) => c.codePointAt(0)));
	});

	it('undo removes a glyph the editor created on demand', () => {
		const editor = makeEditor('Characters');
		expect(editor.project.glyphs['glyph-0x43']).toBeUndefined();

		editor._selectedGlyphID = 'glyph-0x43';
		const created = editor.selectedGlyph;
		expect(created).toBeInstanceOf(Glyph);
		expect(editor.project.glyphs['glyph-0x43']).toBe(created);
		expect(editor.history.length).toBe(1);
		expect(editor.history.queue[1].title.startsWith('Created ')).toBe(true);

		editor.history.restoreState();
		expect(editor.project.glyphs['glyph-0x43']).toBeUndefined();
		expect(editor.selectedGlyphID).toBe('glyph-0x41');
		expect(editor.history.queue.length).toBe(0);
	});

	it('does not record on-demand creation while an undo is applying state', () => {
		const editor = makeEditor('Characters');
		editor.history.isRestoring = true;
		editor._selectedGlyphID = 'glyph-0x44';
		expect(editor.selectedGlyph).toBeInstanceOf(Glyph);
		expect(editor.history.queue.length).toBe(0);
		editor.history.isRestoring = false;
	});
});

// --------------------------------------------------------------
// Undo from any page
// --------------------------------------------------------------

describe('History: undo from another page', () => {
	it('applies an item entry and moves back to its page', () => {
		const editor = makeEditor('Characters');
		editor.project.glyphs['glyph-0x41'].advanceWidth = 777;
		editor.history.addState('Width');
		editor.nav.page = 'Settings';

		editor.history.restoreState();
		expect(editor.project.glyphs['glyph-0x41'].advanceWidth).toBe(600);
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedGlyphID).toBe('glyph-0x41');
	});

	it('Ctrl+Z / Ctrl+Y work through the keyboard handler on a non-canvas page', () => {
		const editor = makeEditor('Characters');
		editor.project.settings.font.xHeight = 560;
		editor.history.addSettingsState('x-height');
		editor.nav.page = 'Settings';

		keyDown('Control');
		keyDown('z'); // Ctrl+Z undo
		expect(editor.project.settings.font.xHeight).toBe(500);
		keyDown('y'); // Ctrl+Y redo
		expect(editor.project.settings.font.xHeight).toBe(560);
		keyDown('z'); // Ctrl+Z undo
		expect(editor.project.settings.font.xHeight).toBe(500);
		keyDown('Shift');
		keyDown('z'); // Ctrl+Shift+Z redo
		expect(editor.project.settings.font.xHeight).toBe(560);
		keyUp('Shift');
		keyUp('Control');
		expect(eventHandlerData.isCtrlDown).toBe(false);
		expect(eventHandlerData.isShiftDown).toBe(false);
	});

	it('leaves Ctrl+Z alone while a text field or contenteditable has focus', () => {
		const editor = makeEditor('Characters');
		editor.project.settings.font.xHeight = 560;
		editor.history.addSettingsState('x-height');
		editor.nav.page = 'Settings';

		keyDown('Control');
		expect(eventHandlerData.isCtrlDown).toBe(true);

		const input = document.createElement('input');
		document.body.appendChild(input);
		input.focus();
		expect(document.activeElement).toBe(input);
		keyDown('z');
		expect(editor.project.settings.font.xHeight).toBe(560);
		input.remove();

		const note = document.createElement('div');
		note.setAttribute('contenteditable', 'true');
		note.setAttribute('tabindex', '0');
		document.body.appendChild(note);
		note.focus();
		expect(document.activeElement).toBe(note);
		keyDown('z');
		expect(editor.project.settings.font.xHeight).toBe(560);
		note.remove();

		expect(document.activeElement).toBe(document.body);
		keyDown('z');
		expect(editor.project.settings.font.xHeight).toBe(500);
		keyUp('Control');
	});
});

// --------------------------------------------------------------
// Kerning nudge
// --------------------------------------------------------------

describe('History: kern arrow nudge', () => {
	it('publishes kernPairs after changing the value', () => {
		const editor = makeEditor('Kerning');
		editor.selectedKernGroupID = 'kern-0';
		editor.editCanvas = { redraw() {} };
		const seen = watchTopics(editor, ['kernPairs', 'currentKernGroup'], 'anyink.histtest.k');

		keyDown('ArrowRight');
		expect(editor.selectedKernGroup.value).toBe(-49);
		// upstream fans 'currentKernGroup' out twice (direct + specific-item); kernPairs comes once, after
		const kernPairs = seen.filter((s) => s.topic === 'kernPairs');
		expect(kernPairs.length).toBe(1);
		// payload matches every other publisher (JSON-safe, no KernGroup reference)
		expect(kernPairs[0].data.groupID).toBe('kern-0');
		expect(kernPairs[0].data.value).toBe(-49);
		expect(kernPairs[0].data.dragging).toBe(false);
		expect(typeof kernPairs[0].data.version).toBe('number');
		expect(seen.at(-1).topic).toBe('kernPairs');
		expect(seen.some((s) => s.topic === 'currentKernGroup')).toBe(true);
		expect(editor.history.length).toBe(1);

		keyDown('Shift');
		keyDown('ArrowLeft');
		expect(editor.selectedKernGroup.value).toBe(-59);
		keyUp('Shift');

		editor.history.restoreState();
		expect(editor.selectedKernGroup.value).toBe(-49);
	});
});

// --------------------------------------------------------------
// Persistence format
// --------------------------------------------------------------

describe('History: serialization', () => {
	it('round-trips a settings entry as plain data', () => {
		const editor = makeEditor();
		editor.project.settings.font.xHeight = 560;
		editor.project.settings.app.guides.custom.push(
			new Guide({ name: 'Overshoot', location: 520, visible: true })
		);
		editor.history.addSettingsState('Dragged x-height');
		const entry = editor.history.queue[0];

		const wire = serializeHistoryEntry(entry);
		expect(JSON.parse(JSON.stringify(wire))).toEqual(wire);
		expect(wire.settingsSave).toBe(true);
		expect(wire.itemState).toBe(false);
		expect(wire.wholeProjectSave).toBe(false);

		const back = deserializeHistoryEntry(JSON.parse(JSON.stringify(wire)));
		expect(back.settingsSave).toBe(true);
		expect(back.itemState).toBe(false);
		expect(back.title).toBe('Dragged x-height');
		expect(back.settingsState).toEqual(entry.settingsState);
		expect(back.settingsState).not.toBe(entry.settingsState);
		expect(back.settingsState.font.xHeight).toBe(560);
		expect(back.settingsState.guides.custom[0].visible).toBe(true);
	});

	it('still round-trips item and whole-project entries', () => {
		const editor = makeEditor();
		editor.history.addState('Touch A');
		editor.history.addWholeProjectChangePreState('Bulk');
		const [whole, item] = editor.history.queue;

		const itemBack = deserializeHistoryEntry(
			JSON.parse(JSON.stringify(serializeHistoryEntry(item)))
		);
		expect(itemBack.itemState).toBeInstanceOf(Glyph);
		expect(itemBack.itemState.id).toBe('glyph-0x41');
		expect(itemBack.settingsSave).toBe(false);

		const wholeBack = deserializeHistoryEntry(
			JSON.parse(JSON.stringify(serializeHistoryEntry(whole)))
		);
		expect(wholeBack.itemState).toBeInstanceOf(GlyphrStudioProject);
		expect(wholeBack.wholeProjectSave).toBe(true);
	});

	it('bumped the stored format version so stale records are ignored', () => {
		expect(HISTORY_FORMAT_VERSION).toBe(3);
	});
});

// --------------------------------------------------------------
// Saved marker
// --------------------------------------------------------------

describe('ProjectEditor.setProjectAsSaved', () => {
	it('does not chop the title when the unsaved marker is absent', () => {
		const editor = makeEditor();
		document.title = 'ANY-INK';
		editor.setProjectAsSaved();
		expect(document.title).toBe('ANY-INK');
		editor.setProjectAsUnsaved();
		expect(document.title).toBe('ANY-INK •');
		editor.setProjectAsUnsaved();
		expect(document.title).toBe('ANY-INK •');
		editor.setProjectAsSaved();
		expect(document.title).toBe('ANY-INK');
		expect(getCurrentProjectEditor()).toBe(editor);
	});
});

// --------------------------------------------------------------
// Undo state for crash recovery (D-026 amended)
// --------------------------------------------------------------

describe('History: undo state for crash recovery', () => {
	it('a fresh load starts with an empty queue: undo goes back to the loaded project', () => {
		const editor = makeEditor();
		expect(editor.history.queue).toEqual([]);
		editor.project.settings.font.xHeight = 520;
		editor.history.addSettingsState('Set X height to 520');
		editor.history.restoreState();
		expect(editor.project.settings.font.xHeight).toBe(500);
	});

	it('serializeForStorage + adoptSnapshot carry the queue to a restored copy', () => {
		const editor = makeEditor();
		const glyph = () => editor.project.glyphs['glyph-0x41'];
		glyph().advanceWidth = 700;
		editor.history.addState('A to 700');
		glyph().advanceWidth = 800;
		editor.history.addState('A to 800');
		// IndexedDB stores structured clones: the snapshot must survive one
		const snapshot = structuredClone(editor.history.serializeForStorage());
		expect(snapshot.version).toBe(HISTORY_FORMAT_VERSION);

		const restored = new ProjectEditor({ project: new GlyphrStudioProject(editor.project.save()) });
		setCurrentProjectEditor(restored);
		restored.nav.page = 'Characters';
		expect(restored.history.adoptSnapshot(snapshot)).toBe(true);
		expect(restored.history.queue.map((entry) => entry.title)).toEqual(['A to 800', 'A to 700']);
		restored.history.restoreState();
		expect(restored.project.glyphs['glyph-0x41'].advanceWidth).toBe(700);
		// the initial project came from the snapshot too, not from the restored copy
		restored.history.restoreState();
		expect(restored.project.glyphs['glyph-0x41'].advanceWidth).toBe(600);
	});

	it('adoptSnapshot ignores a missing snapshot or one written by another format', () => {
		const editor = makeEditor();
		expect(editor.history.adoptSnapshot(undefined)).toBe(false);
		const snapshot = editor.history.serializeForStorage();
		expect(editor.history.adoptSnapshot({ ...snapshot, version: 2 })).toBe(false);
		expect(editor.history.queue).toEqual([]);
	});

	// Finding 5: undo / redo never marked dirty, so the snapshot went stale.
	it('undo and redo mark the project dirty', () => {
		const editor = makeEditor();
		editor.project.glyphs['glyph-0x41'].advanceWidth = 700;
		editor.history.addState('A to 700');
		const afterEdit = getDirtyGeneration();
		editor.history.restoreState();
		expect(getDirtyGeneration()).toBe(afterEdit + 1);
		editor.history.redoState();
		expect(getDirtyGeneration()).toBe(afterEdit + 2);
	});

	it('the crash snapshot after an undo holds the undone project and its matching queue', async () => {
		vi.useFakeTimers();
		await recClear();
		const editor = makeEditor();
		const restoreDeps = setRecoveryDeps({
			getEditor: () => editor,
			getEditors: () => [editor],
			locks: () => undefined,
			toast: () => {},
			makeSessionId: () => 'undo',
		});
		const key = 'session:g2_HISTORYTEST:undo';
		try {
			initRecovery();
			editor.project.glyphs['glyph-0x41'].advanceWidth = 700;
			editor.history.addState('A to 700');
			await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
			expect((await recGet(key)).project.glyphs['glyph-0x41'].advanceWidth).toBe(700);

			editor.history.restoreState();
			expect(editor.project.glyphs['glyph-0x41'].advanceWidth).toBe(600);
			await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
			const record = await recGet(key);
			expect(record.project.glyphs['glyph-0x41'].advanceWidth).toBe(600);
			expect(record.history.queue).toHaveLength(editor.history.queue.length);
			expect(record.history.redoQueue).toHaveLength(1);
		} finally {
			stopRecovery();
			restoreDeps();
			vi.useRealTimers();
		}
	});
});

// --------------------------------------------------------------
// Title dot follows the saved state (finding 8)
// --------------------------------------------------------------

describe('History: the title dot follows the saved state', () => {
	function editA(editor, width) {
		editor.project.glyphs['glyph-0x41'].advanceWidth = width;
		editor.history.addState(`A to ${width}`);
	}
	const widthA = (editor) => editor.project.glyphs['glyph-0x41'].advanceWidth;

	it('undo back to an empty queue keeps the dot when the file on disk differs', () => {
		const editor = makeEditor();
		const seen = watchTopics(editor, ['projectFile'], 'anyink.test.dotEmpty');
		editA(editor, 700);
		expect(document.title).toBe('ANY-INK •');
		editor.setProjectAsSaved(); // Ctrl+S: the file has 700
		expect(document.title).toBe('ANY-INK');
		editA(editor, 800);
		editor.history.restoreState(); // 700 again: matches the file
		expect(widthA(editor)).toBe(700);
		expect(document.title).toBe('ANY-INK');
		editor.history.restoreState(); // 600: the file still has 700
		expect(widthA(editor)).toBe(600);
		expect(editor.history.queue).toHaveLength(0);
		expect(document.title).toBe('ANY-INK •');
		editor.history.restoreState(); // "No more undo" changes nothing
		expect(document.title).toBe('ANY-INK •');
		expect(seen.map((entry) => entry.data.saved)).toEqual([false, true, false, true, false]);
	});

	it('redo onto the saved entry clears the dot; redo past it shows the dot', () => {
		const editor = makeEditor();
		editA(editor, 700);
		editor.setProjectAsSaved();
		editA(editor, 800);
		editor.history.restoreState();
		editor.history.restoreState();
		expect(document.title).toBe('ANY-INK •');
		editor.history.redoState(); // 700 = the file
		expect(widthA(editor)).toBe(700);
		expect(document.title).toBe('ANY-INK');
		editor.history.redoState(); // 800
		expect(widthA(editor)).toBe(800);
		expect(document.title).toBe('ANY-INK •');
	});

	it('undo through a recovered (adopted) queue never claims the file matches', () => {
		const editor = makeEditor();
		editA(editor, 700);
		editA(editor, 800);
		const snapshot = editor.history.serializeForStorage();
		const restored = new ProjectEditor({ project: new GlyphrStudioProject(editor.project.save()) });
		setCurrentProjectEditor(restored);
		restored.nav.page = 'Characters';
		restored.history.adoptSnapshot(snapshot);
		restored.setProjectAsUnsaved();
		restored.history.restoreState();
		restored.history.restoreState();
		expect(restored.history.queue).toHaveLength(0);
		expect(widthA(restored)).toBe(600);
		expect(document.title).toBe('ANY-INK •');
	});

	// Verification of finding 8: a project with no .gs2 behind it (New, a sample, an
	// imported font or SVG) matches no file, so an empty queue is not "saved".
	it('a project that was never saved keeps the dot when undo empties the queue', () => {
		const editor = makeEditor();
		const seen = watchTopics(editor, ['projectFile'], 'anyink.test.dotNeverSaved');
		editA(editor, 700);
		editor.history.restoreState();
		expect(widthA(editor)).toBe(600);
		expect(editor.history.queue).toHaveLength(0);
		expect(document.title).toBe('ANY-INK •');
		expect(seen.map((entry) => entry.data.saved)).toEqual([false]);
	});

	it('a project opened from its .gs2 clears the dot when undo is back at the opened state', () => {
		const editor = makeEditor('Characters', { fromFile: true });
		editA(editor, 700);
		expect(document.title).toBe('ANY-INK •');
		editor.history.restoreState();
		expect(widthA(editor)).toBe(600);
		expect(document.title).toBe('ANY-INK');
	});

	it('markSavedStateAt records the entry a save wrote, even after newer edits', () => {
		const editor = makeEditor();
		editA(editor, 700);
		const written = editor.history.queue[0];
		editA(editor, 800); // lands while that save is writing
		editor.history.markSavedStateAt(written);
		expect(editor.history.isAtSavedState()).toBe(false);
		editor.history.restoreState(); // 700 = the file
		expect(document.title).toBe('ANY-INK');
		editor.history.restoreState(); // 600
		expect(document.title).toBe('ANY-INK •');
	});

	it('a navigation-only undo keeps the saved state', () => {
		const editor = makeEditor();
		editA(editor, 700);
		editor.selectedGlyphID = 'glyph-0x42';
		editor.project.glyphs['glyph-0x42'].advanceWidth = 720;
		editor.history.addState('B to 720');
		editor.setProjectAsSaved(); // the file has A 700, B 720
		editor.history.restoreState(); // navigates to A, changes nothing
		expect(editor.selectedGlyphID).toBe('glyph-0x41');
		expect(document.title).toBe('ANY-INK');
		editor.history.restoreState(); // A back to 600
		expect(widthA(editor)).toBe(600);
		expect(document.title).toBe('ANY-INK •');
		editor.history.redoState(); // A 700, B 720 = the file
		expect(widthA(editor)).toBe(700);
		expect(document.title).toBe('ANY-INK');
	});
});

// --------------------------------------------------------------
// Project file text (audit A9: always compact)
// --------------------------------------------------------------

describe('ProjectEditor.makeProjectFileText', () => {
	it('saves compact JSON even when a project carries formatSaveFile: true', async () => {
		const editor = makeEditor();
		editor.project.settings.app.formatSaveFile = true;
		const text = await editor.makeProjectFileText();
		expect(text).not.toMatch(/\n/);
		expect(JSON.parse(text).settings.project.id).toBe('g2_HISTORYTEST');
	});

	it('saves live previews even when a project carries saveLivePreviews: false (no control for it)', async () => {
		const editor = makeEditor();
		editor.project.settings.app.saveLivePreviews = false;
		const text = await editor.makeProjectFileText();
		expect(Array.isArray(JSON.parse(text).settings.app.livePreviews)).toBe(true);
	});
});
