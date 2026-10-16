// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S2 (docs/SKETCH.md section 2 "How every sketch tool behaves", section 8): chaining
	parts into one open piece, the SolidWorks way. Pure: no DOM, no editor, no history. The tools
	(line.js, arc_tool.js, spline_tool.js) keep the open piece and call these; finishing hands
	back the sketch with the piece stored, for the tool's one addState.

	The open piece is plain data like a stored one, { use, closed: false, parts }, started as a
	dot ({ type: 'spline', points: [start] }) and never put in sketch.pieces until it finishes.

	The angle rule (autotransition). From the open end, how the pointer leaves decides the join:
	once it is DECIDE_SHARE (1.5) x the snap radius away, within TANGENT_DEGREES (20) of the
	direction the curve arrives at the end: 'tangent' (the end point turns smooth and a faint
	tangent line shows); else 'corner'. Decided once on the way out; going back within the snap
	radius of the end waits again. An end with no direction yet (the first point) is a corner.
	The Line tool only: going back over the end and out again toggles a tangent arc (the pull-back
	arc); do it again for a line. Switching tools mid-piece follows the same rule.

	Give way: the part you draw now wins and the part before it bends. A Spline's end turns to a
	following tangent Line (curves.js reads the smooth join); an Arc whose first end is already a
	smooth join and that a tangent Line follows is stored as a 'curve' (tangent at both ends,
	section 8); an Arc from a corner stays an Arc and curves.js builds it tangent into the Line,
	keeping its corner. A Line's clicked ends are never moved: nothing here changes a point's x / y.

	Finishing: Enter, a double-click or the first Esc finish the open piece; with nothing open,
	Esc goes back to Select (a second Esc). Clicking the piece's first point closes the loop (the
	tool calls finishPiece after that click). The second click of a double-click lands on the open
	end and adds nothing (appendPart: added false).

	  TANGENT_DEGREES, DECIDE_SHARE
	  startPiece(startId, { use })          the open piece: a dot at its first point
	  leaveDirection(piece, sketch)         degrees the curve arrives at the open end, or null
	  judgeLeave({ end, dir, pointer, radius })   'pending' | 'tangent' | 'corner'
	  createLeave({ end, dir, radius, tool, from })   a tracker: move(pointer) -> { mode, arc,
	                                        hint } (hint { type: 'tangent', from, dir } or null);
	                                        from: the pointer when it starts (left out: on the
	                                        end); a pull-back counts only from over the end
	  appendPart(sketch, piece, { tool, to, mode, bulge, arc })   { sketch, piece, added }: the
	                                        part from the open end to point `to` (already in the
	                                        sketch); never changes its inputs
	  giveWay(piece, sketch)                the piece with tangent-at-both-ends Arcs as curves
	  sameSpot(a, b, radius)                two places within the radius
	  finishPiece(sketch, piece, { use, font })   { sketch, piece }: the piece cleaned (a repeated
	                                        last click dropped, a loop closed, a lone 2-point
	                                        Spline a Line, one point a dot or, on an Outline
	                                        piece, nothing), stored with an id and key, its level /
	                                        plumb locks settled (snap.js settleLocks) and, with a
	                                        font, every edge point placed (edge_rule.js); points
	                                        only it used and it dropped are removed
	  takeBackClick(piece)                  { piece, dropped }: the last click taken back (piece
	                                        null once the first point goes)
	  keyAction({ open }, key)              'finish' | 'select' | null for Enter and Escape
	  createChain()                         { open, begin(), escape(), enter(), doubleClick() }
*/
import { tangentBulge } from '../arc.js';
import { endDirection, pieceSkeleton } from '../curves.js';
import { placeEdgePoints } from '../edge_rule.js';
import { newPieceKey, nextPieceId, partEnds, piecePointIds, USES } from '../model.js';
import { settleLocks } from './snap.js';

export const TANGENT_DEGREES = 20;
export const DECIDE_SHARE = 1.5;

/** Two places closer than this (font units) are one place when nothing else is said */
const SAME = 0.5;

