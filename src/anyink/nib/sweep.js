// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush (D-015 "Nib: hull sweep + union + refit", RESEARCH 2.2): the ink a round nib leaves
	along a skeleton. The skeleton is laid out as a line of points close to its curves; the nib (a
	24-sided polygon whose edges sit as far outside the true circle as its corners sit inside, so
	it is as round as 24 sides allow) is placed at each point, the hull of each two neighbors is
	one piece, and every piece is unioned with clipper2-ts under the nonzero rule. What comes out
	is the stroke's outline: solid outlines counterclockwise (font units point up), holes
	clockwise, exactly as clipper2 hands them back. M10's flat and pointed nibs are other
	polygons through the same sweep.

	B8 + B9 fix (a long stroke froze the page on release, 1.6 s for 15 slow loops): the pieces are
	united UNION_BATCH neighbours at a time (each batch is a short sausage whose inside edges go at
	once), then the batches pairwise, round after round, until one is left. One union of every
	piece kept all their inside edges in play together and grew much faster than the stroke did
	(15 loops: 840 ms, now about 20 ms; the outline is the same to a hundredth of a unit).

	  NIB_SIDES                         24 (RESEARCH 2.2: round = 24-gon)
	  UNION_BATCH                       neighbouring pieces united in one go
	  roundNib(size, sides)             the nib polygon around [0, 0], counterclockwise
	  sweepPieces(line, nib)            one convex piece per step (or the nib alone for a click)
	  stepHull(nib, a, b)               one step's piece: the hull of the nib at a and at b
	  unitePieces(pieces, union)        all the pieces as one nonzero union, in batches; union is
	                                    clipper2's unionD (tests pass a counting stand-in)
	  sweepRoundNib(skeleton, size, { union })   the outlines: [[x, y], ...] per outline, tiny
	                                    bits of rounding dust (under MIN_AREA) left out; union as
	                                    for unitePieces
	  MIN_AREA                          square font units
*/
import { FillRule, unionD } from 'clipper2-ts';
import { add, dedupe, flattenCurves, signedArea } from './geometry.js';

export const NIB_SIDES = 24;
export const MIN_AREA = 4;
export const UNION_BATCH = 8;
/** How close the laid-out line stays to the skeleton's curves, font units */
const LINE_TOLERANCE = 0.1;
/** clipper2's decimal places (it works in whole numbers inside) */
const PRECISION = 3;

/**
 * @param {Number} size - the nib's width, font units
 * @param {Number} [sides]
 * @returns {Array<[Number, Number]>}
 */
export function roundNib(size, sides = NIB_SIDES) {
	const r = Math.max(0.5, Number(size) / 2 || 0.5);
	// corners a little outside the circle and edge middles as far inside it
	const corner = (2 * r) / (1 + Math.cos(Math.PI / sides));
	return Array.from({ length: sides }, (_, i) => {
		const a = (2 * Math.PI * i) / sides;
		return [corner * Math.cos(a), corner * Math.sin(a)];
	});
}

/**
 * @param {Array<[Number, Number]>} line - the laid-out skeleton
 * @param {Array<[Number, Number]>} nib - the nib polygon around [0, 0]
 * @returns {Array<Array<[Number, Number]>>} counterclockwise pieces
 */
export function sweepPieces(line, nib) {
	if (line.length === 1) return [nib.map((corner) => add(corner, line[0]))];
	const pieces = [];
	for (let i = 0; i < line.length - 1; i++) pieces.push(stepHull(nib, line[i], line[i + 1]));
	return pieces;
}

/**
 * The hull of a convex nib placed at a and at b, without sorting (the hull of the two places'
 * corners, convexHull, took a third of a long stroke's ink): the nib's corners from its lowest
 * to its highest across the step (counterclockwise, the side facing b) placed at b, then from
 * its highest back round to its lowest placed at a.
 * @param {Array<[Number, Number]>} nib - convex, counterclockwise, around [0, 0]
 * @param {[Number, Number]} a
 * @param {[Number, Number]} b
 * @returns {Array<[Number, Number]>} counterclockwise
 */
export function stepHull(nib, a, b) {
	const d = [b[0] - a[0], b[1] - a[1]];
	if (!(Math.hypot(d[0], d[1]) > 0)) return nib.map((corner) => add(corner, a));
	// across the step: the left normal
	const across = (corner) => d[0] * corner[1] - d[1] * corner[0];
	let low = 0;
	let high = 0;
	nib.forEach((corner, k) => {
		if (across(corner) < across(nib[low])) low = k;
		if (across(corner) > across(nib[high])) high = k;
	});
	const count = nib.length;
	const out = [];
	for (let k = low; ; k = (k + 1) % count) {
		out.push(add(nib[k], b));
		if (k === high) break;
	}
	for (let k = high; ; k = (k + 1) % count) {
		out.push(add(nib[k], a));
		if (k === low) break;
	}
	return out;
}

/**
 * @param {Array<Array<[Number, Number]>>} skeleton - curves, font units
 * @param {Number} size - the nib's width, font units
 * @param {{union?: Function}} [options] - union: clipper2's unionD (tests count its calls)
 * @returns {Array<Array<[Number, Number]>>}
 */
export function sweepRoundNib(skeleton, size, { union = unionD } = {}) {
	if (!skeleton?.length) return [];
	const line = dedupe(flattenCurves(skeleton, LINE_TOLERANCE), 1e-3);
	const pieces = sweepPieces(line, roundNib(size));
	return unitePieces(pieces, union)
		.map((path) => path.map(({ x, y }) => [x, y]))
		.filter((outline) => outline.length >= 3 && Math.abs(signedArea(outline)) >= MIN_AREA);
}

/**
 * @param {Array<Array<[Number, Number]>>} pieces - in order along the stroke
 * @param {Function} [union] - (paths, fillRule, precision) => paths, clipper2's unionD
 * @returns {Array<Array<{x: Number, y: Number}>>} clipper2's paths
 */
export function unitePieces(pieces, union = unionD) {
	const unite = (paths) => union(paths, FillRule.NonZero, PRECISION);
	let level = [];
	for (let i = 0; i < pieces.length; i += UNION_BATCH) {
		const batch = pieces.slice(i, i + UNION_BATCH);
		level.push(unite(batch.map((piece) => piece.map(([x, y]) => ({ x, y })))));
	}
	while (level.length > 1) {
		const next = [];
		for (let i = 0; i < level.length; i += 2) {
			next.push(i + 1 < level.length ? unite([...level[i], ...level[i + 1]]) : level[i]);
		}
		level = next;
	}
	return level[0] || [];
}
