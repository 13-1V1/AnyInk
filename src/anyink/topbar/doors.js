// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: doors from the top bar and its Menu to screens later Bs build (UX-BEGINNER.md 4.0, 4.9,
	principle 8), the way mode/doors.js does it for keys. A control that opens one of them shows
	only once that B's flag is on (visibility.js, the topbar.* words' features), so these fire only
	then. Each is a window event the screen listens for, so the top bar never imports a screen
	that doesn't exist yet. Use in Word is mode/doors.js's openUseInWord (Ctrl+E's door too).

	  'anyink-open-try-it'            step 2 of the rail (B12), detail { cause: 'rail' }
	  'anyink-open-font-details'      the font name, Menu > Font details... (B15), detail { cause }
	  'anyink-open-move-guide-lines'  Menu > Move the guide lines... (B15)
	  'anyink-open-help'              Menu > Help rows (B15), detail { section: 'how' | 'words' |
	                                  'word' | 'keys' }
	  'anyink-open-how-card'          Menu > How to photograph your letters (B9)
	  'anyink-start-new-font'         Menu > Start a new font... (B13; the unsaved check is its)
	(Show tips again calls the coach itself: coach_state.js resetTips.)

	  openDoor(name, detail)          true when the event went out
*/

export const TRY_IT_EVENT = 'anyink-open-try-it';
export const FONT_DETAILS_EVENT = 'anyink-open-font-details';
export const MOVE_GUIDE_LINES_EVENT = 'anyink-open-move-guide-lines';
export const HELP_EVENT = 'anyink-open-help';
export const HOW_CARD_EVENT = 'anyink-open-how-card';
export const NEW_FONT_EVENT = 'anyink-start-new-font';

/**
 * @param {String} name - one of the event names above
 * @param {Object} [detail]
 * @returns {Boolean}
 */
export function openDoor(name, detail = {}) {
	if (typeof globalThis.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined')
		return false;
	globalThis.dispatchEvent(new CustomEvent(name, { detail }));
	return true;
}
