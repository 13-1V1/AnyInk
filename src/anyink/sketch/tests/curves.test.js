// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 curves.js: a sketch piece as the Brush skeleton [[p0, h1, h2, p3], ...]. Corners stay
	corners, smooth points are smooth, a lock or an aim sets the direction, a Line never moves or
	turns and the part before a tangent join into a Line turns to meet it.
*/
import { describe, expect, it } from 'vitest';
import { arcCubics, arcGeometry, tangentBulge } from '../arc.js';
import { circleCubics, endDirection, pieceSkeleton, startDirection } from '../curves.js';
import { hobby } from '../hobby.js';
import { fullSketch } from './fixtures/full_sketch.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const apart = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

function cubicAt([p0, p1, p2, p3], t) {
	const u = 1 - t;
	return [0, 1].map(
		(k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]
	);
}

/** The joins between neighboring cubics: { gap, turn } (turn in degrees) */
function joins(cubics, closed) {
	const out = [];
	const last = closed ? cubics.length : cubics.length - 1;
	for (let i = 0; i < last; i++) {
		const a = cubics[i];
		const b = cubics[(i + 1) % cubics.length];
		out.push({ gap: dist(a[3], b[0]), turn: apart(endDirection(a), startDirection(b)) });
	}
	return out;
}

const line = (from, to) => ({ type: 'line', from, to });
const spline = (...points) => ({ type: 'spline', points });

describe('pieceSkeleton: the basics', () => {
	it('a Line is one straight cubic, its ends exactly where he clicked', () => {
		const points = { a: { x: 10, y: 0, kind: 'corner' }, b: { x: 10, y: 500, kind: 'corner' } };
		const out = pieceSkeleton({ closed: false, parts: [line('a', 'b')] }, { points });
		expect(out).toHaveLength(1);
		expect(out[0][0]).toEqual([10, 0]);
		expect(out[0][3]).toEqual([10, 500]);
		expect(out[0][1][0]).toBe(10);
		expect(out[0][2][0]).toBe(10);
	});

	it('takes the sketch or just its points', () => {
		const points = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
		const piece = { closed: false, parts: [line('a', 'b')] };
		expect(pieceSkeleton(piece, points)).toEqual(pieceSkeleton(piece, { points }));
	});

	it('a one-point piece is a dot; a piece with nothing in it is nothing', () => {
		const points = { d: { x: 300, y: 650, kind: 'corner' } };
		expect(pieceSkeleton({ closed: false, parts: [spline('d')] }, points)).toEqual([
			[
				[300, 650],
				[300, 650],
				[300, 650],
				[300, 650],
			],
		]);
		expect(pieceSkeleton({ closed: false, parts: [] }, points)).toEqual([]);
		expect(pieceSkeleton(null, points)).toEqual([]);
	});

	it('a rectangle of four Lines is a closed loop with four corners', () => {
		const points = {
			a: { x: 0, y: 0, kind: 'corner' },
			b: { x: 400, y: 0, kind: 'corner' },
			c: { x: 400, y: 300, kind: 'corner' },
			d: { x: 0, y: 300, kind: 'corner' },
		};
		const out = pieceSkeleton(
			{ closed: true, parts: [line('a', 'b'), line('b', 'c'), line('c', 'd'), line('d', 'a')] },
			points
		);
		expect(out).toHaveLength(4);
		for (const j of joins(out, true)) {
			expect(j.gap).toBe(0);
			expect(j.turn).toBeCloseTo(90, 9);
		}
	});

	it('every piece of a sketch that uses every field builds, joined end to end', () => {
		const sketch = fullSketch();
		for (const piece of sketch.pieces) {
			const out = pieceSkeleton(piece, sketch);
			for (const cubic of out) for (const p of cubic) expect(p.every(Number.isFinite)).toBe(true);
			for (const j of joins(out, false)) expect(j.gap).toBeLessThan(1e-9);
			if (piece.closed && out.length) expect(dist(out[out.length - 1][3], out[0][0])).toBeLessThan(1e-9);
		}
	});
});

