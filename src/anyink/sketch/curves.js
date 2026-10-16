// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 (SKETCH.md sections 2, 6 and 8): a sketch piece as the Brush skeleton format, cubics
	[[p0, h1, h2, p3], ...] in font units, in the piece's own order (one or more cubics per part,
	a closed piece ending where it starts). The Centerline build sweeps it (nib/sweep.js), the
	Outline build fills it, bumpy.js measures it.

	How the parts meet:
	  - A point where two parts meet is a corner unless it is kind 'smooth', the next part is a
	    tangent Arc, or either part is a 'curve' (tangent at both ends by definition). Inside a
	    Spline every point is smooth unless it is kind 'corner'. An open piece's two ends are free.
	  - Directions at smooth points, first that applies: a Line beside it (a Line never moves,
	    nor turns); a stored Arc beside it; the point's aim.dir (a grip he dragged); its lock
	    ('level' = 0 or 180 degrees, 'plumb' = 90 or 270, whichever is nearer the way the piece
	    runs there). Otherwise the Hobby spline chooses (hobby.js), curl 1 at a free end.
	  - Give way: the part before a tangent join turns to meet the part after it when that part is
	    a Line. A Spline's end takes the Line's direction (above); an Arc whose second end is a
	    smooth join into a Line is built as a curve tangent at both ends (it keeps its first end's
	    direction when that end is a corner).
	  - A tangent Arc (tangent: true) leaves its first end along the way the part before it
	    arrives there; its stored bulge is used when nothing comes before it.
	  - Splines and curves that meet at smooth points are one Hobby run, so they flow through
	    the join; aim.tin / aim.tout are the tensions on each side of a point.
	  - A piece with a live circle ({ cx, cy, rx, ry }) is built as the exact circle (or oval)
	    through its points, a cubic per quarter or less.
	  - A piece of one point is a dot: [[p, p, p, p]].

	  pieceSkeleton(piece, sketch)      cubics; sketch is the sketch (its .points) or the points
	                                    map itself; [] when the piece has no points
	  pointsMap(sketch)                 the sketch's points map ({} when it has none), or the
	                                    points map itself
	  circleCubics(circle, points)      the circle or oval through points (in their order), or
	                                    the whole oval from its right side counterclockwise
	  endDirection(cubic), startDirection(cubic)   degrees
	  piecePartCubics(piece, sketch)    S4: the same cubics part by part, [{ part, a, b, cubics }]
	                                    (part: index into piece.parts; a / b: the point ids the
	                                    cubics run between). A circle, a let-go oval and a dot are
	                                    one entry for part 0. Select's picks and Bend read it.
*/
import { arcCubics, arcDirs, curveCubic, tangentBulge } from './arc.js';
import { hobby } from './hobby.js';

const DEG = Math.PI / 180;
/** An Arc that already meets the Line after it within this many degrees stays a true arc */
const FITS = 0.1;
/** Handle length of a quarter ellipse, as a share of its half-axis: 4/3 tan(22.5 degrees) */
const QUARTER = (4 / 3) * Math.tan(Math.PI / 8);

const isMap = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * A sketch (anything with its own `points` or `pieces`) gives its points map, or {} when that is
 * missing or not a map; never the sketch itself. Anything else that is a map is a points map.
 * @param {Object} sketch - the sketch, or its points map
 * @returns {Object} id -> point
 */
export function pointsMap(sketch) {
	if (!isMap(sketch)) return {};
	if (Object.hasOwn(sketch, 'points') || Object.hasOwn(sketch, 'pieces')) {
		return isMap(sketch.points) ? sketch.points : {};
	}
	return sketch;
}

/**
 * @param {Object} p
 * @returns {[Number, Number]}
 */
const xy = (p) => [Number(p.x), Number(p.y)];

/**
 * @param {Array<[Number, Number]>} cubic
 * @returns {Number} degrees, the direction the curve leaves its first point
 */
