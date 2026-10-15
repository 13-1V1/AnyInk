// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix pass (critic finding "Simple save status talks about backup copies after every edit
// and never says 'Saving...'"). UX-BEGINNER.md 4.11: Simple's status says one of four things,
// "Saved", "Saving..." (a write is queued or running), "Not saved yet" and "Couldn't save";
// backup copies are silent (they show only on the start page after a crash), and the tooltip
// says what to press (the status.* hint), never the text again. All tools keeps today's words,
// backup copy included.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { setModeForTests } from '../../mode/mode.js';
import { wordEntry, word } from '../../words/words.js';
import { markSaveQueued, saveStatusText, saveStatusWords, setSaveStatus } from '../save_status.js';
import { SaveStatusElement } from '../save_status_element.js';

beforeAll(() => {
	if (!customElements.get('anyink-save-status')) {
		customElements.define('anyink-save-status', SaveStatusElement);
	}
});
afterEach(() => {
	setModeForTests('all');
	document.body.innerHTML = '';
});

const FILES = ['none', 'pending', 'saving', 'saved', 'failed'];
const BACKUPS = ['none', 'pending', 'saved', 'failed'];
const BROWSER_SENTENCE =
	'An operation that depends on state cached in an interface object was made but the state had changed since it was read from disk.';
const state = (file, recovery = 'pending', extra = {}) => ({
	revision: 1,
	file,
	recovery,
	error: '',
	...extra,
});

describe('Simple: the four states of 4.11', () => {
	const simple = (s, context) => saveStatusWords(s, { simple: true, ...context });

	it("Saved, Saving... and Couldn't save, with no word about the backup copy", () => {
		expect(simple(state('saved', 'saved')).text).toBe('Saved');
		expect(simple(state('saving', 'saved')).text).toBe('Saving...');
		expect(simple(state('saving', 'failed')).text).toBe('Saving...');
		expect(simple(state('failed', 'saved', { error: BROWSER_SENTENCE })).text).toBe(
			"Couldn't save"
		);
	});

	it('no work file picked yet: Not saved yet, and the tooltip says Save chooses where it goes', () => {
		const words = simple(state('pending', 'saved'), { workFile: false });
		expect(words.text).toBe('Not saved yet');
		expect(words.hint).toBe(wordEntry('status.notSavedYet').hint);
		expect(simple(state('none', 'none'), { workFile: false }).text).toBe('Not saved yet');
	});

	it('a work file with a write queued says Saving..., even right after a backup copy', () => {
		expect(simple(state('pending', 'saved', { queued: true }), { workFile: true }).text).toBe(
			'Saving...'
		);
		expect(simple(state('pending', 'pending', { queued: true }), { workFile: true }).text).toBe(
			'Saving...'
		);
	});

	it('a work file with nothing queued says Not saved yet, and the tooltip says to press Save', () => {
		const words = simple(state('pending', 'saved'), { workFile: true });
		expect(words.text).toBe('Not saved yet');
		expect(words.hint).toMatch(/Press Save/);
	});

	it('every state says one of the four, with a tooltip of its own words (never the text again)', () => {
		const shown = new Set();
		FILES.forEach((file) =>
			BACKUPS.forEach((recovery) =>
				[true, false].forEach((workFile) =>
					[true, false].forEach((queued) => {
						const words = simple(state(file, recovery, { queued, error: BROWSER_SENTENCE }), {
							workFile,
						});
						shown.add(words.text);
						expect(words.hint).not.toBe('');
						expect(words.hint).not.toBe(words.text);
						expect(`${words.text} ${words.hint}`).not.toMatch(/backup|operation|cached/i);
					})
				)
			)
		);
		expect([...shown].sort()).toEqual(
			[
				word('status.saved'),
				word('status.saving'),
				word('status.notSavedYet'),
				word('status.couldntSave'),
			].sort()
		);
	});

	it('saveStatusText says the same in Simple', () => {
		setModeForTests('simple');
		expect(saveStatusText(state('pending', 'saved'))).toBe('Not saved yet');
		expect(saveStatusText(state('failed', 'saved'))).toBe("Couldn't save");
	});
});

describe("All tools: today's words", () => {
	it('keeps the backup copy and what went wrong', () => {
		setModeForTests('all');
		expect(saveStatusText(state('pending', 'saved'))).toBe(
			`${word('status.backupKept')} · ${word('status.changesNotSaved')}`
		);
		expect(saveStatusText(state('failed', 'saved', { error: 'The disk is full' }))).toBe(
			`${word('status.couldntSave')} · ${word('status.backupKept')} · The disk is full`
		);
	});
});

describe('the status in the top bar', () => {
	/** A current editor; a work file when given a handle name. */
	function editorWith(name) {
		const editor = { history: {}, loadedFileHandle: false };
		if (name) {
			editor.loadedFileHandle = {
				kind: 'file',
				name,
				getFile() {},
				createWritable() {},
				queryPermission() {},
				requestPermission() {},
			};
		}
		setCurrentProjectEditor(editor);
		return editor;
	}

	it('Simple: the tooltip is the hint, a backup failure is silent, a write failure is red', () => {
		setModeForTests('simple');
		const editor = editorWith('Brennan Hand.gs2');
		const element = document.createElement('anyink-save-status');
		document.body.appendChild(element);
		setSaveStatus(editor, { file: 'pending', recovery: 'failed' });
		expect(element.textContent).toBe('Not saved yet');
		expect(element.title).toBe(
			saveStatusWords(state('pending'), { simple: true, workFile: true }).hint
		);
		expect(element.dataset.failed).toBe('false');
		expect(element.dataset.status).toBe('not-saved');
		markSaveQueued(editor, true);
		expect(element.textContent).toBe('Saving...');
		expect(element.dataset.status).toBe('saving');
		markSaveQueued(editor, false);
		setSaveStatus(editor, { file: 'failed', error: BROWSER_SENTENCE });
		expect(element.textContent).toBe("Couldn't save");
		expect(element.dataset.failed).toBe('true');
		expect(element.title).not.toMatch(/operation/);
	});

	it('All tools: the text and its tooltip as before', () => {
		const editor = editorWith('');
		const element = document.createElement('anyink-save-status');
		document.body.appendChild(element);
		setSaveStatus(editor, { file: 'pending', recovery: 'failed' });
		expect(element.textContent).toBe(
			`${word('status.backupFailed')} · ${word('status.changesNotSaved')}`
		);
		expect(element.title).toBe(element.textContent);
		expect(element.dataset.failed).toBe('true');
	});
});
