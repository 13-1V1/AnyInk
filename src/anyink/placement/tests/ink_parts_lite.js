// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper for B3 placement, safe in the browser and in vitest: finds a photo's parts and
	measures a part's stroke weight. Not shipped (B9's ink_parts.js is the real parts finder).
	- findParts(mask, width, height): ink pieces, specks dropped, joined into one part
	  (UX-BEGINNER 4.4) when their left-to-right spans overlap by at least half the narrower
	  piece and either
	    - they share their height too: up and down they overlap by at least half the shorter
	      piece (SAME_LETTER_SHARE: a crossbar, a pen lift), or
	    - one is a dot (no wider and no taller than DOT_SHARE of the typical piece's height)
	      wholly above or below the other within DOT_GAP_SHARE of the typical height, its
	      middle at most DOT_REACH_SHARE of that height to the side of it (a dot drifts, a
	      slanted hand puts it right of the stem): i, j, !, ?, : and ; keep their dots. A dot
	      joins only the nearest such piece, a letter before another dot.
	  (B3 finalize: the left-to-right rule alone joined every column of letters on the How
	  card's whole-alphabet page into one part.) Each part has a mask of only its own ink; parts
	  come in reading order (placement/seat.js groupRows), ids p1, p2, ...
	- strokeWidthPx(part): 2 x area / perimeter of the part's largest piece (B3 measure.js's
	  stroke estimate), with the perimeter counted by Crofton's formula over 4 directions, so a
	  curve and a straight stroke of one pen measure alike (a plain edge count overstates a
	  curve's perimeter by up to 27 %).
*/
import { labelPieces } from '../../autotrace/binarize.js';
import { groupRows } from '../seat.js';

/** Pieces smaller than this share of the photo are paper specks. */
export const SPECK_SHARE = 0.00005;

/** Two pieces that overlap up and down by this share of the shorter one are one letter. */
export const SAME_LETTER_SHARE = 0.5;

/** A dot is no wider and no taller than this share of the typical piece's height... */
export const DOT_SHARE = 0.4;

/** ...and joins the nearest piece above or below it within this share of that height... */
export const DOT_GAP_SHARE = 0.6;

/** ...with its middle no further to the side of that piece than this share of the height. */
export const DOT_REACH_SHARE = 0.3;

/**
 * @param {Uint8Array} mask - 1 = ink
 * @param {Number} width
 * @param {Number} height
 * @returns {Array<Object>} parts in reading order, each { id, left, top, right, bottom, mask }
 */
export function findParts(mask, width, height) {
	const { labels, count, sizes } = labelPieces(mask, width, height, 1);
	const minSize = SPECK_SHARE * width * height;
	const boxes = [];
	for (let label = 1; label <= count; label++) {
		boxes[label] = { label, left: width, top: height, right: -1, bottom: -1 };
	}
	for (let i = 0; i < labels.length; i++) {
		const label = labels[i];
		if (!label) continue;
		const x = i % width;
		const y = (i - x) / width;
		const box = boxes[label];
		if (x < box.left) box.left = x;
		if (x > box.right) box.right = x;
		if (y < box.top) box.top = y;
		if (y > box.bottom) box.bottom = y;
	}
	const pieces = boxes.filter((box) => box && sizes[box.label] >= minSize);

	// Pieces of one letter: over each other left to right and sharing their height, or a dot
	const parent = pieces.map((_, i) => i);
	const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
	const heightOf = (box) => box.bottom - box.top + 1;
	const widthOf = (box) => box.right - box.left + 1;
	const typical = median(pieces.map(heightOf));
	const isDot = (box) =>
		widthOf(box) <= DOT_SHARE * typical && heightOf(box) <= DOT_SHARE * typical;
	const across = (a, b) =>
		Math.min(a.right, b.right) - Math.max(a.left, b.left) + 1 >=
		0.5 * Math.min(widthOf(a), widthOf(b));
	/** Up and down: how much they overlap (negative: the gap between them) */
	const upDown = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + 1;
	for (let i = 0; i < pieces.length; i++) {
		for (let j = i + 1; j < pieces.length; j++) {
			const a = pieces[i];
			const b = pieces[j];
			if (!across(a, b)) continue;
			if (upDown(a, b) >= SAME_LETTER_SHARE * Math.min(heightOf(a), heightOf(b))) {
				parent[find(i)] = find(j);
			}
		}
	}
	pieces.forEach((dot, i) => {
		if (!isDot(dot)) return;
		const middle = (dot.left + dot.right) / 2;
		let best = null;
		pieces.forEach((other, j) => {
			if (j === i) return;
			// Wholly above or below it, close, and nearly over it (a dot drifts, a hand leans)
			const gap = -upDown(dot, other);
			if (gap < 0 || gap > DOT_GAP_SHARE * typical) return;
			const aside = Math.max(0, other.left - middle, middle - other.right);
			if (aside > DOT_REACH_SHARE * typical) return;
			// A letter beats another dot (the dots of a colon join each other only alone)
			const rank = [isDot(other) ? 1 : 0, gap + aside];
			if (!best || rank[0] < best.rank[0] || (rank[0] === best.rank[0] && rank[1] < best.rank[1])) {
				best = { j, rank };
			}
		});
		if (best) parent[find(i)] = find(best.j);
	});
	const groups = new Map();
	pieces.forEach((piece, i) => {
		const key = find(i);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(piece);
	});

	const parts = [...groups.values()].map((group) => {
		const left = Math.min(...group.map((p) => p.left));
		const top = Math.min(...group.map((p) => p.top));
		const right = Math.max(...group.map((p) => p.right)) + 1;
		const bottom = Math.max(...group.map((p) => p.bottom)) + 1;
		const own = new Set(group.map((p) => p.label));
		const w = right - left;
		const partMask = new Uint8Array(w * (bottom - top));
		for (let y = top; y < bottom; y++) {
			for (let x = left; x < right; x++) {
				if (own.has(labels[y * width + x])) partMask[(y - top) * w + x - left] = 1;
			}
		}
		return { left, top, right, bottom, mask: partMask };
	});
	const ordered = groupRows(parts).flat();
	ordered.forEach((part, i) => (part.id = `p${i + 1}`));
	return ordered;
}

/** @param {Array<Number>} values @returns {Number} the middle value (0 with none) */
function median(values) {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 2 x area / perimeter of the part's largest piece, in pixels.
 * @param {Object} part - with a mask
 * @returns {Number}
 */
export function strokeWidthPx(part) {
	const width = part.right - part.left;
	const height = part.bottom - part.top;
	const { labels, count, sizes } = labelPieces(part.mask, width, height, 1);
	let best = 1;
	for (let label = 2; label <= count; label++) if (sizes[label] > sizes[best]) best = label;
	const inside = (x, y) =>
		x >= 0 && y >= 0 && x < width && y < height && labels[y * width + x] === best ? 1 : 0;
	let n0 = 0;
	let n90 = 0;
	let n45 = 0;
	let n135 = 0;
	for (let y = -1; y < height; y++) {
		for (let x = -1; x < width; x++) {
			const here = inside(x, y);
			if (here !== inside(x + 1, y)) n0++;
			if (here !== inside(x, y + 1)) n90++;
			if (here !== inside(x + 1, y + 1)) n45++;
			if (inside(x + 1, y) !== inside(x, y + 1)) n135++;
		}
	}
	const perimeter = (Math.PI / 8) * (n0 + n90 + (n45 + n135) / Math.SQRT2);
	return (2 * sizes[best]) / perimeter;
}