/** @returns {Number} the angle between two directions, 0 to 180 */
function apart(a, b) {
	return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

/**
 * @param {String} startId
 * @param {{use?: String}} [options]
 * @returns {Object}
 */
export function startPiece(startId, { use = 'center' } = {}) {
	return {
		use: USES.includes(use) ? use : 'center',
		closed: false,
		parts: [{ type: 'spline', points: [startId] }],
	};
}

/** @returns {Boolean} the piece is still only its first point */
function isStart(piece) {
	const parts = piece?.parts || [];
	return parts.length === 1 && parts[0].type === 'spline' && (parts[0].points || []).length === 1;
}

/** @returns {String|null} the open end's point id */
function lastId(piece) {
	const parts = piece?.parts || [];
	return parts.length ? partEnds(parts.at(-1))?.[1] ?? null : null;
}

/**
 * @param {Object} piece - the open piece
 * @param {Object} sketch
 * @returns {Number|null}
 */
export function leaveDirection(piece, sketch) {
	if (!piece || isStart(piece)) return null;
	const cubics = pieceSkeleton(piece, sketch);
	const last = cubics.at(-1);
	if (!last || last.every((p) => p[0] === last[0][0] && p[1] === last[0][1])) return null;
	return endDirection(last);
}

/**
 * @param {{end: {x, y}, dir: Number|null, pointer: {x, y}, radius: Number}} args
 * @returns {'pending'|'tangent'|'corner'}
 */
export function judgeLeave({ end, dir, pointer, radius }) {
	const dx = Number(pointer.x) - Number(end.x);
	const dy = Number(pointer.y) - Number(end.y);
	if (Math.hypot(dx, dy) < DECIDE_SHARE * radius) return 'pending';
	if (dir === null || dir === undefined || !Number.isFinite(Number(dir))) return 'corner';
	const way = (Math.atan2(dy, dx) * 180) / Math.PI;
	return apart(way, Number(dir)) <= TANGENT_DEGREES ? 'tangent' : 'corner';
}

/**
 * @param {{end: {x, y}, dir: Number|null, radius: Number, tool?: String, from?: {x, y}}} args
 * @returns {{move: Function, mode: String, arc: Boolean}}
 */
export function createLeave({ end, dir, radius, tool, from = null }) {
	const hasDir = dir !== null && dir !== undefined && Number.isFinite(Number(dir));
	let mode = 'pending';
	let arc = false;
	let left = false; // the pointer has been out once, from over the end
	let back = true; // the pointer is over the end (waiting to be judged)
	// S2 integration: the pointer has been over the end since the tracker started (from: where
	// the pointer was then; left out, it is taken to be on the end, as after a click). A tool
	// picked, or a bulge clicked, with the pointer far from the end: its first way out is
	// judged, but only a leave that starts over the end counts toward a pull-back (found in
	// Chrome: Arc's bulge click, then L, then along the arc made the Line a tangent arc)
	let near =
		!from || Math.hypot(Number(from.x) - Number(end.x), Number(from.y) - Number(end.y)) <= radius;
	const state = {
		get mode() {
			return mode;
		},
		get arc() {
			return arc;
		},
		move(pointer) {
			const distance = Math.hypot(
				Number(pointer.x) - Number(end.x),
				Number(pointer.y) - Number(end.y)
			);
			if (distance <= radius) {
				back = true;
				near = true;
				mode = 'pending';
			} else if (back && distance >= DECIDE_SHARE * radius) {
				back = false;
				if (left && tool === 'line' && hasDir) arc = !arc;
				if (near) left = true;
				mode = arc ? 'tangent' : judgeLeave({ end, dir, pointer, radius });
			}
			const hint =
				mode === 'tangent' && hasDir ? { type: 'tangent', from: end, dir: Number(dir) } : null;
			return { mode, arc, hint };
		},
	};
	return state;
}

/** @returns {Boolean} */
export function sameSpot(a, b, radius = SAME) {
	if (!a || !b) return false;
	return Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y)) <= radius;
}

/**
 * @param {Object} sketch - holds every point the piece uses, `to` included
 * @param {Object} piece - the open piece
 * @param {{tool: 'line'|'arc'|'spline', to: String, mode?: String, bulge?: Number, arc?: Boolean,
 *   top?: String | null}} args - top (S3): the writing line the arc's top or bottom was snapped to;
 *   stored as part.top = { on } so a thickness or line change puts it back on the line
 * @returns {{sketch: Object, piece: Object, added: Boolean}}
 */
