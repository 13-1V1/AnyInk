// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import {
	LOCK_PREFIX,
	acquireLock,
	hasWebLocks,
	heldLockNames,
	lockName,
	sessionLockName,
} from '../session_lock.js';
import { fakeLocks } from './fake_locks.js';

async function flush(times = 20) {
	for (let i = 0; i < times; i++) await Promise.resolve();
}

describe('lock names', () => {
	it('prefixes the project id', () => {
		expect(lockName('p1')).toBe(`${LOCK_PREFIX}p1`);
		expect(LOCK_PREFIX).toBe('anyink-project-');
	});

	it('names a session lock after its record key', () => {
		expect(sessionLockName('session:p1:s1')).toBe('anyink-session:p1:s1');
	});

	it('feature-detects the API', () => {
		expect(hasWebLocks(undefined)).toBe(false);
		expect(hasWebLocks({})).toBe(false);
		expect(hasWebLocks(fakeLocks())).toBe(true);
		// jsdom has no navigator.locks
		expect(hasWebLocks()).toBe(false);
	});
});

describe('acquireLock', () => {
	it('holds an exclusive lock until release()', async () => {
		const locks = fakeLocks();
		const lock = acquireLock('anyink-project-p1', locks);
		expect(lock.supported).toBe(true);
		expect(locks.requests).toEqual([{ name: 'anyink-project-p1', mode: 'exclusive' }]);
		expect(await lock.granted).toBe(true);
		expect(locks.held.has('anyink-project-p1')).toBe(true);
		lock.release();
		await flush();
		expect(locks.held.has('anyink-project-p1')).toBe(false);
	});

	it('is a no-op handle without the API', async () => {
		const lock = acquireLock('anyink-project-p1', undefined);
		expect(lock.supported).toBe(false);
		expect(await lock.granted).toBe(false);
		expect(() => lock.release()).not.toThrow();
	});

	it('reports granted:false when the browser refuses the request', async () => {
		const refusing = {
			request: () => Promise.reject(new Error('SecurityError')),
			query: async () => ({ held: [], pending: [] }),
		};
		const lock = acquireLock('anyink-project-p1', refusing);
		expect(await lock.granted).toBe(false);
	});

	it('releases at once when release() runs before the grant callback', async () => {
		let grant;
		const deferred = {
			request: (name, options, callback) =>
				new Promise((resolve) => {
					grant = () => resolve(callback());
				}),
		};
		const lock = acquireLock('anyink-project-p1', deferred);
		lock.release();
		grant();
		expect(await lock.granted).toBe(false);
	});
});

describe('acquireLock with a second holder', () => {
	it('queues behind another holder: granted waits, released follows the real release', async () => {
		const locks = fakeLocks();
		const otherTabCloses = locks.hold('anyink-session:p1:x');
		const lock = acquireLock('anyink-session:p1:x', locks);
		let granted = false;
		lock.granted.then((value) => (granted = value));
		await flush();
		expect(granted).toBe(false);
		otherTabCloses();
		await flush();
		expect(granted).toBe(true);

		let released = false;
		lock.released.then(() => (released = true));
		await flush();
		expect(released).toBe(false);
		lock.release();
		await flush();
		expect(released).toBe(true);
		expect(locks.held.size).toBe(0);
	});

	it('released resolves at once without the API', async () => {
		const lock = acquireLock('anyink-session:p1:x', undefined);
		await expect(lock.released).resolves.toBeUndefined();
	});
});

describe('heldLockNames', () => {
	it('returns the held names as a Set, or null without the API', async () => {
		const locks = fakeLocks();
		acquireLock('anyink-project-a', locks);
		acquireLock('anyink-project-b', locks);
		const held = await heldLockNames(locks);
		expect(held).toEqual(new Set(['anyink-project-a', 'anyink-project-b']));
		expect(await heldLockNames(undefined)).toBeNull();
		expect(await heldLockNames({ request() {} })).toBeNull();
	});

	it('returns null when query throws', async () => {
		const broken = {
			request() {},
			query: async () => {
				throw new Error('nope');
			},
		};
		expect(await heldLockNames(broken)).toBeNull();
	});
});
