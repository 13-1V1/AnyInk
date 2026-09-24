// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { saveProjectAutomatically } from './project_files.js';
import { getSaveStatus } from './save_status.js';

export const AUTOSAVE_INTERVAL_MS = 3000;
const pending = new WeakMap();
const active = new WeakMap();
const epochs = new WeakMap();

// A maximum interval, not a trailing debounce: continuous edits cannot postpone it.
export function scheduleAutosave(editor) {
	if (pending.has(editor)) return;
	pending.set(
		editor,
		setTimeout(() => {
			pending.delete(editor);
			void autosaveNow(editor);
		}, AUTOSAVE_INTERVAL_MS)
	);
}

export function cancelAutosave(editor) {
	clearTimeout(pending.get(editor));
	pending.delete(editor);
}

export function stopAutosave(editor) {
	cancelAutosave(editor);
	epochs.set(editor, (epochs.get(editor) || 0) + 1);
}

export function autosaveNow(editor) {
	cancelAutosave(editor);
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
