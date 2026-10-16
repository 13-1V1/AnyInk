// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md sections 6, 7 and 8, D-047 point 9): a sketch moved the way another feature
	moved its ink, and a sketch's pinned points put back on the font's lines. Pure: no editor, the
	input sketch is never changed (a new one comes back). sketch/follow.js puts these on a letter.

	followSketch(sketch, { matrix, grow }, font)
	  - Points, the Mirror line and live circles go through the matrix (follow_matrix.js). Every
	    point lands on a whole unit; a twin (mirrorOf) is placed from its partner so the pair stays
	    exactly even about the whole-number Mirror line.
	  - Thickness is never scaled. Centerline pieces drop `grow` (one thickness already keeps the
	    letter's weight).
	  - Outline loops: after the matrix, each loop's points move `grow` along the loop's own
	    normal, away from the ink's inside (a solid loop out, a hole in: nesting from
	    outline_order.js); a corner between two straight sides moves along its bisector by
	    grow / cos(half the turn), so Lines stay exactly `grow` off, Arcs keep their bulge, a live
	    circle's half-axes grow by `grow`. A linked inside loop (insideOf) keeps its wall.
	  - A matrix that turns the plane over (a Flip) turns every Arc's bulge to its other side and
	    every aim: left-right makes aim.dir 180 - dir, upside-down 360 - dir (turnDir). Tensions
	    stay. Locks (level, plumb) stay: every follow move is level and plumb.
	  - Pins (font: project.settings.font; with none, line pins are kept only through a move
	    that leaves y alone): a point pinned to a writing line keeps its pin when it lands within PIN_KEEP of where
	    the edge rule puts it (edge_rule.js edgeY: the ink edge for Centerline points, the line
	    itself for Outline ones, overshoot for round tops and bottoms), and is set exactly there;
	    otherwise the pin goes (`on` and `inset` dropped) and the point stays where the move put
	    it, so the next build makes the ink the feature made. The half-way lines the same. A left /
	    right / middle pin stays while the point's x is unchanged; a left-right Flip swaps left and
	    right. A point on the Mirror line takes the moved line's x. An Arc's `top` pin (the S3 tag
	    for a snapped arc top) stays only through a move that leaves y alone.

	placePins(sketch, font)
	  every point pinned to a writing line or a half-way line set where the lines are now (B15
	  moved one): Centerline points at the ink edge (edgeThickness, so a thickness the moved
	  small-letter line no longer allows is kept inside it), Outline points on the line itself,
	  round tops and bottoms one overshoot past; a live circle whose top or bottom moved is solved
	  again as a circle (circle_fit.js). Returns the input when nothing moved.

	  PIN_KEEP                        1 font unit
	  followSketch(sketch, plan, font)   -> a new sketch (the input when the plan has no matrix)
	  placePins(sketch, font)            -> a new sketch, or the input when nothing moved
	  pinTargets(sketch, font)           -> Map id -> the y the pin asks for
*/
import { guideLines } from '../placement/classes.js';
import { fitCircles } from './circle_fit.js';
import { pieceSkeleton } from './curves.js';
import { crossingPoints, edgeY, LINE_NAMES, openEnds, roundPoints } from './edge_rule.js';
import { apply, isTranslation, matrixOf, mirrors, turnDir } from './follow_matrix.js';
import { piecePointIds } from './model.js';
import { flattenCubics, outlineOrder, signedArea } from './outline_order.js';

/** Font units: a pin is kept when its point lands this close to where the pin puts it */
export const PIN_KEEP = 1;
/** A sharp corner moves no further than this many times the push */
const MITER_LIMIT = 4;
const HALF_LINES = Object.freeze({ halfSmall: 'small', halfCapitals: 'capitals' });
const EDGE_PLACES = Object.freeze(['left', 'right', 'middle']);
const DEG = Math.PI / 180;