export function startDirection(cubic) {
	const [p0, h1, h2, p3] = cubic;
	for (const q of [h1, h2, p3]) {
		if (Math.hypot(q[0] - p0[0], q[1] - p0[1]) > 1e-9) {
			return Math.atan2(q[1] - p0[1], q[0] - p0[0]) / DEG;
		}
	}
	return 0;
}

/**
 * @param {Array<[Number, Number]>} cubic
 * @returns {Number} degrees, the direction the curve arrives at its last point
 */
export function endDirection(cubic) {
	const [p0, h1, h2, p3] = cubic;
	for (const q of [h2, h1, p0]) {
		if (Math.hypot(p3[0] - q[0], p3[1] - q[1]) > 1e-9) {
			return Math.atan2(p3[1] - q[1], p3[0] - q[0]) / DEG;
		}
	}
	return 0;
}

/**
 * @param {Number} a - degrees
 * @param {Number} b - degrees
 * @returns {Number} the angle between them, 0 to 180
 */
function apart(a, b) {
	const d = Math.abs((((a - b) % 360) + 540) % 360 - 180);
	return d;
}

/**
 * @param {'level'|'plumb'} lock
 * @param {Number|null} way - degrees, the way the piece runs there
 * @returns {Number}
 */
function lockDir(lock, way) {
	const options = lock === 'plumb' ? [90, 270] : [0, 180];
	if (way === null) return options[0];
	return apart(options[0], way) <= apart(options[1], way) ? options[0] : options[1];
}

/**
 * @param {{cx: Number, cy: Number, rx: Number, ry: Number}} circle
 * @param {Array<[Number, Number]>} [points] - in order around
 * @returns {Array<Array<[Number, Number]>>}
 */
export function circleCubics(circle, points = []) {
	const cx = Number(circle.cx);
	const cy = Number(circle.cy);
	const rx = Math.abs(Number(circle.rx)) || 0;
	const ry = Math.abs(Number(circle.ry)) || rx;
	const at = (a) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
	const speed = (a) => [-rx * Math.sin(a), ry * Math.cos(a)];
	const quarter = (a, b, start, end) => {
		const k = (4 / 3) * Math.tan((b - a) / 4);
		const s = start || at(a);
		const e = end || at(b);
		const da = speed(a);
		const db = speed(b);
		return [s, [s[0] + k * da[0], s[1] + k * da[1]], [e[0] - k * db[0], e[1] - k * db[1]], e];
	};
	const param = ([x, y]) => Math.atan2((y - cy) / (ry || 1), (x - cx) / (rx || 1));
	if (!(rx > 0 && ry > 0)) return [];
	if (points.length < 2) {
		const out = [];
		for (let i = 0; i < 4; i++) out.push(quarter((i * Math.PI) / 2, ((i + 1) * Math.PI) / 2));
		return out;
	}
	const angles = points.map(param);
	const steps = angles.map((a, i) => {
		let d = angles[(i + 1) % angles.length] - a;
		while (d > Math.PI) d -= 2 * Math.PI;
		while (d <= -Math.PI) d += 2 * Math.PI;
		return d;
	});
	const turn = steps.reduce((sum, d) => sum + d, 0) >= 0 ? 1 : -1;
	const out = [];
	points.forEach((p, i) => {
		let d = steps[i];
		// a step the wrong way round (or a half turn) goes the piece's own way
		if (Math.sign(d) !== turn) d += turn * 2 * Math.PI;
		const next = points[(i + 1) % points.length];
		const count = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI / 2) - 1e-9));
		for (let j = 0; j < count; j++) {
			const a = angles[i] + (d * j) / count;
			const b = angles[i] + (d * (j + 1)) / count;
			out.push(quarter(a, b, j === 0 ? [...p] : null, j === count - 1 ? [...next] : null));
		}
	});
	return out;
}

/**
 * @returns {Boolean} two points at the same place
 */
const samePlace = (a, b) => !!a && !!b && Number(a.x) === Number(b.x) && Number(a.y) === Number(b.y);

/**
 * A spline's point ids; for a loop, ending on its first id again. A last point that is another
 * id at the first point's place (a close that snapped by position) stands for the first point:
 * two points on top of each other would be a break with a kink and a dot of curve at the seam.
 * @returns {Array<String>}
 */
