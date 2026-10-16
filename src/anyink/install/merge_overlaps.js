// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B14 + B15 integration (FACTCHECK_LOG 8.20): overlapping shapes made into one outline, in the
	font file only. Microsoft's OpenType spec says overlapping outlines aren't supported in a CFF
	(.otf) font, so Use in Word never relies on Word filling them; the work file, the letter on
	screen and the Undo list never change.

	A letter's shapes are grouped by how they lie (letter/outlines.js relation): shapes that are
	apart from every other one, and groups that only nest the right way (ink, a hole in it, ink in
	the hole, each turning the other way from the one around it), go into the file exactly as
	drawn. A group with an overlap (two outlines crossing, or one inside another that turns the
	same way, like two brush strokes or a dot drawn twice) is flattened, united under the nonzero
	rule the letter is drawn with (clipper2-ts, as the Brush does), and fitted back into smooth
	curves in whole font units (nib/refit.js, corners kept both ways), so what shows is what
	showed.

	B14 + B15 finalize: an outline that crosses itself (a figure 8 drawn in one go) is an overlap
	of its own, flattened and united the same way (its halves come out as plain outlines), and a
	shape with no area of its own is kept, never dropped, when something else in the letter merges.

	  hasOverlaps(paths)        true when any two of the Paths overlap, or one crosses itself
	  crossesItself(points)     true when a closed line of points crosses itself
	  mergedContours(paths)     FontFlux contours ([{ type: 'M' | 'L' | 'C', ... }]) with every
	                            overlap gone, or null when there is none (the exporter keeps its
	                            own contours, byte for byte)
	  FLATTEN_TOLERANCE, REFIT_SIZE
*/
import { FillRule, unionD } from 'clipper2-ts';
import { relation, outlineOf, signOf } from '../letter/outlines.js';
import { dedupe, flattenCubic, pointToSegment, signedArea } from '../nib/geometry.js';
import { refitOutline } from '../nib/refit.js';

/** Font units: how far the straight pieces stray from a curve before the union */
export const FLATTEN_TOLERANCE = 0.25;
/** The nib size refit.js scales its tolerances by: fits within half a font unit */
export const REFIT_SIZE = 100;
/** clipper2's decimal places */
const PRECISION = 3;
/** Square font units: rounding dust left by the union */
const MIN_AREA = 1;
/** Font units: a handle this close to the straight line is a straight side */
const STRAIGHT = 0.5;

/**
 * @param {Object} a - outline
 * @param {Object} b - outline
 * @returns {Boolean} true when the two overlap (not apart, and not nested turning opposite ways)
 */
function overlap(a, b) {
	const how = relation(a, b);
	if (how === 'apart') return false;
	if (how === 'cross') return true;
	return signOf(a) === signOf(b);
}

/**
 * @param {Array<Object>} outlines
 * @returns {Array<{members: Array<Number>, overlaps: Boolean}>} groups of touching outlines
 */
function groupsOf(outlines) {
	const parent = outlines.map((_, i) => i);
	const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
	const overlapping = new Set();
	for (let i = 0; i < outlines.length; i++) {
		for (let j = i + 1; j < outlines.length; j++) {
			const how = relation(outlines[i], outlines[j]);
			if (how === 'apart') continue;
			parent[find(i)] = find(j);
			if (overlap(outlines[i], outlines[j])) overlapping.add(i);
		}
	}
	const groups = new Map();
	outlines.forEach((_, i) => {
		const root = find(i);
		if (!groups.has(root)) groups.set(root, { members: [], overlaps: false });
		const group = groups.get(root);
		group.members.push(i);
		if (overlapping.has(i)) group.overlaps = true;
	});
	return [...groups.values()];
}

/**
 * The letter's Paths, each with its outline (or null) and whether it crosses itself.
 * @param {Array<Object>} paths
 * @returns {Array<{path: Object, outline: Object | null, crossing: Boolean}>}
 */
function shapesOf(paths) {
	return (paths || [])
		.filter((path) => path?.objType === 'Path' && (path.pathPoints || []).length >= 3)
		.map((path) => ({ path, outline: outlineOf(path), crossing: crossesItself(flatten(path)) }));
}

/**
 * The shapes in groups: shapes with an area grouped by how they lie (a group overlaps when two
 * members overlap or one crosses itself); a shape that crosses itself with no area of its own (an
 * even figure 8) is an overlapping group of one; any other shape stays as it is.
 * @param {Array<{outline: Object | null, crossing: Boolean}>} shapes
 * @returns {Array<{members: Array<Number>, overlaps: Boolean}>} indexes into shapes
 */
function shapeGroups(shapes) {
	const withArea = [];
	const groups = [];
	shapes.forEach((shape, i) => {
		if (shape.outline) withArea.push(i);
		else groups.push({ members: [i], overlaps: shape.crossing });
	});
	groupsOf(withArea.map((i) => shapes[i].outline)).forEach((group) => {
		const members = group.members.map((k) => withArea[k]);
		groups.push({
			members,
			overlaps: group.overlaps || members.some((i) => shapes[i].crossing),
		});
	});
	return groups;
}

