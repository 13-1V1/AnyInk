// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 finalize: the keys a focused range slider owns, so a document-level key route (the sketch
	tools' keys, edit_canvas/events.js) leaves them to it. Pure.

	  SLIDER_KEYS                    the keys a range input moves with
	  sliderOwnsKey(element, event)  the element is a range input and the key is one of those,
	                                 or Esc while it is being dragged (data-anyink-dragging="true":
	                                 the slider takes its drag back)
*/

export const SLIDER_KEYS = Object.freeze(
	new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])
);

/**
 * @param {Element | null} element - usually document.activeElement
 * @param {{key: String}} event
 * @returns {Boolean}
 */
export function sliderOwnsKey(element, event) {
	if (!element || String(element.tagName).toLowerCase() !== 'input') return false;
	if (String(element.type).toLowerCase() !== 'range') return false;
	const key = event?.key;
	if (SLIDER_KEYS.has(key)) return true;
	return key === 'Escape' && element.dataset?.anyinkDragging === 'true';
}
