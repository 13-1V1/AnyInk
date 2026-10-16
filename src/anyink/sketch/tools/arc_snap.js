// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S2 (docs/SKETCH.md section 6, the edge rule): an arc's top or bottom put on a writing
	line, the way a SolidWorks user makes an arch tangent to a horizontal at the small-letter line.
	Pure: no DOM, no editor. Font units, y up.

	An arc is ends plus a bulge (arc.js), so its top is not a point the snaps can pin; instead the
	bend (a 3-point Arc's bulge) or the end (a tangent arc, whose bulge comes from the way in) is
	chosen so the arc's extreme lands where the edge rule puts a round top: on a Centerline the ink
	edge on the line (the center half the edge thickness inside), plus the overshoot of round tops
	on the writing, small-letter and capitals lines (edge_rule.js overshootOf); on an Outline the
	line itself plus the overshoot. Tops go to the lines the ink hangs below (top, capitals,
	small-letter), bottoms to the lines it sits on (writing, tail): the edge rule's sides.

	It snaps when the free arc's top (or bottom) comes within the snap radius of the real line (as
	snap.js: the faint ink line is where it lands, not a second target). When the free arc's top runs past a line it would need to sit under, the line is
	only shown (a dotted level hint through the top and the line's name), never snapped.

	  arcExtreme(p0, p1, bulge, 'top' | 'bottom')   { x, y } where the arc turns level between its
	                                        ends, or null when it does not
	  extremeTargets(font, thickness, use)  [{ on, side: 'top' | 'bottom', line, y }]: the y the
	                                        arc's extreme goes to for each line
	  snapBulge(p0, p1, pointer, context)   { bulge, snap } for a 3-point Arc's bend click
	  snapTangentEnd(p0, dir, end, context) { end, bulge, snap } for a tangent arc's end click
	    context: { font, thickness, use, radius, ctrl }
	    snap:    null, or { on, x, y (the extreme), touches: Boolean (false: only shown),
	             tag: { key }, hints: [a dotted level hint through the extreme] }
*/
import { guideLines } from '../../placement/classes.js';
import { arcGeometry, bulgeFromMiddle, tangentBulge } from '../arc.js';
import { edgeThickness, INK_SIDE, LINE_NAMES, OVERSHOOT_LINES } from '../edge_rule.js';
import { LINE_WORDS } from './snap.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
/** The largest bend the bisection tries (degrees of sweep) */
const MOST_SWEEP = 358;
/** The dotted hint runs this many snap radii each side of the extreme */
const HINT_REACH = 3;

/**
 * @param {[Number, Number]} p0
 * @param {[Number, Number]} p1
 * @param {Number} bulge
 * @param {'top' | 'bottom'} side
 * @returns {{x: Number, y: Number} | null}
 */
export function arcExtreme(p0, p1, bulge, side) {
	const geo = arcGeometry(p0, p1, bulge);
	if (!geo.center) return null;
	const sweep = geo.sweep * DEG;
	const [cx, cy] = geo.center;
	const a0 = Math.atan2(p0[1] - cy, p0[0] - cx);
	const want = side === 'top' ? Math.PI / 2 : -Math.PI / 2;
	const along = sweep > 0 ? want - a0 : a0 - want;
	const delta = ((along % TAU) + TAU) % TAU;
	if (delta <= 1e-9 || delta >= Math.abs(sweep) - 1e-9) return null;
	return { x: cx, y: side === 'top' ? cy + geo.radius : cy - geo.radius };
}

/**
 * @param {Object} font
 * @param {Number} thickness
 * @param {String} use
 * @returns {Array<{on: String, side: String, line: Number, y: Number}>}
 */
export function extremeTargets(font, thickness, use) {
	const lines = guideLines(font);
	const r = use === 'outline' ? 0 : edgeThickness(font, thickness) / 2;
	return LINE_NAMES.map((on) => {
		const inkBelow = INK_SIDE[on] < 0;
		const over = OVERSHOOT_LINES.has(on) ? lines.overshoot : 0;
		const out = inkBelow ? 1 : -1;
		return {
			on,
			side: inkBelow ? 'top' : 'bottom',
			line: lines[on],
			y: lines[on] + out * (over - r),
		};
	});
}

/**
 * @returns {Object | null} the target the free arc's extreme is near, or crosses
 */
function nearestTarget(p0, p1, bulge, context) {
	const { font, thickness, use, radius = 0 } = context;
	let best = null;
	let crossing = null;
	for (const target of extremeTargets(font, thickness, use)) {
		const extreme = arcExtreme(p0, p1, bulge, target.side);
		if (!extreme) continue;
		const off = Math.abs(extreme.y - target.line);
		if (off <= radius) {
			if (!best || off < best.off) best = { target, extreme, off };
			continue;
		}
		// past the line: the top above a line the ink hangs below (a bottom below one it sits on),
		// the ends both inside it
		const sign = target.side === 'top' ? 1 : -1;
		const inside =
			target.side === 'top'
				? Math.max(p0[1], p1[1]) < target.y
				: Math.min(p0[1], p1[1]) > target.y;
		if (sign * (extreme.y - target.line) > radius && inside) {
			const past = sign * (extreme.y - target.line);
			if (!crossing || past < crossing.past) crossing = { target, extreme, past };
		}
	}
	return best ? { ...best, touches: true } : crossing ? { ...crossing, touches: false } : null;
}

/**
 * @returns {Object} the snap as the tools show it
 */
function snapOf(target, x, radius, touches) {
	const reach = HINT_REACH * Math.max(radius, 1);
	return {
		on: target.on,
		x,
		y: target.y,
		touches,
		tag: { key: LINE_WORDS[target.on] },
		hints: [
			{
				type: 'level',
				from: { x: x - reach, y: target.y },
				to: { x: x + reach, y: target.y },
			},
		],
	};
}

/**
 * The bulge whose extreme on one side lands on y (the arcs on one side of a chord are nested,
 * so the extreme grows with the bend: bisection).
 * @returns {Number | null}
 */
function bulgeForExtreme(p0, p1, sign, side, y) {
	const reach = (sweep) => {
		const bulge = sign * Math.tan((sweep * DEG) / 4);
		const extreme = arcExtreme(p0, p1, bulge, side);
		if (extreme) return extreme.y;
		return side === 'top' ? Math.max(p0[1], p1[1]) : Math.min(p0[1], p1[1]);
	};
	const goes = side === 'top' ? 1 : -1;
	if (goes * (reach(MOST_SWEEP) - y) < 0) return null;
	let lo = 0;
	let hi = MOST_SWEEP;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		if (goes * (reach(mid) - y) < 0) lo = mid;
		else hi = mid;
	}
	const bulge = sign * Math.tan((hi * DEG) / 4);
	const extreme = arcExtreme(p0, p1, bulge, side);
	return extreme && Math.abs(extreme.y - y) < 0.01 ? bulge : null;
}

