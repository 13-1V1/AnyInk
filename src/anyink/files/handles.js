// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK file-handle store (Milestone 6, D-012).
	Owner: FILES track (open / save / recents). Implemented in the scaffold, not a
	stub, because both the files track and the export-folder track need it and
	it is only a few wrappers over storage/kv.js.

	FileSystemHandle objects are structured-cloneable, so they go into the 'kv'
	store as-is. Named singletons ('lastProject', 'exportFolder') use
	rememberHandle / recallHandle / forgetHandle. The recent-projects list is one
	array under RECENTS_KEY, newest first, capped at MAX_RECENTS, deduplicated
	with handle.isSameEntry(). Handle lists (the fonts ANY-INK exported,
	'exportedFiles') hold records { handle, ...details } and use pushHandleToList /
	findInHandleList / isHandleInList / removeHandleFromList / forgetHandleList,
	with the same isSameEntry matching. A bare handle stored by an earlier build
	reads back as { handle } (no details).

	Read-modify-write (recents, handle lists) reads with kvGetStrict: when the read
	fails, the write is skipped and the function resolves false, so a storage hiccup
	never replaces a stored list with a truncated one. Nothing here rejects.

	Permission: a handle read back from IndexedDB usually comes back in the
	'prompt' state after a reload. requestPermission() only works inside a user
	gesture (click), so ensurePermission() asks only when navigator.userActivation
	says a gesture is active, otherwise it reports 'prompt' and the caller shows a
	button. Chrome 122+ can remember the grant ("Allow on every visit").

	Degrades: no File System Access API (jsdom) means handles are plain objects;
	nothing here touches window.show*Picker.
*/

import { kvDel, kvGet, kvGetStrict, kvSet } from '../storage/kv.js';

const HANDLE_PREFIX = 'handle:';
export const RECENTS_KEY = 'recentProjects';
export const MAX_RECENTS = 8;

/**
 * Stores a handle under a name.
 * @param {String} key - e.g. 'lastProject', 'exportFolder'
 * @param {FileSystemHandle} handle
 * @returns {Promise<void>}
 */
export async function rememberHandle(key, handle) {
	await kvSet(HANDLE_PREFIX + key, handle);
}

/**
 * @param {String} key
 * @returns {Promise<FileSystemHandle | null>} the stored handle, or null
 */
export async function recallHandle(key) {
	const handle = await kvGet(HANDLE_PREFIX + key);
	return handle === undefined ? null : handle;
}

/**
 * @param {String} key
 * @returns {Promise<void>}
 */
export async function forgetHandle(key) {
	await kvDel(HANDLE_PREFIX + key);
}

/**
 * Makes sure we may use a handle. queryPermission first; requestPermission only
 * when a user gesture is active (or when the browser cannot tell us).
 * @param {FileSystemHandle} handle
 * @param {'read' | 'readwrite'} mode
 * @returns {Promise<'granted' | 'prompt' | 'denied'>}
 *   'granted' - go ahead
 *   'prompt'  - call again from inside a click handler (show a button)
 *   'denied'  - the user refused, or this is not a real handle: re-pick the file
 */
export async function ensurePermission(handle, mode = 'readwrite') {
	if (!handle || typeof handle.queryPermission !== 'function') return 'denied';
	const options = { mode };
	let state;
	try {
		state = await handle.queryPermission(options);
	} catch {
		return 'prompt';
	}
	if (state !== 'prompt') return state === 'granted' ? 'granted' : 'denied';
	if (typeof handle.requestPermission !== 'function') return 'prompt';
	const activation = globalThis.navigator?.userActivation;
	if (activation && !activation.isActive) return 'prompt';
	try {
		state = await handle.requestPermission(options);
	} catch {
		// SecurityError: no user activation after all. Ask again from a click.
		return 'prompt';
	}
	return state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt';
}

/**
 * @returns {Promise<Array<{handle: FileSystemFileHandle, name: String, time: Number}>>}
 *   newest first; empty array when nothing was ever opened
 */
export async function listRecentProjects() {
	const list = await kvGet(RECENTS_KEY);
	return Array.isArray(list) ? list : [];
}

async function isSameHandle(a, b) {
	if (a === b) return true;
	if (!a || !b) return false;
	if (typeof a.isSameEntry === 'function') {
		try {
			return await a.isSameEntry(b);
		} catch {
			return false;
		}
	}
	return false;
}

/**
 * Reads a stored array for a read-modify-write.
 * @param {String} storeKey - full kv key
 * @returns {Promise<Array | null>} the array ([] when nothing is stored), or null when
 *   the read failed (the caller must not write)
 */
async function readListForUpdate(storeKey) {
	try {
		const list = await kvGetStrict(storeKey);
		return Array.isArray(list) ? list : [];
	} catch (error) {
		console.warn(`ANY-INK: could not read ${storeKey}; left it unchanged`, error);
		return null;
	}
}

