// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 fix: which shape the Point pen is drawing, after an Undo or a Redo. In Simple every
	point is its own Undo step, and Simple's Undo and Redo write the letter back as new objects
	(history/item_state.js writeItemState), so the shape the pen held is no longer in the letter.
	The same shape is the one at the same place in the letter's shape list, a point shorter
	(Undo) or longer (Redo), its points where they were. Automatic spacing slides the whole letter
	sideways at each step (B3), so the points are compared from the shape's first point.

	Pure (no app state; the Point pen, edit_canvas/tools/new_path.js, does the rest):
	  shapePlace(path, { pressing })   { itemID, index, outline }: the letter it was in, its place
	                          in that letter's list, and its points measured from its first
	                          point; pressing: a press is still placing the last point, which no
	                          step holds yet, so it is left out (B6 + B7 finalize)
	  shapeAtPlace(item, place, { exact })   the shape now at that place when it is the same
	                          shape: one point more or fewer, the rest where they were; exact:
	                          the very same points (a shape Redo brings back whole), else null
*/

/**
 * Points this close (font units) are the same point. B6 + B7 finalize: B3 rounds every point to a
 * whole unit at the first step where the shape has an area (spacing/round.js), so measured from
 * the first point an offset can move by up to 1 unit (each end rounded by up to half a unit):
 * at 0.5 the pen let go of its own shape after that Undo in about half of first shapes.
 */
const SAME_POINT = 1.5;

/**
 * @param {Object} path - Path
 * @returns {Array<Array<Number>>} its points measured from its first point
 */
function outlineOf(path) {
	const points = Array.isArray(path?.pathPoints) ? path.pathPoints : [];
	if (!points.length) return [];
	const { x, y } = points[0].p;
	return points.map((point) => [point.p.x - x, point.p.y - y]);
}

/**
 * @param {Object} path - Path (the shape the pen holds)
 * @param {{pressing?: Boolean}} [options]
 * @returns {{itemID: String | null, index: Number, outline: Array<Array<Number>>}}
 */
export function shapePlace(path, { pressing = false } = {}) {
	const item = path?.parent;
	const index = Array.isArray(item?.shapes) ? item.shapes.indexOf(path) : -1;
	const outline = outlineOf(path);
	return { itemID: item?.id || null, index, outline: pressing ? outline.slice(0, -1) : outline };
}

/**
 * @param {Array<Array<Number>>} a
 * @param {Array<Array<Number>>} b
 * @param {Boolean} exact - the same number of points
 * @returns {Boolean} the shorter is the start of the longer
 */
function sameOutline(a, b, exact) {
	if (!a.length || !b.length) return false;
	if (exact ? a.length !== b.length : Math.abs(a.length - b.length) > 1) return false;
	const count = Math.min(a.length, b.length);
	for (let i = 0; i < count; i++) {
		if (Math.abs(a[i][0] - b[i][0]) > SAME_POINT || Math.abs(a[i][1] - b[i][1]) > SAME_POINT) {
			return false;
		}
	}
	return true;
}

/**
 * @param {Object} item - Glyph (the open letter)
 * @param {{itemID: String | null, index: Number, outline: Array}} place - from shapePlace
 * @param {Object} [options]
 * @param {Boolean} [options.exact]
 * @returns {Object | null} the Path at that place when it is the same shape
 */
export function shapeAtPlace(item, place, { exact = false } = {}) {
	if (!item || !place || place.index < 0 || !place.itemID || item.id !== place.itemID) return null;
	const shape = Array.isArray(item.shapes) ? item.shapes[place.index] : null;
	if (shape?.objType !== 'Path') return null;
	return sameOutline(outlineOf(shape), place.outline, exact) ? shape : null;
}
