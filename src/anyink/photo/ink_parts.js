// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-core: the parts of a photo, one per letter written on it, in reading order
	(docs/UX-BEGINNER.md 4.4 "Parts", section 10 B9). Pure: works on an ink mask (1 = ink,
	row-major, width x height image pixels, y down), no DOM, no editor. B3's stand-in
	(placement/tests/ink_parts_lite.js) is the reference rule; where this goes past it, it says so.

	The ink (photoInk): auto-trace's own binarize, then only the pen's ink (letter_ink.js; fix
	after the B8 + B9 first-timer walk: a finger smudge, a hand's shadow, punch holes and a
	notebook's ruled and margin lines each became parts, and the smudge under an e joined its
	part). The same photo and the same options always give the same mask, so the parts found
	again later (attachMasks) and a box he draws (partFromBox) read the same ink.

	The steps (findInk):
	1. Pieces: the mask's 4-connected ink pieces (ink_pieces.js measurePieces), each with its
	   box, its area and its stroke (2 x area / perimeter, the perimeter by Crofton's formula over
	   four directions, as B3's strokeWidthPx measures a part).
	2. The page edge, first (past the reference, which had no such rule: on a phone photo with
	   the table showing round the page, the table's band spans the photo and every letter joined
	   it into one part). From a first look at the pen (the stroke of the pieces that don't touch
	   the photo's edge) and the letters (the typical height of step 4, preferring those pieces
	   too), a piece that touches the photo's edge is no letter when it is more than EDGE_SHARE
	   typical heights tall or wide (the table, a page edge), or at least one typical height long
	   with a stroke under half or over EDGE_STROKE_SHARE times the pen's (a thin dark frame round
	   a close-up, a shadow). Dropped and listed (edges); only with 2 or more pieces, so a lone
	   letter filling the photo stays, and a letter cut by the photo's edge keeps its pen stroke
	   and stays too.
	3. The photo's stroke: the area-weighted median of the strokes of what is left. Letters carry
	   nearly all the ink, so specks and dots barely count.
	4. The typical letter height: the median height of the pieces at least TYPICAL_STROKES
	   strokes tall (letters and their big pieces; dots, periods and crossbars barely taller than
	   the pen don't pull it down), all pieces when none is. Past the reference: it took the median
	   of every piece, so a single i (a stem and its dot) had a typical height half its stem's.
	5. Specks (B11's rule, UX-BEGINNER section 10 B11): a piece smaller than SPECK_STROKE_SHARE
	   (a quarter) of the stroke squared that doesn't sit directly above or below another piece
	   (within the dot reach of step 6) is dropped and counted. A felt-tip dot is never that small
	   (the pen alone leaves about three quarters of the stroke squared). Past the reference: its
	   floor was a share of the photo's area (0.005 %), which on a 2000 x 1500 phone page is 150
	   px and drops an i dot of about 80, and on a 150 dpi scan drops periods and colon dots; the
	   stroke rule scales with the pen.
	6. Joining (the 4.4 rule, as the reference): two pieces are one letter when their left-to-
	   right spans overlap by at least half the narrower AND up and down they overlap by at least
	   SAME_LETTER_SHARE of the shorter (a crossbar, a pen lift); or one is a dot (no wider and
	   no taller than DOT_SHARE of the typical height) wholly above or below the other within
	   DOT_GAP_SHARE of the typical height, its middle at most DOT_REACH_SHARE of it to the side.
	   A dot joins only its nearest such piece, a letter before another dot, and another dot only
	   when one is right over the other (their left-to-right spans overlap; past the reference: in
	   a tight ". , ' ? ! - : ;" row the comma joined the apostrophe beside it, and the hyphen the
	   colon's top dot). So i, j, !, ?, :, ; and a drifted i dot stay one part, and letters one
	   under the other on a whole-alphabet page never join.
	7. Rows (past the reference, which used placement's plain up-and-down overlap: on a page
	   turned 6 degrees the end of one row reaches down beside the start of the next and the two
	   became one row): the photo's slope is the median of the slopes between each part and its
	   nearest neighbor to the right overlapping it up and down by ROW_SHARE of the shorter
	   (their tops and their bottoms, so a tail or a tall letter is outvoted), cut back to
	   MAX_ROW_TILT. With that slope taken out, rows go by where the letters sit, not by chains
	   of overlap (fix after the first-timer walk: one margin line, then a smudge-tall h, reached
	   from abcdefghi into jklmnopqr and made them one zigzag row, and the next row's apostrophe
	   chained to the tails above it): each letter's line starts at its middle and settles on the
	   middle of the middles within ROW_BAND_SHARE typical heights of it; lines within
	   ROW_SPLIT_SHARE are one row. A row's capitals, small letters and tails all lie within that
	   band of each other, while rows are well over a typical height apart. Marks (every part
	   under MARK_SHARE of the typical height: . , ' -) then join the nearest row whose body
	   reaches round them (from its taller tops to its writing line, ROW_BODY_SHARE up its tops
	   and its bottoms, so tails don't count) within half a typical height, with a letter within
	   ROW_REACH_SHARE typical heights left to right; the rest make rows of their own. Rows top to
	   bottom, parts left to right; each part carries its row number, which placement's groupRows
	   (seat.js) keeps.

	A part: { id, left, top, right, bottom, row, mask }: right and bottom exclusive, the box tight
	to its ink, ids p1, p2, ... in reading order; mask (right - left) x (bottom - top), holding
	only this part's own ink (not a neighbor's reaching into its box, not a speck).

	  photoInk(imageData, { paper, lightInk })  -> { mask, width, height, ink, junk }: auto-trace's
	      own binarize (autotrace/binarize.js) with the automatic ink cutoff and Remove specks on,
	      Scan or Photo mode by the paper (paper_kind.js), kept to the pen's ink (letter_ink.js):
	      mask, the pen's ink (parts, boxes he draws); ink, everything binarize marked (what to
	      paint out round a part before tracing it); junk, what was left out and why
	  findInk(mask, width, height)  -> { parts, rows: [[partId]], stroke, typical, slope,
	      specks (how many were dropped), edges: [{ left, top, right, bottom }] }
	  findParts(mask, width, height)  -> findInk's parts
	  partFromBox(mask, width, height, box, { ink })  -> the part a box he drew makes: every bit
	      of ink inside the box (cut at its edges), tightened; null when the box holds no ink. No
	      id or row (the registry gives them). With ink (photoInk's, everything binarize marked),
	      a box round ink the pen's mask holds under BOX_INK_SHARE of reads all of it: a letter
	      written lighter or in another pen (finalize, after the second hostile pass: a box round
	      the visible blue a said "No ink found", one round a light C shrank to a 10 x 7 bit), so
	      Draw a box always reaches what he sees. fullInk: true on such a part.
	  boxInk(mask, ink, width, box)  -> the mask a box he drew reads (mask or ink, as above)
	  partAt(parts, x, y, { reach })  -> the part under a click (its box grown by reach image
	      pixels), the smallest when boxes overlap; null on bare paper
	  rowForBox(parts, box)  -> the row a drawn box joins: the row it overlaps most up and down,
	      nearer parts counting more; else a new row after the last
	  storedPart(part)  -> { id, left, top, right, bottom, row } (and drawn: true), plain numbers
	      for the work file (photo_registry.js); masks are never stored
	  attachMasks(stored, mask, width, height, { ink })  -> the stored parts with their masks
	      back: found again on the same photo (the same mask finds the same parts, box for box), a
	      drawn box or an unmatched part cut from the mask inside its box (a drawn box reads as
	      partFromBox does)
*/
import { binarize } from '../autotrace/binarize.js';
import {
	TYPICAL_STROKES,
	heightOf,
	measurePieces,
	median,
	preferInside,
	typicalHeight,
	weightedMedian,
	widthOf,
} from './ink_pieces.js';
import { letterInk } from './letter_ink.js';

export { TYPICAL_STROKES };

/** A piece smaller than this share of the stroke squared is a speck (B11). */
export const SPECK_STROKE_SHARE = 0.25;

/** A piece touching the photo's edge more than this many typical heights tall or wide is not ink. */
export const EDGE_SHARE = 3;

/** ...nor one at least a typical height long whose stroke is off the pen's by this factor. */
export const EDGE_STROKE_SHARE = 2;

/** Two pieces that overlap up and down by this share of the shorter one are one letter. */
export const SAME_LETTER_SHARE = 0.5;

/** A dot is no wider and no taller than this share of the typical height... */
export const DOT_SHARE = 0.4;

/** ...and joins the nearest piece above or below it within this share of that height... */
export const DOT_GAP_SHARE = 0.6;

/** ...with its middle no further to the side of that piece than this share of the height. */
export const DOT_REACH_SHARE = 0.3;

/** A dot under a piece joins it only within this share of the typical height under it (! ?)... */
export const DOT_UNDER_GAP = 0.4;

/** ...and the dot's middle is under the ink of its bottom this share of its height... */
export const DOT_UNDER_BAND = 0.2;

/** ...give or take a stroke, or this share of the typical height when that is more. */
export const DOT_UNDER_REACH = 0.15;

/** Neighbors for the slope overlap up and down by this share of the shorter one... */
export const ROW_SHARE = 0.5;

/** ...the nearest part to the right within this many typical heights. */
export const SLOPE_REACH_SHARE = 3;

/** A row's line is the middle of the middles within this share of the typical height of it. */
export const ROW_BAND_SHARE = 0.6;

/** Lines further apart than this share of the typical height are different rows. */
export const ROW_SPLIT_SHARE = 0.25;

/** A mark joins a row with a letter within this many typical heights of it left to right... */
export const ROW_REACH_SHARE = 6;

/** ...whose body (this share up its tops, and up its bottoms) reaches round the mark. */
export const ROW_BODY_SHARE = 0.3;

/** A part under this share of the typical height is a mark (. , ' -): it doesn't set the slope. */
export const MARK_SHARE = 0.4;

/** A box he draws reads all the ink when the pen's mask holds under this share of it. */
export const BOX_INK_SHARE = 0.35;

/** The steepest slope believed for rows (10 degrees). */
export const MAX_ROW_TILT = Math.tan((10 * Math.PI) / 180);

// --------------------------------------------------------------
// Ink
// --------------------------------------------------------------

/**
 * The photo's ink as the parts finder sees it.
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageData
 * @param {{paper?: 'scan' | 'photo', lightInk?: Boolean}} [options]
 * @returns {{mask: Uint8Array, width: Number, height: Number}}
 */
export function photoInk(imageData, { paper = 'scan', lightInk = false } = {}) {
	const found = binarize(imageData, {
		mode: paper === 'photo' ? 'photo' : 'scan',
		threshold: 'auto',
		despeckle: true,
		invert: !!lightInk,
	});
	const { width, height } = found;
	const letters = letterInk(imageData, found.mask, { lightInk: !!lightInk });
	return { mask: letters.mask, width, height, ink: found.mask, junk: letters.junk };
}

// --------------------------------------------------------------
// Parts
// --------------------------------------------------------------

/**
 * @param {Uint8Array} mask - 1 = ink
 * @param {Number} width
 * @param {Number} height
 * @returns {{parts: Array<Object>, rows: Array<Array<String>>, stroke: Number, typical: Number,
 *   slope: Number, specks: Number, edges: Array<Object>}}
 */
export function findInk(mask, width, height) {
	const empty = { parts: [], rows: [], stroke: 0, typical: 0, slope: 0, specks: 0, edges: [] };
	if (!(width > 0) || !(height > 0) || !mask || mask.length < width * height) return empty;
	const measured = measurePieces(mask, width, height);
	const { labels } = measured;
	if (!measured.count) return empty;

	// 1. Pieces with their boxes and strokes
	let pieces = measured.pieces;

	// 2. The page edge, the table, a frame, from a first look at the pen and the letters
	const edges = [];
	const firstStroke = weightedMedian(preferInside(pieces));
	const firstSolid = pieces.filter((p) => p.area >= SPECK_STROKE_SHARE * firstStroke ** 2);
	const firstTypical = typicalHeight(firstSolid, firstStroke, { preferInside: true });
	if (firstSolid.length >= 2 && firstTypical > 0) {
		pieces = pieces.filter((p) => {
			const edge = isEdge(p, firstStroke, firstTypical);
			if (edge) edges.push({ left: p.left, top: p.top, right: p.right + 1, bottom: p.bottom + 1 });
			return !edge;
		});
	}

	// 3. The photo's stroke, from what is left
	const stroke = weightedMedian(pieces);

	// 4. The typical height; 5. specks
	const speckArea = SPECK_STROKE_SHARE * stroke * stroke;
	const small = (p) => p.area < speckArea;
	const solid = pieces.filter((p) => !small(p));
	const typical = typicalHeight(solid, stroke);
	// A small piece directly over or under a solid one stays (a dot); the rest are specks
	let specks = 0;
	const under = { labels, width, stroke, spans: new Map() };
	pieces = pieces.filter((p) => {
		if (!small(p)) return true;
		const keep = solid.some((other) => dotReach(p, other, typical, under) !== null);
		if (!keep) specks++;
		return keep;
	});

	// 6. Join the pieces of one letter
	const groups = joinPieces(pieces, typical, under);
	const parts = groups.map((group) => cutPart(group, labels, width));

	// 7. Rows and reading order
	const { rows, slope } = sortIntoRows(parts, typical);
	const ordered = [];
	rows.forEach((row, r) =>
		row.forEach((part) => {
			part.row = r;
			ordered.push(part);
		})
	);
	ordered.forEach((part, i) => (part.id = `p${i + 1}`));
	return {
		parts: ordered,
		rows: rows.map((row) => row.map((part) => part.id)),
		stroke,
		typical,
		slope,
		specks,
		edges,
	};
}

/**
 * @param {Uint8Array} mask
 * @param {Number} width
 * @param {Number} height
 * @returns {Array<Object>} parts in reading order
 */
export function findParts(mask, width, height) {
	return findInk(mask, width, height).parts;
}

/**
 * Step 5: a piece touching the photo's edge that is no letter: more than EDGE_SHARE typical
 * heights tall or wide (the table round a page, a page edge), or at least a typical height
 * tall or wide with a stroke under half or over EDGE_STROKE_SHARE times the pen's (a thin
 * frame line round a close-up, a shadow).
 */
function isEdge(p, stroke, typical) {
	if (!p.border) return false;
	const span = Math.max(heightOf(p), widthOf(p));
	if (span > EDGE_SHARE * typical) return true;
	const odd = p.stroke < stroke / EDGE_STROKE_SHARE || p.stroke > stroke * EDGE_STROKE_SHARE;
	return odd && span >= typical;
}

/**
 * How far a dot sits from another piece, when it is wholly above or below it, close and nearly
 * over it (null otherwise): the gap up or down plus the distance to the side.
 * B10 + B11 finalize (the critic's stray pen dot under the row joined the r above it; the r was
 * then seated on the dot and floated, and the row split in two): a dot under a piece is only the
 * dot of ! or ?, so it joins a piece above it only within DOT_UNDER_GAP typical heights under
 * it (the ! and ? dots of the fixtures sit 0.16 to 0.24 under; the stray dot 0.48) and with its
 * middle under the piece's lowest ink (its bottom
 * DOT_UNDER_BAND, give or take a stroke or DOT_UNDER_REACH typical heights). Dots above (i, j,
 * the upper dot of a colon) are as before.
 */
function dotReach(dot, other, typical, under = null) {
	if (other === dot) return null;
	const gap = -upDown(dot, other);
	if (gap < 0 || gap > DOT_GAP_SHARE * typical) return null;
	const middle = (dot.left + dot.right) / 2;
	if (under && dot.top > other.bottom) {
		if (gap > DOT_UNDER_GAP * typical) return null;
		const span = lowSpan(other, under);
		const reach = Math.max(under.stroke || 0, DOT_UNDER_REACH * typical);
		const aside = Math.max(0, span.left - middle, middle - span.right);
		return aside > reach ? null : gap + aside;
	}
	const aside = Math.max(0, other.left - middle, middle - other.right);
	if (aside > DOT_REACH_SHARE * typical) return null;
	return gap + aside;
}

/** The left-to-right span of a piece's ink in its bottom DOT_UNDER_BAND (kept per piece) */
function lowSpan(piece, under) {
	const known = under.spans.get(piece);
	if (known) return known;
	const { labels, width } = under;
	const from = Math.max(piece.top, Math.floor(piece.bottom - DOT_UNDER_BAND * heightOf(piece)));
	let left = Infinity;
	let right = -Infinity;
	for (let y = from; y <= piece.bottom; y++) {
		const row = y * width;
		for (let x = piece.left; x <= piece.right; x++) {
			if (labels[row + x] !== piece.label) continue;
			if (x < left) left = x;
			if (x > right) right = x;
		}
	}
	const span = left <= right ? { left, right } : { left: piece.left, right: piece.right };
	under.spans.set(piece, span);
	return span;
}

/** Up and down: how much two boxes overlap (negative: the gap between them), inclusive boxes. */
function upDown(a, b) {
	return Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + 1;
}

/** Groups of pieces, one per letter (step 6). */
function joinPieces(pieces, typical, under = null) {
	const parent = pieces.map((_, i) => i);
	const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
	const across = (a, b) =>
		Math.min(a.right, b.right) - Math.max(a.left, b.left) + 1 >=
		0.5 * Math.min(widthOf(a), widthOf(b));
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
	const isDot = (box) =>
		widthOf(box) <= DOT_SHARE * typical && heightOf(box) <= DOT_SHARE * typical;
	pieces.forEach((dot, i) => {
		if (!isDot(dot)) return;
		let best = null;
		pieces.forEach((other, j) => {
			const reach = dotReach(dot, other, typical, under);
			if (reach === null) return;
			// Two dots join only one right over the other (the dots of a colon), never a mark
			// written beside a dot (a tight ". , ' -" row: the comma under the apostrophe's
			// corner, the hyphen beside a colon's top dot)
			if (isDot(other) && Math.min(dot.right, other.right) < Math.max(dot.left, other.left)) {
				return;
			}
			// A letter beats another dot (the dots of a colon join each other only alone)
			const rank = [isDot(other) ? 1 : 0, reach];
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
	return [...groups.values()];
}

/** A part from its pieces: the tight box and a mask of only its own ink. */
function cutPart(group, labels, width) {
	const left = Math.min(...group.map((p) => p.left));
	const top = Math.min(...group.map((p) => p.top));
	const right = Math.max(...group.map((p) => p.right)) + 1;
	const bottom = Math.max(...group.map((p) => p.bottom)) + 1;
	const own = new Set(group.map((p) => p.label));
	const w = right - left;
	const mask = new Uint8Array(w * (bottom - top));
	for (let y = top; y < bottom; y++) {
		const row = y * width;
		const out = (y - top) * w - left;
		for (let x = left; x < right; x++) if (own.has(labels[row + x])) mask[out + x] = 1;
	}
	return { left, top, right, bottom, mask };
}

// --------------------------------------------------------------
// Rows
// --------------------------------------------------------------

/**
 * @param {Array<Object>} parts - boxes (right, bottom exclusive)
 * @param {Number} typical
 * @returns {{rows: Array<Array<Object>>, slope: Number}}
 */
function sortIntoRows(parts, typical) {
	if (!parts.length) return { rows: [], slope: 0 };
	const h = (p) => p.bottom - p.top;
	const cx = (p) => (p.left + p.right) / 2;
	const gapX = (a, b) => Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
	const overlap = (aTop, aBottom, bTop, bBottom) =>
		Math.min(aBottom, bBottom) - Math.max(aTop, bTop);
	const body = (p) => h(p) >= MARK_SHARE * typical;

	// The slope: each part and its nearest neighbor to the right in the same row
	const slopes = [];
	for (const a of parts) {
		if (!body(a)) continue;
		let best = null;
		for (const b of parts) {
			if (b === a || !body(b) || cx(b) <= cx(a)) continue;
			if (overlap(a.top, a.bottom, b.top, b.bottom) < ROW_SHARE * Math.min(h(a), h(b))) continue;
			const gap = gapX(a, b);
			if (gap > SLOPE_REACH_SHARE * typical) continue;
			if (!best || cx(b) < cx(best)) best = b;
		}
		if (!best) continue;
		const run = cx(best) - cx(a);
		slopes.push((best.top - a.top) / run, (best.bottom - a.bottom) / run);
	}
	const raw = slopes.length ? median(slopes) : 0;
	const slope = Math.max(-MAX_ROW_TILT, Math.min(MAX_ROW_TILT, raw));

	// Each part's middle and its top and bottom, the slope taken out
	const shift = (p) => slope * cx(p);
	const middle = parts.map((p) => (p.top + p.bottom) / 2 - shift(p));
	const unit = Math.max(1, typical);
	const all = parts.map((_, i) => i);

	// Rows of letters: the line each letter's middle settles on; lines that meet are one row
	const rows = linesOf(
		all.filter((i) => body(parts[i])),
		middle,
		unit
	);

	// A mark joins the row whose letters' body reaches round it: from the tops of its taller
	// letters to its writing line (a low share of the tops and of the bottoms, so tails and a
	// stray tall letter don't stretch it). An apostrophe sits on the capitals line of its own
	// row however near the tails of the row above hang; a period and a comma sit on the writing
	// line. The nearest such row within half a typical height, with a letter near the mark left
	// to right; the rest make rows of their own.
	const bands = rows.map((row) => ({
		top: lowShare(row.map((i) => parts[i].top - shift(parts[i]))),
		bottom: lowShare(row.map((i) => parts[i].bottom - shift(parts[i]))),
	}));
	const reach = ROW_REACH_SHARE * unit;
	const loose = [];
	for (const i of all.filter((k) => !body(parts[k]))) {
		let best = null;
		bands.forEach((band, r) => {
			const distance = Math.max(0, band.top - middle[i], middle[i] - band.bottom);
			if (distance > 0.5 * unit) return;
			if (!rows[r].some((j) => body(parts[j]) && gapX(parts[i], parts[j]) <= reach)) return;
			const aside = Math.abs(middle[i] - (band.top + band.bottom) / 2);
			if (!best || distance < best.distance || (distance === best.distance && aside < best.aside)) {
				best = { r, distance, aside };
			}
		});
		if (best) rows[best.r].push(i);
		else loose.push(i);
	}
	rows.push(...linesOf(loose, middle, unit));

	const lineOf = (row) => median(row.map((i) => middle[i]));
	rows.sort((a, b) => lineOf(a) - lineOf(b));
	return {
		rows: rows.map((row) =>
			row.map((i) => parts[i]).sort((a, b) => a.left - b.left || a.top - b.top)
		),
		slope,
	};
}

/** The value a ROW_BODY_SHARE of the way up a list (the low end, y down: the higher tops). */
function lowShare(values) {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(ROW_BODY_SHARE * (sorted.length - 1))];
}

/**
 * Rows by where the parts sit: each part's line starts at its own middle and moves to the
 * middle of the middles within ROW_BAND_SHARE typical heights of it, until it settles; lines
 * closer than ROW_SPLIT_SHARE typical heights are one row. A row's letters settle on one line
 * (capitals, small letters and tails all lie within the band of each other), while a tall piece
 * reaching into the next row settles on one row or alone, never joining the two (the old rule
 * chained any up-and-down overlap, so one margin line or a long tail made two rows one).
 * @param {Array<Number>} indices - parts
 * @param {Array<Number>} middle - every part's middle, the slope taken out
 * @param {Number} unit - the typical height (at least 1)
 * @returns {Array<Array<Number>>} rows of indices, top to bottom
 */
function linesOf(indices, middle, unit) {
	if (!indices.length) return [];
	const band = ROW_BAND_SHARE * unit;
	const sorted = indices.map((i) => middle[i]).sort((a, b) => a - b);
	// The first index at or above a value, by halving
	const firstFrom = (value) => {
		let lo = 0;
		let hi = sorted.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (sorted[mid] < value) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	};
	const settle = (start) => {
		let line = start;
		for (let pass = 0; pass < 64; pass++) {
			const lo = firstFrom(line - band);
			const hi = firstFrom(line + band + 1e-9) - 1;
			const next = (sorted[(lo + hi) >> 1] + sorted[(lo + hi + 1) >> 1]) / 2;
			if (Math.abs(next - line) < 1e-6) break;
			line = next;
		}
		return line;
	};
	const settled = indices
		.map((i) => ({ i, line: settle(middle[i]) }))
		.sort((a, b) => a.line - b.line || middle[a.i] - middle[b.i]);
	const rows = [];
	let last = -Infinity;
	for (const { i, line } of settled) {
		if (!rows.length || line - last > ROW_SPLIT_SHARE * unit) rows.push([]);
		rows[rows.length - 1].push(i);
		last = line;
	}
	return rows;
}

// --------------------------------------------------------------
// A box he draws, a click, the work file
// --------------------------------------------------------------

/**
 * @param {Uint8Array} mask
 * @param {Number} width
 * @param {Number} height
 * @param {{left: Number, top: Number, right: Number, bottom: Number}} box - image pixels
 * @returns {{left: Number, top: Number, right: Number, bottom: Number, mask: Uint8Array} | null}
 */
export function partFromBox(mask, width, height, box, { ink } = {}) {
	const area = clampBox(box, width, height);
	if (!area || !mask) return null;
	const read = boxInk(mask, ink, width, area);
	const full = read !== mask;
	mask = read;
	let left = area.right;
	let top = area.bottom;
	let right = area.left - 1;
	let bottom = area.top - 1;
	for (let y = area.top; y < area.bottom; y++) {
		const row = y * width;
		for (let x = area.left; x < area.right; x++) {
			if (!mask[row + x]) continue;
			if (x < left) left = x;
			if (x > right) right = x;
			if (y < top) top = y;
			if (y > bottom) bottom = y;
		}
	}
	if (right < left) return null;
	const tight = { left, top, right: right + 1, bottom: bottom + 1 };
	const part = { ...tight, mask: cutMask(mask, width, tight) };
	if (full) part.fullInk = true;
	return part;
}

/**
 * The ink a box he drew reads: the pen's mask, or all the ink binarize found when the mask holds
 * under BOX_INK_SHARE of what is inside the box.
 * @param {Uint8Array} mask - the pen's ink
 * @param {Uint8Array | null | undefined} ink - all the ink (photoInk's ink)
 * @param {Number} width
 * @param {{left: Number, top: Number, right: Number, bottom: Number}} box - whole pixels inside
 * @returns {Uint8Array}
 */
export function boxInk(mask, ink, width, box) {
	if (!(ink instanceof Uint8Array) || ink === mask || ink.length !== mask?.length) return mask;
	let pen = 0;
	let all = 0;
	for (let y = box.top; y < box.bottom; y++) {
		const row = y * width;
		for (let x = box.left; x < box.right; x++) {
			pen += mask[row + x] ? 1 : 0;
			all += ink[row + x] ? 1 : 0;
		}
	}
	return all > 0 && pen < BOX_INK_SHARE * all ? ink : mask;
}

/**
 * @param {Array<Object>} parts
 * @param {Number} x - image pixels
 * @param {Number} y
 * @param {{reach?: Number}} [options] - grow every box by this many pixels
 * @returns {Object | null}
 */
export function partAt(parts, x, y, { reach = 0 } = {}) {
	let best = null;
	let bestArea = Infinity;
	for (const part of parts || []) {
		if (!part) continue;
		const r = Math.max(0, Number(reach) || 0);
		if (x < part.left - r || x >= part.right + r || y < part.top - r || y >= part.bottom + r) {
			continue;
		}
		const area = (part.right - part.left) * (part.bottom - part.top);
		if (area < bestArea) {
			best = part;
			bestArea = area;
		}
	}
	return best;
}

/**
 * @param {Array<Object>} parts - with row numbers
 * @param {{left: Number, top: Number, right: Number, bottom: Number}} box
 * @returns {Number} a row number
 */
export function rowForBox(parts, box) {
	const list = (parts || []).filter((p) => p && Number.isInteger(p.row));
	if (!list.length) return 0;
	const tall = Math.max(1, box.bottom - box.top);
	const score = new Map();
	for (const part of list) {
		const shared = Math.min(box.bottom, part.bottom) - Math.max(box.top, part.top);
		if (shared <= 0) continue;
		const gap = Math.max(0, Math.max(box.left, part.left) - Math.min(box.right, part.right));
		const value = shared / (1 + gap / tall);
		score.set(part.row, Math.max(score.get(part.row) || 0, value));
	}
	let best = null;
	for (const [row, value] of score) {
		if (!best || value > best.value || (value === best.value && row < best.row)) {
			best = { row, value };
		}
	}
	return best ? best.row : Math.max(...list.map((p) => p.row)) + 1;
}

/**
 * @param {Object} part
 * @returns {{id: String, left: Number, top: Number, right: Number, bottom: Number, row: Number,
 *   drawn?: true}}
 */
export function storedPart(part) {
	const out = {
		id: String(part.id),
		left: part.left,
		top: part.top,
		right: part.right,
		bottom: part.bottom,
		row: Number.isInteger(part.row) ? part.row : 0,
	};
	if (part.drawn) out.drawn = true;
	return out;
}

/**
 * @param {Array<Object>} stored - storedPart objects
 * @param {Uint8Array} mask - the photo's ink (photoInk), as when the parts were found
 * @param {Number} width
 * @param {Number} height
 * @returns {Array<Object>} new objects: the stored fields plus mask
 */
export function attachMasks(stored, mask, width, height, { ink } = {}) {
	const list = Array.isArray(stored) ? stored : [];
	const found = list.some((part) => part && !part.drawn) ? findParts(mask, width, height) : [];
	const byBox = new Map(found.map((p) => [`${p.left},${p.top},${p.right},${p.bottom}`, p]));
	return list.map((part) => {
		const match = !part.drawn && byBox.get(`${part.left},${part.top},${part.right},${part.bottom}`);
		if (match) return { ...part, mask: match.mask };
		const area = clampBox(part, width, height);
		const box = area || { left: 0, top: 0, right: 0, bottom: 0 };
		const read = area && part.drawn ? boxInk(mask, ink, width, area) : mask;
		const out = { ...part, ...box, mask: area ? cutMask(read, width, area) : new Uint8Array(0) };
		if (read !== mask) out.fullInk = true;
		return out;
	});
}

/** The whole-pixel part of a box inside the image; null when nothing is left. */
function clampBox(box, width, height) {
	if (!box) return null;
	const left = Math.max(0, Math.floor(Number(box.left)));
	const top = Math.max(0, Math.floor(Number(box.top)));
	const right = Math.min(width, Math.ceil(Number(box.right)));
	const bottom = Math.min(height, Math.ceil(Number(box.bottom)));
	if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) {
		return null;
	}
	return { left, top, right, bottom };
}

/** Every bit of ink inside a box (in the image), as a mask the size of the box. */
function cutMask(mask, width, box) {
	const w = box.right - box.left;
	const out = new Uint8Array(w * (box.bottom - box.top));
	for (let y = box.top; y < box.bottom; y++) {
		const row = y * width;
		const at = (y - box.top) * w - box.left;
		for (let x = box.left; x < box.right; x++) if (mask[row + x]) out[at + x] = 1;
	}
	return out;
}
