// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md section 5, "Editing"): the edits Select makes to a sketch, each one pure:
	the sketch passed in is never changed, a new one comes back (null when nothing would change).
	Font units, y up, whole numbers stored. Every move goes through the drag rules (rules.js), so
	pinned points keep their lines and onPiece and level / plumb partners follow.

	  movePoints(sketch, ids, delta, { radius })      a pick moved (a nudge too): { sketch,
	                       letGo, conflicts }; live circles all of whose points move go along
	  scalePoints(sketch, ids, { anchor, sx, sy }, { radius })   a pick resized about the corner
	                       opposite the dragged one; live circles in it scale with it; thickness
	                       never scales
	  resizeCircle(sketch, pieceId, pointer, { shift, radius })   the edge of a live Circle
	                       dragged: its size about its center (Shift: an oval)
	  setPointKind(sketch, id, kind)   'smooth' | 'corner'; a live circle given a corner is a
	                       Spline loop from then on
	  togglePointKind(sketch, id)
	  addPointOnPiece(sketch, hit)     a point where a piece was double-clicked: a Line splits
	                       into two Lines (a corner), an Arc into two arcs of its circle (smooth),
	                       a curve into a Spline through the new point, a Spline gets one more
	                       point; { sketch, id }
	  deletePoint(sketch, id)  removes it: a Spline loses a point, two parts it joins become
	                       one, an end shortens its piece; a piece left with too few points goes,
	                       a mirror twin goes too; { sketch, pieces: removed piece count }
	  deletePiece(sketch, pieceId)   removes it; its ends stay when other pieces share them
	  deletePick(sketch, pick)       the picked pieces, then the picked points: { sketch, points,
	                       pieces } (how many of each went)
	  setPointEnd(sketch, id, end)   'round' | 'flat' for one open end
	  toggleHelper(sketch, pieceId)  a piece made a helper line (dashed, no ink) or inked again
	  isOpenEnd(sketch, id)
*/
import { getPiece, isDot, pieceEnds, piecePointIds, piecesAt } from './model.js';
import { applyDrag, twinOf } from './rules.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * @param {Object} sketch
 * @param {Array<String>} ids
 * @param {{x: Number, y: Number}} delta
 * @param {{radius?: Number}} [options]
 * @returns {{sketch: Object, letGo: Array, conflicts: Array, moved: Array} | null}
 */
export function movePoints(sketch, ids, delta, { radius = 10, raw = null } = {}) {
	if (!ids?.length || (!delta.x && !delta.y)) return null;
	const targets = {};
	ids.forEach((id) => {
		const p = sketch.points?.[id];
		if (!p) return;
		const at = { x: Number(p.x) + delta.x, y: Number(p.y) + delta.y };
		targets[id] = { ...at, raw: raw ? { x: Number(p.x) + raw.x, y: Number(p.y) + raw.y } : at };
	});
	return applyDrag(sketch, targets, { radius });
}

/**
 * @param {Object} sketch
 * @param {Array<String>} ids
 * @param {{anchor: {x, y}, sx: Number, sy: Number}} scale
 * @param {{radius?: Number}} [options]
 * @returns {Object | null}
 */
export function scalePoints(sketch, ids, { anchor, sx, sy }, { radius = 10 } = {}) {
	if (!ids?.length || !Number.isFinite(sx) || !Number.isFinite(sy)) return null;
	if (sx === 1 && sy === 1) return null;
	const moving = new Set(ids);
	const start = clone(sketch);
	const keep = [];
	(start.pieces || []).forEach((piece) => {
		if (!piece?.circle) return;
		if (!piecePointIds(piece).every((id) => moving.has(id))) return;
		const c = piece.circle;
		piece.circle = {
			cx: Math.round(anchor.x + (c.cx - anchor.x) * sx),
			cy: Math.round(anchor.y + (c.cy - anchor.y) * sy),
			rx: Math.max(1, Math.round(Math.abs(c.rx * sx))),
			ry: Math.max(1, Math.round(Math.abs(c.ry * sy))),
		};
		keep.push(piece.id);
	});
	const targets = {};
	ids.forEach((id) => {
		const p = sketch.points?.[id];
		if (!p) return;
		const at = {
			x: anchor.x + (Number(p.x) - anchor.x) * sx,
			y: anchor.y + (Number(p.y) - anchor.y) * sy,
		};
		targets[id] = { ...at, raw: at };
	});
	return applyDrag(start, targets, { radius, keepCircles: keep });
}

