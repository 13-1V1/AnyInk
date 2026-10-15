// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-core: which of a photo's ink is the pen's (docs/UX-BEGINNER.md 4.4 "Parts"; fix after
	the B8 + B9 first-timer walk, 10/15/2026). Pure: pixels and an ink mask in, a new mask out;
	no DOM, no editor.

	auto-trace's binarize (autotrace/binarize.js, Photo or Scan mode) marks everything darker than
	the paper around it, and on a phone photo that is more than the letters: a gray finger smudge
	under a letter (it joined the e's part, so the e was seated by the smudge's bottom and floated
	over the writing line), the edge of a hand's shadow, punch holes, a notebook's blue ruled
	lines and red margin line. Each became a part with the green box and was counted as a letter.
	letterInk keeps only ink that looks like the pen's, always measured against the page's own
	ink, so a blue ballpoint page or a pencil page keeps its letters:
	1. Darkness: how much darker than the paper under it each ink pixel is (1 - gray / paper; both
	   turned negative for light ink on dark paper). The paper is binarize.js estimatePaper's, but
	   looking only PAPER_REACH_SHARE of the photo's long side round each spot (binarize looks an
	   eighth): far enough to reach past the middle of the widest marker stroke, near enough that
	   paper in a shadow is judged against the shadowed paper round it, so a ruled line in the
	   shadow is as faint as it looks, not as dark as the shadow plus the line.
	   A piece's darkness is that of its darkest tenth; the page's ink darkness is the
	   area-weighted median of the pieces' darkness, over the pieces that don't touch the photo's
	   edge (letters carry nearly all of a page's ink).
	2. The pen's own pixels are at least CORE_SHARE as dark as the page's ink. Other ink stays
	   only within EDGE_REACH_PX of one of them (the soft edge of a stroke), so a smudge or a
	   ruled line running into a letter is cut off it a pixel or two from the stroke, and ink
	   with no pen pixel near it at all goes. A piece touching the photo's edge is kept or
	   dropped whole (step 3 and ink_parts.js's edge rule): cut, the table round a phone page
	   would fall into hundreds of scraps away from the edge.
	3. The pieces of what is left that still aren't the pen's, each dropped with a reason (junk):
	   'edge'     touches the photo's edge and is under EDGE_SPAN_SHARE of a typical letter tall
	              and wide (a scrap the edge cuts), or under EDGE_DARK_SHARE of the page's ink
	              darkness (a shadow); a whole letter the edge cuts stays (ink_parts.js keeps it)
	   'faint'    its darkness is under FAINT_SHARE of the page's ink darkness
	   'thin'     under THIN_SHARE of the pen's stroke and at least THIN_LENGTH of its own strokes
	              long: a ruled or margin line, a shadow's rim (a written l is as thick as the pen)
	   'colored'  its color differs from the page's ink by more than COLOR_SHARE (a red margin
	              line, blue ruled lines, a brown punch hole), or, when it is under
	              COLOR_MIN_STROKES pen strokes squared (as small as a dot or a period), by more
	              than twice that (a bit of a blue line the cut in step 2 left). The color of ink
	              is how much it takes from the paper's red, green and blue (1 - pixel / paper,
	              each channel against its own paper map), as shares of the most it takes: black
	              ink takes the same from all three. Specks (under a quarter of the stroke squared,
	              ink_parts.js's rule) are never judged.
	The pen's stroke and the typical letter height are measured the way ink_parts.js measures
	them (ink_pieces.js), on what step 2 kept.

	  letterInk(imageData, mask, { lightInk })  -> { mask (new: only the pen's ink), junk: [{
	      left, top, right, bottom (exclusive), why }], darkness (the page's ink, 0..1), stroke }
	      imageData: { data: RGBA, width, height }; mask: binarize's, the same size
*/
import { estimatePaper, labelPieces, toGray } from '../autotrace/binarize.js';
import {
	heightOf,
	measurePieces,
	preferInside,
	typicalHeight,
	weightedMedian,
	widthOf,
} from './ink_pieces.js';

/** The paper under a pixel is the brightest within this share of the photo's long side. */
export const PAPER_REACH_SHARE = 1 / 32;

/** A pixel at least this share as dark as the page's ink is the pen's own. */
export const CORE_SHARE = 0.6;

/** Other ink stays within this many pixels of the pen's own (a stroke's soft edge). */
export const EDGE_REACH_PX = 2;

/** A piece whose darkest tenth is under this share of the page's ink darkness is not ink. */
export const FAINT_SHARE = 0.6;

/** A piece whose color is this far from the page's ink (in some channel's share) is not ink. */
export const COLOR_SHARE = 0.18;

/** Pieces under this many pen strokes squared in area must be twice as far off in color. */
export const COLOR_MIN_STROKES = 2;

/** A piece thinner than this share of the pen's stroke... */
export const THIN_SHARE = 0.5;

/** ...and at least this many of its own strokes long is a ruled line, not ink. */
export const THIN_LENGTH = 8;

/** A piece touching the photo's edge under this share of a typical letter tall and wide... */
export const EDGE_SPAN_SHARE = 0.5;

/** ...or under this share of the page's ink darkness is not ink. */
export const EDGE_DARK_SHARE = 0.8;

/**
 * A piece of the photo lighter than the page's ink that is shaped like a letter of the pen is
 * the pen's (a letter written with less pressure; finalize after the second hostile pass): at
 * least this share of the page's ink darkness...
 */
export const LIGHT_SHARE = 0.3;

/** ...when the page cut kept under this share of it... */
export const RESCUE_SHARE = 0.5;

/** ...and it is letter-shaped: a stroke within these shares of the pen... */
export const LETTER_STROKE_SHARES = Object.freeze([0.5, 2]);

/** ...at least this share of a typical letter tall, and at most this many long. */
export const LETTER_HEIGHT_SHARE = 0.5;
export const LETTER_SPAN_SHARE = 3;

/** At least this many letter-shaped pieces of one other color are a second pen's letters. */
export const SECOND_PEN_LETTERS = 3;

/** Darkness histogram bins (darkness is kept in 0..255). */
const BINS = 32;

/** Pieces smaller than this share of the stroke squared are specks (ink_parts.js's rule). */
const SPECK_SHARE = 0.25;

/**
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageData
 * @param {Uint8Array} mask - 1 = ink, as binarize found it
 * @param {{lightInk?: Boolean}} [options]
 * @returns {{mask: Uint8Array, junk: Array<Object>, darkness: Number, stroke: Number}}
 */
export function letterInk(imageData, mask, { lightInk = false } = {}) {
	const width = Number(imageData?.width) || 0;
	const height = Number(imageData?.height) || 0;
	const n = width * height;
	const answer = (out, junk = [], darkness = 0, stroke = 0) => ({
		mask: out,
		junk,
		darkness,
		stroke,
	});
	if (!(n > 0) || !imageData.data || imageData.data.length < n * 4) {
		return answer(mask ? Uint8Array.from(mask) : new Uint8Array(Math.max(0, n)));
	}
	if (!mask || mask.length < n) return answer(new Uint8Array(n));

	// 1. Darkness of every ink pixel (0..255), and the page's ink
	const gray = toGray(imageData);
	if (lightInk) for (let i = 0; i < n; i++) gray[i] = 255 - gray[i];
	const paper = estimatePaper(gray, width, height, { radiusFraction: PAPER_REACH_SHARE });
	const dark = new Uint8Array(n);
	for (let i = 0; i < n; i++) {
		if (!mask[i]) continue;
		const p = paper[i];
		if (p > gray[i]) dark[i] = Math.min(255, Math.round((255 * (p - gray[i])) / p));
	}
	const first = labelPieces(mask, width, height, 1);
	if (!first.count) return answer(new Uint8Array(n));
	const firstDark = darkestTenth(first.labels, first.count, dark);
	const pageDark = inkDarkness(first, firstDark);
	if (!(pageDark > 0)) return answer(Uint8Array.from(mask.subarray(0, n)));

	// 2. The pen's own pixels, and the soft edge beside them
	const cut = CORE_SHARE * pageDark;
	const core = new Uint8Array(n);
	for (let i = 0; i < n; i++) if (mask[i] && dark[i] >= cut) core[i] = 1;
	const near = grow(core, width, height, EDGE_REACH_PX);
	const keep = new Uint8Array(n);
	for (let i = 0; i < n; i++) {
		if (mask[i]) keep[i] = first.border[first.labels[i]] || near[i] ? 1 : 0;
	}

	// 3. What is left, piece by piece
	let measured = measurePieces(keep, width, height);
	if (!measured.count) return answer(keep, [], pageDark / 255);
	const stroke = weightedMedian(preferInside(measured.pieces));
	const solid = measured.pieces.filter((p) => p.area >= SPECK_SHARE * stroke * stroke);
	const typical = typicalHeight(solid, stroke, { preferInside: true });

	// 2b. A letter written lighter than the rest: the page cut left it in bits, or nothing
	const light = rescueLight(first, firstDark, { dark, keep, pageDark, stroke, typical, width });
	if (light) measured = measurePieces(keep, width, height);
	const { labels, count, pieces } = measured;
	const tenth = darkestTenth(labels, count, dark);
	const colorArea = COLOR_MIN_STROKES * stroke * stroke;
	const speckArea = SPECK_SHARE * stroke * stroke;
	const colors = inkColors(imageData, labels, count, lightInk, (label) => {
		return pieces[label - 1].area >= speckArea;
	});
	const pageColor = inkColor(pieces, colors, tenth, cut);

	const lightLabels = new Set();
	if (light) for (let i = 0; i < n; i++) if (light[i] && labels[i]) lightLabels.add(labels[i]);
	const letterShaped = (piece) => isLetterShaped(piece, stroke, typical);
	const reasons = pieces.map((piece) =>
		junkReason(piece, {
			dark: tenth[piece.label],
			color: colors[piece.label],
			pageDark,
			pageColor,
			stroke,
			typical,
			colorArea,
			light: lightLabels.has(piece.label),
		})
	);
	// A second pen (the felt-tip ran dry, the small letters went on in ballpoint): letters of one
	// other color are his too, with the dots of that color beside them
	const second = secondPen(pieces, reasons, colors, letterShaped);
	const drop = new Uint8Array(count + 1);
	const junk = [];
	pieces.forEach((piece, k) => {
		let why = reasons[k];
		if (why === 'colored' && second && colors[piece.label]) {
			const room = (piece.area >= colorArea ? 1 : 2) * COLOR_SHARE;
			const alike = colorOff(colors[piece.label], second) <= room;
			if (alike && (letterShaped(piece) || piece.area < colorArea)) why = '';
		}
		if (!why) return;
		drop[piece.label] = 1;
		junk.push({
			left: piece.left,
			top: piece.top,
			right: piece.right + 1,
			bottom: piece.bottom + 1,
			why,
		});
	});
	if (junk.length) for (let i = 0; i < n; i++) if (drop[labels[i]]) keep[i] = 0;
	return answer(keep, junk, pageDark / 255, stroke);
}

/**
 * Step 2b: a piece binarize found that is lighter than the page's ink (at least LIGHT_SHARE as
 * dark) and that the page cut kept under RESCUE_SHARE of, cut again against its own darkness;
 * when what that keeps is letter-shaped, it goes back in whole. Sets those pixels in `keep`.
 * @returns {Uint8Array | null} the pixels put back (null when none)
 */
function rescueLight(first, firstDark, { dark, keep, pageDark, stroke, typical, width }) {
	if (!(stroke > 0) || !(typical > 0)) return null;
	const { labels, count, sizes, border } = first;
	const kept = new Uint32Array(count + 1);
	for (let i = 0; i < labels.length; i++) if (keep[i] && labels[i]) kept[labels[i]]++;
	const want = [];
	for (let label = 1; label <= count; label++) {
		if (border[label] || firstDark[label] < LIGHT_SHARE * pageDark) continue;
		if (kept[label] >= RESCUE_SHARE * sizes[label]) continue;
		if (sizes[label] < SPECK_SHARE * stroke * stroke) continue;
		want.push(label);
	}
	if (!want.length) return null;
	const height = labels.length / width;
	const boxes = new Map();
	for (const label of want) boxes.set(label, { left: width, top: height, right: -1, bottom: -1 });
	for (let i = 0; i < labels.length; i++) {
		const box = boxes.get(labels[i]);
		if (!box) continue;
		const x = i % width;
		const y = (i - x) / width;
		if (x < box.left) box.left = x;
		if (x > box.right) box.right = x;
		if (y < box.top) box.top = y;
		if (y > box.bottom) box.bottom = y;
	}
	let out = null;
	for (const label of want) {
		const box = boxes.get(label);
		const w = box.right - box.left + 1;
		const h = box.bottom - box.top + 1;
		const at = (x, y) => (box.top + y) * width + box.left + x;
		// Its own pen pixels and their soft edge, inside the piece
		const cut = CORE_SHARE * firstDark[label];
		const core = new Uint8Array(w * h);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const i = at(x, y);
				if (labels[i] === label && dark[i] >= cut) core[y * w + x] = 1;
			}
		}
		const near = grow(core, w, h, EDGE_REACH_PX);
		const own = new Uint8Array(w * h);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) if (labels[at(x, y)] === label && near[y * w + x]) own[y * w + x] = 1;
		}
		const { pieces } = measurePieces(own, w, h);
		const body = pieces.reduce((best, p) => (!best || p.area > best.area ? p : best), null);
		// (measured in its own box, which it always touches: the photo's edge is checked above)
		if (!body || !isLetterShaped({ ...body, border: false }, stroke, typical)) continue;
		out ||= new Uint8Array(labels.length);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				if (!own[y * w + x]) continue;
				keep[at(x, y)] = 1;
				out[at(x, y)] = 1;
			}
		}
	}
	return out;
}