/**
 * Puts a project at the top of the recents list (moving it if already there).
 * @param {FileSystemFileHandle} handle
 * @param {String} name - display name (project name or file name)
 * @returns {Promise<Boolean>} true when stored; false when the list could not be read
 *   or written (it is left as it was)
 */
export async function pushRecentProject(handle, name) {
	if (!handle) return false;
	const list = await readListForUpdate(RECENTS_KEY);
	if (!list) return false;
	const kept = [];
	for (const entry of list) {
		if (!(await isSameHandle(entry.handle, handle))) kept.push(entry);
	}
	kept.unshift({ handle, name: name || handle.name || 'Untitled', time: Date.now() });
	return kvSet(RECENTS_KEY, kept.slice(0, MAX_RECENTS));
}

/**
 * Drops one project from the recents list (file gone, permission denied).
 * @param {FileSystemFileHandle} handle
 * @returns {Promise<Boolean>} true when stored; false when the list could not be read
 *   or written (it is left as it was)
 */
export async function removeRecentProject(handle) {
	const list = await readListForUpdate(RECENTS_KEY);
	if (!list) return false;
	const kept = [];
	for (const entry of list) {
		if (!(await isSameHandle(entry.handle, handle))) kept.push(entry);
	}
	return kvSet(RECENTS_KEY, kept);
}

/** Empties the recents list. @returns {Promise<void>} */
export async function clearRecentProjects() {
	await kvDel(RECENTS_KEY);
}

// --------------------------------------------------------------
// Handle lists: records { handle, ...details }
// --------------------------------------------------------------

/**
 * @param {*} entry - a stored record, or a bare handle from an earlier build
 * @returns {Object | null} { handle, ...details }
 */
function asRecord(entry) {
	if (!entry || typeof entry !== 'object') return null;
	// FileSystemHandle objects carry `kind`; records never do.
	if (entry.kind === undefined && entry.handle) return entry;
	return { handle: entry };
}

async function readHandleList(key) {
	const list = await kvGet(HANDLE_PREFIX + key);
	return Array.isArray(list) ? list.map(asRecord).filter(Boolean) : [];
}

/**
 * Puts a handle at the front of a named list (moving it if already there, with the
 * new details).
 * @param {String} key - e.g. 'exportedFiles'
 * @param {FileSystemHandle} handle
 * @param {Number} cap - longest the list may get; the oldest fall off
 * @param {Object} [details] - plain, structured-cloneable facts stored beside it
 * @returns {Promise<Boolean>} true when stored; false when the list could not be read
 *   or written (it is left as it was)
 */
export async function pushHandleToList(key, handle, cap, details = {}) {
	if (!handle) return false;
	const list = await readListForUpdate(HANDLE_PREFIX + key);
	if (!list) return false;
	const kept = [{ ...details, handle }];
	for (const record of list.map(asRecord).filter(Boolean)) {
		if (!(await isSameHandle(record.handle, handle))) kept.push(record);
	}
	return kvSet(HANDLE_PREFIX + key, kept.slice(0, cap));
}

/**
 * @param {String} key
 * @param {FileSystemHandle} handle
 * @returns {Promise<Object | null>} the stored record { handle, ...details } for the
 *   same file or folder, or null
 */
export async function findInHandleList(key, handle) {
	if (!handle) return null;
	for (const record of await readHandleList(key)) {
		if (await isSameHandle(record.handle, handle)) return record;
	}
	return null;
}

/**
 * @param {String} key
 * @param {FileSystemHandle} handle
 * @returns {Promise<Boolean>} true when the list holds the same file or folder
 */
export async function isHandleInList(key, handle) {
	return (await findInHandleList(key, handle)) !== null;
}

/**
 * @param {String} key
 * @param {FileSystemHandle} handle
 * @returns {Promise<Boolean>} true when stored; false when the list could not be read
 *   or written (it is left as it was)
 */
export async function removeHandleFromList(key, handle) {
	if (!handle) return false;
	const list = await readListForUpdate(HANDLE_PREFIX + key);
	if (!list) return false;
	const kept = [];
	for (const record of list.map(asRecord).filter(Boolean)) {
		if (!(await isSameHandle(record.handle, handle))) kept.push(record);
	}
	return kvSet(HANDLE_PREFIX + key, kept);
}

/**
 * @param {String} key
 * @returns {Promise<Number>} how many handles the list holds
 */
export async function countHandleList(key) {
	return (await readHandleList(key)).length;
}

/** Empties a named list. @param {String} key @returns {Promise<void>} */
export async function forgetHandleList(key) {
	await kvDel(HANDLE_PREFIX + key);
}