function loopIds(part, pts, loop) {
	const ids = (part.points || []).filter((id) => pts[id]);
	if (!loop || ids.length < 2) return ids;
	const lastAt = ids.length - 1;
	if (ids[0] !== ids[lastAt] && lastAt > 1 && samePlace(pts[ids[0]], pts[ids[lastAt]])) {
		ids[lastAt] = ids[0];
	}
	if (ids[0] !== ids[ids.length - 1]) ids.push(ids[0]);
	return ids;
}

/**
 * A loop of level and plumb locked points, tops and bottoms between sides (a circle or oval let
 * go, the stored o): each quarter is a quarter ellipse, handles along the locks QUARTER of the
 * half-axis long, exactly as circleCubics builds a live oval. Hobby's lengths depend only on the
 * angles, so they would make a tall oval a pill and make it jump the moment a circle is let go.
 * @param {Array<String>} ring - ids round the loop, first not repeated
 * @returns {Array<Array<[Number, Number]>>|null} null when the loop is not such a ring
 */
function ellipseRing(ring, pts) {
	const n = ring.length;
	if (n < 4 || n % 2) return null;
	const at = ring.map((id) => pts[id]);
	for (let i = 0; i < n; i++) {
		const pt = at[i];
		const prev = at[(i - 1 + n) % n];
		const next = at[(i + 1) % n];
		if (pt.kind === 'corner' || (pt.lock !== 'level' && pt.lock !== 'plumb')) return null;
		if (pt.aim && (Number.isFinite(Number(pt.aim.dir)) || pt.aim.tin !== undefined || pt.aim.tout !== undefined)) {
			return null;
		}
		if (pt.lock === next.lock) return null;
		// a top or bottom sits between sides left and right of it; a side between a top and a bottom
		const key = pt.lock === 'level' ? 'x' : 'y';
		if (!((Number(prev[key]) - Number(pt[key])) * (Number(next[key]) - Number(pt[key])) < 0)) return null;
	}
	return at.map((a, i) => {
		const b = at[(i + 1) % n];
		const [ax, ay, bx, by] = [Number(a.x), Number(a.y), Number(b.x), Number(b.y)];
		const h1 = a.lock === 'level' ? [ax + QUARTER * (bx - ax), ay] : [ax, ay + QUARTER * (by - ay)];
		const h2 = b.lock === 'level' ? [bx + QUARTER * (ax - bx), by] : [bx, by + QUARTER * (ay - by)];
		return [[ax, ay], h1, h2, [bx, by]];
	});
}

/**
 * The piece's parts as segments between two point ids.
 * @returns {Array<{type: String, a: String, b: String, bulge?: Number, tangent?: Boolean,
 *   curve?: Boolean, part: Number, first: Boolean, last: Boolean}>}
 */
function segmentsOf(piece, pts) {
	const segs = [];
	const parts = piece.parts || [];
	// a closed piece whose one part is a spline is a loop through its points (model.js)
	const loop = !!piece.closed && parts.length === 1 && parts[0]?.type === 'spline';
	parts.forEach((part, index) => {
		if (part.type === 'spline') {
			const ids = loopIds(part, pts, loop);
			for (let i = 0; i + 1 < ids.length; i++) {
				segs.push({
					type: 'hobby',
					a: ids[i],
					b: ids[i + 1],
					part: index,
					first: i === 0,
					last: i + 2 === ids.length,
				});
			}
		} else if (pts[part.from] && pts[part.to]) {
			const type = part.type === 'line' ? 'line' : part.type === 'arc' ? 'arc' : 'hobby';
			segs.push({
				type,
				a: part.from,
				b: part.to,
				bulge: Number(part.bulge) || 0,
				tangent: !!part.tangent,
				curve: part.type === 'curve',
				part: index,
				first: true,
				last: true,
			});
		}
	});
	return segs;
}

/**
 * @param {Object} piece - { parts, closed, circle? }
 * @param {Object} sketch - the sketch, or its points map
 * @returns {Array<Array<[Number, Number]>>}
 */
