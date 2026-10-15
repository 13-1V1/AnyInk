// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5: doors from the key map to screens later Bs build (UX-BEGINNER.md 7.6, principle 8). A key
	that opens one of them is on only once that B's flag is on (keys.js), so these fire only then.
	Each one is a window event the screen listens for, so the key handler never imports a screen
	that doesn't exist yet:
	  'anyink-open-use-in-word'  Ctrl+E in Simple once 'useInWord' is on (B14), detail { cause }
	  'anyink-open-fine-tune'    a tool key in Simple once 'letterView' is on, for a tool that
	                             lives inside Fine-tune (B7), detail { tool }

	  openUseInWord(cause), openFineTune(tool)   true when the event went out
*/

export const USE_IN_WORD_EVENT = 'anyink-open-use-in-word';
export const FINE_TUNE_EVENT = 'anyink-open-fine-tune';

/**
 * @param {String} name
 * @param {Object} detail
 * @returns {Boolean}
 */
function open(name, detail) {
	if (typeof globalThis.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined')
		return false;
	globalThis.dispatchEvent(new CustomEvent(name, { detail }));
	return true;
}

/**
 * @param {String} [cause] - 'key' for Ctrl+E
 * @returns {Boolean}
 */
export function openUseInWord(cause = 'key') {
	return open(USE_IN_WORD_EVENT, { cause });
}

/**
 * @param {String} tool - the tool picked ('newRectangle')
 * @returns {Boolean}
 */
export function openFineTune(tool) {
	return open(FINE_TUNE_EVENT, { tool });
}
