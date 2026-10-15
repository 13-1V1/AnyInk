// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: what the screen shows that the Next line must give way to (UX-BEGINNER.md principle 1 and
	4.0). Read from the page itself, so a card, overlay or dialog never has to report itself:
	  - an open dialog: rule 1 (the line is empty; the dialog has its own green button). ANY-INK's
	    dialogs carry data-anyink-dialog="<name>"; upstream's modal (#modal-dialog) and the error
	    box (#error, which Simple's plain error box reuses) count too;
	  - a green button (.anyink-primary, or upstream's green fancy-button) shown anywhere outside
	    the Next line: the line's own button is then outlined (the one-green rule).
	Hidden things don't count: the hidden attribute, data-anyink-hidden, display: none or
	visibility: hidden on the element or any parent.

	  DIALOG_SELECTOR, PRIMARY_SELECTOR, COACH_TAG
	  isShown(element)
	  openDialogName(root)          the open dialog's name ('howCard', 'modal', 'error'), or ''
	  hasOtherPrimary(root)         a shown .anyink-primary outside <anyink-coach>
	  probeScreen(root)             { dialog, otherPrimary }
*/

export const DIALOG_SELECTOR = '[data-anyink-dialog], #modal-dialog, #error';
/**
 * B6 + B7 finalize: upstream's green buttons count too: a fancy-button draws in the accent green
 * unless it is secondary, minimal, danger or disabled ("Back to my letters" on Help and About,
 * the buttons of upstream's own boxes)
 */
export const PRIMARY_SELECTOR =
	'.anyink-primary, fancy-button:not([secondary]):not([minimal]):not([danger]):not([disabled])';
export const COACH_TAG = 'anyink-coach';

/**
 * @param {Element} element
 * @returns {Boolean} false when it or a parent is hidden
 */
export function isShown(element) {
	if (!element?.isConnected) return false;
	const view = element.ownerDocument?.defaultView;
	for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
		if (node.hasAttribute('hidden') || node.hasAttribute('data-anyink-hidden')) return false;
		if (node.tagName === 'DIALOG' && !node.hasAttribute('open') && node.id !== 'modal-dialog') {
			return false;
		}
		const style = view?.getComputedStyle?.(node);
		if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
	}
	return true;
}

/**
 * @param {ParentNode} [root]
 * @returns {String} '' when no dialog is open
 */
export function openDialogName(root = globalThis.document) {
	if (!root?.querySelectorAll) return '';
	const open = [...root.querySelectorAll(DIALOG_SELECTOR)].find(isShown);
	if (!open) return '';
	if (open.hasAttribute('data-anyink-dialog')) {
		return open.getAttribute('data-anyink-dialog') || 'dialog';
	}
	return open.id === 'error' ? 'error' : 'modal';
}

/**
 * @param {ParentNode} [root]
 * @returns {Boolean} a green button shows outside the Next line
 */
export function hasOtherPrimary(root = globalThis.document) {
	if (!root?.querySelectorAll) return false;
	return [...root.querySelectorAll(PRIMARY_SELECTOR)].some(
		(element) => !element.closest(COACH_TAG) && isShown(element)
	);
}

/**
 * @param {ParentNode} [root]
 * @returns {{dialog: String, otherPrimary: Boolean}}
 */
export function probeScreen(root = globalThis.document) {
	return { dialog: openDialogName(root), otherPrimary: hasOtherPrimary(root) };
}
