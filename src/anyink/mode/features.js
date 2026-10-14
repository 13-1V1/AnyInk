// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Feature flags for the Simple screens (UX-BEGINNER.md principle 8 and section 10): one flag per
	feature (coach, letterView, brush, photo, board, checks, tryIt, startScreen, useInWord,
	fontDetails, help). Every button, menu row, coach rule, tip and Help entry names its flag and
	stays hidden while the flag is off, so no B shows a door to a later B. Each B adds and turns on
	only its own flag when it lands; B2 has none, so the list starts empty.
*/

/** @type {Readonly<Object<String, Boolean>>} */
export const FEATURES = Object.freeze({});

/**
 * @param {String} name - a flag name, e.g. 'board'
 * @returns {Boolean} true only for a flag that exists and is on
 */
export function isFeatureOn(name) {
	return Object.hasOwn(FEATURES, name) && FEATURES[name] === true;
}
