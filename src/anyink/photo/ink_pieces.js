// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-core: the ink pieces of a mask, measured (docs/UX-BEGINNER.md 4.4 "Parts"). Pure: an
	ink mask (1 = ink, row-major, y down) in, numbers out; no DOM. Shared by letter_ink.js (which
	ink is the pen's) and ink_parts.js (which pieces make one letter, and the rows).

	  measurePieces(mask, width, height)  -> { labels, count, pieces }: the mask's 4-connected
	      pieces (autotrace/binarize.js labelPieces) in label order, each { label, left, top,
	      right, bottom (inclusive), area, border (touches the photo's edge), stroke (2 x area /
	      perimeter, the perimeter by Crofton's formula over four directions, as B3's
	      strokeWidthPx measures a part) }
	  weightedMedian(pieces)    the area-weighted median of their strokes (0 with none)
	  preferInside(pieces)      the pieces that don't touch the photo's edge, when there are any
	  typicalHeight(pieces, stroke, { preferInside })   the median height of the pieces at least
	      TYPICAL_STROKES strokes tall (all of them when none is); preferInside: of those that
	      don't touch the photo's edge, when one of them is that tall
	  heightOf(box) / widthOf(box)   inclusive boxes
	  median(values)            the middle value (0 with none)
*/
import { labelPieces } from '../autotrace/binarize.js';

/** Pieces at least this many strokes tall set the typical letter height. */
export const TYPICAL_STROKES = 3;

/**
 * @param {Uint8Array} mask - 1 = ink
 * @param {Number} width
 * @param {Number} height
 * @returns {{labels: Int32Array, count: Number, pieces: Array<Object>}}
 */
export function measurePieces(mask, width, height) {
	const { labels, count, sizes, border } = labelPieces(mask, width, height, 1);
	if (!count) return { labels, count: 0, pieces: [] };
	const perimeter = crofton(labels, width, height, count);
	const all = [];
	for (let label = 1; label <= count; label++) {
		all.push({
			label,
			left: width,
			top: height,
			right: -1,
			bottom: -1,
			area: sizes[label],
			border: !!border[label],
			stroke: perimeter[label] > 0 ? (2 * sizes[label]) / perimeter[label] : 0,
		});
	}
	for (let i = 0; i < labels.length; i++) {
		const label = labels[i];
		if (!label) continue;
		const x = i % width;
		const y = (i - x) / width;
		const box = all[label - 1];
		if (x < box.left) box.left = x;
		if (x > box.right) box.right = x;
		if (y < box.top) box.top = y;
		if (y > box.bottom) box.bottom = y;
	}
	return { labels, count, pieces: all };
}

/** Crofton perimeter of every labeled piece (anything with another label counts as outside). */
function crofton(labels, width, height, count) {
	const n0 = new Float64Array(count + 1);
	const n90 = new Float64Array(count + 1);
	const n45 = new Float64Array(count + 1);
	const n135 = new Float64Array(count + 1);
	const at = (x, y) => (x >= 0 && y >= 0 && x < width && y < height ? labels[y * width + x] : 0);
	for (let y = -1; y < height; y++) {
		for (let x = -1; x < width; x++) {
			const here = at(x, y);
			const right = at(x + 1, y);
			const down = at(x, y + 1);
			const diagonal = at(x + 1, y + 1);
			if (here !== right) {
				if (here) n0[here]++;
				if (right) n0[right]++;
			}
			if (here !== down) {
				if (here) n90[here]++;
				if (down) n90[down]++;
			}
			if (here !== diagonal) {
				if (here) n45[here]++;
				if (diagonal) n45[diagonal]++;
			}
			if (right !== down) {
				if (right) n135[right]++;
				if (down) n135[down]++;
			}
		}
	}
	const out = new Float64Array(count + 1);
	for (let label = 1; label <= count; label++) {
		out[label] = (Math.PI / 8) * (n0[label] + n90[label] + (n45[label] + n135[label]) / Math.SQRT2);
	}
	return out;
}

/**
 * @param {Array<Object>} pieces - with area and stroke
 * @returns {Number} the area-weighted median of their strokes
 */
export function weightedMedian(pieces) {
	const list = pieces.filter((p) => p.stroke > 0).sort((a, b) => a.stroke - b.stroke);
	const total = list.reduce((sum, p) => sum + p.area, 0);
	let seen = 0;
	for (const p of list) {
		seen += p.area;
		if (seen >= total / 2) return p.stroke;
	}
	return 0;
}

/**
 * @param {Array<Object>} pieces - with border
 * @returns {Array<Object>} the ones that don't touch the photo's edge, or all when none
 */
export function preferInside(pieces) {
	const inside = pieces.filter((p) => !p.border);
	return inside.length ? inside : pieces;
}

/**
 * @param {Array<Object>} pieces - inclusive boxes
 * @param {Number} stroke
 * @param {{preferInside?: Boolean}} [options]
 * @returns {Number}
 */
export function typicalHeight(pieces, stroke, { preferInside: inside = false } = {}) {
	const tall = pieces.filter((p) => heightOf(p) >= TYPICAL_STROKES * stroke);
	const tallInside = inside ? tall.filter((p) => !p.border) : [];
	const pick = tallInside.length ? tallInside : tall.length ? tall : pieces;
	return median(pick.map(heightOf));
}

/** @param {{top: Number, bottom: Number}} box - inclusive @returns {Number} */
export const heightOf = (box) => box.bottom - box.top + 1;

/** @param {{left: Number, right: Number}} box - inclusive @returns {Number} */
export const widthOf = (box) => box.right - box.left + 1;

/** @param {Array<Number>} values @returns {Number} the middle value (0 with none) */
export function median(values) {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
