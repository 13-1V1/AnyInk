// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5: changing the mode on purpose (UX-BEGINNER.md 6.1): More tools, Back to simple, Back to my
	letters. It sets the mode (mode.js mirrors it to html[data-ui-mode] and announces it) and calls
	navigate(), so the page is drawn again with the other mode's controls. A page the new mode
	hides is left for Simple's home first (visibility.js simpleHome: the letter view now, the board
	once B10 lands). An explicit switch ends a landing visit (band.js): the mode is now his choice.
	While an app-level page shows (no editor page is drawn), the editor isn't navigated. The Open
	Project page, the one app-level page with words per mode (its Load and Examples tabs, until
	B13's start screen), is drawn again for the new mode instead (fix track: nothing listened for
	'anyink-mode-change', so it kept the old mode's words); an app-level page with one set of
	words (Cross-project actions) is left as it is. The last 'anyink-page-change' event
	(navigator.js, app.js) says which kind of page is showing. B4 + B5 finalize: the page drawn
	again keeps the font name he typed and the tab he was on.

	  switchMode(mode, { editor, isOn, page })   true when anything changed
	  pageAfterSwitch(page, mode, isOn)           the page to show in the new mode
	  editorPageShowing()                         false while an app-level page shows
	  redrawAppPage()                             the Open Project page drawn again, if it shows
*/
import { getCurrentProjectEditor, getGlyphrStudioApp } from '../../app/main.js';
import { makePage_OpenProject } from '../../app/open_project.js';
import { isFeatureOn } from './features.js';
import { getMode, getVisit, setMode } from './mode.js';
import { isShown, simpleHome } from './visibility.js';

/** Sent on window by every navigate: detail { page, appLevel } */
export const PAGE_EVENT = 'anyink-page-change';

let appLevelPage = false;
globalThis.addEventListener?.(PAGE_EVENT, (event) => {
	appLevelPage = !!event?.detail?.appLevel;
});

/** @returns {Boolean} false while an app-level page (the start page) is showing */
export function editorPageShowing() {
	return !appLevelPage;
}

/**
 * @param {String} page - editor.nav.page
 * @param {'all' | 'simple'} mode - the mode being turned on
 * @param {(name: String) => Boolean} [isOn]
 * @returns {String} the page itself when the mode shows it, else Simple's home
 */
export function pageAfterSwitch(page, mode, isOn = isFeatureOn) {
	return isShown('page', page, { mode, isOn }) ? page : simpleHome(isOn);
}

/** @returns {Object | null} the current project editor, if the app has one */
function currentEditor() {
	try {
		return getCurrentProjectEditor() || null;
	} catch {
		return null;
	}
}

/**
 * @param {'all' | 'simple'} mode
 * @param {Object} [options]
 * @param {Object} [options.editor] - default: the current project editor
 * @param {(name: String) => Boolean} [options.isOn] - default: the app's flags
 * @param {String} [options.page] - the page to show (default: pageAfterSwitch)
 * @returns {Boolean} true when the mode (or a visit) changed and the page was redrawn
 */
export function switchMode(mode, { editor, isOn = isFeatureOn, page } = {}) {
	const before = getMode();
	const hadVisit = !!getVisit();
	if (before === mode && !hadVisit) return false;
	if (!setMode(mode)) return false;
	if (!editorPageShowing()) {
		redrawAppPage();
		return true;
	}
	const target = editor === undefined ? currentEditor() : editor;
	if (target?.nav) {
		target.nav.page = page || pageAfterSwitch(target.nav.page, mode, isOn);
		target.navigate();
	}
	return true;
}

/**
 * The Open Project page, when it is the app-level page showing, drawn again in the mode now on
 * (it reads isSimpleMode() as it is built). Anything else is left as it is.
 * @returns {Boolean} true when the page was drawn again
 */
export function redrawAppPage() {
	const doc = globalThis.document;
	const showing = doc?.querySelector?.('#app__main-content #open-project__page');
	if (!showing) return false;
	const name = doc.querySelector('#input__new-project-name')?.value;
	const tab = doc.querySelector('.open-project__tab[selected]')?.id;
	getGlyphrStudioApp().appPageNavigate(makePage_OpenProject);
	const nameField = doc.querySelector('#input__new-project-name');
	if (nameField && typeof name === 'string') nameField.value = name;
	if (tab) doc.getElementById(tab)?.click();
	return true;
}
