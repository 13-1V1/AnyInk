// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 integration (UX-BEGINNER.md 4.2 Drops: "A .gs2 opens it"; the board-tiles track's
// need 4): a work file dropped on the letter board opens into the font he is in, with Ctrl+O's
// unsaved check first. With the handle the drop gave, Save writes back to that file; without
// one (no File System Access) the dropped file itself is read, and the font has no work file
// yet. A file that isn't a work file ANY-INK can read says so in plain words.
// Written to fail first: open_font.js had no drop opener (board_drop.js said "press Ctrl+O").
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGlyphrStudioApp, setCurrentProjectEditor } from '../../../app/main.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { openDroppedFont } from '../open_font.js';
import { setSaveStatus } from '../save_status.js';
import { fakeApi, fakeFileHandle } from './fakes.js';

function named(name) {
	const project = structuredClone(simpleExampleProject);
	project.settings.project.name = name;
	project.settings.font.family = name;
	return project;
}
const nameOf = (editor) => editor.project.settings.project.name;
const box = () => document.querySelector('#modal-dialog .anyink-open-box');
const buttonNamed = (key) =>
	[...(document.querySelectorAll('#modal-dialog fancy-button') || [])].find(
		(b) => b.textContent.trim() === word(key)
	);
const dropped = (name, text) => new File([text], name, { type: '' });

async function waitFor(check, ms = 3000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return false;
}

let app;
let saved;
let editor;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetToastsForTests();
	app = getGlyphrStudioApp();
	saved = { editors: [...app.projectEditors], selected: app.selectedProjectEditor };
	editor = app.selectedProjectEditor;
	editor.project = importGlyphrProjectFromText(named('Open Font'));
	setCurrentProjectEditor(editor);
	setFileApi(fakeApi({ open: [], save: undefined }));
});
afterEach(() => {
	resetFileApi();
	resetToastsForTests();
	vi.restoreAllMocks();
	app.projectEditors.length = 0;
	app.projectEditors.push(...saved.editors);
	app.selectedProjectEditor = saved.selected;
	app.editorImportTarget = saved.selected;
	document.body.innerHTML = '';
	setModeForTests('all');
});

describe('a work file dropped on the board', () => {
	it('nothing unsaved: it opens into this font, and Save writes back to the dropped file', async () => {
		setSaveStatus(editor, { file: 'saved' });
		const text = JSON.stringify(named('Dropped Font'));
		const handle = fakeFileHandle('Dropped Font.gs2', { text });
		const result = await openDroppedFont({
			editor,
			file: dropped('Dropped Font.gs2', text),
			handle: Promise.resolve(handle),
			unsaved: () => false,
		});
		expect(result).toBe('opened');
		expect(await waitFor(() => nameOf(editor) === 'Dropped Font')).toBe(true);
		expect(editor.loadedFileHandle).toBe(handle);
		expect(box()).toBeNull();
	});

	it('no handle (no File System Access): the dropped file is read; the font has no work file yet', async () => {
		const text = JSON.stringify(named('Plain Drop'));
		const result = await openDroppedFont({
			editor,
			file: dropped('Plain Drop.gs2', text),
			handle: null,
			unsaved: () => false,
		});
		expect(result).toBe('opened');
		expect(nameOf(editor)).toBe('Plain Drop');
		expect(editor.loadedFileHandle).toBe(false);
	});

	it("unsaved work: Ctrl+O's box first; Cancel opens nothing", async () => {
		const text = JSON.stringify(named('Not Yet'));
		editor.saveProjectFile = vi.fn(async () => true);
		expect(
			await openDroppedFont({
				editor,
				file: dropped('Not Yet.gs2', text),
				handle: null,
				unsaved: () => true,
			})
		).toBe('asked');
		expect(box().textContent).toContain(word('open.unsaved'));
		buttonNamed('open.cancel').click();
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(nameOf(editor)).toBe('Open Font');
		expect(editor.saveProjectFile).not.toHaveBeenCalled();
	});

	it('unsaved work: Save, then the dropped font opens with no second click', async () => {
		const text = JSON.stringify(named('After Save'));
		let unsaved = true;
		editor.saveProjectFile = vi.fn(async () => {
			unsaved = false;
		});
		await openDroppedFont({
			editor,
			file: dropped('After Save.gs2', text),
			handle: null,
			unsaved: () => unsaved,
		});
		buttonNamed('open.save').click();
		expect(await waitFor(() => nameOf(editor) === 'After Save')).toBe(true);
		expect(editor.saveProjectFile).toHaveBeenCalledTimes(1);
	});

	it('a file that is not a work file says so in plain words, and nothing opens', async () => {
		setModeForTests('simple');
		const result = await openDroppedFont({
			editor,
			file: dropped('notes.gs2', 'this is not a font'),
			handle: null,
			unsaved: () => false,
		});
		expect(result).toBe('failed');
		expect(nameOf(editor)).toBe('Open Font');
		const said = document.querySelector('#error')?.textContent || '';
		expect(said).toContain('notes.gs2');
		expect(said).not.toMatch(/JSON|PF0/);
	});
});