/** The four points of a live circle by role (as circle_tool.js stores them) */
function circleRoles(piece, points) {
	const ids = [...(piece.parts?.[0]?.points || [])];
	if (ids.length === 5 && ids[0] === ids[4]) ids.pop();
	if (ids.length !== 4) return null;
	const c = piece.circle;
	const role = {};
	ids.forEach((id) => {
		const p = points[id];
		if (!p) return;
		const dx = Number(p.x) - c.cx;
		const dy = Number(p.y) - c.cy;
		if (Math.abs(dx) >= Math.abs(dy)) role[dx >= 0 ? 'right' : 'left'] = id;
		else role[dy >= 0 ? 'top' : 'bottom'] = id;
	});
	return role.right && role.left && role.top && role.bottom ? role : null;
}

/**
 * @param {Object} sketch
 * @param {Number} pieceId
 * @param {{x: Number, y: Number}} pointer
 * @param {{shift?: Boolean, radius?: Number}} [options]
 * @returns {Object | null}
 */
export function resizeCircle(sketch, pieceId, pointer, { shift = false, radius = 10 } = {}) {
	const piece = getPiece(sketch, pieceId);
	if (!piece?.circle) return null;
	const roles = circleRoles(piece, sketch.points);
	if (!roles) return null;
	const { cx, cy } = piece.circle;
	const dx = Math.abs(pointer.x - cx);
	const dy = Math.abs(pointer.y - cy);
	let rx = Math.max(1, Math.round(Math.hypot(dx, dy)));
	let ry = rx;
	if (shift) {
		rx = Math.max(1, Math.round(dx));
		ry = Math.max(1, Math.round(dy));
	}
	const start = clone(sketch);
	getPiece(start, pieceId).circle = { cx, cy, rx, ry };
	const at = {
		right: { x: cx + rx, y: cy },
		left: { x: cx - rx, y: cy },
		top: { x: cx, y: cy + ry },
		bottom: { x: cx, y: cy - ry },
	};
	const targets = {};
	Object.entries(roles).forEach(([role, id]) => {
		targets[id] = { ...at[role], raw: at[role] };
	});
	return applyDrag(start, targets, { radius, keepCircles: [pieceId] });
}

/**
 * @param {Object} sketch
 * @param {String} id
 * @param {'smooth' | 'corner'} kind
 * @returns {Object | null}
 */
export function setPointKind(sketch, id, kind) {
	const point = sketch?.points?.[id];
	if (!point || (kind !== 'smooth' && kind !== 'corner') || point.kind === kind) return null;
	const next = clone(sketch);
	next.points[id].kind = kind;
	if (kind === 'corner') {
		delete next.points[id].aim;
		delete next.points[id].lock;
		piecesAt(next, id).forEach((piece) => {
			delete piece.circle;
		});
	}
	return next;
}

/** @returns {Object | null} */
export function togglePointKind(sketch, id) {
	const point = sketch?.points?.[id];
	if (!point) return null;
	return setPointKind(sketch, id, point.kind === 'smooth' ? 'corner' : 'smooth');
}

/** @returns {String} 'p<n>' one past the highest */
function freshId(sketch) {
	let highest = 0;
	Object.keys(sketch.points || {}).forEach((id) => {
		const match = /^p(\d+)$/.exec(id);
		if (match) highest = Math.max(highest, Number(match[1]));
	});
	return `p${highest + 1}`;
}

/**
 * @param {Object} sketch
 * @param {Object} hit - pick.js hitTest's piece hit ({ id, part, a, b, x, y, t })
 * @returns {{sketch: Object, id: String} | null}
 */
