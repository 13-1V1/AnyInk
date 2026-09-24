// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Pub/sub wiring for the preview strip.
	Two subscriber ids, neither a substring of the other (upstream's unsubscribe
	matches by substring, D-024):
	  anyink.previewStrip.redraw  - every topic that changes what the strip shows
	  anyink.previewStrip.font    - the few topics that change the exported font
	                                (real-font mode rebuilds on these only)
*/

export const REDRAW_ID = 'anyink.previewStrip.redraw';
export const FONT_ID = 'anyink.previewStrip.font';

export const REDRAW_TOPICS = [
	'currentItem',
	'currentKernGroup',
	'kernPairs',
	'fontMetrics',
	'guides',
	'previewOptions',
	'whichGlyphIsSelected',
];

export const FONT_REBUILD_TOPICS = ['currentItem', 'kernPairs', 'fontMetrics'];

/**
 * Subscribe the strip's two callbacks to an editor.
 * @param {Object} editor - ProjectEditor (needs subscribe / unsubscribe)
 * @param {Object} callbacks
 * @param {Function} callbacks.onRedraw
 * @param {Function} callbacks.onFontChange
 * @returns {Function} unsubscribe from that editor
 */
export function subscribeStrip(editor, { onRedraw, onFontChange }) {
	if (!editor || typeof editor.subscribe !== 'function') return () => {};
	editor.subscribe({ topic: REDRAW_TOPICS, subscriberID: REDRAW_ID, callback: onRedraw });
	editor.subscribe({ topic: FONT_REBUILD_TOPICS, subscriberID: FONT_ID, callback: onFontChange });
	return () => {
		if (typeof editor.unsubscribe !== 'function') return;
		editor.unsubscribe({ idToRemove: REDRAW_ID });
		editor.unsubscribe({ idToRemove: FONT_ID });
	};
}

/**
 * Keeps the strip subscribed to whichever editor is current.
 * @param {Object} callbacks - passed to subscribeStrip
 * @returns {{sync: Function, detach: Function, current: Function}}
 *   sync(editor) subscribes when the editor changed and returns true in that case;
 *   detach() unsubscribes; current() returns the editor subscribed to (or null).
 */
export function makeEditorTracker(callbacks) {
	let editor = null;
	let unsubscribe = () => {};
	return {
		sync(nextEditor) {
			if (!nextEditor || nextEditor === editor) return false;
			unsubscribe();
			editor = nextEditor;
			unsubscribe = subscribeStrip(editor, callbacks);
			return true;
		},
		detach() {
			unsubscribe();
			unsubscribe = () => {};
			editor = null;
		},
		current() {
			return editor;
		},
	};
}