/** Shaped like a letter of the pen: its stroke near the pen's, letter-tall, not a long line. */
function isLetterShaped(piece, stroke, typical) {
	if (piece.border || !(stroke > 0) || !(typical > 0)) return false;
	const [low, high] = LETTER_STROKE_SHARES;
	if (piece.stroke < low * stroke || piece.stroke > high * stroke) return false;
	const span = Math.max(heightOf(piece), widthOf(piece));
	return heightOf(piece) >= LETTER_HEIGHT_SHARE * typical && span <= LETTER_SPAN_SHARE * typical;
}

/**
 * The color of a second pen: the per-channel area-weighted median of the letter-shaped pieces
 * judged 'colored', when at least SECOND_PEN_LETTERS of them are all close to it; else null.
 */
function secondPen(pieces, reasons, colors, letterShaped) {
	const letters = pieces.filter(
		(piece, k) => reasons[k] === 'colored' && colors[piece.label] && letterShaped(piece)
	);
	if (letters.length < SECOND_PEN_LETTERS) return null;
	const color = [0, 1, 2].map((c) =>
		weightedMiddle(letters.map((p) => ({ value: colors[p.label][c], weight: p.area })))
	);
	const alike = letters.filter((p) => colorOff(colors[p.label], color) <= COLOR_SHARE);
	return alike.length >= SECOND_PEN_LETTERS ? color : null;
}

