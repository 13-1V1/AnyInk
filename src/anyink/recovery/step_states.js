// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 + B11 integration (D-026's revisit, D-042): the backup copy's Undo list, one record per
	saved copy. Every Undo step holds a saved copy of a letter, or of the whole font (a step about
	many letters: Simple keeps up to 30, D-033). Those copies never change once made, yet the
	backup wrote every one of them again at each write: on a 58-letter traced font with the list
	at its fullest that was 39 MB and about 1.1 s in Chrome, far past D-026's 100 ms. Now each
	copy is its own record in the 'recovery' store, written once, and the session's record names
	them; a write sends the font, the list's titles and only the copies that are new since the
	last write, and takes away the ones the list no longer holds.

	  Keys: a copy of session 'session:<projectId>:<sessionId>' is 'state:<projectId>:<sessionId>:<n>'
	  (never a session key, so every reader of session records passes it over). Its value is
	  { anyinkState: 1, data } (data: the copy's save()).

	  STATE_PREFIX
	  isStateKey(key)
	  stateKeyPrefix(sessionKey)      'state:<projectId>:<sessionId>:'
	  ownerOfState(stateKey)          the session key it belongs to ('' for anything else)
	  makeStateBook(sessionKey)       one session's book of copies:
	    .refFor(copy)                 its key (the same copy, the same key, for the session's
	                                  life); the History's serializeForStorage stateRef. Notes it
	                                  as named by the write being made
	    .beginWrite()                 a new write: nothing named yet
	    .toWrite()                    [[key, value]] named by this write and not yet in the store
	                                  (save() runs here, once per copy)
	    .pending()                    the same, lazily: each save() runs as it is taken (B10 +
	                                  B11 finalize: the write yields between copies)
	    .written(key)                 that one is in the store now
	    .unnamed()                    keys in the store that this write didn't name
	    .forget(key)                  that one is gone from the store
	    .lostAll()                    the store lost every copy (cleared, or the record deleted):
	                                  each is written again when next named
	    .size()                       how many are in the store
	  inlineStates(history, read)     a serialized Undo list with every named copy put back,
	                                  read(key) -> the stored value (async); null when one is
	                                  missing (the font restores, with no Undo list)
*/

export const STATE_PREFIX = 'state:';
const SESSION_PREFIX = 'session:';

/** @param {String} key @returns {Boolean} */
export function isStateKey(key) {
	return typeof key === 'string' && key.startsWith(STATE_PREFIX);
}

/**
 * @param {String} sessionKey - 'session:<projectId>:<sessionId>'
 * @returns {String} the prefix of every copy of that session
 */
export function stateKeyPrefix(sessionKey) {
	const tail = String(sessionKey || '').startsWith(SESSION_PREFIX)
		? String(sessionKey).slice(SESSION_PREFIX.length)
		: String(sessionKey || '');
	return `${STATE_PREFIX}${tail}:`;
}

/**
 * @param {String} key - a copy's key
 * @returns {String} its session's key, '' when it isn't a copy's key
 */
export function ownerOfState(key) {
	if (!isStateKey(key)) return '';
	const tail = key.slice(STATE_PREFIX.length);
	const cut = tail.lastIndexOf(':');
	return cut > 0 ? `${SESSION_PREFIX}${tail.slice(0, cut)}` : '';
}

/**
 * @param {String} sessionKey
 * @returns {Object} the book (see the header)
 */
export function makeStateBook(sessionKey) {
	const prefix = stateKeyPrefix(sessionKey);
	/** copy -> key */
	const keys = new WeakMap();
	/** key -> copy, for the copies named since they were made (dropped when forgotten) */
	const copies = new Map();
	/** keys in the store */
	const stored = new Set();
	/** keys named by the write being made */
	let named = new Set();
	let next = 0;

	function refFor(copy) {
		if (!copy || typeof copy !== 'object') return null;
		let key = keys.get(copy);
		if (!key) {
			key = `${prefix}${next++}`;
			keys.set(copy, key);
		}
		copies.set(key, copy);
		named.add(key);
		return key;
	}

	return {
		refFor,
		beginWrite() {
			named = new Set();
		},
		/**
		 * B10 + B11 finalize: the same list, each copy's save() run only as the write takes it,
		 * so a long list never makes one long task (recovery.js writeSession yields between them)
		 */
		*pending() {
			for (const key of [...named]) {
				if (stored.has(key)) continue;
				const copy = copies.get(key);
				if (typeof copy?.save !== 'function') continue;
				yield [key, { anyinkState: 1, data: copy.save() }];
			}
		},
		toWrite() {
			return [...this.pending()];
		},
		written(key) {
			stored.add(key);
		},
		unnamed() {
			return [...stored].filter((key) => !named.has(key));
		},
		forget(key) {
			stored.delete(key);
			if (!named.has(key)) copies.delete(key);
		},
		lostAll() {
			stored.clear();
			// the next write names its copies again (refFor keeps them from there)
			copies.clear();
		},
		size() {
			return stored.size;
		},
	};
}

/**
 * Puts every named copy back into a serialized Undo list (History.serializeForStorage), so
 * History.adoptSnapshot reads it as it always has.
 * @param {Object | null} history
 * @param {(key: String) => Promise<*>} read - the store's get
 * @returns {Promise<Object | null>} the list with its copies; the same object when it names
 *   none; null when a named copy is missing or unreadable
 */
export async function inlineStates(history, read) {
	if (!history || typeof history !== 'object') return history ?? null;
	const entries = [...(history.queue || []), ...(history.redoQueue || []).flat()];
	const named = entries.some((entry) => entry?.itemStateRef) || !!history.initialProjectRef;
	if (!named) return history;
	const cache = new Map();
	const load = async (key) => {
		if (!cache.has(key)) {
			let value = null;
			try {
				value = await read(key);
			} catch {
				value = null;
			}
			cache.set(key, value?.anyinkState === 1 && value.data ? value.data : null);
		}
		return cache.get(key);
	};
	const fill = async (entry) => {
		if (!entry?.itemStateRef) return entry;
		const data = await load(entry.itemStateRef);
		if (!data) throw new Error(`missing ${entry.itemStateRef}`);
		const filled = { ...entry, itemState: data };
		delete filled.itemStateRef;
		return filled;
	};
	try {
		const out = { ...history };
		if (history.initialProjectRef) {
			const data = await load(history.initialProjectRef);
			if (!data) return null;
			out.initialProject = data;
			delete out.initialProjectRef;
		}
		out.queue = [];
		for (const entry of history.queue || []) out.queue.push(await fill(entry));
		out.redoQueue = [];
		for (const entries of history.redoQueue || []) {
			const group = [];
			for (const entry of entries || []) group.push(await fill(entry));
			out.redoQueue.push(group);
		}
		return out;
	} catch (error) {
		console.warn(
			'ANY-INK recovery: a backup step is missing; the font opens without its Undo list',
			error
		);
		return null;
	}
}
