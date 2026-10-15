// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-flow, fix pass: which ink in a part of a photo is the letter's (docs/UX-BEGINNER.md
	4.4, B11's speck rule in section 10). Pure: masks in, masks out; no DOM, no editor.

	A real page leaves ink no pen wrote. The first-timer's notebook photo had bits of its ruled
	lines and its margin line (a few pixels thick, where his felt-tip is eleven), punch holes, a
	crossed-out letter and a hand's shadow (three and four pens thick). Each was a part of its own,
	so the green box landed on them, and a part of nothing but ruled-line bits traced to four dots
	that replaced a good letter; bits of a ruled line inside a letter's part came into the font as
	a gray dot beside the F. The pen is the yardstick (ink_parts.js findInk's stroke: the
	area-weighted median of the pieces' 2 x area / perimeter, the pen's width for a stroke):
	- inkThickness: how thick a piece of ink is at its thickest, from the chamfer (3-4) distance of
	  every ink pixel to the nearest paper (2 x the deepest one, in pixels), and its pen share: the
	  share of its pixels no deeper than a pen stroke's middle. A pen stroke is about one pen thick
	  (two to two and a half where strokes cross), a dot of the pen one pen across, and nearly all
	  of a written letter is within a stroke of the paper (0.84 and up on every test photo).
	- A piece under THIN_SHARE of the pen is no pen's ink (ruled and margin lines: 0.27 and 0.39);
	  nor is one over BLOB_SHARE pens thick with under PEN_SHARE of it pen-like (punch holes 3.8,
	  0.41; the shadow 2.9, 0.59; the crossed-out Q 3.1, 0.68). A letter a smudge touches keeps its
	  pen share, so it never goes with the smudge.
	- A round, full blob is a dot pressed hard, never a blob (finalize, after the second hostile
	  pass: a 39 px period on a 14 px pen was skipped as junk, the 42 px dots of an i and a j were
	  painted out): up to DOT_SHARE pens across on its own (a period; a punch hole is 3.4 and up),
	  up to DOT_BESIDE_SHARE over or under a stroke of the pen in the same part (i, j, !, ?).
	- keepPenPieces(mask) is the mask without them; a part with no letter ink left is junk (isJunkPart).
	  The flow leaves junk parts out of the guess and the count (photo_flow.js addPhotoFile skips
	  them) and traces only a part's letter ink (photo_flow_data.js). photo-core's letter_ink.js
	  cleans the photo's ink before its parts are found (darkness, color, ruled lines); this is
	  the flow's own check of each part, which also knows a blob as black as the pen (a punch
	  hole over a dark table, a scribbled-out letter).

	A box he drew round one of two touching letters takes in the cut end of the other one (the
	"la" for a, the hook W gave V). trimCutInk takes it back out: ink of the box the box edge cuts
	(it goes on outside the box) is the cut end of something outside, up to about one pen in from
	the edge, split from the rest of the ink at the middle of the way between (a geodesic Voronoi
	of the cut edge and the ink deeper in, so a cut through a touching point splits at it). Each
	such cut end goes when more of its ink lies outside the box than inside (a neighbor's); one he
	only clipped (a little of his own letter outside the box) stays. Ink left alone by what went
	and smaller than the biggest piece left (the rest of a neighbor's hook) goes with it.
	His own stroke the box edge runs along a pixel or three in stays too, even when it touches a
	neighbor further on (finalize: the m lost its first stem, which the l's foot touches, and the
	n its right leg, which the a touches): a cut end along one edge for more than ALONG_SHARE
	pens whose ink goes on outside for under CLIP_SHARE of a pen, or under HALF_SHARE when the
	rest of his letter joins it within END_SHARE pens of an end (clippedOwnStroke). A box edge
	through the middle of his stroke can't be told from one through a neighbor's, so the half
	inside still goes (the m's box at 490 of a stem at 485..493).

	  THIN_SHARE (0.5), BLOB_SHARE (2.5), PEN_SHARE (0.75), DOT_SHARE (3.1), DOT_BESIDE_SHARE
	  (4.5), TRIM_REACH_SHARE (1), ALONG_SHARE (2.5), CLIP_SHARE (0.3), HALF_SHARE (0.5),
	  END_SHARE (1.5)
	  inkThickness(mask, width, height, { stroke }) -> { labels, count, sizes, thickness:
	                       Float64Array, penShare: Float64Array } per piece label (thickness in
	                       pixels; penShare 1 without a stroke)
	  keepPenPieces(mask, width, height, { stroke }) -> { mask, thin, blob }: a copy with the pieces
	                       no pen wrote taken out, and how many of each; stroke <= 0: a plain copy
	  isJunkPart(part, stroke) -> true when no letter ink is left in the part's mask
	  trimCutInk(part, inkMask, imageWidth, imageHeight, { stroke }) -> the part's mask (a copy)
	                       without the ink its box cut off a neighbor; part: { left, top, right,
	                       bottom, mask } in the photo's pixels, the mask the box's size
	  hasInk(mask) -> Boolean
*/
import { labelPieces } from '../autotrace/binarize.js';

/** A piece thinner than this share of the pen is no pen's ink (ruled lines, a margin line). */
export const THIN_SHARE = 0.5;

/** A piece thicker than this many pens is no pen's ink either (a punch hole, a smudge)... */
export const BLOB_SHARE = 2.5;

/** ...when less than this share of it lies within a pen stroke's depth of the paper. */
export const PEN_SHARE = 0.75;

/** A round, full blob is a pressed dot of the pen (a period) up to this many pens across... */
export const DOT_SHARE = 3.1;

/** ...and up to this many over or under a stroke of the pen (the dot of an i or a j). */
export const DOT_BESIDE_SHARE = 4.5;

/** Round: no narrower than this share of its length, filling this share of its round. */
const DOT_ASPECT = 0.75;
const DOT_FILL = 0.85;

/** trimCutInk: a cut end reaches this many pens in from the box edge. */
export const TRIM_REACH_SHARE = 1;

/** trimCutInk: a cut end lying along one box edge for more than this many pens... */
export const ALONG_SHARE = 2.5;

/** ...with ink outside it, in the middle of that stretch, under this share of a pen across... */
export const CLIP_SHARE = 0.3;

/** ...or under this share, his letter joining it within END_SHARE pens of an end... */
export const HALF_SHARE = 0.5;

/** ...is his own stroke the box edge clipped, never a neighbor's cut end. */
export const END_SHARE = 1.5;

/** Chamfer weights: a step across and a step corner to corner (3 and 4 approximate 1 and 1.41). */
const AXIAL = 3;
const DIAGONAL = 4;

/**
 * @param {Uint8Array} mask - 1 = ink, width x height
 * @returns {Boolean}
 */
export function hasInk(mask) {
	if (!mask) return false;
	for (let i = 0; i < mask.length; i++) if (mask[i]) return true;
	return false;
}

/**
 * Chamfer distance of every ink pixel to the nearest paper (outside the mask is paper), in
 * chamfer units (AXIAL per pixel); 0 on paper.
 * @param {Uint8Array} mask
 * @param {Number} width
 * @param {Number} height
 * @returns {Int32Array}
 */
function inkDepth(mask, width, height) {
	const far = 1 << 29;
	const depth = new Int32Array(width * height);
	const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : depth[y * width + x]);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = y * width + x;
			if (!mask[i]) continue;
			depth[i] = Math.min(
				far,
				at(x - 1, y) + AXIAL,
				at(x, y - 1) + AXIAL,
				at(x - 1, y - 1) + DIAGONAL,
				at(x + 1, y - 1) + DIAGONAL
			);
		}
	}
	for (let y = height - 1; y >= 0; y--) {
		for (let x = width - 1; x >= 0; x--) {
			const i = y * width + x;
			if (!mask[i]) continue;
			depth[i] = Math.min(
				depth[i],
				at(x + 1, y) + AXIAL,
				at(x, y + 1) + AXIAL,
				at(x + 1, y + 1) + DIAGONAL,
				at(x - 1, y + 1) + DIAGONAL
			);
		}
	}
	return depth;
}

