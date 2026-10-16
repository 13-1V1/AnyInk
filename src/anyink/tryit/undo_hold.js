// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 fix pass: Undo and Redo wait while a Try it drag is held (the gap handle, the letter-spacing
	slider). A whole-font Undo puts a new font object on the editor; a drag that began on the old
	one would write its step on the wrong font, or throw half way through it. So while the pointer
	is down, Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z do nothing; they work again on release.

	  isUndoKey(event)          Ctrl / Cmd + Z or Y
	  holdUndoKeys({ win })     blocks them on win (capture, ahead of the app's own key handler);
	                            returns the release function (safe to call twice)
*/

/**
 * @param {KeyboardEvent} event
 * @returns {Boolean}
 */
export function isUndoKey(event) {
	if (!event || !(event.ctrlKey || event.metaKey)) return false;
	const key = String(event.key || '').toLowerCase();
	return key === 'z' || key === 'y';
}

/**
 * @param {{win?: Window}} [options]
 * @returns {Function} release
 */
export function holdUndoKeys({ win = globalThis } = {}) {
	const block = (event) => {
		if (!isUndoKey(event)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
	};
	win.addEventListener?.('keydown', block, true);
	let held = true;
	return () => {
		if (!held) return;
		held = false;
		win.removeEventListener?.('keydown', block, true);
	};
}