/** How far one ink color is from another: the most any channel's share differs. */
function colorOff(color, other) {
	return Math.max(...color.map((share, c) => Math.abs(share - other[c])));
}

/** Why a piece is not the pen's ink, or '' when it is. */
function junkReason(
	piece,
	{ dark, color, pageDark, pageColor, stroke, typical, colorArea, light = false }
) {
	const span = Math.max(heightOf(piece), widthOf(piece));
	if (piece.border) {
		if (typical > 0 && span < EDGE_SPAN_SHARE * typical) return 'edge';
		if (dark < EDGE_DARK_SHARE * pageDark) return 'edge';
	}
	// A lighter letter put back whole (step 2b) is judged on its shape and color, not darkness
	if (!light && dark < FAINT_SHARE * pageDark) return 'faint';
	if (stroke > 0 && piece.stroke < THIN_SHARE * stroke && span >= THIN_LENGTH * piece.stroke) {
		return 'thin';
	}
	if (pageColor && color) {
		if (colorOff(color, pageColor) > (piece.area >= colorArea ? 1 : 2) * COLOR_SHARE) {
			return 'colored';
		}
	}
	return '';
}

/** Each label's darkness: the bottom of its darkest tenth of pixels (0..255). */
function darkestTenth(labels, count, dark) {
	const histogram = new Uint32Array((count + 1) * BINS);
	const sizes = new Uint32Array(count + 1);
	for (let i = 0; i < labels.length; i++) {
		const label = labels[i];
		if (!label) continue;
		histogram[label * BINS + (dark[i] >> 3)]++;
		sizes[label]++;
	}
	const out = new Float64Array(count + 1);
	for (let label = 1; label <= count; label++) {
		const want = Math.max(1, Math.ceil(sizes[label] * 0.1));
		let seen = 0;
		for (let bin = BINS - 1; bin >= 0; bin--) {
			seen += histogram[label * BINS + bin];
			if (seen >= want) {
				out[label] = bin * 8 + 4;
				break;
			}
		}
	}
	return out;
}

