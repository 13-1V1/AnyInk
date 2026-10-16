// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 spacing: the photo moves with the letter (UX-BEGINNER 7.2). Whenever spacing moves the
	shapes sideways (a fit, a refit, a left-edge drag, the letter-spacing slider),
	item.anyink.trace.x moves by the same amount in the same change, so the faint photo stays
	under the ink and Trace again traces the right spot. A locked photo moves too: locking only
	stops him dragging it by accident.

	S3 (docs/SKETCH.md section 7): the sketch moves with the shapes too, so a refit inside a step
	leaves the sketch and its built ink in step and the next step never sets the sketch aside.
	The engine stays pure (imports.test.js): sketch/follow.js hands its follow in when it loads
	(setShapesFollower), and every move of the letter's own shapes calls it with the move.

	  moveSideways(item, dx)          shapes, photo and sketch together (what spacing uses)
	  followShapes(item, dx)          the photo and the sketch, after something else moved the
	                                  letter's own shapes (a left-edge drag)
	  followSketchOnly(item, dx)      the sketch only (S3 integration: All tools' left-edge drag,
	                                  where the photo stays as before)
	  followPhoto(item, dx)           the photo only: the ink moved but the letter's own shapes
	                                  didn't (a part made from another letter moved with it)
	  followLeftEdge(item, xMinBefore) the photo and sketch catch up with wherever the ink went
	                                  (for code that sets item.leftSideBearing, which moves the
	                                  shapes itself); returns how far it moved
	  setShapesFollower(fn)           (item, dx) => void, called after the letter's own shapes moved
	                                  sideways; null takes it away
	A damaged photo record (no image, no size) is left exactly as it is.
*/
import { getTrace, moveTrace, setTrace } from '../trace/trace_model.js';
import { inkBounds } from './measure.js';

/** @type {Function | null} the sketch's follow (sketch/follow.js) */
let follower = null;

/** @param {Function | null} fn - (item, dx) => void */
export function setShapesFollower(fn) {
	follower = typeof fn === 'function' ? fn : null;
}

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
	follower?.(item, move);
	return followPhoto(item, move);
}

/**
 * S3 integration: only the sketch follows (All tools' left-edge drag moves the shapes; the photo
 * stays as before there, but a sketch must move with its ink or the next step sets it aside).
 * @param {Object} item - Glyph
 * @param {Number} dx - font units
 */
export function followSketchOnly(item, dx) {
	const move = Number(dx);
	if (!Number.isFinite(move) || move === 0) return;
	follower?.(item, move);
}

/**
 * @param {Object} item - Glyph
 * @param {Number} dx - font units
 * @returns {Boolean} true when the photo moved
 */
export function followPhoto(item, dx) {
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
