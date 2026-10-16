// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13 [Create my font] (UX-BEGINNER.md 4.1, 7.4 #5; section 10 B13 unit tests):
	  - a cancelled or never-resolving save box still opens the board, and writes nothing
	  - the save box is started inside the click, before the font is made, with "<name>.gs2" in
	    Documents
	  - a new file is written at once
	  - picking a recent font, or an existing work file with letters in it, asks confirmation 5;
	    Replace it keeps a backup copy first, then writes; Use a new name opens the box again;
	    closing the box writes nothing
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { abortError, fakeApi, fakeFileHandle } from '../../files/tests/fakes.js';
import { setModeForTests } from '../../mode/mode.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { REPLACE_DIALOG, askReplace, createFont } from '../create_font.js';

const flush = async (n = 8) => {
	for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const workFile = (name, letters) =>
	JSON.stringify({
		settings: { project: { name, id: `id-${name}`, latestVersion: '2.10.5' } },
		glyphs: Object.fromEntries(
			Array.from({ length: letters }, (_, i) => [
				`glyph-0x${(65 + i).toString(16)}`,
				{ shapes: [{}] },
			])
		),
	});

/** A font Create made: a stand-in editor whose project is fixed until he opens another */
const madeFont = () => ({
	project: { settings: { project: { name: 'Brennan Hand' } } },
	loadedFileHandle: false,
});

let quiet;
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});
beforeEach(() => {
	quiet = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
});
afterEach(() => {
	quiet.mockRestore();
	setModeForTests('all');
	document.body.innerHTML = '';
});

/**
 * @param {Object} options
 * @returns {Object} createFont's options with spies
 */
function setUp({ picks = [], recents = [], ask } = {}) {
	const queue = [...picks];
	const api = fakeApi({ save: () => (queue.length ? queue.shift() : new Promise(() => {})) });
	const editor = madeFont();
	const order = [];
	return {
		api,
		editor,
		order,
		options: {
			name: 'Brennan Hand',
			api,
			create: vi.fn(() => {
				order.push('create');
				return editor;
			}),
			listRecents: vi.fn(async () => recents),
			keepBackup: vi.fn(async () => order.push('backup')),
			save: vi.fn(async (target) => order.push(`save:${target.loadedFileHandle?.name}`)),
			...(ask ? { ask } : {}),
		},
	};
}

describe('the board opens whatever the save box does', () => {
	it('a cancelled box: the font is made and the board opens; nothing is written', async () => {
		const { options, api } = setUp({ picks: [abortError()] });
		const result = createFont(options);
		expect(options.create).toHaveBeenCalledTimes(1);
		expect(await result.done).toBe('cancelled');
		expect(options.save).not.toHaveBeenCalled();
		expect(api.calls.save).toHaveLength(1);
	});

	it('a box that never answers: the font is made at once and nothing waits on it', async () => {
		const { options } = setUp({ picks: [] }); // the fake box never resolves
		const result = createFont(options);
		expect(options.create).toHaveBeenCalledTimes(1);
		expect(result.editor.project.settings.project.name).toBe('Brennan Hand');
		let settled = false;
		result.done.then(() => (settled = true));
		await flush();
		expect(settled).toBe(false);
		expect(options.save).not.toHaveBeenCalled();
	});

	it('no save box in this browser: the font still opens', async () => {
		const { options } = setUp();
		const result = createFont({ ...options, api: {} });
		expect(options.create).toHaveBeenCalledTimes(1);
		expect(await result.done).toBe('noPicker');
	});

	it('the box starts inside the click, before the font is made: "<name>.gs2", in Documents', () => {
		const { options, api, order } = setUp({ picks: [abortError()] });
		const realSave = api.showSaveFilePicker;
		api.showSaveFilePicker = (pickerOptions) => {
			order.push('picker');
			return realSave(pickerOptions);
		};
		createFont(options);
		expect(order).toEqual(['picker', 'create']);
		expect(api.calls.save[0]).toMatchObject({
			suggestedName: 'Brennan Hand.gs2',
			startIn: 'documents',
		});
	});
});

