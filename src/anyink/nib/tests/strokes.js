// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 test helper: stroke center lines in font units, sampled the way the pointer gives them
	(a point every few units along the path), for the brush's unit tests.

	  line(from, to, step)          a straight stroke
	  arc(cx, cy, r, from, to, step) part of a circle, angles in degrees, counterclockwise
	  loop(cx, cy, r, overlap)      a closed loop, its end running past its start by overlap
	                                degrees (a hand closing an o)
	  sCurve(x0, y0, width, height) an S, two half circles
	  vee(x0, y0, size, step)       a V: down, a sharp turn, up
	  wobble(points, amount, seed)  the same points shaken by a hand's jitter (repeatable)
	  asMouse(points, options)      the same path as the brush receives it from a mouse: walked
	                                at a hand's speed, seen through the edit view at zoom dz in
	                                whole pixels with a little jitter, through the 1 euro filter
	                                (in pixels, as the brush filters), settled at the end, and
	                                back in font units; options { dz, speed (px/s), rate (Hz),
	                                jitter (px), seed }
	  boundsOf(points)              { xMin, xMax, yMin, yMax }
	  allWhole(contours)            true when every point and handle is a whole number
*/
import { makeStrokeFilter } from '../filter.js';

/** @returns {Array<[Number, Number]>} */
export function line([x0, y0], [x1, y1], step = 4) {
	const length = Math.hypot(x1 - x0, y1 - y0);
	const count = Math.max(1, Math.ceil(length / step));
	return Array.from({ length: count + 1 }, (_, i) => [
		x0 + ((x1 - x0) * i) / count,
		y0 + ((y1 - y0) * i) / count,
	]);
}

/** @returns {Array<[Number, Number]>} */
export function arc(cx, cy, r, from, to, step = 4) {
	const sweep = ((to - from) * Math.PI) / 180;
	const count = Math.max(1, Math.ceil((Math.abs(sweep) * r) / step));
	return Array.from({ length: count + 1 }, (_, i) => {
		const a = (from * Math.PI) / 180 + (sweep * i) / count;
		return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
	});
}

/** @returns {Array<[Number, Number]>} */
export function loop(cx, cy, r, overlap = 20, step = 4) {
	return arc(cx, cy, r, 90, 90 + 360 + overlap, step);
}

/** @returns {Array<[Number, Number]>} */
export function sCurve(x0, y0, width, height, step = 4) {
	const r = height / 4;
	const cx = x0 + width / 2;
	const top = arc(cx, y0 + 3 * r, r, 0, 270, step);
	const bottom = arc(cx, y0 + r, r, 90, -180, step);
	return [...top, ...bottom.slice(1)];
}

/** @returns {Array<[Number, Number]>} */
export function vee(x0, y0, size, step = 4) {
	const down = line([x0, y0 + size], [x0 + size / 2, y0], step);
	const up = line([x0 + size / 2, y0], [x0 + size, y0 + size], step);
	return [...down, ...up.slice(1)];
}

/**
 * @param {Array<[Number, Number]>} points
 * @param {Number} amount - font units, the most any point moves
 * @param {Number} seed
 * @returns {Array<[Number, Number]>}
 */
export function wobble(points, amount = 1.5, seed = 7) {
	let state = seed;
	const random = () => {
		state = (state * 16807) % 2147483647;
		return state / 2147483647 - 0.5;
	};
	return points.map(([x, y]) => [x + random() * 2 * amount, y + random() * 2 * amount]);
}

/**
 * @param {Array<[Number, Number]>} points - font units
 * @param {Object} [options]
 * @returns {Array<[Number, Number]>} font units
 */
export function asMouse(
	points,
	{ dz = 0.4, speed = 900, rate = 120, jitter = 0.4, seed = 3 } = {}
) {
	const step = speed / rate / dz; // font units between samples
	const walked = [points[0]];
	let left = step;
	for (let i = 1; i < points.length; i++) {
		let [ax, ay] = points[i - 1];
		const [bx, by] = points[i];
		let length = Math.hypot(bx - ax, by - ay);
		while (length >= left) {
			const t = left / length;
			ax += (bx - ax) * t;
			ay += (by - ay) * t;
			walked.push([ax, ay]);
			length -= left;
			left = step;
		}
		left -= length;
	}
	walked.push(points.at(-1));
	const pixels = wobble(
		walked.map(([x, y]) => [Math.round(x * dz), Math.round(y * dz)]),
		jitter,
		seed
	);
	const filter = makeStrokeFilter();
	const out = pixels.map(([x, y], i) => filter.push(x, y, i / rate));
	const [x, y] = pixels.at(-1);
	out.push(...filter.settle(x, y, (pixels.length - 1) / rate));
	return out.map((point) => [point.x / dz, point.y / dz]);
}

/** @returns {{xMin: Number, xMax: Number, yMin: Number, yMax: Number}} */
export function boundsOf(points) {
	const xs = points.map(([x]) => x);
	const ys = points.map(([, y]) => y);
	return {
		xMin: Math.min(...xs),
		xMax: Math.max(...xs),
		yMin: Math.min(...ys),
		yMax: Math.max(...ys),
	};
}

/**
 * @param {Array<{segments: Array}>} contours
 * @returns {Boolean}
 */
export function allWhole(contours) {
	return contours.every((contour) =>
		contour.segments.every((segment) =>
			segment.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))
		)
	);
}
