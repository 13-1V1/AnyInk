// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush (RESEARCH 2.3: "perfect-freehand only for the live ink preview while the pen is
	down"): the quick picture of the stroke drawn under the pointer while the button is down. The
	real ink (ink.js) is made once, on release: the round nib swept along the skeleton, unioned and
	refitted, tens of milliseconds. This has to be cheap enough for every frame and close enough
	that the ink doesn't jump when he lets go: within 2 % of the stroke width (the B8 test,
	preview_match.test.js).
	So it is drawn along the same skeleton the ink will be (skeleton.js, a few milliseconds),
	laid out as a line and cut wherever that line bends more than BEND degrees at one point, or
	curls tighter than TIGHT nib radii (a small loop, a hook). Each
	piece is drawn by perfect-freehand 1.2.3 as an even, round pen (no thinning, no pressure, no
	streamline: the 1 euro filter already smoothed the points) with flat ends, and a round dot the
	size of the nib sits on every end. perfect-freehand cuts across the inside of a bend at one
	point, and folds its inside edge over itself in a curl tighter than the nib, and leaves a thin
	gap of paper either way, so no piece has one; the dots make the outside of each bend
	and both ends of the stroke round, as the nib does. A click is the dot alone.

	  PREVIEW_OPTIONS                  the perfect-freehand options
	  BEND                             degrees; a sharper bend at one point starts a new piece
	  TIGHT                            nib radii; a tighter curl starts a new piece at each point
	  previewShapes(points, size, { last, pixel })   outlines in font units, each filled on its
	                                   own (they may run opposite ways): the pieces, then the dots
	  previewFromSkeleton(skeleton, size, { last })  the same from a skeleton already made
	  drawPreview(ctx, shapes, view, color)   fills them on a canvas through the edit view
*/
import { getStrokeOutlinePoints, getStrokePoints } from 'perfect-freehand';
import { dedupe, densify, dist, flattenCurves, turnAt } from './geometry.js';
import { makeSkeleton } from './skeleton.js';

export const PREVIEW_OPTIONS = Object.freeze({
	thinning: 0,
	smoothing: 0.02,
	streamline: 0,
	simulatePressure: false,
	start: Object.freeze({ cap: false, taper: 0 }),
	end: Object.freeze({ cap: false, taper: 0 }),
});

export const BEND = 12;
/** A curl whose radius is under this many nib radii is drawn piece by piece */
export const TIGHT = 1.5;
/** Sides of a dot */
const DOT_SIDES = 48;
/** How close the laid-out line stays to the skeleton, font units */
const LINE_TOLERANCE = 0.2;

/**
 * @param {Array<[Number, Number]>} points - font units
 * @param {Number} size - the nib's width, font units
 * @param {{last?: Boolean, pixel?: Number}} [options] - last: the stroke is finished; pixel: font
 *   units per screen pixel (the skeleton's tolerance)
 * @returns {Array<Array<[Number, Number]>>}
 */
export function previewShapes(points, size, { last = true, pixel = 0 } = {}) {
	if (!(size > 0)) return [];
	return previewFromSkeleton(makeSkeleton(points, { size, pixel }), size, { last });
}

/**
 * @param {Array<Array<[Number, Number]>>} skeleton
 * @param {Number} size
 * @param {{last?: Boolean}} [options]
 * @returns {Array<Array<[Number, Number]>>}
 */
export function previewFromSkeleton(skeleton, size, { last = true } = {}) {
	if (!skeleton?.length || !(size > 0)) return [];
	const line = dedupe(flattenCurves(skeleton, LINE_TOLERANCE), 1e-3);
	const r = size / 2;
	if (line.length === 1) return [dot(line[0], r)];
	const pieces = [];
	let piece = [line[0]];
	for (let i = 1; i < line.length; i++) {
		piece.push(line[i]);
		if (i === line.length - 1 || bendsAt(line, i, r)) {
			pieces.push(piece);
			piece = [line[i]];
		}
	}
	const step = Math.max(1, size / 16);
	const outlines = pieces.map((run) => {
		const dense = densify(run, step);
		const strokePoints = getStrokePoints(dense, { ...PREVIEW_OPTIONS, size: 1e-3, last });
		return getStrokeOutlinePoints(strokePoints, { ...PREVIEW_OPTIONS, size, last }).map(
			([x, y]) => [x, y]
		);
	});
	const ends = [line[0], ...pieces.map((run) => run.at(-1))];
	return [...outlines, ...ends.map((point) => dot(point, r))];
}

/**
 * A new piece starts at a point where the line bends more than BEND, or curls tighter than
 * TIGHT nib widths across: inside a curl that tight the nib covers the middle, and
 * perfect-freehand's inside edge folds over itself and leaves paper.
 */
function bendsAt(line, i, r) {
	const turn = Math.abs(turnAt(line[i - 1], line[i], line[i + 1]));
	if (turn > BEND) return true;
	if (!(turn > 0)) return false;
	const along = Math.min(dist(line[i - 1], line[i]), dist(line[i], line[i + 1]));
	return along / ((turn * Math.PI) / 180) < TIGHT * r;
}

/** A round dot, counterclockwise */
function dot([cx, cy], r) {
	return Array.from({ length: DOT_SIDES }, (_, i) => {
		const a = (2 * Math.PI * i) / DOT_SIDES;
		return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
	});
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<Array<[Number, Number]>>} shapes - font units
 * @param {{dx: Number, dy: Number, dz: Number}} view - the edit canvas's view
 * @param {String} color - a theme token's value
 */
export function drawPreview(ctx, shapes, view, color) {
	if (!ctx) return;
	ctx.fillStyle = color;
	shapes.forEach((shape) => {
		if (shape.length < 3) return;
		ctx.beginPath();
		shape.forEach(([x, y], i) => {
			const cx = view.dx + x * view.dz;
			const cy = view.dy - y * view.dz;
			if (i === 0) ctx.moveTo(cx, cy);
			else ctx.lineTo(cx, cy);
		});
		ctx.closePath();
		ctx.fill('nonzero');
	});
}
