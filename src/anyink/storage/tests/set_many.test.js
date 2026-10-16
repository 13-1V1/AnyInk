// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 (files-recovery): the backup copy written as the page goes is one transaction, committed
// inside the call, so the database keeps it even when Chrome quits before any answer comes.
import { afterEach, describe, expect, it } from 'vitest';
import { putAllAndCommit, recGet, recSetMany, setStorageDriver } from '../kv.js';
import { fakeDriver } from './fake_driver.js';

/** A store handle as openStores gives it, over one fake IDB transaction. */
function fakeIdbStore() {
	const log = [];
	const tx = {
		commit: () => log.push('commit'),
		complete() {
			this.oncomplete?.();
		},
		abort(error) {
			this.error = error;
			this.onabort?.();
		},
	};
	const store = { transaction: tx, put: (value, key) => log.push(`put ${key}`) };
	const transactions = [];
	const useStore = (txMode, callback) => {
		transactions.push(txMode);
		return Promise.resolve(callback(store));
	};
	return { log, tx, useStore, transactions };
}

describe('putAllAndCommit (the IndexedDB layer)', () => {
	it('puts every pair in one readwrite transaction, in order, and commits inside the call', async () => {
		const idb = fakeIdbStore();
		const done = putAllAndCommit(
			[
				['session:p1:s1', { dirty: true }],
				['state:p1:s1:0', 1],
			],
			idb.useStore
		);
		expect(idb.transactions).toEqual(['readwrite']);
		expect(idb.log).toEqual(['put session:p1:s1', 'put state:p1:s1:0', 'commit']);
		let settled = false;
		done.then(() => (settled = true));
		await Promise.resolve();
		expect(settled).toBe(false); // only once the database says it is complete
		idb.tx.complete();
		await done;
	});

	it('rejects when the transaction aborts', async () => {
		const idb = fakeIdbStore();
		const done = putAllAndCommit([['a', 1]], idb.useStore);
		idb.tx.abort(new Error('quota'));
		await expect(done).rejects.toThrow('quota');
	});
});

describe('recSetMany', () => {
	let restore;
	afterEach(() => restore?.());

	it('hands the driver every pair in one call, and the data is there before any await', async () => {
		const driver = fakeDriver();
		restore = setStorageDriver(driver);
		const done = recSetMany([
			['session:p1:s1', { dirty: true }],
			['state:p1:s1:0', 1],
		]);
		expect(driver.calls).toEqual(['setMany']);
		expect(driver.data.get('recovery').get('session:p1:s1')).toEqual({ dirty: true });
		await done;
		expect(await recGet('state:p1:s1:0')).toBe(1);
	});

	it('works in memory mode too', async () => {
		await recSetMany([['session:m', { dirty: true }]]);
		expect(await recGet('session:m')).toEqual({ dirty: true });
	});
});