/**
 * A 3-point Arc's bend: the bulge from the pointer, its top or bottom put on a writing line when
 * near one.
 * @param {[Number, Number]} p0 - the open end
 * @param {[Number, Number]} p1 - the clicked end
 * @param {{x: Number, y: Number}} pointer
 * @param {Object} context - { font, thickness, use, radius, ctrl }
 * @returns {{bulge: Number, snap: Object | null}}
 */
export function snapBulge(p0, p1, pointer, context = {}) {
	const free = bulgeFromMiddle(p0, p1, [pointer.x, pointer.y]);
	if (context.ctrl || !free) return { bulge: free, snap: null };
	const near = nearestTarget(p0, p1, free, context);
	if (!near) return { bulge: free, snap: null };
	if (!near.touches) {
		return { bulge: free, snap: snapOf(near.target, near.extreme.x, context.radius, false) };
	}
	const bulge = bulgeForExtreme(p0, p1, Math.sign(free), near.target.side, near.target.y);
	if (bulge === null) return { bulge: free, snap: null };
	const extreme = arcExtreme(p0, p1, bulge, near.target.side);
	return { bulge, snap: snapOf(near.target, extreme.x, context.radius, true) };
}

/**
 * A tangent arc's end: it leaves p0 along dir; when its top (or bottom) comes near a writing
 * line, the end moves round the circle whose top is on it, as near the pointer as it can be.
 * @param {[Number, Number]} p0 - the open end
 * @param {Number} dir - degrees the arc leaves p0 in
 * @param {{x: Number, y: Number}} end - where the end would land
 * @param {Object} context - { font, thickness, use, radius, ctrl }
 * @returns {{end: {x: Number, y: Number}, bulge: Number | null, snap: Object | null}}
 */
export function snapTangentEnd(p0, dir, end, context = {}) {
	const p1 = [end.x, end.y];
	const free = tangentBulge(p0, p1, dir);
	const none = { end: { x: end.x, y: end.y }, bulge: free, snap: null };
	if (context.ctrl || free === null || !free || !Number.isFinite(Number(dir))) return none;
	const near = nearestTarget(p0, p1, free, context);
	if (!near) return none;
	if (!near.touches) {
		return { ...none, snap: snapOf(near.target, near.extreme.x, context.radius, false) };
	}
	// the circles that leave p0 along dir: centers on its normal, toward the turn
	const sign = Math.sign(free);
	const a = Number(dir) * DEG;
	const n = [-Math.sin(a) * sign, Math.cos(a) * sign];
	const top = near.target.side === 'top';
	const k = top ? 1 + n[1] : n[1] - 1;
	if (Math.abs(k) < 1e-6) return none;
	const radius = (near.target.y - p0[1]) / k;
	if (!(radius > 1)) return none;
	const center = [p0[0] + radius * n[0], p0[1] + radius * n[1]];
	const away = Math.hypot(end.x - center[0], end.y - center[1]);
	if (away < 1e-6) return none;
	const placed = {
		x: center[0] + (radius * (end.x - center[0])) / away,
		y: center[1] + (radius * (end.y - center[1])) / away,
	};
	const bulge = tangentBulge(p0, [placed.x, placed.y], dir);
	if (bulge === null) return none;
	const extreme = arcExtreme(p0, [placed.x, placed.y], bulge, near.target.side);
	if (!extreme || Math.abs(extreme.y - near.target.y) > 0.5) return none;
	return { end: placed, bulge, snap: snapOf(near.target, extreme.x, context.radius, true) };
}
