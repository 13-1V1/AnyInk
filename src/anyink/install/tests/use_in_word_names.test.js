// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 fix pass (names), through the real Use in Word dialog:
//  - after a rename in Font details the card's step 2 names the old name's last test build
//  - a long name: the test family, the final family and "search <name> Test" share one base
//  - the dialog owns its folder words: a cancelled picker (from [Pick a folder...] or from Make my
//    font file) queues no toast behind the modal, where its button could not be pressed
// Written to fail first: the card had no uninstall line after a rename, searched the whole long
// name, and each folder problem also queued a toast.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetExportFolder, pickFontFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { abortError, clearDialogs, fakeApi, fakeDirectoryHandle } from '../../files/tests/fakes.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { kvClear } from '../../storage/kv.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import { closeUseInWord, openUseInWord } from '../use_in_word_dialog.js';
import { openBrennanHand } from './install_fixture.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const dialog = () => document.querySelector('dialog[data-anyink-dialog="useInWord"]');
const action = (name) => dialog()?.querySelector(`[data-anyink-install-action="${name}"]`);
const cardText = (selector) => dialog()?.querySelector(selector)?.textContent || '';

async function waitFor(check, ms = 8000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return false;
}

function folder(name, options) {
	const dir = fakeDirectoryHandle(name, options);
	dir.keys = async function* keys() {
		yield* dir.files.keys();
	};
	return dir;
}

async function pickedFolder(dir) {
	setFileApi(fakeApi({ open: undefined, save: undefined, directory: dir }));
	expect((await pickFontFolder()).status).toBe('picked');
}

async function makeTest() {
	action('make').click();
	expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'card')).toBe(true);
}

beforeEach(async () => {
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
	resetToastsForTests();
	setModeForTests('simple');
	setFeaturesForTests({ useInWord: true });
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	closeUseInWord();
	vi.restoreAllMocks();
	resetFileApi();
	clearDialogs();
	resetToastsForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('after a rename', () => {
	it("step 2 names the old name's last test build to uninstall", async () => {
		const editor = openBrennanHand();
		const dir = folder('My Fonts');
		await pickedFolder(dir);
		openUseInWord({ editor });
		await makeTest();
		action('done').click();
		openUseInWord({ editor });
		await makeTest();
		action('done').click();
		expect(dir.files.has('BrennanHand-Test2.otf')).toBe(true);

		editor.project.settings.project.name = 'Brennan Script';
		editor.project.settings.font.family = 'Brennan Script';
		openUseInWord({ editor });
		await makeTest();
		expect(dir.files.has('BrennanScript-Test1.otf')).toBe(true);
		expect(cardText('.anyink-install-card__name')).toContain('Brennan Script Test 1');
		expect(cardText('.anyink-install-card__earlier')).toContain(
			'If you installed Brennan Hand Test 2 earlier'
		);
	});
});

describe('a long name', () => {
	it('the test family, the final family and the search share one base', async () => {
		const long = 'Brennan Meyer’s Everyday Handwriting';
		const editor = openBrennanHand({ name: long });
		await pickedFolder(folder('My Fonts'));
		openUseInWord({ editor });
		await makeTest();
		expect(cardText('.anyink-install-card__name')).toContain('Brennan Meyer’s Test 1');
		const removeOld = dialog().querySelector('[data-anyink-install-more="removeOld"]');
		expect(removeOld.textContent).toContain('Brennan Meyer’s Test');
		expect(removeOld.textContent).not.toContain('Everyday');
		// B14 + B15 finalize: the final font keeps whole words up to 31 ("Brennan Meyer’s Everyday")
		const happy = dialog().querySelector('[data-anyink-install-more="happy"]');
		expect(happy.textContent).toContain('It is named Brennan Meyer’s Everyday.');
	});
});

describe('the dialog owns its folder words', () => {
	it('[Pick a folder...] cancelled: the note in the dialog, no toast behind it', async () => {
		const editor = openBrennanHand();
		setFileApi(fakeApi({ open: undefined, save: undefined, directory: () => abortError() }));
		openUseInWord({ editor });
		action('pick').click();
		expect(await waitFor(() => !!dialog()?.querySelector('[data-anyink-install-note="folder"]'))).toBe(
			true
		);
		expect(cardText('[data-anyink-install-note="folder"] .anyink-use-in-word__words')).toBe(word('error.noFolderPicked'));
		expect(toastLog()).toEqual([]);
	});

	it('Make my font file with no folder, picker cancelled: no toast before or after', async () => {
		const editor = openBrennanHand();
		const api = fakeApi({ open: [], save: undefined, directory: () => abortError() });
		setFileApi(api);
		openUseInWord({ editor });
		action('make').click();
		expect(await waitFor(() => api.calls.directory.length > 0)).toBe(true);
		expect(await waitFor(() => !!dialog()?.querySelector('[data-anyink-install-note="folder"]'))).toBe(
			true
		);
		expect(toastLog()).toEqual([]);
	});
});