export function appendPart(sketch, piece, { tool, to, mode = 'corner', bulge, arc = false, top = null }) {
	const endId = lastId(piece);
	const points = { ...(sketch.points || {}) };
	const end = points[endId];
	const target = points[to];
	if (!end || !target || to === endId || (sameSpot(end, target) && !closesOn(piece, to))) {
		// nothing to add (the second click of a double-click): a point made only for it goes
		if (target && to !== endId && !usedAnywhere(sketch, piece, to)) delete points[to];
		return { sketch: { ...sketch, points }, piece, added: false };
	}
	const start = isStart(piece);
	const tangent = !start && mode === 'tangent';
	let parts = start ? [] : piece.parts.map((part) => ({ ...part }));
	const lastPart = parts.at(-1);
	if (!start) {
		// S2 integration: a Line after a Line meets at a corner even when it left "along": both
		// clicked ends stay put, so the join can never be smooth (a smooth point with a kink in
		// it would turn both Lines in S4's drags)
		const straight = tool === 'line' && !arc && lastPart?.type === 'line';
		const kind = tangent && !straight ? 'smooth' : 'corner';
		if (end.kind !== kind) points[endId] = { ...end, kind };
	}
	if (tool === 'spline') {
		if (start) parts = [{ type: 'spline', points: [endId, to] }];
		else if (lastPart?.type === 'spline') {
			parts[parts.length - 1] = { ...lastPart, points: [...lastPart.points, to] };
		} else parts.push({ type: 'spline', points: [endId, to] });
	} else if (tool === 'arc' || (tool === 'line' && arc)) {
		if (tangent) {
			const dir = leaveDirection(piece, sketch);
			const worked = dir === null ? null : tangentBulge([end.x, end.y], [target.x, target.y], dir);
			parts.push({
				type: 'arc',
				from: endId,
				to,
				bulge: worked ?? (Number(bulge) || 0),
				tangent: true,
				...topTag(top),
			});
		} else {
			parts.push({ type: 'arc', from: endId, to, bulge: Number(bulge) || 0, ...topTag(top) });
		}
	} else {
		parts.push({ type: 'line', from: endId, to });
	}
	const next = { ...sketch, points };
	return { sketch: next, piece: giveWay({ ...piece, parts }, next), added: true };
}

/** S3: an arc's top snapped to a line, as the part stores it (build.js placeArcTops) */
function topTag(top) {
	return typeof top === 'string' && top ? { top: { on: top } } : {};
}

/** @returns {Boolean} `to` is the piece's first point (the click that closes a loop) */
function closesOn(piece, to) {
	const first = partEnds(piece?.parts?.[0])?.[0];
	return first === to && !isStart(piece);
}

/** @returns {Boolean} the point is used by a stored piece, the open piece or a relation */
function usedAnywhere(sketch, piece, id) {
	if (piecePointIds(piece).includes(id)) return true;
	if ((sketch.pieces || []).some((other) => piecePointIds(other).includes(id))) return true;
	return (sketch.relations || []).some((r) => r && (r.point === id || r.a === id || r.b === id));
}

/**
 * @param {Object} piece
 * @param {Object} sketch
 * @returns {Object} the piece (a new one when a part changed)
 */
export function giveWay(piece, sketch) {
	const parts = piece?.parts || [];
	const points = sketch?.points || {};
	let changed = false;
	const out = parts.map((part, i) => {
		if (part.type !== 'arc') return part;
		const next = parts[i + 1];
		if (!next || next.type !== 'line') return part;
		const before = parts[i - 1];
		const firstSmooth = !!before && (points[part.from]?.kind === 'smooth' || part.tangent);
		const endSmooth = points[part.to]?.kind === 'smooth';
		if (!firstSmooth || !endSmooth) return part;
		changed = true;
		return { type: 'curve', from: part.from, to: part.to };
	});
	return changed ? { ...piece, parts: out } : piece;
}

/**
 * @param {Object} sketch
 * @param {Object} piece - the open piece
 * @param {{use?: String, font?: Object}} [options]
 * @returns {{sketch: Object, piece: Object|null}}
 */
