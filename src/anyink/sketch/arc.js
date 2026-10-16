// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 (SKETCH.md section 8): Arc and curve parts as cubics.

	An Arc is stored as its two ends plus a bulge, never a "through" point: bulge = tan(sweep / 4)
	(the DXF convention: 0 = straight, 1 = a half circle, + = it turns left going from its first
	end to its second, - = right; font units, y up). The bulge does not depend on size, so when an
	end moves the arc keeps its shape in proportion and stays on the same side of its chord: it
	can never flip or blow up (that holds for a stored bulge; a tangent arc's bulge is worked out
	from a direction, below). Bulge also equals 2 * sagitta / chord, which is how the middle of an
	arc is dragged (S4).

	An arc is built as cubics split every 90 degrees or less, each with handles 4/3 tan(a / 4) of
	the radius long; the farthest a quarter strays from the true circle is 0.027 % of the radius.

	A tangent arc (SolidWorks' Tangent Arc) has one free end: its bulge comes from the direction it
	must leave its first end in. When the end lies nearly behind that direction the turn nears a
	whole circle and the radius grows without limit (179 degrees off a 100-unit chord: a 358-degree
	arc of radius 2865), so a tangent arc turns at most MAX_TANGENT_SWEEP (300 degrees, radius at
	most the chord); past it tangentBulge gives null and curves.js builds the part as a curve that
	leaves tangent with Hobby's lengths (still smooth at the join, never wider than a few chords).

	A part that must be tangent at both ends is a "curve": one cubic whose handle directions are
	given and whose handle lengths come from Hobby's rule (hobby.js velocity) with a tension at
	each end.

	  arcGeometry(p0, p1, bulge)          { sweep, radius, center, startDir, endDir } (degrees)
	  arcCubics(p0, p1, bulge)            cubics, [[p0, h1, h2, p3], ...]
	  arcPoint(p0, p1, bulge, t)          the point a share t along the arc
	  tangentBulge(p0, p1, dir)           the bulge of the arc that leaves p0 in direction dir, or
	                                      null when that arc would turn past MAX_TANGENT_SWEEP
	  bulgeFromMiddle(p0, p1, m)          the bulge of the arc whose middle is as far off the
	                                      chord as m is (2 * sagitta / chord, signed)
	  arcDirs(p0, p1, bulge)              { start, end } directions in degrees
	  curveCubic(p0, p1, dir0, dir1, { tout, tin })   one cubic, tangent at both ends
	  MAX_PIECE_SWEEP                     90 (degrees)
	  MAX_TANGENT_SWEEP                   300 (degrees)
*/
import { hobbyCubic, reduceAngle } from './hobby.js';

export const MAX_PIECE_SWEEP = 90;
/** The most a tangent arc may turn: past it the end lies nearly behind the way in */
export const MAX_TANGENT_SWEEP = 300;
/** The most an arc may turn: a whole turn has no chord to stand on */
const MAX_SWEEP = 359;
const DEG = Math.PI / 180;

/**
 * @param {[Number, Number]} p
 * @returns {[Number, Number]}
 */
const copy = (p) => [Number(p[0]), Number(p[1])];

/**
 * @param {Number} bulge
 * @returns {Number} the sweep in radians, + = left turn, held under a whole turn
 */
function sweepOf(bulge) {
	const b = Number(bulge) || 0;
	const sweep = 4 * Math.atan(b);
	const max = MAX_SWEEP * DEG;
	return Math.max(-max, Math.min(max, sweep));
}

/**
 * @param {[Number, Number]} p0
 * @param {[Number, Number]} p1
 * @param {Number} bulge
 * @returns {{sweep: Number, radius: Number, center: [Number, Number]|null, startDir: Number,
 *   endDir: Number, chord: Number}} sweep and directions in degrees; radius Infinity and center
 *   null for a straight arc
 */
export function arcGeometry(p0, p1, bulge) {
	const dx = p1[0] - p0[0];
	const dy = p1[1] - p0[1];
	const chord = Math.hypot(dx, dy);
	const chordDir = Math.atan2(dy, dx);
	const sweep = sweepOf(bulge);
	const startDir = chordDir - sweep / 2;
	const endDir = chordDir + sweep / 2;
	if (Math.abs(sweep) < 1e-12 || chord === 0) {
		return {
			sweep: 0,
			radius: Infinity,
			center: null,
			startDir: startDir / DEG,
			endDir: endDir / DEG,
			chord,
		};
	}
	const radius = chord / (2 * Math.abs(Math.sin(sweep / 2)));
	// the center is to the left of the start direction for a left turn, to the right for a right
	const side = sweep > 0 ? 1 : -1;
	const normal = startDir + (side * Math.PI) / 2;
	const center = [p0[0] + radius * Math.cos(normal), p0[1] + radius * Math.sin(normal)];
	return { sweep: sweep / DEG, radius, center, startDir: startDir / DEG, endDir: endDir / DEG, chord };
}

/**
 * @param {[Number, Number]} p0
 * @param {[Number, Number]} p1
 * @param {Number} bulge
 * @returns {{start: Number, end: Number}} degrees
 */
export function arcDirs(p0, p1, bulge) {
	const { startDir, endDir } = arcGeometry(p0, p1, bulge);
	return { start: startDir, end: endDir };
}

/**
 * @param {[Number, Number]} p0
 * @param {[Number, Number]} p1
 * @returns {Array<[Number, Number]>}
 */
function straight(p0, p1) {
	const a = copy(p0);
	const b = copy(p1);
	const third = (k) => [a[0] + ((b[0] - a[0]) * k) / 3, a[1] + ((b[1] - a[1]) * k) / 3];
	return [a, third(1), third(2), b];
}

/**
 * @param {[Number, Number]} p0
 * @param {[Number, Number]} p1
 * @param {Number} bulge
 * @returns {Array<Array<[Number, Number]>>}
 */
export function arcCubics(p0, p1, bulge) {
	const geo = arcGeometry(p0, p1, bulge);
	if (!geo.center) return [straight(p0, p1)];
	const sweep = geo.sweep * DEG;
	const count = Math.max(1, Math.ceil(Math.abs(geo.sweep) / MAX_PIECE_SWEEP - 1e-9));
	const step = sweep / count;
	const k = (4 / 3) * Math.tan(step / 4) * geo.radius;
	const [cx, cy] = geo.center;
	const a0 = Math.atan2(p0[1] - cy, p0[0] - cx);
	const at = (a) => [cx + geo.radius * Math.cos(a), cy + geo.radius * Math.sin(a)];
	const out = [];
	for (let i = 0; i < count; i++) {
		const a = a0 + i * step;
		const b = a + step;
		const s = i === 0 ? copy(p0) : at(a);
		const e = i === count - 1 ? copy(p1) : at(b);
		// the handles run along the tangents (perpendicular to the radius, in the turn's sense)
		out.push([
			s,
			[s[0] - k * Math.sin(a), s[1] + k * Math.cos(a)],
			[e[0] + k * Math.sin(b), e[1] - k * Math.cos(b)],
			e,
		]);
	}
	return out;
}

/**
 * @param {[Number, Number]} p0
 * @param {[Number, Number]} p1
 * @param {Number} bulge
 * @param {Number} t - 0 to 1
 * @returns {[Number, Number]}
 */
export function arcPoint(p0, p1, bulge, t) {
	const geo = arcGeometry(p0, p1, bulge);
	if (!geo.center) return [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
	const a0 = Math.atan2(p0[1] - geo.center[1], p0[0] - geo.center[0]);
	const a = a0 + geo.sweep * DEG * t;
	return [geo.center[0] + geo.radius * Math.cos(a), geo.center[1] + geo.radius * Math.sin(a)];
}

/**
 * The tangent arc: leaves p0 in direction dir and ends at p1.
 * @param {[Number, Number]} p0
 * @param {[Number, Number]} p1
 * @param {Number} dir - degrees
 * @returns {Number|null} bulge, or null past MAX_TANGENT_SWEEP
 */
export function tangentBulge(p0, p1, dir) {
	const chordDir = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
	if (p1[0] === p0[0] && p1[1] === p0[1]) return 0;
	// startDir = chordDir - sweep / 2
	const half = reduceAngle(chordDir - Number(dir) * DEG);
	if (!Number.isFinite(half)) return null;
	if (Math.abs(2 * half) > MAX_TANGENT_SWEEP * DEG + 1e-12) return null;
	return Math.tan(half / 2);
}

/**
 * The bulge of the arc whose middle is as far off the chord as m is. A left-turning arc
 * (bulge +) bows out to the right of its chord going p0 to p1, so m on the right gives +.
 * @param {[Number, Number]} p0
 * @param {[Number, Number]} p1
 * @param {[Number, Number]} m
 * @returns {Number}
 */
export function bulgeFromMiddle(p0, p1, m) {
	const dx = p1[0] - p0[0];
	const dy = p1[1] - p0[1];
	const chord = Math.hypot(dx, dy);
	if (chord === 0) return 0;
	// signed distance of m to the left of the chord
	const left = (dx * (m[1] - p0[1]) - dy * (m[0] - p0[0])) / chord;
	// a left turn (bulge +) bows to the right of its chord
	return (-2 * left) / chord;
}

/**
 * One cubic from p0 to p1, leaving p0 along dir0 and arriving at p1 along dir1 (both the
 * direction of travel, degrees), with Hobby's handle lengths.
 * @param {[Number, Number]} p0
 * @param {[Number, Number]} p1
 * @param {Number} dir0
 * @param {Number} dir1
 * @param {{tout?: Number, tin?: Number}} [tensions]
 * @returns {Array<[Number, Number]>}
 */
export function curveCubic(p0, p1, dir0, dir1, { tout = 1, tin = 1 } = {}) {
	const chordDir = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
	if (p1[0] === p0[0] && p1[1] === p0[1]) return [copy(p0), copy(p0), copy(p1), copy(p1)];
	const theta = reduceAngle(Number(dir0) * DEG - chordDir);
	const phi = reduceAngle(chordDir - Number(dir1) * DEG);
	return hobbyCubic(copy(p0), copy(p1), theta, phi, tout, tin);
}
