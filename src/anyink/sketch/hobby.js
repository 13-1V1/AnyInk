// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 (SKETCH.md sections 8, 9): the Spline's smooth curve through points, Knuth and Hobby's
	method as METAFONT and MetaPost do it (The METAFONTbook ch. 14, mp.w make_choices), written
	in-house because hobby-curve 0.2.1 has no direction at a point and one tension for the whole
	path.

	The curve passes through every point. At each point the curve leaves at an angle theta from
	the next chord and arrives at an angle phi from the chord before; the angles are chosen so the
	"mock curvature" matches on both sides of every inner point (one linear equation per point),
	with curl 1 at a free open end (the end bends like its neighbor). Each piece of curve is then
	one cubic whose handle lengths come from Hobby's velocity function divided by the tension.

	A point can carry, like MetaPost's z{dir} and "tension a and b":
	  dir      the direction the curve passes through it, degrees (0 = right, 90 = up)
	  tin      the tension arriving at it (MetaPost's left tension), 0.75 to 4, 1 = normal
	  tout     the tension leaving it (MetaPost's right tension), 0.75 to 4
	  corner   true: the curve stops and starts again here (curl on both sides, a corner)
	A point with a dir or a corner splits the equations into runs that are solved on their own,
	exactly as MetaPost splits a path at a given direction. Tensions outside 0.75 to 4 are held to
	them ("tension atleast" is not offered). Directions: font units, y up.

	The grip (S4): a handle's length is the chord times velocity over the tension, so a grip
	pulled to k times its normal length is tension 1 / k. 0.75 is MetaPost's floor (below it a
	curve can loop), so a grip can be at most 1 / 0.75 = 1.33 times its normal length and at
	least 1 / 4 of it (GRIP_RANGE); gripTension / gripPull convert, and the grip is drawn at the
	length it really has. (Measured on a middle point aimed level: 152 at 0.75, 110 at 1, 38 at 4;
	the shortest is about a third, not a quarter, because the angles move with the tension too.)

	The equations are solved with each row scaled to its largest coefficient, so the pivot test is
	relative: a path at 1e-9 or 1e15 times the size comes out the same shape.

	  hobby(points, { cyclic, curl })   cubics [[p0, h1, h2, p3], ...], [x, y] each, one per
	                                    piece of curve (n - 1 open, n cyclic); the Brush
	                                    skeleton format
	  velocity(theta, phi, tension)     Hobby's handle length for a chord of 1 (radians)
	  hobbyCubic(p0, p1, theta, phi, tout, tin)   one cubic from its two angles (radians)
	  curlRatio(gamma, tout, tin)       mp.w's curl_ratio: phi / theta at a curl end
	  MIN_TENSION, MAX_TENSION
*/

export const MIN_TENSION = 0.75;
export const MAX_TENSION = 4;
/** A grip's pull as a share of its normal length: as long and as short as a tension allows */
export const GRIP_RANGE = Object.freeze({ longest: 1 / MIN_TENSION, shortest: 1 / MAX_TENSION });

const SQRT2 = Math.SQRT2;
const SQRT5 = Math.sqrt(5);
const DEG = Math.PI / 180;

/**
 * @param {Number} [t]
 * @returns {Number}
 */
function tension(t) {
	const value = Number(t);
	if (!Number.isFinite(value)) return 1;
	return Math.min(MAX_TENSION, Math.max(MIN_TENSION, Math.abs(value)));
}

/**
 * The tension for a spline grip pulled to `pull` times its normal length (S4). A handle's length
 * is the chord times velocity over the tension, so the pull is 1 / tension, held to GRIP_RANGE.
 * @param {Number} pull - 1 = normal
 * @returns {Number} MIN_TENSION to MAX_TENSION
 */
export function gripTension(pull) {
	const value = Number(pull);
	if (!(value > 0)) return 1;
	return tension(1 / value);
}

/**
 * The pull a grip really has at a tension: where S4 draws the grip's end, so a pull past the
 * range stops where the handle stops.
 * @param {Number} t
 * @returns {Number}
 */
export function gripPull(t) {
	return 1 / tension(t);
}

/**
 * An angle in (-pi, pi]
 * @param {Number} a - radians
 * @returns {Number}
 */
export function reduceAngle(a) {
	let r = a % (2 * Math.PI);
	if (r > Math.PI) r -= 2 * Math.PI;
	if (r <= -Math.PI) r += 2 * Math.PI;
	return r;
}

/**
 * Hobby's velocity: a handle's length for a chord of length 1 (mp.w velocity, capped at 4).
 * @param {Number} theta - radians, the angle at this end
 * @param {Number} phi - radians, the angle at the other end
 * @param {Number} [t] - the tension at this end
 * @returns {Number}
 */
export function velocity(theta, phi, t = 1) {
	const st = Math.sin(theta);
	const ct = Math.cos(theta);
	const sf = Math.sin(phi);
	const cf = Math.cos(phi);
	const num = 2 + SQRT2 * (st - sf / 16) * (sf - st / 16) * (ct - cf);
	const denom = 3 * (1 + ((SQRT5 - 1) / 2) * ct + ((3 - SQRT5) / 2) * cf) * tension(t);
	if (!(denom > 0) || num / 4 >= denom) return 4;
	return num / denom;
}

/**
 * mp.w curl_ratio: at a curl end, the angle at the far end over the angle here.
 * @param {Number} gamma - the curl, 1 = normal
 * @param {Number} tHere - the tension at the curl end
 * @param {Number} tThere - the tension at the other end of the same piece
 * @returns {Number}
 */
export function curlRatio(gamma, tHere = 1, tThere = 1) {
	const a = 1 / tension(tHere);
	const b = 1 / tension(tThere);
	const num = (3 - a) * a * a * gamma + b * b * b;
	const denom = a * a * a * gamma + (3 - b) * b * b;
	if (!(denom > 0) || num >= 4 * denom) return 4;
	return num / denom;
}

/**
 * One cubic from z0 to z1 that leaves at theta from the chord and arrives at phi from it.
 * @param {[Number, Number]} p0
 * @param {[Number, Number]} p1
 * @param {Number} theta - radians
 * @param {Number} phi - radians
 * @param {Number} [tout] - the tension leaving p0
 * @param {Number} [tin] - the tension arriving at p1
 * @returns {Array<[Number, Number]>}
 */
export function hobbyCubic(p0, p1, theta, phi, tout = 1, tin = 1) {
	const dx = p1[0] - p0[0];
	const dy = p1[1] - p0[1];
	const st = Math.sin(theta);
	const ct = Math.cos(theta);
	const sf = Math.sin(phi);
	const cf = Math.cos(phi);
	const rr = velocity(theta, phi, tout);
	const ss = velocity(phi, theta, tin);
	return [
		[p0[0], p0[1]],
		[p0[0] + (dx * ct - dy * st) * rr, p0[1] + (dy * ct + dx * st) * rr],
		[p1[0] - (dx * cf + dy * sf) * ss, p1[1] - (dy * cf - dx * sf) * ss],
		[p1[0], p1[1]],
	];
}

/**
 * Gaussian elimination with partial pivoting; the systems here are a few dozen rows at most.
 * @param {Array<Array<Number>>} m - rows, each ending with its right-hand side (changed)
 * @returns {Array<Number>}
 */
function solve(m) {
	const n = m.length;
	// each row scaled so its largest coefficient is 1: the coefficients go as 1 / chord, so the
	// pivot test below is then the same at every size of drawing (relative, not absolute)
	for (const row of m) {
		let big = 0;
		for (let j = 0; j < n; j++) big = Math.max(big, Math.abs(row[j]));
		if (big > 0 && Number.isFinite(big)) for (let j = 0; j <= n; j++) row[j] /= big;
	}
	for (let c = 0; c < n; c++) {
		let pivot = c;
		for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
		[m[c], m[pivot]] = [m[pivot], m[c]];
		const lead = m[c][c];
		if (Math.abs(lead) < 1e-12) continue;
		for (let r = 0; r < n; r++) {
			if (r === c || m[r][c] === 0) continue;
			const k = m[r][c] / lead;
			for (let j = c; j <= n; j++) m[r][j] -= k * m[c][j];
		}
	}
	return m.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}

/**
 * The coefficients of the mock-curvature equation at an inner point k (METAFONTbook ch. 14):
 *   A theta(k-1) + (B + C) theta(k) + D theta(k+1) = -B psi(k) - D psi(k+1)
 * alpha and beta are the reciprocals of the tensions.
 * @returns {{A: Number, B: Number, C: Number, D: Number}}
 */
export function curvatureRow(dBefore, dAfter, toutBefore, tinHere, toutHere, tinAfter) {
	const aPrev = 1 / tension(toutBefore);
	const bHere = 1 / tension(tinHere);
	const aHere = 1 / tension(toutHere);
	const bNext = 1 / tension(tinAfter);
	return {
		A: aPrev / (bHere * bHere * dBefore),
		B: (3 - aPrev) / (bHere * bHere * dBefore),
		C: (3 - bNext) / (aHere * aHere * dAfter),
		D: bNext / (aHere * aHere * dAfter),
	};
}

/**
 * Solve one open run z[0..n] whose ends are each either a given direction or a curl.
 * @param {Array<{x: Number, y: Number, tin?: Number, tout?: Number}>} z
 * @param {Number|null} startDir - radians, or null for a curl
 * @param {Number|null} endDir - radians, or null for a curl
 * @param {Number} curl
 * @returns {Array<Array<[Number, Number]>>}
 */
function openRun(z, startDir, endDir, curl) {
	const n = z.length - 1;
	const dx = [];
	const dy = [];
	const d = [];
	const arg = [];
	for (let k = 0; k < n; k++) {
		dx[k] = z[k + 1].x - z[k].x;
		dy[k] = z[k + 1].y - z[k].y;
		d[k] = Math.hypot(dx[k], dy[k]);
		arg[k] = Math.atan2(dy[k], dx[k]);
	}
	const psi = [0];
	for (let k = 1; k < n; k++) psi[k] = reduceAngle(arg[k] - arg[k - 1]);
	psi[n] = 0;
	const p = (k) => [z[k].x, z[k].y];

	// two curls on one piece: a straight line (mp.w "reduce to simple case of straight line")
	if (n === 1 && startDir === null && endDir === null) {
		return [
			[
				p(0),
				[z[0].x + dx[0] / (3 * tension(z[0].tout)), z[0].y + dy[0] / (3 * tension(z[0].tout))],
				[z[1].x - dx[0] / (3 * tension(z[1].tin)), z[1].y - dy[0] / (3 * tension(z[1].tin))],
				p(1),
			],
		];
	}

	// unknowns theta[0..n]; theta[n] stands for -phi[n] (psi[n] = 0 inside a run)
	const rows = [];
	const row = () => new Array(n + 2).fill(0);
	{
		const r = row();
		if (startDir !== null) {
			r[0] = 1;
			r[n + 1] = reduceAngle(startDir - arg[0]);
		} else {
			const u = curlRatio(curl, z[0].tout, z[1].tin);
			r[0] = 1;
			r[1] = u;
			r[n + 1] = -u * psi[1];
		}
		rows.push(r);
	}
	for (let k = 1; k < n; k++) {
		const { A, B, C, D } = curvatureRow(
			d[k - 1],
			d[k],
			z[k - 1].tout,
			z[k].tin,
			z[k].tout,
			z[k + 1].tin
		);
		const r = row();
		r[k - 1] = A;
		r[k] = B + C;
		r[k + 1] = D;
		r[n + 1] = -B * psi[k] - D * psi[k + 1];
		rows.push(r);
	}
	{
		const r = row();
		if (endDir !== null) {
			r[n] = 1;
			r[n + 1] = -reduceAngle(arg[n - 1] - endDir);
		} else {
			// phi[n] = ff * theta[n-1]  ->  theta[n] + ff * theta[n-1] = 0
			const ff = curlRatio(curl, z[n].tin, z[n - 1].tout);
			r[n] = 1;
			r[n - 1] = ff;
		}
		rows.push(r);
	}
	const theta = solve(rows);
	const out = [];
	for (let k = 0; k < n; k++) {
		const phi = -theta[k + 1] - psi[k + 1];
		out.push(hobbyCubic(p(k), p(k + 1), theta[k], phi, z[k].tout, z[k + 1].tin));
	}
	return out;
}

/**
 * A closed curve with no given direction and no corner: one cyclic system.
 * @returns {Array<Array<[Number, Number]>>}
 */
function cyclicRun(z) {
	const n = z.length;
	const at = (k) => z[((k % n) + n) % n];
	const arg = [];
	const d = [];
	for (let k = 0; k < n; k++) {
		const dx = at(k + 1).x - at(k).x;
		const dy = at(k + 1).y - at(k).y;
		d[k] = Math.hypot(dx, dy);
		arg[k] = Math.atan2(dy, dx);
	}
	const argAt = (k) => arg[((k % n) + n) % n];
	const dAt = (k) => d[((k % n) + n) % n];
	const psi = (k) => reduceAngle(argAt(k) - argAt(k - 1));
	const rows = [];
	for (let k = 0; k < n; k++) {
		const { A, B, C, D } = curvatureRow(
			dAt(k - 1),
			dAt(k),
			at(k - 1).tout,
			at(k).tin,
			at(k).tout,
			at(k + 1).tin
		);
		const r = new Array(n + 1).fill(0);
		r[(k - 1 + n) % n] += A;
		r[k] += B + C;
		r[(k + 1) % n] += D;
		r[n] = -B * psi(k) - D * psi(k + 1);
		rows.push(r);
	}
	const theta = solve(rows);
	const out = [];
	for (let k = 0; k < n; k++) {
		const next = (k + 1) % n;
		const phi = -theta[next] - psi(k + 1);
		out.push(
			hobbyCubic([at(k).x, at(k).y], [at(next).x, at(next).y], theta[k], phi, at(k).tout, at(next).tin)
		);
	}
	return out;
}

/**
 * @param {Array<{x: Number, y: Number, dir?: Number|null, tin?: Number, tout?: Number,
 *   corner?: Boolean}>} points
 * @param {{cyclic?: Boolean, curl?: Number}} [options]
 * @returns {Array<Array<[Number, Number]>>}
 */
export function hobby(points, { cyclic = false, curl = 1 } = {}) {
	const z = (points || []).map((pt) => ({
		x: Number(pt.x),
		y: Number(pt.y),
		dir: Number.isFinite(pt.dir) ? pt.dir * DEG : null,
		tin: tension(pt.tin),
		tout: tension(pt.tout),
		corner: !!pt.corner,
	}));
	const count = z.length;
	if (count === 0) return [];
	if (count === 1) {
		const p = [z[0].x, z[0].y];
		return [[p, [...p], [...p], [...p]]];
	}
	const gamma = Math.max(0, Number.isFinite(curl) ? curl : 1);
	const same = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) < 1e-9;
	const segments = cyclic ? count : count - 1;
	// a point is a break when it has a direction, is a corner, or touches a piece of no length
	const isBreak = (k) => {
		const pt = z[k];
		if (pt.dir !== null || pt.corner) return true;
		const prev = cyclic || k > 0 ? z[(k - 1 + count) % count] : null;
		const next = cyclic || k < count - 1 ? z[(k + 1) % count] : null;
		return (prev && same(prev, pt)) || (next && same(pt, next));
	};
	let breaks = [];
	for (let k = 0; k < count; k++) if (isBreak(k)) breaks.push(k);
	if (cyclic && breaks.length === 0) return cyclicRun(z);
	if (!cyclic) breaks = [...new Set([0, ...breaks, count - 1])].sort((a, b) => a - b);

	const out = new Array(segments);
	// runs between consecutive breaks (cyclic: around the end and back to the first break)
	const runCount = cyclic ? breaks.length : breaks.length - 1;
	for (let r = 0; r < runCount; r++) {
		const from = breaks[r];
		let to = breaks[r + 1];
		if (cyclic && r === breaks.length - 1) to = breaks[0] + count;
		const ids = [];
		for (let k = from; k <= to; k++) ids.push(k % count);
		const run = ids.map((k) => z[k]);
		if (run.length === 2 && same(run[0], run[1])) {
			const p = [run[0].x, run[0].y];
			out[from % count] = [p, [...p], [...p], [...p]];
			continue;
		}
		const endDir = (pt) => (pt.dir !== null && !pt.corner ? pt.dir : null);
		const cubics = openRun(run, endDir(run[0]), endDir(run[run.length - 1]), gamma);
		cubics.forEach((cubic, i) => {
			out[ids[i]] = cubic;
		});
	}
	return out;
}