describe('pieceSkeleton: corners and smooth points', () => {
	it('a Spline runs smoothly through its points and is the Hobby curve', () => {
		const points = {
			a: { x: 0, y: 0, kind: 'smooth' },
			b: { x: 80, y: 160, kind: 'smooth' },
			c: { x: 240, y: 180, kind: 'smooth' },
			d: { x: 330, y: 40, kind: 'smooth' },
		};
		const out = pieceSkeleton({ closed: false, parts: [spline('a', 'b', 'c', 'd')] }, points);
		expect(out).toEqual(hobby(Object.values(points)));
		for (const j of joins(out, false)) expect(j.turn).toBeLessThan(1e-6);
	});

	it('a corner point inside a Spline stays a corner', () => {
		const points = {
			a: { x: 0, y: 0 },
			b: { x: 100, y: 150, kind: 'corner' },
			c: { x: 220, y: 60 },
			d: { x: 300, y: 160 },
		};
		const out = pieceSkeleton({ closed: false, parts: [spline('a', 'b', 'c', 'd')] }, points);
		const [first, second] = joins(out, false);
		expect(first.turn).toBeGreaterThan(20);
		expect(second.turn).toBeLessThan(1e-6);
	});

	it('two parts meet at a corner unless the point is smooth', () => {
		const make = (kind) => ({
			a: { x: 0, y: 0 },
			b: { x: 100, y: 100 },
			c: { x: 200, y: 160, kind },
			d: { x: 300, y: 80 },
			e: { x: 420, y: 140 },
		});
		const piece = { closed: false, parts: [spline('a', 'b', 'c'), spline('c', 'd', 'e')] };
		const cornered = joins(pieceSkeleton(piece, make('corner')), false);
		const smooth = joins(pieceSkeleton(piece, make('smooth')), false);
		expect(cornered[1].turn).toBeGreaterThan(5);
		// smooth: the two Splines are one run through the join
		for (const j of smooth) expect(j.turn).toBeLessThan(1e-6);
	});

	it('a closed piece whose one part is a Spline is a smooth loop, the first point too', () => {
		const points = {
			a: { x: 0, y: 0 },
			b: { x: 300, y: 20 },
			c: { x: 280, y: 260 },
			d: { x: 20, y: 240 },
		};
		const out = pieceSkeleton({ closed: true, parts: [spline('a', 'b', 'c', 'd')] }, points);
		expect(out).toHaveLength(4);
		for (const j of joins(out, true)) {
			expect(j.gap).toBeLessThan(1e-9);
			expect(j.turn).toBeLessThan(1e-6);
		}
	});
});

describe('pieceSkeleton: locks and aims', () => {
	it('a level lock makes the curve pass level, the way the piece runs', () => {
		const points = {
			a: { x: 0, y: 0 },
			top: { x: 120, y: 300, kind: 'smooth', lock: 'level' },
			c: { x: 300, y: 80 },
		};
		const out = pieceSkeleton({ closed: false, parts: [spline('a', 'top', 'c')] }, points);
		expect(apart(endDirection(out[0]), 0)).toBeLessThan(1e-9);
		expect(apart(startDirection(out[1]), 0)).toBeLessThan(1e-9);
		// running right to left it passes level the other way
		const back = pieceSkeleton({ closed: false, parts: [spline('c', 'top', 'a')] }, points);
		expect(apart(endDirection(back[0]), 180)).toBeLessThan(1e-9);
	});

	it('a plumb lock makes the curve pass straight up or down', () => {
		const points = {
			a: { x: 300, y: 0 },
			side: { x: 0, y: 200, kind: 'smooth', lock: 'plumb' },
			c: { x: 260, y: 420 },
		};
		const out = pieceSkeleton({ closed: false, parts: [spline('a', 'side', 'c')] }, points);
		expect(apart(endDirection(out[0]), 90)).toBeLessThan(1e-9);
	});

	it('an aim sets the direction within 0.1 degree and its tensions shorten the handles', () => {
		const points = {
			a: { x: 0, y: 0 },
			m: { x: 150, y: 150, kind: 'smooth', aim: { dir: 20, tin: 1, tout: 1 } },
			c: { x: 300, y: 0 },
		};
		const piece = { closed: false, parts: [spline('a', 'm', 'c')] };
		const loose = pieceSkeleton(piece, points);
		expect(apart(endDirection(loose[0]), 20)).toBeLessThan(0.1);
		expect(apart(startDirection(loose[1]), 20)).toBeLessThan(0.1);
		points.m.aim = { dir: 20, tin: 3, tout: 2 };
		const tight = pieceSkeleton(piece, points);
		expect(dist(tight[0][2], tight[0][3])).toBeLessThan(dist(loose[0][2], loose[0][3]));
		expect(dist(tight[1][0], tight[1][1])).toBeLessThan(dist(loose[1][0], loose[1][1]));
	});

	it('an open end can be aimed by its grip', () => {
		const points = {
			a: { x: 0, y: 0, aim: { dir: 90 } },
			b: { x: 200, y: 100 },
			c: { x: 300, y: 0 },
		};
		const out = pieceSkeleton({ closed: false, parts: [spline('a', 'b', 'c')] }, points);
		expect(apart(startDirection(out[0]), 90)).toBeLessThan(0.1);
	});
});

