// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13: the install offer, as a toast (UX-BEGINNER.md 4.1 "Install offer", 7.1, section 10 B13).
	Not on the start screen: in Simple it comes once, as a toast, after the first letter becomes
	Ready, or after the first font file (only once B14's 'useInWord' flag is on; until then the
	Ready letter is the only way in): "Install ANY-INK as an app so it opens from your desktop.
	[Install] [Not now]". It is remembered the moment it shows (it appears once, ever); Not now,
	or a No in Chrome's own install box, is remembered too, and keeps the All tools notice away
	as well (one pref, pwa/register.js). After that, install lives in Menu > Help
	(topbar/install_offer.js, which reads Chrome's offer from here).
	Never while a dialog is open (coach/dom_probe.js openDialogName): it waits, checking again
	every DIALOG_RETRY_MS, and shows once the dialog has closed. B16: nor in the middle of a photo
	walk (photoWalkNow: the photo card, or the Next line on step C or the photo's next part; the
	acceptance run saw it pop up over the letter while he was busy): it waits the same way, unless
	a font file was made. Never on the start page, never
	when ANY-INK already runs as the installed app, never in All tools (register.js keeps its
	notice there, as before).

	This module holds Chrome's beforeinstallprompt event for the whole app: the toast and the
	Menu row ask the same one, and Chrome answers one prompt per offer, so whichever is pressed
	first uses it up and the other goes.

	  holdInstallEvent(event)     keeps Chrome's offer (the page's own listener and register.js
	                              call it), then tryInstallOffer()
	  installEvent()              the offer, while it can still be asked, or null
	  promptHeldInstall()         Chrome's install box; resolves { asked, outcome }
	  onInstallOfferGone(fn)      fn() when the held offer is used up or ANY-INK was installed
	                              (register.js closes the All tools notice); returns a stop
	  tryInstallOffer()           shows the toast when every rule allows; returns why not:
	                              'no-event' | 'said' | 'installed' | 'not-simple' |
	                              'flag-off' | 'start-page' | 'not-yet' | 'dialog' | 'busy' |
	                              'shown'
	  photoWalkNow(coach)         B16: a photo walk is under way
	  noteFontFile()              B14 calls it when a font file is made
	  isRunningInstalled()        true while ANY-INK runs as the installed app
	  INSTALL_NOT_NOW_PREF, INSTALL_OFFERED_PREF, OFFER_MS, DIALOG_RETRY_MS
	  setInstallOfferDepsForTests({ readyLetters, show, isInstalled, dialogOpen, photoWalk })
	  setInstallEventForTests(event)   the offer, without trying to show it
	  resetInstallOfferForTests()
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { readyRuleFor } from '../board/board_page.js';
import { CHECKS_CHANGE_EVENT } from '../checks/cache.js';
import { getCoach } from '../coach/coach_state.js';
import { openDialogName } from '../coach/dom_probe.js';
import { openPathOf } from '../coach/open_shape.js';
import { SAVE_STATUS_EVENT } from '../files/save_status.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode, MODE_EVENT } from '../mode/mode.js';
import { getPref, setPref } from '../prefs/prefs.js';
import { toast } from '../toast/toast.js';
import { readyCount } from '../topbar/ready_count.js';

/** Not now (here, in the All tools notice, or in Chrome's own box): never offered again */
export const INSTALL_NOT_NOW_PREF = 'pwaInstallNotNow';
/** The toast has shown once: it never comes again */
export const INSTALL_OFFERED_PREF = 'anyinkInstallToastShown';
/** How long the toast shows, in ms: a choice with two buttons gets longer than 4.0's 6 s */
export const OFFER_MS = 15000;
/** While a dialog is open, how often to look again, in ms */
export const DIALOG_RETRY_MS = 1000;

/** @returns {Number} the open font's Ready letters (the board's rule, board_page.js) */
function readyLettersNow() {
	const editor = getCurrentProjectEditor();
	if (!editor?.project) return 0;
	return readyCount(editor.project, { open: openPathOf(editor), isReady: readyRuleFor(editor) })
		.ready;
}

