// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 fix pass (critic findings, 10/15/2026), each written to fail first:
//  - a font with no letter made builds nothing and uses up no test number: one sentence and
//    [Back to my letters] in place of the green button;
//  - quotes on the card and the dialog are marked (bold, as Help's), and step 4 is short steps;
//  - a cancelled folder pick says it once: the error alone, no tip, no toast;
//  - the "Exported ..." toast goes once the card says "Made ...";
//  - step 2 is the double-click way only, step 3 says to type the name in Word's font box;
//  - step 4 only when the built file really holds a gap fix (not a pair with an empty or a
//    missing letter);
//  - no second build while one is in flight.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetExportFolder, pickFontFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { clearDialogs, fakeApi, fakeDirectoryHandle } from '../../files/tests/fakes.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { kvClear } from '../../storage/kv.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { cardSteps, hasGapFixes, makeInstallCard } from '../install_card.js';
import {
	closeUseInWord,
	isUseInWordOpen,
	makeFontFile,
	openUseInWord,
} from '../use_in_word_dialog.js';
import { hasLetterToMake } from '../word_export.js';
import { openBrennanHand } from './install_fixture.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const dialog = () => document.querySelector('dialog[data-anyink-dialog="useInWord"]');
const action = (name) => dialog()?.querySelector(`[data-anyink-install-action="${name}"]`);
const noteOf = (name) => dialog()?.querySelector(`[data-anyink-install-note="${name}"]`);
const liveToasts = () =>
	[...document.querySelectorAll('#toast[data-anyink-toast="simple"]:not([data-leaving])')].map(
		(element) => element.textContent
	);
const abort = () => Object.assign(new Error('closed'), { name: 'AbortError' });

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

const model = (extra = {}) => ({
	kind: 'test',
	name: 'Brennan Hand',
	fileName: 'BrennanHand-Test3.otf',
	family: 'Brennan Hand Test 3',
	finalFamily: 'Brennan Hand',
	folder: 'My Fonts',
	downloaded: false,
	earlier: null,
	number: 3,
	gapFixes: false,
	versions: false,
	...extra,
});

const text = (html) => {
	const div = document.createElement('div');
	div.innerHTML = html;
	return div.textContent;
};

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

describe('a font with no letter made', () => {
	it('has nothing to make', () => {
		expect(hasLetterToMake(openBrennanHand().project)).toBe(true);
		expect(hasLetterToMake(openBrennanHand({ empty: true }).project)).toBe(false);
	});

	it('shows one sentence and Back to my letters, no green Make button', () => {
		const editor = openBrennanHand({ empty: true });
		openUseInWord({ editor });
		expect(action('make')).toBeNull();
		expect(noteOf('noLetters').textContent).toContain('Make at least one letter first.');
		expect(noteOf('empty')).toBeNull();
		const back = action('backToLetters');
		expect(back.textContent).toBe('Back to my letters');
		expect(back.classList.contains('anyink-primary')).toBe(true);
		back.click();
		expect(isUseInWordOpen()).toBe(false);
		expect(editor.nav.page).toBe('Overview');
	});

	it('makes no file and uses up no test number', async () => {
		const editor = openBrennanHand({ empty: true });
		const dir = folder('My Fonts');
		const exportFont = vi.fn(async () => 'folder');
		const outcome = await makeFontFile(editor, {
			destination: { kind: 'folder', dir },
			exportFont,
		});
		expect(outcome.status).toBe('noLetters');
		expect(exportFont).not.toHaveBeenCalled();
		expect(dir.files.size).toBe(0);
		// a letter drawn later still makes Test 1
		const later = openBrennanHand();
		await pickedFolder(dir);
		openUseInWord({ editor: later });
		action('make').click();
		expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'card')).toBe(true);
		expect(dir.files.has('BrennanHand-Test1.otf')).toBe(true);
	});
});

describe("Word's and Windows' labels are marked", () => {
	const css = (name) =>
		readFileSync(resolve(process.cwd(), 'src/anyink/install', name), 'utf8').replace(/\s+/g, ' ');

	// B14 + B15 finalize: one shared rule (resets.css) the card, the dialog and Help turn on
	// (quote_style.test.js)
	it('quotes are bold on the card and in the dialog, as in Help', () => {
		expect(css('../../common/resets.css')).toMatch(
			/\[data-anyink-quotes='bold'\] \.anyink-quote \{[^}]*font-weight: 600/
		);
		expect(makeInstallCard(model()).dataset.anyinkQuotes).toBe('bold');
	});

	it('step 4 is short steps, each a sentence of its own', () => {
		const gaps = cardSteps(model({ gapFixes: true })).find((step) => step.id === 'gaps');
		expect(text(gaps.html)).toBe('Turn on your gap fixes in Word:');
		expect(gaps.subs.map(text)).toEqual([
			'Press Ctrl+D and open Advanced.',
			'Tick Kerning for fonts.',
			'If your text is smaller than the number beside it, type a smaller number (8 is the lowest).',
			'To keep it for new files, press Set As Default, choose All documents based on the Normal template, then OK.',
		]);
		const card = makeInstallCard(model({ gapFixes: true }));
		const subs = card.querySelectorAll(
			'[data-anyink-install-step="gaps"] .anyink-install-card__sub'
		);
		expect(subs).toHaveLength(4);
		expect(subs[1].querySelector('.anyink-quote').textContent).toBe('Kerning for fonts');
	});
});

