// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B2: which interface ANY-INK shows (UX-BEGINNER.md section 6).
	  'all'    - All tools: today's full Glyphr Studio editor. The launch default until B16.
	  'simple' - the beginner screens. Adding ?ui=simple to the address turns it on for that load.
	This is the bare switch the first Simple-only behavior needs (B2's undo); B5 builds the rest
	of the folder (the switch on screen, gates, keys) on getMode / setMode.
*/

/** The modes, in no particular order */
export const MODES = Object.freeze(['all', 'simple']);

/** What ANY-INK opens in when the address does not ask for Simple (B16 changes this). */
export const LAUNCH_MODE = 'all';

/**
 * @param {String} [search] - location.search, with or without the leading '?'
 * @returns {'all' | 'simple'} 'simple' only for ui=simple
 */
export function modeFromSearch(search) {
	try {
		return new URLSearchParams(search || '').get('ui') === 'simple' ? 'simple' : LAUNCH_MODE;
	} catch {
		return LAUNCH_MODE;
	}
}

let current = modeFromSearch(globalThis.location?.search);

/** @returns {'all' | 'simple'} */
export function getMode() {
	return current;
}

/** @returns {Boolean} true while the Simple screens are on */
export function isSimpleMode() {
	return current === 'simple';
}

/**
 * @param {'all' | 'simple'} mode
 * @returns {Boolean} false (and no change) for a mode that doesn't exist
 */
export function setMode(mode) {
	if (!MODES.includes(mode)) return false;
	current = mode;
	return true;
}

/**
 * Unit tests run Simple-only code with this, and put 'all' back after each test.
 * @param {'all' | 'simple'} [mode] - default: the launch mode
 * @returns {'all' | 'simple'} the mode it replaced
 */
export function setModeForTests(mode = LAUNCH_MODE) {
	const previous = current;
	current = MODES.includes(mode) ? mode : LAUNCH_MODE;
	return previous;
}
