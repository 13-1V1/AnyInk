// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kvClear, kvGet, setStorageDriver } from '../../storage/kv.js';
import { fakeDriver } from '../../storage/tests/fake_driver.js';
import {
	MAX_RECENTS,
	RECENTS_KEY,
	clearRecentProjects,
	countHandleList,
	ensurePermission,
	findInHandleList,
	forgetHandle,
	isHandleInList,
	listRecentProjects,
	pushHandleToList,
	pushRecentProject,
	recallHandle,
	rememberHandle,
	removeHandleFromList,
	removeRecentProject,
} from '../handles.js';

/** A stand-in for FileSystemFileHandle: same-entry by name, scripted permissions. */
function fakeHandle(name, { query = 'prompt', request = 'granted' } = {}) {
	const calls = { query: 0, request: 0 };
	return {
		kind: 'file',
		name,
		calls,
		isSameEntry: async (other) => other?.name === name,
		queryPermission: async () => {
			calls.query++;
			if (query instanceof Error) throw query;
			return query;
		},
		requestPermission: async () => {
			calls.request++;
			if (request instanceof Error) throw request;
			return request;
		},
	};
}

function setUserActivation(isActive) {
	Object.defineProperty(globalThis.navigator, 'userActivation', {
		value: isActive === undefined ? undefined : { isActive, hasBeenActive: isActive },
		configurable: true,
		writable: true,
	});
}

describe('handles: named handles', () => {
	beforeEach(async () => {
		await kvClear();
	});

	it('remembers, recalls and forgets a handle by key', async () => {
		const h = fakeHandle('font.gs2');
		expect(await recallHandle('lastProject')).toBeNull();
		await rememberHandle('lastProject', h);
		expect(await recallHandle('lastProject')).toBe(h);
		expect(await kvGet('handle:lastProject')).toBe(h);
		await forgetHandle('lastProject');
		expect(await recallHandle('lastProject')).toBeNull();
	});
});

describe('handles: ensurePermission', () => {
	afterEach(() => setUserActivation(undefined));

	it('returns denied for a missing or non-handle value', async () => {
		expect(await ensurePermission(null)).toBe('denied');
		expect(await ensurePermission({ name: 'x' })).toBe('denied');
	});

	it('returns granted without asking when already granted', async () => {
		const h = fakeHandle('a.gs2', { query: 'granted' });
		expect(await ensurePermission(h)).toBe('granted');
		expect(h.calls.request).toBe(0);
	});

	it('returns denied without asking when the user refused before', async () => {
		const h = fakeHandle('a.gs2', { query: 'denied' });
		expect(await ensurePermission(h)).toBe('denied');
		expect(h.calls.request).toBe(0);
	});

	it('does not ask outside a user gesture', async () => {
		setUserActivation(false);
		const h = fakeHandle('a.gs2', { query: 'prompt', request: 'granted' });
		expect(await ensurePermission(h)).toBe('prompt');
		expect(h.calls.request).toBe(0);
	});

	it('asks inside a user gesture and passes the mode through', async () => {
		setUserActivation(true);
		const h = fakeHandle('a.gs2', { query: 'prompt', request: 'granted' });
		expect(await ensurePermission(h, 'read')).toBe('granted');
		expect(h.calls.query).toBe(1);
		expect(h.calls.request).toBe(1);
	});

	it('asks when the browser cannot report activation', async () => {
		setUserActivation(undefined);
		const h = fakeHandle('a.gs2', { query: 'prompt', request: 'denied' });
		expect(await ensurePermission(h)).toBe('denied');
		expect(h.calls.request).toBe(1);
	});

	it('maps a SecurityError from requestPermission to prompt', async () => {
		setUserActivation(true);
		const err = new Error('User activation is required');
		const h = fakeHandle('a.gs2', { query: 'prompt', request: err });
		expect(await ensurePermission(h)).toBe('prompt');
	});
});