/**
 * @param {Object} sketch - glyph.anyink.sketch (v1)
 * @param {{matrix: Array<Number>, grow?: Number}} plan
 * @param {Object} font - project.settings.font
 * @returns {Object}
 */
export function followSketch(sketch, plan, font) {
	const m = matrixOf(plan?.matrix);
	if (!sketch?.points || !Array.isArray(sketch.pieces) || !m) return sketch;
	const grow = Number(plan?.grow) || 0;
	const flipped = mirrors(m);
	const plumbOnly = isTranslation(m) && Math.abs(m[5]) < 1e-9;

	// 1. through the matrix (not yet whole)
	const raw = {};
	for (const [id, point] of Object.entries(sketch.points)) {
		if (!point || typeof point !== 'object') {
			raw[id] = point;
			continue;
		}
		const [x, y] = apply(m, [Number(point.x) || 0, Number(point.y) || 0]);
		const moved = { ...point, x, y };
		if (point.aim && typeof point.aim === 'object' && Number.isFinite(Number(point.aim.dir))) {
			moved.aim = { ...point.aim, dir: turnDir(m, point.aim.dir) };
		}
		raw[id] = moved;
	}
	const pieces = sketch.pieces.map((piece) => movePiece(piece, m, flipped, plumbOnly));
	const mirror = moveMirror(sketch.mirror, m);
	let next = { ...sketch, points: raw, pieces, mirror };

	// 2. Outline loops grow away from the ink
	if (grow) next = growOutlines(next, grow);

	// 3. whole units, twins even about the Mirror line
	next = { ...next, points: wholePoints(next.points, next.mirror) };

	// 4. pins
	return keepPins(next, sketch, m, flipped, font);
}

/**
 * @param {Object} sketch
 * @param {Object} font
 * @returns {Object}
 */
export function placePins(sketch, font) {
	if (!sketch?.points || !Array.isArray(sketch.pieces)) return sketch;
	const targets = pinTargets(sketch, font);
	let points = null;
	targets.forEach((y, id) => {
		const point = sketch.points[id];
		if (!point || point.y === y) return;
		points ??= { ...sketch.points };
		points[id] = { ...point, y };
	});
	return points ? fitCircles({ ...sketch, points }) : sketch;
}

/**
 * @param {Object} sketch
 * @param {Object} font
 * @returns {Map<String, Number>} id -> the whole-number y each pinned point belongs at
 */
export function pinTargets(sketch, font) {
	const out = new Map();
	if (!sketch?.points) return out;
	const lines = guideLines(font);
	const ends = openEnds(sketch);
	const inside = roundPoints(sketch);
	const crossing = crossingPoints(sketch, font);
	const thickness = Number(sketch.thickness) || 0;
	for (const [id, point] of Object.entries(sketch.points)) {
		if (!point || typeof point !== 'object') continue;
		if (LINE_NAMES.includes(point.on)) {
			// an edge point with no thickness yet has nowhere to go but where it is
			if (point.inset === 'edge' && !(thickness > 0)) continue;
			const y = edgeY(point, font, thickness, {
				isEnd: ends.has(id) && !inside.has(id),
				crosses: crossing.has(id),
			});
			if (y !== null) out.set(id, y);
		} else if (HALF_LINES[point.on]) {
			out.set(id, whole((lines.writing + lines[HALF_LINES[point.on]]) / 2));
		}
	}
	return out;
}

// --------------------------------------------------------------
// Inside
// --------------------------------------------------------------

/** @returns {Number} never -0 */
function whole(value) {
	const rounded = Math.round(value);
	return rounded === 0 ? 0 : rounded;
}

