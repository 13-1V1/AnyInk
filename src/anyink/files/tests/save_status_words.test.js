// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 (UX-BEGINNER.md 2.4 G, 4.11): the save status says the house words in both modes: Saved,
// Saving..., Not saved yet, Couldn't save, and the backup copy kept in the browser ("Recovery copy
// saved", "Not yet protected" and "File changes pending" are gone). Every word comes from
// src/anyink/words (status.*).
import { describe, expect, it } from 'vitest';
import { findBanned } from '../../words/banned.js';
import { word } from '../../words/words.js';
import { saveStatusText } from '../save_status.js';

const text = (file, recovery, error = '') => saveStatusText({ revision: 1, file, recovery, error });
const join = (...keys) => keys.map((key) => word(key)).join(' · ');

describe('save status text', () => {
	it('says Saved when the work file holds the latest change', () => {
		expect(text('saved', 'saved')).toBe(word('status.saved'));
		expect(text('saved', 'none')).toBe('Saved');
	});

	it('says Saving... with what the backup copy is doing', () => {
		expect(text('saving', 'saved')).toBe(join('status.saving', 'status.backupKept'));
		expect(text('saving', 'pending')).toBe(join('status.saving', 'status.noBackupYet'));
		expect(text('saving', 'failed')).toBe(join('status.saving', 'status.backupFailed'));
	});

	it("says Couldn't save, and what went wrong or what to press", () => {
		expect(text('failed', 'saved')).toBe(
			join('status.couldntSave', 'status.backupKept', 'status.tryAgain')
		);
		expect(text('failed', 'saved', 'The disk is full')).toBe(
			`${join('status.couldntSave', 'status.backupKept')} · The disk is full`
		);
	});

	it('says Not saved yet when no work file was picked', () => {
		expect(text('none', 'none')).toBe(word('status.notSavedYet'));
		expect(text('none', 'saved')).toBe(join('status.backupKept', 'status.notSavedYet'));
	});

	it('says the changes are not saved yet while a work file waits for them', () => {
		expect(text('pending', 'pending')).toBe(join('status.noBackupYet', 'status.changesNotSaved'));
		expect(text('pending', 'saved')).toBe(join('status.backupKept', 'status.changesNotSaved'));
	});

	it('never says a banned word or the old wording, in any state', () => {
		const all = [];
		['none', 'pending', 'saving', 'saved', 'failed'].forEach((file) =>
			['none', 'pending', 'saved', 'failed'].forEach((recovery) => all.push(text(file, recovery)))
		);
		expect(all.flatMap((t) => findBanned(t))).toEqual([]);
		all.forEach((t) =>
			expect(t).not.toMatch(/Recovery|protected|pending|Saved to file|Not saved to a file/)
		);
	});
});
