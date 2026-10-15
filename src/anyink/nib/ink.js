// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush (UX-BEGINNER.md 10 B8, D-015): one stroke's center line to its ink, pure. The
	samples become a skeleton (simplify, split at corners, fit-curve: skeleton.js), a round nib
	is swept along it (one hull per step, unioned with clipper2-ts: sweep.js) and each outline is
	fitted with curves again (refit.js). Every number that comes out is whole (7.2), and the ink is
	made from the whole-number skeleton, so inking a stored skeleton again (M10) gives exactly
	the same shapes.

	  inkStroke(points, { size, pixel })   { skeleton, outlines, contours, size }; pixel is font
	                                units per screen pixel (skeleton.js skeletonTolerance), 0 when
	                                there is no screen:
	    skeleton   the center line, curves in whole font units (what glyph.anyink.nib keeps)
	    outlines   the swept outlines before the refit (straight edges)
	    contours   [{ curves, hole }]: each outline as a closed chain of whole-number curves; hole
	               is true for an outline that cuts paper out of the stroke (it runs clockwise)
	    size       the nib's width, whole font units
	  inkSkeleton(skeleton, size)   the same from a skeleton already made (M10 re-inks with it;
	                                the Brush inks the skeleton it built while drawing, B8 + B9 fix)
	  nibWidth(size)                the nib's width as the ink uses it: whole units, at least 2
	The tests call contours' curves `segments`; both names are given.
*/
import { signedArea, whole } from './geometry.js';
import { refitOutline } from './refit.js';
import { makeSkeleton } from './skeleton.js';
import { sweepRoundNib } from './sweep.js';

/**
 * @param {Array<[Number, Number]>} points - font units
 * @param {{size: Number, pixel?: Number}} options - the nib's width, font units; font units per
 *   screen pixel
 * @returns {{skeleton: Array, outlines: Array, contours: Array, size: Number}}
 */
export function inkStroke(points, { size, pixel = 0 }) {
	const width = nibWidth(size);
	return inkSkeleton(makeSkeleton(points, { size: width, pixel }), width);
}

/**
 * @param {Array<Array<[Number, Number]>>} skeleton - whole-number curves
 * @param {Number} size
 * @returns {{skeleton: Array, outlines: Array, contours: Array, size: Number}}
 */
export function inkSkeleton(skeleton, size) {
	const width = nibWidth(size);
	if (!skeleton?.length) return { skeleton: [], outlines: [], contours: [], size: width };
	const outlines = sweepRoundNib(skeleton, width);
	const contours = outlines
		.map((outline) => {
			const curves = refitOutline(outline, { size: width });
			return { curves, segments: curves, hole: signedArea(outline) < 0 };
		})
		.filter((contour) => contour.curves.length > 0);
	return { skeleton, outlines, contours, size: width };
}

/**
 * A whole number of font units, at least 2
 * @param {Number} size
 * @returns {Number}
 */
export function nibWidth(size) {
	return Math.max(2, whole(Number(size) || 0));
}
