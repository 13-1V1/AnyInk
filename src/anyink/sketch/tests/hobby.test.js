// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 hobby.js: the Spline's curve through points (Knuth / Hobby, as MetaPost makes it).
	References: fixtures/hobby_reference.json, made by fixtures/hobby_reference.mjs (a port of
	mp.w's solve_choices with its own u / v / w elimination, no MetaPost on the machine) and, for
	the cases with no direction or tension, hobby-curve 0.2.1's own numbers. The .mp file beside
	it is the same paths for MetaPost, so the fixture can be remade where mpost exists.
*/
import { describe, expect, it } from 'vitest';
import {
	GRIP_RANGE,
	MAX_TENSION,
	MIN_TENSION,
	curlRatio,
	curvatureRow,
	gripPull,
	gripTension,
	hobby,
	reduceAngle,
	velocity,
} from '../hobby.js';
import reference from './fixtures/hobby_reference.json';

const DEG = Math.PI / 180;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const angleOf = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]);
const apartDeg = (a, b) => Math.abs(reduceAngle((a - b) * DEG)) / DEG;
const maxGap = (a, b) =>
	Math.max(...a.flatMap((cubic, i) => cubic.map((p, j) => dist(p, b[i][j]))));

/** A small seeded random, so the "any path" tests are the same every run */
function seeded(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

/** theta and phi of every piece, read back from the cubics (radians) */
function anglesOf(cubics) {
	return cubics.map(([p0, h1, h2, p3]) => {
		const chord = angleOf(p0, p3);
		return { theta: reduceAngle(angleOf(p0, h1) - chord), phi: reduceAngle(chord - angleOf(h2, p3)) };
	});
}

describe('hobby: through the points', () => {
	it('passes through every point, open and closed, one cubic per piece', () => {
		for (const c of reference.cases) {
			const cubics = hobby(c.points, { cyclic: c.cyclic });
			const n = c.points.length;
			expect(cubics).toHaveLength(c.cyclic ? n : n - 1);
			cubics.forEach((cubic, i) => {
				expect(dist(cubic[0], [c.points[i].x, c.points[i].y])).toBeLessThan(1e-9);
				const next = c.points[(i + 1) % n];
				expect(dist(cubic[3], [next.x, next.y])).toBeLessThan(1e-9);
			});
		}
	});

	it('is smooth (one direction) at every point that is not an end, a corner or a break', () => {
		const rnd = seeded(7);
		for (let trial = 0; trial < 20; trial++) {
			const points = Array.from({ length: 3 + Math.floor(rnd() * 6) }, () => ({
				x: Math.round(rnd() * 800),
				y: Math.round(rnd() * 800),
			}));
			for (const cyclic of [false, true]) {
				const cubics = hobby(points, { cyclic });
				for (let i = 0; i < cubics.length; i++) {
					if (!cyclic && i === cubics.length - 1) break;
					const a = cubics[i];
					const b = cubics[(i + 1) % cubics.length];
					expect(apartDeg(angleOf(a[2], a[3]) / DEG, angleOf(b[0], b[1]) / DEG)).toBeLessThan(1e-6);
				}
			}
		}
	});
});

describe('hobby: Knuth’s equations', () => {
	it('matches a case worked by hand: (0,0)..(100,100)..(200,0)', () => {
		// curl 1 at both ends, tension 1: theta0 + theta1 = 90, theta0 + 4 theta1 + theta2 = 180,
		// theta2 + theta1 = 0  ->  theta0 = theta1 = 45 degrees, phi1 = 45 degrees.
		// Handle = d * velocity(45, 45) = 100 sqrt(2) * 2 / (3 (1 + cos 45)) = 55.2285
		const handle = (100 * Math.SQRT2 * 2) / (3 * (1 + Math.SQRT1_2));
		const [first, second] = hobby([
			{ x: 0, y: 0 },
			{ x: 100, y: 100 },
			{ x: 200, y: 0 },
		]);
		expect(handle).toBeCloseTo(55.2285, 4);
		expect(first[1][0]).toBeCloseTo(0, 9);
		expect(first[1][1]).toBeCloseTo(handle, 9);
		expect(first[2][0]).toBeCloseTo(100 - handle, 9);
		expect(first[2][1]).toBeCloseTo(100, 9);
		expect(second[1][0]).toBeCloseTo(100 + handle, 9);
		expect(second[2][0]).toBeCloseTo(200, 9);
		expect(second[2][1]).toBeCloseTo(handle, 9);
	});

	it('draws two free points as a straight line, handles at a third (shorter with tension)', () => {
		const [line] = hobby([
			{ x: 10, y: 20 },
			{ x: 250, y: 90 },
		]);
		expect(dist(line[1], [90, 20 + 70 / 3])).toBeLessThan(1e-9);
		expect(dist(line[2], [170, 20 + 140 / 3])).toBeLessThan(1e-9);
		const [tight] = hobby([
			{ x: 0, y: 0, tout: 2 },
			{ x: 300, y: 0, tin: 4 },
		]);
		expect(dist(tight[1], [50, 0])).toBeLessThan(1e-9);
		expect(dist(tight[2], [275, 0])).toBeLessThan(1e-9);
	});

	it('meets the mock-curvature equation at every inner point, with any tensions', () => {
		const rnd = seeded(11);
		for (let trial = 0; trial < 25; trial++) {
			const n = 4 + Math.floor(rnd() * 5);
			// a walk to the right (the angles read back from handles are only known within a turn)
			const points = Array.from({ length: n }, (_, i) => ({
				x: i * 150 + Math.round(rnd() * 80),
				y: Math.round(rnd() * 400),
				tin: 0.75 + rnd() * 2,
				tout: 0.75 + rnd() * 2,
			}));
			const cubics = hobby(points);
			const ang = anglesOf(cubics);
			const d = cubics.map(([p0, , , p3]) => dist(p0, p3));
			const chord = cubics.map(([p0, , , p3]) => angleOf(p0, p3));
			for (let k = 1; k < n - 1; k++) {
				const psi = (j) => (j < n - 1 ? reduceAngle(chord[j] - chord[j - 1]) : 0);
				const { A, B, C, D } = curvatureRow(
					d[k - 1],
					d[k],
					points[k - 1].tout,
					points[k].tin,
					points[k].tout,
					points[k + 1].tin
				);
				const thetaNext = k + 1 < n - 1 ? ang[k + 1].theta : -ang[k].phi;
				const lhs = A * ang[k - 1].theta + (B + C) * ang[k].theta + D * thetaNext;
				const rhs = -B * psi(k) - D * psi(k + 1);
				// the cubics' handle directions carry the solution; read back to 1e-9 of a radian
				expect(Math.abs(lhs - rhs) * Math.min(d[k - 1], d[k])).toBeLessThan(1e-6);
			}
		}
	});

	it('uses the curl-1 end rule: phi at a free end is curlRatio times theta beside it', () => {
		const points = [
			{ x: 0, y: 0 },
			{ x: 80, y: 150 },
			{ x: 260, y: 170 },
			{ x: 330, y: 20 },
		];
		const ang = anglesOf(hobby(points));
		// first piece: theta0 / phi1 = curlRatio (mp.w uu[0]), last: phi3 / theta2 = curlRatio
		expect(curlRatio(1, 1, 1)).toBeCloseTo(1, 12);
		const psi1 = reduceAngle(angleOf([80, 150], [260, 170]) - angleOf([0, 0], [80, 150]));
		const theta1 = -ang[0].phi - psi1;
		expect(ang[0].theta).toBeCloseTo(-curlRatio(1) * (theta1 + psi1), 9);
		expect(ang[2].phi).toBeCloseTo(curlRatio(1) * ang[2].theta, 9);
	});
});

describe('hobby: against the reference numbers', () => {
	it('matches the mp.w port on every case (directions, tensions, cycles, a corner)', () => {
		expect(reference.cases.length).toBeGreaterThanOrEqual(15);
		for (const c of reference.cases) {
			const cubics = hobby(c.points, { cyclic: c.cyclic });
			expect(maxGap(cubics, c.knuthRef), c.name).toBeLessThan(1e-4);
		}
	});

	it('matches hobby-curve 0.2.1 within 0.5 units when no point has a direction or tension', () => {
		const plain = reference.cases.filter((c) => c.hobbyCurve);
		expect(plain.length).toBeGreaterThanOrEqual(5);
		for (const c of plain) {
			const cubics = hobby(c.points, { cyclic: c.cyclic });
			expect(maxGap(cubics, c.hobbyCurve), c.name).toBeLessThan(0.5);
		}
	});
});

describe('hobby: given directions', () => {
	it('meets every given direction within 0.1 degree, at ends and inside', () => {
		const rnd = seeded(5);
		for (let trial = 0; trial < 30; trial++) {
			const n = 3 + Math.floor(rnd() * 5);
			const points = Array.from({ length: n }, (_, i) => ({
				x: i * 120 + Math.round(rnd() * 60),
				y: Math.round(rnd() * 400),
				dir: rnd() < 0.4 ? Math.round(rnd() * 360 - 180) : undefined,
				tout: 0.75 + rnd(),
			}));
			const cyclic = trial % 3 === 0;
			const cubics = hobby(points, { cyclic });
			points.forEach((p, i) => {
				if (p.dir === undefined) return;
				const out = cubics[i];
				const into = cubics[(i - 1 + cubics.length) % cubics.length];
				if (out) expect(apartDeg(angleOf(out[0], out[1]) / DEG, p.dir)).toBeLessThan(0.1);
				if (cyclic || i > 0) expect(apartDeg(angleOf(into[2], into[3]) / DEG, p.dir)).toBeLessThan(0.1);
			});
		}
	});

	it('splits the path at a given direction: the two sides are solved on their own', () => {
		const left = [
			{ x: 0, y: 0 },
			{ x: 90, y: 140 },
			{ x: 200, y: 160, dir: 0 },
		];
		const base = hobby([...left, { x: 300, y: 60 }, { x: 420, y: 100 }]);
		const moved = hobby([...left, { x: 330, y: -80 }, { x: 600, y: 300 }]);
		expect(maxGap(base.slice(0, 2), moved.slice(0, 2))).toBeLessThan(1e-9);
		expect(maxGap(base.slice(0, 2), hobby(left))).toBeLessThan(1e-9);
	});

	it('a corner stops the curve: each side as if it ended there', () => {
		const a = [
			{ x: 0, y: 0 },
			{ x: 100, y: 120 },
		];
		const b = [
			{ x: 100, y: 120 },
			{ x: 200, y: 40 },
			{ x: 260, y: 130 },
		];
		const whole = hobby([a[0], { ...a[1], corner: true }, b[1], b[2]]);
		expect(maxGap(whole.slice(0, 1), hobby(a))).toBeLessThan(1e-9);
		expect(maxGap(whole.slice(1), hobby(b))).toBeLessThan(1e-9);
	});
});

describe('hobby: tension', () => {
	it('handle lengths are the chord times velocity over the tension, as MetaPost sets them', () => {
		const points = [
			{ x: 0, y: 0, tout: 1.6 },
			{ x: 150, y: 120, tin: 2.2, tout: 0.9 },
			{ x: 320, y: 40, tin: 3 },
		];
		const cubics = hobby(points);
		const ang = anglesOf(cubics);
		cubics.forEach(([p0, h1, h2, p3], i) => {
			const d = dist(p0, p3);
			expect(dist(p0, h1)).toBeCloseTo(d * velocity(ang[i].theta, ang[i].phi, points[i].tout), 9);
			expect(dist(h2, p3)).toBeCloseTo(d * velocity(ang[i].phi, ang[i].theta, points[i + 1].tin), 9);
		});
	});

	it('more tension pulls the curve tighter beside that point', () => {
		const at = (t) =>
			hobby([
				{ x: 0, y: 0 },
				{ x: 100, y: 100, tin: t, tout: t },
				{ x: 200, y: 0 },
			]);
		const handle = (cubics) => dist(cubics[0][2], cubics[0][3]);
		expect(handle(at(2))).toBeLessThan(handle(at(1)));
		expect(handle(at(4))).toBeLessThan(handle(at(2)));
		expect(handle(at(0.75))).toBeGreaterThan(handle(at(1)));
	});

	it('holds tension to 0.75 - 4', () => {
		const pts = (t) => [
			{ x: 0, y: 0, tout: t },
			{ x: 100, y: 80 },
			{ x: 200, y: 0 },
		];
		expect(maxGap(hobby(pts(0.1)), hobby(pts(MIN_TENSION)))).toBeLessThan(1e-12);
		expect(maxGap(hobby(pts(50)), hobby(pts(MAX_TENSION)))).toBeLessThan(1e-12);
	});
});

describe('hobby: odd input', () => {
	it('no points, one point (a dot), two points on top of each other', () => {
		expect(hobby([])).toEqual([]);
		expect(hobby([{ x: 5, y: 6 }])).toEqual([
			[
				[5, 6],
				[5, 6],
				[5, 6],
				[5, 6],
			],
		]);
		const doubled = hobby([
			{ x: 0, y: 0 },
			{ x: 100, y: 50 },
			{ x: 100, y: 50 },
			{ x: 200, y: 0 },
		]);
		expect(doubled).toHaveLength(3);
		for (const cubic of doubled) for (const p of cubic) expect(p.every(Number.isFinite)).toBe(true);
	});

	it('a point straight back the way it came still makes finite curves', () => {
		const cubics = hobby([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 0, y: 0.001 },
		]);
		for (const cubic of cubics) for (const p of cubic) expect(p.every(Number.isFinite)).toBe(true);
	});
});

