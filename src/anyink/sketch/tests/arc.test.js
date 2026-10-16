// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 arc.js: an Arc is its ends plus a bulge (tan of a quarter of its turn), built as cubics a
	quarter turn or less each; a tangent arc takes its bulge from the way it must leave; a curve
	part is one cubic tangent at both ends with Hobby's handle lengths.
*/
import { describe, expect, it } from 'vitest';
import {
	MAX_PIECE_SWEEP,
	MAX_TANGENT_SWEEP,
	arcCubics,
	arcDirs,
	arcGeometry,
	arcPoint,
	bulgeFromMiddle,
	curveCubic,
	tangentBulge,
} from '../arc.js';
import { velocity } from '../hobby.js';

const DEG = Math.PI / 180;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const angleOf = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]) / DEG;
const apart = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

function cubicAt([p0, p1, p2, p3], t) {
	const u = 1 - t;
	return [0, 1].map(
		(k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]
	);
}

/** The worst distance off the true circle, as a share of the radius */
function worstError(cubics, center, radius) {
	let worst = 0;
	for (const cubic of cubics) {
		for (let i = 0; i <= 400; i++) {
			const e = Math.abs(dist(cubicAt(cubic, i / 400), center) - radius) / radius;
			worst = Math.max(worst, e);
		}
	}
	return worst;
}

