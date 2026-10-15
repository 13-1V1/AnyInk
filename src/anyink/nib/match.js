// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush: how far apart two drawings of a stroke are, for the check that the live picture
	(perfect-freehand) and the real ink match within 2 % of the stroke width (UX-BEGINNER.md 10
	B8). Each drawing is a list of outlines filled by the nonzero rule, as the canvas and the font
	file fill them. Both are reduced to the edges that really show (a clipper2 union), and the gap
	is the farthest any point of one edge is from the other edge, both ways round (the Hausdorff
	distance), in font units.

	  flattenContour(curves, tolerance)   a closed chain of curves as points (the first not repeated)
	  shownEdges(outlines)                the outlines of what the nonzero rule fills
	  outlineGap(a, b, { step })          the gap, font units; Infinity when only one side has ink
	  signedArea, pointToPolyline         from geometry.js, for the tests
*/
import { FillRule, unionD } from 'clipper2-ts';
import { dedupe, flattenCurves, pointToSegment, signedArea } from './geometry.js';

export { pointToPolyline, signedArea } from './geometry.js';

/** How far apart the measured points sit along each edge, font units */
const SAMPLE_STEP = 0.5;
/** The grid that finds nearby edge pieces quickly, font units */
const CELL = 12;

/**
 * @param {Array<Array<[Number, Number]>>} curves
 * @param {Number} [tolerance]
 * @returns {Array<[Number, Number]>}
 */
export function flattenContour(curves, tolerance = 0.25) {
	return dedupe(flattenCurves(curves, tolerance), 1e-6, { closed: true });
}

/**
 * @param {Array<Array<[Number, Number]>>} outlines
 * @returns {Array<Array<[Number, Number]>>}
 */
export function shownEdges(outlines) {
	const paths = outlines
		.filter((outline) => outline.length >= 3)
		.map((outline) => outline.map(([x, y]) => ({ x, y })));
	if (!paths.length) return [];
	return unionD(paths, FillRule.NonZero, 4)
		.map((path) => path.map(({ x, y }) => [x, y]))
		.filter((outline) => thickness(outline) >= SLIVER);
}

/** A sliver this thin (font units) can't show: a canvas fills it in */
const SLIVER = 0.25;

/** How thick an outline is on average: twice its area over its length round */
function thickness(outline) {
	let length = 0;
	outline.forEach((point, i) => {
		const next = outline[(i + 1) % outline.length];
		length += Math.hypot(next[0] - point[0], next[1] - point[1]);
	});
	return length > 0 ? (2 * Math.abs(signedArea(outline))) / length : 0;
}

/**
 * @param {Array<Array<[Number, Number]>>} a - outlines (one drawing)
 * @param {Array<Array<[Number, Number]>>} b - outlines (the other)
 * @param {{step?: Number}} [options]
 * @returns {Number}
 */
export function outlineGap(a, b, { step = SAMPLE_STEP } = {}) {
	const edgesA = edgePieces(shownEdges(a));
	const edgesB = edgePieces(shownEdges(b));
	if (!edgesA.length && !edgesB.length) return 0;
	if (!edgesA.length || !edgesB.length) return Infinity;
	return Math.max(farthest(edgesA, edgesB, step), farthest(edgesB, edgesA, step));
}

/** Every edge as [from, to] pieces */
function edgePieces(outlines) {
	const pieces = [];
	outlines.forEach((outline) => {
		outline.forEach((point, i) => pieces.push([point, outline[(i + 1) % outline.length]]));
	});
	return pieces;
}

/** The farthest any point along `from` is from the nearest piece of `to` */
function farthest(from, to, step) {
	const grid = makeGrid(to);
	let worst = 0;
	from.forEach(([a, b]) => {
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
		const count = Math.max(1, Math.ceil(length / step));
		for (let k = 0; k <= count; k++) {
			const t = k / count;
			const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
			worst = Math.max(worst, nearest(grid, point, worst));
		}
	});
	return worst;
}

/** Edge pieces filed by the grid cells their boxes touch */
function makeGrid(pieces) {
	const cells = new Map();
	let xMin = Infinity;
	let yMin = Infinity;
	let xMax = -Infinity;
	let yMax = -Infinity;
	pieces.forEach((piece) => {
		const [[ax, ay], [bx, by]] = piece;
		xMin = Math.min(xMin, ax, bx);
		yMin = Math.min(yMin, ay, by);
		xMax = Math.max(xMax, ax, bx);
		yMax = Math.max(yMax, ay, by);
		for (let cx = cellOf(Math.min(ax, bx)); cx <= cellOf(Math.max(ax, bx)); cx++) {
			for (let cy = cellOf(Math.min(ay, by)); cy <= cellOf(Math.max(ay, by)); cy++) {
				const key = `${cx},${cy}`;
				if (!cells.has(key)) cells.set(key, []);
				cells.get(key).push(piece);
			}
		}
	});
	return { cells, box: { xMin, yMin, xMax, yMax }, pieces };
}

const cellOf = (value) => Math.floor(value / CELL);

/**
 * The distance from a point to the nearest piece, searching rings of cells outward. Once the
 * best is known to be below `enough` (the worst found so far) it stops early: it can't raise the
 * maximum.
 */
function nearest(grid, point, enough) {
	const [px, py] = point;
	const cx = cellOf(px);
	const cy = cellOf(py);
	const { box } = grid;
	const reach = Math.max(
		Math.abs(px - box.xMin),
		Math.abs(px - box.xMax),
		Math.abs(py - box.yMin),
		Math.abs(py - box.yMax)
	);
	const rings = Math.ceil(reach / CELL) + 1;
	let best = Infinity;
	for (let ring = 0; ring <= rings; ring++) {
		for (let x = cx - ring; x <= cx + ring; x++) {
			for (let y = cy - ring; y <= cy + ring; y++) {
				if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== ring) continue;
				const list = grid.cells.get(`${x},${y}`);
				if (!list) continue;
				list.forEach(([a, b]) => {
					best = Math.min(best, pointToSegment(point, a, b));
				});
			}
		}
		// anything in a farther ring is at least `ring` whole cells away
		if (best <= ring * CELL || best <= enough) return best;
	}
	return best;
}
