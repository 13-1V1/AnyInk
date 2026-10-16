// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15: the top bar's Help door (topbar/doors.js 'anyink-open-help', detail { section }), sent
	by Menu > How to make a font, What these words mean, Use your font in Word and Keyboard keys
	(4.9). In Simple it opens the Help page and goes to that section (help_page.js
	showHelpSection); a section that isn't there opens Help at its title. Already on Help with
	that section drawn, it only goes to the section (a page drawn before a flag turned on is drawn
	again). Opening Help is looking around: one navigate, never an Undo step (7.3).
	All tools has no such rows, so the door does nothing there.

	  openHelp(section, { editor })   true when Help opened (Simple, an editor that can navigate)
	  listenForHelpDoor()             answers the door from now on (once; pages/help.js calls it
	                                  when it loads); returns a function that stops it
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { isSimpleMode } from '../mode/mode.js';
import { HELP_EVENT } from '../topbar/doors.js';
import { showHelpSection } from './help_page.js';

/** The Help page's name in the Navigator */
export const HELP_PAGE = 'Help';

/** @type {Function | null} */
let stop = null;

/**
 * @param {String} [section] - 'how' | 'words' | 'word' | 'keys' | 'more'
 * @param {{editor?: Object}} [options] - default: the current project editor
 * @returns {Boolean}
 */
export function openHelp(section, { editor } = {}) {
	if (!isSimpleMode()) return false;
	let target = editor;
	try {
		target = target || getCurrentProjectEditor();
	} catch {
		return false;
	}
	if (!target?.nav || typeof target.navigate !== 'function') return false;
	const doc = globalThis.document;
	const shown = doc?.querySelector('[data-anyink-help]');
	const has = shown?.querySelector(`[data-anyink-help-section="${section}"]`);
	if (target.nav.page !== HELP_PAGE || !shown || !has) {
		target.nav.page = HELP_PAGE;
		target.navigate();
	}
	if (doc) showHelpSection(doc, section);
	return true;
}

/** @returns {Function} stops listening */
export function listenForHelpDoor() {
	if (stop) return stop;
	if (typeof globalThis.addEventListener !== 'function') return () => {};
	const onDoor = (event) => openHelp(event?.detail?.section);
	globalThis.addEventListener(HELP_EVENT, onDoor);
	stop = () => {
		globalThis.removeEventListener(HELP_EVENT, onDoor);
		stop = null;
	};
	return stop;
}
