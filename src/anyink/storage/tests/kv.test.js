// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getStorageStatus,
	isPersistent,
	kvClear,
	kvDel,
	kvGet,
	kvGetStrict,
	kvKeys,
	kvSet,
	recClear,
	recDel,
	recEntries,
	recGet,
	recKeys,
	recSet,
	setStorageDriver,
} from '../kv.js';
import { fakeDriver, makeError } from './fake_driver.js';

// jsdom has no indexedDB, so this suite exercises the in-memory fallback.
describe('kv (memory fallback)', () => {
	beforeEach(async () => {
		await kvClear();
		await recClear();
	});

	it('reports memory mode when indexedDB is missing', () => {
		expect(globalThis.indexedDB).toBeUndefined();
		expect(isPersistent()).toBe(false);
	});

	it('kv store: set, get, keys, del', async () => {
		expect(await kvGet('missing')).toBeUndefined();
		await kvSet('a', 1);
		await kvSet('b', { nested: [1, 2] });
		expect(await kvGet('a')).toBe(1);
		expect(await kvGet('b')).toEqual({ nested: [1, 2] });
		expect((await kvKeys()).sort()).toEqual(['a', 'b']);
		await kvDel('a');
		expect(await kvGet('a')).toBeUndefined();
		expect(await kvKeys()).toEqual(['b']);
	});

	it('recovery store: set, get, keys, entries, del', async () => {
		await recSet('session:1', { dirty: true });
		await recSet('snap:1', 'blob-goes-here');
		expect(await recGet('session:1')).toEqual({ dirty: true });
		expect((await recKeys()).sort()).toEqual(['session:1', 'snap:1']);
		const entries = await recEntries();
		expect(entries).toHaveLength(2);
		expect(Object.fromEntries(entries)).toEqual({
			'session:1': { dirty: true },
			'snap:1': 'blob-goes-here',
		});
		await recDel('snap:1');
		expect(await recKeys()).toEqual(['session:1']);
	});

	it('keeps the two stores separate', async () => {
		await kvSet('same', 'kv');
		await recSet('same', 'rec');
		expect(await kvGet('same')).toBe('kv');
		expect(await recGet('same')).toBe('rec');
		await kvDel('same');
		expect(await recGet('same')).toBe('rec');
	});

	it('clear empties one store only', async () => {
		await kvSet('x', 1);
		await recSet('y', 2);
		await kvClear();
		expect(await kvKeys()).toEqual([]);
		expect(await recKeys()).toEqual(['y']);
	});

	it('stores non-JSON values by reference (handles, blobs)', async () => {
		const fakeHandle = { kind: 'file', name: 'font.gs2', isSameEntry: () => true };
		await kvSet('handle:last', fakeHandle);
		expect(await kvGet('handle:last')).toBe(fakeHandle);
	});
});

// Finding: one failed IndexedDB operation used to flip the module into memory mode for
// the rest of the session. These run against a fake IndexedDB driver.
describe('kv (IndexedDB failures)', () => {
	let driver;
	let restoreDriver;
	let warn;
	beforeEach(() => {
		driver = fakeDriver();
		restoreDriver = setStorageDriver(driver);
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		restoreDriver();
		warn.mockRestore();
	});

	it('uses the IndexedDB driver when one is present', async () => {
		expect(isPersistent()).toBe(true);
		await recSet('session:a', { dirty: true });
		expect(driver.data.get('recovery').get('session:a')).toEqual({ dirty: true });
		expect(await recGet('session:a')).toEqual({ dirty: true });
	});

	it('retries a failed operation once on a fresh connection and stays in IndexedDB mode', async () => {
		await recSet('warm', 1); // opens the first connection
		expect(driver.opens).toBe(1);
		driver.failNext(1);
		await recSet('session:a', { dirty: true });
		expect(driver.opens).toBe(2);
		expect(driver.closes).toBe(1);
		expect(driver.data.get('recovery').get('session:a')).toEqual({ dirty: true });
		expect(isPersistent()).toBe(true);
		expect(getStorageStatus().retries).toBe(1);
		expect(getStorageStatus().lastError).toBeNull();
		// later writes still go to IndexedDB, never to a memory Map
		await kvSet('handle:last', { kind: 'file' });
		expect(driver.data.get('kv').get('handle:last')).toEqual({ kind: 'file' });
	});

	it('rejects recovery-store calls that fail twice, keeps lastError, and keeps IndexedDB mode', async () => {
		driver.failNext(2, makeError('QuotaExceededError', 'the quota has been exceeded'));
		await expect(recSet('session:big', { dirty: true })).rejects.toThrow(/quota/);
		expect(isPersistent()).toBe(true);
		expect(getStorageStatus().lastError).toMatchObject({
			name: 'QuotaExceededError',
			message: 'the quota has been exceeded',
			op: 'set',
			store: 'recovery',
		});
		// the next write goes back to IndexedDB and lands there
		await recSet('session:small', { dirty: true });
		expect(driver.data.get('recovery').get('session:small')).toEqual({ dirty: true });
		expect(await recGet('session:small')).toEqual({ dirty: true });
	});

	it('kv-store helpers never reject (handles and recents are best effort), but record the error', async () => {
		driver.failNext(2);
		expect(await kvSet('handle:last', { kind: 'file' })).toBe(false);
		driver.failNext(2);
		expect(await kvGet('handle:last')).toBeUndefined();
		driver.failNext(2);
		expect(await kvKeys()).toEqual([]);
		expect(getStorageStatus().lastError.store).toBe('kv');
		expect(isPersistent()).toBe(true);
		expect(await kvSet('handle:last', { kind: 'file' })).toBe(true);
		expect(await kvGet('handle:last')).toEqual({ kind: 'file' });
	});

	it('kvGetStrict rejects a failed read (for read-modify-write callers); kvGet resolves undefined', async () => {
		await kvSet('recentProjects', ['a', 'b']);
		expect(await kvGetStrict('recentProjects')).toEqual(['a', 'b']);
		expect(await kvGetStrict('missing')).toBeUndefined();
		driver.failWhen((op) => op === 'get');
		expect(await kvGet('recentProjects')).toBeUndefined();
		await expect(kvGetStrict('recentProjects')).rejects.toThrow(/quota/);
		expect(getStorageStatus().lastError).toMatchObject({ op: 'get', store: 'kv' });
	});
});
