// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com

// No app imports: exercised independently of editor boot and service workers.
export async function checkpoint({ getEditors, getStatus, snapshot }) {
	const before = getStatus();
	if (!before.started) throw new Error('Recovery is still starting. Try again shortly.');
	const editors = [...getEditors()];
	for (const editor of editors) {
		if (editor.history?.isRestoring) throw new Error('Wait for undo or redo to finish.');
		if (!(await snapshot('manual', editor))) {
			throw new Error('Recovery could not protect every project. Save your work and try again.');
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
	if (!unchanged())
		throw new Error('A project changed while saving recovery. Try the update again.');
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
			if (!unchanged())
				throw new Error('A project changed. Try the update again to protect the latest edits.');
			reload();
			return true;
		} finally {
			busy = false;
		}
	};
}
