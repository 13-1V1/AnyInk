// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK placement: seating a part of a photo on the writing line (UX-BEGINNER 4.4, B3). Pure:
	no DOM, no editor.

	A part is one letter's ink in a photo, in image pixels (y down):
	  { id, left, top, right, bottom,      box; right and bottom are exclusive
	    mask?,                             Uint8Array, (right - left) x (bottom - top), 1 = ink,
	                                       holding only this part's ink (needed for the body
	                                       bottom of a letter with a tail)
	    row? }                             row number, when the photo already sorted its rows
	A box with a mask is tightened to the ink.

	Rules:
	- Rows (groupRows): two parts share a row when their vertical spans overlap by at least half
	  the shorter one; rows chain through shared parts, so a period and an apostrophe join the
	  row through a capital. Rows top to bottom, parts left to right. A photo whose parts carry
	  row numbers keeps them.
	- Writing lines (writingLines): each row's writing line is a straight line, sloped as the
	  photo is (a phone held a little off square turns every row by the same angle). It runs
	  through the bottoms of the parts that sit on the line: unnamed parts, and named letters
	  whose bottom is on the line (left out: a tail that is on or might be, g j p q y, and Q J f
	  until [No tail] is known; an apostrophe, a hyphen, brackets). Where a part's bottom is: the
	  middle of its lowest row of ink. One slope for the whole photo, from the letters' bottoms
	  only (a part under MARK_SHARE of the typical part's height is a mark, . , ' -, and votes
	  only on its row's height): first a rough slope, the repeated median of the slopes between
	  bottoms in the same row, which one letter in four written high or low can't move; then
	  the least-squares slope through the bottoms within OUTLIER_SPREADS of the rough line. Cut
	  back to MAX_TILT, and level when fewer than MIN_SLOPE_BOTTOMS letter bottoms share rows
	  (three can't tell a tilt from one letter written high). Each row's height: the median of
	  all its bottoms against that slope. A bottom hanging under the line by more than
	  TAIL_DROP_SHARE of its part's height (an unnamed tail) or over it by more than
	  FLOAT_DROP_SHARE of the typical part's height (an unnamed apostrophe or hyphen) is left
	  out and the lines are fitted again. A row has a writing line only with MIN_ROW_BOTTOMS
	  bottoms on it. The line "at" a letter is its height under the middle of the letter
	  (lineAt).
	- Partner line (rowPartnerLine): in a row with no writing line, the 1 or 2 other named
	  letters that sit on the line, at the photo's slope.
	- Seat (D-034, after the 10/14/2026 first-timer lens): every letter's body bottom sits on
	  its class bottom (the writing line; round letters 1.5 % under), wherever on the page it
	  was written. A letter written a little high or low would otherwise float or sink in every
	  word of the font. The row's line serves only where the letter's shape can't show its body
	  bottom (a tail with no bowl), for the tail guess, and for sizing.
	- Body bottom (bodyBottom). With no tail: the ink bottom, held square (levelBottom: the
	  lowest ink measured across the photo's slope, at the middle of the letter, so a turned
	  photo seats a letter where a square one would), but never more than LEVEL_HOLD_SHARE of
	  the letter box (in pixels at the photo's scale) from the lowest ink itself: the traced
	  letter keeps the photo's turn, so at 5 or 6 degrees a letter whose feet end up level
	  would float by the turn (B3 finalize: an A +56 units at 5 degrees). A Q, J or f whose tail
	  the guess left off sits on its body, not on its tail end: a Q whose ink hangs under its
	  bowl by more than BOWL_AGREE_SHARE of its body on its bowl ('counter'); a J or f whose ink
	  hangs under its row's line (or its partner line) by more than that and more than
	  LINE_TRUST_SPREADS times the photo's spread on that line ('row' / 'partner'), so a J or f
	  merely written low in a messy hand keeps its ink. His [No tail] puts it back on its ink.
	  With a tail on, in this order:
	    1. 'counter': the letter has a bowl (a hole, in the top 60 % of the letter, at least 1 %
	       of its box): the body bottom is the bowl hole's bottom plus one stroke (the thinner
	       of the strokes under and over the hole). Exact for g p q Q, round or not, whatever
	       the tail does, unless the row has a writing line and the bowl ends more than
	       BOWL_AGREE_SHARE of the body off it: a handwritten bowl often closes above the line
	       (B3 finalize: p's top 820 against n's 1068). Only when they disagree by more than
	       LINE_TRUST_SPREADS times the photo's spread too, though: a messy hand writes whole
	       letters high and low, and then the letter's own bowl is the better guess.
	    2. 'row': its row's writing line, under the middle of the letter.
	    3. 'partner': its row's partner line (a dropping f beside an a).
	    4. 'width': halfWidthBottom, the literal UX-BEGINNER rule (the lowest row where the ink
	       still spans at least half the letter's width), only when the photo's scale comes
	       from other letters and the rule lands within 15 % of where that scale puts the body
	       bottom.
	    5. 'scale': where the photo's scale (from other letters) puts it: ink top + body height.
	    6. 'span': alone in its photo, the letter's own height split at the share its lines
	       give it (g: small-letter line / (small-letter line - tail end)).
	  Why not the literal rule alone: a g whose tail hooks back as wide as its bowl, a j, a y
	  (a V narrows to the line), a dropping f (crossbar and bottom hook) and a round Q bowl
	  (it narrows before its bottom: 7 % of the bowl too high) all seat wrong with it.
	- Tail guess (guessTail) for Q J f: on when the ink hangs below the body by more than 15 %
	  of the body (the row line or the partner line, or the bowl when there is one), or by
	  more than 20 % of the body that the scale from other letters gives. Alone with no bowl,
	  no tail.
	- seatTraceY: the trace's y (font units of the photo's top edge, y up) that puts the body
	  bottom ('bottom' seat), the ink top ('top' seat) or the ink middle ('center' seat) on its
	  line: y = target + pixelRow * scale.
*/
import { labelPieces } from '../autotrace/binarize.js';
import { lineTargets, tailKind } from './classes.js';

/** A row has a writing line only with at least this many bottoms on it. */
export const MIN_ROW_BOTTOMS = 3;

/**
 * The photo's slope needs at least this many letter bottoms in rows of 2 or more; fewer:
 * level. With 3, one letter written a little high or low is a third of the evidence and
 * tilts the line on its own; from 4 the repeated median outvotes it.
 */
export const MIN_SLOPE_BOTTOMS = 4;

/**
 * A part shorter than this share of the typical part on the lines is a mark (. , ' -): its
 * bottom counts for its row's height but not for the slope.
 */
export const MARK_SHARE = 0.4;

/** The steepest slope believed (6 degrees): a phone held further off square is cut back to it. */
export const MAX_TILT = Math.tan((6 * Math.PI) / 180);

/** A bottom this share of its part's height under the fitted line is a tail: left out. */
export const TAIL_DROP_SHARE = 0.25;

/**
 * A bottom this share of the typical part's height over the fitted line floats (an unnamed
 * apostrophe or hyphen): left out. Measured against the typical part, not its own height, so
 * a small period written a little high still counts.
 */
export const FLOAT_DROP_SHARE = 0.25;

/**
 * The fine slope leaves out letters further off the rough line than this many spreads (the
 * usual distance of a bottom from it), and never closer than OUTLIER_FLOOR_SHARE of the
 * typical part's height.
 */
export const OUTLIER_SPREADS = 2.5;
export const OUTLIER_FLOOR_SHARE = 0.03;

/** Two parts share a row when their vertical overlap is at least this share of the shorter. */
export const ROW_OVERLAP_SHARE = 0.5;

/**
 * The square bottom stays within this share of the letter box of the lowest ink (the traced
 * letter keeps the photo's turn).
 */
export const LEVEL_HOLD_SHARE = 0.01;

/**
 * A bowl seat and a row line, or a Q J f ink bottom and its line or bowl, agree within this
 * share of the body (about 2 % of the letter box for a small letter)...
 */
export const BOWL_AGREE_SHARE = 0.04;

/**
 * ...and a line is believed over the letter's own bowl or ink only when they disagree by more
 * than this many times the photo's spread (how far his letters usually sit off their lines): a
 * messy hand writes whole letters high and low, a neat one closes a bowl above a tight line.
 */
export const LINE_TRUST_SPREADS = 2.5;

/** The literal rule: the body ends at the lowest row whose ink spans this share of the width. */
export const HALF_WIDTH_SHARE = 0.5;

/** The literal rule's answer is used when it is within this share of the scale's body height. */
export const BODY_AGREE_SHARE = 0.15;

/** A tail is guessed when the ink hangs below the body by more than this share of the body. */
export const TAIL_GUESS_SHARE = 0.15;

/** The same, when the body comes only from the scale of other letters (less exact). */
export const TAIL_GUESS_SCALE_SHARE = 0.2;

/** A bowl hole is at least this share of the part's box (and MIN_COUNTER_PX pixels)... */
export const MIN_COUNTER_SHARE = 0.01;
export const MIN_COUNTER_PX = 16;

/** ...and its middle is in this top share of the letter (a looped tail is lower). */
export const COUNTER_TOP_SHARE = 0.6;

const geometryCache = new WeakMap();

/**
 * The part's box, tightened to its ink when it has a mask.
 * @param {Object} part
 * @returns {{left: Number, top: Number, right: Number, bottom: Number, width: Number,
 *   height: Number, mask: Uint8Array | null}} the mask is cut to the tight box; null when the
 *   part has none. null for a part with no size.
 */
export function partGeometry(part) {
	if (!part || typeof part !== 'object') return null;
	const left = Number(part.left);
	const top = Number(part.top);
	const right = Number(part.right);
	const bottom = Number(part.bottom);
	const cached = geometryCache.get(part);
	if (
		cached &&
		cached.source === part.mask &&
		cached.box.every((value, i) => value === [left, top, right, bottom][i])
	) {
		return cached.geometry;
	}
	if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) {
		return null;
	}
	let geometry = {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
		mask: null,
	};
	const mask = part.mask;
	if (mask && mask.length === geometry.width * geometry.height) {
		geometry = tighten(geometry, mask) || geometry;
	}
	geometryCache.set(part, { source: part.mask, box: [left, top, right, bottom], geometry });
	return geometry;
}

/** What is worked out once per part shape (the bowl hole search labels every pixel). */
const measureCache = new WeakMap();
function measured(g, key, work) {
	let entry = measureCache.get(g);
	if (!entry) measureCache.set(g, (entry = {}));
	if (!(key in entry)) entry[key] = work();
	return entry[key];
}

/**
 * How far the ink reaches across each pixel row: rightmost - leftmost + 1 (0 for an empty row).
 * @param {Object} part
 * @returns {Int32Array | null} one entry per row from the top; null without a mask
 */
export function rowExtents(part) {
	const g = partGeometry(part);
	if (!g?.mask) return null;
	const extents = new Int32Array(g.height);
	for (let y = 0; y < g.height; y++) {
		let first = -1;
		let last = -1;
		const row = y * g.width;
		for (let x = 0; x < g.width; x++) {
			if (!g.mask[row + x]) continue;
			if (first < 0) first = x;
			last = x;
		}
		extents[y] = first < 0 ? 0 : last - first + 1;
	}
	return extents;
}

/**
 * Sorts parts into rows by vertical overlap.
 * @param {Array<Object>} parts
 * @returns {Array<Array<Object>>} rows top to bottom, each left to right (parts with no size
 *   are left out)
 */
export function groupRows(parts) {
	const list = (parts || []).filter((part) => partGeometry(part));
	if (!list.length) return [];

	let rows;
	if (list.every((part) => Number.isInteger(part.row))) {
		const byRow = new Map();
		for (const part of list) {
			if (!byRow.has(part.row)) byRow.set(part.row, []);
			byRow.get(part.row).push(part);
		}
		rows = [...byRow.keys()].sort((a, b) => a - b).map((key) => byRow.get(key));
	} else {
		const parent = list.map((_, i) => i);
		const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
		for (let i = 0; i < list.length; i++) {
			for (let j = i + 1; j < list.length; j++) {
				if (shareRow(partGeometry(list[i]), partGeometry(list[j]))) parent[find(i)] = find(j);
			}
		}
		const groups = new Map();
		list.forEach((part, i) => {
			const key = find(i);
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(part);
		});
		rows = [...groups.values()].sort((a, b) => rowMiddle(a) - rowMiddle(b));
	}
	return rows.map((row) => [...row].sort((a, b) => partGeometry(a).left - partGeometry(b).left));
}

/**
 * Where a part's bottom is: the middle of its lowest row of ink (the middle of its box without
 * a mask).
 * @param {Object} part
 * @returns {{x: Number, y: Number} | null} image pixels
 */
export function bottomPoint(part) {
	const g = partGeometry(part);
	if (!g) return null;
	if (!g.mask) return { x: (g.left + g.right) / 2, y: g.bottom };
	return measured(g, 'bottomPoint', () => {
		const row = (g.height - 1) * g.width;
		let sum = 0;
		let count = 0;
		for (let x = 0; x < g.width; x++) {
			if (!g.mask[row + x]) continue;
			sum += x;
			count++;
		}
		return { x: g.left + (count ? sum / count : (g.width - 1) / 2) + 0.5, y: g.bottom };
	});
}

/**
 * The height of a line under a spot of the photo.
 * @param {{slope: Number, intercept: Number}} line - y = intercept + slope * x, image pixels
 * @param {Number} x
 * @returns {Number}
 */
export function lineAt(line, x) {
	return line.intercept + line.slope * x;
}

/** @param {Object} part @returns {Number | null} the middle of the part, left to right */
export function middleX(part) {
	const g = partGeometry(part);
	return g ? (g.left + g.right) / 2 : null;
}

/**
 * The writing line of every row of a photo (see the header): one slope, one height per row.
 * @param {Array<Array<Object>>} rows - groupRows
 * @param {Object} uses - { [partId]: { char, tail? } }, the parts named so far
 * @returns {{slope: Number, spread: Number, lines: Array<{slope: Number, intercept: Number,
 *   count: Number} | null>}} one entry per row: its line (image pixels; count = the bottoms it
 *   was fitted through), or null with fewer than MIN_ROW_BOTTOMS bottoms on the line; spread:
 *   how far the letters' bottoms usually sit off their lines (1.4826 x the median distance,
 *   image pixels; 0 with no row of 2)
 */
export function writingLines(rows, uses) {
	let points = (rows || []).map((row) => linePoints(row, uses));
	const all = points.flat();
	const typical = all.length ? median(all.map((point) => point.h)) : 0;
	let fit = fitLines(points, typical);
	const kept = points.map((list, r) =>
		list.filter((point) => {
			const off = point.y - (fit.intercepts[r] + fit.slope * point.x);
			return off <= TAIL_DROP_SHARE * point.h && -off <= FLOAT_DROP_SHARE * typical;
		})
	);
	if (kept.some((list, r) => list.length !== points[r].length)) {
		points = kept;
		fit = fitLines(points, typical);
	}
	// How far his letters usually sit off their row lines (rows of 2 or more, marks left out)
	const offs = points
		.filter((list) => list.length >= 2)
		.flatMap((list) => {
			const r = points.indexOf(list);
			return list
				.filter((point) => point.h >= MARK_SHARE * typical)
				.map((point) => Math.abs(point.y - (fit.intercepts[r] + fit.slope * point.x)));
		});
	return {
		slope: fit.slope,
		spread: offs.length ? 1.4826 * median(offs) : 0,
		lines: points.map((list, r) =>
			list.length >= MIN_ROW_BOTTOMS
				? { slope: fit.slope, intercept: fit.intercepts[r], count: list.length }
				: null
		),
	};
}

/**
 * One row's writing line, fitted on its own (writingLines with one row).
 * @param {Array<Object>} row - the parts of one row
 * @param {Object} uses - { [partId]: { char, tail? } }
 * @returns {{slope: Number, intercept: Number, count: Number} | null}
 */
export function rowWritingLine(row, uses) {
	if (!Array.isArray(row)) return null;
	return writingLines([row], uses).lines[0];
}

/**
 * The line a row with no writing line still shows: the other named letters in it that sit on
 * the line (1 or 2 of them), at the photo's slope. Where the writing line is for a letter whose
 * body its shape can't show.
 * @param {Array<Object>} row
 * @param {Object} uses - { [partId]: { char, tail? } }
 * @param {String} partId - the part that needs it (left out)
 * @param {Number} [slope=0] - the photo's slope (writingLines)
 * @returns {{slope: Number, intercept: Number, count: Number} | null} image pixels
 */
export function rowPartnerLine(row, uses, partId, slope = 0) {
	if (!Array.isArray(row)) return null;
	const heights = [];
	for (const part of row) {
		if (part?.id === partId || !sitsOnLine(uses?.[part?.id])) continue;
		const point = bottomPoint(part);
		if (point) heights.push(point.y - slope * point.x);
	}
	if (!heights.length) return null;
	return { slope, intercept: median(heights), count: heights.length };
}

/**
 * The ink bottom of a part as it would be with the photo held square: the lowest ink measured
 * across the slope, at the middle of the part. With slope 0, the ink bottom.
 * @param {Object} part
 * @param {Number} [slope=0] - the photo's slope (writingLines)
 * @returns {Number | null} image pixels
 */
export function levelBottom(part, slope = 0) {
	const g = partGeometry(part);
	if (!g) return null;
	if (!g.mask || !slope) return g.bottom;
	const lows = measured(g, 'columnBottoms', () => columnBottoms(g));
	const middle = (g.left + g.right) / 2;
	let best = -Infinity;
	for (let x = 0; x < g.width; x++) {
		if (lows[x] < 0) continue;
		const level = g.top + lows[x] + 1 - slope * (g.left + x + 0.5 - middle);
		if (level > best) best = level;
	}
	return Number.isFinite(best) ? best : g.bottom;
}

/**
 * The literal rule: the lowest pixel row whose ink spans at least half the letter's width.
 * @param {Object} part
 * @returns {Number | null} image pixels: the bottom edge of that row; null without a mask
 */
export function halfWidthBottom(part) {
	const g = partGeometry(part);
	if (!g?.mask) return null;
	return measured(g, 'halfWidth', () => findHalfWidthBottom(g, rowExtents(part)));
}

function findHalfWidthBottom(g, extents) {
	const need = HALF_WIDTH_SHARE * g.width;
	for (let y = g.height - 1; y >= 0; y--) {
		if (extents[y] >= need) return g.top + y + 1;
	}
	return null;
}

/**
 * The body bottom of a letter with a bowl: the bowl hole's bottom plus one stroke.
 * @param {Object} part
 * @returns {Number | null} image pixels; null without a mask or a bowl hole in the top part
 */
export function counterBottom(part) {
	const g = partGeometry(part);
	if (!g?.mask) return null;
	return measured(g, 'counter', () => findCounterBottom(g));
}

function findCounterBottom(g) {
	const { width, height, mask } = g;
	const { labels, count, sizes, border } = labelPieces(mask, width, height, 0);
	const minSize = Math.max(MIN_COUNTER_PX, MIN_COUNTER_SHARE * width * height);

	// Bounds of every enclosed paper piece (a hole)
	const top = new Int32Array(count + 1).fill(height);
	const bottom = new Int32Array(count + 1).fill(-1);
	for (let i = 0; i < labels.length; i++) {
		const label = labels[i];
		if (!label || border[label] || sizes[label] < minSize) continue;
		const y = (i / width) | 0;
		if (y < top[label]) top[label] = y;
		if (y > bottom[label]) bottom[label] = y;
	}
	let best = 0;
	for (let label = 1; label <= count; label++) {
		if (bottom[label] < 0) continue;
		const middle = (top[label] + bottom[label] + 1) / 2;
		if (middle > COUNTER_TOP_SHARE * height) continue;
		if (!best || sizes[label] > sizes[best]) best = label;
	}
	if (!best) return null;

	const below = strokeRun(g, labels, best, bottom[best], 1);
	const above = strokeRun(g, labels, best, top[best], -1);
	const runs = [below, above].filter((run) => run > 0);
	if (!runs.length) return null;
	return g.top + bottom[best] + 1 + Math.min(...runs);
}

/**
 * Where the body of a letter ends (see the header for the order of the rules).
 * @param {Object} part
 * @param {Object} targets - lineTargets for the letter, with its tail state
 * @param {{scale?: Number, fromOthers?: Boolean, linePx?: Number, partnerPx?: Number,
 *   slope?: Number, box?: Number, optional?: Boolean, spreadPx?: Number}} [context] - scale:
 *   the photo's font units per pixel; fromOthers: that scale comes from at least one other
 *   letter; linePx: the row's writing line under the letter; partnerPx: its partner line
 *   there; slope: the photo's slope; box: the letter box (font units); optional: a Q J f whose
 *   tail was guessed (not his [It has a tail] / [No tail]); spreadPx: how far the photo's
 *   letters usually sit off their row lines (writingLines spread)
 * @returns {{px: Number, from: 'ink' | 'counter' | 'row' | 'partner' | 'width' | 'scale' |
 *   'span'}} image pixels
 */
export function bodyBottom(
	part,
	targets,
	{
		scale,
		fromOthers = false,
		linePx,
		partnerPx,
		slope = 0,
		box,
		optional = false,
		spreadPx = 0,
	} = {}
) {
	const g = partGeometry(part);
	if (!g) return null;
	const within = (px) => Number.isFinite(px) && px > g.top && px <= g.bottom;
	/** A body bottom and a line disagree more than his letters usually sit off their lines */
	const apart = (px, line) =>
		Math.abs(px - line) >
		Math.max(BOWL_AGREE_SHARE * (line - g.top), LINE_TRUST_SPREADS * (spreadPx || 0));
	if (!targets?.tail) {
		if (optional) {
			// A short tail the guess left off: a Q sits on its bowl, a J or f on its line
			const bowl = counterBottom(part);
			if (bowl !== null) {
				if (g.bottom - bowl > BOWL_AGREE_SHARE * (bowl - g.top))
					return { px: bowl, from: 'counter' };
			} else if (within(linePx)) {
				if (g.bottom > linePx && apart(g.bottom, linePx)) return { px: linePx, from: 'row' };
			} else if (within(partnerPx) && g.bottom > partnerPx && apart(g.bottom, partnerPx)) {
				return { px: partnerPx, from: 'partner' };
			}
		}
		let px = levelBottom(part, slope);
		if (scale > 0 && box > 0) {
			const hold = (LEVEL_HOLD_SHARE * box) / scale;
			px = Math.max(g.bottom - hold, Math.min(g.bottom + hold, px));
		}
		return { px, from: 'ink' };
	}

	const bodyFU = targets.top - targets.bottom;
	const counter = counterBottom(part);
	if (counter !== null) {
		// A bowl that closes clearly above (or below) a tight row line gives way to it
		if (within(linePx) && apart(counter, linePx)) return { px: linePx, from: 'row' };
		return { px: counter, from: 'counter' };
	}
	if (within(linePx)) return { px: linePx, from: 'row' };
	if (within(partnerPx)) return { px: partnerPx, from: 'partner' };

	const width = halfWidthBottom(part);
	if (fromOthers && scale > 0 && bodyFU > 0) {
		const expected = Math.min(g.bottom, Math.max(g.top + 1, g.top + bodyFU / scale));
		if (width !== null && Math.abs(width - expected) <= BODY_AGREE_SHARE * (expected - g.top)) {
			return { px: width, from: 'width' };
		}
		return { px: expected, from: 'scale' };
	}
	if (Number.isFinite(targets.tailBottom) && targets.top > targets.tailBottom) {
		const share = bodyFU / (targets.top - targets.tailBottom);
		return { px: g.top + g.height * share, from: 'span' };
	}
	if (width !== null) return { px: width, from: 'width' };
	return { px: g.bottom, from: 'ink' };
}

/**
 * Whether a letter hangs a tail below its body. Q J f are guessed; g j p q y always have one
 * (unless [No tail]); every other letter never does.
 * @param {Object} part
 * @param {String} char
 * @param {Object} font - project.settings.font
 * @param {{linePx?: Number, scale?: Number}} [context] - linePx: the row's writing line (or
 *   its partner line) under the letter; scale: the photo's scale from OTHER letters
 * @returns {Boolean}
 */
export function guessTail(part, char, font, { linePx, scale } = {}) {
	const kind = tailKind(char);
	if (kind !== 'optional') return kind === 'always';
	const g = partGeometry(part);
	if (!g) return false;

	if (Number.isFinite(linePx)) {
		const body = linePx - g.top;
		return body > 0 && g.bottom - linePx > TAIL_GUESS_SHARE * body;
	}
	const counter = counterBottom(part);
	if (counter !== null) {
		const body = counter - g.top;
		return body > 0 && g.bottom - counter > TAIL_GUESS_SHARE * body;
	}
	if (scale > 0) {
		const targets = lineTargets(char, font, { tail: false });
		const body = (targets.top - targets.bottom) / scale;
		return body > 0 && g.bottom - (g.top + body) > TAIL_GUESS_SCALE_SHARE * body;
	}
	return false;
}

/**
 * The trace's y (font units of the photo's top edge) that puts a part on its lines.
 * @param {Object} part
 * @param {Object} targets - lineTargets for the letter
 * @param {{bodyBottomPx?: Number, scale: Number}} context - bodyBottomPx: where the body ends
 *   (bottom seat; the ink bottom when left out)
 * @returns {{y: Number, seat: 'bottom' | 'top' | 'center'} | null}
 */
export function seatTraceY(part, targets, { bodyBottomPx, scale } = {}) {
	const g = partGeometry(part);
	if (!g || !(scale > 0) || !targets) return null;
	if (targets.seat === 'top') return { y: targets.top + g.top * scale, seat: 'top' };
	if (targets.seat === 'center') {
		return { y: targets.center + ((g.top + g.bottom) / 2) * scale, seat: 'center' };
	}
	const body = Number.isFinite(bodyBottomPx) ? bodyBottomPx : g.bottom;
	return { y: targets.bottom + body * scale, seat: 'bottom' };
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/** A named letter's bottom is on the line: no tail (known), and seated by its bottom. */
function sitsOnLine(use) {
	const char = use?.char;
	if (typeof char !== 'string') return false;
	const kind = tailKind(char);
	if (kind !== 'never' && use.tail !== false) return false;
	return lineTargets(char).seat === 'bottom';
}

/** The bottoms a row's line goes through: unnamed parts and named letters that sit on it. */
function linePoints(row, uses) {
	const points = [];
	for (const part of row || []) {
		const g = partGeometry(part);
		if (!g) continue;
		const use = uses?.[part.id];
		if (use && !sitsOnLine(use)) continue;
		points.push({ ...bottomPoint(part), h: g.height });
	}
	return points;
}

/**
 * One slope for every row, one height per row (see the header). Marks (. , ' -) vote only on
 * the heights.
 * @param {Array<Array<{x: Number, y: Number, h: Number}>>} points - linePoints of each row
 * @param {Number} typical - the typical height of a part on the lines (typicalHeight)
 */
function fitLines(points, typical) {
	const voters = points.map((list) => list.filter((point) => point.h >= MARK_SHARE * typical));
	let slope = 0;
	const rough = repeatedMedianSlope(voters);
	if (rough !== null) {
		// Letters written clearly high or low on the rough line don't steer the fine one
		const off = voters.map((list) => {
			const middle = list.length ? median(list.map((point) => point.y - rough * point.x)) : 0;
			return list.map((point) => point.y - rough * point.x - middle);
		});
		// The usual distance from the rough line, from rows where it means something (2 or more)
		const spread =
			1.4826 *
			median(
				off
					.filter((list) => list.length >= 2)
					.flat()
					.map(Math.abs)
			);
		const limit = Math.max(OUTLIER_SPREADS * spread, OUTLIER_FLOOR_SHARE * typical);
		const kept = voters.map((list, r) => list.filter((_, i) => Math.abs(off[r][i]) <= limit));
		slope = leastSquaresSlope(kept) ?? rough;
	}
	slope = Math.max(-MAX_TILT, Math.min(MAX_TILT, slope));
	const intercepts = points.map((list) =>
		list.length ? median(list.map((point) => point.y - slope * point.x)) : null
	);
	return { slope, intercepts };
}

/** Rows with 2 or more voters, when they hold MIN_SLOPE_BOTTOMS between them; else none. */
function slopeRows(rows) {
	const usable = rows.filter((list) => list.length >= 2);
	const count = usable.reduce((sum, list) => sum + list.length, 0);
	return count >= MIN_SLOPE_BOTTOMS ? usable : null;
}

/**
 * The repeated median of the slopes between bottoms in the same row: for each bottom, the
 * median of its slopes to the others in its row; then the median over the bottoms. One bottom
 * in four written high or low can't move it.
 * @returns {Number | null} null with too few bottoms
 */
function repeatedMedianSlope(rows) {
	const usable = slopeRows(rows);
	if (!usable) return null;
	const perPoint = [];
	for (const list of usable) {
		for (const point of list) {
			const slopes = [];
			for (const other of list) {
				const dx = other.x - point.x;
				if (other !== point && Math.abs(dx) >= 1) slopes.push((other.y - point.y) / dx);
			}
			if (slopes.length) perPoint.push(median(slopes));
		}
	}
	return perPoint.length ? median(perPoint) : null;
}

/**
 * The least-squares slope of rows sharing one slope (each row its own height).
 * @returns {Number | null} null with too few bottoms or no spread left to right
 */
function leastSquaresSlope(rows) {
	const usable = slopeRows(rows);
	if (!usable) return null;
	let sxy = 0;
	let sxx = 0;
	for (const list of usable) {
		const mx = list.reduce((sum, point) => sum + point.x, 0) / list.length;
		const my = list.reduce((sum, point) => sum + point.y, 0) / list.length;
		for (const point of list) {
			sxy += (point.x - mx) * (point.y - my);
			sxx += (point.x - mx) ** 2;
		}
	}
	return sxx >= 1 ? sxy / sxx : null;
}

/** The lowest ink row of every column of a part's mask (-1 for a column with none). */
function columnBottoms(g) {
	const lows = new Int32Array(g.width).fill(-1);
	for (let y = 0; y < g.height; y++) {
		const row = y * g.width;
		for (let x = 0; x < g.width; x++) if (g.mask[row + x]) lows[x] = y;
	}
	return lows;
}

function shareRow(a, b) {
	const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
	return overlap > 0 && overlap >= ROW_OVERLAP_SHARE * Math.min(a.height, b.height);
}

function rowMiddle(row) {
	const middles = row.map((part) => {
		const g = partGeometry(part);
		return (g.top + g.bottom) / 2;
	});
	return median(middles);
}

/** The ink run next to a hole, straight down (step 1) from its lowest row or up from its top. */
function strokeRun(g, labels, label, holeRow, step) {
	const columns = [];
	const rowStart = holeRow * g.width;
	for (let x = 0; x < g.width; x++) if (labels[rowStart + x] === label) columns.push(x);
	if (!columns.length) return 0;
	const x = columns[(columns.length - 1) >> 1];
	let run = 0;
	for (let y = holeRow + step; y >= 0 && y < g.height; y += step) {
		if (!g.mask[y * g.width + x]) break;
		run++;
	}
	// A tail running straight on makes one run long; the caller keeps the thinner of the two
	return run;
}

function tighten(geometry, mask) {
	const { width, height } = geometry;
	let left = width;
	let right = -1;
	let top = height;
	let bottom = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!mask[y * width + x]) continue;
			if (x < left) left = x;
			if (x > right) right = x;
			if (y < top) top = y;
			if (y > bottom) bottom = y;
		}
	}
	if (right < 0) return null;
	const w = right - left + 1;
	const h = bottom - top + 1;
	let own = mask;
	if (w !== width || h !== height) {
		own = new Uint8Array(w * h);
		for (let y = 0; y < h; y++) {
			own.set(mask.subarray((y + top) * width + left, (y + top) * width + left + w), y * w);
		}
	}
	return {
		left: geometry.left + left,
		top: geometry.top + top,
		right: geometry.left + right + 1,
		bottom: geometry.top + bottom + 1,
		width: w,
		height: h,
		mask: own,
	};
}

/** @param {Array<Number>} values @returns {Number} */
export function median(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
