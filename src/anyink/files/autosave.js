// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize (UX-BEGINNER.md 4.11): while a write of the work file waits its 3 s or runs,
// the save status hears it is queued (markSaveQueued), so Simple says "Saving...". Only a font
// with a work file (.gs2) has a write to queue.
import { saveProjectAutomatically } from './project_files.js';
import { getSaveStatus, markSaveQueued } from './save_status.js';
import { isProjectFileHandle } from './write_file.js';

export const AUTOSAVE_INTERVAL_MS = 3000;
const pending = new WeakMap();
const active = new WeakMap();
const epochs = new WeakMap();

// A maximum interval, not a trailing debounce: continuous edits cannot postpone it.
export function scheduleAutosave(editor) {
	if (pending.has(editor)) return;
	if (isProjectFileHandle(editor?.loadedFileHandle)) markSaveQueued(editor, true);
	pending.set(
		editor,
		setTimeout(() => {
			pending.delete(editor);
			void autosaveNow(editor);
		}, AUTOSAVE_INTERVAL_MS)
	);
}

export function cancelAutosave(editor) {
	clearTimer(editor);
	if (!active.has(editor)) markSaveQueued(editor, false);
}

/** The timer only; a write already running stays queued until it ends. */
function clearTimer(editor) {
	clearTimeout(pending.get(editor));
	pending.delete(editor);
}

export function stopAutosave(editor) {
	cancelAutosave(editor);
	epochs.set(editor, (epochs.get(editor) || 0) + 1);
}

export function autosaveNow(editor) {
	clearTimer(editor);
	const history = editor.history;
	const epoch = epochs.get(editor) || 0;
	const previous = active.get(editor);
	if (previous?.history === history && previous.epoch === epoch) {
		// A glyph switch during a slow save must flush its newer revision immediately
		// after that write, instead of waiting for another three-second interval.
		return previous.job.then((result) => {
			if ((epochs.get(editor) || 0) !== epoch || editor.history !== history) return false;
			return getSaveStatus(editor).file === 'pending' ? autosaveNow(editor) : result;
		});
	}
	const entry = { history, epoch };
	const isCurrent = () => (epochs.get(editor) || 0) === epoch && editor.history === history;
	const job = saveProjectAutomatically(editor, isCurrent).finally(() => {
		if (active.get(editor) === entry) active.delete(editor);
		// nothing waits once this write is over and no timer was set again
		if (!pending.has(editor) && !active.has(editor)) markSaveQueued(editor, false);
		if (
			(epochs.get(editor) || 0) === epoch &&
			editor.history === history &&
			editor.loadedFileHandle &&
			getSaveStatus(editor).file === 'pending'
		) {
			scheduleAutosave(editor);
		}
	});
	entry.job = job;
	active.set(editor, entry);
	return job;
}
