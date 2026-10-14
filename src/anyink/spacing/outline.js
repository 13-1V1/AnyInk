// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 spacing: a letter's ink as flat outlines, for measuring. Pure and read-only: nothing here
	changes the letter.

	  itemContours(item) -> [{ points, area, perimeter }]
	    One entry per closed shape: its own paths, plus the paths of every letter it is made
	    from (component instances, read through their cached transformed copy). Curves are cut
	    into CURVE_STEPS straight pieces. `area` is signed (counter-clockwise, y-up, is
	    positive), so a hole drawn the other way round has the opposite sign.
	    Empty shapes and stray 1- or 2-point lines (the font check's rule) are left out: they
	    hold no ink.
	  inkPaths(item) -> the Path objects that hold ink, components flattened (a component of a
	    letter with no ink adds none: its own box would say {0, 0, 0, 0} wherever it sits)
	  inkBox(item) -> { xMin, xMax, yMin, yMax } | null: the exact box (curve extremes) around
	    those paths, the same ink every outline here is made from
	  inkPieces(contours) -> each outline that adds ink with the holes cut in it: its outlines,
	    area, perimeter and how far it reaches (xMin, xMax, yMin, yMax)
	  pointInContour(point, contour) -> Boolean (even-odd test against one outline)
	  isStrayPath(path) -> the font check's stray-shape rule (fontcheck/validate.js
	    isStrayShape), restated here: importing the font check would make it the first way into
	    the app's module graph, where it meets an import loop (validate -> ... ->
	    preview/font_status -> validate) and stops the page loading. outline.test.js checks the
	    two rules agree.
*/

/** Straight pieces per curved side. */
export const CURVE_STEPS = 16;

/**
 * @param {Object} item - Glyph (letter, ligature or component)
 * @returns {Array<{points: Array<Array<Number>>, area: Number, perimeter: Number}>}
 */
export function itemContours(item) {
	return inkPaths(item)
		.map(pathContour)
		.filter((contour) => contour !== null);
}

/**
 * The paths that hold ink, components flattened.
 * @param {Object} item - Glyph
 * @returns {Array<Object>} Path objects
 */
export function inkPaths(item) {
	const result = [];
	(item?.shapes || []).forEach((shape) => {
		if (shape?.objType === 'Path') {
			result.push(shape);
		} else if (shape?.objType === 'ComponentInstance' && shape.link !== item.id) {
			(shape.transformedGlyph?.shapes || []).forEach((part) => {
				if (part?.objType === 'Path') result.push(part);
			});
		}
	});
	return result.filter(
		(path) => Array.isArray(path.pathPoints) && path.pathPoints.length > 0 && !isStrayPath(path)
	);
}

/**
 * The box around the ink, exact at curves (each path's own extremes).
 * @param {Object} item - Glyph
 * @returns {{xMin: Number, xMax: Number, yMin: Number, yMax: Number} | null} null with no ink
 */
export function inkBox(item) {
	let xMin = Infinity;
	let xMax = -Infinity;
	let yMin = Infinity;
	let yMax = -Infinity;
	inkPaths(item).forEach((path) => {
		const m = path.maxes;
		if (![m?.xMin, m?.xMax, m?.yMin, m?.yMax].every(Number.isFinite)) return;
		xMin = Math.min(xMin, m.xMin);
		xMax = Math.max(xMax, m.xMax);
		yMin = Math.min(yMin, m.yMin);
		yMax = Math.max(yMax, m.yMax);
	});
	return xMin <= xMax ? { xMin, xMax, yMin, yMax } : null;
}

/**
 * The pieces of ink: each outline that adds ink, with the holes cut in it. Holes follow the
 * fill rule the canvas and the font file use (nonzero): an outline is a hole only when it
 * cancels the ink around it, so two brush strokes drawn across each other are both ink.
 * @param {Array<Object>} contours - from itemContours
 * @returns {Array<{area: Number, perimeter: Number, contours: Array<Object>, xMin: Number,
 *   xMax: Number, yMin: Number, yMax: Number}>} contours: the outline first, then its holes
 */