/**
 * Each 4-connected piece of ink, how thick it is at its thickest and how much of it is pen-like
 * (see the header).
 * @param {Uint8Array} mask
 * @param {Number} width
 * @param {Number} height
 * @param {{stroke?: Number}} [options] - the photo's pen, in pixels
 * @returns {{labels: Int32Array, count: Number, sizes: Int32Array, thickness: Float64Array,
 *   penShare: Float64Array}}
 */
export function inkThickness(mask, width, height, { stroke = 0 } = {}) {
	const { labels, count, sizes } = labelPieces(mask, width, height, 1);
	const depth = inkDepth(mask, width, height);
	const pen = Number(stroke) > 0 ? Number(stroke) : 0;
	// a stroke's middle pixel lies (pen + 1) / 2 pixels in from the paper
	const strokeDepth = pen ? (AXIAL * (pen + 1)) / 2 : Infinity;
	const deepest = new Int32Array(count + 1);
	const penLike = new Int32Array(count + 1);
	for (let i = 0; i < labels.length; i++) {
		const label = labels[i];
		if (!label) continue;
		if (depth[i] > deepest[label]) deepest[label] = depth[i];
		if (depth[i] <= strokeDepth) penLike[label]++;
	}
	const thickness = new Float64Array(count + 1);
	const penShare = new Float64Array(count + 1);
	for (let label = 1; label <= count; label++) {
		thickness[label] = Math.max(1, (2 * deepest[label]) / AXIAL - 1);
		penShare[label] = sizes[label] > 0 ? penLike[label] / sizes[label] : 1;
	}
	return { labels, count, sizes, thickness, penShare };
}