/** Signed distance of q to the left of the line a -> b */
const leftOf = (a, b, q) =>
	((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / dist(a, b);

/** The signed turn of a cubic's curvature at t (+ left), by finite differences */
function turnSign(cubic, t) {
	const a = cubicAt(cubic, t - 0.01);
	const b = cubicAt(cubic, t);
	const c = cubicAt(cubic, t + 0.01);
	return Math.sign((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]));
}

describe('arcCubics', () => {
	const bulges = [0.05, 0.2, 0.41, 1, -1, -0.6, 2.5, -4];

	it('stays within 0.03 % of the radius, for small arcs, half circles and nearly whole ones', () => {
		for (const bulge of bulges) {
			const p0 = [100, 40];
			const p1 = [460, 210];
			const geo = arcGeometry(p0, p1, bulge);
			const cubics = arcCubics(p0, p1, bulge);
			expect(worstError(cubics, geo.center, geo.radius), `bulge ${bulge}`).toBeLessThan(0.0003);
		}
	});

	it('splits every 90 degrees, ends exactly on the two ends, smooth inside', () => {
		for (const bulge of bulges) {
			const p0 = [0, 0];
			const p1 = [300, 0];
			const geo = arcGeometry(p0, p1, bulge);
			const cubics = arcCubics(p0, p1, bulge);
			expect(cubics).toHaveLength(Math.ceil(Math.abs(geo.sweep) / MAX_PIECE_SWEEP - 1e-9));
			expect(cubics[0][0]).toEqual(p0);
			expect(cubics[cubics.length - 1][3]).toEqual(p1);
			for (let i = 1; i < cubics.length; i++) {
				expect(dist(cubics[i - 1][3], cubics[i][0])).toBeLessThan(1e-9);
				const into = angleOf(cubics[i - 1][2], cubics[i - 1][3]);
				const out = angleOf(cubics[i][0], cubics[i][1]);
				expect(apart(into, out)).toBeLessThan(1e-6);
			}
		}
	});

	it('bulge = tan(sweep / 4): 1 is a half circle, + turns left, 0 is straight', () => {
		const half = arcGeometry([0, 0], [200, 0], 1);
		expect(half.sweep).toBeCloseTo(180, 9);
		expect(half.radius).toBeCloseTo(100, 9);
		expect(half.center[0]).toBeCloseTo(100, 9);
		expect(half.center[1]).toBeCloseTo(0, 9);
		// leaves straight down, turns left (counterclockwise) and arrives going straight up
		expect(apart(half.startDir, -90)).toBeLessThan(1e-9);
		expect(apart(half.endDir, 90)).toBeLessThan(1e-9);
		expect(arcPoint([0, 0], [200, 0], 1, 0.5)[1]).toBeCloseTo(-100, 9);
		const flat = arcCubics([0, 0], [300, 0], 0);
		expect(flat).toEqual([
			[
				[0, 0],
				[100, 0],
				[200, 0],
				[300, 0],
			],
		]);
	});

	it('the cubics follow the arc the same way arcPoint does', () => {
		const p0 = [50, 50];
		const p1 = [250, 120];
		const bulge = 0.7;
		const cubics = arcCubics(p0, p1, bulge);
		const mid = arcPoint(p0, p1, bulge, 0.5);
		const sweep = arcGeometry(p0, p1, bulge).sweep;
		// with two pieces (sweep > 90) the join sits exactly at the middle of the arc
		expect(sweep).toBeGreaterThan(90);
		expect(cubics).toHaveLength(2);
		expect(dist(cubics[0][3], mid)).toBeLessThan(1e-9);
	});
});

describe('the bulge when an end moves', () => {
	it('keeps the arc in proportion (same turn, sagitta / chord the same) and on the same side', () => {
		const bulge = 0.35;
		const p0 = [0, 0];
		const ends = [
			[200, 0],
			[400, 300],
			[-150, 90],
			[-300, -10],
			[5, -260],
			[0.5, 0.25],
		];
		for (const p1 of ends) {
			const geo = arcGeometry(p0, p1, bulge);
			expect(geo.sweep).toBeCloseTo(4 * Math.atan(bulge) / DEG, 9);
			const mid = arcPoint(p0, p1, bulge, 0.5);
			const sagitta = -leftOf(p0, p1, mid);
			// a left-turning arc bows to the right of its chord: never flips, whatever the end does
			expect(sagitta).toBeGreaterThan(0);
			expect(sagitta / geo.chord).toBeCloseTo(bulge / 2, 9);
			expect(bulgeFromMiddle(p0, p1, mid)).toBeCloseTo(bulge, 9);
		}
	});

	it('the radius grows with the chord, never jumps', () => {
		let last = 0;
		for (let x = 10; x <= 1000; x += 10) {
			const r = arcGeometry([0, 0], [x, 0], -0.5).radius;
			expect(r).toBeGreaterThan(last);
			last = r;
		}
	});
});

describe('tangentBulge', () => {
	it('leaves the first end along the given direction and lands on the second', () => {
		const p0 = [100, 100];
		for (const p1 of [
			[300, 200],
			[100, 400],
			[-50, 150],
			[180, -40],
		]) {
			for (const dir of [0, 37, 90, 160, -45, -120]) {
				const bulge = tangentBulge(p0, p1, dir);
				// past a 300-degree turn there is no tangent arc (the fix test below)
				if (apart(dir, angleOf(p0, p1)) > MAX_TANGENT_SWEEP / 2) {
					expect(bulge).toBe(null);
					continue;
				}
				expect(apart(arcDirs(p0, p1, bulge).start, dir)).toBeLessThan(1e-9);
				const cubics = arcCubics(p0, p1, bulge);
				expect(apart(angleOf(cubics[0][0], cubics[0][1]), dir)).toBeLessThan(1e-6);
				expect(cubics[cubics.length - 1][3]).toEqual(p1);
			}
		}
	});

	it('a tangent arc off the top of a stem: up, then over to the right is a right turn', () => {
		const bulge = tangentBulge([0, 400], [100, 400], 90);
		expect(bulge).toBeCloseTo(-1, 9);
		expect(arcPoint([0, 400], [100, 400], bulge, 0.5)[1]).toBeCloseTo(450, 9);
	});
});

describe('curveCubic: a part tangent at both ends', () => {
	it('the n arch as a curve, stems 100 units apart, stays smooth', () => {
		// stem tops at (0, 400) and (100, 400); the arch leaves going up and arrives going down
		const arch = curveCubic([0, 400], [100, 400], 90, -90);
		expect(apart(angleOf(arch[0], arch[1]), 90)).toBeLessThan(1e-9);
		expect(apart(angleOf(arch[2], arch[3]), -90)).toBeLessThan(1e-9);
		// Hobby's length for 90 / 90 degrees is 2/3 of the chord
		expect(dist(arch[0], arch[1])).toBeCloseTo((100 * 2) / 3, 9);
		expect(dist(arch[2], arch[3])).toBeCloseTo((100 * 2) / 3, 9);
		// one bend, no wiggle: it turns right all the way and its top is the middle
		for (let t = 0.02; t < 1; t += 0.02) expect(turnSign(arch, t)).toBe(-1);
		const top = cubicAt(arch, 0.5);
		expect(top[0]).toBeCloseTo(50, 9);
		expect(top[1]).toBeCloseTo(450, 9);
	});

	it('the arch with unequal stems still turns one way and meets both stems tangent', () => {
		const arch = curveCubic([0, 400], [100, 300], 90, -90);
		expect(apart(angleOf(arch[0], arch[1]), 90)).toBeLessThan(1e-9);
		expect(apart(angleOf(arch[2], arch[3]), -90)).toBeLessThan(1e-9);
		for (let t = 0.02; t < 1; t += 0.02) expect(turnSign(arch, t)).toBe(-1);
	});

	it('handle lengths follow Hobby’s rule and the tensions', () => {
		const p0 = [0, 0];
		const p1 = [200, 50];
		const chord = Math.atan2(50, 200);
		const theta = 60 * DEG - chord;
		const phi = chord - -10 * DEG;
		const loose = curveCubic(p0, p1, 60, -10);
		const d = dist(p0, p1);
		expect(dist(loose[0], loose[1])).toBeCloseTo(d * velocity(theta, phi, 1), 9);
		expect(dist(loose[2], loose[3])).toBeCloseTo(d * velocity(phi, theta, 1), 9);
		const tight = curveCubic(p0, p1, 60, -10, { tout: 2, tin: 3 });
		expect(dist(tight[0], tight[1])).toBeCloseTo(d * velocity(theta, phi, 2), 9);
		expect(dist(tight[2], tight[3])).toBeCloseTo(d * velocity(phi, theta, 3), 9);
	});
});

// Fix track (critic findings, 10/16/2026): failed before its fix.
describe('fix: a tangent arc never sweeps more than MAX_TANGENT_SWEEP', () => {
	it('past 300 degrees there is no tangent arc (null); up to it, the radius stays within the chord', () => {
		expect(MAX_TANGENT_SWEEP).toBe(300);
		expect(tangentBulge([0, 0], [100, 0], 179)).toBe(null);
		expect(tangentBulge([0, 0], [100, 0], 180)).toBe(null);
		expect(tangentBulge([0, 0], [100, 0], -151)).toBe(null);
		const edge = tangentBulge([0, 0], [100, 0], 149);
		expect(edge).not.toBe(null);
		expect(arcGeometry([0, 0], [100, 0], edge).radius).toBeLessThanOrEqual(100 + 1e-9);
		expect(apart(arcDirs([0, 0], [100, 0], edge).start, 149)).toBeLessThan(1e-9);
	});
});