export function finishPiece(sketch, piece, { use, font } = {}) {
	const kind = USES.includes(use) ? use : USES.includes(piece?.use) ? piece.use : 'center';
	const before = piecePointIds(piece);
	const points = { ...(sketch.points || {}) };
	let parts = cleanParts(piece?.parts || [], points);
	let closed = false;

	const ends = parts.length ? [partEnds(parts[0])[0], partEnds(parts.at(-1))[1]] : null;
	const many =
		parts.length > 1 || (parts[0]?.type === 'spline' ? parts[0].points.length > 1 : !!parts[0]);
	if (ends && many && ends[0] === ends[1]) {
		if (parts.length === 1 && parts[0].type === 'spline') {
			const ring = parts[0].points.slice(0, -1);
			if (ring.length >= 3) {
				parts = [{ type: 'spline', points: ring }];
				closed = true;
			} else parts = [{ type: 'spline', points: ring.slice(0, 2) }];
		} else if (parts.length >= 2) closed = true;
	}
	// a lone 2-point Spline is a Line
	if (!closed && parts.length === 1 && parts[0].type === 'spline' && parts[0].points.length === 2) {
		parts = [{ type: 'line', from: parts[0].points[0], to: parts[0].points[1] }];
	}
	const firstId = before[0];
	if (!parts.length && firstId !== undefined) parts = [{ type: 'spline', points: [firstId] }];
	const isDotOnly =
		parts.length === 1 && parts[0].type === 'spline' && parts[0].points.length === 1;

	const pieces = Array.isArray(sketch.pieces) ? [...sketch.pieces] : [];
	let stored = null;
	if (!(isDotOnly && kind === 'outline') && parts.length) {
		stored = giveWay(
			{
				...piece,
				id: Number.isInteger(piece.id) ? piece.id : nextPieceId({ pieces }),
				key: piece.key || newPieceKey(),
				use: kind,
				closed,
				parts,
			},
			{ points }
		);
		const at = pieces.findIndex((other) => other?.id === stored.id);
		if (at >= 0) pieces[at] = stored;
		else pieces.push(stored);
	}
	// points this piece made and no longer uses
	const kept = new Set(stored ? piecePointIds(stored) : []);
	let next = { ...sketch, points, pieces };
	for (const id of before) {
		if (!kept.has(id) && !usedAnywhere(next, null, id)) delete points[id];
	}
	if (stored) {
		next = settleLocks(next, stored);
		if (font) next = placeEdgePoints(next, font);
	}
	return { sketch: next, piece: stored };
}

/** The parts with zero-length parts and repeated spline points dropped */
function cleanParts(parts, points) {
	const out = [];
	for (const part of parts) {
		if (part.type === 'spline') {
			const ids = [];
			for (const id of part.points || []) {
				const last = ids.at(-1);
				if (
					last !== undefined &&
					(last === id || (sameSpot(points[last], points[id]) && !isFirst(out, ids, id)))
				)
					continue;
				ids.push(id);
			}
			if (ids.length) out.push({ ...part, points: ids });
		} else if (part.from !== part.to && !sameSpot(points[part.from], points[part.to])) {
			out.push({ ...part });
		}
	}
	// a one-point spline left beside other parts is no part
	const real = out.filter((part) => !(part.type === 'spline' && part.points.length === 1));
	return real.length ? real : out.slice(0, 1);
}

/** @returns {Boolean} id is the piece's first point (a loop closing on it is no repeat) */
function isFirst(out, ids, id) {
	const first = out.length ? partEnds(out[0])[0] : ids[0];
	return first === id;
}

/**
 * @param {Object} piece - the open piece
 * @returns {{piece: Object|null, dropped: String|null}}
 */
export function takeBackClick(piece) {
	const parts = (piece?.parts || []).map((part) => ({ ...part }));
	if (!parts.length) return { piece: null, dropped: null };
	if (isStart(piece)) return { piece: null, dropped: parts[0].points[0] };
	const last = parts.at(-1);
	let dropped;
	if (last.type === 'spline') {
		dropped = last.points.at(-1);
		const rest = last.points.slice(0, -1);
		if (rest.length > 1) parts[parts.length - 1] = { ...last, points: rest };
		else parts.pop();
	} else {
		dropped = last.to;
		parts.pop();
	}
	if (!parts.length) {
		const first = last.type === 'spline' ? last.points[0] : last.from;
		return { piece: { ...piece, parts: [{ type: 'spline', points: [first] }] }, dropped };
	}
	return { piece: { ...piece, parts }, dropped };
}

/**
 * @param {{open: Boolean}} state
 * @param {String} key - KeyboardEvent.key
 * @returns {'finish'|'select'|null}
 */
export function keyAction({ open }, key) {
	if (key === 'Escape') return open ? 'finish' : 'select';
	if (key === 'Enter') return open ? 'finish' : null;
	return null;
}

/**
 * @returns {{open: Boolean, begin: Function, escape: Function, enter: Function, doubleClick: Function}}
 */
export function createChain() {
	let open = false;
	const finishIfOpen = () => {
		if (!open) return null;
		open = false;
		return 'finish';
	};
	return {
		get open() {
			return open;
		},
		begin() {
			open = true;
		},
		escape() {
			return finishIfOpen() || 'select';
		},
		enter: finishIfOpen,
		doubleClick: finishIfOpen,
	};
}
