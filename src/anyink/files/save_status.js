// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Per-editor status follows History identity, so opening another project resets it.
// B4 (UX-BEGINNER.md 2.4 G, 4.11): the text says the house words in both modes (Saved,
// Saving..., Not saved yet, Couldn't save, the backup copy), from src/anyink/words (status.*).
// B4 integration: what went wrong (state.error, a browser's or a file writer's own sentence) is
// shown in All tools only; Simple says what to press instead (7.7: plain error messages).
// B4 + B5 fix pass (4.11): Simple says one of four things, Saved / Saving... / Not saved yet /
// Couldn't save, with no word about backup copies (they are silent), and "Saving..." while a
// write is queued (markSaveQueued, set by the autosave) as well as while it runs; the tooltip is
// the status.* hint, what to press (saveStatusWords). All tools keeps the words it had.
// B6 (4.11 "Status pill"): simpleStatusPill adds each Simple state's dot and the button inside
// the top bar's pill (Not saved yet [Save], Couldn't save [Fix]); SIMPLE_PILL lists the four.
import { isSimpleMode } from '../mode/mode.js';
import { word, wordEntry } from '../words/words.js';

const states = new WeakMap();
export const SAVE_STATUS_EVENT = 'anyink-save-status';

export function getSaveStatus(editor) {
	if (!editor) return { revision: 0, file: 'none', recovery: 'none' };
	let state = states.get(editor);
	if (!state || state.history !== editor.history) {
		state = {
			history: editor.history,
			revision: 0,
			file: editor.loadedFileHandle ? 'saved' : 'none',
			recovery: 'none',
			error: '',
			queued: false,
		};
		states.set(editor, state);
	}
	return { ...state };
}

export function setSaveStatus(editor, patch) {
	if (!editor) return;
	states.set(editor, { ...getSaveStatus(editor), ...patch });
	globalThis.dispatchEvent?.(new CustomEvent(SAVE_STATUS_EVENT, { detail: { editor } }));
}

export function markSaveDirty(editor) {
	const state = getSaveStatus(editor);
	setSaveStatus(editor, { revision: state.revision + 1, file: 'pending', recovery: 'pending' });
}

/**
 * The autosave has a write of the work file queued (true) or not (false). Simple says
 * "Saving..." while it waits (4.11: "A file write is queued or running").
 * @param {Object} editor - ProjectEditor
 * @param {Boolean} queued
 */
export function markSaveQueued(editor, queued) {
	if (!editor || !!getSaveStatus(editor).queued === !!queued) return;
	setSaveStatus(editor, { queued: !!queued });
}

const SEPARATOR = ' · ';

/** Simple's four states (4.11), by words key; data-status on the top bar's status. */
const SIMPLE_STATUS = Object.freeze({
	'status.saved': 'saved',
	'status.saving': 'saving',
	'status.notSavedYet': 'not-saved',
	'status.notSavedToFile': 'not-saved',
	'status.couldntSave': 'failed',
});

/**
 * What the save status says, and its tooltip.
 * Simple (4.11): one of Saved, Saving..., Not saved yet, Couldn't save; the tooltip is the
 * key's hint (what to press). All tools: today's text, the backup copy and what went wrong
 * included, and the same text as its tooltip.
 * @param {Object} state - getSaveStatus()
 * @param {Object} [context]
 * @param {Boolean} [context.simple] - default: the mode
 * @param {Boolean} [context.workFile] - the font has a work file (.gs2) to write; default: the
 *   status has heard of one
 * @returns {{key: String, status: String, text: String, hint: String}} key and status are ''
 *   in All tools
 */
export function saveStatusWords(
	state,
	{ simple = isSimpleMode(), workFile = !!state && state.file !== 'none' } = {}
) {
	if (!simple) {
		const text = allToolsText(state);
		return { key: '', status: '', text, hint: text };
	}
	let key = workFile ? 'status.notSavedToFile' : 'status.notSavedYet';
	if (state?.file === 'saved') key = 'status.saved';
	else if (state?.file === 'saving') key = 'status.saving';
	else if (state?.file === 'failed') key = 'status.couldntSave';
	else if (workFile && state?.queued) key = 'status.saving';
	return { key, status: SIMPLE_STATUS[key], text: word(key), hint: wordEntry(key).hint };
}

/**
 * B6 (4.11 "Status pill"): each of Simple's four states, its dot (a token, so the color is the
 * theme's) and what the button inside the pill does: 'save' (Not saved yet [Save]), 'fix'
 * (Couldn't save [Fix]), or null. The words always say the state, so the dot is never alone.
 */
export const SIMPLE_PILL = Object.freeze({
	saved: Object.freeze({ dot: '--touch', action: null, buttonKey: '' }),
	saving: Object.freeze({ dot: '--chrome-text-muted', action: null, buttonKey: '' }),
	'not-saved': Object.freeze({ dot: '--warning', action: 'save', buttonKey: 'term.save' }),
	failed: Object.freeze({ dot: '--danger', action: 'fix', buttonKey: 'topbar.status.fix' }),
});

/**
 * B6: the Simple top bar's status pill: saveStatusWords in Simple, plus its dot and button.
 * @param {Object} state - getSaveStatus()
 * @param {{workFile?: Boolean}} [context] - see saveStatusWords
 * @returns {{key: String, status: String, text: String, hint: String, dot: String,
 *   button: {key: String, action: 'save' | 'fix', text: String} | null}}
 */
export function simpleStatusPill(state, { workFile } = {}) {
	const words = saveStatusWords(state, {
		simple: true,
		...(workFile === undefined ? {} : { workFile }),
	});
	const pill = SIMPLE_PILL[words.status];
	const button = pill.action
		? { key: pill.buttonKey, action: pill.action, text: word(pill.buttonKey) }
		: null;
	return { ...words, dot: pill.dot, button };
}

/**
 * @param {Object} state - getSaveStatus()
 * @param {Object} [context] - see saveStatusWords
 * @returns {String}
 */
export function saveStatusText(state, context) {
	return saveStatusWords(state, context).text;
}

/** All tools: the work file, the backup copy and what went wrong, as before. */
function allToolsText(state) {
	const copy = word(
		state.recovery === 'saved'
			? 'status.backupKept'
			: state.recovery === 'failed'
			? 'status.backupFailed'
			: 'status.noBackupYet'
	);
	const say = (...parts) => parts.filter(Boolean).join(SEPARATOR);
	const error = state.error;
	if (state.file === 'saved') return word('status.saved');
	if (state.file === 'saving') return say(word('status.saving'), copy);
	if (state.file === 'failed')
		return say(word('status.couldntSave'), copy, error || word('status.tryAgain'));
	if (state.file === 'none' && state.recovery === 'none') return word('status.notSavedYet');
	const notSaved = state.file === 'none' ? 'status.notSavedYet' : 'status.changesNotSaved';
	return say(copy, error || word(notSaved));
}
