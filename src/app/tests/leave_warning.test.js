// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 item 4 (UX-BEGINNER 7.5): Chrome's "Leave site?" warning shows only when the work isn't
// saved to its file AND some letter has shapes; a font with no work file (an example, an imported
// font file) also needs a change since it was loaded. Decided when the page closes.
import { FontFlux } from 'font-flux-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSaveStatus, markSaveDirty, setSaveStatus } from '../../anyink/files/save_status.js';
import { ioFont_importFont } from '../../formats_io/otf/font_import.js';
import { makeOneSettingsRow } from '../../pages/settings.js';
import { GlyphrStudioProject } from '../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../project_editor/project_editor.js';
import { updateWindowUnloadEvent } from '../app.js';
import { addProjectEditorAndSetAsImportTarget, getGlyphrStudioApp } from '../main.js';

const square = {
	pathPoints: [
		{ p: { coord: { x: 100, y: 100 } } },
		{ p: { coord: { x: 300, y: 100 } } },
		{ p: { coord: { x: 300, y: 300 } } },
		{ p: { coord: { x: 100, y: 300 } } },
	],
};

/** A file handle as File System Access hands one over for a work file. */
const workFile = (name = 'Brennan Hand.gs2') => ({
	kind: 'file',
	name,
	getFile: async () => ({}),
	createWritable: async () => ({}),
});

function editorWith({ ink = false, file = false, where = 'glyphs', stop, kern = false } = {}) {
	const item = { id: 'glyph-0x61', advanceWidth: 600, shapes: ink ? [square] : [] };
	const data = {
		settings: { project: { name: 'Leave test', id: `leave-${Math.random()}` } },
		glyphs: { 'glyph-0x61': { id: 'glyph-0x61', advanceWidth: 600 } },
	};
	if (kern) data.kerning = { 'kern-0': { id: 'kern-0', leftGroup: ['0x61'], rightGroup: ['0x61'], value: -40 } };
	if (where === 'glyphs') data.glyphs['glyph-0x61'] = item;
	if (where === 'ligatures') data.ligatures = { 'liga-0x660x66': { ...item, id: 'liga-0x660x66' } };
	if (where === 'components') data.components = { 'comp-0': { ...item, id: 'comp-0' } };
	if (stop !== undefined) data.settings.app = { stopPageNavigation: stop };
	const editor = new ProjectEditor();
	// The open paths set the handle before the project, as reopening a work file does.
	if (file) editor.loadedFileHandle = workFile();
	editor.project = new GlyphrStudioProject(data);
	return editor;
}

/** Draws on a letter after loading, as a pen stroke does: new ink, then History's dirty mark. */
function draw(editor, id = 'glyph-0x61') {
	editor.project.glyphs[id].addOneShape(square);
	markSaveDirty(editor);
}

/** Looks at a letter the way an Overview tile click does: an upstream "Navigated to" entry. */
function lookAt(editor, id = 'glyph-0x61') {
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = id;
	editor.history.addState(`Navigated to ${id}`);
}

/** Fires the page's unload handler the way Chrome does. @returns {Boolean} true if it warned */
function leaving() {
	const event = new Event('beforeunload', { cancelable: true });
	const message = window.onbeforeunload?.(event);
	return event.defaultPrevented || (typeof message === 'string' && message.length > 0);
}

let app, saved;
beforeEach(() => {
	app = getGlyphrStudioApp();
	saved = {
		editors: app.projectEditors,
		selected: app._selectedProjectEditor,
		dev: { ...app.settings.dev },
	};
	app.settings.dev.mode = false;
	app.settings.dev.stopPageNavigation = false;
});
afterEach(() => {
	app.projectEditors = saved.editors;
	app._selectedProjectEditor = saved.selected;
	Object.assign(app.settings.dev, saved.dev);
	window.onbeforeunload = null;
});

function open(...editors) {
	app.projectEditors = editors;
	app._selectedProjectEditor = editors[0];
	updateWindowUnloadEvent();
}