export function inkPieces(contours) {
	const info = contours.map((contour) => {
		const sample = contour.points[0];
		const around = contours.filter(
			(other) =>
				other !== contour &&
				Math.abs(other.area) > Math.abs(contour.area) &&
				pointInContour(sample, other)
		);
		const windingAround = around.reduce((sum, other) => sum + Math.sign(other.area), 0);
		const own = Math.sign(contour.area);
		// Nonzero rule: ink just inside this outline only when the windings don't cancel
		const hole = windingAround !== 0 && windingAround + own === 0;
		const parent = around.reduce(
			(best, other) => (!best || Math.abs(other.area) < Math.abs(best.area) ? other : best),
			null
		);
		return { contour, hole, parent };
	});
	const pieces = new Map();
	info.forEach(({ contour, hole }) => {
		if (hole) return;
		const xs = contour.points.map(([x]) => x);
		const ys = contour.points.map(([, y]) => y);
		pieces.set(contour, {
			area: Math.abs(contour.area),
			perimeter: contour.perimeter,
			contours: [contour],
			xMin: Math.min(...xs),
			xMax: Math.max(...xs),
			yMin: Math.min(...ys),
			yMax: Math.max(...ys),
		});
	});
	info.forEach(({ contour, hole, parent }) => {
		const piece = hole && pieces.get(parent);
		if (!piece) return;
		piece.area -= Math.abs(contour.area);
		piece.perimeter += contour.perimeter;
		piece.contours.push(contour);
	});
	return [...pieces.values()];
}

/** Fewest points a shape needs to hold ink without a curve. */
const MIN_SHAPE_POINTS = 3;

/**
 * True for a shape the font file can't hold and that holds no ink: 1 or 2 points and no curve.
 * An empty shape is never written, so it isn't stray.
 * @param {Object} shape - Path or ComponentInstance
 * @returns {Boolean}
 */
export function isStrayPath(shape) {
	if (shape?.objType !== 'Path' || !Array.isArray(shape.pathPoints)) return false;
	const count = shape.pathPoints.length;
	if (count === 0 || count >= MIN_SHAPE_POINTS) return false;
	const points = shape.pathPoints;
	return !points.some((point, index) => sideCurves(point, points[(index + 1) % count]));
}

/**
 * The exporter's test: a side is straight when, after rounding, its two handles sit on their
 * points.
 * @returns {Boolean}
 */
function sideCurves(point, next) {
	const sameAt = (a, b) => Math.round(a) === Math.round(b);
	return !(
		sameAt(point.h2.x, point.p.x) &&
		sameAt(point.h2.y, point.p.y) &&
		sameAt(next.h1.x, next.p.x) &&
		sameAt(next.h1.y, next.p.y)
	);
}

/**
 * One path as a closed list of points.
 * @param {Object} path - Path
 * @returns {{points: Array<Array<Number>>, area: Number, perimeter: Number} | null}
 */
export function pathContour(path) {
	const pathPoints = path?.pathPoints || [];
	if (!pathPoints.length) return null;
	const points = [[pathPoints[0].p.x, pathPoints[0].p.y]];
	pathPoints.forEach((point, index) => {
		const next = pathPoints[(index + 1) % pathPoints.length];
		const p1 = [point.p.x, point.p.y];
		const p2 = [point.h2.x, point.h2.y];
		const p3 = [next.h1.x, next.h1.y];
		const p4 = [next.p.x, next.p.y];
		const straight = same(p1, p2) && same(p3, p4);
		if (!straight) {
			for (let step = 1; step < CURVE_STEPS; step++) {
				points.push(bezierAt(p1, p2, p3, p4, step / CURVE_STEPS));
			}
		}
		points.push(p4);
	});
	// The last side ends where the first began
	points.pop();
	if (points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return null;
	return { points, area: signedArea(points), perimeter: perimeterOf(points) };
}

/**
 * Even-odd test of one point against one outline.
 * @param {Array<Number>} point - [x, y]
 * @param {{points: Array<Array<Number>>}} contour
 * @returns {Boolean}
 */
export function pointInContour([x, y], contour) {
	const points = contour.points;
	let inside = false;
	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const [xi, yi] = points[i];
		const [xj, yj] = points[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

/** @returns {Number} shoelace area, counter-clockwise positive */
function signedArea(points) {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const [x1, y1] = points[i];
		const [x2, y2] = points[(i + 1) % points.length];
		sum += x1 * y2 - x2 * y1;
	}
	return sum / 2;
}

/** @returns {Number} length all the way round */
function perimeterOf(points) {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const [x1, y1] = points[i];
		const [x2, y2] = points[(i + 1) % points.length];
		sum += Math.hypot(x2 - x1, y2 - y1);
	}
	return sum;
}

/** @returns {Array<Number>} the point at t on a cubic curve */
function bezierAt(p1, p2, p3, p4, t) {
	const s = 1 - t;
	const a = s * s * s;
	const b = 3 * s * s * t;
	const c = 3 * s * t * t;
	const d = t * t * t;
	return [
		a * p1[0] + b * p2[0] + c * p3[0] + d * p4[0],
		a * p1[1] + b * p2[1] + c * p3[1] + d * p4[1],
	];
}

function same(a, b) {
	return a[0] === b[0] && a[1] === b[1];
}
