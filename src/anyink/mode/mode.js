// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B2 + B5: which interface ANY-INK shows (UX-BEGINNER.md section 6).
	  'simple' - the beginner screens. The launch default since B16 (6.1): the address with no ui,
	             the installed app's start_url and a reopened tab all open in Simple.
	  'all'    - All tools ("More tools"): today's full Glyphr Studio editor. On only by its switch,
	             or ?ui=all for one load (the real-Chrome checks of All tools use it); it lasts
	             until he turns it off or closes the app.

	The mode is mirrored to html[data-ui-mode] (the way theme.js mirrors html[data-canvas]), so
	CSS can tell the modes apart, and a real change is announced once on window as
	'anyink-mode-change' { mode, previous, visit }. Turning a mode on never redraws anything here:
	switch.js does that (it calls navigate()), and band.js runs the hidden-page landing rule.

	  getMode() / isSimpleMode()
	  setMode(mode, { visit })   'all' or 'simple'; false (and no change) for any other value.
	                             visit: { page, cause }, only with 'all': All tools turned on for
	                             one visit to a page Simple hides (6.3, band.js). Any other
	                             setMode ends the visit.
	  getVisit()                 the visit, frozen, or null
	  hasUsedSimple()            true once Simple has been on this session: the More tools band
	                             shows only then, so a ?ui=all load looks exactly as upstream
	  setModeForTests(mode)      switches with no event and starts the session over (no visit,
	                             hasUsedSimple only for 'simple'); the vitest setup pins 'all'
*/

/** The modes, in no particular order */
export const MODES = Object.freeze(['all', 'simple']);

/** What ANY-INK opens in when the address does not ask for All tools (B16: Simple). */
export const LAUNCH_MODE = 'simple';

/** Announced on window after a real change: detail { mode, previous, visit } */
export const MODE_EVENT = 'anyink-mode-change';

/** The attribute on <html> that mirrors the mode */
export const MODE_ATTRIBUTE = 'data-ui-mode';

/**
 * @param {String} [search] - location.search, with or without the leading '?'
 * @returns {'all' | 'simple'} ui=all or ui=simple as asked; anything else the launch mode
 */
export function modeFromSearch(search) {
	try {
		const asked = new URLSearchParams(search || '').get('ui');
		return MODES.includes(asked) ? asked : LAUNCH_MODE;
	} catch {
		return LAUNCH_MODE;
	}
}

let current = modeFromSearch(globalThis.location?.search);
let usedSimple = current === 'simple';
/** @type {Readonly<{page: String, cause: String}> | null} */
let visit = null;
mirror();

/** Writes the mode onto <html>; nothing to do outside a page (Node). */
function mirror() {
	globalThis.document?.documentElement?.setAttribute(MODE_ATTRIBUTE, current);
}

/** @returns {'all' | 'simple'} */
export function getMode() {
	return current;
}

/** @returns {Boolean} true while the Simple screens are on */
export function isSimpleMode() {
	return current === 'simple';
}

/** @returns {Readonly<{page: String, cause: String}> | null} */
export function getVisit() {
	return visit;
}

/** @returns {Boolean} true once Simple has been on this session */
export function hasUsedSimple() {
	return usedSimple;
}

/**
 * @param {'all' | 'simple'} mode
 * @param {Object} [options]
 * @param {{page: String, cause: String}} [options.visit] - with 'all' only (6.3)
 * @returns {Boolean} false (and no change) for a mode that doesn't exist
 */
export function setMode(mode, { visit: newVisit = null } = {}) {
	if (!MODES.includes(mode)) return false;
	const previous = current;
	current = mode;
	visit = mode === 'all' && newVisit ? Object.freeze({ ...newVisit }) : null;
	if (mode === 'simple') usedSimple = true;
	mirror();
	if (previous !== mode) announce(previous);
	return true;
}

/** @param {'all' | 'simple'} previous */
function announce(previous) {
	if (typeof globalThis.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') return;
	globalThis.dispatchEvent(
		new CustomEvent(MODE_EVENT, { detail: { mode: current, previous, visit } })
	);
}

/**
 * Unit tests run Simple-only code with this, and the vitest setup puts 'all' back before each
 * test. No event; the session starts over.
 * @param {'all' | 'simple'} [mode] - default: the launch mode
 * @returns {'all' | 'simple'} the mode it replaced
 */
export function setModeForTests(mode = LAUNCH_MODE) {
	const previous = current;
	current = MODES.includes(mode) ? mode : LAUNCH_MODE;
	usedSimple = current === 'simple';
	visit = null;
	mirror();
	return previous;
}