describe('the picked file', () => {
	it('a new file is written at once', async () => {
		const file = fakeFileHandle('Brennan Hand.gs2');
		const { options, editor, order } = setUp({ picks: [file] });
		expect(await createFont(options).done).toBe('saved');
		expect(editor.loadedFileHandle).toBe(file);
		expect(order).toEqual(['create', 'save:Brennan Hand.gs2']);
		expect(options.keepBackup).not.toHaveBeenCalled();
	});

	it('a work file with no letters that is not a recent font is written at once', async () => {
		const file = fakeFileHandle('Empty.gs2', { text: workFile('Empty', 0) });
		const { options } = setUp({ picks: [file] });
		expect(await createFont(options).done).toBe('saved');
	});

	it('he opened another font meanwhile: nothing is written', async () => {
		let pick;
		const { options, editor } = setUp({ picks: [new Promise((resolve) => (pick = resolve))] });
		const result = createFont(options);
		editor.project = { settings: { project: { name: 'Other' } } };
		pick(fakeFileHandle('Brennan Hand.gs2'));
		expect(await result.done).toBe('movedOn');
		expect(options.save).not.toHaveBeenCalled();
	});
});

describe('confirmation 5: the replace check', () => {
	it('a recent font asks first; Replace it keeps a backup copy, then writes', async () => {
		const file = fakeFileHandle('Brennan Hand.gs2', {
			id: 'disk/bh',
			text: workFile('Brennan Hand', 12),
		});
		const recents = [
			{ handle: fakeFileHandle('Brennan Hand.gs2', { id: 'disk/bh' }), name: 'Brennan Hand' },
		];
		const ask = vi.fn(async () => ({ choice: 'replace' }));
		const { options, order } = setUp({ picks: [file], recents, ask });
		expect(await createFont(options).done).toBe('replaced');
		expect(ask).toHaveBeenCalledTimes(1);
		expect(ask.mock.calls[0][0]).toMatchObject({ name: 'Brennan Hand', letters: 12 });
		expect(options.keepBackup).toHaveBeenCalledTimes(1);
		expect(options.keepBackup.mock.calls[0][0].settings.project.name).toBe('Brennan Hand');
		expect(order).toEqual(['create', 'backup', 'save:Brennan Hand.gs2']);
	});

	it('a recent font with no letters still asks', async () => {
		const file = fakeFileHandle('Test.gs2', { id: 'disk/t', text: workFile('Test', 0) });
		const recents = [{ handle: fakeFileHandle('Test.gs2', { id: 'disk/t' }), name: 'Test' }];
		const ask = vi.fn(async () => ({ choice: 'closed' }));
		const { options } = setUp({ picks: [file], recents, ask });
		expect(await createFont(options).done).toBe('cancelled');
		expect(ask.mock.calls[0][0]).toMatchObject({ name: 'Test', letters: 0 });
		expect(options.save).not.toHaveBeenCalled();
	});

	it('an existing work file with letters (not recent) asks too', async () => {
		const file = fakeFileHandle('Old Hand.gs2', { text: workFile('Old Hand', 3) });
		const ask = vi.fn(async () => ({ choice: 'replace' }));
		const { options } = setUp({ picks: [file], ask });
		expect(await createFont(options).done).toBe('replaced');
		expect(ask.mock.calls[0][0]).toMatchObject({ name: 'Old Hand', letters: 3 });
		expect(options.keepBackup).toHaveBeenCalledTimes(1);
	});

	it('Use a new name opens the box again (in its own click); the new file is written', async () => {
		const old = fakeFileHandle('Old Hand.gs2', { text: workFile('Old Hand', 3) });
		const fresh = fakeFileHandle('Brennan Hand 2.gs2');
		const { options, api, order } = setUp({ picks: [old, fresh] });
		options.ask = vi.fn(async (replace, { onNewName }) => ({
			choice: 'newName',
			picker: onNewName(),
		}));
		expect(await createFont(options).done).toBe('saved');
		expect(api.calls.save).toHaveLength(2);
		expect(options.keepBackup).not.toHaveBeenCalled();
		expect(order).toEqual(['create', 'save:Brennan Hand 2.gs2']);
	});

	it('closing the box writes nothing and keeps nothing', async () => {
		const file = fakeFileHandle('Old Hand.gs2', { text: workFile('Old Hand', 3) });
		const { options } = setUp({ picks: [file], ask: vi.fn(async () => ({ choice: 'closed' })) });
		expect(await createFont(options).done).toBe('cancelled');
		expect(options.save).not.toHaveBeenCalled();
		expect(options.keepBackup).not.toHaveBeenCalled();
	});

	it('no backup copy could be kept: nothing is replaced', async () => {
		const file = fakeFileHandle('Old Hand.gs2', { text: workFile('Old Hand', 3) });
		const { options } = setUp({ picks: [file], ask: vi.fn(async () => ({ choice: 'replace' })) });
		options.keepBackup = vi.fn(async () => Promise.reject(new Error('quota')));
		expect(await createFont(options).done).toBe('notReplaced');
		expect(options.save).not.toHaveBeenCalled();
	});
});

