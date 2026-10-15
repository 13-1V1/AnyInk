// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5: the purple More tools band and the hidden-page landing rule (UX-BEGINNER.md 4.11, 6.1,
	6.3).

	The band sits under the top bar whenever All tools was reached from Simple:
	  More tools on purpose:  "More tools: every Glyphr Studio tool is showing, with Glyphr
	                          Studio's own words. [Back to simple]"
	  a landing visit:        "Undo took you to one of the More tools pages. [Back to my letters]"
	                          ("Redo took you to ..." after a redo; "This is one of the More tools
	                          pages." when something else took him there: a link row in a card,
	                          an import)
	All tools as the launch default (until B16) has no band, so the app looks as it does today.
	The band's button is outlined: the one green button belongs to the screen (principle 1).

	The landing rule: arriving on a page Simple hides, in Simple, is never blocked. The page
	renders, More tools turns on for that visit (mode.js setMode('all', { visit })), and the band
	says so. Arriving back on a page Simple shows ends the visit and Simple comes back; so does
	[Back to my letters], which goes to Simple's home. More tools turned on on purpose stays on.
	arriveAt must run on every navigate before the page is drawn (the top of
	Navigator.navigate), so the page is drawn with All tools' controls: makeAppTopBar runs after
	makePageContent, too late to change what the page shows; it only draws the band.

	  arriveAt(page, { isOn, cause })   'landed' | 'returned' | 'stayed'; changes the mode, never
	                                    navigates (it runs inside a navigate)
	  withLandingCause(cause, fn)       what took him there for arrivals while fn runs: the Undo
	                                    and Redo buttons and keys wrap their press in ('undo',
	                                    'redo')
	  bandState()                       null | { kind: 'moreTools' | 'landed', textKey, buttonKey }
	  makeBand({ state, onBack, editor, doc })   the band element, or null when there is none
	  backToSimple({ editor, isOn })    the band's button: Simple, on the same page if Simple shows
	                                    it (home after a visit)
	  turnOnMoreTools({ editor })       More tools (B6's top bar, Menu > View > More tools)
*/
import './band.css';
import { isFeatureOn } from './features.js';
import { getMode, getVisit, hasUsedSimple, setMode } from './mode.js';
import { switchMode } from './switch.js';
import { isShown, simpleHome } from './visibility.js';
import { word } from '../words/words.js';

export const BAND_CLASS = 'anyink-band';

/** What took him to the page, for arrivals while a press runs */
let pendingCause = null;

/**
 * @template T
 * @param {String} cause - 'undo', 'redo', 'link', 'import'
 * @param {() => T} fn
 * @returns {T} what fn returns
 */
export function withLandingCause(cause, fn) {
	const outer = pendingCause;
	pendingCause = cause;
	try {
		return fn();
	} finally {
		pendingCause = outer;
	}
}

/**
 * The landing rule (6.3). Runs on every navigate, before the page is drawn.
 * @param {String} page - editor.nav.page
 * @param {Object} [options]
 * @param {(name: String) => Boolean} [options.isOn] - default: the app's flags
 * @param {String} [options.cause] - what took him there (default: the press running, else 'other')
 * @returns {'landed' | 'returned' | 'stayed'}
 */
export function arriveAt(page, { isOn = isFeatureOn, cause } = {}) {
	const simpleShows = isShown('page', page, { mode: 'simple', isOn });
	const mode = getMode();
	const visit = getVisit();
	if (mode === 'simple') {
		if (simpleShows) return 'stayed';
		setMode('all', { visit: { page, cause: cause || pendingCause || 'other' } });
		return 'landed';
	}
	if (!visit) return 'stayed';
	if (simpleShows) {
		setMode('simple');
		return 'returned';
	}
	if (visit.page !== page) setMode('all', { visit: { ...visit, page } });
	return 'stayed';
}

/** What the band says after a visit, by what took him there (any other cause: 'mode.band.landed') */
const LANDED_TEXT = Object.freeze({ undo: 'mode.band.landedUndo', redo: 'mode.band.landedRedo' });

/**
 * @returns {{kind: 'moreTools' | 'landed', textKey: String, buttonKey: String} | null}
 */
export function bandState() {
	if (getMode() !== 'all') return null;
	const visit = getVisit();
	if (visit) {
		return {
			kind: 'landed',
			textKey: LANDED_TEXT[visit.cause] || 'mode.band.landed',
			buttonKey: 'mode.band.backToLetters',
		};
	}
	if (!hasUsedSimple()) return null;
	return { kind: 'moreTools', textKey: 'mode.band.moreTools', buttonKey: 'mode.band.backToSimple' };
}

/**
 * @param {Object} [options]
 * @param {Object | null} [options.state] - default: bandState()
 * @param {Function} [options.onBack] - default: backToSimple
 * @param {Object} [options.editor] - for the default onBack
 * @param {Document} [options.doc]
 * @returns {HTMLElement | null}
 */
export function makeBand({ state = bandState(), onBack, editor, doc = document } = {}) {
	if (!state) return null;
	const band = doc.createElement('div');
	band.className = BAND_CLASS;
	band.dataset.anyinkBand = state.kind;
	band.setAttribute('role', 'region');
	band.setAttribute('aria-label', word('term.moreTools'));

	const text = doc.createElement('span');
	text.className = `${BAND_CLASS}__text`;
	text.textContent = word(state.textKey);

	const button = doc.createElement('button');
	button.type = 'button';
	button.className = `${BAND_CLASS}__back`;
	button.textContent = word(state.buttonKey);
	button.addEventListener('click', () => (onBack ? onBack() : backToSimple({ editor })));

	band.append(text, button);
	return band;
}

/**
 * The band's button: back to Simple. After a visit it goes to Simple's home ("Back to my
 * letters"); after More tools on purpose it stays on the page when Simple shows it.
 * @param {Object} [options]
 * @param {Object} [options.editor] - default: the current project editor
 * @param {(name: String) => Boolean} [options.isOn]
 * @returns {Boolean} true when anything changed
 */
export function backToSimple({ editor, isOn = isFeatureOn } = {}) {
	const page = getVisit() ? simpleHome(isOn) : undefined;
	return switchMode('simple', { editor, isOn, page });
}

/**
 * More tools on purpose: All tools, on the same page, with the More tools band.
 * @param {Object} [options]
 * @param {Object} [options.editor] - default: the current project editor
 * @returns {Boolean} true when anything changed
 */
export function turnOnMoreTools({ editor } = {}) {
	return switchMode('all', { editor });
}
