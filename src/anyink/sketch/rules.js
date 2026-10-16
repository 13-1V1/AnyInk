// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md section 6, "Relations kept after you let go"; D-047 point 6): the drag
	rules. No solver: every drag (a point, a pick, a Line moved whole, a nudge, a scale, a circle
	resized) says where it wants its points, and the rules run ONCE each, in this fixed order:

	  1. mirror      a point with a twin (mirrorOf) brings its twin along in mirror image
	  2. on a line   a point pinned to a line (on) slides only along it; pulled LET_GO snap radii
	                 off, it lets go of the line (stored on / inset cleared). A point that lands on
	                 a line by a snap (target.pin) is pinned there
	  3. on a piece  a dragged point on a piece (an onPiece relation) slides along the piece, its
	     and joined  share t updated; pulled LET_GO radii off, it lets go. Every other onPiece
	                 point goes back to its share t of its piece as the piece is now (B's waist
	                 follows its stem). Joined points share one id, so they move as one already
	  4. level /     the partner of a moved point of a level (plumb) pair follows on y (x). A
	     plumb       partner on a piece slides along its piece to where it crosses that level
	                 (A's bar end stays on its leg and level with the bar's start)
	  5. tangent     nothing to do here: tangency is the build's (curves.js), so turning one side
	                 turns the other
	  then           a live circle whose points did not all move by the same amount stops being a
	                 live circle (it is a 4-point Spline now), and the level / plumb locks of every
	                 touched piece are settled again from its shape (snap.js settleLocks)

	When two rules disagree the later one wins: the point lets go of what the earlier rule held
	(its line, or its piece), turns hollow, and the result lists the conflict, which Select says as
	"Can't keep both: a point of small n let go of the writing line." with [Undo].

	Pure: the sketch passed in is never changed. Font units, y up, whole numbers stored.

	  LET_GO                        3 (snap radii)
	  Y_PLACES, X_PLACES            the `on` places that hold y, and those that hold x
	  applyDrag(sketch, targets, { radius, keepCircles })
	      targets: { id: { x, y, raw?: { x, y }, pin?: { on, inset } } }: where each dragged
	      point wants to go (x / y possibly snapped; raw: the pointer itself, which says how far
	      it was pulled off its line; pin: a line it snapped onto)
	      keepCircles: piece ids whose `circle` the caller set itself (a move, a scale, a resize)
	      returns { sketch, moved: [ids], letGo: [{ point, on }], conflicts: [{ point, on? ,
	      piece? }] }
	  twinOf(sketch, id)            the mirror twin's id, or null
*/
import { pieceCubics, nearestOnCubics, pointOnCubics } from './pick.js';
import { LINES, getPiece, piecePointIds } from './model.js';
import { settleLocks } from './tools/snap.js';

export const LET_GO = 3;
export const Y_PLACES = Object.freeze([...LINES, 'halfSmall', 'halfCapitals']);
export const X_PLACES = Object.freeze(['left', 'right', 'middle', 'mirror']);

const clone = (value) => JSON.parse(JSON.stringify(value));

/** @returns {Number} whole, never -0 */
function whole(value) {
	const rounded = Math.round(Number(value));
	return rounded === 0 ? 0 : rounded;
}

/**
 * @param {Object} sketch
 * @param {String} id
 * @returns {String | null}
 */
export function twinOf(sketch, id) {
	const points = sketch?.points || {};
	const own = points[id]?.mirrorOf;
	if (own && points[own]) return own;
	const other = Object.keys(points).find((key) => points[key]?.mirrorOf === id);
	return other || null;
}

/** The pin a point lets go of */
function release(point) {
	delete point.on;
	delete point.inset;
}

/** The axis a place holds: 'y', 'x' or null */
function axisOf(on) {
	if (Y_PLACES.includes(on)) return 'y';
	if (X_PLACES.includes(on)) return 'x';
	return null;
}

/**
 * @param {Object} sketch
 * @param {Object} targets
 * @param {{radius?: Number, keepCircles?: Array<Number>}} [options]
 * @returns {{sketch: Object, moved: Array<String>, letGo: Array, conflicts: Array}}
 */
