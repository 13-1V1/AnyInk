// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 3, D-047 point 2): one Centerline piece to its ink, pure. The piece's
	built centerline (curves.js pieceSkeleton) is swept with the B8 round nib at the edge rule's
	thickness (edge_rule.js edgeThickness, never the raw stored one, so the ink edge is exactly
	where the pinned points put it), and each outline is fitted back into whole-number curves
	(nib/refit.js), kept inside the outline's box (keep_in_box.js: fit-curve can bulge a couple of
	units past a tight turn into a straight edge). The sketch must already be placed (build.js runs placeEdgePoints first).

	Ends:
	  - Round (the default): the round nib's sweep, as the Brush inks (nib/sweep.js). A closed
	    piece has no ends: the sweep makes a ring, its hole a clockwise outline of its own. A piece
	    of one point is a dot: the nib alone.
	  - Flat: the flattened centerline inflated with clipper2-ts (JoinType.Round, EndType.Butt),
	    a round nib added at any end that stays Round, refit with corners kept both ways (the butt
	    corners are sharp left turns). A Flat end pinned to a writing line is cut ALONG the line:
	    the end is run on straight past the line and the ink beyond the line near that end is cut
	    away, so a slanted stroke stands flat on the line with no corner hanging past it.
	  - An end that joins another piece (a shared point, or an onPiece relation) is always Round,
	    so the joint fills in.
	  Each end: the point's own `end`, else the sketch's `ends`, else 'round'.

	  endStyle(sketch, id)                 'round' | 'flat'
	  centerWidth(sketch, font, fallback)  the nib's width the build sweeps: whole, at least 2
	  centerContours(piece, sketch, { font, width })   [{ curves, hole }] (curves: a closed chain
	                                       of whole-number cubics); [] for no ink
	  centerOutlines(piece, sketch, { font, width })   the outlines before the refit (straight
	                                       edges, [[x, y], ...]); for tests and the live preview
*/
import { EndType, FillRule, JoinType, differenceD, inflatePathsD, unionD } from 'clipper2-ts';
import { guideLines } from '../placement/classes.js';
import { add, dedupe, flattenCurves, signedArea } from '../nib/geometry.js';
import { nibWidth } from '../nib/ink.js';
import { refitOutline } from '../nib/refit.js';
import { roundNib, sweepRoundNib } from '../nib/sweep.js';
import { endDirection, pieceSkeleton, startDirection } from './curves.js';
import { INK_SIDE, LINE_NAMES, crossingPoints, edgeThickness } from './edge_rule.js';
import { keepInBox, outlineBox } from './keep_in_box.js';
import { getPoint, isDot, isJoined, pieceEnds } from './model.js';

/** clipper2's decimal places */
const PRECISION = 3;
/** How close the flattened line stays to the curves, font units (as nib/sweep.js) */
const LINE_TOLERANCE = 0.1;
/** Square font units: rounding dust left by a union */
const MIN_AREA = 4;
const DEG = Math.PI / 180;

/**
 * @param {Object} sketch
 * @param {String} id - an end point's id
 * @returns {'round' | 'flat'}
 */
export function endStyle(sketch, id) {
	if (isJoined(sketch, id)) return 'round';
	const own = getPoint(sketch, id)?.end;
	if (own === 'flat' || own === 'round') return own;
	return sketch?.ends === 'flat' ? 'flat' : 'round';
}

/**
 * @param {Object} sketch
 * @param {Object} font - project.settings.font
 * @param {Number} [fallback] - the thickness when the sketch has none (sketchThickness)
 * @returns {Number}
 */
export function centerWidth(sketch, font, fallback = 0) {
	const stored = Number(sketch?.thickness) > 0 ? Number(sketch.thickness) : Number(fallback) || 0;
	return nibWidth(edgeThickness(font, stored) || stored);
}

/**
 * @param {Object} piece
 * @param {Object} sketch - placed
 * @param {{font: Object, width: Number}} options
 * @returns {Array<Array<[Number, Number]>>}
 */