// Fix pass (finding: replacing a file that can't be read wrote over it with no backup copy, and a
// non-empty file that isn't a work file was written over with no question). Written to fail first:
// both were written at once.
describe('a file ANY-INK cannot read is never written over', () => {
	it('a recent font whose file is not a work file any more: the cannot-replace box, nothing written', async () => {
		const file = fakeFileHandle('Brennan Hand.gs2', { id: 'disk/bh', text: 'not a work file' });
		const recents = [
			{ handle: fakeFileHandle('Brennan Hand.gs2', { id: 'disk/bh' }), name: 'Brennan Hand' },
		];
		const ask = vi.fn(async () => ({ choice: 'replace' }));
		const { options } = setUp({ picks: [file], recents, ask });
		expect(await createFont(options).done).toBe('notReplaced');
		expect(ask.mock.calls[0][0]).toMatchObject({ name: 'Brennan Hand', unreadable: true });
		expect(options.keepBackup).not.toHaveBeenCalled();
		expect(options.save).not.toHaveBeenCalled();
	});

	it('any other non-empty file (not a work file) asks too, and is never written over', async () => {
		const file = fakeFileHandle('notes.txt', { text: 'my shopping list' });
		const ask = vi.fn(async () => ({ choice: 'closed' }));
		const { options } = setUp({ picks: [file], ask });
		expect(await createFont(options).done).toBe('notReplaced');
		expect(ask).toHaveBeenCalledTimes(1);
		expect(ask.mock.calls[0][0]).toMatchObject({ name: 'notes', unreadable: true });
		expect(options.save).not.toHaveBeenCalled();
	});

	it('JSON that is not a work file: the same', async () => {
		const file = fakeFileHandle('data.gs2', { text: '{"hello": 1}' });
		const ask = vi.fn(async () => ({ choice: 'closed' }));
		const { options } = setUp({ picks: [file], ask });
		expect(await createFont(options).done).toBe('notReplaced');
		expect(ask.mock.calls[0][0]).toMatchObject({ unreadable: true });
		expect(options.save).not.toHaveBeenCalled();
	});

	// Finalize (still open: "a non-font JSON file with a settings key was written over"). Written
	// to fail first: any JSON with a settings object counted as a work file with no letters.
	it('JSON with a settings key that is not a font: the same, nothing written', async () => {
		const file = fakeFileHandle('config.json', {
			text: JSON.stringify({ settings: { theme: 'dark', volume: 3 } }),
		});
		const ask = vi.fn(async () => ({ choice: 'closed' }));
		const { options } = setUp({ picks: [file], ask });
		expect(await createFont(options).done).toBe('notReplaced');
		expect(ask.mock.calls[0][0]).toMatchObject({ name: 'config', unreadable: true });
		expect(options.keepBackup).not.toHaveBeenCalled();
		expect(options.save).not.toHaveBeenCalled();
	});

	it('a work file with no letters yet (not a recent font) is still written at once', async () => {
		const file = fakeFileHandle('Blank.gs2', { text: workFile('Blank', 0) });
		const ask = vi.fn(async () => ({ choice: 'closed' }));
		const { options } = setUp({ picks: [file], ask });
		expect(await createFont(options).done).toBe('saved');
		expect(ask).not.toHaveBeenCalled();
	});

	it('Use a new name from there: the box opens again and the new file is written', async () => {
		const odd = fakeFileHandle('notes.txt', { text: 'my shopping list' });
		const fresh = fakeFileHandle('Brennan Hand 2.gs2');
		const { options, order } = setUp({ picks: [odd, fresh] });
		options.ask = vi.fn(async (replace, { onNewName }) => ({
			choice: 'newName',
			picker: onNewName(),
		}));
		expect(await createFont(options).done).toBe('saved');
		expect(order).toEqual(['create', 'save:Brennan Hand 2.gs2']);
	});

	it('an empty recent file has nothing to keep: Replace it writes', async () => {
		const file = fakeFileHandle('Test.gs2', { id: 'disk/t', text: '' });
		const recents = [{ handle: fakeFileHandle('Test.gs2', { id: 'disk/t' }), name: 'Test' }];
		const { options } = setUp({
			picks: [file],
			recents,
			ask: vi.fn(async () => ({ choice: 'replace' })),
		});
		expect(await createFont(options).done).toBe('replaced');
		expect(options.save).toHaveBeenCalledTimes(1);
	});
});

