// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// No app imports: exercised independently of editor boot and service workers.
// B4 integration: the update notice shows these errors as its sentence, so they are house words
// (src/anyink/words, notice.*; UX-BEGINNER.md 2.4 G: "backup copy", never "recovery snapshot").
import { word } from '../words/words.js';

export async function checkpoint({ getEditors, getStatus, snapshot }) {
	const before = getStatus();
	if (!before.started) throw new Error(word('notice.backupStarting'));
	const editors = [...getEditors()];
	for (const editor of editors) {
		if (editor.history?.isRestoring) throw new Error(word('notice.undoRunning'));
		if (!(await snapshot('manual', editor))) {
			throw new Error(word('notice.backupNotEvery'));
		}
	}
	const unchanged = () => {
		const current = getEditors();
		return (
			getStatus().generation === before.generation &&
			current.length === editors.length &&
			current.every((editor, i) => editor === editors[i]) &&
			getStatus()
				.sessions.map((session) => session.key)
				.join('|') === before.sessions.map((session) => session.key).join('|') &&
			!editors.some((editor) => editor.history?.isRestoring)
		);
	};
	if (!unchanged()) throw new Error(word('notice.changedDuringBackup'));
	return unchanged;
}

export function makeSafeReload({ protect, activate, reload }) {
	let busy = false;
	return async () => {
		if (busy) return false;
		busy = true;
		try {
			const unchanged = await protect();
			await activate();
			if (!unchanged()) throw new Error(word('notice.changedBeforeReload'));
			reload();
			return true;
		} finally {
			busy = false;
		}
	};
}
