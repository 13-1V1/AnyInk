// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK placement: one scale per photo (UX-BEGINNER 4.4 "One size for the whole photo", B3,
	the same rule D-017 sets for the handwriting sheet). Pure, except applyFollow, which changes
	the item it is given (no history: the caller wraps it in its Undo step).

	The photo (what B9's photo registry and photo dialog hand in):
	  { asset?,                            the image's asset id (editor.assets)
	    parts: [part, ...],                see seat.js (box, optional mask, optional row)
	    uses: { [partId]: { char,          the letter named for that part
	                        itemId?,       the glyph it went into
	                        tail? } } }    [It has a tail] (true) / [No tail] (false)

	Rules:
	- A letter's ratio (letterRatio) is the font units per pixel that would put it alone on its
	  lines: its class height (classes.js, round letters with their overshoot) over its ink
	  height. A letter with a tail on is sized by its body (the body is far steadier in
	  handwriting than a tail): down to its bowl when a bowl hole gives it (g p q Q), else down
	  to its row's writing line under it (or its partner line); alone, from its top to its tail
	  line (j y, a dropping f or J), and a Q with no hole by the literal half-width rule. The
	  hyphen has no height of its own; it is sized by its width.
	- The photo's scale (photoScale) is the median of the ratios of the letters named from it,
	  counting only the plain letters a to z and A to Z; punctuation, numbers, symbols and
	  accented letters are used only when nothing else is named. Tails of Q J f are guessed
	  first (seat.js guessTail: the row line, the bowl, or the scale of the other letters).
	- Rows written at another size (D-034, after the 10/14/2026 first-timer lens; B3 finalize): a
	  page often starts big and runs out of room, or shrinks a little every row. One scale for it
	  all would make his letters alternate big and small in every word, so each row gets its own
	  size, measured only against rows that share kinds of letter with it (small, tall, t,
	  capital; tail letters and i, whose bodies vary too much, don't vote: median polish of the
	  log ratios, row by kind; rowSizes), so capitals written
	  taller than the font draws them never count as a size change, and capital rows are never
	  compared with small-letter rows they share no kind with.
	    Rows linked through shared kinds form a set. The set with the most small letters is the
	  main one; its usual size is the median of its heaviest run of rows within ROW_SIZE_DEAD of
	  each other (ties: the topmost, the size he started at). Every other set (the capitals of a
	  whole-alphabet page) is tied through its row nearest the main set to the main row nearest
	  it: he wrote them one after the other.
	    A row's own size counts in full once it is ROW_SIZE_SHARE (15 %) or more off its set's
	  usual size, not at all within ROW_SIZE_DEAD (7 %: a messy hand's rows wobble that much),
	  and fades in between, so a size never jumps as letters are named. A row needs
	  MIN_ROW_VOTERS letters of a shared kind to be compared, and is believed in full from
	  FULL_ROW_VOTERS (a third at 3, two thirds at 4, blended with the nearest row believed in
	  full) or once every part in it is named, so a row's first few letters can't swing earlier
	  letters back and forth. The heaviest run counts every letter named in its rows. A row that can't be compared goes with the nearest row that can (the one above
	  on a tie). (rowAdjustments)
	    The photo's scale is the median of every letter's ratio with its row's size taken out;
	  each row's scale is that times its size. A page written at one size, wobble and all, keeps
	  one scale. Ink weight differs by row where the size does (B11's stroke note covers that).
	- Earlier untouched letters follow: a letter traced from this photo that still has
	  item.anyink.photoFit (set by Use it, cleared by any change he makes to the letter) and
	  whose own scale is more than 3 % off its group's new scale is resized to it (shouldFollow;
	  fit_lines.js followPlan builds the list). applyFollow maps its shapes, its width and its
	  photo through the photo itself, so every point stays on the same spot of the photo.
*/
import { feedsScale, lineTargets, tailKind } from './classes.js';
import {
	BOWL_AGREE_SHARE,
	counterBottom,
	groupRows,
	guessTail,
	halfWidthBottom,
	lineAt,
	median,
	middleX,
	partGeometry,
	rowPartnerLine,
	writingLines,
} from './seat.js';
import { getTrace, setTrace } from '../trace/trace_model.js';

/** The kinds of letter that say how big a row was written (rowSizes). */
const SIZE_KINDS = ['small', 'tall', 't', 'capital'];

/** Earlier letters follow a new photo scale only when it changes theirs by more than this. */
export const FOLLOW_SHARE = 0.03;

/**
 * A row this share or more off its set's usual size takes its own size in full. Above the 10 %
 * the lens suggested: a messy hand's letters wobble about 14 % in size, and three of them can
 * average 10 % off by chance; a row written at 72 % is 39 % off.
 */
export const ROW_SIZE_SHARE = 0.15;

/** A row within this share of its set's usual size keeps the photo's scale; fades in above. */
export const ROW_SIZE_DEAD = 0.07;

/** A row is compared with the others only through at least this many letters... */
export const MIN_ROW_VOTERS = 3;

/** ...and its own size is believed in full from this many (in proportion below). */
export const FULL_ROW_VOTERS = 5;

/**
 * Font units per image pixel that would put this letter alone on its lines.
 * @param {Object} part - see seat.js
 * @param {String} char
 * @param {Object} font - project.settings.font
 * @param {{tail?: Boolean, linePx?: Number, partnerPx?: Number, chosen?: Boolean}} [options] -
 *   tail: the letter's tail state; linePx: the writing line from its row, image pixels;
 *   partnerPx: its partner line (a row with no writing line); chosen: the tail state is his
 *   ([It has a tail] / [No tail]), not a guess
 * @returns {Number | null}
 */
export function letterRatio(part, char, font, { tail, linePx, partnerPx, chosen = false } = {}) {
	const g = partGeometry(part);
	if (!g) return null;
	const t = lineTargets(char, font, { tail });
	if (t.class === 'hyphen') return t.width / g.width;
	const body = t.top - t.bottom;
	const line = Number.isFinite(linePx) ? linePx : partnerPx;
	const inside = Number.isFinite(line) && line > g.top && line < g.bottom;
	if (!t.tail) {
		// A Q J f whose tail the guess left off is sized by its body when its ink hangs under it
		if (tailKind(char) === 'optional' && !chosen) {
			const bowl = counterBottom(part);
			const under = (px) => g.bottom - px > BOWL_AGREE_SHARE * (px - g.top);
			if (bowl !== null && bowl > g.top && under(bowl)) return body / (bowl - g.top);
			if (bowl === null && inside && under(line)) return body / (line - g.top);
		}
		return body / g.height;
	}

	const counter = counterBottom(part);
	if (counter !== null && counter > g.top) return body / (counter - g.top);
	if (inside) return body / (line - g.top);
	if (t.tailBottom !== null) return (t.top - t.tailBottom) / g.height;
	const width = halfWidthBottom(part);
	if (width !== null && width > g.top) return body / (width - g.top);
	return body / g.height;
}

/**
 * The photo's scale, the scale of each of its rows, and what goes with them.
 * @param {Object} photo
 * @param {Object} font - project.settings.font
 * @returns {{scale: Number | null, from: Array<String>, scales: Object<String, Number | null>,
 *   groups: Array<Object>, groupOf: Object<String, Number>, slope: Number,
 *   tails: Object<String, Boolean>, lines: Object<String, Number | null>,
 *   partners: Object<String, Number | null>, ratios: Object<String, Number | null>}}
 *   scale: the photo's scale, font units per image pixel (null when nothing named can size
 *   the photo): the scale of the group with the most letters; from: the parts whose ratios
 *   made it; scales: the scale for each part, its row's group's (the photo's scale when the
 *   photo has one size); groups: [{ rows, parts, scale, from, main }] rows of one size, top to
 *   bottom; groupOf: each part's group; slope: the photo's tilt (seat.js writingLines);
 *   tails: the tail state of each named part; lines: each part's row writing line under its
 *   middle, image pixels (null without a row line); partners: in a row with no line, the
 *   partner line under it (else null); ratios: each named part's own ratio; spread: how far his
 *   letters usually sit off their row lines (seat.js writingLines), image pixels
 */
export function photoScale(photo, font) {
	const result = {
		scale: null,
		from: [],
		scales: {},
		groups: [],
		groupOf: {},
		slope: 0,
		tails: {},
		lines: {},
		partners: {},
		ratios: {},
		spread: 0,
	};
	const parts = (photo?.parts || []).filter((part) => partGeometry(part));
	const uses = photo?.uses || {};
	const rows = groupRows(parts);
	const fitted = writingLines(rows, uses);
	result.slope = fitted.slope;
	result.spread = fitted.spread;
	const rowOf = new Map();
	rows.forEach((row, r) => {
		const line = fitted.lines[r];
		for (const part of row) {
			rowOf.set(part.id, r);
			const x = middleX(part);
			result.lines[part.id] = line ? lineAt(line, x) : null;
			const partner = line ? null : rowPartnerLine(row, uses, part.id, fitted.slope);
			result.partners[part.id] = partner ? lineAt(partner, x) : null;
		}
	});
	const named = parts.filter((part) => isNamed(uses[part.id]));
	if (!named.length) {
		for (const part of parts) result.scales[part.id] = null;
		return result;
	}

	// Tails that need no guess: his choice, or a letter that always or never has one
	const known = [];
	for (const part of named) {
		const use = uses[part.id];
		const kind = tailKind(use.char);
		if (kind === 'never') result.tails[part.id] = false;
		else if (typeof use.tail === 'boolean') result.tails[part.id] = use.tail;
		else if (kind === 'always') result.tails[part.id] = true;
		else continue;
		known.push(part);
	}
	const ratioOf = (part) =>
		letterRatio(part, uses[part.id].char, font, {
			tail: result.tails[part.id],
			linePx: result.lines[part.id] ?? undefined,
			partnerPx: result.partners[part.id] ?? undefined,
			chosen: typeof uses[part.id].tail === 'boolean',
		});
	const knownRatios = new Map(known.map((part) => [part.id, ratioOf(part)]));

	// Each row's size, judged by the letters whose tails need no guess
	// (only letters whose whole height is their body: a tail letter's body and an i's dot vary
	// too much from letter to letter to say a row's size)
	const voters = known
		.filter((part) => feedsScale(uses[part.id].char))
		.map((part) => ({
			row: rowOf.get(part.id),
			kind: lineTargets(uses[part.id].char, font).class,
			ratio: knownRatios.get(part.id),
		}))
		.filter((voter) => SIZE_KINDS.includes(voter.kind));
	const complete = rows.map((row) => row.every((part) => isNamed(uses[part.id])));
	const letters = rows.map((row) => row.filter((part) => isNamed(uses[part.id])).length);
	const adjust = rowAdjustments(rows.length, voters, { complete, letters });
	const rowAdjust = (part) => adjust[rowOf.get(part.id)] ?? 0;
	/** The photo's level: every ratio with its row's size taken out */
	const level = (list, ratioFor) =>
		medianScale(list, uses, (part) => {
			const ratio = ratioFor(part);
			return ratio > 0 ? ratio * Math.exp(-rowAdjust(part)) : null;
		});

	// Q J f: guessed against the row line, the bowl, or the scale of the other letters
	for (const part of named) {
		if (part.id in result.tails) continue;
		const others = known.filter((other) => other !== part);
		const base = level(others, (other) => knownRatios.get(other.id));
		result.tails[part.id] = guessTail(part, uses[part.id].char, font, {
			linePx: result.lines[part.id] ?? result.partners[part.id] ?? undefined,
			scale: base ? base.scale * Math.exp(rowAdjust(part)) : undefined,
		});
	}
	for (const part of named) result.ratios[part.id] = ratioOf(part);

	const whole = level(named, (part) => result.ratios[part.id]);
	result.scale = whole?.scale ?? null;
	result.from = whole?.from ?? [];
	for (const part of parts) {
		result.scales[part.id] = result.scale > 0 ? result.scale * Math.exp(rowAdjust(part)) : null;
	}
	// Rows of one size, top to bottom (the main group holds the photo's own scale)
	const byAdjust = new Map();
	rows.forEach((row, r) => {
		const key = (adjust[r] ?? 0).toFixed(9);
		if (!byAdjust.has(key)) byAdjust.set(key, { adjust: adjust[r] ?? 0, rows: [], parts: [] });
		byAdjust.get(key).rows.push(r);
		byAdjust.get(key).parts.push(...row.map((part) => part.id));
	});
	result.groups = [...byAdjust.values()].map((group) => ({
		rows: group.rows,
		parts: group.parts,
		scale: result.scale > 0 ? result.scale * Math.exp(group.adjust) : null,
		from: result.from,
		main: group.adjust === 0,
	}));
	result.groups.forEach((group, index) => {
		for (const id of group.parts) result.groupOf[id] = index;
	});
	return result;
}

/**
 * How much bigger (or smaller) each row's scale is than the photo's (see the header).
 * @param {Number} rowCount
 * @param {Array<{row: Number, kind: String, ratio: Number}>} voters - plain letters with their
 *   row, their vertical class (classes.js) and their ratio (letterRatio)
 * @param {{dead?: Number, share?: Number, minVoters?: Number, fullVoters?: Number,
 *   complete?: Array<Boolean>, letters?: Array<Number>}} [options] - complete: rows whose
 *   every part is named (believed in full whatever their count); letters: how many letters are
 *   named in each row (what makes a run of rows the heaviest; the voters when left out)
 * @returns {Array<Number>} each row's size against the photo's, as a log (0: the photo's scale;
 *   a row written smaller has a larger scale, a positive number)
 */
export function rowAdjustments(
	rowCount,
	voters,
	{
		dead = ROW_SIZE_DEAD,
		share = ROW_SIZE_SHARE,
		minVoters = MIN_ROW_VOTERS,
		fullVoters = FULL_ROW_VOTERS,
		complete = [],
		letters,
	} = {}
) {
	const count = Math.max(0, rowCount);
	const adjust = new Array(count).fill(0);
	if (count < 2) return adjust;
	const { size, compared, counts, smallCounts, set } = rowSizes(count, voters, { minVoters });
	const comparedRows = [];
	for (let r = 0; r < count; r++) if (compared[r]) comparedRows.push(r);
	if (comparedRows.length < 2) return adjust;

	const low = Math.log(1 + dead);
	const high = Math.log(1 + share);
	/** A row's own size, faded in between the dead zone and full, believed by its letters */
	/** A row's own size against a usual size, faded in between the dead zone and full */
	const own = (r, usual) => {
		const off = size[r] - usual;
		const away = Math.abs(off);
		if (away >= high) return off;
		if (away > low) return (Math.sign(off) * high * (away - low)) / (high - low);
		return 0;
	};
	/** How far a row's own size is believed: its letters, or every part in it named */
	const belief = (r) =>
		complete[r]
			? 1
			: Math.max(0, Math.min(1, (counts[r] - minVoters + 1) / (fullVoters - minVoters + 1)));
	const done = new Array(count).fill(false);
	/**
	 * Sets each row's size: in full where believed in full, else blended with the size of the
	 * nearest row believed in full (so a row's first letters move it from its neighbor's size
	 * toward its own, never back and forth)
	 * @param {Array<Number>} list - rows
	 * @param {Map<Number, Number>} wanted - each row's size believed in full
	 * @param {Number} fallback - for a row with no fully believed row anywhere
	 */
	const settle = (list, wanted, fallback) => {
		for (const r of list) {
			if (belief(r) < 1) continue;
			adjust[r] = wanted.get(r);
			done[r] = true;
		}
		for (const r of list) {
			const b = belief(r);
			if (b >= 1) continue;
			let nearest = null;
			for (let other = 0; other < count; other++) {
				if (!done[other] || belief(other) < 1) continue;
				if (nearest === null || Math.abs(other - r) < Math.abs(nearest - r)) nearest = other;
			}
			const borrowed = nearest === null ? fallback : adjust[nearest];
			adjust[r] = b * wanted.get(r) + (1 - b) * borrowed;
		}
		for (const r of list) done[r] = true;
	};

	// The sets of rows that share kinds of letter, and the main one
	const sets = new Map();
	for (const r of comparedRows) {
		if (!sets.has(set[r])) sets.set(set[r], { rows: [], small: 0, letters: 0 });
		const entry = sets.get(set[r]);
		entry.rows.push(r);
		entry.small += smallCounts[r];
		entry.letters += counts[r];
	}
	let main = null;
	for (const entry of sets.values()) {
		if (
			!main ||
			entry.small > main.small ||
			(entry.small === main.small && entry.letters > main.letters)
		) {
			main = entry;
		}
	}
	// The main set's usual size: its heaviest run of rows within the dead zone of each other
	let best = null;
	for (const r of main.rows) {
		const near = main.rows.filter((other) => Math.abs(size[other] - size[r]) <= low);
		const weight = near.reduce((sum, other) => sum + (letters?.[other] ?? counts[other]), 0);
		if (!best || weight > best.weight) best = { weight, near };
	}
	const usual = median(best.near.map((r) => size[r]));
	settle(main.rows, new Map(main.rows.map((r) => [r, own(r, usual)])), 0);
	// Every other set: tied to the main set where they meet on the page
	for (const entry of sets.values()) {
		if (entry === main) continue;
		let link = null;
		for (const r of entry.rows) {
			for (const m of main.rows) {
				const gap = Math.abs(r - m);
				if (!link || gap < link.gap || (gap === link.gap && m < link.m)) link = { r, m, gap };
			}
		}
		const tied = new Map(entry.rows.map((r) => [r, adjust[link.m] + own(r, size[link.r])]));
		settle(entry.rows, tied, adjust[link.m]);
	}
	// A row that can't be compared goes with the nearest row that can (the one above on a tie)
	for (let r = 0; r < count; r++) {
		if (done[r]) continue;
		let nearest = null;
		for (const other of comparedRows) {
			if (nearest === null || Math.abs(other - r) < Math.abs(nearest - r)) nearest = other;
		}
		adjust[r] = adjust[nearest];
	}
	return adjust;
}

/**
 * How big each row was written, judged only through letters of the same kind (see the header):
 * a median polish of the log ratios, log ratio = row size + kind. A row written smaller has
 * larger ratios, so a larger size; a size difference d means a scale exp(d) times as big.
 * Sizes compare only inside one set of rows linked by shared kinds.
 * @param {Number} rowCount
 * @param {Array<{row: Number, kind: String, ratio: Number}>} voters - see rowAdjustments
 * @param {{minVoters?: Number}} [options]
 * @returns {{size: Array<Number>, compared: Array<Boolean>, counts: Array<Number>,
 *   smallCounts: Array<Number>, set: Array<Number>}} compared: the row holds at least
 *   minVoters letters of a kind another row also has (its size means something); counts:
 *   those letters; smallCounts: how many of them are not capitals; set: the set of rows it is
 *   linked to through shared kinds (-1 with none)
 */
export function rowSizes(rowCount, voters, { minVoters = MIN_ROW_VOTERS } = {}) {
	const count = Math.max(0, rowCount);
	const usable = (voters || []).filter(
		(voter) =>
			voter.ratio > 0 &&
			Number.isFinite(voter.ratio) &&
			Number.isInteger(voter.row) &&
			voter.row >= 0 &&
			voter.row < count
	);
	// Only kinds of letter written in two rows or more compare rows
	const rowsOfKind = new Map();
	for (const voter of usable) {
		if (!rowsOfKind.has(voter.kind)) rowsOfKind.set(voter.kind, new Set());
		rowsOfKind.get(voter.kind).add(voter.row);
	}
	const shared = usable.filter((voter) => rowsOfKind.get(voter.kind).size >= 2);

	const size = new Array(count).fill(0);
	const kindSize = new Map();
	const log = (voter) => Math.log(voter.ratio);
	for (let pass = 0; pass < 4; pass++) {
		for (const kind of rowsOfKind.keys()) {
			const own = shared.filter((voter) => voter.kind === kind);
			if (own.length) kindSize.set(kind, median(own.map((voter) => log(voter) - size[voter.row])));
		}
		for (let r = 0; r < count; r++) {
			const own = shared.filter((voter) => voter.row === r);
			if (own.length) size[r] = median(own.map((voter) => log(voter) - kindSize.get(voter.kind)));
		}
	}
	const counts = size.map((_, r) => shared.filter((voter) => voter.row === r).length);
	const smallCounts = size.map(
		(_, r) => shared.filter((voter) => voter.row === r && voter.kind !== 'capital').length
	);
	const compared = counts.map((n) => n >= minVoters);
	// Rows linked through a kind both have
	const parent = size.map((_, r) => r);
	const find = (r) => (parent[r] === r ? r : (parent[r] = find(parent[r])));
	for (const rowSet of rowsOfKind.values()) {
		if (rowSet.size < 2) continue;
		const [first, ...rest] = [...rowSet];
		for (const r of rest) parent[find(r)] = find(first);
	}
	const set = counts.map((n, r) => (n ? find(r) : -1));
	return { size, compared, counts, smallCounts, set };
}

/**
 * @param {Number} letterScale - the letter's own trace scale now
 * @param {Number} newScale - the photo's scale now
 * @param {Number} [share=FOLLOW_SHARE]
 * @returns {Boolean} true when the change is more than share
 */
export function shouldFollow(letterScale, newScale, share = FOLLOW_SHARE) {
	if (!(letterScale > 0) || !(newScale > 0)) return false;
	return Math.abs(newScale / letterScale - 1) > share + 1e-9;
}

/**
 * @param {Object} item - Glyph
 * @param {String} [asset] - the photo's asset id
 * @returns {Boolean} true when the letter still is exactly as traced from this photo
 *   (item.anyink.photoFit is set and, when it names a photo, it is this one)
 */
export function isUntouched(item, asset) {
	const fit = item?.anyink?.photoFit;
	if (!fit) return false;
	if (typeof fit === 'object' && fit.asset && asset && fit.asset !== asset) return false;
	return true;
}

/**
 * The map that moves anything placed through one trace placement to the same spot of the
 * photo under another: x' = to.x + (x - from.x) * k, y' = to.y + (y - from.y) * k.
 * @param {{x: Number, y: Number, scale: Number}} from
 * @param {{x: Number, y: Number, scale: Number}} to
 * @returns {{k: Number, x: (x: Number) => Number, y: (y: Number) => Number}}
 */
export function rescaleMap(from, to) {
	const k = to.scale / from.scale;
	return {
		k,
		x: (x) => to.x + (x - from.x) * k,
		y: (y) => to.y + (y - from.y) * k,
	};
}

/**
 * Resizes a letter to its photo's new placement: every point and handle in use moves through
 * the photo (rescaleMap), handles not in use keep their distance from their point, the width
 * moves its right edge the same way, everything is rounded to whole units, and the photo
 * record takes the new x, y and scale. Components inside the letter are left alone.
 * @param {Object} item - Glyph
 * @param {{from: Object, to: Object}} entry - the old and new trace (fit_lines followPlan)
 * @returns {Boolean} false when there is nothing to follow
 */
export function applyFollow(item, entry) {
	const from = entry?.from;
	const to = entry?.to;
	if (!item || !(from?.scale > 0) || !(to?.scale > 0)) return false;
	const map = rescaleMap(from, to);

	for (const shape of item.shapes || []) {
		if (shape?.objType !== 'Path') continue;
		for (const point of shape.pathPoints) {
			const px = point.p.coord.x;
			const py = point.p.coord.y;
			const x = Math.round(map.x(px));
			const y = Math.round(map.y(py));
			for (const handle of [point.h1, point.h2]) {
				const hx = handle.coord.x;
				const hy = handle.coord.y;
				if (handle.use) {
					handle.coord.x = Math.round(map.x(hx));
					handle.coord.y = Math.round(map.y(hy));
				} else {
					handle.coord.x = Math.round(x + (hx - px));
					handle.coord.y = Math.round(y + (hy - py));
				}
			}
			point.p.coord.x = x;
			point.p.coord.y = y;
		}
		shape.changed?.();
	}
	const width = Number(item.advanceWidth);
	if (Number.isFinite(width) && width > 0)
		item.advanceWidth = Math.max(0, Math.round(map.x(width)));
	setTrace(item, { ...(getTrace(item) || from), x: to.x, y: to.y, scale: to.scale });
	item.changed?.();
	return true;
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

function isNamed(use) {
	return !!use && typeof use.char === 'string' && [...use.char].length === 1;
}

/** Median of the ratios: plain letters first, anything with a ratio when there are none. */
function medianScale(parts, uses, ratioFor) {
	const usable = parts
		.map((part) => ({ id: part.id, char: uses[part.id].char, ratio: ratioFor(part) }))
		.filter((entry) => entry.ratio > 0 && Number.isFinite(entry.ratio));
	const letters = usable.filter((entry) => feedsScale(entry.char));
	const pool = letters.length ? letters : usable;
	if (!pool.length) return null;
	return { scale: median(pool.map((entry) => entry.ratio)), from: pool.map((entry) => entry.id) };
}
