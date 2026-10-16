// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13: Replace it keeps a backup copy of the old work file first (UX-BEGINNER.md 4.1, 7.4 #5).
	The copy is a backup like any other: it lists as unsaved work with no work file (so the start
	screen's crash card and the backups list offer it) and keeps the old file's photos.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECOVERY_CHANGE_EVENT, listRecoverableSessions } from '../../recovery/recovery.js';
import { recClear, recGet } from '../../storage/kv.js';
import { keepBackupCopy } from '../keep_backup.js';

// a 1 x 1 PNG
const PNG =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const oldFile = () => ({
	settings: { project: { id: 'proj-1', name: 'Brennan Hand', latestVersion: '2.10.5' } },
	glyphs: { 'glyph-0x41': { shapes: [{}] } },
	assets: { 'img-abcd1234': { type: 'image/png', data: PNG } },
});

beforeEach(async () => {
	await recClear();
});
afterEach(async () => {
	await recClear();
});

describe('keepBackupCopy', () => {
	it('writes a dirty backup with no work file, under a lock no tab holds', async () => {
		const key = await keepBackupCopy(oldFile(), { now: 5000 });
		const record = await recGet(key);
		expect(record).toMatchObject({
			id: 'proj-1',
			name: 'Brennan Hand',
			time: 5000,
			dirty: true,
			hasFile: false,
			fileHandle: null,
		});
		expect(record.project.glyphs['glyph-0x41'].shapes).toHaveLength(1);
		expect(record.lock).toMatch(/^anyink-replaced:/);
	});

	// Fix pass: the copy took over the start screen as a crash card for the OLD font. Written to
	// fail first: the record had no mark.
	it('is marked as a kept copy (replaced), so the start screen never offers it as a crash', async () => {
		const key = await keepBackupCopy(oldFile(), { now: 5000 });
		expect((await recGet(key)).replaced).toBe(true);
	});

	it("keeps the old file's photos as a backup keeps them (Blobs)", async () => {
		const key = await keepBackupCopy(oldFile(), { now: 5000 });
		const record = await recGet(key);
		expect(Object.keys(record.assets)).toEqual(['img-abcd1234']);
		expect(record.assets['img-abcd1234'].type).toBe('image/png');
		expect(record.assets['img-abcd1234'].blob).toBeInstanceOf(Blob);
	});

	it('lists as unsaved work with no work file, and says so to every list on screen', async () => {
		const heard = vi.fn();
		window.addEventListener(RECOVERY_CHANGE_EVENT, heard);
		const key = await keepBackupCopy(oldFile(), { now: 5000 });
		window.removeEventListener(RECOVERY_CHANGE_EVENT, heard);
		expect(heard).toHaveBeenCalledTimes(1);
		const sessions = await listRecoverableSessions();
		expect(sessions).toEqual([
			expect.objectContaining({ id: key, name: 'Brennan Hand', hasFile: false, dirty: true }),
		]);
	});

	it('two copies of one font are two rows', async () => {
		await keepBackupCopy(oldFile(), { now: 5000 });
		await keepBackupCopy(oldFile(), { now: 6000 });
		expect(await listRecoverableSessions()).toHaveLength(2);
	});

	it('a write that fails rejects (the caller then replaces nothing)', async () => {
		await expect(
			keepBackupCopy(oldFile(), { write: async () => Promise.reject(new Error('quota')) })
		).rejects.toThrow('quota');
		await expect(keepBackupCopy(null)).rejects.toThrow();
	});
});
