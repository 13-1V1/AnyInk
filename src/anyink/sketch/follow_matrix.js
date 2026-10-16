// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 7 "Moves made by other features"): the matrix of a follow plan.
	Pure. A matrix is [a, b, c, d, e, f], the canvas / SVG order:
	  x' = a * x + c * y + e
	  y' = b * x + d * y + f
	The moves other features make are all level and plumb (spacing, line shifts, Sit on the line,
	Match size, Shrink to fit, Flip), so c and b are 0 in practice; the helpers still read them.

	  IDENTITY
	  translate(dx, dy)
	  scaleAbout(kx, ky, ox, oy)      scale from the point (ox, oy)
	  flipLeftRight(mid)              x' = 2 * mid - x
	  flipUpsideDown(mid)             y' = 2 * mid - y
	  fromFixPlan({ k, ox, oy, dx, dy })   B11's plan (checks/fix_shapes.js): x' = ox + (x - ox)
	                                  * k + dx, y' = oy + (y - oy) * k + dy
	  matrixOf(value)                 a matrix from a matrix, or null for anything else
	  apply(m, [x, y])                the point moved
	  invert(m)                       the matrix back, or null when it has none
	  isIdentity(m), isTranslation(m), mirrors(m) (it turns the plane over: det < 0)
	  scaleOf(m)                      how much a length grows (the square root of |det|)
	  turnDir(m, degrees)             a direction moved by the matrix, degrees in [0, 360)
*/

export const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);

const EPSILON = 1e-9;

/** @returns {Array<Number>} */
export function translate(dx = 0, dy = 0) {
	return [1, 0, 0, 1, Number(dx) || 0, Number(dy) || 0];
}

/** @returns {Array<Number>} */
export function scaleAbout(kx, ky = kx, ox = 0, oy = 0) {
	return [kx, 0, 0, ky, ox - ox * kx, oy - oy * ky];
}

/** @returns {Array<Number>} */
export function flipLeftRight(mid = 0) {
	return [-1, 0, 0, 1, 2 * mid, 0];
}

/** @returns {Array<Number>} */
export function flipUpsideDown(mid = 0) {
	return [1, 0, 0, -1, 0, 2 * mid];
}

/**
 * @param {{k?: Number, ox?: Number, oy?: Number, dx?: Number, dy?: Number}} plan
 * @returns {Array<Number> | null}
 */
export function fromFixPlan(plan) {
	if (!plan) return null;
	const { k = 1, ox = 0, oy = 0, dx = 0, dy = 0 } = plan;
	if (![k, ox, oy, dx, dy].every(Number.isFinite)) return null;
	return [k, 0, 0, k, ox - ox * k + dx, oy - oy * k + dy];
}

/**
 * @param {*} value
 * @returns {Array<Number> | null}
 */
export function matrixOf(value) {
	if (!Array.isArray(value) || value.length !== 6) return null;
	const m = value.map(Number);
	return m.every(Number.isFinite) ? m : null;
}

/** @returns {[Number, Number]} */
export function apply(m, [x, y]) {
	return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** @returns {Array<Number> | null} */
export function invert(m) {
	const det = m[0] * m[3] - m[1] * m[2];
	if (Math.abs(det) < EPSILON) return null;
	const a = m[3] / det;
	const b = -m[1] / det;
	const c = -m[2] / det;
	const d = m[0] / det;
	return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

/** @returns {Boolean} */
export function isIdentity(m) {
	return isTranslation(m) && Math.abs(m[4]) < EPSILON && Math.abs(m[5]) < EPSILON;
}

/** @returns {Boolean} */
export function isTranslation(m) {
	return (
		Math.abs(m[0] - 1) < EPSILON &&
		Math.abs(m[1]) < EPSILON &&
		Math.abs(m[2]) < EPSILON &&
		Math.abs(m[3] - 1) < EPSILON
	);
}

/** @returns {Boolean} */
export function mirrors(m) {
	return m[0] * m[3] - m[1] * m[2] < 0;
}

/** @returns {Number} */
export function scaleOf(m) {
	return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

/**
 * @param {Array<Number>} m
 * @param {Number} degrees
 * @returns {Number} in [0, 360)
 */
export function turnDir(m, degrees) {
	const r = (Number(degrees) * Math.PI) / 180;
	const x = Math.cos(r);
	const y = Math.sin(r);
	const turned = (Math.atan2(m[1] * x + m[3] * y, m[0] * x + m[2] * y) * 180) / Math.PI;
	const out = ((turned % 360) + 360) % 360;
	const rounded = Math.round(out * 1e9) / 1e9;
	return rounded === 360 ? 0 : rounded;
}
