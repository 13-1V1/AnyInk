// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 fix pass: the Point pen's shape that is still open (UX-BEGINNER.md 4.3 Tools, D-036
	"The Point pen in Simple"). In Simple every click places a point and is its own Undo step, so
	between the first click and "Finish the shape" (or a click on the first point) the letter has
	ink that isn't a letter yet. The font check waits on the same signal (fontcheck/font_check.js
	isDrawingAShape); the coach uses it so a half-drawn letter is never "Ready" or "looks done".

	The signal is the Point pen's own: editor.eventHandlers.tool_addPath.newPath, the shape it is
	drawing, or false. That shape names its letter (parent), so the open letter is the one being
	drawn only when the shape belongs to it. Pure: reading never changes the font.

	  openPathOf(editor)    the Path itself, or null (board/letter_set.js leaves it out of the
	                        letter's ink: B6 + B7 finalize, one rule for the rail, the Next line,
	                        the card and the overlay)
	  openShapeOf(editor)   { itemId, points } while the Point pen has a shape open, else null
*/

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Object | null} the Path the Point pen is still drawing
 */
export function openPathOf(editor) {
	const shape = editor?.eventHandlers?.tool_addPath?.newPath;
	return shape && typeof shape === 'object' ? shape : null;
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {{itemId: String, points: Number} | null}
 */
export function openShapeOf(editor) {
	const shape = openPathOf(editor);
	if (!shape) return null;
	const itemId = shape.parent?.id;
	if (typeof itemId !== 'string' || !itemId) return null;
	const points = Array.isArray(shape.pathPoints) ? shape.pathPoints.length : 0;
	return { itemId, points };
}