/**
 * @param {Uint8Array} mask
 * @param {Number} width
 * @param {Number} height
 * @param {{stroke?: Number}} [options] - the photo's pen, in pixels
 * @returns {{mask: Uint8Array, thin: Number, blob: Number}}
 */
export function keepPenPieces(mask, width, height, { stroke = 0 } = {}) {
	const out = new Uint8Array(width * height);
	if (!mask || !(width > 0) || !(height > 0)) return { mask: out, thin: 0, blob: 0 };
	for (let i = 0; i < out.length; i++) out[i] = mask[i] ? 1 : 0;
	const pen = Number(stroke);
	if (!(pen > 0)) return { mask: out, thin: 0, blob: 0 };
	const { labels, count, sizes, thickness, penShare } = inkThickness(out, width, height, {
		stroke: pen,
	});
	const boxes = boxesOf(labels, count, width);
	const drop = new Uint8Array(count + 1);
	const blobs = [];
	const strokes = [];
	let thin = 0;
	for (let label = 1; label <= count; label++) {
		if (thickness[label] < THIN_SHARE * pen) {
			drop[label] = 1;
			thin++;
		} else if (thickness[label] > BLOB_SHARE * pen && penShare[label] < PEN_SHARE) {
			blobs.push(label);
		} else {
			strokes.push(boxes[label]);
		}
	}
	// A bold dot is round and full; over or under a stroke of the pen (the dot of an i, a j, a
	// ! or a ?) it may be bigger
	let blob = 0;
	for (const label of blobs) {
		const dot = boxes[label];
		const over = strokes.some((b) => b.left <= dot.right + pen && b.right >= dot.left - pen);
		const most = (over ? DOT_BESIDE_SHARE : DOT_SHARE) * pen;
		if (isRoundDot(dot, sizes[label]) && thickness[label] <= most) continue;
		drop[label] = 1;
		blob++;
	}
	if (thin || blob) {
		for (let i = 0; i < out.length; i++) if (drop[labels[i]]) out[i] = 0;
	}
	return { mask: out, thin, blob };
}

