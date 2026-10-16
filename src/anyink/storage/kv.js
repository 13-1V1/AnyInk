// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK key/value storage (Milestone 6 shared ground, D-012).
	Thin wrappers over idb-keyval. One IndexedDB database, 'anyink', with two
	object stores:
	  - 'kv'        file handles, app-level prefs that must survive a reload
	  - 'recovery'  crash-recovery snapshots
	idb-keyval's own createStore() can only create ONE object store per database
	(the second call never fires onupgradeneeded), so openStores() below is an
	idb-keyval-compatible opener that creates both stores in one upgrade. The
	returned functions plug straight into idb-keyval's get/set/del/keys/entries.

	Failures:
	  - Memory mode (an in-memory Map per store, isPersistent() false) only when
	    globalThis.indexedDB is missing at import (vitest jsdom, a blocked
	    profile). Memory mode stores references, not structured clones.
	  - A failed IndexedDB operation closes the connection and retries once on a
	    fresh one. If the retry fails too, the error is kept as lastError
	    (getStorageStatus) and the module STAYS in IndexedDB mode: the next call
	    tries IndexedDB again. Nothing ever switches to memory at runtime, so
	    nothing is silently kept only in memory.
	  - rec* (recovery store) calls reject with that error, so crash recovery can
	    tell the user a snapshot was not saved.
	  - kv* (handles, recents, prefs) calls never reject: reads resolve undefined
	    (keys: []), writes resolve false. Their callers treat them as best effort.
	  - kvGetStrict is the one exception: a read-modify-write caller (the recents
	    list, the list of exported files) must tell "nothing stored" from "the read
	    failed", or it would write a truncated list over the real one. It rejects.

	B16 (files-recovery): recSetMany(pairs) puts every pair in ONE readwrite transaction and
	commits it at once (IDBTransaction.commit), so the backup copy written as the page goes
	(recovery.js: beforeunload, hidden, pagehide) needs no answer from the database before it is
	safe. Once the database is open, a store call starts its transaction inside the caller's own
	turn (no promise step first).

	Test seam: setStorageDriver(driver) swaps the IndexedDB layer for a fake
	(tests/fake_driver.js) and returns a function that restores the default.

	Nothing here throws at import time. Keys are strings.
*/

import { clear, del, entries, get, keys, set } from 'idb-keyval';

const DB_NAME = 'anyink';
const STORE_NAMES = ['kv', 'recovery'];

const importMode =
	typeof globalThis.indexedDB === 'object' && globalThis.indexedDB !== null ? 'idb' : 'memory';
let mode = importMode;
const memory = Object.fromEntries(STORE_NAMES.map((name) => [name, new Map()]));

/**
 * Opens (lazily) one database holding every store in storeNames.
 * @param {String} dbName
 * @param {String[]} storeNames
 * @returns {{use: Object, close: Function}} use: { [storeName]: (txMode, callback) => Promise }
 */
function openStores(dbName, storeNames) {
	let dbp;
	let openDb; // the database once open: a call then starts its transaction right away
	const getDB = () => {
		if (dbp) return dbp;
		const request = globalThis.indexedDB.open(dbName, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			for (const name of storeNames) {
				if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
			}
		};
		const pending = new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
			request.onblocked = () => reject(new Error('anyink IndexedDB open blocked'));
		});
		dbp = pending;
		dbp.then(
			(db) => {
				if (dbp === pending) openDb = db;
				db.onclose = () => {
					dbp = undefined;
					openDb = undefined;
				};
				db.onversionchange = () => {
					db.close();
					dbp = undefined;
					openDb = undefined;
				};
			},
			() => (dbp = undefined)
		);
		return dbp;
	};
	const useStore = (name) => (txMode, callback) => {
		if (openDb) {
			try {
				return Promise.resolve(callback(openDb.transaction(name, txMode).objectStore(name)));
			} catch (error) {
				return Promise.reject(error);
			}
		}
		return getDB().then((db) => callback(db.transaction(name, txMode).objectStore(name)));
	};
	return {
		use: Object.fromEntries(storeNames.map((name) => [name, useStore(name)])),
		close() {
			const pending = dbp;
			dbp = undefined;
			openDb = undefined;
			if (pending) pending.then((db) => db.close()).catch(() => undefined);
		},
	};
}

/**
 * Puts every [key, value] in one readwrite transaction and commits it at once.
 * @param {Array<[String, *]>} pairs
 * @param {Function} useStore - (txMode, callback) => Promise, as openStores gives
 * @returns {Promise<void>} resolves when the transaction is complete
 */
export function putAllAndCommit(pairs, useStore) {
	return useStore('readwrite', (store) => {
		const tx = store.transaction;
		const done = new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onabort = tx.onerror = () => reject(tx.error || new Error('IndexedDB write aborted'));
		});
		for (const [key, value] of pairs) store.put(value, key);
		// no wait for the puts' answers: the database commits even if the page is gone by then
		if (typeof tx.commit === 'function') tx.commit();
		return done;
	});
}

const defaultDriver = {
	open: openStores,
	get,
	set,
	setMany: putAllAndCommit,
	del,
	keys,
	entries,
	clear,
};
let driver = defaultDriver;
let connection = null;
let lastError = null;
let retries = 0;

function connect() {
	if (!connection) connection = driver.open(DB_NAME, STORE_NAMES);
	return connection;
}

/** Drops the current connection so the next call opens a fresh one. */
function resetConnection() {
	const old = connection;
	connection = null;
	try {
		old?.close?.();
	} catch {
		// already closed or broken: the fresh connection is what matters
	}
}