// Fix track (critic findings, 10/16/2026): each test below failed before its fix.
describe('fix: the reference file names the script in the repo that wrote it', () => {
	it('"by" is fixtures/hobby_reference.mjs, and it says which cases an outside program checked', () => {
		expect(reference.by).toContain('src/anyink/sketch/tests/fixtures/hobby_reference.mjs');
		expect(reference.by).not.toContain('knuth_ref');
		expect(reference.by).toContain('hobby-curve 0.2.1');
	});
});

describe('fix: huge and tiny coordinates solve the same as normal ones', () => {
	const base = [
		{ x: 0, y: 0 },
		{ x: 130, y: 220 },
		{ x: 300, y: 260 },
		{ x: 420, y: 90 },
		{ x: 610, y: 140 },
	];
	const scaled = (k) => base.map((p) => ({ x: p.x * k, y: p.y * k }));
	for (const k of [1e-9, 1e11, 1e12, 1e15]) {
		it(`open and cyclic paths at scale ${k}`, () => {
			for (const cyclic of [false, true]) {
				const ref = hobby(base, { cyclic });
				const big = hobby(scaled(k), { cyclic });
				ref.forEach((cubic, i) =>
					cubic.forEach((p, j) => {
						const q = big[i][j];
						expect(dist(p, [q[0] / k, q[1] / k])).toBeLessThan(1e-6);
					})
				);
			}
		});
	}
});

describe('fix: the grip pull and its tension (S4 maps a grip to these)', () => {
	it('a pull of 1 is normal; longer pulls stop at 1 / 0.75, shorter at 1 / 4, and say so', () => {
		expect(gripTension(1)).toBe(1);
		expect(gripTension(1.2)).toBeCloseTo(1 / 1.2, 12);
		expect(gripTension(3)).toBe(MIN_TENSION);
		expect(gripTension(0.1)).toBe(MAX_TENSION);
		expect(gripPull(gripTension(3))).toBeCloseTo(GRIP_RANGE.longest, 12);
		expect(gripPull(gripTension(0.1))).toBeCloseTo(GRIP_RANGE.shortest, 12);
		expect(GRIP_RANGE.longest).toBeCloseTo(1 / 0.75, 12);
		expect(GRIP_RANGE.shortest).toBeCloseTo(1 / 4, 12);
		expect(gripTension(Number.NaN)).toBe(1);
	});
});