/** The page's ink darkness: the area-weighted median over the pieces inside the photo. */
function inkDarkness({ count, sizes, border }, darkness) {
	const all = [];
	for (let label = 1; label <= count; label++) {
		all.push({ value: darkness[label], weight: sizes[label], border: !!border[label] });
	}
	const inside = all.filter((p) => !p.border);
	return weightedMiddle(inside.length ? inside : all);
}

/** The value at half the total weight. */
function weightedMiddle(list) {
	const sorted = list.filter((p) => p.weight > 0).sort((a, b) => a.value - b.value);
	const total = sorted.reduce((sum, p) => sum + p.weight, 0);
	let seen = 0;
	for (const p of sorted) {
		seen += p.weight;
		if (seen >= total / 2) return p.value;
	}
	return 0;
}

/** A mask grown by `reach` pixels every way (a square), in two running-window passes. */
function grow(mask, width, height, reach) {
	const across = new Uint8Array(mask.length);
	for (let y = 0; y < height; y++) {
		const row = y * width;
		let inWindow = 0;
		for (let x = 0; x < Math.min(reach, width); x++) inWindow += mask[row + x];
		for (let x = 0; x < width; x++) {
			if (x + reach < width) inWindow += mask[row + x + reach];
			if (x - reach - 1 >= 0) inWindow -= mask[row + x - reach - 1];
			across[row + x] = inWindow > 0 ? 1 : 0;
		}
	}
	const out = new Uint8Array(mask.length);
	for (let x = 0; x < width; x++) {
		let inWindow = 0;
		for (let y = 0; y < Math.min(reach, height); y++) inWindow += across[y * width + x];
		for (let y = 0; y < height; y++) {
			if (y + reach < height) inWindow += across[(y + reach) * width + x];
			if (y - reach - 1 >= 0) inWindow -= across[(y - reach - 1) * width + x];
			out[y * width + x] = inWindow > 0 ? 1 : 0;
		}
	}
	return out;
}

