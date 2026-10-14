// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	How far the edit canvas guide lines reach (B1).
	A letter with no width yet (a new letter, and one he is still drawing: it stays at width 0
	until it is spaced) has no box of its own, so its lines (and a faint right edge) reach at
	least the project's default letter width: a first-timer sees where the letter goes, and the
	first pen click doesn't shrink the lines to stubs. A letter with a width keeps lines as long
	as itself (the larger of its width and its rightmost ink), so its own box reads at a glance.
	A kern pair keeps its own span.
	Pure functions; edit_canvas.js drawSystemGuidelines calls them.
*/

/**
 * True for a letter (glyph, ligature or component) whose width is still 0.
 * @param {Object} item - the item on the edit canvas
 * @returns {Boolean}
 */
export function hasNoWidthYet(item) {
	if (!item || item.objType === 'KernGroup') return false;
	return !(Number(item.advanceWidth) > 0);
}

/**
 * How long the horizontal guide lines are, in font units.
 * @param {Object} item - the item on the edit canvas
 * @param {Number} itemXMax - the larger of the item's width and its rightmost ink
 * @param {Number} defaultWidth - the project's default letter width (project.defaultAdvanceWidth)
 * @returns {Number}
 */
export function guideLineLength(item, itemXMax, defaultWidth) {
	const fallback = Number(defaultWidth);
	if (hasNoWidthYet(item) && fallback > 0) return Math.max(Number(itemXMax) || 0, fallback);
	return itemXMax;
}
