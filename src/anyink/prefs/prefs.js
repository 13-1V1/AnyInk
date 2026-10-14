// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK app-level preferences.
	These belong to the app on this machine, not to a project file: canvas theme,
	preview sample text and size, recent-file bookkeeping. Upstream keeps its "app"
	settings inside each project; this module is deliberately separate (D-007).
	Storage: one JSON object under localStorage key 'anyink-prefs'. Every read and
	write is guarded, so a blocked or full localStorage degrades to in-memory prefs.
	B1 fix: two ANY-INK windows share that one key. A write re-reads it first and changes
	only its own pref (never writes back a stale copy over what the other window set),
	and a 'storage' event from the other window drops this window's cached copy.
*/

const STORAGE_KEY = 'anyink-prefs';
let memory = null; // in-memory copy, also the fallback when storage is unavailable

function load() {
	if (memory) return memory;
	memory = {};
	try {
		const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
		if (raw) memory = JSON.parse(raw) || {};
	} catch {
		memory = {};
	}
	return memory;
}

/**
 * The prefs as storage holds them now (another window may have written since this one
 * loaded); the in-memory copy when storage can't be read.
 * @returns {Object}
 */
function loadFresh() {
	try {
		const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
		if (raw) {
			const stored = JSON.parse(raw);
			if (stored && typeof stored === 'object') memory = stored;
		}
	} catch {
		// storage blocked or unreadable: keep the in-memory copy
	}
	return load();
}

// Another window changed the prefs: read them again on the next getPref.
globalThis.addEventListener?.('storage', (event) => {
	if (event.key === STORAGE_KEY || event.key === null) memory = null;
});

function persist() {
	try {
		globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(memory));
	} catch {
		// storage blocked or full: keep the in-memory value only
	}
}

/**
 * @param {String} name
 * @param {*} fallback - returned when the pref is unset
 * @returns {*}
 */
export function getPref(name, fallback = undefined) {
	const prefs = load();
	return Object.prototype.hasOwnProperty.call(prefs, name) ? prefs[name] : fallback;
}

/**
 * @param {String} name
 * @param {*} value - must be JSON-serializable
 */
export function setPref(name, value) {
	const prefs = loadFresh();
	prefs[name] = value;
	persist();
}

/** @param {String} name */
export function deletePref(name) {
	const prefs = loadFresh();
	delete prefs[name];
	persist();
}

/** @returns {Object} a shallow copy of every pref */
export function getAllPrefs() {
	return { ...load() };
}

/** Test helper: forget the cached copy so the next read hits storage again. */
export function resetPrefsCache() {
	memory = null;
}