/** Each label's inclusive box. */
function boxesOf(labels, count, width) {
	const boxes = Array.from({ length: count + 1 }, () => ({
		left: Infinity,
		top: Infinity,
		right: -Infinity,
		bottom: -Infinity,
	}));
	for (let i = 0; i < labels.length; i++) {
		const label = labels[i];
		if (!label) continue;
		const x = i % width;
		const y = (i - x) / width;
		const b = boxes[label];
		if (x < b.left) b.left = x;
		if (x > b.right) b.right = x;
		if (y < b.top) b.top = y;
		if (y > b.bottom) b.bottom = y;
	}
	return boxes;
}

/** A piece about as wide as it is tall that fills the round it spans (a pressed dot). */
function isRoundDot(box, area) {
	const w = box.right - box.left + 1;
	const h = box.bottom - box.top + 1;
	if (!(w > 0) || !(h > 0) || Math.min(w, h) < DOT_ASPECT * Math.max(w, h)) return false;
	const round = (Math.PI / 4) * w * h;
	return area >= DOT_FILL * round && area <= (2 - DOT_FILL) * round;
}

/**
 * @param {{left: Number, top: Number, right: Number, bottom: Number, mask: Uint8Array}} part
 * @param {Number} stroke - the photo's pen, in pixels
 * @returns {Boolean} true when nothing of the part is a pen's ink
 */
export function isJunkPart(part, stroke) {
	const width = Number(part?.right) - Number(part?.left);
	const height = Number(part?.bottom) - Number(part?.top);
	if (!(part?.mask instanceof Uint8Array) || !(width > 0) || !(height > 0)) return false;
	if (part.mask.length < width * height || !(Number(stroke) > 0)) return false;
	return !hasInk(keepPenPieces(part.mask, width, height, { stroke }).mask);
}

// --------------------------------------------------------------
// A box he drew: the ink it cut off a neighbor
// --------------------------------------------------------------

/**
 * @param {{left: Number, top: Number, right: Number, bottom: Number, mask: Uint8Array}} part
 * @param {Uint8Array} inkMask - the whole photo's ink (1 = ink), imageWidth x imageHeight
 * @param {Number} imageWidth
 * @param {Number} imageHeight
 * @param {{stroke?: Number}} [options] - the photo's pen, in pixels
 * @returns {Uint8Array} the part's mask without the cut ends of its neighbors (a copy)
 */
