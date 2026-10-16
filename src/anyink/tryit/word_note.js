// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12: the Word note in Try it (UX-BEGINNER.md 4.6): after the first gap fix, one line under the
	hint, "Word needs one setting for gap fixes.", until Use in Word has shown its gap-fix step (step
	4) once. Before B14 ('useInWord' off) it has no pointer to step 3; with it, "Use in Word will
	show you." follows. It goes when the font has no gap fix left (the setting only matters for
	them). Remembered in app prefs (one user, and the Word setting is Word's, not the font's).
	B12 fix pass: before B14 the line says plainly that nothing is needed now ("Nothing to do now:
	you will be shown it when you put your font in Word."), never a to-do with nothing to press;
	it counts only the gap fixes Simple made (gap_list.js listedGapFixes); with no note its row
	keeps its place (visibility hidden, class is-empty), so the first fix never pushes the words
	on the sheet; it comes on release (a 'kernPairs' tick with dragging true is skipped), never
	under the pointer mid-drag.

	  WORD_STEP_PREF                  the pref B14 sets when its step 4 has shown
	  markWordGapStepShown()          B14 calls it when Use in Word shows step 4
	  shouldShowWordNote(project)     a gap fix in the font and step 4 not shown yet
	  wordNoteText({ isOn })          the line's words
	  makeWordNote({ getEditor })     { element (<p>), refresh(), detach() }; follows 'kernPairs'
	  installWordNote(controller)     puts it in Try it's 'note' slot (expand.js); returns an
	                                  uninstall function
*/
import { isFeatureOn } from '../mode/features.js';
import { getPref, setPref } from '../prefs/prefs.js';
import { injectStyleOnce } from '../preview/inject_style.js';
import { word } from '../words/words.js';
import { listedGapFixes } from './gap_list.js';

export const WORD_STEP_PREF = 'wordGapStepShown';
const SUBSCRIBER_ID = 'anyink.wordNote.refresh';
/** expand.js TRY_IT_CHANGE_EVENT (not imported: expand.js may import this file) */
const TRY_IT_CHANGE = 'anyink-try-it-change';
const STYLE_ID = 'anyink-word-note-style';
const STYLE = `
.anyink-word-note {
	margin: 0;
	font-size: var(--text-sm);
	color: var(--chrome-text-muted);
}
.anyink-word-note.is-empty { visibility: hidden; }
`;

/** B14: Use in Word showed its gap-fix step. */
export function markWordGapStepShown() {
	setPref(WORD_STEP_PREF, true);
}

/**
 * @param {Object} project
 * @returns {Boolean}
 */
export function shouldShowWordNote(project) {
	if (getPref(WORD_STEP_PREF, false) === true) return false;
	return listedGapFixes(project).length > 0;
}

/**
 * @param {{isOn?: (name: String) => Boolean}} [options]
 * @returns {String}
 */
export function wordNoteText({ isOn = isFeatureOn } = {}) {
	const note = word('tryitGaps.wordNote');
	const after = isOn('useInWord') ? 'tryitGaps.wordNotePointer' : 'tryitGaps.wordNoteLater';
	return `${note} ${word(after)}`;
}

/**
 * @param {{getEditor: () => Object}} options
 * @returns {{element: HTMLParagraphElement, refresh: Function, detach: Function}}
 */
export function makeWordNote({ getEditor }) {
	injectStyleOnce(STYLE_ID, STYLE);
	const note = document.createElement('p');
	note.className = 'anyink-word-note';
	let attached = null;

	const refresh = () => {
		const editor = getEditor();
		attach(editor);
		const show = shouldShowWordNote(editor?.project);
		// the row keeps its height with nothing to say: the words on the sheet never move for it
		note.textContent = wordNoteText();
		note.classList.toggle('is-empty', !show);
		if (show) note.removeAttribute('aria-hidden');
		else note.setAttribute('aria-hidden', 'true');
	};
	function attach(editor) {
		if (!editor || editor === attached || typeof editor.subscribe !== 'function') return;
		detach();
		attached = editor;
		editor.subscribe({
			topic: 'kernPairs',
			subscriberID: SUBSCRIBER_ID,
			// it comes with the step on release, never under the pointer mid-drag
			callback: (payload) => {
				if (payload?.dragging) return;
				refresh();
			},
		});
	}
	function detach() {
		attached?.unsubscribe?.({ idToRemove: SUBSCRIBER_ID });
		attached = null;
	}

	refresh();
	return { element: note, refresh, detach };
}

/**
 * @param {{slots: Object<String, HTMLElement>, strip?: Object}} controller - expand.js makeTryIt
 * @param {{win?: Window}} [options]
 * @returns {Function} uninstall
 */
export function installWordNote(controller, { win = globalThis } = {}) {
	const slot = controller?.slots?.note;
	if (!slot) return () => {};
	const note = makeWordNote({ getEditor: () => controller.strip?.editor });
	slot.replaceChildren(note.element);
	const onChange = (event) => {
		if (event?.detail?.open) note.refresh();
		else note.detach();
	};
	win.addEventListener?.(TRY_IT_CHANGE, onChange);
	return () => {
		win.removeEventListener?.(TRY_IT_CHANGE, onChange);
		note.detach();
		note.element.remove();
	};
}
