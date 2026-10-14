// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	The font check, running (B1, UX-BEGINNER 7.2). In both modes, 2 s after the last change
	to the font, it checks every letter the font file will hold and its kerning (validate.js)
	and publishes 'fontCheck' with { problems: [{ itemId, problem, message }] } on the
	current editor. Changes are the topics that rebuild the preview strip's font
	(currentItem, which a kern value typed on the Kerning page also fires, kernPairs,
	fontMetrics); a page change counts too, since whole-font changes (Global actions,
	letter ranges, opening a font) happen on other pages. Like the strip, it follows the
	current editor on every 'anyink-page-change'.

	  initFontCheck({ getEditor })  start (app boot, once); getEditor defaults to the app's
	  stopFontCheck()               stop: lets go of the editor, cancels a waiting check
	  scheduleFontCheck()           check 2 s from now (restarts the wait)
	  runFontCheckNow(editor)       check now and publish; returns { problems } or null
	  getLastFontCheck(editor)      the last result for that editor, or null
	Subscriber id: anyink.fontCheck.change (no substring of any other id, D-024).
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { makeTrailingDebounce } from '../preview/scheduling.js';
import { FONT_REBUILD_TOPICS } from '../preview/subscriptions.js';
import { validateFont } from './validate.js';

export const FONT_CHECK_TOPIC = 'fontCheck';
export const FONT_CHECK_DELAY_MS = 2000;
export const SUBSCRIBER_ID = 'anyink.fontCheck.change';
export const CHANGE_TOPICS = FONT_REBUILD_TOPICS;
const PAGE_CHANGE_EVENT = 'anyink-page-change';

const state = {
	started: false,
	/** @type {Function | null} */
	getEditor: null,
	editor: null,
	/** @type {WeakMap<Object, {problems: Array}>} */
	lastResults: new WeakMap(),
	scheduled: makeTrailingDebounce(() => {
		if (state.editor) runFontCheckNow(state.editor);
	}, FONT_CHECK_DELAY_MS),
};

/**
 * Starts the check and attaches it to the current editor.
 * @param {Object} [options]
 * @param {Function} [options.getEditor] - returns the current ProjectEditor
 */
export function initFontCheck({ getEditor = getCurrentProjectEditor } = {}) {
	if (state.started) return;
	state.started = true;
	state.getEditor = getEditor;
	globalThis.addEventListener?.(PAGE_CHANGE_EVENT, onPageChange);
	follow();
}

/** Stops the check: no subscriptions, no waiting check. */
export function stopFontCheck() {
	globalThis.removeEventListener?.(PAGE_CHANGE_EVENT, onPageChange);
	state.scheduled.cancel();
	letGo();
	state.started = false;
	state.getEditor = null;
}

/** Check 2 s from now; every call restarts the wait. */
export function scheduleFontCheck() {
	if (state.editor) state.scheduled();
}

/**
 * Checks the editor's font now and publishes the result.
 * @param {Object} editor - ProjectEditor
 * @returns {{problems: Array} | null} null when the check couldn't run (logged)
 */
export function runFontCheckNow(editor) {
	if (!editor?.project) return null;
	let problems;
	try {
		problems = validateFont(editor.project);
	} catch (error) {
		console.warn('ANY-INK font check could not run', error);
		return null;
	}
	const result = { problems };
	state.lastResults.set(editor, result);
	if (typeof editor.publish === 'function') editor.publish(FONT_CHECK_TOPIC, result);
	return result;
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {{problems: Array} | null} the last published result for that editor
 */
export function getLastFontCheck(editor) {
	return state.lastResults.get(editor) || null;
}

function onPageChange() {
	follow();
	scheduleFontCheck();
}

/** Attaches to the current editor when it changed (a font was opened or made). */
function follow() {
	let editor = null;
	try {
		editor = state.getEditor ? state.getEditor() : null;
	} catch {
		editor = null;
	}
	if (!editor || editor === state.editor || typeof editor.subscribe !== 'function') return;
	letGo();
	state.editor = editor;
	editor.subscribe({
		topic: CHANGE_TOPICS,
		subscriberID: SUBSCRIBER_ID,
		callback: () => scheduleFontCheck(),
	});
	scheduleFontCheck();
}

function letGo() {
	const editor = state.editor;
	state.editor = null;
	if (editor && typeof editor.unsubscribe === 'function') {
		editor.unsubscribe({ idToRemove: SUBSCRIBER_ID });
	}
}
