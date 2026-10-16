// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 + B11 fix pass: where a letter's body ends at the bottom when its ink alone can't say
	(UX-BEGINNER.md 4.2 "Needs a look", 4.4 seating, 7.2, section 10 B11 "Body bottom ... off the
	writing line").
	Pure and read-only. Font units, y-up, the writing line at 0. checks.js measureLetter reads
	these, so its body bottom is the one the checks judge, and the fixes' Sit on the line and
	Match size put on the line (the fixes track's fix_shapes.js bodyBottom reads measureLetter).

	A letter whose tail hangs (g j p q y , ; and Q J f with their tail on) is judged by its body,
	never by its tail's end (B10 + B11 fix pass, the critic's "a g that floats comes out Ready"):
	  bowl    g p q Q: placement's 'counter' rule (placement/seat.js counterBottom) in font units:
	          the biggest hole whose middle is in the top COUNTER_TOP_SHARE of the letter and
	          that covers MIN_COUNTER_SHARE of its box; the body ends under that hole by the
	          thinner of the strokes straight under and over it (measured at the middle of the
	          hole's bottom and top), so a traced letter that placement seated on its bowl reads
	          as on the line, and a heavy or light bowl stroke never reads as floating
	  joint   y: where its arms meet, the lowest point of its left side before the tail runs
	          off to the left (the rightmost point of the letter's left edge in its lower
	          JOINT_WINDOW, its slant taken out; the highest such row); a left arm drawn on
	          past where the tail crosses it pokes out right of the crossing, and its end is
	          the bottom then. The literal half-width rule seats a y half way up its V
	          (placement/seat.js header: "a y (a V narrows to the line) ... seat wrong with
	          it")
	  width   , ;: the lowest row where the ink still spans half its width (UX-BEGINNER's rule,
	          fix_shapes.js halfWidthBottom: the comma's head)
	  null    j, and J f with their tail on, and a bowl letter or y whose bowl or joint isn't
	          found: the caller keeps the ink bottom, the writing line at the lowest
	A Brush letter's round nib hangs half its width past where the pen stopped: a stem drawn down
	to the writing line puts ink half a nib under it (the critic's "every Brush letter drawn to
	the line sinks"). penAllowance gives each piece of Brush ink that half (the stroke's own nib
	from glyph.anyink.nib.strokes, never more than half the piece's height), so the sink test
	reads the pen's center line, the way he drew it.

	  tailBottom(char, pieces, ink, { slope, stroke })   { bottom, from: 'bowl' | 'joint' |
	                                 'width' } or null; pieces: the letter's ink pieces (specks
	                                 left out)
	  bowlBottom(pieces, ink)        the bowl rule alone, or null
	  rasterBowlBottom(pieces, ink, { close })   the bowl rule on the ink laid on a grid; close
	                                 (font units) bridges a bowl that doesn't quite close
	                                 (B10 + B11 finalize: checks.js passes half a stroke)
	  jointBottom(pieces, ink, k, stroke)   the joint rule alone (k: the slant's run per unit
	                                 up), or null
	  halfWidthBottom(pieces, ink)   the half-width row (ink.yMin when no row is that wide)
	  penAllowance(item)             (piece) => half the nib of the Brush stroke the piece is, or 0
	  columnSpans(pieces, x)         the ink along the up-and-down line at x: [[bottom, top], ...]
*/
import { rowExtent } from '../spacing/measure.js';
import { pathContour } from '../spacing/outline.js';
import { strokeIdOf, strokeKeyOf } from '../nib/stroke_record.js';

/** A bowl hole covers at least this share of the letter's box (placement/seat.js). */
export const MIN_COUNTER_SHARE = 0.01;
/** A bowl hole's middle is in this share of the letter, from its top (placement/seat.js). */
export const COUNTER_TOP_SHARE = 0.6;
/** The y's joint is looked for in this share of the letter, from its ink bottom up. */
export const JOINT_WINDOW = 0.6;
/** Rows of the grid rasterBowlBottom lays the ink on. */
export const RASTER_ROWS = 96;
/** Rows read for the joint. */
export const JOINT_ROWS = 128;
/** A row whose left edge is within this many units of the rightmost is on the joint. */
export const JOINT_SLACK = 4;
/** A left arm drawn on past the crossing pokes this share of a stroke right of it. */
export const JOINT_POKE = 0.1;
/** Rows read from the bottom up for the half-width rule (fix_shapes.js's ROWS). */
export const WIDTH_ROWS = 64;

const BOWL_LETTERS = new Set('gpqQ');
const JOINT_LETTERS = new Set('y');
const WIDTH_LETTERS = new Set(',;');

/**
 * @param {String} char - one character
 * @param {Array<Object>} pieces - spacing/outline.js inkPieces (specks left out)
 * @param {{xMin: Number, xMax: Number, yMin: Number, yMax: Number}} ink - the box round them
 * @param {{slope?: Number, stroke?: Number}} [options] - slope: how far right the ink leans
 *   per unit up; stroke: the stroke estimate
 * @returns {{bottom: Number, from: String} | null}
 */
export function tailBottom(char, pieces, ink, { slope = 0, stroke = 0 } = {}) {
	if (!pieces?.length || !ink) return null;
	let bottom = null;
	let from = '';
	if (BOWL_LETTERS.has(char)) {
		bottom = bowlBottom(pieces, ink);
		from = 'bowl';
	} else if (JOINT_LETTERS.has(char)) {
		bottom = jointBottom(pieces, ink, slope, stroke);
		from = 'joint';
	} else if (WIDTH_LETTERS.has(char)) {
		bottom = halfWidthBottom(pieces, ink);
		from = 'width';
	}
	if (bottom === null || !Number.isFinite(bottom)) return null;
	return { bottom: Math.max(ink.yMin, Math.min(ink.yMax, bottom)), from };
}

/**
 * Placement's 'counter' rule in font units.
 * @param {Array<Object>} pieces
 * @param {Object} ink
 * @returns {Number | null} null when no hole makes a bowl
 */
export function bowlBottom(pieces, ink) {
	const height = ink.yMax - ink.yMin;
	const area = (ink.xMax - ink.xMin) * height;
	if (!(height > 0) || !(area > 0)) return null;
	let best = null;
	pieces.forEach((piece) => {
		piece.contours.slice(1).forEach((hole) => {
			const size = Math.abs(hole.area);
			if (!(size >= MIN_COUNTER_SHARE * area)) return;
			const box = pointsBox(hole.points);
			const middle = (box.yMin + box.yMax) / 2;
			if (middle < ink.yMax - COUNTER_TOP_SHARE * height) return;
			if (!best || size > best.size) best = { hole, box, size };
		});
	});
	if (!best) return null;
	const reach = Math.max(1, 0.002 * height);
	const { hole, box } = best;
	const below = runFrom(pieces, middleAt(hole.points, box.yMin, reach), box.yMin, -1);
	const above = runFrom(pieces, middleAt(hole.points, box.yMax, reach), box.yMax, 1);
	const runs = [below, above].filter((run) => run > 0);
	if (!runs.length) return null;
	return best.box.yMin - Math.min(...runs);
}

/**
 * B10 + B11 finalize: the bowl rule on the ink itself, for a bowl no single shape holds as a
 * hole (a p drawn as a stem and a bump, a q as a c and a stem: two Brush strokes enclose the
 * bowl together, and the critic's lifted Brush p and q were never called floating). The ink is
 * laid on a grid of RASTER_ROWS rows (the nonzero rule over every outline, so crossing strokes
 * are all ink); paper the page's edge can't reach is a hole. The biggest hole whose middle is in
 * the top COUNTER_TOP_SHARE and that covers MIN_COUNTER_SHARE of the box is the bowl; the body
 * ends under it by the thinner of the ink straight under and over its bottom's middle.
 * @param {Array<Object>} pieces
 * @param {Object} ink
 * @returns {Number | null}
 */
export function rasterBowlBottom(pieces, ink, { close = 0 } = {}) {
	const height = ink.yMax - ink.yMin;
	const width = ink.xMax - ink.xMin;
	if (!(height > 0) || !(width > 0)) return null;
	const cell = height / RASTER_ROWS;
	const rows = RASTER_ROWS + 2;
	const cols = Math.ceil(width / cell) + 2;
	const x0 = ink.xMin - cell;
	const y0 = ink.yMin - cell;
	const grid = new Uint8Array(rows * cols);
	const edges = [];
	pieces.forEach((piece) =>
		piece.contours.forEach(({ points }) => {
			for (let i = 0; i < points.length; i++) {
				const a = points[i];
				const b = points[(i + 1) % points.length];
				if (a[1] !== b[1]) edges.push([a, b]);
			}
		})
	);
	for (let r = 0; r < rows; r++) {
		const y = y0 + (r + 0.5) * cell;
		const crossings = [];
		edges.forEach(([[ax, ay], [bx, by]]) => {
			if (ay <= y === by <= y) return;
			crossings.push([ax + ((y - ay) * (bx - ax)) / (by - ay), by > ay ? 1 : -1]);
		});
		crossings.sort((a, b) => a[0] - b[0]);
		let winding = 0;
		for (let i = 0; i < crossings.length; i++) {
			winding += crossings[i][1];
			if (!winding || i + 1 >= crossings.length) continue;
			const from = Math.max(0, Math.ceil((crossings[i][0] - x0) / cell - 0.5));
			const to = Math.min(cols - 1, Math.floor((crossings[i + 1][0] - x0) / cell - 0.5));
			for (let c = from; c <= to; c++) grid[r * cols + c] = 1;
		}
	}
	// B10 + B11 finalize: a bowl that doesn't quite close (the bump stops short of the stem) is
	// closed first: the ink grown by `close` and shrunk back, which bridges gaps up to twice that
	if (close > 0) closeGrid(grid, rows, cols, Math.max(1, Math.round(close / cell)));
	// Paper reached from the edge: 2; what is left of the paper is holes
	const stack = [];
	const reach = (index) => {
		if (grid[index]) return;
		grid[index] = 2;
		stack.push(index);
	};
	for (let c = 0; c < cols; c++) {
		reach(c);
		reach((rows - 1) * cols + c);
	}
	for (let r = 0; r < rows; r++) {
		reach(r * cols);
		reach(r * cols + cols - 1);
	}
	const spread = (index, mark) => {
		const r = Math.floor(index / cols);
		const c = index % cols;
		if (c > 0) mark(index - 1);
		if (c + 1 < cols) mark(index + 1);
		if (r > 0) mark(index - cols);
		if (r + 1 < rows) mark(index + cols);
	};
	while (stack.length) spread(stack.pop(), reach);
	let best = null;
	for (let start = 0; start < grid.length; start++) {
		if (grid[start]) continue;
		const cells = [start];
		grid[start] = 3;
		let low = Infinity;
		let high = -Infinity;
		for (let k = 0; k < cells.length; k++) {
			const r = Math.floor(cells[k] / cols);
			low = Math.min(low, r);
			high = Math.max(high, r);
			spread(cells[k], (index) => {
				if (grid[index]) return;
				grid[index] = 3;
				cells.push(index);
			});
		}
		if (cells.length * cell * cell < MIN_COUNTER_SHARE * width * height) continue;
		const middle = y0 + ((low + high + 1) / 2) * cell;
		if (middle < ink.yMax - COUNTER_TOP_SHARE * height) continue;
		if (!best || cells.length > best.cells.length) best = { cells, low, high };
	}
	if (!best) return null;
	// the bottom row of the hole, its middle column, and the ink straight under and over it
	const bottomCells = best.cells.filter((index) => Math.floor(index / cols) === best.low);
	const cs = bottomCells.map((index) => index % cols);
	const column = Math.round((Math.min(...cs) + Math.max(...cs)) / 2);
	const run = (r, step) => {
		let count = 0;
		for (let k = r; k >= 0 && k < rows && grid[k * cols + column] === 1; k += step) count++;
		return count;
	};
	const below = run(best.low - 1, -1);
	const above = run(best.high + 1, 1);
	const runs = [below, above].filter((count) => count > 0);
	if (!runs.length) return null;
	return y0 + best.low * cell - Math.min(...runs) * cell;
}

/**
 * A morphological closing of a 0 / 1 grid in place: grown by k cells (a square), then shrunk
 * by k. Gaps up to 2k cells across fill; the ink keeps its edges elsewhere.
 * @param {Uint8Array} grid
 * @param {Number} rows
 * @param {Number} cols
 * @param {Number} k
 */
function closeGrid(grid, rows, cols, k) {
	const pass = (from, keep) => {
		// keep 1: grow (any ink within k); keep 0: shrink (all ink within k)
		const across = new Uint8Array(from.length);
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				let hit = keep ? 0 : 1;
				for (let d = -k; d <= k; d++) {
					const cc = c + d;
					const v = cc < 0 || cc >= cols ? 0 : from[r * cols + cc];
					if (keep ? v : !v) {
						hit = keep;
						break;
					}
				}
				across[r * cols + c] = hit;
			}
		}
		const out = new Uint8Array(from.length);
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				let hit = keep ? 0 : 1;
				for (let d = -k; d <= k; d++) {
					const rr = r + d;
					const v = rr < 0 || rr >= rows ? 0 : across[rr * cols + c];
					if (keep ? v : !v) {
						hit = keep;
						break;
					}
				}
				out[r * cols + c] = hit;
			}
		}
		return out;
	};
	const closed = pass(pass(grid, 1), 0);
	// never take ink away (the edge of the grid shrinks in from paper)
	for (let i = 0; i < grid.length; i++) grid[i] = grid[i] || closed[i] ? 1 : 0;
}