describe('pieceSkeleton: Lines never move, the part before gives way', () => {
	it('a Spline ending at a smooth join into a Line turns to meet it; the Line stays put', () => {
		const points = {
			a: { x: 0, y: 0 },
			b: { x: 100, y: 180 },
			j: { x: 250, y: 200, kind: 'smooth' },
			e: { x: 250, y: 500, kind: 'corner' },
		};
		const out = pieceSkeleton({ closed: false, parts: [spline('a', 'b', 'j'), line('j', 'e')] }, points);
		const lineCubic = out[out.length - 1];
		expect(lineCubic[0]).toEqual([250, 200]);
		expect(lineCubic[3]).toEqual([250, 500]);
		expect(apart(endDirection(out[1]), 90)).toBeLessThan(1e-9);
	});

	it('a Line after a smooth point hands its direction to the Spline after it too', () => {
		const points = {
			a: { x: 0, y: 0 },
			j: { x: 200, y: 0, kind: 'smooth' },
			b: { x: 300, y: 100 },
			c: { x: 250, y: 250 },
		};
		const out = pieceSkeleton({ closed: false, parts: [line('a', 'j'), spline('j', 'b', 'c')] }, points);
		expect(apart(startDirection(out[1]), 0)).toBeLessThan(1e-9);
	});

	it('an Arc followed by a tangent Line is built as a curve tangent at both ends', () => {
		const points = {
			a: { x: 0, y: 0, kind: 'corner' },
			j: { x: 200, y: 100, kind: 'smooth' },
			e: { x: 400, y: 100, kind: 'corner' },
		};
		const bulge = 0.3;
		const out = pieceSkeleton(
			{ closed: false, parts: [{ type: 'arc', from: 'a', to: 'j', bulge }, line('j', 'e')] },
			points
		);
		expect(out).toHaveLength(2);
		// meets the Line level, keeps the arc's own start direction at its corner
		expect(apart(endDirection(out[0]), 0)).toBeLessThan(1e-9);
		const arcStart = arcGeometry([0, 0], [200, 100], bulge).startDir;
		expect(apart(startDirection(out[0]), arcStart)).toBeLessThan(1e-9);
		expect(out[1][0]).toEqual([200, 100]);
		expect(out[1][3]).toEqual([400, 100]);
	});

	it('an Arc at a corner into a Line stays a true arc', () => {
		const points = {
			a: { x: 0, y: 0 },
			j: { x: 200, y: 100, kind: 'corner' },
			e: { x: 400, y: 100 },
		};
		const out = pieceSkeleton(
			{ closed: false, parts: [{ type: 'arc', from: 'a', to: 'j', bulge: 0.3 }, line('j', 'e')] },
			points
		);
		expect(out.slice(0, -1)).toEqual(arcCubics([0, 0], [200, 100], 0.3));
	});

	it('a tangent Arc leaves a Line along it (SolidWorks’ tangent arc)', () => {
		const points = {
			a: { x: 0, y: 0, kind: 'corner' },
			j: { x: 0, y: 400 },
			e: { x: 100, y: 400, kind: 'corner' },
		};
		const out = pieceSkeleton(
			{ closed: false, parts: [line('a', 'j'), { type: 'arc', from: 'j', to: 'e', bulge: 0.1, tangent: true }] },
			points
		);
		expect(out.slice(1)).toEqual(arcCubics([0, 400], [100, 400], tangentBulge([0, 400], [100, 400], 90)));
		expect(apart(startDirection(out[1]), 90)).toBeLessThan(1e-9);
	});

	it('the n arch as Line + curve + Line, stems 100 units apart, is smooth at both stem tops', () => {
		const points = {
			f1: { x: 0, y: 0, kind: 'corner' },
			t1: { x: 0, y: 400, kind: 'smooth' },
			t2: { x: 100, y: 400, kind: 'smooth' },
			f2: { x: 100, y: 0, kind: 'corner' },
		};
		const out = pieceSkeleton(
			{ closed: false, parts: [line('f1', 't1'), { type: 'curve', from: 't1', to: 't2' }, line('t2', 'f2')] },
			points
		);
		expect(out).toHaveLength(3);
		for (const j of joins(out, false)) {
			expect(j.gap).toBe(0);
			expect(j.turn).toBeLessThan(1e-9);
		}
		expect(cubicAt(out[1], 0.5)[1]).toBeCloseTo(450, 9);
		// unequal stems: still smooth on both sides
		points.t2.y = 300;
		for (const j of joins(pieceSkeleton(
			{ closed: false, parts: [line('f1', 't1'), { type: 'curve', from: 't1', to: 't2' }, line('t2', 'f2')] },
			points
		), false)) {
			expect(j.turn).toBeLessThan(1e-9);
		}
	});

	it('a curve between two Splines flows with them as one run', () => {
		const points = {
			a: { x: 0, y: 0 },
			b: { x: 80, y: 120 },
			c: { x: 200, y: 160 },
			d: { x: 320, y: 140 },
			e: { x: 400, y: 20 },
		};
		const out = pieceSkeleton(
			{ closed: false, parts: [spline('a', 'b', 'c'), { type: 'curve', from: 'c', to: 'd' }, spline('d', 'e')] },
			points
		);
		for (const j of joins(out, false)) expect(j.turn).toBeLessThan(1e-6);
	});
});

