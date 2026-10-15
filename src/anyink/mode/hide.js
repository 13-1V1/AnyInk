// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5: hiding a control the mode doesn't show, where the element itself has to stay (UX-BEGINNER.md
	6.3: screens filter where they are drawn). Most screens just leave a hidden control out; a
	page maker that finds its chooser buttons by id (characters.js #nav-button-l1) needs them
	there, so those are drawn with the mark below, which hide.css turns into display: none.

	  HIDDEN_ATTRIBUTE        'data-anyink-hidden'
	  hiddenAttributes(hide)  ' hidden data-anyink-hidden' (or '') for an HTML template
	  hideElement(element)    marks an element hidden; returns it
*/
import './hide.css';

export const HIDDEN_ATTRIBUTE = 'data-anyink-hidden';

/**
 * @param {Boolean} hide
 * @returns {String} attributes to put in an element's opening tag
 */
export function hiddenAttributes(hide) {
	return hide ? ` hidden ${HIDDEN_ATTRIBUTE}` : '';
}

/**
 * @template {Element} T
 * @param {T} element
 * @returns {T}
 */
export function hideElement(element) {
	element?.setAttribute?.('hidden', '');
	element?.setAttribute?.(HIDDEN_ATTRIBUTE, '');
	return element;
}
