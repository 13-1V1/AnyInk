// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize, Ctrl+O ("Open a saved font", UX-BEGINNER.md 7.6, 7.4 #4), two verdicts:
//   - "Ctrl+O loads the picked font into app.editorImportTarget, not the font the user is in, so
//     with two fonts open it silently replaces the OTHER font": the picked font now takes the
//     place of the font Ctrl+O was pressed in (the one the unsaved check guarded), and no "Switched
//     to" note from an earlier second-font page follows it
//   - "Ctrl+O replaces the open font without asking when the unsaved work has no shapes
//     (photos, renames, guide lines)": it asks whenever the work file doesn't hold the latest
//     change (the save status isn't Saved and History has a real step, or ink the file lacks)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	addProjectEditorAndSetAsImportTarget,
	getCurrentProjectEditor,
	getGlyphrStudioApp,
	setCurrentProjectEditor,
} from '../../../app/main.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { makeTrace, setTrace } from '../../trace/trace_model.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { openFontCommand } from '../open_font.js';
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
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	app = getGlyphrStudioApp();
	saved = { editors: [...app.projectEditors], selected: app.selectedProjectEditor };
});
afterEach(() => {
	resetFileApi();
	vi.restoreAllMocks();
	app.projectEditors.length = 0;
	app.projectEditors.push(...saved.editors);
	app.selectedProjectEditor = saved.selected;
	app.editorImportTarget = saved.selected;
	document.body.innerHTML = '';
});

describe('Ctrl+O with two fonts open', () => {
	it('the picked font takes the place of the font he is in, not the other one', async () => {
		const first = app.selectedProjectEditor;
		first.project = importGlyphrProjectFromText(named('First Font'));
		const second = addProjectEditorAndSetAsImportTarget();
		second.project = importGlyphrProjectFromText(named('Second Font'));
		// back in the first font (the Projects menu's Switch to)
		setCurrentProjectEditor(first);
		setSaveStatus(first, { file: 'saved' });
		const handle = fakeFileHandle('Picked Font.gs2', { text: JSON.stringify(named('Picked Font')) });
		setFileApi(fakeApi({ open: [handle], save: undefined }));

		expect(await openFontCommand({ editor: first })).toBe('picker');
		expect(await waitFor(() => nameOf(first) === 'Picked Font' || nameOf(second) === 'Picked Font')).toBe(
			true
		);
		expect(nameOf(first)).toBe('Picked Font');
		expect(nameOf(second)).toBe('Second Font');
		expect(getCurrentProjectEditor()).toBe(first);
		expect(first.loadedFileHandle).toBe(handle);
	});
});

describe('Ctrl+O asks whenever the work file is behind', () => {
	function withPhotoOnB() {
		const editor = twoLetterEditor({ fileHandle: fakeFileHandle('Two Letters.gs2') });
		editor.selectedGlyphID = B;
		const item = editor.selectedItem;
		const asset = editor.assets.add(new Blob(['x'], { type: 'image/png' }), { type: 'image/png' });
		setTrace(item, makeTrace({ asset, width: 100, height: 100 }, editor.project.settings.font));
		editor.history.addState('Added a trace image');
		return editor;
	}

	it('a photo and a rename, no shapes yet: the box, no picker', async () => {
		const editor = withPhotoOnB();
		editor.project.settings.font.family = 'Brennan Hand';
		const api = fakeApi({ open: [], save: undefined });
		setFileApi(api);
		expect(await openFontCommand({ editor })).toBe('asked');
		expect(box()).toBeTruthy();
		expect(api.calls.open).toHaveLength(0);
	});

	it('the same font, saved: straight to the picker', async () => {
		const editor = withPhotoOnB();
		setSaveStatus(editor, { file: 'saved' });
		const api = fakeApi({ open: [], save: undefined });
		setFileApi(api);
		expect(await openFontCommand({ editor })).toBe('picker');
		expect(box()).toBe(null);
	});

	it('a new font with nothing done: straight to the picker', async () => {
		const editor = twoLetterEditor();
		const api = fakeApi({ open: [], save: undefined });
		setFileApi(api);
		expect(await openFontCommand({ editor })).toBe('picker');
	});
});
