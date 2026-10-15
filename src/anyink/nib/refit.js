// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush (D-015 "then refit"): a swept outline (many short straight edges) becomes a few
	smooth curves again (fit-curve), in whole font units (7.2).
	The outline is tidied (points on top of each other and points in the middle of a straight
	edge go), then cut at its corners and each piece is fitted. A round nib's outline only has
	corners where it turns sharply away from the ink, a notch (two parts of the stroke meeting, the
	inside of a sharp turn); everywhere else it is smooth. Ink is always on the left going round
	(solid outlines counterclockwise, holes clockwise, font units up), so a notch is a sharp right
	turn on either kind. An outline with no corner is fitted as two halves that meet smoothly.

	  NOTCH_TURN                       degrees; a sharper right turn at one point is a corner
	  refitTolerance(size)             { tidy, fit, step } in font units, scaled to the nib
	  refitOutline(outline, { size })  [[start, handle, handle, end], ...]: a closed chain (the last
	                                   curve ends where the first starts), whole numbers; [] when
	                                   less than 3 points are left
*/
import { dedupe, densify, scale, sub, turnAt, unit, wholePoint } from './geometry.js';
import { fitLine, fitLineWith } from './fit.js';
import { simplify } from './vendor/simplify.js';

export const NOTCH_TURN = 25;

/**
 * @param {Number} size - the nib, font units
 * @returns {{tidy: Number, fit: Number, step: Number}}
 */
export function refitTolerance(size) {
	const nib = Math.max(1, Number(size) || 1);
	return {
		tidy: 0.05,
		fit: Math.max(0.25, 0.005 * nib),
		step: Math.max(2, nib / 6),
	};
}

/**
 * @param {Array<[Number, Number]>} outline - closed (the last point joins the first)
 * @param {{size: Number}} options
 * @returns {Array<Array<[Number, Number]>>}
 */
export function refitOutline(outline, { size }) {
	const tolerance = refitTolerance(size);
	const points = tidy(outline, tolerance.tidy);
	if (points.length < 3) return [];
	const count = points.length;
	const corners = [];
	for (let i = 0; i < count; i++) {
		const turn = turnAt(points[(i - 1 + count) % count], points[i], points[(i + 1) % count]);
		if (turn < -NOTCH_TURN) corners.push(i);
	}
	const curves = corners.length
		? cornerRuns(points, corners).flatMap((run) => fitRun(run, tolerance))
		: fitSmoothLoop(points, tolerance);
	return wholeLoop(curves);
}

/**
 * Points on top of each other and points in the middle of a straight edge go (Douglas-Peucker
 * from the first point round and back to it).
 */
function tidy(outline, epsilon) {
	const points = dedupe(outline, epsilon, { closed: true });
	if (points.length < 4) return points;
	const ring = [...points, points[0]].map(([x, y]) => ({ x, y }));
	const kept = simplify(ring, epsilon, true).map(({ x, y }) => [x, y]);
	kept.pop();
	return kept;
}

/** The pieces between corners, each from one corner to the next (round the end and back) */
function cornerRuns(points, corners) {
	return corners.map((start, j) => {
		const end = corners[(j + 1) % corners.length];
		const run = [];
		for (let i = start; ; i = (i + 1) % points.length) {
			run.push(points[i]);
			if (run.length > 1 && i === end) break;
		}
		return run;
	});
}

function fitRun(run, tolerance) {
	const dense = dedupe(densify(run, tolerance.step), 1e-6);
	if (dense.length < 2) return [];
	return fitLine(dense, tolerance.fit);
}

/** No corner: two halves, joined smoothly at both ends (the same direction on both sides) */
function fitSmoothLoop(points, tolerance) {
	const count = points.length;
	const half = Math.floor(count / 2);
	const along = (i) => unit(sub(points[(i + 1) % count], points[(i - 1 + count) % count]));
	const t0 = along(0);
	const tHalf = along(half);
	const first = dedupe(densify(points.slice(0, half + 1), tolerance.step), 1e-6);
	const second = dedupe(densify([...points.slice(half), points[0]], tolerance.step), 1e-6);
	return [
		...fitLineWith(first, t0, scale(tHalf, -1), tolerance.fit),
		...fitLineWith(second, tHalf, scale(t0, -1), tolerance.fit),
	];
}

/**
 * Whole numbers, each curve starting where the one before it ends and the last ending where the
 * first starts; a curve rounding shrank to nothing goes.
 */
function wholeLoop(curves) {
	const out = [];
	curves.forEach((curve) => {
		const whole = curve.map(wholePoint);
		if (out.length) whole[0] = out.at(-1)[3];
		if (!isStill(whole)) out.push(whole);
	});
	if (!out.length) return [];
	out.at(-1)[3] = out[0][0];
	if (out.length > 1 && isStill(out.at(-1))) out.pop();
	if (out.length) out.at(-1)[3] = out[0][0];
	return out;
}

const isStill = (curve) => curve.every(([x, y]) => x === curve[0][0] && y === curve[0][1]);
