// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK trace layer: which clipboard a Ctrl+V means (Milestone 7 fix track, finalize).

	Copying shapes fills the internal shape clipboard (editor.clipboard), which upstream
	pasted on every Ctrl+V from then on, so a photo copied later never reached the trace
	layer. The rule:
	- Every shape copy (Ctrl+C and both Copy buttons all run clipboardCopy in
	  project_editor/actions.js) also writes a short note to the system clipboard
	  (SHAPES_ON_CLIPBOARD_TEXT). It replaces whatever was there, so an image copied BEFORE
	  the shapes can never win later.
	- Copying anything outside ANY-INK means the window lost focus after the shape copy.
	  While it has not, nothing newer can be on the system clipboard, so Ctrl+V pastes the
	  shapes right away (no clipboard read, no permission prompt).
	- Once it has, an image on the system clipboard is newer than the shapes and wins.
	- If the note could not be written (the browser refused it), an image there may be
	  older than the shapes, so the shapes win, as upstream did. A photo still comes in by a
	  drop or the Trace panel's "Choose an image...".

	The note state lives here, keyed by the clipboard object, so nothing extra rides in
	editor.clipboard. No imports, so project_editor/actions.js and the canvas paste hook
	(src/edit_canvas/events_drag_drop_paste.js) can both use it without a cycle.
*/

/**
 * The note a shape copy leaves on the system clipboard.
 * @param {Number} count - how many shapes were copied
 * @returns {String} e.g. '2 shapes copied in ANY-INK'
 */
export const SHAPES_ON_CLIPBOARD_TEXT = (count) =>
	count === 1 ? '1 shape copied in ANY-INK' : `${count} shapes copied in ANY-INK`;

/** editor.clipboard object -> 'pending' | 'written' | 'failed' */
const notes = new WeakMap();

/** The internal clipboard as it was when the window last lost focus. */
let clipboardAtLastBlur = null;

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Boolean} true when shapes were copied (Ctrl+C or a Copy button)
 */
export function hasCopiedShapes(editor) {
	return !!editor?.clipboard?.shapes?.length;
}

/**
 * Call right after a shape copy (clipboardCopy does). Replaces whatever the system
 * clipboard held with a short note, so an older image there can never beat the shapes.
 * @param {Object} [editor] - ProjectEditor whose clipboard was just filled
 * @param {Object} [systemClipboard] - navigator.clipboard (tests pass a fake)
 */
export function noteShapeCopy(editor, systemClipboard = globalThis.navigator?.clipboard) {
	const clipboard = editor?.clipboard;
	const count = clipboard?.shapes?.length;
	if (!count) return;
	if (typeof systemClipboard?.writeText !== 'function') {
		notes.set(clipboard, 'failed');
		return;
	}
	notes.set(clipboard, 'pending');
	const settle = (state) => {
		if (notes.get(clipboard) === 'pending') notes.set(clipboard, state);
	};
	try {
		Promise.resolve(systemClipboard.writeText(SHAPES_ON_CLIPBOARD_TEXT(count))).then(
			() => settle('written'),
			() => settle('failed')
		);
	} catch {
		notes.set(clipboard, 'failed');
	}
}

/**
 * The window lost focus: anything copied from here on happened after the shapes.
 * @param {Object} [editor] - the current ProjectEditor
 */
export function noteWindowBlur(editor) {
	clipboardAtLastBlur = editor?.clipboard || null;
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Boolean} true when something on the system clipboard may be newer than the
 *   copied shapes: no shapes were copied, or the note is on the system clipboard and the
 *   window lost focus since
 */
export function systemClipboardMayBeNewer(editor) {
	if (!hasCopiedShapes(editor)) return true;
	const note = notes.get(editor.clipboard);
	if (note !== 'written' && note !== 'pending') return false;
	return editor.clipboard === clipboardAtLastBlur;
}
