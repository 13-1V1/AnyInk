// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 + B11 integration: the checks, wired into the app once at boot (app/main.js), so every
	screen reads one "Needs a look" (UX-BEGINNER.md 4.2 "Ready", 4.0 rules 7 and 9, D-037's one
	truth):
	  - the app's checks cache (cache.js) follows the current editor (watch: the font check's
	    problems come in by the 'fontCheck' topic, and a pass runs right after each step in Simple)
	    and reads the font check's last problems (font_check.js getLastFontCheck), so a letter the
	    font file can't hold is "Needs a look" with [Fix it] on the board and in the card too;
	  - the Next line's 'checks' source is the cache (coach_state.js setSource): rule 7 in the
	    letter view, rule 9 on the board, and the coach's letters, which the board's tiles and
	    counts read (board_page.js) and the rail counts with (readyRuleFor);
	  - the Next line's and the board's buttons: 'fixLetter' (fixes.js runFixAction) and
	    'looksFine' (looks_fine_step.js runLooksFine);
	  - the fixes' "made 2 letters need a look" toasts compare the same "needs a look"
	    (fix_step.js useNeedsALook). That is the one voice for a letter flipped by a change he
	    didn't make on it: a fix, or a moved line. cache.js's CHECKS_CHANGE_EVENT gets no toast of
	    its own, so nothing is said twice (D-042).
	  - B10 + B11 finalize: the font check runs again right after every step in Simple with
	    'checks' on (the save status counts every step, Undo and Redo, D-018), never 2 s later:
	    the checks read its last problems, so after an Undo of [Fix it] the letter read Ready for
	    2 s while the font file couldn't hold it, then turned amber with no step in between. It
	    waits, as its own timer does, while the Point pen has a shape open in the letter view.
	Everything here reads Simple with 'checks' on where it shows (the coach's flags, runFixAction,
	runLooksFine); All tools never shows a check.

	  initChecks({ getEditor })   once; safe in jsdom
	  stopChecksForTests()
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { setCoachAction } from '../coach/actions.js';
import { setCoachSource } from '../coach/coach_state.js';
import { openPathOf } from '../coach/open_shape.js';
import { SAVE_STATUS_EVENT } from '../files/save_status.js';
import { getLastFontCheck, runFontCheckNow } from '../fontcheck/font_check.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { checksSource, getChecksCache } from './cache.js';
import { useNeedsALook } from './fix_step.js';
import { runFixAction } from './fixes.js';
import { runLooksFine } from './looks_fine_step.js';

const PAGE_EVENT = 'anyink-page-change';

const state = {
	started: false,
	getEditor: /** @type {Function | null} */ (null),
	unhooks: /** @type {Array<Function>} */ ([]),
};

/**
 * @param {{getEditor?: Function}} [options]
 */
export function initChecks({ getEditor = getCurrentProjectEditor } = {}) {
	if (state.started) return;
	state.started = true;
	state.getEditor = getEditor;
	const cache = getChecksCache();
	cache.setProblemsSource((editor) => getLastFontCheck(editor)?.problems || []);
	setCoachSource('checks', checksSource);
	setCoachAction('fixLetter', runFixAction);
	setCoachAction('looksFine', runLooksFine);
	useNeedsALook(checksSource);
	if (typeof globalThis.addEventListener === 'function') {
		globalThis.addEventListener(PAGE_EVENT, follow);
		state.unhooks.push(() => globalThis.removeEventListener(PAGE_EVENT, follow));
		globalThis.addEventListener(SAVE_STATUS_EVENT, checkFontNow);
		state.unhooks.push(() => globalThis.removeEventListener(SAVE_STATUS_EVENT, checkFontNow));
	}
	follow();
}

/** A step was made, undone or redone: the font check runs now (Simple with 'checks' on) */
function checkFontNow(event) {
	if (!isSimpleMode() || !isFeatureOn('checks')) return;
	const editor = event?.detail?.editor;
	let current = null;
	try {
		current = state.getEditor?.() || null;
	} catch {
		current = null;
	}
	if (!editor || editor !== current) return;
	if (editor.nav?.page === 'Characters' && openPathOf(editor)) return;
	runFontCheckNow(editor);
}

/** The cache follows whichever editor is current (a font opened or made) */
function follow() {
	let editor = null;
	try {
		editor = state.getEditor?.() || null;
	} catch {
		editor = null;
	}
	if (editor) getChecksCache().watch(editor);
}

/** Lets go of everything initChecks set. */
export function stopChecksForTests() {
	state.unhooks.forEach((unhook) => unhook());
	state.unhooks = [];
	state.started = false;
	state.getEditor = null;
	useNeedsALook(null);
	setCoachSource('checks', null);
	setCoachAction('fixLetter', null);
	setCoachAction('looksFine', null);
	getChecksCache().setProblemsSource(null);
}