function movePiece(piece, m, flipped, plumbOnly) {
	if (!piece || typeof piece !== 'object') return piece;
	const out = { ...piece };
	if (piece.circle && typeof piece.circle === 'object') {
		const [cx, cy] = apply(m, [Number(piece.circle.cx) || 0, Number(piece.circle.cy) || 0]);
		out.circle = {
			...piece.circle,
			cx,
			cy,
			rx: Math.abs((Number(piece.circle.rx) || 0) * Math.hypot(m[0], m[1])),
			ry: Math.abs((Number(piece.circle.ry) || 0) * Math.hypot(m[2], m[3])),
		};
	}
	if (Array.isArray(piece.parts)) {
		out.parts = piece.parts.map((part) => {
			if (!part || typeof part !== 'object') return part;
			let next = part;
			if (flipped && part.type === 'arc' && Number.isFinite(Number(part.bulge))) {
				next = { ...next, bulge: -Number(part.bulge) || 0 };
			}
			if (part.top && !plumbOnly) {
				next = { ...next };
				delete next.top;
			}
			return next;
		});
	}
	return out;
}

function moveMirror(mirror, m) {
	if (!mirror || typeof mirror !== 'object' || !Number.isFinite(Number(mirror.x))) return mirror;
	const [x] = apply(m, [Number(mirror.x), 0]);
	return { ...mirror, x: whole(x) };
}

/** Whole points; a twin from its partner, so the pair stays even about the Mirror line */
function wholePoints(points, mirror) {
	const out = {};
	const mx = Number.isFinite(Number(mirror?.x)) ? Number(mirror.x) : null;
	for (const [id, point] of Object.entries(points)) {
		if (!point || typeof point !== 'object') {
			out[id] = point;
			continue;
		}
		const next = { ...point, x: whole(point.x), y: whole(point.y) };
		if (point.on === 'mirror' && mx !== null) next.x = mx;
		out[id] = next;
	}
	if (mx === null) return out;
	for (const [id, point] of Object.entries(out)) {
		const twinId = point?.mirrorOf;
		const twin = twinId !== undefined && twinId !== null ? out[twinId] : null;
		if (!twin || twinId === id) continue;
		// the one whose id sorts first leads; its twin is placed from it
		if (String(id).localeCompare(String(twinId), 'en', { numeric: true }) > 0) continue;
		out[twinId] = { ...twin, x: whole(2 * mx - point.x) };
	}
	return out;
}

/** Each Outline loop's points pushed `grow` away from the ink (out of a solid, into a hole) */
function growOutlines(sketch, grow) {
	const loops = sketch.pieces.filter(
		(piece) =>
			piece?.use === 'outline' &&
			piece.closed &&
			(piece.insideOf === undefined || piece.insideOf === null) &&
			Array.isArray(piece.parts) &&
			piece.parts.length
	);
	if (!loops.length) return sketch;
	const built = loops.map((piece) => ({ piece, cubics: safeSkeleton(piece, sketch) }));
	const order = outlineOrder(
		built
			.filter(({ cubics }) => cubics.length)
			.map(({ piece, cubics }) => ({ id: piece.id, cubics }))
	);
	const roleOf = new Map(order.map((entry) => [entry.id, entry.role]));
	const points = { ...sketch.points };
	const done = new Set();
	const pieces = sketch.pieces.map((piece) => {
		const entry = built.find((b) => b.piece === piece);
		if (!entry || !entry.cubics.length) return piece;
		const area = signedArea(flattenCubics(entry.cubics));
		if (!area) return piece;
		// out of a solid, into a hole; `outward` is the right-hand normal for a loop turning left
		const push = (roleOf.get(piece.id) === 'hole' ? -grow : grow) * Math.sign(area);
		for (const id of piecePointIds(piece)) {
			if (done.has(id) || !points[id]) continue;
			const move = pushAt(points[id], entry.cubics, push);
			if (!move) continue;
			points[id] = { ...points[id], x: points[id].x + move[0], y: points[id].y + move[1] };
			done.add(id);
		}
		if (!piece.circle) return piece;
		const change = roleOf.get(piece.id) === 'hole' ? -grow : grow;
		return {
			...piece,
			circle: {
				...piece.circle,
				rx: Math.max(0, piece.circle.rx + change),
				ry: Math.max(0, piece.circle.ry + change),
			},
		};
	});
	return { ...sketch, points, pieces };
}