describe('pieceSkeleton: circles', () => {
	it('a live circle is the true circle through its points, within 0.03 % of its size', () => {
		const sketch = fullSketch();
		const ring = sketch.pieces.find((p) => p.circle);
		const out = pieceSkeleton(ring, sketch);
		const { cx, cy, rx } = ring.circle;
		expect(out).toHaveLength(4);
		for (const cubic of out) {
			for (let t = 0; t <= 1; t += 0.01) {
				expect(Math.abs(dist(cubicAt(cubic, t), [cx, cy]) - rx) / rx).toBeLessThan(0.0003);
			}
		}
		for (const j of joins(out, true)) expect(j.turn).toBeLessThan(1e-6);
	});

	it('an oval keeps its two sizes; with no points it runs counterclockwise from the right', () => {
		const out = circleCubics({ cx: 0, cy: 0, rx: 200, ry: 100 });
		expect(out).toHaveLength(4);
		expect(out[0][0]).toEqual([200, 0]);
		const top = cubicAt(out[0], 1);
		expect(top[0]).toBeCloseTo(0, 9);
		expect(top[1]).toBeCloseTo(100, 9);
		for (const cubic of out) {
			for (let t = 0; t <= 1; t += 0.05) {
				const [x, y] = cubicAt(cubic, t);
				expect(Math.abs((x / 200) ** 2 + (y / 100) ** 2 - 1)).toBeLessThan(0.001);
			}
		}
	});

	it('runs the way its points go round (clockwise points, clockwise ring)', () => {
		const points = [
			[100, 0],
			[0, -100],
			[-100, 0],
			[0, 100],
		];
		const out = circleCubics({ cx: 0, cy: 0, rx: 100, ry: 100 }, points);
		expect(out).toHaveLength(4);
		const quarter = cubicAt(out[0], 0.5);
		expect(quarter[0]).toBeGreaterThan(0);
		expect(quarter[1]).toBeLessThan(0);
	});
});

// Fix track (critic findings, 10/16/2026): each test below failed before its fix.
const arcPart = (from, to, bulge, tangent = false) => ({ type: 'arc', from, to, bulge, tangent });

/** Every point of a list of cubics, sampled */
function samples(cubics, steps = 200) {
	const out = [];
	for (const cubic of cubics) for (let i = 0; i <= steps; i++) out.push(cubicAt(cubic, i / steps));
	return out;
}

/** The farthest any sampled point of a lies from the curve b (sampled densely) */
function farthestOff(a, b) {
	const ref = samples(b, 800);
	let worst = 0;
	for (const p of samples(a, 100)) {
		let best = Infinity;
		for (const q of ref) best = Math.min(best, dist(p, q));
		worst = Math.max(worst, best);
	}
	return worst;
}

/** How many times the sampled curve crosses itself */
function selfCrossings(cubics) {
	const poly = samples(cubics, 60);
	const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
	const cross = (a, b, c, d) => side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
	let count = 0;
	for (let i = 0; i + 1 < poly.length; i++) {
		for (let j = i + 2; j + 1 < poly.length; j++) {
			if (cross(poly[i], poly[i + 1], poly[j], poly[j + 1])) count++;
		}
	}
	return count;
}

