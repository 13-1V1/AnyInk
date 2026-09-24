// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK: a press on the edit canvas takes the keyboard back (Milestone 7 finalize).

	Upstream cancels the canvas's mousedown (no text selection, no drag ghost), which also
	keeps the browser from moving focus. So a panel checkbox, slider, button or text field
	used before kept the keyboard after a click on the canvas: undo, save, the arrow nudges,
	tool keys and paste went to it, and Space flipped the checkbox. The canvas mouse
	handler (src/edit_canvas/events_mouse.js) calls releaseFocus() on every press, so the
	page body has the keyboard again, the way a click on empty space works anywhere else.

	Looks inside open shadow roots: upstream's number fields keep their <input> there, and
	blurring the host alone does not blur it. Nothing runs at import time.
*/

/**
 * @param {Document} [doc]
 * @returns {Element | null} the element that really has focus, inside shadow roots too
 */
export function deepActiveElement(doc = globalThis.document) {
	let active = doc?.activeElement || null;
	while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
	return active;
}

/**
 * Blurs whatever holds the keyboard, so the page body gets it back.
 * @param {Document} [doc]
 * @returns {Boolean} true when something let go of the focus
 */
export function releaseFocus(doc = globalThis.document) {
	const active = deepActiveElement(doc);
	if (!active || active === doc?.body || active === doc?.documentElement) return false;
	if (typeof active.blur !== 'function') return false;
	try {
		active.blur();
	} catch (error) {
		console.warn('ANY-INK: could not take the keyboard back from a control', error);
		return false;
	}
	return true;
}