export function trimCutInk(part, inkMask, imageWidth, imageHeight, { stroke = 0 } = {}) {
	const left = Number(part?.left);
	const top = Number(part?.top);
	const w = Number(part?.right) - left;
	const h = Number(part?.bottom) - top;
	const source = part?.mask;
	if (!(source instanceof Uint8Array) || !(w > 0) || !(h > 0) || source.length < w * h) {
		return source instanceof Uint8Array ? source.slice() : new Uint8Array(0);
	}
	const mask = new Uint8Array(w * h);
	for (let i = 0; i < mask.length; i++) mask[i] = source[i] ? 1 : 0;
	if (!inkMask || inkMask.length < imageWidth * imageHeight) return mask;

	const photoInk = (x, y) =>
		x >= 0 && y >= 0 && x < imageWidth && y < imageHeight && inkMask[y * imageWidth + x] ? 1 : 0;
	const inBox = (x, y) => x >= left && y >= top && x < left + w && y < top + h;

	// The cut: ink on the box's edge whose ink goes on across it
	const cut = [];
	const outsideOf = new Map();
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (!mask[y * w + x] || (x > 0 && y > 0 && x < w - 1 && y < h - 1)) continue;
			const across = [];
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					const px = left + x + dx;
					const py = top + y + dy;
					if ((dx || dy) && !inBox(px, py) && photoInk(px, py)) across.push(py * imageWidth + px);
				}
			}
			if (across.length) {
				cut.push(y * w + x);
				outsideOf.set(y * w + x, across);
			}
		}
	}
	if (!cut.length) return mask;

	const reach = Math.max(2, Math.round(TRIM_REACH_SHARE * (Number(stroke) > 0 ? stroke : 0)));
	const fromCut = walk(mask, w, h, cut);
	const deep = [];
	for (let i = 0; i < mask.length; i++) {
		if (mask[i] && (fromCut[i] < 0 || fromCut[i] > reach)) deep.push(i);
	}
	const fromDeep = walk(mask, w, h, deep);
	const cutSide = new Uint8Array(w * h);
	for (let i = 0; i < mask.length; i++) {
		if (mask[i] && fromCut[i] >= 0 && (fromDeep[i] < 0 || fromCut[i] < fromDeep[i])) cutSide[i] = 1;
	}

	// Each cut end goes when more of its ink is outside the box than inside it
	const dropped = new Uint8Array(w * h);
	let anyDropped = false;
	const pen = Number(stroke) > 0 ? Number(stroke) : 0;
	for (const group of groups(cutSide, w, h)) {
		// His own stroke the box edge clipped along its side, a neighbor touching it further on
		if (clippedOwnStroke(group, { w, h, left, top, pen, photoInk, outsideOf, cutSide, mask })) {
			continue;
		}
		const starts = [];
		for (const i of group) if (outsideOf.has(i)) starts.push(...outsideOf.get(i));
		const outside = floodOutside(starts, inkMask, imageWidth, imageHeight, inBox, group.length + 1);
		if (outside > group.length) {
			for (const i of group) dropped[i] = 1;
			anyDropped = true;
		}
	}
	if (!anyDropped) return mask;
	for (let i = 0; i < mask.length; i++) if (dropped[i]) mask[i] = 0;

	// What the cut ends left alone (the rest of a neighbor's hook) goes too, unless it is the
	// biggest piece left
	const remaining = groups(mask, w, h);
	const biggest = Math.max(0, ...remaining.map((group) => group.length));
	for (const group of remaining) {
		if (group.length >= biggest) continue;
		if (group.some((i) => touches(dropped, w, h, i))) for (const i of group) mask[i] = 0;
	}
	return mask;
}

/**
 * True when a cut end is his own stroke the box edge runs along, clipped (second hostile pass:
 * with the box edge a few pixels into his stroke, its cut end reached a touching neighbor
 * further on, so the m lost its first stem and the n its right leg). It lies along one edge of
 * the box for more than ALONG_SHARE pens, and across that edge, in the middle of that stretch,
 * its ink goes on outside for under CLIP_SHARE of a pen; or under HALF_SHARE of a pen when the
 * rest of his letter (the ink deeper in the box) joins it within END_SHARE pens of where it
 * starts or stops along the edge (his stroke's own end, as the n's arch tops its leg). A
 * neighbor's stroke the box cuts has more of itself outside, or touches his letter only along
 * its side (the n's leg beside the a). A box edge through the middle of his stroke can't be
 * told from one through a neighbor's, and the half inside goes, as before.
 */