export function addPointOnPiece(sketch, hit) {
	const source = getPiece(sketch, hit?.id);
	if (!source || isDot(source)) return null;
	const next = clone(sketch);
	const piece = getPiece(next, hit.id);
	const part = piece.parts[hit.part];
	if (!part) return null;
	const id = freshId(next);
	const at = { x: Math.round(hit.x), y: Math.round(hit.y) };
	const share = Math.min(Math.max(Number(hit.t) || 0.5, 0.01), 0.99);
	if (part.type === 'line') {
		next.points[id] = { ...at, kind: 'corner' };
		piece.parts.splice(
			hit.part,
			1,
			{ type: 'line', from: part.from, to: id },
			{ type: 'line', from: id, to: part.to }
		);
	} else if (part.type === 'arc') {
		next.points[id] = { ...at, kind: 'smooth' };
		const turn = Math.atan(Number(part.bulge) || 0);
		const first = { type: 'arc', from: part.from, to: id, bulge: round(Math.tan(turn * share)) };
		if (part.tangent) first.tangent = true;
		const second = {
			type: 'arc',
			from: id,
			to: part.to,
			bulge: round(Math.tan(turn * (1 - share))),
		};
		piece.parts.splice(hit.part, 1, first, second);
	} else if (part.type === 'curve') {
		next.points[id] = { ...at, kind: 'smooth' };
		piece.parts.splice(hit.part, 1, { type: 'spline', points: [part.from, id, part.to] });
	} else if (part.type === 'spline') {
		next.points[id] = { ...at, kind: 'smooth' };
		const list = part.points;
		let where = -1;
		for (let i = 0; i + 1 < list.length; i++) {
			if (list[i] === hit.a && list[i + 1] === hit.b) where = i + 1;
		}
		if (where < 0 && piece.closed && list.at(-1) === hit.a && list[0] === hit.b) {
			where = list.length;
		}
		if (where < 0) return null;
		list.splice(where, 0, id);
	} else {
		return null;
	}
	delete piece.circle;
	return { sketch: next, id };
}

/** Drops relations that name a point or piece that is gone */
function tidy(sketch) {
	const pieceIds = new Set((sketch.pieces || []).map((piece) => piece.id));
	const used = new Set();
	(sketch.pieces || []).forEach((piece) => piecePointIds(piece).forEach((id) => used.add(id)));
	Object.keys(sketch.points || {}).forEach((id) => {
		if (!used.has(id)) delete sketch.points[id];
	});
	Object.values(sketch.points || {}).forEach((point) => {
		if (point.mirrorOf && !sketch.points[point.mirrorOf]) delete point.mirrorOf;
	});
	sketch.relations = (sketch.relations || []).filter((relation) => {
		if (relation?.type === 'onPiece') {
			return !!sketch.points[relation.point] && pieceIds.has(relation.piece);
		}
		return !!sketch.points[relation?.a] && !!sketch.points[relation?.b];
	});
	return sketch;
}

/** A piece still holds together after a point went (enough points left for what it is) */
function stillPiece(piece) {
	const parts = piece.parts || [];
	if (!parts.length) return false;
	if (piece.closed && parts.length === 1 && parts[0].type === 'spline') {
		return (parts[0].points || []).length >= 3;
	}
	if (piece.closed) {
		const ends = pieceEnds(piece);
		return !!ends && ends[0] === ends[1] && parts.length >= 2;
	}
	return true;
}

/** Takes one point out of one piece (in place) */
function takeOut(piece, id) {
	const parts = piece.parts || [];
	// inside a Spline part: the Spline loses the point
	for (const part of parts) {
		if (part.type !== 'spline') continue;
		const list = part.points || [];
		const at = list.indexOf(id);
		if (at < 0) continue;
		const inside = at > 0 && at < list.length - 1;
		if (inside || (piece.closed && parts.length === 1)) {
			list.splice(at, 1);
			if (list.length === 2 && !piece.closed) {
				const index = parts.indexOf(part);
				parts.splice(index, 1, { type: 'line', from: list[0], to: list[1] });
			}
			return;
		}
	}
	// a point where two parts meet: they become one
	const arriving = parts.findIndex((part) =>
		part.type !== 'spline' ? part.to === id : part.points.at(-1) === id
	);
	const leaving = parts.findIndex((part) =>
		part.type !== 'spline' ? part.from === id : part.points[0] === id
	);
	if (arriving >= 0 && leaving >= 0 && arriving !== leaving) {
		const a = parts[arriving];
		const b = parts[leaving];
		const from = a.type === 'spline' ? a.points[0] : a.from;
		const to = b.type === 'spline' ? b.points.at(-1) : b.to;
		const middle = [
			...(a.type === 'spline' ? a.points.slice(1, -1) : []),
			...(b.type === 'spline' ? b.points.slice(1, -1) : []),
		];
		const both = a.type === 'line' && b.type === 'line';
		const merged =
			both || (!middle.length && from !== to)
				? { type: 'line', from, to }
				: { type: 'spline', points: [from, ...middle, to] };
		if (from === to) {
			// the loop closed through this point alone: what is left is the rest of the loop
			parts.splice(Math.max(arriving, leaving), 1);
			parts.splice(Math.min(arriving, leaving), 1);
			piece.closed = false;
			return;
		}
		if (leaving === 0 && arriving === parts.length - 1) {
			// the closing join of a loop: the loop now runs from the part after it
			parts.splice(arriving, 1);
			parts.splice(0, 1, merged);
			return;
		}
		parts.splice(arriving, 2, merged);
		return;
	}
	// an end of an open piece: the part at that end goes, or a Spline there shortens
	if (arriving >= 0 || leaving >= 0) {
		const index = arriving >= 0 ? arriving : leaving;
		const part = parts[index];
		if (part.type === 'spline' && part.points.length > 2) {
			if (arriving >= 0) part.points.pop();
			else part.points.shift();
			if (part.points.length === 2) {
				parts.splice(index, 1, { type: 'line', from: part.points[0], to: part.points[1] });
			}
			return;
		}
		parts.splice(index, 1);
		if (piece.closed) piece.closed = false;
	}
}