function safeSkeleton(piece, sketch) {
	try {
		return pieceSkeleton(piece, sketch) || [];
	} catch {
		return [];
	}
}

/** The move of one loop point: along the normals of the way the loop arrives and leaves */
function pushAt(point, cubics, push) {
	const p = [point.x, point.y];
	const near = (q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6;
	const leaving = cubics.find((c) => near(c[0]));
	const arriving = cubics.find((c) => near(c[3]));
	const dirIn = arriving ? directionInto(arriving) : null;
	const dirOut = leaving ? directionOutOf(leaving) : null;
	const n1 = dirIn === null ? null : rightNormal(dirIn);
	const n2 = dirOut === null ? null : rightNormal(dirOut);
	if (!n1 && !n2) return null;
	if (!n1) return [n2[0] * push, n2[1] * push];
	if (!n2) return [n1[0] * push, n1[1] * push];
	const denominator = 1 + n1[0] * n2[0] + n1[1] * n2[1];
	let v =
		denominator > 1e-6
			? [((n1[0] + n2[0]) * push) / denominator, ((n1[1] + n2[1]) * push) / denominator]
			: [n1[0] * push, n1[1] * push];
	const length = Math.hypot(v[0], v[1]);
	const limit = MITER_LIMIT * Math.abs(push);
	if (length > limit) v = [(v[0] * limit) / length, (v[1] * limit) / length];
	return v;
}

/** The right-hand normal of a direction in degrees */
function rightNormal(degrees) {
	return [Math.sin(degrees * DEG), -Math.cos(degrees * DEG)];
}

function directionOutOf([p0, h1, h2, p3]) {
	for (const q of [h1, h2, p3]) {
		if (Math.hypot(q[0] - p0[0], q[1] - p0[1]) > 1e-9) {
			return Math.atan2(q[1] - p0[1], q[0] - p0[0]) / DEG;
		}
	}
	return null;
}

function directionInto([p0, h1, h2, p3]) {
	for (const q of [h2, h1, p0]) {
		if (Math.hypot(p3[0] - q[0], p3[1] - q[1]) > 1e-9) {
			return Math.atan2(p3[1] - q[1], p3[0] - q[0]) / DEG;
		}
	}
	return null;
}

/** Pins that still hold are set exactly; the others go */
function keepPins(next, before, m, flipped, font) {
	// with no font to read the lines from, a pin is kept only through a move that leaves y alone
	const known = !!font && typeof font === 'object';
	const levelMove = Math.abs(m[1]) < 1e-9 && Math.abs(m[3] - 1) < 1e-9 && Math.abs(m[5]) < 1e-9;
	const targets = known ? pinTargets(next, font) : new Map();
	const points = { ...next.points };
	for (const [id, point] of Object.entries(points)) {
		if (!point || typeof point !== 'object' || !point.on) continue;
		if (LINE_NAMES.includes(point.on) || HALF_LINES[point.on]) {
			if (!known) {
				if (!levelMove) points[id] = unpinned(point);
				continue;
			}
			const y = targets.get(id);
			if (y === undefined) continue;
			if (Math.abs(y - point.y) <= PIN_KEEP) points[id] = { ...point, y };
			else points[id] = unpinned(point);
		} else if (EDGE_PLACES.includes(point.on)) {
			const was = before.points?.[id];
			const stayed = was && Math.abs(Number(was.x) - point.x) < 0.5;
			if (stayed) continue;
			if (flipped && m[0] < 0 && point.on !== 'middle') {
				points[id] = { ...point, on: point.on === 'left' ? 'right' : 'left' };
			} else if (!(flipped && m[0] < 0 && point.on === 'middle')) {
				points[id] = unpinned(point);
			}
		}
	}
	return { ...next, points };
}

function unpinned(point) {
	const out = { ...point };
	delete out.on;
	delete out.inset;
	return out;
}