function clippedOwnStroke(group, { w, h, left, top, pen, photoInk, outsideOf, cutSide, mask }) {
	if (!(pen > 0)) return false;
	const edges = [
		{ on: (x) => x === 0, normal: [-1, 0], along: (x, y) => y, list: [] },
		{ on: (x) => x === w - 1, normal: [1, 0], along: (x, y) => y, list: [] },
		{ on: (x, y) => y === 0, normal: [0, -1], along: (x) => x, list: [] },
		{ on: (x, y) => y === h - 1, normal: [0, 1], along: (x) => x, list: [] },
	];
	for (const i of group) {
		if (!outsideOf.has(i)) continue;
		const x = i % w;
		const y = (i - x) / w;
		for (const edge of edges) if (edge.on(x, y)) edge.list.push([x, y]);
	}
	const edge = edges.reduce((best, e) => (e.list.length > best.list.length ? e : best));
	if (edge.list.length <= ALONG_SHARE * pen) return false;
	const [nx, ny] = edge.normal;
	const cap = Math.ceil(pen);
	const fringe = edge.list
		.map(([x, y]) => {
			let outside = 0;
			while (
				outside < cap &&
				photoInk(left + x + nx * (outside + 1), top + y + ny * (outside + 1))
			) {
				outside++;
			}
			return outside;
		})
		.sort((a, b) => a - b);
	const middle = fringe[fringe.length >> 1];
	if (middle < CLIP_SHARE * pen) return true;
	if (middle >= HALF_SHARE * pen) return false;
	// Where the rest of his letter joins the cut end, along the edge
	const along = edge.list.map(([x, y]) => edge.along(x, y));
	const first = Math.min(...along);
	const last = Math.max(...along);
	const end = END_SHARE * pen;
	for (const i of group) {
		const x = i % w;
		const y = (i - x) / w;
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				const nx2 = x + dx;
				const ny2 = y + dy;
				if ((!dx && !dy) || nx2 < 0 || ny2 < 0 || nx2 >= w || ny2 >= h) continue;
				const j = ny2 * w + nx2;
				if (!mask[j] || cutSide[j]) continue;
				const a = edge.along(nx2, ny2);
				if (a <= first + end || a >= last - end) return true;
			}
		}
	}
	return false;
}

/** Steps (8-connected, within the mask) from the nearest start; -1 where none reaches. */
function walk(mask, w, h, starts) {
	const steps = new Int32Array(w * h).fill(-1);
	const queue = new Int32Array(w * h);
	let head = 0;
	let tail = 0;
	for (const i of starts) {
		if (steps[i] >= 0) continue;
		steps[i] = 0;
		queue[tail++] = i;
	}
	while (head < tail) {
		const i = queue[head++];
		const x = i % w;
		const y = (i - x) / w;
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				const nx = x + dx;
				const ny = y + dy;
				if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
				const j = ny * w + nx;
				if (!mask[j] || steps[j] >= 0) continue;
				steps[j] = steps[i] + 1;
				queue[tail++] = j;
			}
		}
	}
	return steps;
}

/** 8-connected groups of the set pixels, as index lists. */
function groups(mask, w, h) {
	const seen = new Uint8Array(w * h);
	const out = [];
	for (let seed = 0; seed < mask.length; seed++) {
		if (!mask[seed] || seen[seed]) continue;
		const group = [seed];
		seen[seed] = 1;
		for (let k = 0; k < group.length; k++) {
			const i = group[k];
			const x = i % w;
			const y = (i - x) / w;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					const nx = x + dx;
					const ny = y + dy;
					if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
					const j = ny * w + nx;
					if (mask[j] && !seen[j]) {
						seen[j] = 1;
						group.push(j);
					}
				}
			}
		}
		out.push(group);
	}
	return out;
}

/** True when a pixel next to i (8 around) is set in `set`. */
function touches(set, w, h, i) {
	const x = i % w;
	const y = (i - x) / w;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			const nx = x + dx;
			const ny = y + dy;
			if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h && set[ny * w + nx]) return true;
		}
	}
	return false;
}

/**
 * Photo ink outside the box reached from the starts (8-connected), counted up to `cap`.
 * @returns {Number}
 */
function floodOutside(starts, inkMask, width, height, inBox, cap) {
	const seen = new Set();
	const stack = [];
	for (const i of starts) {
		if (seen.has(i)) continue;
		seen.add(i);
		stack.push(i);
	}
	let count = 0;
	while (stack.length && count < cap) {
		const i = stack.pop();
		count++;
		const x = i % width;
		const y = (i - x) / width;
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				const nx = x + dx;
				const ny = y + dy;
				if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
				const j = ny * width + nx;
				if (seen.has(j) || !inkMask[j] || inBox(nx, ny)) continue;
				seen.add(j);
				stack.push(j);
			}
		}
	}
	return count;
}
