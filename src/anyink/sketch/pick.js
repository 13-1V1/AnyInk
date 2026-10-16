// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md section 5, "Picking"): what Select on a sketch picks. Pure: no editor, no
	DOM. Font units, y up. A pick is { points: [ids], pieces: [ids] }; picked things show green.

	  Click a point or a piece       picks it (pickOnly)
	  Ctrl+click                     adds it to the pick, or takes it out (togglePick)
	  A window left to right         picks what is fully inside (windowPick, crossing false)
	  A window right to left         picks everything it touches (crossing true), SolidWorks'
	                                 crossing window: points inside, pieces any part of which
	                                 is inside or runs through it
	  Click empty canvas, or Esc     clears the pick (emptyPick)

	  emptyPick()                    { points: [], pieces: [] }
	  isEmptyPick(pick)
	  hitTest(sketch, at, radius)    what is under the pointer: { type: 'point', id, x, y } first
	                                 (the nearest within the radius), else { type: 'piece', id,
	                                 part, a, b, x, y, t } (part: index into piece.parts; a / b:
	                                 the point ids of the stretch under the pointer, null on a
	                                 circle or an oval; t: the share along that stretch), else
	                                 null. Hidden pieces and a
	                                 set-aside sketch hold nothing.
	  pickHas(pick, hit), pickOnly(hit), togglePick(pick, hit)
	  windowPick(sketch, box, { crossing })   box: { x0, y0, x1, y1 } any corners
	  pickedPointIds(sketch, pick)   every point the pick moves: its points and its pieces' points
	  pickBox(sketch, pick)          { xMin, yMin, xMax, yMax } of those points, or null
	  prunePick(sketch, pick)        the pick without ids the sketch no longer has
	  samePick(a, b)
	  nearestOnCubics(at, cubics)    { x, y, t, distance }: t the share of their length
	  pointOnCubics(cubics, t)       { x, y } at a share t of their length
	  pieceCubics(piece, sketch)     the piece's cubics ([] when it can't be built)
*/
import { piecePartCubics, pieceSkeleton } from './curves.js';
import { getPiece, piecePointIds } from './model.js';

/** Samples per cubic when measuring along a piece */
const SAMPLES = 24;

/** @returns {{points: Array<String>, pieces: Array<Number>}} */
export function emptyPick() {
	return { points: [], pieces: [] };
}

/** @returns {Boolean} */
export function isEmptyPick(pick) {
	return !pick || (!pick.points?.length && !pick.pieces?.length);
}

const visiblePieces = (sketch) =>
	(Array.isArray(sketch?.pieces) ? sketch.pieces : []).filter((piece) => piece && !piece.hidden);

/**
 * @param {Object} piece
 * @param {Object} sketch
 * @returns {Array} cubics
 */
export function pieceCubics(piece, sketch) {
	try {
		const cubics = pieceSkeleton(piece, sketch);
		return Array.isArray(cubics) ? cubics : [];
	} catch {
		return [];
	}
}