/**
 * The color of every piece `read(label)` says to read: how much it takes from the paper's red,
 * green and blue, as shares of the most it takes ([r, g, b], the largest 1); null for a piece
 * not read or one that takes almost nothing.
 */
function inkColors(imageData, labels, count, lightInk, read) {
	const wanted = new Uint8Array(count + 1);
	let any = false;
	for (let label = 1; label <= count; label++) {
		if (read(label)) {
			wanted[label] = 1;
			any = true;
		}
	}
	const out = new Array(count + 1).fill(null);
	if (!any) return out;
	const { data, width, height } = imageData;
	const n = width * height;
	const sums = new Float64Array((count + 1) * 3);
	for (let c = 0; c < 3; c++) {
		const channel = new Uint8Array(n);
		for (let i = 0; i < n; i++) channel[i] = lightInk ? 255 - data[i * 4 + c] : data[i * 4 + c];
		const paper = estimatePaper(channel, width, height, { radiusFraction: PAPER_REACH_SHARE });
		for (let i = 0; i < n; i++) {
			const label = labels[i];
			if (!wanted[label]) continue;
			const p = paper[i];
			if (p > 0) sums[label * 3 + c] += Math.max(0, (p - channel[i]) / p);
		}
	}
	for (let label = 1; label <= count; label++) {
		if (!wanted[label]) continue;
		const takes = [sums[label * 3], sums[label * 3 + 1], sums[label * 3 + 2]];
		const most = Math.max(...takes);
		if (most > 0) out[label] = takes.map((v) => v / most);
	}
	return out;
}

/** The page's ink color: per channel, the area-weighted median over the pen's pieces. */
function inkColor(pieces, colors, tenth, cut) {
	const pens = pieces.filter((p) => colors[p.label] && tenth[p.label] >= cut);
	// (weighted by area, so the letters decide it; dots and bits barely count)
	const inside = pens.filter((p) => !p.border);
	const pick = inside.length ? inside : pens;
	if (!pick.length) return null;
	return [0, 1, 2].map((c) =>
		weightedMiddle(pick.map((p) => ({ value: colors[p.label][c], weight: p.area })))
	);
}
