// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Which handle a dropped or chosen file hands to the editor as its save target
	(src/formats_io/validate_file_input.js). Only a .gs2 may become
	editor.loadedFileHandle; a Glyphr Studio v1 .txt is read, never written back.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateSingleFileInput } from '../../../formats_io/validate_file_input.js';
import { fakeFileHandle, minimalProjectText } from './fakes.js';

/** Runs the upstream validator and resolves its result (a snapshot copy: the object is reused). */
function validate(input) {
	return new Promise((resolve, reject) => {
		validateSingleFileInput(input, (result) => resolve({ ...result })).catch(reject);
	});
}

let warn;
beforeEach(() => {
	// the upstream code path taken in Chromium: both pickers exist
	window.showOpenFilePicker = () => {};
	window.showSaveFilePicker = () => {};
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	delete window.showOpenFilePicker;
	delete window.showSaveFilePicker;
	warn.mockRestore();
});

describe('validate_file_input: the save target handle (finding 3)', () => {
	it('a v1 .txt project is read, but its handle is not offered as the save target', async () => {
		const v1 = fakeFileHandle('MyFont.txt', { text: minimalProjectText('MyFont', '1.13.2') });
		const result = await validate(v1);
		expect(result.fileType).toBe('project');
		expect(result.content.settings.project.name).toBe('MyFont');
		expect(result.fileHandle).toBe(false);
		expect(result.sourceHandle).toBe(v1);
	});

	it('a .gs2 project handle is the save target', async () => {
		const gs2 = fakeFileHandle('MyFont.GS2', { text: minimalProjectText('MyFont') });
		const result = await validate(gs2);
		expect(result.fileType).toBe('project');
		expect(result.fileHandle).toBe(gs2);
		expect(result.sourceHandle).toBe(gs2);
	});

	it('a plain File (dropped without a handle) is read as a File, never as a handle', async () => {
		const file = new File([minimalProjectText('Plain')], 'Plain.gs2', { type: 'application/json' });
		const result = await validate(file);
		expect(result.content.settings.project.name).toBe('Plain');
		expect(result.fileHandle).toBe(false);
		expect(result.sourceHandle).toBe(false);
	});

	it('a bad file after a good one does not reuse the good one (no stale content or handle)', async () => {
		const good = fakeFileHandle('Good.gs2', { text: minimalProjectText('Good') });
		expect((await validate(good)).content).toBeTruthy();
		const bad = fakeFileHandle('Bad.gs2', { text: 'not json' });
		const result = await validate(bad);
		expect(result.content).toBe(false);
		expect(result.errorMessage).toContain('[PF0]');
		expect(result.fileHandle).toBe(bad);
	});
});
