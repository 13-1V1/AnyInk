// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 (UX-BEGINNER.md 4.7, 7.7): Use in Word's own [Pick a folder...] (not an export). When the
// picker comes back with nothing (cancelled, or Chrome refused a system folder such as Documents
// and he closed it), Simple says "No folder picked. Make a new folder inside Documents (Chrome won't
// let you pick Documents itself) and choose it." with [Pick a folder...], which opens the picker
// again. A picked folder is remembered and says nothing (the dialog shows the folder line itself).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { kvClear } from '../../storage/kv.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import { exportFolderName, forgetExportFolder, pickFontFolder } from '../export_folder.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { abortError, clearDialogs, fakeApi, fakeDirectoryHandle } from './fakes.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const simpleToast = () =>
	document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])');
const simpleText = () => simpleToast()?.querySelector('.anyink-toast__text')?.textContent || '';
const said = (key) => toastLog().filter((record) => record.key === key);

async function waitFor(check, ms = 4000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return false;
}

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

describe('Simple: Pick a folder... in Use in Word', () => {
	beforeEach(() => setModeForTests('simple'));

	it('a cancelled picker says "No folder picked. ..." with [Pick a folder...]', async () => {
		let answer = abortError();
		const fonts = fakeDirectoryHandle('My Fonts');
		const api = fakeApi({ directory: () => answer });
		setFileApi(api);

		expect((await pickFontFolder()).status).toBe('cancelled');
		expect(simpleText()).toBe(word('error.noFolderPicked'));
		const button = simpleToast().querySelector('button');
		expect(button.textContent).toBe(word('error.button.pickFolder'));

		answer = fonts;
		button.click();
		expect(await waitFor(() => exportFolderName() === 'My Fonts')).toBe(true);
		expect(api.calls.directory).toHaveLength(2);
	});

	it("[Pick a folder...] runs the caller's retry when one is given", async () => {
		setFileApi(fakeApi({ directory: () => abortError() }));
		const retry = vi.fn();
		await pickFontFolder({ retry });
		simpleToast().querySelector('button').click();
		expect(retry).toHaveBeenCalledTimes(1);
	});

	it('a picked folder is remembered and says nothing', async () => {
		const fonts = fakeDirectoryHandle('My Fonts');
		setFileApi(fakeApi({ directory: fonts }));
		const choice = await pickFontFolder();
		expect(choice).toEqual({ status: 'picked', dir: fonts });
		expect(exportFolderName()).toBe('My Fonts');
		expect(said('error.noFolderPicked')).toHaveLength(0);
	});
});

describe('All tools', () => {
	it('a cancelled picker only reports it; no Simple sentence', async () => {
		setFileApi(fakeApi({ directory: () => abortError() }));
		expect((await pickFontFolder()).status).toBe('cancelled');
		expect(said('error.noFolderPicked')).toHaveLength(0);
	});
});
