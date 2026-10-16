// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S1 (docs/SKETCH.md 6 "The edge rule", D-047 point 3): a Centerline point snapped to a
	writing line puts the EDGE of the ink on that line. Pure: no DOM, no editor. Font units, y up.

	A round nib's lowest point is always its center minus r (half the thickness), whatever the
	stroke's angle, so a point pinned to a line sits r inside it: above the writing and tail
	lines, below the small-letter, capitals and top lines. Ends, curve tops and bottoms and
	corners alike. Those shifted lines are the "ink lines" (drawn faintly beside the real lines
	while a Centerline piece is drawn, S2).

	Round tops and bottoms overshoot on top of that: a smooth point with a level lock on the
	writing, small-letter or capitals line moves outward by guideLines(font).overshoot (the
	ROUND_OVERSHOOT share of the letter box, the value B11's checks and fixes use). Ends and
	corners never overshoot; neither do the top and tail lines. "End" is decided per point: a
	point inside a closed piece, or between the two ends of an open one, is part of a round run
	and overshoots even when it also starts or ends another piece (joined points share ids, so
	the round bottom of a's or q's bowl is also where its stem or tail starts).

	The thickness the rule uses is edgeThickness: sketch.thickness kept at or under the Brush
	slider's thick end (model.js thicknessRange, MAX_SHARE of the small-letter height) and never
	past the small-letter height, so the ink lines never cross however thick a stored letter is
	or however far the small-letter line is moved (B15). The build sweeps the same thickness.

	A point where the stroke CROSSES its line (its neighbors along a piece lie on both sides of the
	line, as where a diagonal passes through the small-letter line) is not an edge of the ink: it
	sits on the line itself, with no inset and no overshoot, whatever it stores (S2's tool may
	store it with `inset: 'edge'`; the rule decides). extremes.js gives it no lock for the same
	reason. A point that only touches the line (a foot, the bottom of a v, a bowl's top) is an
	edge. A neighbor sitting on the line is on neither side.

	A point is pinned with `on` (a line name: 'top', 'capitals', 'small', 'writing', 'tail') and
	`inset: 'edge'` for Centerline points. Outline points (`inset` anything else) are the edge
	already and sit on the line itself, plus the same overshoot. Any other `on` (a half-way line,
	the Mirror line, a letter edge) is not a writing line and is left to its own rule.

	  LINE_NAMES                     the five writing lines a point can be pinned to
	  INK_SIDE                       +1 where the ink lies above the line, -1 below
	  OVERSHOOT_LINES                the lines round tops and bottoms overshoot
	  edgeThickness(font, thickness) the thickness the rule (and the sweep) uses: kept in range
	  inkLines(font, thickness)      { top, capitals, small, writing, tail }: where the center of
	                                 the nib goes for the ink's edge to touch each line
	  overshootOf(point, font, { isEnd })   the signed overshoot for a point (0 for none)
	  edgeY(point, font, thickness, { isEnd, crosses })   the whole-number y the point belongs
	                                 at, or null for a point on no writing line; crosses: on the
	                                 line itself
	  openEnds(sketch)               the ids of the first and last points of every open piece
	                                 (model.js pieceEnds(piece) is one piece's [first, last])
	  crossingPoints(sketch, font)   the ids of pinned points the stroke crosses their line at
	  roundPoints(sketch)            the ids inside a closed piece or between an open piece's ends
	  placeEdgePoints(sketch, font)  a new sketch with every inset 'edge' point at its edgeY for
	                                 edgeThickness (x kept); a point overshoots unless it is an
	                                 end and in no round run; a crossing point goes on its
	                                 line; untouched points, the pieces and everything else
	                                 shared with the input, which is never
	                                 changed. A sketch without a thickness comes back as is.
	                                 Called whenever the thickness or a line moves (S3).
*/
import { guideLines } from '../placement/classes.js';
import { thicknessRange } from './model.js';

export const LINE_NAMES = Object.freeze(['top', 'capitals', 'small', 'writing', 'tail']);

export const INK_SIDE = Object.freeze({ top: -1, capitals: -1, small: -1, writing: 1, tail: 1 });

export const OVERSHOOT_LINES = Object.freeze(new Set(['writing', 'small', 'capitals']));

/**
 * @param {Object} font - project.settings.font
 * @param {Number} thickness - font units
 * @returns {Number} the thickness kept at or under the slider's thick end and the small-letter
 *   height; 0 for anything that is not a positive number
 */
export function edgeThickness(font, thickness) {
	const value = Number(thickness);
	if (!(value > 0)) return 0;
	const lines = guideLines(font);
	const { max } = thicknessRange({ settings: { font: font || {} } });
	return Math.min(value, max, Math.max(0, lines.small - lines.writing));
}

/** @returns {Number} never -0 */
function whole(value) {
	const rounded = Math.round(value);
	return rounded === 0 ? 0 : rounded;
}

/**
 * @param {Object} font - project.settings.font
 * @param {Number} thickness - font units
 * @returns {{top: Number, capitals: Number, small: Number, writing: Number, tail: Number}}
 */
export function inkLines(font, thickness) {
	const lines = guideLines(font);
	const r = edgeThickness(font, thickness) / 2;
	const out = {};
	for (const name of LINE_NAMES) out[name] = lines[name] + INK_SIDE[name] * r;
	return out;
}

/**
 * @param {Object} point - a sketch point
 * @param {Object} font
 * @param {{isEnd?: Boolean}} [options] - isEnd: the point ends an open piece
 * @returns {Number} outward (down on the writing line, up on the others), 0 when it has none
 */
export function overshootOf(point, font, { isEnd = false } = {}) {
	if (!point || isEnd) return 0;
	if (!OVERSHOOT_LINES.has(point.on)) return 0;
	if (point.kind !== 'smooth' || point.lock !== 'level') return 0;
	return -INK_SIDE[point.on] * guideLines(font).overshoot;
}

/**
 * @param {Object} point
 * @param {Object} font
 * @param {Number} thickness
 * @param {{isEnd?: Boolean, crosses?: Boolean}} [options]
 * @returns {Number | null}
 */
export function edgeY(point, font, thickness, { isEnd = false, crosses = false } = {}) {
	if (!point || !LINE_NAMES.includes(point.on)) return null;
	if (crosses) return whole(guideLines(font)[point.on]);
	const line =
		point.inset === 'edge' ? inkLines(font, thickness)[point.on] : guideLines(font)[point.on];
	return whole(line + overshootOf(point, font, { isEnd }));
}

/** @returns {Array<String>} a part's point ids in order */
function partIds(part) {
	if (!part) return [];
	if (Array.isArray(part.points)) return part.points;
	return [part.from, part.to].filter((id) => id !== undefined && id !== null);
}

/**
 * @param {Object} sketch
 * @returns {Set<String>}
 */
export function openEnds(sketch) {
	const ends = new Set();
	for (const piece of sketch?.pieces ?? []) {
		if (!piece || piece.closed || !Array.isArray(piece.parts) || !piece.parts.length) continue;
		const first = partIds(piece.parts[0])[0];
		const last = partIds(piece.parts.at(-1)).at(-1);
		if (first !== undefined) ends.add(first);
		if (last !== undefined) ends.add(last);
	}
	return ends;
}

/**
 * @param {Object} sketch
 * @returns {Set<String>} the ids of every point of a closed piece, and of every point of an open
 *   piece but its first and last
 */
export function roundPoints(sketch) {
	const inside = new Set();
	for (const piece of sketch?.pieces ?? []) {
		if (!piece || !Array.isArray(piece.parts) || !piece.parts.length) continue;
		const ids = piece.parts.flatMap(partIds);
		const from = piece.closed ? 0 : 1;
		const to = piece.closed ? ids.length : ids.length - 1;
		for (let i = from; i < to; i++) {
			if (piece.closed || (ids[i] !== ids[0] && ids[i] !== ids.at(-1))) inside.add(ids[i]);
		}
	}
	return inside;
}

/**
 * @param {Object} piece
 * @returns {Array<String>} the piece's point ids in order, a join counted once, a loop's first
 *   point not repeated at its end
 */
function orderedIds(piece) {
	const ids = [];
	for (const id of piece.parts.flatMap(partIds)) if (ids.at(-1) !== id) ids.push(id);
	if (piece.closed && ids.length > 1 && ids[0] === ids.at(-1)) ids.pop();
	return ids;
}

/**
 * @param {Object} sketch
 * @param {Object} font - project.settings.font
 * @returns {Set<String>} ids of points pinned to a writing line whose neighbors along some piece
 *   lie on both sides of that line (more than half a unit off it)
 */
export function crossingPoints(sketch, font) {
	const out = new Set();
	const points = sketch?.points;
	if (!points || typeof points !== 'object') return out;
	const lines = guideLines(font);
	for (const piece of sketch?.pieces ?? []) {
		if (!piece || !Array.isArray(piece.parts) || !piece.parts.length) continue;
		const ids = orderedIds(piece);
		ids.forEach((id, i) => {
			const point = points[id];
			if (!point || !LINE_NAMES.includes(point.on)) return;
			const prevId = i > 0 ? ids[i - 1] : piece.closed ? ids.at(-1) : undefined;
			const nextId = i < ids.length - 1 ? ids[i + 1] : piece.closed ? ids[0] : undefined;
			if (prevId === undefined || nextId === undefined || prevId === id || nextId === id) return;
			const side = (other) => {
				const off = Number(other?.y) - lines[point.on];
				return Number.isFinite(off) && Math.abs(off) > 0.5 ? Math.sign(off) : 0;
			};
			if (side(points[prevId]) * side(points[nextId]) < 0) out.add(id);
		});
	}
	return out;
}

/**
 * @param {Object} sketch - glyph.anyink.sketch
 * @param {Object} font - project.settings.font
 * @returns {Object} the sketch with its edge points placed
 */
export function placeEdgePoints(sketch, font) {
	if (!sketch?.points || !(Number(sketch.thickness) > 0)) return sketch;
	const ends = openEnds(sketch);
	const inside = roundPoints(sketch);
	const crossing = crossingPoints(sketch, font);
	const points = {};
	for (const [id, point] of Object.entries(sketch.points)) {
		const y =
			point?.inset === 'edge'
				? edgeY(point, font, sketch.thickness, {
						isEnd: ends.has(id) && !inside.has(id),
						crosses: crossing.has(id),
					})
				: null;
		points[id] = y === null || y === point.y ? point : { ...point, y };
	}
	return { ...sketch, points };
}
