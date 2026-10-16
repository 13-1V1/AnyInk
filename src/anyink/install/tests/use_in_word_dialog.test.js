// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 (UX-BEGINNER.md 4.7, section 10 B14): the Use in Word dialog. The empty-letter count; a
// broken letter blocks the build and names the letter (no picker, no file); Make my font file
// writes "<NameNoSpaces>-Test<n>.otf" with family "<name> Test <n>", letters with no shapes left
// out and a space added, the work file unchanged; "Test4" already in the folder makes the next
// one 5; the install card follows, step 4 only with gap fixes; a folder Chrome won't let it write
// says so with [Try again] [Pick a different folder]; Simple and the flag only; the door opens it.
import { FontFlux } from 'font-flux-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCoachActionsForTests, runCoachAction } from '../../coach/actions.js';
import { forgetExportFolder, pickFontFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { clearDialogs, fakeApi, fakeDirectoryHandle } from '../../files/tests/fakes.js';
import { openUseInWord as openDoor } from '../../mode/doors.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import {
	DIALOG_RETRY_MS,
	holdInstallEvent,
	resetInstallOfferForTests,
	setInstallOfferDepsForTests,
} from '../../start/install_offer.js';
import { kvClear } from '../../storage/kv.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import {
	blockedText,
	blockingProblem,
	closeUseInWord,
	emptyLetters,
	installUseInWord,
	isUseInWordOpen,
	needsLookLetters,
	openUseInWord,
} from '../use_in_word_dialog.js';
import { openBrennanHand } from './install_fixture.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const dialog = () => document.querySelector('dialog[data-anyink-dialog="useInWord"]');
const action = (name) => dialog()?.querySelector(`[data-anyink-install-action="${name}"]`);
const noteText = (name) =>
	dialog()?.querySelector(`[data-anyink-install-note="${name}"] .anyink-use-in-word__words`)
		?.textContent || '';
const byUnicode = (font, code) => font.glyphs.find((glyph) => glyph.unicode === code);

async function waitFor(check, ms = 8000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return false;
}

/** A folder already picked and remembered, as after [Pick a folder...] */
async function pickedFolder(dir) {
	const api = fakeApi({ open: undefined, save: undefined, directory: dir });
	setFileApi(api);
	expect((await pickFontFolder()).status).toBe('picked');
	return api;
}

async function fontIn(dir, fileName) {
	const blob = dir.files.get(fileName)?.written;
	expect(blob).toBeInstanceOf(Blob);
	const buffer = await new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(blob);
	});
	return FontFlux.open(buffer);
}

