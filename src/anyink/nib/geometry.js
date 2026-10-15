// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush: the small bits of plane geometry the brush needs. Points are [x, y] arrays in font
	units (y up); a curve is one cubic [start, handle, handle, end]. Pure, no imports.

	  whole(value)                     the nearest whole number (never -0)
	  wholePoint([x, y])               the same for a point
	  dist(a, b), sub(a, b), add(a, b), scale(a, k), cross(a, b), dot(a, b), unit(a)
	  signedArea(points)               positive when the points run counterclockwise (y up)
	  turnAt(before, at, after)        the turning angle at a point in degrees, + left, - right
	  dedupe(points, epsilon)          drops a point closer than epsilon to the one before it
	                                   (and a closing point on top of the first, closed: true)
	  densify(points, step, closed)    adds points so no two neighbors are farther than step
	  cubicAt(curve, t)                a point on a curve
	  flattenCubic(curve, tolerance)   the curve as a line of points no farther than tolerance
	                                   from it (Wang's formula); both ends included
	  flattenCurves(curves, tolerance) a chain of curves as one line of points
	  pointToSegment(p, a, b)          the distance from a point to a line segment
	  pointToPolyline(p, points)       the distance to the nearest piece of a line of points
	  convexHull(points)               the hull, counterclockwise (monotone chain)
*/

/** @returns {Number} */
export function whole(value) {
	const rounded = Math.round(value);
	return rounded === 0 ? 0 : rounded;
}

/** @returns {[Number, Number]} */
export const wholePoint = ([x, y]) => [whole(x), whole(y)];

export const dist = ([ax, ay], [bx, by]) => Math.hypot(bx - ax, by - ay);
export const sub = ([ax, ay], [bx, by]) => [ax - bx, ay - by];
export const add = ([ax, ay], [bx, by]) => [ax + bx, ay + by];
export const scale = ([x, y], k) => [x * k, y * k];
export const cross = ([ax, ay], [bx, by]) => ax * by - ay * bx;
export const dot = ([ax, ay], [bx, by]) => ax * bx + ay * by;

/** @returns {[Number, Number]} the same direction, length 1 ([0, 0] stays [0, 0]) */
export function unit([x, y]) {
	const length = Math.hypot(x, y);
	return length > 0 ? [x / length, y / length] : [0, 0];
}

/**
 * @param {Array<[Number, Number]>} points - a closed outline (the last point joins the first)
 * @returns {Number} positive for counterclockwise in a y-up frame
 */
export function signedArea(points) {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const [x0, y0] = points[i];
		const [x1, y1] = points[(i + 1) % points.length];
		sum += x0 * y1 - x1 * y0;
	}
	return sum / 2;
}

/**
 * @returns {Number} degrees, positive for a left turn; 0 when either side has no length
 */
export function turnAt(before, at, after) {
	const a = sub(at, before);
	const b = sub(after, at);
	if (!(Math.hypot(...a) > 0 && Math.hypot(...b) > 0)) return 0;
	return (Math.atan2(cross(a, b), dot(a, b)) * 180) / Math.PI;
}

/**
 * @param {Array<[Number, Number]>} points
 * @param {Number} epsilon
 * @param {Boolean} [closed]
 * @returns {Array<[Number, Number]>}
 */
export function dedupe(points, epsilon = 1e-6, { closed = false } = {}) {
	const out = [];
	points.forEach((point) => {
		if (!out.length || dist(out.at(-1), point) > epsilon) out.push(point);
	});
	while (closed && out.length > 1 && dist(out[0], out.at(-1)) <= epsilon) out.pop();
	return out;
}

/**
 * @param {Array<[Number, Number]>} points
 * @param {Number} step - the most two neighbors may be apart
 * @param {Boolean} [closed] - also fill the gap from the last point back to the first
 * @returns {Array<[Number, Number]>}
 */
export function densify(points, step, closed = false) {
	const out = [];
	const count = points.length;
	const last = closed ? count : count - 1;
	for (let i = 0; i < last; i++) {
		const a = points[i];
		const b = points[(i + 1) % count];
		out.push(a);
		const pieces = Math.ceil(dist(a, b) / step);
		for (let k = 1; k < pieces; k++) {
			const t = k / pieces;
			out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
		}
	}
	if (!closed && count) out.push(points[count - 1]);
	return out;
}

/** @returns {[Number, Number]} */
export function cubicAt([p0, p1, p2, p3], t) {
	const u = 1 - t;
	const a = u * u * u;
	const b = 3 * u * u * t;
	const c = 3 * u * t * t;
	const d = t * t * t;
	return [
		a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
		a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
	];
}

/**
 * @param {Array<[Number, Number]>} curve - [start, handle, handle, end]
 * @param {Number} tolerance - font units
 * @returns {Array<[Number, Number]>} start to end
 */
export function flattenCubic(curve, tolerance = 0.25) {
	const [p0, p1, p2, p3] = curve;
	const d1 = Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]);
	const d2 = Math.hypot(p1[0] - 2 * p2[0] + p3[0], p1[1] - 2 * p2[1] + p3[1]);
	const pieces = Math.max(1, Math.ceil(Math.sqrt((0.75 * Math.max(d1, d2)) / tolerance)));
	return Array.from({ length: pieces + 1 }, (_, i) => cubicAt(curve, i / pieces));
}

/**
 * @param {Array<Array<[Number, Number]>>} curves - joined end to start
 * @param {Number} tolerance
 * @returns {Array<[Number, Number]>}
 */
export function flattenCurves(curves, tolerance = 0.25) {
	const out = [];
	curves.forEach((curve, i) => {
		const points = flattenCubic(curve, tolerance);
		out.push(...(i === 0 ? points : points.slice(1)));
	});
	return out;
}

/** @returns {Number} */
export function pointToSegment(p, a, b) {
	const ab = sub(b, a);
	const length2 = dot(ab, ab);
	if (!(length2 > 0)) return dist(p, a);
	const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / length2));
	return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]);
}

/** @returns {Number} */
export function pointToPolyline(p, points) {
	if (points.length === 1) return dist(p, points[0]);
	let best = Infinity;
	for (let i = 0; i < points.length - 1; i++) {
		best = Math.min(best, pointToSegment(p, points[i], points[i + 1]));
	}
	return best;
}

/**
 * @param {Array<[Number, Number]>} points
 * @returns {Array<[Number, Number]>} counterclockwise, no point repeated
 */
export function convexHull(points) {
	const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	if (sorted.length < 3) return sorted;
	const turn = (o, a, b) => cross(sub(a, o), sub(b, o));
	const lower = [];
	sorted.forEach((point) => {
		while (lower.length >= 2 && turn(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
		lower.push(point);
	});
	const upper = [];
	[...sorted].reverse().forEach((point) => {
		while (upper.length >= 2 && turn(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
		upper.push(point);
	});
	lower.pop();
	upper.pop();
	return [...lower, ...upper];
}
