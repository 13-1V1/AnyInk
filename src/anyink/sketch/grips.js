// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md sections 5 and 8): the grips on a picked smooth point, as SolidWorks' spline
	handles. Pure: the sketch passed in is never changed. Font units, y up.

	  circle    at the end of the handle leaving the point: direction and pull together
	  diamond   half-way along that handle: direction only
	  arrow     at the end of the handle arriving at the point: pull only (that side's tension)

	The handle's length is the built curve's own, so the grip sits where the curve really pulls.
	A pull maps to tension through hobby.js gripTension (longer pull, lower tension, 0.75 to 4),
	and the grip is drawn at gripPull(gripTension(pull)) of its normal length, so a pull past the
	range stops where the handle stops (D-048 point 6). Once a grip is dragged the point's
	direction is locked: aim = { dir, tin, tout } (degrees, tension each side). [Let it flow] (or
	a double-click on a grip) clears the aim and the curve flows through on its own again.

	Grips show on a picked point that is smooth inside a curve or Spline, or a free end of one. A
	direction a Line beside the point gives never turns, so there only the arrow shows (the
	pull); a corner between two Lines has none.

	  gripsFor(sketch, id)     null, or { id, at: { x, y }, dir, out: { x, y } | null, back:
	                           { x, y } | null, diamond: { x, y } | null, normal: { out, back },
	                           turns: Boolean, locked: Boolean }
	  hitGrip(grips, at, radius)   'circle' | 'diamond' | 'arrow' | null
	  dragGrip(sketch, grips, which, pointer)   a new sketch with the point's aim set, or null
	  letItFlow(sketch, id)    a new sketch with the aim cleared, or null when it had none
	  isAimed(sketch, id)      the point's direction is locked by a grip
*/
import { piecePartCubics } from './curves.js';
import { gripPull, gripTension } from './hobby.js';
import { piecesAt } from './model.js';

const DEG = Math.PI / 180;
const clone = (value) => JSON.parse(JSON.stringify(value));
/** A handle shorter than this is no handle */
const NO_LENGTH = 0.5;

/**
 * The cubics that leave and arrive at the point, and the part each belongs to.
 * @returns {{leave: Object | null, arrive: Object | null}}
 */
function sidesOf(sketch, id) {
	const point = sketch?.points?.[id];
	if (!point) return { leave: null, arrive: null };
	let leave = null;
	let arrive = null;
	for (const piece of piecesAt(sketch, id)) {
		if (piece.hidden || piece.circle) continue;
		let entries = [];
		try {
			entries = piecePartCubics(piece, sketch);
		} catch {
			entries = [];
		}
		entries.forEach((entry) => {
			const type = piece.parts?.[entry.part]?.type;
			if (!leave && entry.a === id && entry.cubics.length) {
				leave = { cubic: entry.cubics[0], type, piece };
			}
			if (!arrive && entry.b === id && entry.cubics.length) {
				arrive = { cubic: entry.cubics.at(-1), type, piece };
			}
		});
		if (leave || arrive) break;
	}
	return { leave, arrive };
}

/**
 * @param {Object} sketch
 * @param {String} id
 * @returns {Object | null}
 */
export function gripsFor(sketch, id) {
	const point = sketch?.points?.[id];
	if (!point) return null;
	const { leave, arrive } = sidesOf(sketch, id);
	const curved = (side) => !!side && side.type !== 'line';
	if (!curved(leave) && !curved(arrive)) return null;
	const end = !leave || !arrive;
	if (point.kind === 'corner' && !end) return null;
	const at = { x: Number(point.x), y: Number(point.y) };
	const outVec = leave ? [leave.cubic[1][0] - at.x, leave.cubic[1][1] - at.y] : null;
	const backVec = arrive ? [arrive.cubic[2][0] - at.x, arrive.cubic[2][1] - at.y] : null;
	const outLength = outVec ? Math.hypot(...outVec) : 0;
	const backLength = backVec ? Math.hypot(...backVec) : 0;
	let dir = null;
	if (outLength > NO_LENGTH) dir = Math.atan2(outVec[1], outVec[0]) / DEG;
	else if (backLength > NO_LENGTH) dir = Math.atan2(-backVec[1], -backVec[0]) / DEG;
	if (dir === null) return null;
	const turns = !(leave?.type === 'line' || arrive?.type === 'line');
	const tout = Number(point.aim?.tout) || 1;
	const tin = Number(point.aim?.tin) || 1;
	const r = dir * DEG;
	const along = (length) => ({ x: at.x + Math.cos(r) * length, y: at.y + Math.sin(r) * length });
	const out = curved(leave) && outLength > NO_LENGTH ? along(outLength) : null;
	const back = curved(arrive) && backLength > NO_LENGTH ? along(-backLength) : null;
	return {
		id,
		at,
		dir,
		out: turns ? out : null,
		back,
		diamond: turns && out ? along(outLength / 2) : null,
		normal: { out: outLength * tout, back: backLength * tin },
		turns,
		locked: isAimed(sketch, id),
	};
}

/**
 * @param {Object | null} grips
 * @param {{x: Number, y: Number}} at
 * @param {Number} radius
 * @returns {'circle' | 'diamond' | 'arrow' | null}
 */
export function hitGrip(grips, at, radius) {
	if (!grips) return null;
	const near = (p) => !!p && Math.hypot(p.x - at.x, p.y - at.y) <= radius;
	if (near(grips.out)) return 'circle';
	if (near(grips.back)) return 'arrow';
	if (near(grips.diamond)) return 'diamond';
	return null;
}

/**
 * @param {Object} sketch
 * @param {Object} grips - gripsFor at the press
 * @param {'circle' | 'diamond' | 'arrow'} which
 * @param {{x: Number, y: Number}} pointer
 * @returns {Object | null}
 */
export function dragGrip(sketch, grips, which, pointer) {
	const point = sketch?.points?.[grips?.id];
	if (!point) return null;
	const dx = pointer.x - grips.at.x;
	const dy = pointer.y - grips.at.y;
	const length = Math.hypot(dx, dy);
	const aim = {
		dir: round(grips.dir),
		tin: Number(point.aim?.tin) || 1,
		tout: Number(point.aim?.tout) || 1,
	};
	if (which === 'circle' || which === 'diamond') {
		if (!(length > 0) || !grips.turns) return null;
		aim.dir = round(Math.atan2(dy, dx) / DEG);
	}
	if (which === 'circle' && grips.normal.out > 0) {
		aim.tout = round(gripTension(length / grips.normal.out));
	}
	if (which === 'arrow' && grips.normal.back > 0) {
		// the pull along the arriving side's own way (back is opposite the direction)
		const r = grips.dir * DEG;
		const pulled = Math.max(0, -(dx * Math.cos(r) + dy * Math.sin(r)));
		aim.tin = round(gripTension(pulled / grips.normal.back));
	}
	const next = clone(sketch);
	next.points[grips.id] = { ...next.points[grips.id], aim };
	return next;
}

/**
 * Where a grip is drawn for a pull: gripPull(gripTension(pull)) of its normal length.
 * @param {Number} normal
 * @param {Number} pull - share of the normal length
 * @returns {Number}
 */
export function gripLength(normal, pull) {
	return normal * gripPull(gripTension(pull));
}

/**
 * @param {Object} sketch
 * @param {String} id
 * @returns {Object | null}
 */
export function letItFlow(sketch, id) {
	if (!isAimed(sketch, id)) return null;
	const next = clone(sketch);
	delete next.points[id].aim;
	return next;
}

/** @returns {Boolean} */
export function isAimed(sketch, id) {
	const aim = sketch?.points?.[id]?.aim;
	return !!aim && typeof aim === 'object';
}

const round = (value) => Math.round(Number(value) * 1e4) / 1e4;
