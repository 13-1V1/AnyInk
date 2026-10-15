// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Plain error messages (UX-BEGINNER.md 7.7, B4 + B5 fix pass): from what went wrong, the words
	to say and the buttons to offer. Pure; the caller shows them (the error box today, B6's and
	B13's cards later) and keeps the browser's own sentence for the console only.

	Each function returns { key, vars, quotes, buttons }:
	  key      the sentence's words key (sets/errors.js)
	  vars     its values; {file} and {folder} are Windows names
	  quotes   which vars show as quotes (.anyink-quote), for word_html.js wordHTML
	  buttons  the buttons' words keys, the first one the main one

	  saveErrorWords(error, fileName)        the work file's write failed. Changed on disk
	                                         (InvalidStateError, NoModificationAllowedError,
	                                         ANY-INK's FileConflictError): save as a new file;
	                                         anything else: try again or save somewhere else
	  openErrorWords(message, fileName)      a work file won't open: newer ANY-INK ([PF4]) or
	                                         "isn't a work file, or damaged" (every other reason)
	  exportFolderWords(reason, folderName)  'cancelled' (no folder picked) | 'refused'
	  fontFileFailedWords()                  the font file couldn't be made or written
	  fileCommandWords()                     any other file command that failed
	  startFileErrorWords(code, fileName)    the start page's drop target: 'SVG1' a drawing, not
	                                         an SVG font; 'SVG0', 'FF0', 'FF1' a font file it
	                                         can't read; 'PF0' to 'PF5' a work file that won't
	                                         open (openErrorWords, B4 + B5 finalize); anything
	                                         else, what ANY-INK takes
*/
import { word } from './words.js';

/** Errors that mean the file on disk is not the one ANY-INK opened. */
const CHANGED_ON_DISK = ['InvalidStateError', 'NoModificationAllowedError', 'FileConflictError'];

/**
 * @param {String} key
 * @param {Object} vars
 * @param {Array<String>} buttons
 * @returns {{key: String, vars: Object, quotes: Array<String>, buttons: Array<String>}}
 */
function say(key, vars = {}, buttons = []) {
	const quotes = Object.keys(vars).filter((name) => ['file', 'folder'].includes(name));
	return { key, vars, quotes, buttons };
}

/**
 * A file's own name, or "your work file" (never a quote) when it has none yet.
 * @param {String} fileName
 * @returns {{vars: Object, named: Boolean}}
 */
function fileVars(fileName) {
	const name = String(fileName ?? '').trim();
	return name
		? { vars: { file: name }, named: true }
		: { vars: { file: word('error.yourWorkFile') }, named: false };
}

/**
 * @param {*} error - what the write threw
 * @param {String} fileName - the work file's name ('Brennan Hand.gs2')
 */
export function saveErrorWords(error, fileName) {
	const { vars, named } = fileVars(fileName);
	const changed = CHANGED_ON_DISK.includes(error?.name);
	const words = changed
		? say('error.changedElsewhere', vars, ['error.button.saveAsNew'])
		: say('error.saveFailed', vars, ['error.button.tryAgain', 'error.button.saveElsewhere']);
	if (!named) words.quotes = [];
	return words;
}

/**
 * @param {String} message - the reader's reason (read_project.js), with its [PFn] code
 * @param {String} fileName
 */
export function openErrorWords(message, fileName) {
	const { vars, named } = fileVars(fileName);
	const newer = /\[PF4\]/.test(String(message ?? ''));
	const words = newer
		? say('error.newerWorkFile', vars, ['error.button.close'])
		: say('error.notWorkFile', vars, ['error.button.openAnother']);
	if (!named) words.quotes = [];
	return words;
}

/**
 * @param {'cancelled' | 'refused'} reason
 * @param {String} [folderName]
 */
export function exportFolderWords(reason, folderName = '') {
	if (reason === 'refused' && folderName) {
		return say('error.folderNotWritable', { folder: folderName }, [
			'error.button.tryAgain',
			'error.button.pickDifferentFolder',
		]);
	}
	return say('error.noFolderPicked', {}, ['error.button.pickFolder']);
}

/**
 * The error itself is the caller's, for the console only; the words never say it.
 */
export function fontFileFailedWords() {
	return say('error.fontFileFailed', {}, ['error.button.tryAgain']);
}

/**
 * The error itself is the caller's, for the console only; the words never say it.
 */
export function fileCommandWords() {
	return say('error.didntFinish', {}, ['error.button.close']);
}

/**
 * @param {String} code - upstream's validate_file_input code ('SVG0', 'SVG1', ...)
 * @param {String} fileName
 */
export function startFileErrorWords(code, fileName) {
	const name = String(fileName ?? '').trim();
	if (/^PF\d$/.test(String(code ?? ''))) return openErrorWords(`[${code}]`, name);
	if (code === 'SVG1' && name)
		return say('error.drawingNotFont', { file: name }, ['error.button.close']);
	if (UNREADABLE_FONT.includes(code) && name)
		return say('error.fontFileUnreadable', { file: name }, ['error.button.close']);
	return say('error.unsupportedFile', {}, ['error.button.close']);
}

/** The file check's codes for a font file it could not read (validate_file_input.js). */
const UNREADABLE_FONT = ['SVG0', 'FF0', 'FF1'];