/**
 * Test seam: replaces the IndexedDB layer (and switches to IndexedDB mode).
 * @param {Object} fake - { open(dbName, storeNames) -> {use, close}, get, set, del, keys, entries, clear }
 * @returns {Function} restores the default driver and the import-time mode
 */
export function setStorageDriver(fake) {
	resetConnection();
	driver = fake;
	mode = 'idb';
	lastError = null;
	retries = 0;
	return () => {
		resetConnection();
		driver = defaultDriver;
		mode = importMode;
		lastError = null;
		retries = 0;
	};
}

/**
 * Runs an idb-keyval operation against a store (one retry on a fresh connection),
 * or the memory equivalent when IndexedDB was missing at import.
 * @param {String} name - store name
 * @param {String} op - operation name, for lastError
 * @param {Function} idbOp - (driver, useStore) => Promise
 * @param {Function} memOp - (Map) => value
 * @returns {Promise<*>} rejects when the retry failed too
 */
async function run(name, op, idbOp, memOp) {
	if (mode !== 'idb') return memOp(memory[name]);
	try {
		return await idbOp(driver, connect().use[name]);
	} catch {
		resetConnection();
		retries++;
	}
	try {
		return await idbOp(driver, connect().use[name]);
	} catch (error) {
		lastError = {
			name: error?.name || 'Error',
			message: error?.message || String(error),
			op,
			store: name,
			time: Date.now(),
		};
		throw error;
	}
}

const ops = {
	get: (name, key) =>
		run(
			name,
			'get',
			(d, s) => d.get(key, s),
			(m) => m.get(key)
		),
	set: (name, key, value) =>
		run(
			name,
			'set',
			(d, s) => d.set(key, value, s),
			(m) => {
				m.set(key, value);
			}
		),
	setMany: (name, pairs) =>
		run(
			name,
			'setMany',
			(d, s) => d.setMany(pairs, s),
			(m) => {
				pairs.forEach(([key, value]) => m.set(key, value));
			}
		),
	del: (name, key) =>
		run(
			name,
			'del',
			(d, s) => d.del(key, s),
			(m) => {
				m.delete(key);
			}
		),
	keys: (name) =>
		run(
			name,
			'keys',
			(d, s) => d.keys(s),
			(m) => [...m.keys()]
		),
	entries: (name) =>
		run(
			name,
			'entries',
			(d, s) => d.entries(s),
			(m) => [...m.entries()]
		),
	clear: (name) =>
		run(
			name,
			'clear',
			(d, s) => d.clear(s),
			(m) => {
				m.clear();
			}
		),
};

/** @returns {Boolean} true while values are going to IndexedDB, false in memory mode */
export function isPersistent() {
	return mode === 'idb';
}

/**
 * @returns {{persistent: Boolean, retries: Number, lastError: Object | null}}
 *   lastError: { name, message, op, store, time } of the last call that failed after
 *   its retry, or null
 */
export function getStorageStatus() {
	return { persistent: isPersistent(), retries, lastError: lastError ? { ...lastError } : null };
}

/**
 * Best-effort wrapper for the 'kv' store: never rejects.
 * @param {Promise} promise
 * @param {*} fallback - resolved when the operation failed
 */
async function bestEffort(promise, fallback) {
	try {
		return await promise;
	} catch (error) {
		console.warn('ANY-INK storage: IndexedDB call failed (kept going).', error);
		return fallback;
	}
}

// 'kv' store: handles and prefs (best effort, never rejects) ------------------
/** @param {String} key @returns {Promise<*>} stored value, or undefined (also on failure) */
export const kvGet = (key) => bestEffort(ops.get('kv', key), undefined);
/**
 * For read-modify-write callers: a failed read rejects instead of resolving undefined.
 * @param {String} key @returns {Promise<*>} stored value, or undefined when nothing is stored
 */
export const kvGetStrict = (key) => ops.get('kv', key);
/**
 * @param {String} key @param {*} value - structured-cloneable (handles, blobs, plain data)
 * @returns {Promise<Boolean>} true when stored
 */
export const kvSet = (key, value) =>
	bestEffort(
		ops.set('kv', key, value).then(() => true),
		false
	);
/** @param {String} key @returns {Promise<Boolean>} true when deleted */
export const kvDel = (key) =>
	bestEffort(
		ops.del('kv', key).then(() => true),
		false
	);
/** @returns {Promise<String[]>} every key in the store ([] on failure) */
export const kvKeys = () => bestEffort(ops.keys('kv'), []);
/** Removes every key in the 'kv' store. @returns {Promise<Boolean>} */
export const kvClear = () =>
	bestEffort(
		ops.clear('kv').then(() => true),
		false
	);

// 'recovery' store: crash-recovery snapshots (rejects on failure) --------------
/** @param {String} key @returns {Promise<*>} stored value or undefined */
export const recGet = (key) => ops.get('recovery', key);
/** @param {String} key @param {*} value - structured-cloneable */
export const recSet = (key, value) => ops.set('recovery', key, value);
/**
 * Every pair in one transaction, committed at once (all or none).
 * @param {Array<[String, *]>} pairs - [key, structured-cloneable value]
 */
export const recSetMany = (pairs) => ops.setMany('recovery', pairs);
/** @param {String} key */
export const recDel = (key) => ops.del('recovery', key);
/** @returns {Promise<String[]>} every key in the store */
export const recKeys = () => ops.keys('recovery');
/** @returns {Promise<Array<[String, *]>>} every [key, value] pair */
export const recEntries = () => ops.entries('recovery');
/** Removes every key in the 'recovery' store. */
export const recClear = () => ops.clear('recovery');
