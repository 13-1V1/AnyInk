// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13 fix pass (finding: goToStartScreen and the Save-then-start path were only tested with
	mocks). Menu > Start a new font... with the real pieces: the real unsaved check, the real
	goToStartScreen (backup copy, the editor the start screen fills, the start screen drawn by
	the app), the real save, then Create on that start screen. The new font goes into the same
	editor with no work file, and Undo can't reach the old font.
	Written to fail first: see the fault-injection note in the final report (editorImportTarget
	hand-off and the old file handle).
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentProjectEditor, getGlyphrStudioApp } from '../../../app/main.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { hasUnsavedWork } from '../../files/open_font.js';
import { abortError, fakeApi, fakeFileHandle } from '../../files/tests/fakes.js';
import { B, shapeCount, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { recClear } from '../../storage/kv.js';
import { startNewFontCommand } from '../new_font.js';

const flush = async (n = 10) => {
	for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const startScreenShowing = () => !!document.querySelector('#open-project__page.anyink-start');
const box = () => document.querySelector('#modal-dialog');
const choice = (name) => box()?.querySelector(`[data-anyink-choice="${name}"]`);

let quiet;
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});
beforeEach(async () => {
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'error').mockImplementation(() => {}),
	];
	await recClear();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	setModeForTests('simple');
	setFeaturesForTests({ startScreen: true });
	// the save box on the start screen is cancelled: the new font is "Not saved yet"
	setFileApi(fakeApi({ open: [], save: abortError() }));
});
afterEach(async () => {
	quiet.forEach((spy) => spy.mockRestore());
	resetFileApi();
	setModeForTests('all');
	document.body.innerHTML = '';
	await recClear();
});

/** A font that came from a work file, with Capital B traced (one Undo step) */
function savedFont() {
	const handle = fakeFileHandle('Old Hand.gs2', { id: 'disk/old' });
	const editor = twoLetterEditor({ fileHandle: handle });
	editor.selectedItemID = B;
	traceInto(editor);
	return { editor, handle };
}

/** Create on the start screen with a name */
function createOnStartScreen(name) {
	document.querySelector('#input__new-project-name').value = name;
	document.querySelector('#button__create-new-project').click();
}

describe('Start a new font... with the real pieces', () => {
	it('nothing unsaved: the real start screen, then Create fills the same editor afresh', async () => {
		const { editor } = savedFont();
		await editor.saveProjectFile(); // the real save into its work file
		const navigate = vi.spyOn(getGlyphrStudioApp(), 'appPageNavigate');
		expect(hasUnsavedWork(editor)).toBe(false);
		expect(await startNewFontCommand({ editor })).toBe('start');
		expect(navigate).toHaveBeenCalledTimes(1);
		expect(startScreenShowing()).toBe(true);
		expect(getGlyphrStudioApp().editorImportTarget).toBe(editor);
		await flush();
		createOnStartScreen('Fresh Hand');
		expect(getCurrentProjectEditor()).toBe(editor);
		expect(editor.project.settings.project.name).toBe('Fresh Hand');
		expect(shapeCount(editor, B)).toBe(0);
		expect(editor.loadedFileHandle).toBeFalsy();
		await flush();
		expect(editor.loadedFileHandle).toBeFalsy();
	});

	it('unsaved work: [Save] saves, then the start screen, then Create: no work file, no way back', async () => {
		const { editor, handle } = savedFont();
		expect(hasUnsavedWork(editor)).toBe(true);
		expect(await startNewFontCommand({ editor })).toBe('asked');
		expect(startScreenShowing()).toBe(false);
		choice('save').click();
		for (let i = 0; i < 40 && !startScreenShowing(); i++) await flush(2);
		expect(handle.written).toBeTruthy(); // the old font is in its file
		expect(startScreenShowing()).toBe(true);
		await flush();
		createOnStartScreen('Fresh Hand');
		expect(getCurrentProjectEditor()).toBe(editor);
		expect(editor.project.settings.project.name).toBe('Fresh Hand');
		expect(editor.loadedFileHandle).toBeFalsy();
		// Undo can't bring the old font (or its traced B) back into the new one
		expect(editor.history.queue).toHaveLength(0);
		editor.history.restoreState?.();
		expect(editor.project.settings.project.name).toBe('Fresh Hand');
		expect(shapeCount(editor, B)).toBe(0);
	});

	it('[Cancel]: his font and its work file stay, no start screen', async () => {
		const { editor, handle } = savedFont();
		await startNewFontCommand({ editor });
		choice('cancel').click();
		await flush();
		expect(startScreenShowing()).toBe(false);
		expect(editor.loadedFileHandle).toBe(handle);
		expect(shapeCount(editor, B)).toBe(1);
	});
});