describe('leave-site warning', () => {
	it('does not warn for a work file reopened with no edits', () => {
		open(editorWith({ ink: true, file: true }));
		expect(leaving()).toBe(false);
	});

	it('does not warn right after a successful save', () => {
		const editor = editorWith({ ink: true, file: true });
		open(editor);
		markSaveDirty(editor);
		setSaveStatus(editor, { file: 'saved', recovery: 'saved' });
		expect(leaving()).toBe(false);
	});

	it('warns when a work file has changes not written yet', () => {
		const editor = editorWith({ ink: true, file: true });
		open(editor);
		markSaveDirty(editor);
		expect(leaving()).toBe(true);
	});

	it.each(['saving', 'failed'])('warns while the file is %s', (file) => {
		const editor = editorWith({ ink: true, file: true });
		open(editor);
		setSaveStatus(editor, { file });
		expect(leaving()).toBe(true);
	});

	it('warns for a new font (no work file) once it has ink', () => {
		const editor = editorWith({ ink: false });
		open(editor);
		draw(editor);
		expect(leaving()).toBe(true);
	});

	// B1 fix pass: Examples > Oblegg (or Simple v2), no edits, then closing the tab asked
	// "Leave site?". A font with no work file warns only for ink that changed since it was
	// loaded: just looking at it, letters included, loses nothing.
	it('does not warn for an untouched example (ink, no work file, nothing changed)', () => {
		open(editorWith({ ink: true }));
		expect(leaving()).toBe(false);
	});

	it('does not warn after just looking at an example letter (a "Navigated to" undo entry)', () => {
		const editor = editorWith({ ink: true });
		open(editor);
		lookAt(editor);
		expect(getSaveStatus(editor).file).toBe('pending'); // upstream counts the look as a change
		expect(leaving()).toBe(false);
	});

	it('warns once the example gets new ink', () => {
		const editor = editorWith({ ink: true });
		open(editor);
		lookAt(editor);
		draw(editor);
		expect(leaving()).toBe(true);
	});

	it('warns once a point of the example moves', () => {
		const editor = editorWith({ ink: true });
		open(editor);
		const point = editor.project.glyphs['glyph-0x61'].shapes[0].pathPoints[0].p;
		point.x += 50;
		markSaveDirty(editor);
		expect(leaving()).toBe(true);
		point.x -= 50; // undone by hand: the ink is what was loaded again
		expect(leaving()).toBe(false);
	});

	it('warns to be safe when the check itself fails, instead of throwing at the browser', () => {
		const editor = editorWith({ ink: true });
		open(editor);
		editor.project.glyphs['glyph-0x61'].save = () => {
			throw new Error('broken letter');
		};
		const warn = console.warn;
		console.warn = () => {};
		try {
			expect(leaving()).toBe(true);
		} finally {
			console.warn = warn;
		}
	});

	// B1 fix pass: the first rule compared only the ink, so on an example a changed gap or a new
	// font name closed the tab with no prompt. Everything he can change counts now; looking
	// around (opening letters, even empty ones) still doesn't.
	it('warns once a gap of the example changes', () => {
		const editor = editorWith({ ink: true, kern: true });
		open(editor);
		expect(leaving()).toBe(false);
		editor.project.kerning['kern-0'].value = -80;
		markSaveDirty(editor);
		expect(leaving()).toBe(true);
	});

	it('warns once the example is renamed in Settings', () => {
		const editor = editorWith({ ink: true });
		open(editor);
		editor.project.settings.font.family = 'Brennan Script';
		markSaveDirty(editor);
		expect(leaving()).toBe(true);
	});

	it('does not warn after opening empty letters of an example', () => {
		const editor = editorWith({ ink: true, kern: true });
		open(editor);
		['glyph-0x62', 'glyph-0x20', 'glyph-0x41'].forEach((id) => {
			lookAt(editor, id);
			expect(editor.selectedGlyph.id).toBe(id); // opening it made its (empty) record
		});
		expect(editor.project.glyphs['glyph-0x62']).toBeTruthy();
		expect(leaving()).toBe(false);
	});

	it('warns once an opened empty letter of an example gets a width', () => {
		const editor = editorWith({ ink: true });
		open(editor);
		lookAt(editor, 'glyph-0x20');
		editor.selectedGlyph.advanceWidth = 512;
		markSaveDirty(editor);
		expect(leaving()).toBe(true);
	});

	it('warns once a letter of the example gets a new width', () => {
		const editor = editorWith({ ink: true });
		open(editor);
		editor.project.glyphs['glyph-0x61'].advanceWidth = 640;
		markSaveDirty(editor);
		expect(leaving()).toBe(true);
	});

	it('does not warn for a font with no shapes, saved or not', () => {
		const editor = editorWith({ ink: false });
		open(editor);
		expect(leaving()).toBe(false);
		markSaveDirty(editor);
		expect(leaving()).toBe(false);
	});

	it.each(['ligatures', 'components'])('counts shapes in %s as ink', (where) => {
		const editor = editorWith({ ink: true, file: true, where });
		open(editor);
		markSaveDirty(editor);
		expect(leaving()).toBe(true);
	});

	it('decides when the page closes, not when the handler was set', () => {
		const editor = editorWith({ ink: true, file: true });
		open(editor);
		expect(leaving()).toBe(false);
		markSaveDirty(editor); // an edit after the last save, with no new updateWindowUnloadEvent call
		expect(leaving()).toBe(true);
		setSaveStatus(editor, { file: 'saved' }); // autosave caught up
		expect(leaving()).toBe(false);
	});

	it('warns when the other open font has unsaved ink', () => {
		const other = editorWith({ ink: false });
		open(editorWith({ ink: true, file: true }), other);
		draw(other);
		expect(leaving()).toBe(true);
	});

	it('never warns when the font turned the warning off in Settings', () => {
		const editor = editorWith({ ink: false, stop: false });
		open(editor);
		draw(editor);
		expect(leaving()).toBe(false);
	});

	it('keeps the dev override: dev mode warns only when its own switch is on', () => {
		app.settings.dev.mode = true;
		app.settings.dev.stopPageNavigation = true;
		open(editorWith({ ink: false, file: true }));
		expect(leaving()).toBe(true);
		app.settings.dev.stopPageNavigation = false;
		open(editorWith({ ink: true }));
		expect(leaving()).toBe(false);
	});

	it('does not warn on the start page (an editor with nothing loaded)', () => {
		open(new ProjectEditor());
		expect(leaving()).toBe(false);
	});

	it('does not warn with no editors at all', () => {
		open();
		expect(leaving()).toBe(false);
	});
});

