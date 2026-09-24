// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// IndexedDB is absent in jsdom: History.initialize / persist swallow the
// rejection on their own, nothing here awaits storage.

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

function makeEditor(page = 'Characters') {
	const editor = new ProjectEditor({ project: makeProject() });
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
		const editor = makeEditor();
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
		expect(systemGuides.xHeight).toBe(false);

		guides.systemGuides.push('xHeight');
		editor.systemGuides.xHeight = true;
		guides.custom.push(new Guide({ name: 'Overshoot', location: 520, visible: true }));
		editor.history.addSettingsState('Showed x-height, added a guide');

		editor.history.restoreState();
		expect(editor.project.settings.app.guides).toBe(guides);
		expect(guides.systemGuides).toEqual(['baseline', 'leftSide', 'rightSide']);
		expect(guides.custom.length).toBe(0);
		expect(editor.systemGuides).toBe(systemGuides);
		expect(systemGuides.xHeight).toBe(false);

		editor.history.redoState();
		expect(guides.systemGuides).toContain('xHeight');
		expect(systemGuides.xHeight).toBe(true);
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
		const editor = makeEditor('Components');
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