/**
 * Where a y's arms meet: the rightmost point of its left edge (slant taken out) in its lower
 * JOINT_WINDOW, the highest row that reaches it. A left arm drawn on past where the tail
 * crosses it ends lower than the crossing, and pokes out right of the tail there: the lowest
 * row whose right edge reaches further right than the crossing's (by JOINT_POKE of a stroke)
 * is the bottom then.
 * @param {Array<Object>} pieces
 * @param {Object} ink
 * @param {Number} [k] - the slant's run per unit up
 * @param {Number} [stroke] - the stroke estimate
 * @returns {Number | null}
 */
export function jointBottom(pieces, ink, k = 0, stroke = 0) {
	const height = ink.yMax - ink.yMin;
	if (!(height > 0)) return null;
	const run = Number(k) || 0;
	const contours = pieces.flatMap((piece) => piece.contours);
	const top = ink.yMin + JOINT_WINDOW * height;
	const rows = [];
	let most = -Infinity;
	for (let i = 1; i <= JOINT_ROWS; i++) {
		const y = ink.yMin + ((top - ink.yMin) * i) / JOINT_ROWS;
		const span = rowExtent(contours, y);
		if (!span) continue;
		const row = { y, left: span.left - run * y, right: span.right - run * y };
		rows.push(row);
		if (row.left > most) most = row.left;
	}
	let joint = null;
	rows.forEach((row) => {
		if (row.left >= most - JOINT_SLACK && (!joint || row.y > joint.y)) joint = row;
	});
	if (!joint) return null;
	const reach = joint.right + JOINT_POKE * (stroke > 0 ? stroke : 0);
	let bottom = joint.y;
	rows.forEach((row) => {
		if (row.y < bottom && row.right > reach) bottom = row.y;
	});
	return bottom;
}

