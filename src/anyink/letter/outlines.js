// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 fix: a letter's shapes as flat outlines, and how two of them lie: apart, one inside
	the other, or crossing. For auto_hole.js (holes made by what shows under a new shape). Pure.

	Each shape is flattened the way the spacing engine measures ink (spacing/outline.js
	pathContour: curves cut into straight pieces; counter-clockwise, y-up, is positive). Two
	outlines that only touch (a side along a side, a corner on a side) don't cross, so a shape
	drawn against the inside edge of another still sits inside it. Sides that cross count even
	when no corner of either shape is inside the other (a plus sign made of two bars), and a
	shape whose corners all sit inside a C-shaped one, with a side across the C's gap, is not
	inside it. Two rectangles that overlap along shared top and bottom lines (no side crosses
	another: they only meet at corners) still cross: the middles of their sides say so.

	Speed: a traced letter has outlines of hundreds of points, and the letter card asks for every
	shape's role. Each outline keeps its sides sorted into bands across its height, so a test
	only looks at the sides near it, and an outline is kept per shape until a point moves.

	  outlineOf(shape)     { points, area, box } | null: null for anything that isn't a Path with
	                       an area (a component instance, a stray line)
	  relation(a, b)       'apart' | 'inside' (a sits in b) | 'around' (b sits in a) | 'cross'
	  windingOf(outlines)  the nonzero count just inside all of them: the sum of their directions
	  signOf(outline)      +1 counter-clockwise, -1 clockwise (y-up)
*/
import { pathContour } from '../spacing/outline.js';

/** Closer than this (font units) to a side is on it */
const ON_SIDE = 0.5;
/** Sides per band, about; and the most bands an outline gets */
const SIDES_PER_BAND = 4;
const MAX_BANDS = 128;

/** path -> { stamp, outline }: kept until a point of the path moves */
const kept = new WeakMap();

/**
 * @param {Object} shape - Path
 * @returns {String} where every point and handle is
 */
function stampOf(shape) {
	return shape.pathPoints
		.map((point) =>
			[point.p.x, point.p.y, point.h1.x, point.h1.y, point.h2.x, point.h2.y, point.h1.use, point.h2.use].join(
				','
			)
		)
		.join(';');
}

/**
 * @param {Object} shape - Path, or anything else
 * @returns {{points: Array<Array<Number>>, area: Number, box: Object} | null}
 */
export function outlineOf(shape) {
	if (shape?.objType !== 'Path' || !Array.isArray(shape.pathPoints)) return null;
	const stamp = stampOf(shape);
	const known = kept.get(shape);
	if (known && known.stamp === stamp) return known.outline;
	const contour = pathContour(shape);
	const outline =
		contour && Number.isFinite(contour.area) && contour.area !== 0
			? { points: contour.points, area: contour.area, box: boxOf(contour.points) }
			: null;
	kept.set(shape, { stamp, outline });
	return outline;
}

/**
 * @param {{area: Number}} outline
 * @returns {Number} +1 or -1
 */
export const signOf = (outline) => Math.sign(outline.area);

/**
 * @param {Array<{area: Number}>} outlines
 * @returns {Number}
 */
export const windingOf = (outlines) => outlines.reduce((sum, outline) => sum + signOf(outline), 0);

function boxOf(points) {
	let xMin = Infinity;
	let xMax = -Infinity;
	let yMin = Infinity;
	let yMax = -Infinity;
	points.forEach(([x, y]) => {
		xMin = Math.min(xMin, x);
		xMax = Math.max(xMax, x);
		yMin = Math.min(yMin, y);
		yMax = Math.max(yMax, y);
	});
	return { xMin, xMax, yMin, yMax };
}

function boxesMeet(a, b, pad = 0) {
	return (
		a.xMin <= b.xMax + pad && b.xMin <= a.xMax + pad && a.yMin <= b.yMax + pad && b.yMin <= a.yMax + pad
	);
}

// --------------------------------------------------------------
// Sides, in bands across the outline's height
// --------------------------------------------------------------

/**
 * @param {Object} outline
 * @returns {{sides: Array, bands: Array<Array<Number>>, y0: Number, height: Number}} built once
 */
function sideIndex(outline) {
	if (outline.index) return outline.index;
	const { points, box } = outline;
	const sides = points.map((point, i) => [point, points[(i + 1) % points.length]]);
	const count = Math.max(1, Math.min(MAX_BANDS, Math.ceil(sides.length / SIDES_PER_BAND)));
	const y0 = box.yMin - ON_SIDE;
	const height = (box.yMax - box.yMin + 2 * ON_SIDE) / count || 1;
	const bands = Array.from({ length: count }, () => []);
	sides.forEach(([a, b], i) => {
		const first = bandAt(Math.min(a[1], b[1]) - ON_SIDE, y0, height, count);
		const last = bandAt(Math.max(a[1], b[1]) + ON_SIDE, y0, height, count);
		for (let band = first; band <= last; band++) bands[band].push(i);
	});
	Object.defineProperty(outline, 'index', { value: { sides, bands, y0, height }, enumerable: false });
	return outline.index;
}

