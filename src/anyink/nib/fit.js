// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush: fit-curve (vendor/fit_curve.js, Schneider's method) called with a tolerance in font
	units. fit-curve takes a squared tolerance E, and it only tries to improve a curve's fit
	(Newton steps on the points' places along it) when the curve is already within E squared; for
	E below 1 that is almost never, so it cuts the line into many more curves than it needs.
	Schneider's own method tries whenever the curve is within twice the tolerance. Measuring the
	points in units of half the tolerance makes fit-curve do exactly that (E = 4, E squared = 16
	= twice the tolerance, squared); the curves are measured back in font units after.

	  fitLine(points, tolerance)                        curves through a line of points
	  fitLineWith(points, left, right, tolerance)       the same, with the directions at its two
	                                                    ends given (left points forward from the
	                                                    start, right points back from the end)
	Curves are [start, handle, handle, end], [x, y] each, font units (not rounded).
*/
import { fitCubic, fitCurve } from './vendor/fit_curve.js';

/** fit-curve's squared tolerance once the points are measured in half-tolerances */
const SCALED_ERROR = 4;

/**
 * @param {Array<[Number, Number]>} points
 * @param {Number} tolerance - font units
 * @returns {Array<Array<[Number, Number]>>}
 */
export function fitLine(points, tolerance) {
	const k = 2 / tolerance;
	return unscale(fitCurve(scale(points, k), SCALED_ERROR), k);
}

/**
 * @param {Array<[Number, Number]>} points
 * @param {[Number, Number]} left - unit direction at the start, forward
 * @param {[Number, Number]} right - unit direction at the end, backward
 * @param {Number} tolerance - font units
 * @returns {Array<Array<[Number, Number]>>}
 */
export function fitLineWith(points, left, right, tolerance) {
	const k = 2 / tolerance;
	return unscale(fitCubic(scale(points, k), left, right, SCALED_ERROR), k);
}

const scale = (points, k) => points.map(([x, y]) => [x * k, y * k]);
const unscale = (curves, k) => curves.map((curve) => curve.map(([x, y]) => [x / k, y / k]));
