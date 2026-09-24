// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Manual saves and autosaves share ordering; a failed save never poisons the queue.
const queues = new WeakMap();
const versions = new WeakMap();

export function queueProjectSave(editor, job) {
	const next = (queues.get(editor) || Promise.resolve())
		.catch(() => {})
		.then(() => {
			const locks = globalThis.navigator?.locks;
			return locks ? locks.request('anyink-project-writes', job) : job();
		});
	queues.set(editor, next);
	return next;
}

async function version(handle, sourceFile) {
	if (typeof handle?.getFile !== 'function') return null;
	const file = sourceFile || (await handle.getFile());
	let content = '';
	if (file.arrayBuffer && globalThis.crypto?.subtle) {
		const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
		content = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
			''
		);
	} else if (file.text) {
		// Test doubles may expose text but not Blob/crypto. Real target browsers hash above.
		content = await file.text();
	}
	return `${file.lastModified}:${file.size}:${content}`;
}

export async function rememberFileVersion(editor, handle, sourceFile) {
	const history = editor.history;
	const value = await version(handle, sourceFile);
	if (editor.history === history) versions.set(editor, { handle, history, value });
}

export function savedFileVersion(editor) {
	const state = versions.get(editor);
	return state && state.history === editor.history ? state.value : null;
}

export function adoptFileVersion(editor, handle, value) {
	versions.set(editor, { handle, history: editor.history, value });
}

export async function assertFileUnchanged(editor, handle, requireKnown = false) {
	const previous = versions.get(editor);
	if (!previous || previous.history !== editor.history) {
		if (requireKnown) throw new Error('Click Save to confirm the file before autosave starts.');
		await rememberFileVersion(editor, handle);
		return;
	}
	if (requireKnown && previous.value === null)
		throw new Error('Click Save to confirm the file before autosave starts.');
	const same = previous.handle === handle || (await previous.handle?.isSameEntry?.(handle));
	if (same && previous.value !== null && previous.value !== (await version(handle))) {
		const error = new Error(
			'This file changed in another window. Use Save As to keep both versions.'
		);
		error.name = 'FileConflictError';
		throw error;
	}
}
