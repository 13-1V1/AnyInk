// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize (verdicts: "a failed Save shows the browser's raw error sentence in an Error
// box", "Ctrl+O shows JSON, [PF0]/[PF1] codes and raw parser text", "Error boxes bypass the words
// layer in Simple"): in Simple every error box a file command can raise says the 7.7 words
// (error_words.js) through error_box.js, and its buttons do what they say:
//   - Save failed: [Try again] saves again, [Save somewhere else] opens the Save dialog; the file
//     changed on disk: [Save as a new file] opens the Save dialog
//   - a work file that won't open: [Open another work file...] opens a font (Ctrl+O's command)
//   - a font file that couldn't be made: [Try again] makes it again
//   - any other file command: one sentence and [Close]
// The browser's own sentence goes to the console only. All tools keeps its boxes (as before).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { setModeForTests } from '../../mode/mode.js';
import { kvClear } from '../../storage/kv.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import { forgetExportFolder } from '../export_folder.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { openProjectFromHandle } from '../project_files.js';
import { runFileCommand } from '../run_command.js';
import {
	clearDialogs,
	fakeApi,
	fakeDirectoryHandle,
	fakeFileHandle,
	namedError,
} from './fakes.js';

const box = () => document.querySelector('#error');
const choice = (key) => box()?.querySelector(`[data-anyink-choice="${key}"]`);
const choices = () =>
	[...(box()?.querySelectorAll('[data-anyink-choice]') || [])].map((b) => b.textContent);

async function waitFor(check, ms = 3000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return false;
}

let quiet;
beforeEach(async () => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	await kvClear();
	clearDialogs();
	resetToastsForTests();
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'error').mockImplementation(() => {}),
	];
});
afterEach(() => {
	quiet.forEach((spy) => spy.mockRestore());
	resetFileApi();
	clearDialogs();
	resetToastsForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

const BROWSER = 'An operation that depends on state cached in an interface object was made.';

/** A work file whose write throws error, and a Save that hits it. */
async function failingSave(error) {
	const editor = sampleEditor();
	const api = fakeApi({ open: [], save: fakeFileHandle('Elsewhere.gs2') });
	setFileApi(api);
	const handle = fakeFileHandle('Brennan Hand.gs2', { writeError: error });
	editor.loadedFileHandle = handle;
	editor.setProjectAsUnsaved();
	await runFileCommand(() => editor.saveProjectFile());
	await waitFor(() => box());
	return { editor, api, handle };
}

describe('Simple: Save failed', () => {
	beforeEach(() => setModeForTests('simple'));

	it('[Try again] saves again', async () => {
		const { handle } = await failingSave(namedError('AbortError', BROWSER));
		expect(box().textContent).not.toContain(BROWSER);
		expect(choices()).toEqual(['Try again', 'Save somewhere else']);
		const before = handle.calls.createWritable;
		choice('error.button.tryAgain').click();
		expect(await waitFor(() => handle.calls.createWritable > before)).toBe(true);
	});

	it('[Save somewhere else] opens the Save dialog', async () => {
		const { api } = await failingSave(namedError('AbortError', BROWSER));
		choice('error.button.saveElsewhere').click();
		expect(await waitFor(() => api.calls.save.length === 1)).toBe(true);
	});

	it('the file changed on disk: [Save as a new file] opens the Save dialog', async () => {
		const { api } = await failingSave(namedError('InvalidStateError', BROWSER));
		expect(choices()).toEqual(['Save as a new file']);
		choice('error.button.saveAsNew').click();
		expect(await waitFor(() => api.calls.save.length === 1)).toBe(true);
	});
});

describe("Simple: a work file that won't open", () => {
	beforeEach(() => setModeForTests('simple'));

	it.each([
		['Broken.gs2', '{bad'],
		['Notes.gs2', '{"hello": "world"}'],
	])('%s: the 7.7 sentence, and [Open another work file...] opens a font', async (name, text) => {
		const editor = sampleEditor();
		const api = fakeApi({ open: [], save: undefined });
		setFileApi(api);
		await openProjectFromHandle(fakeFileHandle(name, { text }), { load: () => editor });
		await waitFor(() => box());
		expect(box().textContent).toContain(`${name} isn't an ANY-INK work file`);
		expect(box().textContent).not.toMatch(/JSON|\[PF\d\]|project/);
		choice('error.button.openAnother').click();
		// Ctrl+O's command: the picker, or first the box asking to save unsaved work
		expect(
			await waitFor(
				() => api.calls.open.length === 1 || !!document.querySelector('.anyink-open-box')
			)
		).toBe(true);
	});
});

describe("Simple: a file command that didn't finish", () => {
	it("one sentence and [Close]; the browser's sentence stays in the console", async () => {
		setModeForTests('simple');
		await runFileCommand(() => {
			throw namedError('InvalidStateError', BROWSER);
		});
		expect(box().textContent).toContain(word('error.didntFinish'));
		expect(box().textContent).not.toContain(BROWSER);
		expect(choices()).toEqual(['Close']);
	});
});

describe("Simple: a font file that couldn't be made", () => {
	it('[Try again] makes it again', async () => {
		setModeForTests('simple');
		await forgetExportFolder();
		sampleEditor();
		const disk = namedError('QuotaExceededError', 'The disk is full.');
		let tries = 0;
		setFileApi(
			fakeApi({
				open: [],
				save: undefined,
				directory: fakeDirectoryHandle('My Fonts', { fileOptions: { writeError: disk } }),
				download: () => {
					tries++;
					throw disk;
				},
			})
		);
		await ioFont_exportFont('otf');
		await waitFor(() => box());
		expect(box().textContent).toContain(word('error.fontFileFailed'));
		expect(box().textContent).not.toMatch(/disk is full|OTF/);
		expect(choices()).toEqual(['Try again']);
		const before = tries;
		choice('error.button.tryAgain').click();
		expect(await waitFor(() => tries > before, 8000)).toBe(true);
	}, 20000);
});

describe('All tools keeps its boxes', () => {
	it("Save failed: Glyphr Studio's box with the error, as before", async () => {
		await failingSave(namedError('AbortError', BROWSER));
		expect(box().querySelector('h3').textContent).toBe('Error');
		expect(box().textContent).toContain('could not be saved');
		expect(box().textContent).toContain(BROWSER);
	});

	it('a damaged work file: its own message, as before', async () => {
		const editor = sampleEditor();
		setFileApi(fakeApi({ open: [], save: undefined }));
		await openProjectFromHandle(fakeFileHandle('Broken.gs2', { text: '{bad' }), {
			load: () => editor,
		});
		await waitFor(() => box());
		expect(box().textContent).toContain('[PF0]');
	});
});
