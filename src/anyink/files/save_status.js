// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Per-editor status follows History identity, so opening another project resets it.
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

export function saveStatusText(state) {
	const copy =
		state.recovery === 'saved'
			? 'Recovery copy saved'
			: state.recovery === 'failed'
			? 'Recovery failed'
			: 'Not yet protected';
	if (state.file === 'saved') return 'Saved to file';
	if (state.file === 'saving') return `Saving… · ${copy}`;
	if (state.file === 'failed')
		return `Save failed · ${copy} · ${state.error || 'Use Save to retry'}`;
	if (state.file === 'none' && state.recovery === 'none') return 'Not saved to a file';
	return `${copy} · ${state.error || 'File changes pending'}`;
}
