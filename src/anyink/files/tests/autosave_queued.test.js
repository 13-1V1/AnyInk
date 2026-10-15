// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize (verdict "Simple save status ... never says 'Saving...'"): UX-BEGINNER.md 4.11
// says "Saving..." while a file write is queued or running. The autosave queues a write of the
// work file about 3 s after a change (D-030); while that write waits, the save status knows
// (markSaveQueued), so Simple says "Saving..." instead of "Not saved yet". A font with no work
// file has nothing queued. And the autosave runs whether or not crash recovery started (D-030:
// the two are independent).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { markDirty } from '../../recovery/recovery.js';
import { AUTOSAVE_INTERVAL_MS, cancelAutosave, scheduleAutosave } from '../autosave.js';
import { rememberFileVersion } from '../save_queue.js';
import { getSaveStatus, markSaveDirty, saveStatusWords } from '../save_status.js';
import { fakeFileHandle } from './fakes.js';

function editorWith(handle) {
	const project = new GlyphrStudioProject({
		settings: { project: { id: 'queued', name: 'Queued' } },
		glyphs: { 'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 600 } },
	});
	const editor = new ProjectEditor({ project });
	editor.loadedFileHandle = handle;
	setCurrentProjectEditor(editor);
	return editor;
}
const simpleKey = (editor) =>
	saveStatusWords(getSaveStatus(editor), { simple: true, workFile: !!editor.loadedFileHandle }).key;

let editor;
beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	if (editor) cancelAutosave(editor);
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('a queued write of the work file', () => {
	it('Simple says "Saving..." while it waits', () => {
		editor = editorWith(fakeFileHandle('Queued.gs2'));
		markSaveDirty(editor);
		expect(simpleKey(editor)).toBe('status.notSavedToFile');
		scheduleAutosave(editor);
		expect(getSaveStatus(editor).queued).toBe(true);
		expect(simpleKey(editor)).toBe('status.saving');
	});

	it('cancelled: no longer queued', () => {
		editor = editorWith(fakeFileHandle('Queued.gs2'));
		markSaveDirty(editor);
		scheduleAutosave(editor);
		cancelAutosave(editor);
		expect(getSaveStatus(editor).queued).toBe(false);
	});

	it('written: no longer queued, and Saved', async () => {
		const handle = fakeFileHandle('Queued.gs2');
		editor = editorWith(handle);
		await rememberFileVersion(editor, handle); // as opening or saving the work file does
		markSaveDirty(editor);
		scheduleAutosave(editor);
		await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS + 50);
		await vi.waitFor(() => expect(getSaveStatus(editor).file).toBe('saved'));
		expect(getSaveStatus(editor).queued).toBe(false);
		expect(simpleKey(editor)).toBe('status.saved');
	});

	it('a font with no work file has nothing queued: "Not saved yet"', () => {
		editor = editorWith(false);
		markSaveDirty(editor);
		scheduleAutosave(editor);
		expect(getSaveStatus(editor).queued).toBe(false);
		expect(simpleKey(editor)).toBe('status.notSavedYet');
	});

	it('a change queues the write even before crash recovery started (D-030)', () => {
		editor = editorWith(fakeFileHandle('Queued.gs2'));
		markDirty(editor.history);
		expect(getSaveStatus(editor).queued).toBe(true);
	});
});
