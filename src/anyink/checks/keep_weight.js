// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B16 (acceptance T3, "stroke weight of all seven within 15 % of their median"): Match size
	changes a letter's size, never its pen. Scaling a letter by k scales its strokes by k too (a
	handwritten H with one tall stem, scaled by 0.77 to the capitals line, came out 27 % thinner
	than his other letters), so the scaled outline is pushed out by what the scale took, half
	the lost width on each side, and the letter keeps the width his pen wrote it with. Pure: no
	editor, no Undo step; fix_shapes.js applyPlan calls it inside the fix's one step.

	  weightPlan({ height, line, stroke })   the scale k and the push `grow` (font units, each
	                               side) that make a body `height` tall exactly `line` tall with
	                               its stroke the same width: k * height + 2 * grow = line and
	                               k * stroke + 2 * grow = stroke. A letter made bigger is thinned
	                               the same way, never by more than MAX_THIN of its stroke a side
	                               (a hairline would go); with no stroke to keep, a plain scale
	  thickenShapes(item, grow)    pushes every own outline of the letter `grow` font units away
	                               from its ink (negative: into it): an outline of ink grows, a
	                               hole closes in by the same, an edge buried in ink (two strokes
	                               overlapping) goes outward. Which side is ink is read from the
	                               fill (nonzero, every outline of the letter), not from the way it
	                               was drawn. Each point moves along its corner's bisector (a
	                               miter, no more than MITER_LIMIT times grow), each curve's
	                               handles keep their direction and grow with the curve. Every
	                               point and handle in use whole. Components are left alone (they
	                               are another letter's shapes).
	  sketchStroke(item, font)     S3 (docs/SKETCH.md section 7): the stroke of a letter whose own
	                               ink is all built from an active Centerline sketch: its one
	                               thickness as the sweep makes it (sketch/edge_rule.js
	                               edgeThickness), which never scales, so Match size and Shrink to
	                               fit keep it exactly. null for any other letter (Brush, photo,
	                               Outline sketch, a part made from another letter, or a mix).
*/
import { inkPaths, isStrayPath, pathContour } from '../spacing/outline.js';
import { whole } from '../spacing/round.js';
import { edgeThickness } from '../sketch/edge_rule.js';
import { getPiece, isSketchActive, sketchOf } from '../sketch/model.js';
import { isBuiltShape, sketchIdOf, sketchKeyOf } from '../sketch/sketch_record.js';

/** A letter made bigger is thinned by no more than this share of its stroke on each side. */
export const MAX_THIN = 0.25;
/** A sharp corner's point moves no further than this many times the push. */
export const MITER_LIMIT = 2;
/** Font units: how far off an edge the fill is read */
const PROBE = 0.25;
/** Handles grow with their curve by no less and no more than this. */
const HANDLE_RANGE = [0.5, 2];

/**
 * @param {{height: Number, line: Number, stroke: Number | null, exact?: Boolean}} sizes - font
 *   units: the body's height now, the height its line asks for, and the letter's stroke estimate;
 *   exact (S3 integration): the stroke is kept exactly (a Centerline sketch), never limited
 * @returns {{k: Number, grow: Number}}
 */
export function weightPlan({ height, line, stroke, exact = false }) {
	const plain = { k: line / height, grow: 0 };
	if (!(stroke > 0) || !(height > stroke) || !(line > stroke)) return plain;
	const k = (line - stroke) / (height - stroke);
	const grow = ((1 - k) * stroke) / 2;
	// S3 integration: a Centerline sketch is rebuilt at its own thickness after the scale, so
	// its stroke is kept exactly however much it grows (no MAX_THIN limit): the body lands on
	// its line
	if (exact || grow >= -MAX_THIN * stroke) return { k, grow };
	const thin = -MAX_THIN * stroke;
	return { k: (line - 2 * thin) / height, grow: thin };
}

/**
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @returns {Number | null} font units
 */
export function sketchStroke(item, font) {
	const sketch = item?.anyink?.sketch ? sketchOf(item) : null;
	if (!sketch || !isSketchActive(sketch)) return null;
	const shapes = item.shapes || [];
	if (!shapes.length) return null;
	const all = shapes.every(
		(shape) =>
			shape?.objType === 'Path' &&
			isBuiltShape(shape) &&
			sketchKeyOf(shape) === sketch.key &&
			getPiece(sketch, sketchIdOf(shape))?.use === 'center'
	);
	if (!all) return null;
	const stroke = edgeThickness(font, sketch.thickness);
	return stroke > 0 ? stroke : null;
}

/**
 * @param {Object} item - Glyph (mutated)
 * @param {Number} grow - font units each side; negative thins
 * @returns {Boolean} true when a shape changed
 */
export function thickenShapes(item, grow) {
	if (!item || !Number.isFinite(grow) || Math.abs(grow) < 1e-9) return false;
	const contours = inkPaths(item)
		.map(pathContour)
		.filter((contour) => contour && contour.points.length >= 3);
	const own = (item.shapes || []).filter(
		(shape) =>
			shape?.objType === 'Path' && (shape.pathPoints || []).length >= 3 && !isStrayPath(shape)
	);
	let changed = false;
	own.forEach((shape) => {
		const side = inkSide(pathContour(shape), contours);
		if (side && pushShape(shape, side * grow)) {
			shape.changed?.();
			changed = true;
		}
	});
	if (changed) item.changed?.();
	return changed;
}

/**
 * Which way is away from the ink, seen going along the outline: +1 its right, -1 its left, 0
 * when neither side is ink (nothing to push).
 * @param {{points: Array<[Number, Number]>, area: Number} | null} contour
 * @param {Array<Object>} contours - every outline of the letter
 * @returns {Number}
 */
function inkSide(contour, contours) {
	if (!contour || !contour.area) return 0;
	const { points } = contour;
	let best = -1;
	let at = 0;
	for (let i = 0; i < points.length; i++) {
		const [ax, ay] = points[i];
		const [bx, by] = points[(i + 1) % points.length];
		const length = Math.hypot(bx - ax, by - ay);
		if (length > best) {
			best = length;
			at = i;
		}
	}
	if (!(best > 0)) return 0;
	const [ax, ay] = points[at];
	const [bx, by] = points[(at + 1) % points.length];
	const [tx, ty] = [(bx - ax) / best, (by - ay) / best];
	const [mx, my] = [(ax + bx) / 2, (ay + by) / 2];
	const probe = Math.min(PROBE, best / 4);
	const right = windingAt([mx + ty * probe, my - tx * probe], contours);
	const left = windingAt([mx - ty * probe, my + tx * probe], contours);
	if (left !== 0 && right === 0) return 1;
	if (right !== 0 && left === 0) return -1;
	if (right !== 0 && left !== 0) return contour.area > 0 ? 1 : -1;
	return 0;
}

/** The nonzero fill's count at a point: the outlines' winding numbers added up */
function windingAt([x, y], contours) {
	let sum = 0;
	contours.forEach(({ points }) => {
		for (let i = 0; i < points.length; i++) {
			const [ax, ay] = points[i];
			const [bx, by] = points[(i + 1) % points.length];
			const cross = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
			if (ay <= y) {
				if (by > y && cross > 0) sum += 1;
			} else if (by <= y && cross < 0) {
				sum -= 1;
			}
		}
	});
	return sum;
}

/**
 * Moves one outline `push` to the right of its way round (negative: to its left).
 * @param {Object} shape - Path (mutated)
 * @param {Number} push
 * @returns {Boolean}
 */
function pushShape(shape, push) {
	const points = shape.pathPoints;
	const n = points.length;
	const was = points.map((point) => ({
		p: [point.p.x, point.p.y],
		h1: [point.h1.x, point.h1.y],
		h2: [point.h2.x, point.h2.y],
		raw1: [point.h1.coord.x, point.h1.coord.y],
		raw2: [point.h2.coord.x, point.h2.coord.y],
	}));
	const moves = was.map((point, i) => {
		const before = was[(i - 1 + n) % n];
		const after = was[(i + 1) % n];
		const into = direction(towardFrom(point.p, point.h1, before.h2, before.p), point.p);
		const out = direction(point.p, towardFrom(point.p, point.h2, after.h1, after.p));
		return miter(into, out, push);
	});
	const moved = was.map((point, i) => [point.p[0] + moves[i][0], point.p[1] + moves[i][1]]);
	// how much each side between two points grew (a curve's handles grow with it)
	const grows = was.map((point, i) => {
		const j = (i + 1) % n;
		const old = Math.hypot(was[j].p[0] - point.p[0], was[j].p[1] - point.p[1]);
		const now = Math.hypot(moved[j][0] - moved[i][0], moved[j][1] - moved[i][1]);
		const k = old > 1e-9 ? now / old : 1;
		return Math.min(HANDLE_RANGE[1], Math.max(HANDLE_RANGE[0], k));
	});
	let changed = false;
	points.forEach((point, i) => {
		const old = was[i];
		const [x, y] = moved[i];
		const symmetric = point.type === 'symmetric';
		const kIn = symmetric ? Math.sqrt(grows[(i - 1 + n) % n] * grows[i]) : grows[(i - 1 + n) % n];
		const kOut = symmetric ? Math.sqrt(grows[(i - 1 + n) % n] * grows[i]) : grows[i];
		changed = setHandle(point.h1, old.h1, old.raw1, old.p, [x, y], moves[i], kIn) || changed;
		changed = setHandle(point.h2, old.h2, old.raw2, old.p, [x, y], moves[i], kOut) || changed;
		const nx = whole(x);
		const ny = whole(y);
		if (nx !== point.p.coord.x || ny !== point.p.coord.y) changed = true;
		point.p.coord.x = nx;
		point.p.coord.y = ny;
	});
	return changed;
}

/** A handle in use keeps its direction and grows by k; one not in use keeps its distance */
function setHandle(handle, at, raw, p, moved, move, k) {
	if (!handle?.coord) return false;
	let nx;
	let ny;
	if (handle.use) {
		nx = whole(moved[0] + (at[0] - p[0]) * k);
		ny = whole(moved[1] + (at[1] - p[1]) * k);
	} else {
		nx = whole(raw[0] + move[0]);
		ny = whole(raw[1] + move[1]);
	}
	const changed = nx !== handle.coord.x || ny !== handle.coord.y;
	handle.coord.x = nx;
	handle.coord.y = ny;
	return changed;
}

/** The first of the candidates that isn't on top of p (the way the outline leaves or meets p) */
function towardFrom(p, ...candidates) {
	return candidates.find((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) > 1e-6) || p;
}

/** The unit direction from a to b ([0, 0] when they are one point) */
function direction(a, b) {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const length = Math.hypot(dx, dy);
	return length > 1e-9 ? [dx / length, dy / length] : [0, 0];
}

/** The corner's push: along the bisector of the two sides' right-hand normals, mitered */
function miter(into, out, push) {
	const n1 = [into[1], -into[0]];
	const n2 = [out[1], -out[0]];
	const has1 = n1[0] || n1[1];
	const has2 = n2[0] || n2[1];
	if (!has1 && !has2) return [0, 0];
	if (!has1) return [n2[0] * push, n2[1] * push];
	if (!has2) return [n1[0] * push, n1[1] * push];
	const denominator = 1 + n1[0] * n2[0] + n1[1] * n2[1];
	let v =
		denominator > 1e-6
			? [((n1[0] + n2[0]) * push) / denominator, ((n1[1] + n2[1]) * push) / denominator]
			: [n1[0] * push, n1[1] * push];
	const length = Math.hypot(v[0], v[1]);
	const limit = MITER_LIMIT * Math.abs(push);
	if (length > limit) v = [(v[0] * limit) / length, (v[1] * limit) / length];
	return v;
}
