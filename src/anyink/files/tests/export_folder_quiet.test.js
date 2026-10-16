// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 fix pass (names, UX-BEGINNER.md 4.7, 7.7): Use in Word draws its own folder words
// ("No folder picked", "Couldn't write to ...") inside its dialog. A toast behind the modal is
// inert (its button can't be pressed) and says the same thing twice, so with { quiet: true }
// pickFontFolder, prepareExportDestination and writeExport ask for no toast at all; the dialog
// owns the words. Without quiet everything is as before.
// Written to fail first: each of these queued a toast while the dialog handled the same case.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { kvClear } from '../../storage/kv.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import {
	EXPORT_FOLDER_KEY,
	forgetExportFolder,
	pickFontFolder,
	prepareExportDestination,
	writeExport,
} from '../export_folder.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { rememberHandle } from '../handles.js';
import { abortError, clearDialogs, fakeApi, fakeDirectoryHandle } from './fakes.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const blob = () => new Blob(['font'], { type: 'font/opentype' });

beforeEach(async () => {
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
	resetToastsForTests();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	vi.restoreAllMocks();
	resetFileApi();
	clearDialogs();
	resetToastsForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe.each(['simple', 'all'])('quiet, in %s', (mode) => {
	beforeEach(() => setModeForTests(mode));

	it('a cancelled [Pick a folder...] says nothing', async () => {
		setFileApi(fakeApi({ directory: () => abortError() }));
		expect((await pickFontFolder({ quiet: true })).status).toBe('cancelled');
		expect(toastLog()).toEqual([]);
	});

	it('no folder yet, then the picker cancelled: no sentence before it, none after', async () => {
		setFileApi(fakeApi({ open: [], save: undefined, directory: () => abortError() }));
		expect((await prepareExportDestination({ quiet: true })).kind).toBe('cancelled');
		expect(toastLog()).toEqual([]);
	});

	it('a remembered folder that needs one more click says nothing', async () => {
		setFileApi(fakeApi({ open: [], save: undefined, directory: () => abortError() }));
		await rememberHandle(
			EXPORT_FOLDER_KEY,
			fakeDirectoryHandle('My Fonts', { query: 'prompt', request: 'prompt' })
		);
		expect((await prepareExportDestination({ quiet: true })).kind).toBe('prompt');
		expect(toastLog()).toEqual([]);
	});

	it('a refused folder opens the picker without a toast', async () => {
		const other = fakeDirectoryHandle('Other Fonts');
		const api = fakeApi({ open: [], save: undefined, directory: other });
		setFileApi(api);
		await rememberHandle(
			EXPORT_FOLDER_KEY,
			fakeDirectoryHandle('My Fonts', { query: 'denied', request: 'denied' })
		);
		const destination = await prepareExportDestination({ quiet: true });
		expect(destination.kind).toBe('folder');
		expect(destination.dir).toBe(other);
		expect(toastLog()).toEqual([]);
	});

	it('permission lapsed after the build: "prompt" comes back with no toast', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const dir = fakeDirectoryHandle('My Fonts', { query: 'prompt', request: 'prompt' });
		const result = await writeExport({ kind: 'folder', dir }, blob(), 'BrennanHand-Test1.otf', {
			quiet: true,
		});
		expect(result).toBe('prompt');
		expect(toastLog()).toEqual([]);
	});
});

describe('without quiet, as before', () => {
	it('Simple: a cancelled [Pick a folder...] still says "No folder picked"', async () => {
		setModeForTests('simple');
		setFileApi(fakeApi({ directory: () => abortError() }));
		await pickFontFolder();
		expect(toastLog().map((record) => record.key)).toContain('error.noFolderPicked');
	});

	it('a lapsed permission after the build still says to click again', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const dir = fakeDirectoryHandle('My Fonts', { query: 'prompt', request: 'prompt' });
		await writeExport({ kind: 'folder', dir }, blob(), 'BrennanHand-Test1.otf');
		expect(toastLog().length).toBeGreaterThan(0);
	});
});