/**
 * @param {Array<Object>} paths - Paths (anything else is ignored)
 * @returns {Boolean} true when two of them overlap or one crosses itself
 */
export function hasOverlaps(paths) {
	return shapeGroups(shapesOf(paths)).some((group) => group.overlaps);
}

/**
 * B14 + B15 finalize: a closed line of points that crosses itself (a figure 8). Sides that only
 * touch, or run along each other, don't count.
 * @param {Array<[Number, Number]>} points - closed (the last joins the first)
 * @returns {Boolean}
 */
export function crossesItself(points) {
	const n = (points || []).length;
	if (n < 4) return false;
	const sides = [];
	for (let i = 0; i < n; i++) {
		const a = points[i];
		const b = points[(i + 1) % n];
		sides.push({ i, a, b, xMin: Math.min(a[0], b[0]), xMax: Math.max(a[0], b[0]) });
	}
	const sorted = [...sides].sort((s, t) => s.xMin - t.xMin);
	for (let k = 0; k < sorted.length; k++) {
		const s = sorted[k];
		for (let m = k + 1; m < sorted.length && sorted[m].xMin <= s.xMax; m++) {
			const t = sorted[m];
			const gap = Math.abs(s.i - t.i);
			if (gap === 1 || gap === n - 1) continue; // neighbours share a corner
			if (sidesCross(s.a, s.b, t.a, t.b)) return true;
		}
	}
	return false;
}

/** Which side of the line a-b the point p is on: +1, -1, or 0 (on it) */
function sideOf(a, b, p) {
	const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
	const scale = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	return Math.abs(cross) / scale < 1e-6 ? 0 : Math.sign(cross);
}

/** True when the sides a-b and c-d cross properly (not only touch) */
function sidesCross(a, b, c, d) {
	const d1 = sideOf(c, d, a);
	const d2 = sideOf(c, d, b);
	const d3 = sideOf(a, b, c);
	const d4 = sideOf(a, b, d);
	return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * A Path as a closed line of points, its curves cut finely.
 * @param {Object} path
 * @returns {Array<[Number, Number]>}
 */
function flatten(path) {
	const points = path.pathPoints || [];
	const line = [];
	points.forEach((point, index) => {
		const next = points[(index + 1) % points.length];
		const curve = [
			[point.p.x, point.p.y],
			[point.h2.x, point.h2.y],
			[next.h1.x, next.h1.y],
			[next.p.x, next.p.y],
		];
		const piece = flattenCubic(curve, FLATTEN_TOLERANCE);
		line.push(...(index === 0 ? piece : piece.slice(1)));
	});
	return dedupe(line, 1e-6, { closed: true });
}

/**
 * One fitted outline as FontFlux contour commands.
 * @param {Array<Array<[Number, Number]>>} curves - closed chain, whole numbers
 * @returns {Array<Object>}
 */
function toContour(curves) {
	const contour = [{ type: 'M', x: curves[0][0][0], y: curves[0][0][1] }];
	curves.forEach(([p0, h1, h2, p3]) => {
		const straight =
			pointToSegment(h1, p0, p3) <= STRAIGHT && pointToSegment(h2, p0, p3) <= STRAIGHT;
		if (straight) contour.push({ type: 'L', x: p3[0], y: p3[1] });
		else
			contour.push({ type: 'C', x1: h1[0], y1: h1[1], x2: h2[0], y2: h2[1], x: p3[0], y: p3[1] });
	});
	return contour;
}

/**
 * @param {Array<Object>} paths - the letter's Paths (components already resolved)
 * @param {(path: Object) => Array<Object>} keep - the exporter's own contour for one Path
 * @returns {Array<Array<Object>> | null} contours, or null when nothing overlaps
 */
export function mergedContours(paths, keep) {
	const shapes = shapesOf(paths);
	const groups = shapeGroups(shapes);
	if (!groups.some((group) => group.overlaps)) return null;
	const contours = [];
	groups.forEach((group) => {
		if (!group.overlaps) {
			group.members.forEach((i) => {
				const contour = keep(shapes[i].path);
				if (contour?.length) contours.push(contour);
			});
			return;
		}
		const united = unionD(
			group.members.map((i) => flatten(shapes[i].path).map(([x, y]) => ({ x, y }))),
			FillRule.NonZero,
			PRECISION
		);
		united
			.map((path) => path.map(({ x, y }) => [x, y]))
			.filter((points) => points.length >= 3 && Math.abs(signedArea(points)) >= MIN_AREA)
			.forEach((points) => {
				const curves = refitOutline(points, { size: REFIT_SIZE, bothWays: true });
				if (curves.length) contours.push(toContour(curves));
			});
	});
	return contours;
}