export function applyDrag(sketch, targets = {}, { radius = 10, keepCircles = [] } = {}) {
	const before = sketch;
	const next = clone(sketch);
	const points = next.points || {};
	const letGo = [];
	const conflicts = [];
	const want = {};
	Object.entries(targets).forEach(([id, target]) => {
		if (points[id] && target && Number.isFinite(target.x) && Number.isFinite(target.y)) {
			want[id] = { ...target, raw: target.raw || { x: target.x, y: target.y } };
		}
	});
	const reach = LET_GO * radius;

	// 1. mirror: the twin follows in mirror image
	const mirrorX = Number(next.mirror?.x);
	if (Number.isFinite(mirrorX)) {
		Object.keys(want).forEach((id) => {
			const twin = twinOf(next, id);
			if (!twin || want[twin]) return;
			const w = want[id];
			want[twin] = {
				x: 2 * mirrorX - w.x,
				y: w.y,
				raw: { x: 2 * mirrorX - w.raw.x, y: w.raw.y },
				...(w.pin ? { pin: w.pin } : {}),
			};
		});
	}

	// 2. on a line: slide along it, or let go when pulled LET_GO radii off
	Object.entries(want).forEach(([id, w]) => {
		const point = points[id];
		const axis = axisOf(point.on);
		let x = w.x;
		let y = w.y;
		if (axis) {
			const held = Number(point[axis]);
			if (Math.abs(w.raw[axis] - held) <= reach) {
				if (axis === 'y') y = held;
				else x = held;
			} else {
				letGo.push({ point: id, on: point.on });
				release(point);
				if (w.pin?.on) Object.assign(point, pinOf(w.pin));
			}
		} else if (w.pin?.on) {
			Object.assign(point, pinOf(w.pin));
		}
		point.x = whole(x);
		point.y = whole(y);
	});
	const moved = new Set(Object.keys(want));

	// 3. on a piece: a dragged point slides along its piece; the rest keep their share t
	const relations = Array.isArray(next.relations) ? next.relations : [];
	const dropped = new Set();
	relations.forEach((relation, index) => {
		if (relation?.type !== 'onPiece') return;
		const point = points[relation.point];
		const piece = getPiece(next, relation.piece);
		if (!point || !piece) return;
		const cubics = pieceCubics(piece, next);
		if (!cubics.length) return;
		if (moved.has(relation.point)) {
			const raw = want[relation.point]?.raw || point;
			const near = nearestOnCubics(raw, cubics);
			if (!near || near.distance > reach) {
				dropped.add(index);
				letGo.push({ point: relation.point, piece: relation.piece });
				return;
			}
			relation.t = near.t;
			point.x = whole(near.x);
			point.y = whole(near.y);
			return;
		}
		const touched = piecePointIds(piece).some((id) => moved.has(id));
		if (!touched) return;
		const at = pointOnCubics(cubics, relation.t);
		if (!at) return;
		const x = whole(at.x);
		const y = whole(at.y);
		const axis = axisOf(point.on);
		if (axis && Math.abs((axis === 'y' ? y : x) - Number(point[axis])) > 0.5) {
			conflicts.push({ point: relation.point, on: point.on });
			release(point);
		}
		point.x = x;
		point.y = y;
		moved.add(relation.point);
	});

	// 4. level / plumb pairs: the partner follows on that axis
	relations.forEach((relation, index) => {
		if (dropped.has(index)) return;
		if (relation?.type !== 'level' && relation?.type !== 'plumb') return;
		const { a, b } = relation;
		if (!points[a] || !points[b]) return;
		const aMoved = moved.has(a);
		const bMoved = moved.has(b);
		if (aMoved === bMoved) return;
		const leader = aMoved ? a : b;
		const follower = aMoved ? b : a;
		const axis = relation.type === 'level' ? 'y' : 'x';
		const value = Number(points[leader][axis]);
		const point = points[follower];
		if (Number(point[axis]) === value) return;
		const onPiece = relations.findIndex(
			(other, i) => !dropped.has(i) && other?.type === 'onPiece' && other.point === follower
		);
		if (onPiece >= 0) {
			const tie = relations[onPiece];
			const piece = getPiece(next, tie.piece);
			const place = piece ? crossingOn(pieceCubics(piece, next), axis, value, point) : null;
			if (place) {
				tie.t = place.t;
				point.x = whole(place.x);
				point.y = whole(place.y);
				moved.add(follower);
				return;
			}
			dropped.add(onPiece);
			conflicts.push({ point: follower, piece: tie.piece });
		}
		if (axisOf(point.on) === axis) {
			conflicts.push({ point: follower, on: point.on });
			release(point);
		}
		point[axis] = whole(value);
		moved.add(follower);
	});
	if (dropped.size) next.relations = relations.filter((_, index) => !dropped.has(index));

	// circles: a live circle stays one only when its points all moved together
	const keep = new Set(keepCircles);
	(next.pieces || []).forEach((piece) => {
		if (!piece?.circle || keep.has(piece.id)) return;
		const ids = piecePointIds(piece);
		if (!ids.some((id) => moved.has(id))) return;
		const deltas = ids.map((id) => [
			Number(points[id].x) - Number(before.points[id]?.x),
			Number(points[id].y) - Number(before.points[id]?.y),
		]);
		const [dx, dy] = deltas[0];
		if (deltas.every(([x, y]) => x === dx && y === dy)) {
			piece.circle = { ...piece.circle, cx: piece.circle.cx + dx, cy: piece.circle.cy + dy };
		} else {
			delete piece.circle;
		}
	});

	// locks: settled again on every touched piece
	let settled = next;
	(next.pieces || []).forEach((piece) => {
		if (!piece || !piecePointIds(piece).some((id) => moved.has(id))) return;
		const live = getPiece(settled, piece.id);
		if (live) settled = settleLocks(settled, live);
	});
	return { sketch: settled, moved: [...moved], letGo, conflicts };
}

/** { on, inset? } as stored */
function pinOf(pin) {
	return pin.inset ? { on: pin.on, inset: pin.inset } : { on: pin.on };
}

/**
 * Where a run of cubics crosses y = value (or x = value), the crossing nearest `near`.
 * @returns {{x: Number, y: Number, t: Number} | null}
 */
function crossingOn(cubics, axis, value, near) {
	if (!cubics.length) return null;
	const steps = 64 * cubics.length;
	let best = null;
	let last = pointOnCubics(cubics, 0);
	for (let i = 1; i <= steps; i++) {
		const t = i / steps;
		const now = pointOnCubics(cubics, t);
		const a = last[axis] - value;
		const b = now[axis] - value;
		if ((a <= 0 && b >= 0) || (a >= 0 && b <= 0)) {
			const share = a === b ? 0 : a / (a - b);
			const x = last.x + (now.x - last.x) * share;
			const y = last.y + (now.y - last.y) * share;
			const distance = Math.hypot(x - Number(near.x), y - Number(near.y));
			if (!best || distance < best.distance) {
				best = { x, y, t: (i - 1 + share) / steps, distance };
			}
		}
		last = now;
	}
	return best;
}
