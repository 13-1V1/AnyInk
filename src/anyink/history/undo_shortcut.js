// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Pure decisions behind the undo / redo keyboard shortcuts, so they can work
	on every page (not only the edit canvas) and be unit tested without a DOM
	event.
**/

/** Elements whose typing must never be stolen by app shortcuts */
const TEXT_ENTRY_TAGS = ['input', 'textarea', 'input-number', 'option-chooser', 'option-toggle'];

/**
 * <input> types that type nothing: a range slider, a toggle and the buttons. With one of them
 * focused the app keeps its keys (B4 + B5 finalize: the strip's Real font and Guide lines
 * toggles are checkboxes, and every app key went dead once one had been clicked).
 */
const INPUTS_THAT_TYPE_NOTHING = ['range', 'checkbox', 'button', 'submit', 'reset'];

/**
 * Elements that are contenteditable for a technical reason only: the edit
 * canvas turns it on so raw SVG can be pasted onto it. Shortcuts must keep
 * working while it has focus.
 */
const EDITABLE_BUT_NOT_TEXT = ['edit-canvas', 'canvas'];

/**
 * True when keyboard input belongs to the element (a text field or a real
 * contenteditable region), so shortcuts should stay out of the way.
 * @param {Element | null} element - usually document.activeElement
 * @returns {Boolean}
 */
export function isTextEntryElement(element) {
	if (!element || typeof element.tagName !== 'string') return false;
	const tag = element.tagName.toLowerCase();
	// A range slider keeps focus after a drag; it types nothing, so shortcuts stay live.
	// (Slider rows own their arrow / Home / End keys with stopPropagation.) So do a checkbox
	// and the button inputs (B4 + B5 finalize).
	if (tag === 'input' && INPUTS_THAT_TYPE_NOTHING.includes(String(element.type).toLowerCase()))
		return false;
	if (TEXT_ENTRY_TAGS.includes(tag)) return true;
	if (EDITABLE_BUT_NOT_TEXT.includes(tag)) return false;

	const attribute =
		typeof element.getAttribute === 'function' ? element.getAttribute('contenteditable') : null;
	if (attribute !== null && attribute !== undefined) {
		const value = String(attribute).toLowerCase();
		return value === '' || value === 'true' || value === 'plaintext-only';
	}
	return element.isContentEditable === true;
}

/**
 * Decides whether a key press means undo or redo.
 * Ctrl+Z undo; Ctrl+Y or Ctrl+Shift+Z redo; the dedicated Undo / Redo keys
 * (some keyboards have them) work without a modifier.
 * @param {String} key - normalized key from getKeyFromEvent (single chars lowercased)
 * @param {Object} modifiers - { isCtrlDown, isShiftDown }
 * @returns {'undo' | 'redo' | false}
 */
export function getUndoRedoAction(key, { isCtrlDown = false, isShiftDown = false } = {}) {
	if (key === 'Redo') return 'redo';
	if (key === 'Undo') return 'undo';
	if (!isCtrlDown) return false;
	if (key === 'y' || key === 'Y') return 'redo';
	if (key === 'z' || key === 'Z') return isShiftDown ? 'redo' : 'undo';
	return false;
}