describe('fix: closed loops of tangent arcs have no hidden kinks', () => {
	const piece = {
		closed: true,
		parts: [arcPart('a', 'c', 0.6, true), arcPart('c', 'a', 0.6, true)],
	};
	it('both points corner: the seam is the corner, the second arc leaves the first tangent', () => {
		const points = { a: { x: 0, y: 0, kind: 'corner' }, c: { x: 200, y: 0, kind: 'corner' } };
		const out = pieceSkeleton(piece, points);
		const first = arcCubics([0, 0], [200, 0], 0.6).length;
		expect(joins(out, true)[first - 1].turn).toBeLessThan(1e-6);
		expect(out.slice(0, first)).toEqual(arcCubics([0, 0], [200, 0], 0.6));
	});

	it('both points smooth: smooth everywhere, the closing arc becomes a curve tangent at both ends', () => {
		const points = { a: { x: 0, y: 0, kind: 'smooth' }, c: { x: 200, y: 0, kind: 'smooth' } };
		const out = pieceSkeleton(piece, points);
		for (const j of joins(out, true)) {
			expect(j.gap).toBeLessThan(1e-9);
			expect(j.turn).toBeLessThan(1e-6);
		}
	});
});

describe('fix: a tangent arc whose end lies behind it does not blow up', () => {
	const build = (e) =>
		pieceSkeleton(
			{ closed: false, parts: [line('a', 'j'), arcPart('j', 'e', 0.2, true)] },
			{ a: { x: 200, y: 0, kind: 'corner' }, j: { x: 100, y: 0 }, e: { ...e, kind: 'corner' } }
		);
	it('179 degrees off the chord: a curve leaving tangent, within a few chords of the join', () => {
		const out = build({ x: 200, y: 1.75 });
		expect(joins(out, false)[0].turn).toBeLessThan(1e-6);
		for (const p of samples(out)) expect(dist(p, [100, 0])).toBeLessThan(400);
		expect(out.at(-1)[3]).toEqual([200, 1.75]);
	});

	it('exactly straight back: still tangent, no half-degree kink', () => {
		const out = build({ x: 300, y: 0 });
		expect(joins(out, false)[0].turn).toBeLessThan(1e-6);
		for (const p of samples(out)) expect(dist(p, [100, 0])).toBeLessThan(800);
	});
});

describe('fix: a closed spline whose last point sits on its first', () => {
	it('builds the same clean loop as listing the first point again', () => {
		const at = { a: [0, 0], b: [300, -50], c: [400, 300], d: [100, 400] };
		const points = {};
		for (const [id, [x, y]] of Object.entries(at)) points[id] = { x, y };
		points.e = { x: 0, y: 0 };
		const twin = pieceSkeleton({ closed: true, parts: [spline('a', 'b', 'c', 'd', 'e')] }, points);
		const same = pieceSkeleton({ closed: true, parts: [spline('a', 'b', 'c', 'd', 'a')] }, points);
		expect(twin).toHaveLength(4);
		expect(twin).toEqual(same);
		for (const j of joins(twin, true)) expect(j.turn).toBeLessThan(1e-6);
	});
});

