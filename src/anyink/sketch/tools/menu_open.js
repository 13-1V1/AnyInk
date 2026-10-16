// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 fix track (layer wiring): is a menu, dropdown or dialog open over the letter? While one is,
	a key belongs to it, not to the sketch tool: Esc closes the Menu and leaves the open piece
	open (and the tool picked), Enter is the dialog's (events.js routeSketchKey asks here first).

	What counts, shown only:
	  - Simple's Menu and upstream's context menus  (#context-menu: makeContextMenu's <dialog>,
	    shown by its style with no open attribute, so coach/dom_probe.js isShown's dialog rule
	    would call it hidden; only its style counts here)
	  - upstream's dropdowns                          (nav: closeAllNavMenus takes every nav)
	  - an option chooser that is deployed            (option-chooser[deployed])
	  - a dialog: ANY-INK's (data-anyink-dialog), upstream's modal and error box, an open
	    <dialog>                                     (dom_probe.js DIALOG_SELECTOR, isShown)

	  menuOrDialogOpen(root?)    true while one shows
	  MENU_SELECTOR, OPEN_SELECTOR
*/
import { DIALOG_SELECTOR, isShown } from '../../coach/dom_probe.js';

/** Shown by their style alone */
export const MENU_SELECTOR = ['#context-menu', 'nav', 'option-chooser[deployed]'].join(', ');

/** Shown by dom_probe.js isShown */
export const OPEN_SELECTOR = ['dialog[open]', DIALOG_SELECTOR].join(', ');

/**
 * @param {Element} element
 * @returns {Boolean} in the page, and neither it nor a parent hidden by attribute or style
 */
function styleShown(element) {
	if (!element?.isConnected) return false;
	const view = element.ownerDocument?.defaultView;
	for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
		if (node.hasAttribute('hidden') || node.hasAttribute('data-anyink-hidden')) return false;
		const style = view?.getComputedStyle?.(node);
		if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
	}
	return true;
}

/**
 * @param {ParentNode} [root]
 * @returns {Boolean}
 */
export function menuOrDialogOpen(root = globalThis.document) {
	if (!root?.querySelectorAll) return false;
	if ([...root.querySelectorAll(MENU_SELECTOR)].some(styleShown)) return true;
	return [...root.querySelectorAll(OPEN_SELECTOR)].some(isShown);
}
