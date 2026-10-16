// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 fix pass: a refit outline's curves kept inside the box of the outline they fit. fit-curve
	(nib/refit.js) can bulge a curve past the straight-edged outline where a tight turn meets a
	long straight edge (capital B's bowls at 264 dipped 2.2 units under the writing line). A curve
	whose own extremes (extremes.js cubicExtremes, not its handles: a round top's handles always
	stand past its top) pass the box further than its own ends do plus HAIR (they are the
	outline's points rounded; at least SLACK; S3 finalize: no longer ends plus SLACK, which let
	other B's reach 1.25 past the line) gets both handles shortened along their own directions, by the least
	share that brings it back to its ends (or within a quarter of SLACK), so the tangent at every
	join is kept (smooth joins stay smooth) and a pinned edge stays on its line. The straight
	line between the curve's ends (share 0) always qualifies. A curve leaving the box's edge at a
	slant past it by less than SLACK (a refit end on the edge) is left alone, never flattened.
	Whole numbers in (the refit's), whole numbers out (handles rounded toward their anchors).

	  SLACK                          font units a curve may always pass the box by
	  HAIR                           font units a curve may pass the box past its own ends
	  outlineBox(outline)            { lo: [x, y], hi: [x, y] }, the outline's own extremes
	  keepInBox(curves, box)         new curves; the same array when nothing passed the box
*/
import { cubicExtremes } from './extremes.js';

export const SLACK = 0.25;
/** Font units a curve may pass its own ends by (S3 finalize) */
export const HAIR = 0.05;
/** Halvings of the handle share */
const STEPS = 30;

/**
 * @param {Array<[Number, Number]>} outline
 * @returns {{lo: [Number, Number], hi: [Number, Number]}}
 */
export function outlineBox(outline) {
	const lo = [Infinity, Infinity];
	const hi = [-Infinity, -Infinity];
	outline.forEach(([x, y]) => {
		lo[0] = Math.min(lo[0], x);
		lo[1] = Math.min(lo[1], y);
		hi[0] = Math.max(hi[0], x);
		hi[1] = Math.max(hi[1], y);
	});
	return { lo, hi };
}

/**
 * @param {Array<Array<[Number, Number]>>} curves - [[start, handle, handle, end], ...]
 * @param {{lo: [Number, Number], hi: [Number, Number]}} box
 * @returns {Array<Array<[Number, Number]>>}
 */
export function keepInBox(curves, box) {
	let changed = false;
	const kept = curves.map((cubic) => {
		// the ends are the outline's points rounded: they may stand past it by the rounding
		const ends = Math.max(0, pointPasses(cubic[0], box), pointPasses(cubic[3], box));
		// past the box no further than its own ends, plus a hair (HAIR: a side curve leaving its
		// end almost upright passes it by a few hundredths; shortening it would flatten it), and
		// at least SLACK: the ends stand past the box by the nib outline's own 0.6 and their
		// rounding, so a pinned edge stays within 1 unit (and a hair) of its line
		const limit = Math.max(ends + HAIR, SLACK);
		const allowed = Math.max(ends, SLACK / 4);
		if (passes(cubic, box) <= limit) return cubic;
		let inside = 0;
		let outside = 1;
		for (let i = 0; i < STEPS; i++) {
			const mid = (inside + outside) / 2;
			if (passes(shortened(cubic, mid), box) <= allowed) inside = mid;
			else outside = mid;
		}
		const [p0, h1, h2, p3] = shortened(cubic, inside);
		const whole = [p0, towards(h1, p0), towards(h2, p3), p3];
		if (whole.every((point, i) => point[0] === cubic[i][0] && point[1] === cubic[i][1])) {
			return cubic;
		}
		changed = true;
		return whole;
	});
	return changed ? kept : curves;
}

function pointPasses([x, y], box) {
	return Math.max(x - box.hi[0], box.lo[0] - x, y - box.hi[1], box.lo[1] - y);
}

/** How far the curve passes the box (0 or less: inside) */
function passes(cubic, box) {
	let most = -Infinity;
	cubicExtremes(cubic).forEach(({ x, y }) => {
		most = Math.max(most, pointPasses([x, y], box));
	});
	return most;
}

/** A handle in whole numbers, each rounded toward its anchor (never further out) */
function towards(handle, anchor) {
	return handle.map((value, axis) =>
		value > anchor[axis] ? Math.floor(value) : value < anchor[axis] ? Math.ceil(value) : value
	);
}

/** The cubic with both handles at share of their length, along their own directions */
function shortened([p0, h1, h2, p3], share) {
	const along = (anchor, handle) => [
		anchor[0] + (handle[0] - anchor[0]) * share,
		anchor[1] + (handle[1] - anchor[1]) * share,
	];
	return [p0, along(p0, h1), along(p3, h2), p3];
}
