// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 (SKETCH.md section 2, "Level at the top, plumb at the side"): where a piece reaches
	furthest left, right, up and down, and which way a smooth point's direction locks.

	Extremes are found on the built curve (curves.js), not just at the points: each cubic's x and
	y are solved where they stop growing (the roots of the derivative), plus the cubic's two ends.

	The lock rule, first that applies, for a smooth point of a Spline or a Circle (never an open
	end, never a corner, never a join between parts that is not smooth):
	  1. snapped to the letter's left or right edge (a plumb datum): 'plumb', but only where the
	     curve touches the edge (further left or right than both its neighbors), not crosses it
	  2. snapped to the Mirror line or the letter's middle (CROSS_LINES): 'level'
	  3. standing on the Mirror line: 'level'
	  4. higher or lower than both its neighbors along the piece (a top or bottom of a bowl,
	     which includes the piece's highest and lowest points, and a point snapped to a level
	     line where the curve touches it): 'level'
	  5. further left or right than both its neighbors: 'plumb'
	  otherwise null. Rules 1, 4 and 5 lock only when the curve as built without the lock already
	runs within LOCK_NEAR (25) degrees of level / plumb there, and both chords to its neighbors
	lie within CHORD_NEAR (75) degrees of it, the way SolidWorks adds a horizontal or vertical
	relation only to a line already close to it. A narrow peak (the point of a teardrop, a pointed
	arch, a j hook: 20 units wide and 500 tall, chords 89 degrees off level) is left free; forced
	level, its two sides swing out into a balloon over 500 units wide. (Hobby's own curve there
	is level by symmetry and already wide: a peak that sharp wants a corner point, S2's job.)
	A point snapped to a level line (writing, small-letter, capitals, top, tail or a half-way line)
	where the stroke crosses the line keeps on-a-line (it slides along the line) but gets no lock,
	so edge_rule.js gives it no overshoot; crossing and touching are told apart by its neighbors.
	Letting go of a lock by dragging off (3x the snap radius) is S4's.
	SKETCH.md section 2 says "the piece's highest / lowest / leftmost / rightmost" and "sits on the
	Mirror line, locks plumb". Changes, flagged for the design: (a) every bowl's own top,
	bottom and sides lock, not only the piece's, so the upper bowl of an s locks plumb on its left
	although its lower end reaches further left (section 5's Make it a sketch also adds "each
	curve's" extremes); (b) a smooth point on the Mirror line (or the letter's middle) locks
	level, because a curve that is its own mirror image crosses its mirror line level (the top of
	an O, the bottom of a U); plumb there would put a kink in every symmetric letter; (c) a point
	on a writing line locks level only where the curve touches the line, and (d) only near level.

	  cubicExtremes(cubic)              [{ t, x, y }] where x or y turns, plus both ends
	  pieceExtremes(piece, sketch)      { left, right, top, bottom }: each { x, y, cubic, t } or
	                                    null for a piece with no curve
	  skeletonExtremes(cubics)          the same for cubics already built
	  lockFor(id, piece, sketch, { tolerance })   'level' | 'plumb' | null
	  lockAll(piece, sketch)            { id: lock } for every point of the piece the rule locks
	  PLUMB_LINES                       the `on` names that are plumb (the rest are level)
	  CROSS_LINES                       plumb lines a curve crosses rather than runs along
	  LOCK_NEAR, CHORD_NEAR             25, 75 (degrees)
*/
import { endDirection, pieceSkeleton, pointsMap, startDirection } from './curves.js';

// stored `on` names, all in model.js ON_PLACES
export const PLUMB_LINES = Object.freeze(['left', 'right']);
export const CROSS_LINES = Object.freeze(['mirror', 'middle']);
/** A lock is added only where the free curve already runs within this many degrees of it */
export const LOCK_NEAR = 25;
/** ... and only where both chords to the neighbors lie within this many degrees of it */
export const CHORD_NEAR = 75;

/**
 * @param {Array<[Number, Number]>} cubic
 * @param {Number} t
 * @returns {[Number, Number]}
 */
export function cubicPoint([p0, p1, p2, p3], t) {
	const u = 1 - t;
	const a = u * u * u;
	const b = 3 * u * u * t;
	const c = 3 * u * t * t;
	const d = t * t * t;
	return [
		a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
		a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
	];
}

/**
 * Roots in (0, 1) of the derivative of one coordinate of a cubic.
 * @param {Number} a - p0
 * @param {Number} b - p1
 * @param {Number} c - p2
 * @param {Number} d - p3
 * @returns {Array<Number>}
 */
function turnRoots(a, b, c, d) {
	// derivative / 3 = A t^2 + B t + C
	const A = -a + 3 * b - 3 * c + d;
	const B = 2 * (a - 2 * b + c);
	const C = b - a;
	const roots = [];
	const scale = Math.max(Math.abs(A), Math.abs(B), Math.abs(C), 1e-12);
	if (Math.abs(A) / scale < 1e-12) {
		if (Math.abs(B) / scale > 1e-12) roots.push(-C / B);
	} else {
		const disc = B * B - 4 * A * C;
		if (disc >= 0) {
			const q = -0.5 * (B + Math.sign(B || 1) * Math.sqrt(disc));
			roots.push(q / A);
			if (q !== 0) roots.push(C / q);
		}
	}
	return roots.filter((t) => t > 0 && t < 1);
}

/**
 * @param {Array<[Number, Number]>} cubic
 * @returns {Array<{t: Number, x: Number, y: Number}>}
 */
export function cubicExtremes(cubic) {
	const [p0, p1, p2, p3] = cubic;
	const ts = [
		0,
		1,
		...turnRoots(p0[0], p1[0], p2[0], p3[0]),
		...turnRoots(p0[1], p1[1], p2[1], p3[1]),
	];
	return ts.map((t) => {
		const [x, y] = cubicPoint(cubic, t);
		return { t, x, y };
	});
}

/**
 * @param {Array<Array<[Number, Number]>>} cubics
 * @returns {{left: Object|null, right: Object|null, top: Object|null, bottom: Object|null}}
 */
export function skeletonExtremes(cubics) {
	const found = { left: null, right: null, top: null, bottom: null };
	(cubics || []).forEach((cubic, index) => {
		for (const { t, x, y } of cubicExtremes(cubic)) {
			const here = { x, y, cubic: index, t };
			if (!found.left || x < found.left.x) found.left = here;
			if (!found.right || x > found.right.x) found.right = here;
			if (!found.top || y > found.top.y) found.top = here;
			if (!found.bottom || y < found.bottom.y) found.bottom = here;
		}
	});
	return found;
}

/**
 * @param {Object} piece
 * @param {Object} sketch - the sketch or its points map
 * @returns {{left: Object|null, right: Object|null, top: Object|null, bottom: Object|null}}
 */
export function pieceExtremes(piece, sketch) {
	return skeletonExtremes(pieceSkeleton(piece, sketch));
}

/**
 * The piece's point ids in order, with where each sits: inside a spline, at an end, or at a join.
 * @returns {Array<{id: String, role: 'end'|'join'|'inner'}>}
 */
function pointRoles(piece) {
	const parts = piece?.parts || [];
	const loop = !!piece?.closed && parts.length === 1 && parts[0]?.type === 'spline';
	const out = [];
	for (const part of parts) {
		const ids = part.type === 'spline' ? part.points || [] : [part.from, part.to];
		ids.forEach((id, i) => {
			const inner = part.type === 'spline' && (loop || (i > 0 && i < ids.length - 1));
			if (out.length && out[out.length - 1].id === id) return;
			out.push({ id, role: inner ? 'inner' : 'join' });
		});
	}
	if (!piece?.closed && out.length) {
		out[0].role = 'end';
		out[out.length - 1].role = 'end';
	}
	return out;
}

/**
 * @param {String} id
 * @param {Object} piece
 * @param {Object} sketch - the sketch (its .points and .mirror) or the points map
 * @param {{tolerance?: Number}} [options] - how close in font units counts as "the same height"
 * @returns {'level'|'plumb'|null}
 */
export function lockFor(id, piece, sketch, { tolerance = 0.5 } = {}) {
	const pts = pointsMap(sketch);
	const pt = pts[id];
	if (!pt || !piece) return null;
	const roles = pointRoles(piece);
	const mine = roles.find((r) => r.id === id);
	if (!mine || mine.role === 'end') return null;
	if (pt.kind === 'corner') return null;
	// at a join between parts only a smooth point locks; inside a Spline any non-corner does
	if (mine.role === 'join' && pt.kind !== 'smooth' && !piece.circle) return null;
	const mirror = sketch?.mirror;
	if (pt.on && CROSS_LINES.includes(pt.on)) return 'level';
	if (mirror && Math.abs(Number(pt.x) - Number(mirror.x)) <= tolerance) return 'level';
	// neighbors along the piece (a loop wraps round)
	const ring = roles.filter((r) => pts[r.id]);
	if (piece.closed && ring.length > 1 && ring[0].id === ring[ring.length - 1].id) ring.pop();
	const at = ring.findIndex((r) => r.id === id);
	const loop = !!piece.closed;
	const prev = at > 0 ? pts[ring[at - 1].id] : loop ? pts[ring[ring.length - 1].id] : null;
	const next = at < ring.length - 1 ? pts[ring[at + 1].id] : loop ? pts[ring[0].id] : null;
	if (!prev || !next) return null;
	const beyond = (key, sign) =>
		sign * (Number(pt[key]) - Number(prev[key])) >= -tolerance &&
		sign * (Number(pt[key]) - Number(next[key])) >= -tolerance &&
		!(
			Math.abs(Number(pt[key]) - Number(prev[key])) <= tolerance &&
			Math.abs(Number(pt[key]) - Number(next[key])) <= tolerance
		);
	let free;
	const offBy = (dir, lock) => {
		const options = lock === 'plumb' ? [90, 270] : [0, 180];
		return Math.min(...options.map((o) => apart(dir, o)));
	};
	const chord = (a, b) =>
		(Math.atan2(Number(b.y) - Number(a.y), Number(b.x) - Number(a.x)) * 180) / Math.PI;
	const near = (lock) => {
		if (offBy(chord(prev, pt), lock) > CHORD_NEAR || offBy(chord(pt, next), lock) > CHORD_NEAR) {
			return false;
		}
		if (free === undefined) free = freeDirection(id, piece, pts);
		return free === null || offBy(free, lock) <= LOCK_NEAR;
	};
	const touchesX = beyond('x', 1) || beyond('x', -1);
	const touchesY = beyond('y', 1) || beyond('y', -1);
	if (pt.on && PLUMB_LINES.includes(pt.on)) return touchesX && near('plumb') ? 'plumb' : null;
	if (touchesY && near('level')) return 'level';
	if (touchesX && near('plumb')) return 'plumb';
	return null;
}

/**
 * @param {Number} a - degrees
 * @param {Number} b - degrees
 * @returns {Number} 0 to 180
 */
function apart(a, b) {
	return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

/**
 * The direction the piece runs through a point when that point has no lock: what Hobby (or the
 * parts beside it) would choose on their own.
 * @returns {Number|null} degrees, null when the point is not found on the built curve
 */
function freeDirection(id, piece, pts) {
	const unlocked = { ...pts, [id]: { ...pts[id], lock: null } };
	const cubics = pieceSkeleton(piece, unlocked);
	const x = Number(pts[id].x);
	const y = Number(pts[id].y);
	const here = (p) => p[0] === x && p[1] === y;
	const leaving = cubics.find((c) => here(c[0]) && !c.every((p) => here(p)));
	if (leaving) return startDirection(leaving);
	const arriving = cubics.find((c) => here(c[3]) && !c.every((p) => here(p)));
	return arriving ? endDirection(arriving) : null;
}

/**
 * @param {Object} piece
 * @param {Object} sketch
 * @returns {Object} id -> 'level' | 'plumb' (points the rule leaves free are left out)
 */
export function lockAll(piece, sketch) {
	const out = {};
	for (const { id } of pointRoles(piece)) {
		const lock = lockFor(id, piece, sketch);
		if (lock) out[id] = lock;
	}
	return out;
}