function bandAt(y, y0, height, count) {
	return Math.max(0, Math.min(count - 1, Math.floor((y - y0) / height)));
}

/** The sides that may reach between two heights (a side can come twice) */
function sidesBetween(index, yLow, yHigh) {
	const count = index.bands.length;
	const first = bandAt(yLow, index.y0, index.height, count);
	const last = bandAt(yHigh, index.y0, index.height, count);
	if (first === last) return index.bands[first];
	const found = [];
	for (let band = first; band <= last; band++) found.push(...index.bands[band]);
	return found;
}

/** Twice the signed area of the triangle a b c; 0 when they are in one line */
function turn(a, b, c) {
	return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** -1, 0 or +1, with sides in one line (to within ON_SIDE) counting 0 */
function turnSign(a, b, c) {
	const value = turn(a, b, c);
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	return Math.abs(value) / length <= ON_SIDE ? 0 : Math.sign(value);
}

/** True when the two sides cross each other, not only touch */
function sidesCross([a1, a2], [b1, b2]) {
	if (
		Math.max(a1[0], a2[0]) < Math.min(b1[0], b2[0]) ||
		Math.max(b1[0], b2[0]) < Math.min(a1[0], a2[0]) ||
		Math.max(a1[1], a2[1]) < Math.min(b1[1], b2[1]) ||
		Math.max(b1[1], b2[1]) < Math.min(a1[1], a2[1])
	) {
		return false;
	}
	return (
		turnSign(a1, a2, b1) * turnSign(a1, a2, b2) < 0 && turnSign(b1, b2, a1) * turnSign(b1, b2, a2) < 0
	);
}

function anySidesCross(a, b) {
	const own = sideIndex(a);
	const other = sideIndex(b);
	return own.sides.some((side) => {
		const yLow = Math.min(side[0][1], side[1][1]);
		const yHigh = Math.max(side[0][1], side[1][1]);
		if (yHigh < b.box.yMin || yLow > b.box.yMax) return false;
		return sidesBetween(other, yLow, yHigh).some((i) => sidesCross(side, other.sides[i]));
	});
}

/** How far a point is from a side */
function distanceToSide([x, y], [[x1, y1], [x2, y2]]) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lengthSquared = dx * dx + dy * dy;
	const t = lengthSquared ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared)) : 0;
	return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/**
 * @returns {'in' | 'out' | 'on'} where a point is against the outline (even-odd, as
 *   spacing/outline.js pointInContour, over the sides near its height only)
 */
function pointPlace(point, outline) {
	const { box } = outline;
	const [x, y] = point;
	if (x < box.xMin - ON_SIDE || x > box.xMax + ON_SIDE || y < box.yMin - ON_SIDE || y > box.yMax + ON_SIDE) {
		return 'out';
	}
	const index = sideIndex(outline);
	const near = index.bands[bandAt(y, index.y0, index.height, index.bands.length)];
	let inside = false;
	for (const i of near) {
		const side = index.sides[i];
		if (distanceToSide(point, side) <= ON_SIDE) return 'on';
		const [[xi, yi], [xj, yj]] = side;
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside ? 'in' : 'out';
}

/** The outline's corners and the middles of its sides: where to look from */
function lookoutsOf(outline) {
	return sideIndex(outline).sides.flatMap(([a, b]) => [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]]);
}

/**
 * @returns {{inside: Boolean, outside: Boolean}} whether any of the points is inside the
 *   outline, and whether any is outside it (points on its sides count as neither)
 */
function placeOfPoints(points, outline) {
	let inside = false;
	let outside = false;
	for (const point of points) {
		const place = pointPlace(point, outline);
		if (place === 'in') inside = true;
		else if (place === 'out') outside = true;
		if (inside && outside) break;
	}
	return { inside, outside };
}

/**
 * How outline a lies against outline b.
 * @param {Object} a - from outlineOf
 * @param {Object} b - from outlineOf
 * @returns {'apart' | 'inside' | 'around' | 'cross'}
 */
export function relation(a, b) {
	if (!boxesMeet(a.box, b.box, ON_SIDE)) return 'apart';
	if (anySidesCross(a, b)) return 'cross';
	const aInB = placeOfPoints(lookoutsOf(a), b);
	if (aInB.inside) return aInB.outside ? 'cross' : 'inside';
	const bInA = placeOfPoints(lookoutsOf(b), a);
	if (bInA.inside) return bInA.outside ? 'cross' : 'around';
	// every point of each on the other's sides: the same outline twice
	if (!aInB.outside && !bInA.outside) return 'cross';
	return 'apart';
}
