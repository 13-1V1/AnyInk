// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: the status pill in the Simple top bar (UX-BEGINNER.md 4.11, 7.7):
	  "Saved" (green dot) | "Saving..." | "Not saved yet [Save]" (amber dot) | "Couldn't save [Fix]"
	  (red dot)
	The words are <anyink-save-status>'s own (files/save_status_element.js), so the notices, the
	leave check and every test that reads the status find it where they always have; the pill
	adds the dot (data-status, simple_top_bar.css) and the outlined button inside it
	(files/save_status.js simpleStatusPill). Save saves (the Windows save box the first time).
	Fix says what went wrong in plain words: "Couldn't save to Brennan Hand.gs2. A backup copy is
	kept." [Try again] [Save somewhere else] (the error box, words/error_box.js); the browser's
	own sentence never shows.

	  makeStatusPill(editor)          the pill, up to date
	  updateStatusPill(pill, editor)  after a save status change
	  pressStatusButton(action, editor)   'save' | 'fix'
	  showFix(editor)                 the Fix box; returns it
*/
import { getSaveStatus, simpleStatusPill } from '../files/save_status.js';
import { isProjectFileHandle } from '../files/write_file.js';
import { runFileCommand } from '../files/run_command.js';
import { showWordsError } from '../words/error_box.js';
import { saveErrorWords } from '../words/error_words.js';
import { wordEntry } from '../words/words.js';

/**
 * @param {Object} editor - ProjectEditor
 * @returns {HTMLElement}
 */
export function makeStatusPill(editor) {
	const pill = document.createElement('span');
	pill.className = 'anyink-topbar__status';
	pill.dataset.anyinkControl = 'status';
	const status = document.createElement('anyink-save-status');
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'anyink-topbar__status-button';
	button.dataset.anyinkControl = 'statusButton';
	button.hidden = true;
	button.addEventListener('click', () => pressStatusButton(button.dataset.action, pill.editor));
	pill.append(status, button);
	updateStatusPill(pill, editor);
	return pill;
}

/**
 * @param {HTMLElement} pill
 * @param {Object} editor - ProjectEditor
 */
export function updateStatusPill(pill, editor) {
	if (!pill) return;
	pill.editor = editor;
	const words = simpleStatusPill(getSaveStatus(editor), {
		workFile: isProjectFileHandle(editor?.loadedFileHandle),
	});
	pill.dataset.status = words.status;
	// A page with no <anyink-save-status> defined (a test page) still says the words
	const status = pill.querySelector('anyink-save-status');
	if (status && !globalThis.customElements?.get('anyink-save-status')) {
		status.textContent = words.text;
		status.title = words.hint;
		status.dataset.status = words.status;
	}
	const button = pill.querySelector('[data-anyink-control="statusButton"]');
	if (!button) return;
	button.hidden = !words.button;
	if (!words.button) {
		delete button.dataset.action;
		return;
	}
	if (button.textContent !== words.button.text) button.textContent = words.button.text;
	button.dataset.action = words.button.action;
	button.title = wordEntry(words.button.key)?.hint || '';
}

/**
 * @param {'save' | 'fix'} action
 * @param {Object} editor - ProjectEditor
 * @returns {*}
 */
export function pressStatusButton(action, editor) {
	if (!editor) return false;
	// in the click: the Windows save box needs it
	if (action === 'save') return runFileCommand(() => editor.saveProjectFile());
	if (action === 'fix') return showFix(editor);
	return false;
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {HTMLElement} the box
 */
export function showFix(editor) {
	const fileName = editor?.loadedFileHandle?.name || '';
	return showWordsError(saveErrorWords(null, fileName), {
		'error.button.tryAgain': () => runFileCommand(() => editor.saveProjectFile()),
		'error.button.saveElsewhere': () => runFileCommand(() => editor.saveProjectFile(true)),
	});
}