export function pieceSkeleton(piece, sketch) {
	const pts = pointsMap(sketch);
	if (!piece) return [];
	const ids = [];
	for (const part of piece.parts || []) {
		const list = part.type === 'spline' ? part.points || [] : [part.from, part.to];
		for (const id of list) if (pts[id] && ids[ids.length - 1] !== id) ids.push(id);
	}
	const ring =
		ids.length > 2 && (ids[0] === ids[ids.length - 1] || samePlace(pts[ids[0]], pts[ids[ids.length - 1]]))
			? ids.slice(0, -1)
			: ids;
	if (piece.circle) {
		return circleCubics(
			piece.circle,
			ring.map((id) => xy(pts[id]))
		);
	}
	const parts = piece.parts || [];
	if (piece.closed && parts.length === 1 && parts[0]?.type === 'spline') {
		const oval = ellipseRing(ring, pts);
		if (oval) return oval;
	}
	const segs = segmentsOf(piece, pts);
	if (!segs.length) {
		if (!ids.length) return [];
		const p = xy(pts[ids[0]]);
		return [[p, [...p], [...p], [...p]]];
	}
	return buildSegments(segs, pts, !!piece.closed).flat();
}

/**
 * S4: pieceSkeleton part by part.
 * @param {Object} piece
 * @param {Object} sketch - the sketch, or its points map
 * @returns {Array<{part: Number, a: String | null, b: String | null, cubics: Array}>}
 */
export function piecePartCubics(piece, sketch) {
	const pts = pointsMap(sketch);
	if (!piece) return [];
	const parts = piece.parts || [];
	const whole = () => {
		const cubics = pieceSkeleton(piece, sketch);
		return cubics.length ? [{ part: 0, a: null, b: null, cubics }] : [];
	};
	if (piece.circle) return whole();
	if (piece.closed && parts.length === 1 && parts[0]?.type === 'spline') {
		const ring = loopIds(parts[0], pts, true);
		if (ellipseRing(ring.slice(0, -1), pts)) return whole();
	}
	const segs = segmentsOf(piece, pts);
	if (!segs.length) return whole();
	const out = buildSegments(segs, pts, !!piece.closed);
	return segs.map((seg, i) => ({ part: seg.part, a: seg.a, b: seg.b, cubics: out[i] || [] }));
}

/**
 * @returns {Array<Array<[Number, Number]>>}
 */