/** A fake folder that lists its files, as a real FileSystemDirectoryHandle does */
function folder(name, options) {
	const dir = fakeDirectoryHandle(name, options);
	dir.keys = async function* keys() {
		yield* dir.files.keys();
	};
	return dir;
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
	resetCoachActionsForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('what the dialog says before the file is made', () => {
	it('counts the letters that are not made yet', () => {
		const editor = openBrennanHand();
		// the Quick font is 58 letters; A and a have ink, B was only opened
		expect(emptyLetters(editor.project)).toHaveLength(56);
		expect(emptyLetters(editor.project)).toContain('B');
		expect(emptyLetters(editor.project)).not.toContain('A');
		openUseInWord({ editor });
		expect(noteText('empty')).toBe(
			"56 letters aren't made yet. In Word they won't be in your handwriting."
		);
		expect(word('install.note.empty', { count: 1 })).toBe(
			"1 letter isn't made yet. In Word it won't be in your handwriting."
		);
	});

	it('names the letters that need a look, only with the checks on', () => {
		const editor = openBrennanHand();
		const needsLook = (item) => (item.id === 'glyph-0x61' ? { check: 'any' } : null);
		expect(needsLookLetters(editor, { isOn: () => false, needsLook })).toEqual([]);
		const looks = needsLookLetters(editor, { isOn: () => true, needsLook });
		expect(looks.map((item) => item.id)).toEqual(['glyph-0x61']);
	});

	it('shows the folder line: none yet with the tip, then the folder with [Change]', async () => {
		const editor = openBrennanHand();
		openUseInWord({ editor });
		const line = () => dialog().querySelector('.anyink-use-in-word__folder');
		expect(line().dataset.anyinkInstallFolder).toBe('none');
		expect(action('pick').textContent).toBe('Pick a folder...');
		expect(dialog().querySelector('.anyink-use-in-word__tip').textContent).toBe(
			"Make a new folder inside Documents, for example My Fonts (Chrome won't let you pick Documents itself), then choose Allow."
		);
		const dir = folder('My Fonts');
		setFileApi(fakeApi({ open: undefined, save: undefined, directory: dir }));
		action('pick').click();
		expect(await waitFor(() => line()?.dataset.anyinkInstallFolder === 'picked')).toBe(true);
		expect(line().querySelector('.anyink-quote').textContent).toBe('My Fonts');
		expect(action('change').textContent).toBe('Change');
		expect(dialog().querySelector('.anyink-use-in-word__tip')).toBeNull();
	});
});

describe('a broken letter blocks the build', () => {
	it('names the letter, makes no file and opens no picker', async () => {
		const editor = openBrennanHand({ strayInA: true });
		const problem = blockingProblem(editor.project);
		expect(problem.itemId).toBe('glyph-0x61');
		expect(blockedText(editor.project, problem)).toBe(
			"small a has a problem the font file can't hold."
		);
		const dir = folder('My Fonts');
		const api = fakeApi({ open: undefined, save: undefined, directory: dir });
		setFileApi(api);

		openUseInWord({ editor });
		action('make').click();
		expect(noteText('blocked')).toBe("small a has a problem the font file can't hold.");
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(api.calls.directory).toHaveLength(0);
		expect(dir.files.size).toBe(0);
		expect(dialog().dataset.anyinkInstallPhase).toBe('before');

		// Fix it takes the stray line away (B1's fix, one Undo step) and the line goes
		expect(action('fixIt').textContent).toBe('Fix it');
		action('fixIt').click();
		expect(blockingProblem(editor.project)).toBeNull();
		expect(dialog().querySelector('[data-anyink-install-note="blocked"]')).toBeNull();
	});
});

describe('Make my font file', () => {
	it('writes the test build with B1 options, then shows the card', async () => {
		const editor = openBrennanHand();
		const dir = folder('My Fonts');
		await pickedFolder(dir);
		const glyphsBefore = Object.keys(editor.project.glyphs).sort();
		const historyBefore = editor.history.queue.length;

		openUseInWord({ editor });
		action('make').click();
		expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'card')).toBe(true);
		expect(dir.files.has('BrennanHand-Test1.otf')).toBe(true);

		const font = await fontIn(dir, 'BrennanHand-Test1.otf');
		expect(font.info.familyName).toBe('Brennan Hand Test 1');
		expect(byUnicode(font, 0x41)).toBeDefined();
		expect(byUnicode(font, 0x61)).toBeDefined();
		// letters with no shapes are left out; a space a quarter of the letter box is added
		expect(byUnicode(font, 0x42)).toBeUndefined();
		expect(byUnicode(font, 0x43)).toBeUndefined();
		expect(byUnicode(font, 0x20).advanceWidth).toBe(512);
		// the work file is not changed: no letter added, no Undo step
		expect(Object.keys(editor.project.glyphs).sort()).toEqual(glyphsBefore);
		expect(editor.history.queue.length).toBe(historyBefore);

		expect(dialog().querySelector('.anyink-install-card__made').textContent).toBe(
			'Made BrennanHand-Test1.otf.'
		);
		expect(dialog().querySelector('[data-anyink-install-step="gaps"]')).toBeNull();
		expect(dialog().querySelector('.anyink-install-card__earlier')).toBeNull();

		// the next one is Test 2, and step 2 names Test 1 to uninstall
		action('done').click();
		expect(isUseInWordOpen()).toBe(false);
		openUseInWord({ editor });
		action('make').click();
		expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'card')).toBe(true);
		expect(dir.files.has('BrennanHand-Test2.otf')).toBe(true);
		expect(dialog().querySelector('.anyink-install-card__earlier').textContent).toContain(
			'If you installed Brennan Hand Test 1 earlier'
		);
	});

	// B14 + B15 integration (real Chrome, tests/b1415.verify.mjs D): the dialog steps aside while
	// the file is built, and the install offer (B13) came in that gap, over the card that followed.
	// Written to fail first: noteFontFile ran inside the build, while no dialog was open.
	it('the install offer after the first font file waits until the card is closed', async () => {
		const editor = openBrennanHand();
		const dir = folder('My Fonts');
		await pickedFolder(dir);
		const show = vi.fn();
		resetInstallOfferForTests(); // earlier tests here made font files
		localStorage.clear();
		setInstallOfferDepsForTests({ readyLetters: () => 0, show, isInstalled: () => false });
		holdInstallEvent({ prompt: async () => {}, userChoice: Promise.resolve({}) });
		try {
			expect(show).not.toHaveBeenCalled();
			openUseInWord({ editor });
			action('make').click();
			expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'card')).toBe(true);
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(show).not.toHaveBeenCalled();
			action('done').click();
			expect(await waitFor(() => show.mock.calls.length > 0, DIALOG_RETRY_MS * 3)).toBe(true);
			expect(show.mock.calls[0][0]).toBe('notice.install');
		} finally {
			resetInstallOfferForTests();
		}
	});

	it('"Test4" already in the folder makes the next one 5', async () => {
		const editor = openBrennanHand();
		const dir = folder('My Fonts');
		dir.addFile('BrennanHand-Test4.otf');
		await pickedFolder(dir);
		openUseInWord({ editor });
		action('make').click();
		expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'card')).toBe(true);
		expect(dir.files.has('BrennanHand-Test5.otf')).toBe(true);
		expect(dialog().querySelector('.anyink-install-card__name').textContent).toBe(
			"In Word it's called Brennan Hand Test 5."
		);
	});

	it('step 4 shows only when the font has gap fixes', async () => {
		const editor = openBrennanHand({ gapFix: true });
		const dir = folder('My Fonts');
		await pickedFolder(dir);
		openUseInWord({ editor });
		action('make').click();
		expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'card')).toBe(true);
		const gaps = dialog().querySelector('[data-anyink-install-step="gaps"]');
		expect(gaps.classList.contains('is-highlight')).toBe(true);
	});

	it('Make the final font names it plainly', async () => {
		const editor = openBrennanHand();
		const dir = folder('My Fonts');
		await pickedFolder(dir);
		openUseInWord({ editor });
		action('make').click();
		expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'card')).toBe(true);
		action('makeFinal').click();
		expect(await waitFor(() => dialog()?.querySelector('[data-anyink-install-card="final"]'))).toBe(
			true
		);
		const font = await fontIn(dir, 'BrennanHand-Regular.otf');
		expect(font.info.familyName).toBe('Brennan Hand');
	});

	it("a folder Chrome won't let it write says so, with Try again and Pick a different folder", async () => {
		const editor = openBrennanHand();
		const dir = folder('My Fonts', { query: 'prompt', request: 'prompt' });
		await pickedFolder(dir);
		openUseInWord({ editor });
		action('make').click();
		expect(await waitFor(() => dialog()?.dataset.anyinkInstallPhase === 'notWritable')).toBe(true);
		expect(noteText('notWritable')).toBe("Couldn't write to My Fonts. Chrome may need your OK.");
		expect(action('tryAgain').textContent).toBe('Try again');
		expect(action('pickDifferentFolder').textContent).toBe('Pick a different folder');
		expect(dir.files.size).toBe(0);
	});
});

describe('who opens it', () => {
	it('only in Simple, only with the flag on, only with a font', () => {
		const editor = openBrennanHand();
		setModeForTests('all');
		expect(openUseInWord({ editor })).toBeNull();
		setModeForTests('simple');
		setFeaturesForTests({ useInWord: false });
		expect(openUseInWord({ editor })).toBeNull();
		setFeaturesForTests({ useInWord: true });
		expect(openUseInWord({ editor: null })).toBeNull();
		expect(openUseInWord({ editor })).not.toBeNull();
		expect(dialog().querySelector('.anyink-modal__title').textContent).toBe(
			'Use your font in Word'
		);
	});

	it("answers Ctrl+E's door and the Next line's [Use in Word]", () => {
		const editor = openBrennanHand();
		const uninstall = installUseInWord({ getEditor: () => editor });
		openDoor('key');
		expect(isUseInWordOpen()).toBe(true);
		closeUseInWord();
		expect(runCoachAction('useInWord', {}, { editor })).toBe(true);
		expect(isUseInWordOpen()).toBe(true);
		closeUseInWord();
		uninstall();
		openDoor('key');
		expect(isUseInWordOpen()).toBe(false);
	});
});
