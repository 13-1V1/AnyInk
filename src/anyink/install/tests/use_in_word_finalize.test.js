// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 finalize, each written to fail first:
//  - the final font keeps a name that fits Windows' 31 characters whole, and two long names that
//    share a test base still get different final fonts (familyBase cut the final family too);
//  - after a rename, both cards' "Remove old test fonts: how" also search the old name's tests;
//    the final card keeps the work file's old names;
//  - Use in Word's build says nothing behind its dialog: no "Making the font file..." or
//    "Exported ..." toast, no toast when the folder's permission lapses during the write (the
//    dialog says it), and a Cancel on "a file of that name is already there" is said in the
//    dialog (no toast, and not silence);
//  - a toast from while the dialog stepped aside (Delete's [Undo]) is still there with the card;
//  - [Change] cancelled with a folder remembered leaves the dialog as it was;
//  - an ANY-INK dialog takes an open menu away at once (Menu open, then Ctrl+E).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetExportFolder, pickFontFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { abortError, clearDialogs, fakeApi, fakeDirectoryHandle } from '../../files/tests/fakes.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { kvClear } from '../../storage/kv.js';
import { resetToastsForTests, toast, toastLog } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import {
	familyBase,
	finalBuildNames,
	MAX_FAMILY_LENGTH,
	testBuildNames,
} from '../build_names.js';
import { closeUseInWord, openUseInWord } from '../use_in_word_dialog.js';
import { openBrennanHand } from './install_fixture.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const dialog = () => document.querySelector('dialog[data-anyink-dialog="useInWord"]');
const action = (name) => dialog()?.querySelector(`[data-anyink-install-action="${name}"]`);
const noteOf = (name) => dialog()?.querySelector(`[data-anyink-install-note="${name}"]`);
const removeOldText = () =>
	dialog()?.querySelector('[data-anyink-install-more="removeOld"]')?.textContent || '';
const liveToasts = () =>
	[...document.querySelectorAll('#toast[data-anyink-toast="simple"]:not([data-leaving])')].map(
		(element) => element.textContent
	);
/** Every toast asked for, as its key or its upstream words */
const asked = () => toastLog().map((record) => record.key || record.message);

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
	expect((await pickFontFolder({ quiet: true })).status).toBe('picked');
}