function buildSegments(segs, pts, closedFlag) {
	const n = segs.length;
	const last = segs[n - 1];
	const closed =
		closedFlag &&
		(last.b === segs[0].a ||
			(pts[last.b].x === pts[segs[0].a].x && pts[last.b].y === pts[segs[0].a].y));
	const node = (i) => (i === n && !closed ? last.b : segs[((i % n) + n) % n].a);
	const P = (i) => xy(pts[node(i)]);
	// segment index before / after node i (null at an open end)
	const before = (i) => (i > 0 ? segs[i - 1] : closed ? segs[n - 1] : null);
	const after = (i) => (i < n ? segs[i % n] : closed ? segs[0] : null);
	const nodeCount = closed ? n : n + 1;

	// is the node a join between parts, and is it smooth
	const smooth = [];
	for (let i = 0; i < nodeCount; i++) {
		const prev = before(i);
		const next = after(i);
		const pt = pts[node(i)];
		if (!prev || !next) smooth[i] = false;
		else if (prev.part === next.part && prev.type === 'hobby' && !prev.curve) {
			smooth[i] = pt.kind !== 'corner';
		} else {
			// a closed piece's first part, when a tangent Arc, is not tangent to the part that
			// closes the loop: the seam is a corner unless the point is smooth
			const tangentNext = next.type === 'arc' && next.tangent && !(closed && i === 0);
			smooth[i] = pt.kind === 'smooth' || tangentNext || !!prev.curve || !!next.curve;
		}
	}

	const lineDir = (i) => {
		const a = P(i);
		const b = P(i + 1);
		return Math.atan2(b[1] - a[1], b[0] - a[0]) / DEG;
	};

	// give way: an Arc on its stored bulge whose second end is a smooth join into a Line it does
	// not already meet is built as a curve (a tangent Arc is settled as it is built, below)
	const kind = segs.map((s) => s.type);
	const startGiven = [];
	segs.forEach((s, i) => {
		const endNode = closed ? (i + 1) % n : i + 1;
		const nextIndex = i + 1 === n && closed ? 0 : i + 1;
		const next = after(nextIndex);
		if (s.type !== 'arc' || !smooth[endNode] || !next || next.type !== 'line') return;
		if (s.tangent && smooth[i]) return;
		if (apart(arcDirs(P(i), P(i + 1), s.bulge).end, lineDir(nextIndex)) <= FITS) return;
		kind[i] = 'hobby';
		if (!smooth[i]) startGiven[i] = arcDirs(P(i), P(i + 1), s.bulge).start;
	});
	// the way the piece runs at a node (for picking a lock's sense)
	const way = (i) => {
		const a = before(i) ? P(i - 1) : P(i);
		const b = after(i) ? P(i + 1) : P(i);
		if (a[0] === b[0] && a[1] === b[1]) return null;
		return Math.atan2(b[1] - a[1], b[0] - a[0]) / DEG;
	};
	const segIndex = (i) => ((i % n) + n) % n;

	// fixed directions at nodes
	const dirAt = [];
	for (let i = 0; i < nodeCount; i++) {
		const pt = pts[node(i)];
		const aim = pt.aim && Number.isFinite(Number(pt.aim.dir)) ? Number(pt.aim.dir) : null;
		dirAt[i] = null;
		if (!smooth[i]) {
			// a free end can still be aimed by its grip
			if ((!before(i) || !after(i)) && aim !== null) dirAt[i] = alongRun(aim, way(i));
			continue;
		}
		const pi = segIndex(i - 1);
		const ni = segIndex(i);
		if (kind[pi] === 'line') dirAt[i] = lineDir(pi);
		else if (kind[ni] === 'line') dirAt[i] = lineDir(ni);
		else if (kind[pi] === 'arc' && !segs[pi].tangent) dirAt[i] = arcDirs(P(pi), P(pi + 1), segs[pi].bulge).end;
		else if (kind[ni] === 'arc' && !segs[ni].tangent) dirAt[i] = arcDirs(P(ni), P(ni + 1), segs[ni].bulge).start;
		else if (aim !== null) dirAt[i] = alongRun(aim, way(i));
		else if (pt.lock === 'level' || pt.lock === 'plumb') dirAt[i] = lockDir(pt.lock, way(i));
	}

	const isBreak = (i) => !smooth[i] || dirAt[i] !== null;
	const out = new Array(n);
	const stored = [];

	// closed and nothing to start from: all one Hobby loop, or tangent arcs that keep their bulge
	let start = 0;
	if (closed) {
		start = -1;
		for (let i = 0; i < n; i++) if (isBreak(i)) { start = i; break; }
		if (start < 0) {
			if (kind.every((k) => k === 'hobby')) {
				const ring = [];
				for (let i = 0; i < n; i++) ring.push(hobbyPoint(pts[node(i)], P(i), null, false));
				return hobby(ring, { cyclic: true }).map((cubic) => [cubic]);
			}
			// a loop of splines and tangent arcs only: the first arc in drawing order keeps its
			// stored bulge, the rest follow it tangent, and the part that closes the loop back
			// into it is tangent at both ends (a tangent Arc there becomes a curve, below)
			start = kind.findIndex((k) => k === 'arc');
			stored[start] = true;
			dirAt[start] = arcDirs(P(start), P(start + 1), segs[start].bulge).start;
		}
	}

	/**
	 * A tangent Arc leaving node i along dir. When its end is a smooth join that already has a
	 * direction (a Line, a stored Arc, an aim or a lock after it, or the start of the loop) and
	 * the arc does not meet it within FITS, or when no arc can leave along dir (its end lies
	 * nearly behind, arc.js MAX_TANGENT_SWEEP), it is a curve with Hobby's lengths instead.
	 */
	const tangentArc = (i, dir) => {
		const endNode = closed ? (i + 1) % n : i + 1;
		const endDir = smooth[endNode] && after(i + 1 === n && closed ? 0 : i + 1) ? dirAt[endNode] : null;
		const bulge = tangentBulge(P(i), P(i + 1), dir);
		if (bulge !== null) {
			const arc = arcCubics(P(i), P(i + 1), bulge);
			if (endDir === null || apart(endDirection(arc[arc.length - 1]), endDir) <= FITS) return arc;
		}
		const from = pts[node(i)];
		const to = pts[node(endNode)];
		if (endDir !== null) {
			return [curveCubic(P(i), P(i + 1), dir, endDir, { tout: from.aim?.tout ?? 1, tin: to.aim?.tin ?? 1 })];
		}
		return hobby([hobbyPoint(from, P(i), dir, false), hobbyPoint(to, P(i + 1), null, false)]);
	};

	let incoming = null; // the direction the curve arrives at the current node
	let j = 0;
	while (j < n) {
		const i = (start + j) % n;
		const s = segs[i];
		if (kind[i] === 'line') {
			out[i] = arcCubics(P(i), P(i + 1), 0);
			incoming = lineDir(i);
			j++;
		} else if (kind[i] === 'arc') {
			let cubics = arcCubics(P(i), P(i + 1), s.bulge);
			const dir = dirAt[i] !== null ? dirAt[i] : j > 0 ? incoming : null;
			if (s.tangent && smooth[i] && !stored[i] && dir !== null) {
				cubics = tangentArc(i, dir);
			}
			out[i] = cubics;
			incoming = endDirection(cubics[cubics.length - 1]);
			j++;
		} else {
			// a Hobby run: hobby segments until a corner or a non-hobby segment
			const runStart = j;
			let k = j;
			while (k < n && kind[(start + k) % n] === 'hobby' && (k === runStart || smooth[(start + k) % n])) k++;
			const first = (start + runStart) % n;
			const firstNode = first;
			const run = [];
			for (let m = runStart; m <= k; m++) {
				const nodeIdx = closed ? (start + m) % n : start + m;
				run.push({ nodeIdx, at: P(nodeIdx), pt: pts[node(nodeIdx)] });
			}
			// end conditions
			let sDir = dirAt[firstNode];
			if (sDir === null && startGiven[first] !== undefined) sDir = startGiven[first];
			if (sDir === null && smooth[firstNode] && runStart > 0 && incoming !== null) sDir = incoming;
			const endIdx = run[run.length - 1].nodeIdx;
			const eDir = dirAt[endIdx];
			const list = run.map((r, m) => {
				const isEnd = m === 0 || m === run.length - 1;
				const dir = m === 0 ? sDir : m === run.length - 1 ? eDir : dirAt[r.nodeIdx];
				return hobbyPoint(r.pt, r.at, dir, isEnd ? false : !smooth[r.nodeIdx]);
			});
			const cubics = hobby(list);
			cubics.forEach((cubic, m) => {
				out[(start + runStart + m) % n] = [cubic];
			});
			incoming = endDirection(cubics[cubics.length - 1]);
			j = k;
		}
	}
	return out;
}

/**
 * An aim read the way the piece runs (a grip turned past a right angle from the run, or a piece
 * reversed without turning its aims, would tie the curve in a knot), the way lockDir reads a lock.
 * @param {Number} aim - degrees
 * @param {Number|null} way - degrees, the way the piece runs there
 * @returns {Number}
 */
function alongRun(aim, way) {
	if (way === null || apart(aim, way) <= 90) return aim;
	return aim + 180;
}

/**
 * @returns {{x: Number, y: Number, dir: Number|null, tin: Number, tout: Number, corner: Boolean}}
 */
function hobbyPoint(pt, at, dir, corner) {
	return {
		x: at[0],
		y: at[1],
		dir,
		tin: pt.aim?.tin ?? 1,
		tout: pt.aim?.tout ?? 1,
		corner,
	};
}
