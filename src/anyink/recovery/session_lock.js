// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK session lock (Milestone 6, RESEARCH 2.5).
	Every live editor session holds a Web Lock named after its snapshot's store key
	(sessionLockName) for as long as that editor holds that project in this tab. A
	snapshot whose lock is not held belongs to a tab that crashed or was closed, or
	to a project that was replaced, so it is offered for recovery; one whose lock
	is held is live somewhere. Session keys are unique, so a lock never queues in
	practice; lockName(projectId) is the name older builds used, kept so their
	records are still judged correctly.

	Feature-detects navigator.locks: without it (jsdom, old browsers) acquireLock
	returns a no-op handle and heldLockNames returns null, which callers read as
	"unknown, treat every dirty snapshot as recoverable". The locks API is passed
	in so unit tests inject a fake.
*/

/** Older builds: one lock per project id. */
export const LOCK_PREFIX = 'anyink-project-';
/** Current builds: one lock per live session, named after its record key. */
export const SESSION_LOCK_PREFIX = 'anyink-';

/** @param {String} id - project id @returns {String} the lock name older builds held */
export function lockName(id) {
	return LOCK_PREFIX + id;
}

/** @param {String} key - snapshot store key ('session:<projectId>:<sessionId>') @returns {String} */
export function sessionLockName(key) {
	return SESSION_LOCK_PREFIX + key;
}

/**
 * @param {Object} [locks] - navigator.locks or a stand-in
 * @returns {Boolean}
 */
export function hasWebLocks(locks = globalThis.navigator?.locks) {
	return !!locks && typeof locks.request === 'function';
}

/**
 * Requests an exclusive lock and keeps it until release() is called.
 * Queues behind another holder (same project open twice) instead of failing.
 * @param {String} name
 * @param {Object} [locks] - navigator.locks or a stand-in
 * @returns {{name: String, supported: Boolean, granted: Promise<Boolean>, released: Promise<void>,
 *   release: Function}}
 *   granted resolves true once the lock is held, false when unsupported, released
 *   before it was granted, or refused by the browser. released resolves once the
 *   browser has actually let go (or never granted it), so a listing after it no
 *   longer sees the lock.
 */
export function acquireLock(name, locks = globalThis.navigator?.locks) {
	if (!hasWebLocks(locks)) {
		return {
			name,
			supported: false,
			granted: Promise.resolve(false),
			released: Promise.resolve(),
			release() {},
		};
	}
	let released = false;
	let releaseHold = () => {};
	const hold = new Promise((resolve) => (releaseHold = resolve));
	let settleGranted = () => {};
	const granted = new Promise((resolve) => (settleGranted = resolve));

	let request;
	try {
		request = locks.request(name, { mode: 'exclusive' }, () => {
			if (released) return undefined;
			settleGranted(true);
			return hold;
		});
	} catch {
		request = Promise.reject(new Error('lock request failed'));
	}
	const letGo = Promise.resolve(request)
		.catch(() => undefined)
		.then(() => {
			settleGranted(false);
		});

	return {
		name,
		supported: true,
		granted,
		released: letGo,
		release() {
			released = true;
			releaseHold();
			settleGranted(false);
		},
	};
}

/**
 * Names of every lock currently held (by any tab of this origin).
 * @param {Object} [locks] - navigator.locks or a stand-in
 * @returns {Promise<Set<String> | null>} null when the API is unavailable or query failed
 */
export async function heldLockNames(locks = globalThis.navigator?.locks) {
	if (!locks || typeof locks.query !== 'function') return null;
	try {
		const snapshot = await locks.query();
		return new Set((snapshot?.held || []).map((lock) => lock.name));
	} catch {
		return null;
	}
}