/**
 * @param {Object} sketch
 * @param {String} id
 * @returns {{sketch: Object, pieces: Number} | null}
 */
export function deletePoint(sketch, id) {
	if (!sketch?.points?.[id]) return null;
	const next = clone(sketch);
	const ids = [id];
	const twin = twinOf(next, id);
	if (twin) ids.push(twin);
	let removed = 0;
	ids.forEach((gone) => {
		next.pieces = (next.pieces || []).filter((piece) => {
			if (!piecePointIds(piece).includes(gone)) return true;
			if (isDot(piece)) {
				removed += 1;
				return false;
			}
			takeOut(piece, gone);
			delete piece.circle;
			if (stillPiece(piece)) return true;
			removed += 1;
			return false;
		});
		delete next.points[gone];
	});
	return { sketch: tidy(next), pieces: removed };
}

/**
 * @param {Object} sketch
 * @param {Number} pieceId
 * @returns {Object | null}
 */
export function deletePiece(sketch, pieceId) {
	if (!getPiece(sketch, pieceId)) return null;
	const next = clone(sketch);
	next.pieces = next.pieces.filter((piece) => piece.id !== pieceId);
	return tidy(next);
}

/**
 * @param {Object} sketch
 * @param {{points: Array, pieces: Array}} pick
 * @returns {{sketch: Object, points: Number, pieces: Number} | null}
 */
export function deletePick(sketch, pick) {
	let next = sketch;
	let pieces = 0;
	let points = 0;
	(pick?.pieces || []).forEach((pieceId) => {
		const after = deletePiece(next, pieceId);
		if (after) {
			next = after;
			pieces += 1;
		}
	});
	(pick?.points || []).forEach((id) => {
		if (!next.points?.[id]) return;
		const after = deletePoint(next, id);
		if (after) {
			next = after.sketch;
			points += 1;
		}
	});
	if (next === sketch) return null;
	return { sketch: next, points, pieces };
}

/** @returns {Boolean} an end of an open piece (where Round / Flat applies) */
export function isOpenEnd(sketch, id) {
	return piecesAt(sketch, id).some((piece) => {
		if (piece.closed || isDot(piece) || piece.use === 'outline') return false;
		const ends = pieceEnds(piece);
		return !!ends && (ends[0] === id || ends[1] === id);
	});
}

/**
 * @param {Object} sketch
 * @param {String} id
 * @param {'round' | 'flat'} end
 * @returns {Object | null}
 */
export function setPointEnd(sketch, id, end) {
	if (!isOpenEnd(sketch, id) || (end !== 'round' && end !== 'flat')) return null;
	const own = sketch.points[id].end || sketch.ends || 'round';
	if (own === end) return null;
	const next = clone(sketch);
	next.points[id].end = end;
	return next;
}

/**
 * @param {Object} sketch
 * @param {Number} pieceId
 * @returns {{sketch: Object, helper: Boolean} | null}
 */
export function toggleHelper(sketch, pieceId) {
	if (!getPiece(sketch, pieceId)) return null;
	const next = clone(sketch);
	const piece = getPiece(next, pieceId);
	if (piece.use === 'helper') {
		const outline = piece.closed && (piece.was === 'outline' || sketch.way === 'outline');
		piece.use = outline ? 'outline' : 'center';
		delete piece.was;
		return { sketch: next, helper: false };
	}
	piece.was = piece.use === 'outline' ? 'outline' : 'center';
	piece.use = 'helper';
	return { sketch: next, helper: true };
}

const round = (value) => Math.round(Number(value) * 1e6) / 1e6;
