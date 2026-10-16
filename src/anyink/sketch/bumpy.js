// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S1 (docs/SKETCH.md 5 "The Bumpy check", D-047): the Bumpy measure. Pure: no DOM, no
	editor. B11's Bumpy check (S6) reads it; this file only measures.

	A centerline is in the Brush's skeleton format, [[p0, h1, h2, p3], ...] with [x, y] points in
	font units (glyph.anyink.nib.strokes[i].skeleton, and what sketch/curves.js makes of a piece).

	  1. Lay the centerline out as a line of points and take a sample every quarter of the
	     thickness along it (both ends kept).
	  2. Smooth it: each sample becomes the average of the samples within a window of half the
	     thickness centered on it (a quarter each side); the two ends stay put.
	  3. Follow the heading along the smoothed line. A bump is a place where the turn changes
	     side (left to right or back) after the line has turned at least 8 degrees since the
	     last change. Counted as the turning points of the heading, each swing at least 8
	     degrees (so a wobble smaller than 8 degrees never counts, however often it repeats).
	  4. A piece is bumpy when it has 3 or more bumps AND more than 4 bumps per 1,000 font units
	     of its length, and only when it is longer than 6 times the thickness (the ear of r, a
	     short tail, a dot, the end of a and the hook of f are never counted). The 1,000 units
	     are of a 2,048-unit letter box (REFERENCE_UPM): a font with another letter box (1,000
	     units, an older or imported font) has its length scaled by 2,048 / upm first, so the
	     same drawing gets the same verdict at any letter box, like every other share here.

	A closed piece (an o's ring) is measured the same way with its seam joined, so the place
	where it was started never reads as a bump.

	  SAMPLE_SHARE, SMOOTH_SHARE, BUMP_DEGREES, MIN_BUMPS, BUMPS_PER_1000, LENGTH_SHARE,
	  REFERENCE_UPM
	  resample(line, step, { closed })      points every `step` along a line of points
	  smoothSamples(samples, step, window, { closed })   the moving average of step 2
	  headings(samples, { closed })         the heading at each step, degrees, unwrapped
	  countBumps(headings, degrees)         how many times the turn changes side (step 3)
	  measureBumps(skeleton, thickness, { closed, font })
	      { length, bumps, perThousand, counted, bumpy }: length in font units; perThousand per
	      1,000 units of a 2,048-unit letter box (font = project.settings.font, its upm read
	      through guideLines: 2,048 when missing); counted is false for a piece too short to
	      judge (and then bumpy is false); a missing or empty skeleton gives length 0
	  isBumpy(skeleton, thickness, { closed, font })   measureBumps(...).bumpy
	  bumpyStrokes(glyph, { font })         the Brush strokes of a letter that are bumpy:
	      [{ id, key, bumps, length, perThousand }], read from glyph.anyink.nib.strokes (each
	      record's own skeleton and size); [] when the letter has none
	  bumpyPieces(sketch, toSkeleton, { font })   the sketch pieces that are bumpy: [{ id, key, bumps,
	      length, perThousand }]. toSkeleton(piece, sketch) turns a piece into its centerline
	      (sketch/curves.js); helper pieces are skipped, and so is a piece it returns nothing for.
	      The thickness is sketch.thickness.
*/
import { dist, flattenCurves } from '../nib/geometry.js';
import { guideLines } from '../placement/classes.js';

/** Samples every quarter of the thickness */
export const SAMPLE_SHARE = 0.25;
/** Smoothed over a window of half the thickness */
export const SMOOTH_SHARE = 0.5;
/** A turn must swing at least this far before a change of side counts */
export const BUMP_DEGREES = 8;
/** Bumpy needs at least this many bumps... */
export const MIN_BUMPS = 3;
/** ...and more than this many per 1,000 font units */
export const BUMPS_PER_1000 = 4;
/** Only pieces longer than this many thicknesses are judged */
export const LENGTH_SHARE = 6;
/** The letter box BUMPS_PER_1000 is counted in (a new font's upm) */
export const REFERENCE_UPM = 2048;

/** How close the laid-out line stays to the curves, font units */
const FLATTEN_TOLERANCE = 0.1;
const DEGREES = 180 / Math.PI;

/**
 * @param {Array<[Number, Number]>} line
 * @param {Number} step - font units, more than 0
 * @param {{closed?: Boolean}} [options] - closed: also walk from the last point back to the first
 * @returns {Array<[Number, Number]>} a point every `step` along the line; the first point, and
 *   for an open line the last one too (the last gap may be shorter)
 */
export function resample(line, step, { closed = false } = {}) {
	if (!line?.length) return [];
	const points = closed ? [...line, line[0]] : line;
	const out = [points[0]];
	let carried = 0; // how far past the last sample the walk already is
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		const length = dist(a, b);
		if (!(length > 0)) continue;
		let at = step - carried;
		while (at <= length + 1e-9) {
			const t = at / length;
			out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
			at += step;
		}
		carried = length - (at - step);
	}
	if (closed) {
		// the walk came back to the first point: drop a sample sitting on it
		if (out.length > 1 && dist(out.at(-1), out[0]) < step / 2) out.pop();
	} else if (dist(out.at(-1), points.at(-1)) > 1e-6) {
		out.push(points.at(-1));
	}
	return out;
}

/**
 * @param {Array<[Number, Number]>} samples - evenly spaced, `step` apart
 * @param {Number} step
 * @param {Number} window - the width of the window, font units
 * @param {{closed?: Boolean}} [options]
 * @returns {Array<[Number, Number]>}
 */
export function smoothSamples(samples, step, window, { closed = false } = {}) {
	const count = samples.length;
	const reach = Math.max(0, Math.floor(window / 2 / step + 1e-9));
	if (!reach || count < 3) return samples.map(([x, y]) => [x, y]);
	return samples.map((point, i) => {
		if (!closed && (i === 0 || i === count - 1)) return [point[0], point[1]];
		let sx = 0;
		let sy = 0;
		let n = 0;
		for (let k = -reach; k <= reach; k++) {
			let j = i + k;
			if (closed) j = ((j % count) + count) % count;
			else if (j < 0 || j >= count) continue;
			sx += samples[j][0];
			sy += samples[j][1];
			n++;
		}
		return [sx / n, sy / n];
	});
}

/**
 * @param {Array<[Number, Number]>} samples
 * @param {{closed?: Boolean}} [options]
 * @returns {Array<Number>} the heading of each step in degrees, unwrapped (it grows past 360
 *   on a loop instead of jumping back), so its rises are left turns and its falls right turns
 */
export function headings(samples, { closed = false } = {}) {
	const points = closed && samples.length > 2 ? [...samples, samples[0], samples[1]] : samples;
	const out = [];
	for (let i = 1; i < points.length; i++) {
		const dx = points[i][0] - points[i - 1][0];
		const dy = points[i][1] - points[i - 1][1];
		if (!(Math.hypot(dx, dy) > 1e-9)) continue;
		let heading = Math.atan2(dy, dx) * DEGREES;
		if (out.length) {
			const before = out.at(-1);
			while (heading - before > 180) heading -= 360;
			while (heading - before < -180) heading += 360;
		}
		out.push(heading);
	}
	return out;
}

/**
 * The turning points of the heading, each swing at least `degrees` (a zigzag with that much
 * give): how many times the turn changes side.
 * @param {Array<Number>} heading - degrees, unwrapped
 * @param {Number} [degrees]
 * @returns {Number}
 */
export function countBumps(heading, degrees = BUMP_DEGREES) {
	if (heading.length < 3) return 0;
	let side = 0; // +1 turning left, -1 turning right, 0 not yet known
	let low = heading[0];
	let high = heading[0];
	let extreme = heading[0];
	let bumps = 0;
	for (const value of heading) {
		if (side === 0) {
			low = Math.min(low, value);
			high = Math.max(high, value);
			if (value - low >= degrees) {
				side = 1;
				extreme = value;
			} else if (high - value >= degrees) {
				side = -1;
				extreme = value;
			}
			continue;
		}
		if (side === 1) {
			if (value > extreme) extreme = value;
			else if (extreme - value >= degrees) {
				bumps++;
				side = -1;
				extreme = value;
			}
		} else if (value < extreme) extreme = value;
		else if (value - extreme >= degrees) {
			bumps++;
			side = 1;
			extreme = value;
		}
	}
	return bumps;
}

/**
 * @param {Array<Array<[Number, Number]>>} skeleton - [[p0, h1, h2, p3], ...]
 * @param {Number} thickness - font units
 * @param {{closed?: Boolean, font?: Object}} [options] - font: project.settings.font, for its
 *   letter box (upm)
 * @returns {{length: Number, bumps: Number, perThousand: Number, counted: Boolean,
 *   bumpy: Boolean}} perThousand: bumps per 1,000 units of a REFERENCE_UPM letter box
 */
export function measureBumps(skeleton, thickness, { closed = false, font } = {}) {
	const none = { length: 0, bumps: 0, perThousand: 0, counted: false, bumpy: false };
	const size = Number(thickness);
	if (!Array.isArray(skeleton) || !skeleton.length || !(size > 0)) return none;
	const line = flattenCurves(skeleton, FLATTEN_TOLERANCE);
	let length = 0;
	for (let i = 1; i < line.length; i++) length += dist(line[i - 1], line[i]);
	const joined = closed && line.length > 2 && dist(line[0], line.at(-1)) < 1e-6;
	const ring = joined ? line.slice(0, -1) : line;
	const step = size * SAMPLE_SHARE;
	const samples = resample(ring, step, { closed: joined });
	const smooth = smoothSamples(samples, step, size * SMOOTH_SHARE, { closed: joined });
	const bumps = countBumps(headings(smooth, { closed: joined }));
	const boxLength = (length * REFERENCE_UPM) / guideLines(font).box;
	const perThousand = boxLength > 0 ? (bumps * 1000) / boxLength : 0;
	const counted = length > LENGTH_SHARE * size;
	const bumpy = counted && bumps >= MIN_BUMPS && perThousand > BUMPS_PER_1000;
	return { length, bumps, perThousand, counted, bumpy };
}

/** @returns {Boolean} */
export function isBumpy(skeleton, thickness, options) {
	return measureBumps(skeleton, thickness, options).bumpy;
}

/**
 * @param {Object} glyph - a Glyph (or its saved JSON); its anyink.nib.strokes are read
 * @param {{font?: Object}} [options] - font: project.settings.font
 * @returns {Array<{id: Number, key: String, bumps: Number, length: Number,
 *   perThousand: Number}>}
 */
export function bumpyStrokes(glyph, { font } = {}) {
	const strokes = glyph?.anyink?.nib?.strokes;
	if (!Array.isArray(strokes)) return [];
	const out = [];
	for (const stroke of strokes) {
		const result = measureBumps(stroke?.skeleton, stroke?.size, { font });
		if (!result.bumpy) continue;
		const { bumps, length, perThousand } = result;
		out.push({ id: stroke.id, key: stroke.key, bumps, length, perThousand });
	}
	return out;
}

/**
 * @param {Object} sketch - glyph.anyink.sketch
 * @param {Function} toSkeleton - (piece, sketch) => [[p0, h1, h2, p3], ...] (sketch/curves.js)
 * @param {{font?: Object}} [options] - font: project.settings.font
 * @returns {Array<{id: Number, key: String, bumps: Number, length: Number,
 *   perThousand: Number}>}
 */
export function bumpyPieces(sketch, toSkeleton, { font } = {}) {
	if (!Array.isArray(sketch?.pieces) || typeof toSkeleton !== 'function') return [];
	const out = [];
	for (const piece of sketch.pieces) {
		if (!piece || piece.use === 'helper') continue;
		const skeleton = toSkeleton(piece, sketch);
		const result = measureBumps(skeleton, sketch.thickness, { closed: !!piece.closed, font });
		if (!result.bumpy) continue;
		const { bumps, length, perThousand } = result;
		out.push({ id: piece.id, key: piece.key, bumps, length, perThousand });
	}
	return out;
}