/** @returns {Boolean} true while ANY-INK runs as the installed app */
export function isRunningInstalled() {
	try {
		if (globalThis.matchMedia?.('(display-mode: standalone)')?.matches) return true;
	} catch {
		// no matchMedia (tests): not installed
	}
	return globalThis.navigator?.standalone === true;
}

const DEFAULTS = Object.freeze({
	readyLetters: readyLettersNow,
	show: toast,
	isInstalled: isRunningInstalled,
	dialogOpen: () => !!openDialogName(globalThis.document),
	photoWalk: () => photoWalkNow(getCoach()),
});

let deps = { ...DEFAULTS };
/** Chrome's beforeinstallprompt event, while it can still be asked */
let offer = null;
let fontFileMade = false;
let onStartPage = false;
let retryTimer = null;

/** @returns {Object | null} Chrome's offer, while it can still be asked */
export function installEvent() {
	return offer && typeof offer.prompt === 'function' ? offer : null;
}

/** @param {Object | null} event */
export function setInstallEventForTests(event) {
	offer = event || null;
}

/** Who hears that Chrome's offer is gone (register.js closes the All tools notice) */
const goneListeners = new Set();

/**
 * @param {Function} listener - called when the held offer is used up (any install button, any
 *   answer) or ANY-INK was installed
 * @returns {Function} stops listening
 */
export function onInstallOfferGone(listener) {
	goneListeners.add(listener);
	return () => goneListeners.delete(listener);
}

function offerGone() {
	goneListeners.forEach((listener) => {
		try {
			listener();
		} catch (error) {
			console.warn('ANY-INK install: a listener failed', error);
		}
	});
}

/**
 * Chrome's install box, on the held offer (uses it up: Chrome answers one prompt per offer).
 * A No is remembered like Not now.
 * @returns {Promise<{asked: Boolean, outcome: String}>}
 */
export async function promptHeldInstall() {
	const event = installEvent();
	if (!event) return { asked: false, outcome: '' };
	offer = null;
	offerGone();
	try {
		await event.prompt();
		const choice = await event.userChoice;
		const outcome = choice?.outcome || '';
		if (outcome === 'dismissed') setPref(INSTALL_NOT_NOW_PREF, Date.now());
		return { asked: true, outcome };
	} catch (error) {
		console.warn('ANY-INK install: Chrome did not show its install box', error);
		return { asked: false, outcome: '' };
	}
}

function stopRetry() {
	if (retryTimer !== null) globalThis.clearInterval(retryTimer);
	retryTimer = null;
}

/** While a dialog is open or a photo walk runs: look again every DIALOG_RETRY_MS until not */
function retryAfterDialog() {
	if (retryTimer !== null) return;
	retryTimer = globalThis.setInterval(() => {
		const why = tryInstallOffer();
		if (why !== 'dialog' && why !== 'busy') stopRetry();
	}, DIALOG_RETRY_MS);
}

/**
 * B16: a photo walk is under way: the photo card runs, or the Next line is on step C (rule 3)
 * or on the photo's next part (rule 12).
 * @param {{line: () => Object, state: () => Object}} coach - coach_state.js getCoach()
 * @returns {Boolean}
 */
export function photoWalkNow(coach) {
	try {
		if (coach?.state?.()?.photoCard) return true;
		const name = coach?.line?.()?.name;
		return name === 'photoParts' || name === 'photoResult';
	} catch {
		return false;
	}
}

/** @returns {Boolean} */
function isBusy() {
	try {
		return !!deps.photoWalk?.();
	} catch (error) {
		console.warn('ANY-INK install: could not tell whether a photo walk runs', error);
		return false;
	}
}

/** @returns {Boolean} */
function wasSaid() {
	return !!getPref(INSTALL_NOT_NOW_PREF) || !!getPref(INSTALL_OFFERED_PREF);
}

