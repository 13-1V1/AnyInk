// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 4, D-047 point 2): a sketch's Outline loops to ink, pure.

	1. Every closed Outline piece (use 'outline', not hidden) is built (curves.js pieceSkeleton)
	   and flattened; its depth is counted among the sketch's loops only (outline_order.js): photo,
	   Brush and other shapes are never looked at. Depth 0 solid, 1 hole, 2 solid again.
	2. Each loop runs the way its depth needs: solid counterclockwise (+1), hole clockwise (-1).
	3. Loops that cross nothing (checked on the flattened loops): the built curves exactly, one
	   shape per loop, rounded to whole font units.
	4. Loops that cross each other or themselves, as groups (two loops that cross are one group):
	   a loop that crosses itself is first resolved on its own (clipper2 NonZero: both lobes of a
	   figure 8 kept) and its pieces turned to the loop's role; then the group is united under
	   FillRule.Positive, so overlapping solids join, a hole poking past its outer loop makes no ink
	   outside the letter, and an island stays. The result is fitted back into whole-number curves
	   (nib/refit.js, corners kept both ways). The group's shapes carry its first loop's id.
	Open Outline pieces ("gap: not filled yet"), helper and hidden pieces make no ink. Never
	letter/auto_hole.js: it would join and merge across the one-shape-per-loop tags.

	  outlineLoops(sketch)                   [{ piece, cubics, points }]: the loops that ink
	  loopsCross(a, b), crossesItself(points)   on flattened loops; sides that touch count too
	                                         (a crossing exactly at a flattened point is a
	                                         touch of two sides there), so a doubtful case goes
	                                         through clipper, which is right either way
	  outlineContours(sketch)                [{ pieceId, curves, hole }] (curves: a closed chain
	                                         of whole-number cubics)
	  REFIT_SIZE
*/
import { FillRule, unionD } from 'clipper2-ts';
import { refitOutline } from '../nib/refit.js';
import { pieceSkeleton } from './curves.js';
import { directionForDepth, flattenCubics, outlineOrder, signedArea } from './outline_order.js';

/** The size refit.js scales its tolerances by: fits within half a font unit */
export const REFIT_SIZE = 100;
/** Square font units: rounding dust */
const MIN_AREA = 1;

/**
 * @param {Object} sketch - placed
 * @returns {Array<{piece: Object, cubics: Array, points: Array}>}
 */
export function outlineLoops(sketch) {
	return (Array.isArray(sketch?.pieces) ? sketch.pieces : [])
		.filter((piece) => piece?.use === 'outline' && piece.closed && !piece.hidden)
		.map((piece) => {
			const cubics = pieceSkeleton(piece, sketch);
			return { piece, cubics, points: flattenCubics(cubics) };
		})
		.filter(
			(loop) =>
				loop.cubics.length &&
				// a figure 8 drawn evenly has no area as a whole, yet both its lobes are ink
				(Math.abs(signedArea(loop.points)) > MIN_AREA || crossesItself(loop.points))
		);
}

/**
 * @param {Object} sketch - placed
 * @returns {Array<{pieceId: *, curves: Array, hole: Boolean}>}
 */
export function outlineContours(sketch) {
	const loops = outlineLoops(sketch);
	if (!loops.length) return [];
	const order = outlineOrder(loops.map((loop) => ({ id: loop.piece.id, points: loop.points })));
	const selfCross = loops.map((loop) => crossesItself(loop.points));
	// groups of loops that cross
	const parent = loops.map((_, i) => i);
	const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
	const crossing = new Set();
	selfCross.forEach((yes, i) => yes && crossing.add(i));
	for (let i = 0; i < loops.length; i++) {
		for (let j = i + 1; j < loops.length; j++) {
			if (!loopsCross(loops[i].points, loops[j].points)) continue;
			parent[find(i)] = find(j);
			crossing.add(i);
			crossing.add(j);
		}
	}
	const out = [];
	const groups = new Map();
	loops.forEach((loop, i) => {
		if (!crossing.has(i)) {
			const curves = wholeChain(order[i].reverse ? reverseCubics(loop.cubics) : loop.cubics);
			if (curves.length)
				out.push({ pieceId: loop.piece.id, curves, hole: order[i].depth % 2 === 1 });
			return;
		}
		const root = find(i);
		if (!groups.has(root)) groups.set(root, []);
		groups.get(root).push(i);
	});
	groups.forEach((members) => {
		const paths = members.flatMap((i) => {
			const want = directionForDepth(order[i].depth);
			const pieces = selfCross[i]
				? unionD([toD(loops[i].points)], FillRule.NonZero).map(fromD)
				: [loops[i].points];
			return pieces.map((points) => toD(turnTo(points, want)));
		});
		const pieceId = loops[members[0]].piece.id;
		unionD(paths, FillRule.Positive)
			.map(fromD)
			.filter((points) => points.length >= 3 && Math.abs(signedArea(points)) >= MIN_AREA)
			.forEach((points) => {
				const curves = refitOutline(points, { size: REFIT_SIZE, bothWays: true });
				if (curves.length) out.push({ pieceId, curves, hole: signedArea(points) < 0 });
			});
	});
	return out;
}