describe('handles: recent projects', () => {
	beforeEach(async () => {
		await kvClear();
	});

	it('starts empty', async () => {
		expect(await listRecentProjects()).toEqual([]);
	});

	it('pushes newest first and records name and time', async () => {
		const a = fakeHandle('a.gs2');
		const b = fakeHandle('b.gs2');
		await pushRecentProject(a, 'Font A');
		await pushRecentProject(b, 'Font B');
		const list = await listRecentProjects();
		expect(list.map((e) => e.name)).toEqual(['Font B', 'Font A']);
		expect(list[0].handle).toBe(b);
		expect(typeof list[0].time).toBe('number');
	});

	it('falls back to the handle name when no name is given', async () => {
		await pushRecentProject(fakeHandle('plain.gs2'));
		expect((await listRecentProjects())[0].name).toBe('plain.gs2');
	});

	it('moves a re-opened project to the top instead of duplicating it', async () => {
		const a = fakeHandle('a.gs2');
		await pushRecentProject(a, 'Font A');
		await pushRecentProject(fakeHandle('b.gs2'), 'Font B');
		await pushRecentProject(fakeHandle('a.gs2'), 'Font A renamed');
		const list = await listRecentProjects();
		expect(list).toHaveLength(2);
		expect(list.map((e) => e.name)).toEqual(['Font A renamed', 'Font B']);
	});

	it('caps the list at MAX_RECENTS', async () => {
		for (let i = 0; i < MAX_RECENTS + 3; i++) {
			await pushRecentProject(fakeHandle(`f${i}.gs2`), `Font ${i}`);
		}
		const list = await listRecentProjects();
		expect(list).toHaveLength(MAX_RECENTS);
		expect(list[0].name).toBe(`Font ${MAX_RECENTS + 2}`);
	});

	it('removes one entry and clears all', async () => {
		await pushRecentProject(fakeHandle('a.gs2'), 'A');
		await pushRecentProject(fakeHandle('b.gs2'), 'B');
		await removeRecentProject(fakeHandle('a.gs2'));
		expect((await listRecentProjects()).map((e) => e.name)).toEqual(['B']);
		await clearRecentProjects();
		expect(await listRecentProjects()).toEqual([]);
		expect(await kvGet(RECENTS_KEY)).toBeUndefined();
	});

	it('ignores a missing handle and a corrupt list', async () => {
		await pushRecentProject(null, 'nothing');
		expect(await listRecentProjects()).toEqual([]);
	});
});

describe('handles: handle lists with details', () => {
	beforeEach(async () => {
		await kvClear();
	});

	it('stores details beside each handle and finds them by isSameEntry', async () => {
		const x = fakeHandle('x.otf');
		expect(await pushHandleToList('exportedFiles', x, 5, { size: 4, lastModified: 10 })).toBe(true);
		expect(await findInHandleList('exportedFiles', fakeHandle('x.otf'))).toEqual({
			handle: x,
			size: 4,
			lastModified: 10,
		});
		expect(await isHandleInList('exportedFiles', fakeHandle('x.otf'))).toBe(true);
		expect(await findInHandleList('exportedFiles', fakeHandle('y.otf'))).toBeNull();
		// pushing the same file again replaces its details and moves it to the front
		await pushHandleToList('exportedFiles', fakeHandle('y.otf'), 5);
		await pushHandleToList('exportedFiles', x, 5, { size: 8, lastModified: 20 });
		expect(await countHandleList('exportedFiles')).toBe(2);
		expect((await kvGet('handle:exportedFiles'))[0]).toMatchObject({ size: 8, lastModified: 20 });
	});

	it('reads a bare handle stored by an earlier build as a record with no details', async () => {
		const old = fakeHandle('old.otf');
		await rememberHandle('exportedFiles', [old]);
		expect(await findInHandleList('exportedFiles', fakeHandle('old.otf'))).toEqual({ handle: old });
	});
});

// Verification of the kv fix: a read that fails must not be taken for an empty list, or
// the write that follows would replace the stored list with a truncated one.
describe('handles: a failed read never truncates a stored list', () => {
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

	it('pushRecentProject and removeRecentProject skip the write when the list cannot be read', async () => {
		await pushRecentProject(fakeHandle('a.gs2'), 'A');
		await pushRecentProject(fakeHandle('b.gs2'), 'B');
		driver.failWhen((op) => op === 'get');
		expect(await pushRecentProject(fakeHandle('c.gs2'), 'C')).toBe(false);
		expect(await removeRecentProject(fakeHandle('a.gs2'))).toBe(false);
		driver.failWhen(() => false);
		expect((await listRecentProjects()).map((entry) => entry.name)).toEqual(['B', 'A']);
		expect(await pushRecentProject(fakeHandle('c.gs2'), 'C')).toBe(true);
		expect((await listRecentProjects()).map((entry) => entry.name)).toEqual(['C', 'B', 'A']);
	});

	it('handle lists (the fonts ANY-INK exported) skip the write too', async () => {
		await pushHandleToList('exportedFiles', fakeHandle('x.otf'), 5);
		await pushHandleToList('exportedFiles', fakeHandle('y.otf'), 5);
		driver.failWhen((op) => op === 'get');
		expect(await pushHandleToList('exportedFiles', fakeHandle('z.otf'), 5)).toBe(false);
		expect(await removeHandleFromList('exportedFiles', fakeHandle('x.otf'))).toBe(false);
		driver.failWhen(() => false);
		expect(await countHandleList('exportedFiles')).toBe(2);
		expect(await isHandleInList('exportedFiles', fakeHandle('x.otf'))).toBe(true);
	});
});