/** @returns {Boolean} a letter is Ready (or B14 made a font file) */
function hasEarnedIt() {
	if (fontFileMade) return true;
	try {
		return Number(deps.readyLetters()) >= 1;
	} catch (error) {
		console.warn('ANY-INK install: could not count the Ready letters', error);
		return false;
	}
}

/**
 * Shows the install toast when every rule allows.
 * @returns {String} 'shown', or why not
 */
export function tryInstallOffer() {
	if (!installEvent()) return 'no-event';
	if (wasSaid()) return 'said';
	if (deps.isInstalled()) return 'installed';
	if (!isSimpleMode()) return 'not-simple';
	if (!isFeatureOn('startScreen')) return 'flag-off'; // B13's own door
	if (onStartPage) return 'start-page';
	if (!hasEarnedIt()) return 'not-yet';
	if (deps.dialogOpen()) {
		retryAfterDialog();
		return 'dialog';
	}
	// B16: not in the middle of a photo walk; it waits for a calm moment (the board with no
	// photo part left to do, Try it, or the first font file)
	if (!fontFileMade && isBusy()) {
		retryAfterDialog();
		return 'busy';
	}
	stopRetry();
	setPref(INSTALL_OFFERED_PREF, Date.now());
	// The toast's buttons speak for this offer only: once Chrome's offer is used up (Menu > Help
	// installed first) they do nothing
	const stillGood = () => !!installEvent() && !getPref(INSTALL_NOT_NOW_PREF);
	deps.show(
		'notice.install',
		{},
		{
			kind: 'info',
			group: 'install',
			ms: OFFER_MS,
			stillGood,
			action: { key: 'notice.installButton', run: () => promptHeldInstall() },
			dismiss: { key: 'notice.notNow', run: () => setPref(INSTALL_NOT_NOW_PREF, Date.now()) },
		}
	);
	return 'shown';
}

/**
 * Keeps Chrome's offer, then shows the toast if he has earned it.
 * @param {Event} event - Chrome's beforeinstallprompt event
 * @returns {String} what tryInstallOffer said
 */
export function holdInstallEvent(event) {
	if (event && typeof event.prompt === 'function') offer = event;
	followCoach();
	return tryInstallOffer();
}

let followingCoach = false;
/** The Next line's state follows the checks after each step: a letter turning Ready there
 * brings the toast too. Started once Chrome has offered install. */
function followCoach() {
	if (followingCoach || deps.show !== DEFAULTS.show) return;
	followingCoach = true;
	try {
		getCoach().subscribe(later);
	} catch (error) {
		console.warn('ANY-INK install: could not follow the Next line', error);
	}
}

/** B14: a font file was made. Counts only once 'useInWord' is on (the B13 stub). */
export function noteFontFile() {
	if (!isFeatureOn('useInWord')) return;
	fontFileMade = true;
	tryInstallOffer();
}

/**
 * @param {Object} replacements - { readyLetters, show, isInstalled, dialogOpen }
 */
export function setInstallOfferDepsForTests(replacements = {}) {
	deps = { ...DEFAULTS, ...replacements };
}

export function resetInstallOfferForTests() {
	stopRetry();
	deps = { ...DEFAULTS };
	offer = null;
	fontFileMade = false;
	onStartPage = false;
}

// What can bring the toast: Chrome's offer, a step (every History step, Undo and Redo sends the
// save status event), the checks flipping a letter, a page change, a mode change
function later() {
	if (installEvent()) tryInstallOffer();
}
globalThis.addEventListener?.('beforeinstallprompt', (event) => holdInstallEvent(event));
globalThis.addEventListener?.('appinstalled', () => {
	offer = null;
	stopRetry();
	offerGone();
});
globalThis.addEventListener?.('anyink-page-change', (event) => {
	onStartPage = !!event?.detail?.appLevel;
	later();
});
globalThis.addEventListener?.(SAVE_STATUS_EVENT, later);
globalThis.addEventListener?.(CHECKS_CHANGE_EVENT, later);
globalThis.addEventListener?.(MODE_EVENT, later);