describe('fix: a circle let go keeps its oval shape', () => {
	const ovalPoints = (dx = 0) => ({
		top: { x: 300, y: 950, kind: 'smooth', lock: 'level' },
		left: { x: 150, y: 500, kind: 'smooth', lock: 'plumb' },
		bottom: { x: 300, y: 50, kind: 'smooth', lock: 'level' },
		right: { x: 450 + dx, y: 500, kind: 'smooth', lock: 'plumb' },
	});
	const ring = { closed: true, parts: [spline('top', 'left', 'bottom', 'right')] };

	it('a tall oval moves about 1 unit when one side is dragged 1 unit (circle dropped)', () => {
		const live = pieceSkeleton(
			{ ...ring, circle: { cx: 300, cy: 500, rx: 150, ry: 450 } },
			ovalPoints()
		);
		const dropped = pieceSkeleton(ring, ovalPoints(1));
		expect(farthestOff(dropped, live)).toBeLessThan(1.05);
		expect(farthestOff(live, dropped)).toBeLessThan(1.05);
	});

	it('the 4-point o is the ellipse through its four extremes, not a pill', () => {
		const points = {
			top: { x: 330, y: 1081, kind: 'smooth', lock: 'level' },
			left: { x: 80, y: 550, kind: 'smooth', lock: 'plumb' },
			bottom: { x: 330, y: 19, kind: 'smooth', lock: 'level' },
			right: { x: 580, y: 550, kind: 'smooth', lock: 'plumb' },
		};
		const out = pieceSkeleton(ring, points);
		const rx = 250;
		const ry = 531;
		for (const [x, y] of samples(out)) {
			const k = Math.hypot((x - 330) / rx, (y - 550) / ry);
			expect(Math.abs(k - 1) * Math.max(rx, ry)).toBeLessThan(0.5);
		}
		for (const j of joins(out, true)) expect(j.turn).toBeLessThan(1e-6);
	});

	it('a loop whose points are not all locked tops and sides stays a Hobby loop', () => {
		const points = ovalPoints();
		points.left.lock = null;
		const out = pieceSkeleton(ring, points);
		const loop = hobby(
			[points.top, points.left, points.bottom, points.right].map((p) => ({
				x: p.x,
				y: p.y,
				dir: p.lock === 'level' ? (p === points.top ? 180 : 0) : p.lock === 'plumb' ? 90 : null,
			})),
			{ cyclic: true }
		);
		expect(out).toHaveLength(4);
		out.forEach((cubic, i) =>
			cubic.forEach((p, k) => expect(dist(p, loop[i][k])).toBeLessThan(1e-6))
		);
	});
});

describe('fix: a tangent Arc between Lines that already fits stays a true arc', () => {
	it('the slot end: Line up, tangent Arc over (bulge -1), Line down keeps the R150 arc', () => {
		const points = {
			a: { x: 0, y: 0, kind: 'corner' },
			j: { x: 0, y: 500 },
			k: { x: 300, y: 500, kind: 'smooth' },
			e: { x: 300, y: 0, kind: 'corner' },
		};
		const out = pieceSkeleton(
			{ closed: false, parts: [line('a', 'j'), arcPart('j', 'k', -1, true), line('k', 'e')] },
			points
		);
		const arc = arcCubics([0, 500], [300, 500], -1);
		expect(out.slice(1, 1 + arc.length)).toEqual(arc);
		for (const j of joins(out, false)) expect(j.turn).toBeLessThan(1e-6);
	});

	it('a stored Arc whose end already meets the Line stays an arc; one that does not gives way', () => {
		const points = {
			a: { x: 0, y: 0, kind: 'corner' },
			k: { x: 300, y: 0, kind: 'smooth' },
			e: { x: 300, y: -400, kind: 'corner' },
		};
		const piece = (bulge) => ({ closed: false, parts: [arcPart('a', 'k', bulge), line('k', 'e')] });
		expect(pieceSkeleton(piece(-1), points).slice(0, 2)).toEqual(arcCubics([0, 0], [300, 0], -1));
		const bent = pieceSkeleton(piece(-0.5), points);
		expect(bent).toHaveLength(2);
		expect(joins(bent, false)[0].turn).toBeLessThan(1e-6);
	});
});

describe('fix: an aim pointing back against the run', () => {
	it('is read the way the piece runs: no knot, and a reversed piece builds the same curve', () => {
		const at = { a: [0, 0], b: [200, 30], c: [400, 0] };
		const points = {};
		for (const [id, [x, y]] of Object.entries(at)) points[id] = { x, y, kind: 'smooth' };
		points.b.aim = { dir: 0 };
		const forward = pieceSkeleton({ closed: false, parts: [spline('a', 'b', 'c')] }, points);
		const back = pieceSkeleton({ closed: false, parts: [spline('c', 'b', 'a')] }, points);
		expect(selfCrossings(back)).toBe(0);
		const reversed = back
			.slice()
			.reverse()
			.map((cubic) => cubic.slice().reverse());
		for (let i = 0; i < forward.length; i++) {
			for (let k = 0; k < 4; k++) expect(dist(forward[i][k], reversed[i][k])).toBeLessThan(1e-9);
		}
		// an aim straight back on a straight row is read along the row
		points.b = { x: 200, y: 0, kind: 'smooth', aim: { dir: 180 } };
		const row = pieceSkeleton({ closed: false, parts: [spline('a', 'b', 'c')] }, points);
		expect(selfCrossings(row)).toBe(0);
		for (const [, y] of samples(row)) expect(Math.abs(y)).toBeLessThan(1e-9);
	});
});