/**
 * The lowest row, from the bottom up, where the ink spans half its width (fix_shapes.js
 * halfWidthBottom, the same rows).
 * @param {Array<Object>} pieces
 * @param {Object} ink
 * @returns {Number}
 */
export function halfWidthBottom(pieces, ink) {
	const contours = pieces.flatMap((piece) => piece.contours);
	const half = (ink.xMax - ink.xMin) / 2;
	const height = ink.yMax - ink.yMin;
	if (!(height > 0)) return ink.yMin;
	for (let row = 1; row < WIDTH_ROWS; row++) {
		const y = ink.yMin + (height * row) / WIDTH_ROWS;
		const span = rowExtent(contours, y);
		if (span && span.right - span.left >= half) return y;
	}
	return ink.yMin;
}

/**
 * Half the nib of each piece of Brush ink (B8: each stroke's shapes are tagged with its id and
 * key, its nib's width is kept in glyph.anyink.nib.strokes). Reads only; never sorts the strokes
 * out (nib/stroke_record.js reconcileStrokes changes the letter).
 * @param {Object} item - Glyph
 * @returns {(piece: Object) => Number}
 */
export function penAllowance(item) {
	const records = item?.anyink?.nib?.strokes;
	if (!Array.isArray(records) || !records.length) return () => 0;
	const nibs = new Map();
	(item.shapes || []).forEach((shape) => {
		if (shape?.objType !== 'Path') return;
		const id = strokeIdOf(shape);
		if (id === null) return;
		const key = strokeKeyOf(shape) || '';
		const record = records.find((entry) => entry?.id === id && (entry.key || '') === key);
		const size = Number(record?.size);
		if (!(size > 0)) return;
		const contour = pathContour(shape);
		if (contour) nibs.set(contour, size);
	});
	if (!nibs.size) return () => 0;
	return (piece) => {
		const size = nibs.get(piece?.contours?.[0]);
		if (!size) return 0;
		return Math.min(size / 2, Math.max(0, piece.yMax - piece.yMin) / 2);
	};
}