describe('askReplace: the box', () => {
	const box = () => document.querySelector(`[data-anyink-dialog="${REPLACE_DIALOG}"]`);
	const choice = (name) => box()?.querySelector(`[data-anyink-choice="${name}"]`);

	it('says which font and how many letters; Use a new name is the one green button', async () => {
		const answer = askReplace({ name: 'Brennan Hand', letters: 12 });
		expect(box().textContent).toContain(
			word('startScreen.replace.question', { name: 'Brennan Hand', count: 12 })
		);
		expect(box().textContent).toContain('That replaces your font "Brennan Hand" (12 letters).');
		expect(choice('new-name').className).toBe('anyink-primary');
		expect(choice('replace').className).toBe('anyink-outlined');
		choice('replace').click();
		expect(await answer).toEqual({ choice: 'replace' });
	});

	it('Use a new name starts the box inside its click', async () => {
		const picker = Promise.resolve(null);
		const onNewName = vi.fn(() => picker);
		const answer = askReplace({ name: 'A', letters: 1 }, { onNewName });
		choice('new-name').click();
		expect(onNewName).toHaveBeenCalledTimes(1);
		expect(await answer).toEqual({ choice: 'newName', picker });
	});

	it('1 letter, singular', () => {
		askReplace({ name: 'A', letters: 1 });
		expect(box().textContent).toContain('(1 letter)');
	});

	it('a file it cannot read: says it stays as it is; Use a new name is the only button', async () => {
		const answer = askReplace({ name: 'notes', letters: 0, unreadable: true });
		expect(box().textContent).toContain(word('startScreen.replace.cannotRead', { name: 'notes' }));
		expect(choice('replace')).toBeNull();
		expect(choice('new-name').className).toBe('anyink-primary');
		choice('new-name').click();
		expect(await answer).toMatchObject({ choice: 'newName' });
	});
});

// Finalize (new problem: the replace box was not registered with the banned-word scan).
describe('the replace box says no banned word', () => {
	const box = () => document.querySelector(`[data-anyink-dialog="${REPLACE_DIALOG}"]`);
	scanSimpleScreen('the replace box, the question', () => {
		askReplace({ name: 'Brennan Hand', letters: 12 });
		return box();
	});
	scanSimpleScreen('the replace box, cannotRead', () => {
		askReplace({ name: 'notes', letters: 0, unreadable: true });
		return box();
	});
});
