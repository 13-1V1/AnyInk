// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 spacing: the photo moves with the letter (UX-BEGINNER 7.2). Whenever spacing moves the
	shapes sideways (a fit, a refit, a left-edge drag, the letter-spacing slider),
	item.anyink.trace.x moves by the same amount in the same change, so the faint photo stays
	under the ink and Trace again traces the right spot. A locked photo moves too: locking only
	stops him dragging it by accident.

	  moveSideways(item, dx)          shapes and photo together (what spacing uses)
	  followShapes(item, dx)          the photo only, after something else moved the shapes
	  followLeftEdge(item, xMinBefore) the photo catches up with wherever the ink went (for
	                                  code that sets item.leftSideBearing, which moves the
	                                  shapes itself); returns how far it moved
	A damaged photo record (no image, no size) is left exactly as it is.
*/
import { getTrace, moveTrace, setTrace } from '../trace/trace_model.js';
import { inkBounds } from './measure.js';

/**
 * @param {Object} item - Glyph
 * @param {Number} dx - font units, positive to the right
 * @returns {Boolean} true when something moved
 */
export function moveSideways(item, dx) {
	const move = Number(dx);
	if (!item || !Number.isFinite(move) || move === 0) return false;
	const shapes = item.shapes || [];
	shapes.forEach((shape) => {
		shape.updateShapePosition?.(move, 0);
		shape.changed?.();
	});
	if (shapes.length) item.changed?.();
	const photo = followShapes(item, move);
	return shapes.length > 0 || photo;
}

/**
 * @param {Object} item - Glyph
 * @param {Number} dx - font units
 * @returns {Boolean} true when the photo moved
 */
export function followShapes(item, dx) {
	const move = Number(dx);
	if (!Number.isFinite(move) || move === 0) return false;
	const trace = getTrace(item);
	if (!trace) return false;
	return setTrace(item, moveTrace(trace, move, 0));
}

/**
 * @param {Object} item - Glyph
 * @param {Number} xMinBefore - where the ink started before the shapes were moved
 * @returns {Number} how far the photo moved (0 when the ink didn't move or there is none)
 */
export function followLeftEdge(item, xMinBefore) {
	const bounds = inkBounds(item);
	const before = Number(xMinBefore);
	if (!bounds || !Number.isFinite(before)) return 0;
	const dx = bounds.xMin - before;
	if (!dx) return 0;
	followShapes(item, dx);
	return dx;
}