describe('one way to install, the name typed in Word', () => {
	it('step 2 is the double-click way only; right-click lives in the closed part', () => {
		const steps = cardSteps(model());
		const install = text(steps.find((step) => step.id === 'install').html);
		expect(install).toBe('Double-click BrennanHand-Test3.otf, then press Install.');
		expect(install).not.toContain('right-click');
		expect(install).not.toContain('may be');
		const card = makeInstallCard(model());
		const notInList = card.querySelector('[data-anyink-install-more="notInList"]');
		expect(notInList.textContent).toContain('Show more options');
	});

	it("step 3 says to type the name in Word's font box", () => {
		const restart = cardSteps(model()).find((step) => step.id === 'restart');
		expect(text(restart.html)).toBe(
			"Close Word completely, open it again, and type Brennan Hand Test 3 in Word's font box."
		);
	});
});

describe('gap fixes the file really holds', () => {
	it('a pair with an empty letter is no gap fix', () => {
		expect(hasGapFixes(openBrennanHand({ gapFix: true, kernRight: '0x42' }).project)).toBe(false);
	});

	it('a pair with a letter not in the font is no gap fix', () => {
		const editor = openBrennanHand({ gapFix: true, kernRight: '0x5A' });
		delete editor.project.glyphs['glyph-0x5A'];
		expect(hasGapFixes(editor.project)).toBe(false);
	});

	it('a pair of two written letters is', () => {
		expect(hasGapFixes(openBrennanHand({ gapFix: true }).project)).toBe(true);
	});
});

describe('a cancelled folder pick says it once', () => {
	it('[Pick a folder...] cancelled: the error alone, no tip, no toast', async () => {
		const editor = openBrennanHand();
		setFileApi(fakeApi({ open: undefined, save: undefined, directory: abort() }));
		openUseInWord({ editor });
		action('pick').click();
		expect(await waitFor(() => !!noteOf('folder'))).toBe(true);
		expect(dialog().querySelectorAll('.anyink-use-in-word__tip')).toHaveLength(0);
		expect(dialog().querySelectorAll('[data-anyink-install-action="pick"]')).toHaveLength(1);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(toastLog().map((record) => record.key)).not.toContain('error.noFolderPicked');
		expect(liveToasts()).toEqual([]);
	});

	it('Make my font file with no folder, picker cancelled: the error alone, no toast', async () => {
		const editor = openBrennanHand();
		setFileApi(fakeApi({ open: undefined, save: undefined, directory: abort() }));
		openUseInWord({ editor });
		action('make').click();
		expect(await waitFor(() => !!noteOf('folder'))).toBe(true);
		expect(dialog().dataset.anyinkInstallPhase).toBe('before');
		expect(dialog().querySelectorAll('.anyink-use-in-word__tip')).toHaveLength(0);
		await new Promise((resolve) => setTimeout(resolve, 20));
		const keys = toastLog().map((record) => record.key);
		expect(keys).not.toContain('error.noFolderPicked');
		expect(keys).not.toContain('menu.pickFolderFirst');
		expect(liveToasts()).toEqual([]);
	});
});

describe('the card says Made, no toast says Exported', () => {
	it('the export toast goes when the card opens', async () => {
		const editor = openBrennanHand();
		const dir = folder('My Fonts');
		await pickedFolder(dir);
		openUseInWord({ editor });
		action('make').click();
		expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'card')).toBe(true);
		expect(liveToasts().filter((words) => words.includes('Exported'))).toEqual([]);
	});
});

describe('one build at a time', () => {
	it('Use in Word opened while a file is being made starts no second build', async () => {
		const editor = openBrennanHand();
		const dir = folder('My Fonts');
		await pickedFolder(dir);
		openUseInWord({ editor });
		action('make').click();
		// the dialog has stepped aside, or is about to: Ctrl+E / rail step 3 again
		const again = openUseInWord({ editor });
		expect(again).toBeNull();
		expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'card')).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect([...dir.files.keys()]).toEqual(['BrennanHand-Test1.otf']);
		// once it is done, Use in Word opens again
		action('done').click();
		expect(openUseInWord({ editor })).not.toBeNull();
	});
});