/** @returns {[Number, Number]} */
function cubicAt([p0, p1, p2, p3], t) {
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

/** @returns {Array<{p: [Number, Number], run: Number}>} a polyline with the length run so far */
function samplesOf(cubics) {
	const samples = [];
	let run = 0;
	cubics.forEach((cubic, c) => {
		if (!Array.isArray(cubic) || cubic.length < 4) return;
		for (let i = c === 0 ? 0 : 1; i <= SAMPLES; i++) {
			const p = cubicAt(cubic, i / SAMPLES);
			const last = samples.at(-1);
			if (last) run += Math.hypot(p[0] - last.p[0], p[1] - last.p[1]);
			samples.push({ p, run });
		}
	});
	return samples;
}

/**
 * @param {{x: Number, y: Number}} at
 * @param {Array} cubics
 * @returns {{x: Number, y: Number, t: Number, distance: Number} | null}
 */
export function nearestOnCubics(at, cubics) {
	const samples = samplesOf(cubics || []);
	if (!samples.length) return null;
	if (samples.length === 1) {
		const [x, y] = samples[0].p;
		return { x, y, t: 0, distance: Math.hypot(x - at.x, y - at.y) };
	}
	const total = samples.at(-1).run;
	let best = null;
	for (let i = 0; i + 1 < samples.length; i++) {
		const a = samples[i];
		const b = samples[i + 1];
		const dx = b.p[0] - a.p[0];
		const dy = b.p[1] - a.p[1];
		const length2 = dx * dx + dy * dy;
		const share =
			length2 > 0
				? Math.max(0, Math.min(1, ((at.x - a.p[0]) * dx + (at.y - a.p[1]) * dy) / length2))
				: 0;
		const x = a.p[0] + share * dx;
		const y = a.p[1] + share * dy;
		const distance = Math.hypot(x - at.x, y - at.y);
		if (!best || distance < best.distance) {
			best = { x, y, distance, t: total > 0 ? (a.run + share * (b.run - a.run)) / total : 0 };
		}
	}
	return best;
}

/**
 * @param {Array} cubics
 * @param {Number} t - share of their length, 0 to 1
 * @returns {{x: Number, y: Number} | null}
 */
export function pointOnCubics(cubics, t) {
	const samples = samplesOf(cubics || []);
	if (!samples.length) return null;
	const total = samples.at(-1).run;
	const want = Math.max(0, Math.min(1, Number(t) || 0)) * total;
	for (let i = 0; i + 1 < samples.length; i++) {
		const a = samples[i];
		const b = samples[i + 1];
		if (b.run >= want) {
			const span = b.run - a.run;
			const share = span > 0 ? (want - a.run) / span : 0;
			return { x: a.p[0] + (b.p[0] - a.p[0]) * share, y: a.p[1] + (b.p[1] - a.p[1]) * share };
		}
	}
	const [x, y] = samples.at(-1).p;
	return { x, y };
}

/**
 * @param {Object} sketch
 * @param {{x: Number, y: Number}} at
 * @param {Number} radius - font units
 * @returns {Object | null}
 */
export function hitTest(sketch, at, radius) {
	if (!sketch || sketch.setAside === true || !sketch.points) return null;
	const pieces = visiblePieces(sketch);
	let point = null;
	const seen = new Set();
	pieces.forEach((piece) => {
		piecePointIds(piece).forEach((id) => {
			if (seen.has(id)) return;
			seen.add(id);
			const p = sketch.points[id];
			if (!p) return;
			const distance = Math.hypot(Number(p.x) - at.x, Number(p.y) - at.y);
			if (distance <= radius && (!point || distance < point.distance)) {
				point = { type: 'point', id, x: Number(p.x), y: Number(p.y), distance };
			}
		});
	});
	if (point) return point;
	let best = null;
	pieces.forEach((piece) => {
		let parts = [];
		try {
			parts = piecePartCubics(piece, sketch);
		} catch {
			parts = [];
		}
		parts.forEach((entry) => {
			const near = nearestOnCubics(at, entry.cubics);
			if (near && near.distance <= radius && (!best || near.distance < best.distance)) {
				best = {
					type: 'piece',
					id: piece.id,
					part: entry.part,
					a: entry.a,
					b: entry.b,
					x: near.x,
					y: near.y,
					t: near.t,
					distance: near.distance,
				};
			}
		});
	});
	return best;
}

/** @returns {Boolean} */
export function pickHas(pick, hit) {
	if (!pick || !hit) return false;
	if (hit.type === 'point') return pick.points.includes(hit.id);
	if (hit.type === 'piece') return pick.pieces.includes(hit.id);
	return false;
}

/** @returns {{points: Array, pieces: Array}} the pick of just this */
export function pickOnly(hit) {
	if (hit?.type === 'point') return { points: [hit.id], pieces: [] };
	if (hit?.type === 'piece') return { points: [], pieces: [hit.id] };
	return emptyPick();
}

/** @returns {{points: Array, pieces: Array}} a new pick with hit added, or taken out */
export function togglePick(pick, hit) {
	const next = { points: [...(pick?.points || [])], pieces: [...(pick?.pieces || [])] };
	if (!hit) return next;
	const list = hit.type === 'point' ? next.points : hit.type === 'piece' ? next.pieces : null;
	if (!list) return next;
	const at = list.indexOf(hit.id);
	if (at >= 0) list.splice(at, 1);
	else list.push(hit.id);
	return next;
}

/** @returns {{xMin, yMin, xMax, yMax}} */
function normalBox(box) {
	return {
		xMin: Math.min(box.x0, box.x1),
		xMax: Math.max(box.x0, box.x1),
		yMin: Math.min(box.y0, box.y1),
		yMax: Math.max(box.y0, box.y1),
	};
}

const inside = (b, x, y) => x >= b.xMin && x <= b.xMax && y >= b.yMin && y <= b.yMax;

/** Liang-Barsky: does the segment a-b touch the box */
function segmentTouches(b, a, c) {
	if (inside(b, a[0], a[1]) || inside(b, c[0], c[1])) return true;
	let t0 = 0;
	let t1 = 1;
	const dx = c[0] - a[0];
	const dy = c[1] - a[1];
	const checks = [
		[-dx, a[0] - b.xMin],
		[dx, b.xMax - a[0]],
		[-dy, a[1] - b.yMin],
		[dy, b.yMax - a[1]],
	];
	for (const [p, q] of checks) {
		if (p === 0) {
			if (q < 0) return false;
		} else {
			const r = q / p;
			if (p < 0) t0 = Math.max(t0, r);
			else t1 = Math.min(t1, r);
			if (t0 > t1) return false;
		}
	}
	return true;
}

/**
 * @param {Object} sketch
 * @param {{x0: Number, y0: Number, x1: Number, y1: Number}} box
 * @param {{crossing?: Boolean}} [options]
 * @returns {{points: Array<String>, pieces: Array<Number>}}
 */
export function windowPick(sketch, box, { crossing = false } = {}) {
	const pick = emptyPick();
	if (!sketch?.points) return pick;
	const b = normalBox(box);
	const seen = new Set();
	visiblePieces(sketch).forEach((piece) => {
		const ids = piecePointIds(piece);
		ids.forEach((id) => {
			if (seen.has(id)) return;
			seen.add(id);
			const p = sketch.points[id];
			if (p && inside(b, Number(p.x), Number(p.y))) pick.points.push(id);
		});
		const line = samplesOf(pieceCubics(piece, sketch)).map((s) => s.p);
		if (!line.length) return;
		const whole = line.every(([x, y]) => inside(b, x, y));
		const touches =
			line.length === 1
				? inside(b, line[0][0], line[0][1])
				: line.some((p, i) => i > 0 && segmentTouches(b, line[i - 1], p));
		if (whole || (crossing && touches)) pick.pieces.push(piece.id);
	});
	return pick;
}

/**
 * @param {Object} sketch
 * @param {{points: Array, pieces: Array}} pick
 * @returns {Array<String>} every point the pick moves, once each
 */
export function pickedPointIds(sketch, pick) {
	const ids = [];
	const add = (id) => {
		if (sketch?.points?.[id] && !ids.includes(id)) ids.push(id);
	};
	(pick?.points || []).forEach(add);
	(pick?.pieces || []).forEach((pieceId) => {
		const piece = getPiece(sketch, pieceId);
		if (piece) piecePointIds(piece).forEach(add);
	});
	return ids;
}

/**
 * @param {Object} sketch
 * @param {Object} pick
 * @returns {{xMin, yMin, xMax, yMax} | null}
 */
export function pickBox(sketch, pick) {
	const ids = pickedPointIds(sketch, pick);
	if (!ids.length) return null;
	const xs = ids.map((id) => Number(sketch.points[id].x));
	const ys = ids.map((id) => Number(sketch.points[id].y));
	(pick?.pieces || []).forEach((pieceId) => {
		const piece = getPiece(sketch, pieceId);
		if (!piece?.circle) return;
		const { cx, cy, rx, ry } = piece.circle;
		xs.push(cx - rx, cx + rx);
		ys.push(cy - ry, cy + ry);
	});
	return {
		xMin: Math.min(...xs),
		yMin: Math.min(...ys),
		xMax: Math.max(...xs),
		yMax: Math.max(...ys),
	};
}

/**
 * @param {Object} sketch
 * @param {Object} pick
 * @returns {{points: Array, pieces: Array}}
 */
export function prunePick(sketch, pick) {
	if (!sketch || sketch.setAside === true) return emptyPick();
	const used = new Set();
	visiblePieces(sketch).forEach((piece) => piecePointIds(piece).forEach((id) => used.add(id)));
	return {
		points: (pick?.points || []).filter((id) => sketch.points?.[id] && used.has(id)),
		pieces: (pick?.pieces || []).filter((id) => {
			const piece = getPiece(sketch, id);
			return !!piece && !piece.hidden;
		}),
	};
}

/** @returns {Boolean} */
export function samePick(a, b) {
	const same = (x = [], y = []) => x.length === y.length && x.every((id, i) => y[i] === id);
	return same(a?.points, b?.points) && same(a?.pieces, b?.pieces);
}
