// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper: a stand-in for the IndexedDB layer under storage/kv.js
	(jsdom has no indexedDB). Plug it in with setStorageDriver(fakeDriver()).

	It mirrors idb-keyval's call shape: open(dbName, storeNames) returns one
	connection { use: { [storeName]: handle }, close() }, and get / set / del /
	keys / entries / clear take the store handle as their last argument. Every
	connection shares the same backing Maps, like a real database on disk.

	Failure injection:
	  driver.failNext(count, error)  the next `count` operations reject with error
	  driver.failWhen(fn)            every operation for which fn(op, key) is true rejects
	Counters: driver.opens, driver.closes, driver.calls (op names in order).
*/

/** @returns {Object} fake driver */
export function fakeDriver() {
	const data = new Map(); // storeName -> Map
	let pendingFailures = 0;
	let failure = null;
	let failPredicate = null;

	const driver = {
		opens: 0,
		closes: 0,
		calls: [],
		data,
		open(dbName, storeNames) {
			driver.opens++;
			let closed = false;
			const use = {};
			storeNames.forEach((name) => {
				if (!data.has(name)) data.set(name, new Map());
				use[name] = { name, isClosed: () => closed };
			});
			return {
				use,
				close() {
					closed = true;
					driver.closes++;
				},
			};
		},
		failNext(count = 1, error = makeError('UnknownError', 'backing store failed')) {
			pendingFailures = count;
			failure = error;
		},
		failWhen(predicate, error = makeError('QuotaExceededError', 'the quota has been exceeded')) {
			failPredicate = predicate;
			failure = error;
		},
		get: (key, store) => op('get', store, key, (map) => map.get(key)),
		set: (key, value, store) =>
			op('set', store, key, (map) => {
				map.set(key, value);
			}),
		// one transaction: all pairs or none
		setMany: (pairs, store) =>
			op('setMany', store, pairs[0]?.[0], (map) => {
				pairs.forEach(([key, value]) => map.set(key, value));
			}),
		del: (key, store) =>
			op('del', store, key, (map) => {
				map.delete(key);
			}),
		keys: (store) => op('keys', store, undefined, (map) => [...map.keys()]),
		entries: (store) => op('entries', store, undefined, (map) => [...map.entries()]),
		clear: (store) =>
			op('clear', store, undefined, (map) => {
				map.clear();
			}),
	};

	async function op(name, store, key, fn) {
		driver.calls.push(name);
		if (store.isClosed())
			throw makeError('InvalidStateError', 'the database connection is closing');
		if (pendingFailures > 0) {
			pendingFailures--;
			throw failure;
		}
		if (failPredicate && failPredicate(name, key)) throw failure;
		return fn(data.get(store.name));
	}

	return driver;
}

/**
 * @param {String} name - DOMException-style name
 * @param {String} message
 * @returns {Error}
 */
export function makeError(name, message) {
	const error = new Error(message);
	error.name = name;
	return error;
}