export function centerOutlines(piece, sketch, { font, width }) {
	const skeleton = pieceSkeleton(piece, sketch);
	if (!skeleton.length) return [];
	const ends = pieceEnds(piece);
	const open = !piece.closed && !isDot(piece) && ends;
	const styles = open ? ends.map((id) => endStyle(sketch, id)) : ['round', 'round'];
	if (styles.every((style) => style === 'round')) return sweepRoundNib(skeleton, width);
	return flatOutlines(skeleton, sketch, { font, width, ends, styles });
}

/**
 * @param {Object} piece
 * @param {Object} sketch - placed
 * @param {{font: Object, width: Number}} options
 * @returns {Array<{curves: Array, hole: Boolean}>}
 */
export function centerContours(piece, sketch, { font, width }) {
	const ends = pieceEnds(piece);
	const flat =
		!piece.closed && !isDot(piece) && ends && ends.some((id) => endStyle(sketch, id) === 'flat');
	return centerOutlines(piece, sketch, { font, width })
		.map((outline) => {
			// the refit never bulges past its outline (keep_in_box.js): a pinned edge stays on its line
			const curves = keepInBox(
				refitOutline(outline, { size: width, bothWays: !!flat }),
				outlineBox(outline)
			);
			return { curves, hole: signedArea(outline) < 0 };
		})
		.filter((contour) => contour.curves.length > 0);
}

// --------------------------------------------------------------
// Flat ends
// --------------------------------------------------------------

/**
 * The flattened centerline inflated with butt ends; Round ends get the nib; Flat ends pinned to
 * a writing line are run on past it and cut along it.
 */
function flatOutlines(skeleton, sketch, { font, width, ends, styles }) {
	const r = width / 2;
	let line = dedupe(flattenCurves(skeleton, LINE_TOLERANCE), 1e-3);
	if (line.length < 2) return sweepRoundNib(skeleton, width);
	const crossing = crossingPoints(sketch, font);
	const lines = guideLines(font);
	const cuts = [];
	const caps = [];
	const startDir = startDirection(skeleton[0]);
	const endDir = endDirection(skeleton.at(-1));
	[0, 1].forEach((which) => {
		const id = ends[which];
		const at = which === 0 ? line[0] : line.at(-1);
		if (styles[which] === 'round') {
			caps.push(roundNib(width).map((corner) => add(corner, at)));
			return;
		}
		const point = getPoint(sketch, id);
		if (!point || !LINE_NAMES.includes(point.on) || crossing.has(id)) return;
		// out of the stroke: backwards along the start, forwards along the end
		const dir = (which === 0 ? startDir + 180 : endDir) * DEG;
		const out = [Math.cos(dir), Math.sin(dir)];
		const side = INK_SIDE[point.on];
		// only an end that runs toward its line is cut along it
		if (!(out[1] * side < -0.05)) return;
		const across = Math.abs(out[1]);
		const reach = r / across + r + 2;
		const far = add(at, [out[0] * reach, out[1] * reach]);
		if (which === 0) line = [far, ...line];
		else line = [...line, far];
		const y = lines[point.on];
		const size = reach + width * 2;
		// the paper beyond the line, near this end only
		const beyond = side > 0 ? [y - size, y] : [y, y + size];
		cuts.push([
			[at[0] - size, beyond[0]],
			[at[0] + size, beyond[0]],
			[at[0] + size, beyond[1]],
			[at[0] - size, beyond[1]],
		]);
	});
	const body = inflatePathsD(
		[line.map(([x, y]) => ({ x, y }))],
		r,
		JoinType.Round,
		EndType.Butt,
		2,
		PRECISION
	);
	const toD = (poly) => poly.map(([x, y]) => ({ x, y }));
	let ink = caps.length
		? unionD(body, caps.map(toD), FillRule.NonZero, PRECISION)
		: unionD(body, FillRule.NonZero);
	if (cuts.length) ink = differenceD(ink, cuts.map(toD), FillRule.NonZero, PRECISION);
	return ink
		.map((path) => path.map(({ x, y }) => [x, y]))
		.filter((outline) => outline.length >= 3 && Math.abs(signedArea(outline)) >= MIN_AREA);
}