async function makeAndWait(name = 'make') {
	action(name).click();
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

describe('the final font keeps its whole name when it fits', () => {
	it('a 30-character name is the final family as it is', () => {
		const name = 'Brennan Meyer’s Everyday Print';
		expect(name.length).toBeLessThanOrEqual(MAX_FAMILY_LENGTH);
		expect(finalBuildNames(name).family).toBe(name);
		// the test builds still share the shorter base
		expect(testBuildNames(name, 1).family).toBe(`${familyBase(name)} Test 1`);
	});

	it('two long names that share a test base get different final fonts', () => {
		const a = finalBuildNames('Brennan Meyer’s Everyday Print').family;
		const b = finalBuildNames('Brennan Meyer’s Everyday Handwriting').family;
		expect(familyBase('Brennan Meyer’s Everyday Print')).toBe(
			familyBase('Brennan Meyer’s Everyday Handwriting')
		);
		expect(a).not.toBe(b);
		expect(b.length).toBeLessThanOrEqual(MAX_FAMILY_LENGTH);
		// cut at a word, never inside one
		expect(b).toBe('Brennan Meyer’s Everyday');
	});
});

describe('after a rename, the old tests are named for clean-up', () => {
	async function renamedAfterTwoTests() {
		const editor = openBrennanHand();
		const dir = folder('My Fonts');
		await pickedFolder(dir);
		for (let i = 0; i < 2; i++) {
			openUseInWord({ editor });
			await makeAndWait();
			action('done').click();
		}
		editor.project.settings.project.name = 'Brennan Script';
		editor.project.settings.font.family = 'Brennan Script';
		return { editor, dir };
	}

	it("the test card's Remove old test fonts searches the old name too", async () => {
		const { editor } = await renamedAfterTwoTests();
		openUseInWord({ editor });
		await makeAndWait();
		expect(removeOldText()).toContain('Brennan Script Test');
		expect(removeOldText()).toContain('Brennan Hand Test');
	});

	it('the final card names the old tests as well', async () => {
		const { editor, dir } = await renamedAfterTwoTests();
		openUseInWord({ editor });
		await makeAndWait();
		await makeAndWait('makeFinal');
		expect(dir.files.has('BrennanScript-Regular.otf')).toBe(true);
		expect(dialog().querySelector('[data-anyink-install-card]').dataset.anyinkInstallCard).toBe(
			'final'
		);
		expect(removeOldText()).toContain('Brennan Script Test');
		expect(removeOldText()).toContain('Brennan Hand Test');
	});
});

describe('the build says nothing behind the dialog', () => {
	it('a font file made: no making or made toast', async () => {
		const editor = openBrennanHand();
		await pickedFolder(folder('My Fonts'));
		openUseInWord({ editor });
		await makeAndWait();
		expect(asked()).toEqual([]);
	});

	it('the permission lapses during the write: the dialog says it, no toast', async () => {
		const editor = openBrennanHand();
		const dir = folder('My Fonts', { request: 'prompt' });
		await pickedFolder(dir);
		openUseInWord({ editor });
		const before = dir.calls.query;
		await makeAndWait();
		action('done').click();
		const perBuild = dir.calls.query - before;
		// the next build's last check (the write's) finds Chrome wants an OK again
		const lapseAt = dir.calls.query + perBuild;
		const query = dir.queryPermission;
		dir.queryPermission = async () => {
			const state = await query();
			return dir.calls.query >= lapseAt ? 'prompt' : state;
		};
		resetToastsForTests();
		openUseInWord({ editor });
		action('make').click();
		expect(await waitFor(() => !!noteOf('notWritable'))).toBe(true);
		expect(asked()).toEqual([]);
	});

	it('Cancel on "a file of that name is already there": said in the dialog, no toast', async () => {
		const editor = openBrennanHand();
		const dir = folder('My Fonts');
		// another work file's final font, same name
		dir.addFile('BrennanHand-Regular.otf');
		await pickedFolder(dir);
		openUseInWord({ editor });
		await makeAndWait();
		resetToastsForTests();
		action('makeFinal').click();
		expect(
			await waitFor(() => !!document.querySelector('[data-anyink-choice="cancel"]'))
		).toBe(true);
		document.querySelector('[data-anyink-choice="cancel"]').click();
		expect(await waitFor(() => !!noteOf('writeCancelled'))).toBe(true);
		expect(noteOf('writeCancelled').textContent).toContain(word('install.note.writeCancelled'));
		expect(asked()).toEqual([]);
	});

	it("a toast from while the dialog stepped aside is still there with the card", async () => {
		const editor = openBrennanHand();
		await pickedFolder(folder('My Fonts'));
		openUseInWord({ editor });
		action('make').click();
		// Delete's toast, with its [Undo], while the build runs
		toast('install.more.cantInstall', {}, {
			kind: 'destructive',
			action: { key: 'install.how', run: () => {} },
		});
		expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'card')).toBe(true);
		expect(liveToasts().join(' ')).toContain(word('install.more.cantInstall'));
	});
});

describe('the folder line', () => {
	it('[Change] cancelled with a folder remembered: nothing changes', async () => {
		const editor = openBrennanHand();
		const dir = folder('My Fonts');
		await pickedFolder(dir);
		setFileApi(fakeApi({ open: undefined, save: undefined, directory: () => abortError() }));
		openUseInWord({ editor });
		expect(await waitFor(() => !!action('change'))).toBe(true);
		action('change').click();
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(noteOf('folder')).toBeNull();
		expect(dialog().querySelector('.anyink-use-in-word__folder').textContent).toContain(
			'My Fonts'
		);
	});
});

describe('a menu open when the dialog opens', () => {
	it('goes at once (Menu open, then Ctrl+E)', () => {
		const editor = openBrennanHand();
		const menu = document.createElement('div');
		menu.id = 'context-menu';
		menu.dataset.anyinkMenu = 'simple';
		document.body.appendChild(menu);
		openUseInWord({ editor });
		expect(dialog()).not.toBeNull();
		expect(document.querySelector('#context-menu')).toBeNull();
	});
});