// B1 fix pass: Settings page rows wrote straight into the project with no History entry and no
// dirty mark, so a saved work file kept "Saved" after a new font name or copyright: no autosave,
// no backup copy and no "Leave site?" prompt. Every Settings write now marks the font changed.
describe('Settings page edits on a saved work file', () => {
	/** The input of one Settings row, as the Settings page builds it. */
	const settingsInput = (group, property) => makeOneSettingsRow(group, property)[2];
	const change = (element) => element.dispatchEvent(new Event('change'));

	let editor;
	beforeEach(() => {
		editor = editorWith({ ink: true, file: true });
		open(editor);
		expect(leaving()).toBe(false);
	});

	it.each([
		['font', 'family', 'Brennan Script'],
		['font', 'copyright', '(c) 2026 Brennan Meyer'],
		['font', 'designer', 'Brennan Meyer'],
		['font', 'version', 'Version 1.1'],
		['project', 'name', 'Brennan Script'],
	])('typing a new %s %s warns and leaves the file pending', (group, property, text) => {
		const input = settingsInput(group, property);
		input.value = text;
		change(input);
		expect(editor.project.settings[group][property]).toBe(text);
		expect(getSaveStatus(editor).file).toBe('pending');
		expect(leaving()).toBe(true);
	});

	it('turning an App switch on or off warns', () => {
		const before = !!editor.project.settings.app.exportKerning;
		const input = settingsInput('app', 'exportKerning');
		input.checked = !before;
		change(input);
		expect(editor.project.settings.app.exportKerning).toBe(!before);
		expect(leaving()).toBe(true);
	});

	it.each([
		['font', 'weight', 700],
		['font', 'italicAngle', -12],
	])('a number row (%s %s) warns', (group, property, number) => {
		const input = settingsInput(group, property);
		input.value = String(number); // what <input-number> hands its change listeners
		change(input);
		expect(editor.project.settings[group][property]).toBe(number);
		expect(leaving()).toBe(true);
	});

	it('a slider row warns once the drag ends', () => {
		const bar = settingsInput('app', 'itemChooserPageSize').querySelector('.fancy-slider__bar');
		const next = Number(bar.value) === Number(bar.min) ? bar.max : bar.min;
		bar.value = next;
		change(bar);
		expect(editor.project.settings.app.itemChooserPageSize).toBe(Number(next));
		expect(leaving()).toBe(true);
	});

	it('just building the Settings rows changes nothing', () => {
		for (const [group, property] of [
			['font', 'family'],
			['font', 'italicAngle'],
			['font', 'weight'],
			['app', 'itemChooserPageSize'],
			['app', 'exportKerning'],
		])
			settingsInput(group, property);
		expect(getSaveStatus(editor).file).toBe('saved');
		expect(leaving()).toBe(false);
	});

	it('changing a row back to the value it had changes nothing', () => {
		const input = settingsInput('font', 'family');
		input.value = editor.project.settings.font.family;
		change(input);
		expect(getSaveStatus(editor).file).toBe('saved');
	});
});

// B1 fix pass: the check is now installed at start, so it covers a font file imported on the Load
// tab too. The import fills the empty project its editor was made with, so the copy History kept
// at load was that empty project, and an untouched imported font warned. The import now makes
// the imported font the starting point, as every other way of opening a font does.
describe('an imported font file', () => {
	const fontFile = () =>
		FontFlux.open(
			new Uint8Array(
				readFileSync(resolve(__dirname, '../../formats_io/otf/tests/ObleggKernTestRegular.otf'))
			).buffer
		);

	it('does not warn as imported, and warns once it gets new ink', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		app.projectEditors = [];
		const editor = addProjectEditorAndSetAsImportTarget();
		editor.project = new GlyphrStudioProject();
		await ioFont_importFont(fontFile(), false, 'otf');
		expect(Object.values(editor.project.glyphs).some((g) => g.shapes.length)).toBe(true);
		updateWindowUnloadEvent();
		expect(leaving()).toBe(false);
		draw(editor, 'glyph-0x41');
		expect(leaving()).toBe(true);
		vi.restoreAllMocks();
	});
});
