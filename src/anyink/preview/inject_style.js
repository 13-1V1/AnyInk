// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Adds a <style> block to a document once. Light-DOM components use this instead of
	a shadow stylesheet so upstream's input-focus checks and resets still apply to them.
*/

/**
 * @param {String} id - element id; a second call with the same id is a no-op
 * @param {String} css - stylesheet text (tokens only, no color literals)
 * @param {Document} [doc]
 * @returns {HTMLStyleElement|null}
 */
export function injectStyleOnce(id, css, doc = document) {
	if (!doc?.head) return null;
	const existing = doc.getElementById(id);
	if (existing) return /** @type {HTMLStyleElement} */ (existing);
	const style = doc.createElement('style');
	style.id = id;
	style.textContent = css;
	doc.head.appendChild(style);
	return style;
}