/**
 * @param {Array<[Number, Number]>} a - closed
 * @param {Array<[Number, Number]>} b - closed
 * @returns {Boolean}
 */
export function loopsCross(a, b) {
	if (!boxesMeet(boxOf(a), boxOf(b))) return false;
	const sidesB = sidesOf(b);
	for (let i = 0; i < a.length; i++) {
		const p = a[i];
		const q = a[(i + 1) % a.length];
		for (const [c, d] of sidesB) if (sidesMeet(p, q, c, d)) return true;
	}
	return false;
}

/**
 * @param {Array<[Number, Number]>} points - closed
 * @returns {Boolean}
 */
export function crossesItself(loop) {
	const points = distinct(loop || []);
	const n = points.length;
	if (n < 4) return false;
	for (let i = 0; i < n; i++) {
		const a = points[i];
		const b = points[(i + 1) % n];
		for (let j = i + 2; j < n; j++) {
			if (i === 0 && j === n - 1) continue;
			if (sidesMeet(a, b, points[j], points[(j + 1) % n])) return true;
		}
	}
	return false;
}

// --------------------------------------------------------------
// Inside
// --------------------------------------------------------------

const toD = (points) => points.map(([x, y]) => ({ x, y }));
const fromD = (path) => path.map(({ x, y }) => [x, y]);

function turnTo(points, direction) {
	const area = signedArea(points);
	return Math.sign(area) === direction || area === 0 ? points : [...points].reverse();
}

function reverseCubics(cubics) {
	return [...cubics].reverse().map(([p0, h1, h2, p3]) => [p3, h2, h1, p0]);
}

/** Whole numbers, each cubic starting where the one before ends, the last closing on the first */
function wholeChain(cubics) {
	const out = [];
	cubics.forEach((cubic) => {
		const whole = cubic.map(([x, y]) => [Math.round(x) || 0, Math.round(y) || 0]);
		if (out.length) whole[0] = out.at(-1)[3];
		if (!whole.every(([x, y]) => x === whole[0][0] && y === whole[0][1])) out.push(whole);
	});
	if (!out.length) return [];
	out.at(-1)[3] = out[0][0];
	return out;
}

function boxOf(points) {
	let xMin = Infinity;
	let yMin = Infinity;
	let xMax = -Infinity;
	let yMax = -Infinity;
	points.forEach(([x, y]) => {
		xMin = Math.min(xMin, x);
		yMin = Math.min(yMin, y);
		xMax = Math.max(xMax, x);
		yMax = Math.max(yMax, y);
	});
	return { xMin, yMin, xMax, yMax };
}

const boxesMeet = (a, b) =>
	a.xMin <= b.xMax && b.xMin <= a.xMax && a.yMin <= b.yMax && b.yMin <= a.yMax;

function sidesOf(points) {
	return points.map((p, i) => [p, points[(i + 1) % points.length]]);
}

function sideOf(a, b, p) {
	const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	return Math.abs(cross) / length < 1e-6 ? 0 : Math.sign(cross);
}

/** The sides a-b and c-d cross or touch */
function sidesMeet(a, b, c, d) {
	const d1 = sideOf(c, d, a);
	const d2 = sideOf(c, d, b);
	const d3 = sideOf(a, b, c);
	const d4 = sideOf(a, b, d);
	if (d1 * d2 > 0 || d3 * d4 > 0) return false;
	if (d1 || d2 || d3 || d4) return true;
	// all four in one line: they meet when their spans overlap
	const along = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1;
	const [lo1, hi1] = [Math.min(a[along], b[along]), Math.max(a[along], b[along])];
	const [lo2, hi2] = [Math.min(c[along], d[along]), Math.max(c[along], d[along])];
	return lo1 <= hi2 && lo2 <= hi1;
}

/** Points on top of the one before them go (and the last on the first) */
function distinct(points) {
	const out = [];
	points.forEach((p) => {
		const last = out[out.length - 1];
		if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-9) out.push(p);
	});
	while (
		out.length > 1 &&
		Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) <= 1e-9
	) {
		out.pop();
	}
	return out;
}