/**
 * The ink along the up-and-down line at x, overlapping pieces joined.
 * @param {Array<Object>} pieces
 * @param {Number} x
 * @returns {Array<[Number, Number]>} [bottom, top] spans, lowest first
 */
export function columnSpans(pieces, x) {
	const spans = [];
	pieces.forEach((piece) => {
		const ys = [];
		piece.contours.forEach(({ points }) => {
			for (let i = 0; i < points.length; i++) {
				const [x1, y1] = points[i];
				const [x2, y2] = points[(i + 1) % points.length];
				if (x1 > x === x2 > x) continue;
				ys.push(y1 + ((x - x1) * (y2 - y1)) / (x2 - x1));
			}
		});
		ys.sort((a, b) => a - b);
		for (let i = 0; i + 1 < ys.length; i += 2) spans.push([ys[i], ys[i + 1]]);
	});
	spans.sort((a, b) => a[0] - b[0]);
	const joined = [];
	spans.forEach(([bottom, top]) => {
		const last = joined[joined.length - 1];
		if (last && bottom <= last[1]) last[1] = Math.max(last[1], top);
		else joined.push([bottom, top]);
	});
	return joined;
}

// --------------------------------------------------------------
// Inside
// --------------------------------------------------------------

/** How far the ink runs from a hole's edge at y, straight down (step -1) or up (step 1) */
function runFrom(pieces, x, y, step) {
	if (x === null) return 0;
	const probe = y + step * 0.5;
	const span = columnSpans(pieces, x).find(([bottom, top]) => bottom <= probe && probe <= top);
	if (!span) return 0;
	return step < 0 ? y - span[0] : span[1] - y;
}

/** The middle of an outline's points within reach of the height y (a hole's bottom or top) */
function middleAt(points, y, reach) {
	let left = Infinity;
	let right = -Infinity;
	points.forEach(([px, py]) => {
		if (Math.abs(py - y) > reach) return;
		if (px < left) left = px;
		if (px > right) right = px;
	});
	if (!(left <= right)) return null;
	// a hair off the exact middle, so the line never runs through a corner
	return (left + right) / 2 + 1e-3;
}

function pointsBox(points) {
	let yMin = Infinity;
	let yMax = -Infinity;
	points.forEach(([, y]) => {
		if (y < yMin) yMin = y;
		if (y > yMax) yMax = y;
	});
	return { yMin, yMax };
}
