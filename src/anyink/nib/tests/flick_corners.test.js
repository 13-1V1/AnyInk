// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B16 fix (acceptance: "a fast brush flick rounds off or bends sharp corners"): M and V drawn
	quickly with the mouse, 2 to 5 pointer samples per straight leg. The 1 euro filter lags a
	quick hand, so at a sharp turn it cut across: the middle of an M aimed at screen y = 470
	landed near 415 (a flat U), and a V's tip with 2 samples a leg sat 70 px short. Every later
	step (smoothing, the fit) only follows the filter, so the corner has to be kept where the
	samples come in: a large turn between consecutive pointer samples is a corner, its raw point
	goes in as it is, and the filter starts again from it (raw_corners.js, filter.js take).
	Screen pixels at 40 % zoom, the default nib (99 units), a 125 Hz mouse.
*/
import { describe, expect, it } from 'vitest';
import { makeStrokeFilter } from '../filter.js';
import { flattenCurves } from '../geometry.js';
import { makeSkeleton } from '../skeleton.js';

const DZ = 0.4;
const RATE = 125;

/** Pointer samples along straight legs between `path`'s points, `n` a leg (ends exact) */
function legs(path, n) {
	const events = [path[0]];
	for (let k = 1; k < path.length; k++) {
		const [a, b] = [path[k - 1], path[k]];
		for (let i = 1; i <= n; i++) {
			events.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
		}
	}
	return events;
}

/** The skeleton the Brush makes from these pointer samples, in screen pixels */
function brushed(events) {
	const filter = makeStrokeFilter();
	const out = [];
	events.forEach(([x, y], i) => out.push(...filter.take(x, y, i / RATE)));
	out.push(...filter.settle(...events.at(-1), (events.length - 1) / RATE));
	const skeleton = makeSkeleton(
		out.map(({ x, y }) => [x / DZ, -y / DZ]),
		{ size: 99, pixel: 1 / DZ }
	);
	return { skeleton, line: flattenCurves(skeleton, 0.5).map(([x, y]) => [x * DZ, -y * DZ]) };
}

const lowestNear = (line, x0, reach = 40) =>
	Math.max(...line.filter(([x]) => Math.abs(x - x0) < reach).map(([, y]) => y));
const highestNear = (line, x0, reach = 40) =>
	Math.min(...line.filter(([x]) => Math.abs(x - x0) < reach).map(([, y]) => y));

const V = [
	[100, 100],
	[250, 470],
	[400, 100],
];
const M = [
	[100, 470],
	[175, 100],
	[250, 470],
	[325, 100],
	[400, 470],
];

describe('a fast flick keeps its sharp corners', () => {
	for (const n of [2, 5]) {
		it(`V with ${n} samples a leg: the tip is where the hand turned`, () => {
			const { line } = brushed(legs(V, n));
			expect(lowestNear(line, 250)).toBeGreaterThan(467);
			// the right leg comes out straight and whole, up to where the pen stopped
			expect(highestNear(line, 400, 10)).toBeLessThan(103);
		});

		it(`M with ${n} samples a leg: a V in the middle, sharp peaks`, () => {
			const { line } = brushed(legs(M, n));
			expect(lowestNear(line, 250)).toBeGreaterThan(467);
			expect(highestNear(line, 175)).toBeLessThan(103);
			expect(highestNear(line, 325)).toBeLessThan(103);
		});
	}

	it('the corner is a curve end: no curve runs across it', () => {
		const { skeleton } = brushed(legs(V, 2));
		const tip = [250 / DZ, -470 / DZ];
		const ends = skeleton.map((curve) => curve[3]);
		const nearest = Math.min(...ends.map(([x, y]) => Math.hypot(x - tip[0], y - tip[1])));
		expect(nearest * DZ).toBeLessThan(3);
	});

	it('a tip that falls between two samples is still a sharp tip', () => {
		// the samples straddle the tip: the mouse never reported the turning point itself
		const events = [
			[100, 100],
			[160, 248],
			[220, 396],
			[275, 408],
			[332, 268],
			[400, 100],
		];
		const { line } = brushed(events);
		expect(lowestNear(line, 250)).toBeGreaterThan(455);
	});

	it('a quick round o stays round: no corners where it only curves', () => {
		const events = Array.from({ length: 13 }, (_, i) => {
			const a = (2 * Math.PI * i) / 12 - Math.PI / 2;
			return [250 + 110 * Math.cos(a), 250 + 110 * Math.sin(a)];
		});
		const filter = makeStrokeFilter();
		const corners = events.filter(([x, y], i) => filter.take(x, y, i / RATE).length > 1);
		expect(corners).toEqual([]);
		// and six samples round (60 degrees a step, about the same step each time) neither
		const six = makeStrokeFilter();
		const hex = Array.from({ length: 7 }, (_, i) => {
			const a = (2 * Math.PI * i) / 6;
			return [250 + 110 * Math.cos(a), 250 + 110 * Math.sin(a)];
		});
		expect(hex.filter(([x, y], i) => six.take(x, y, i / RATE).length > 1)).toEqual([]);
	});

	it('a slow shaky hand makes no corners out of its jitter', () => {
		const filter = makeStrokeFilter();
		let flips = 0;
		const out = [];
		for (let i = 0; i < 300; i++) {
			const y = i % 2 ? 1.5 : -1.5;
			const points = filter.take(i * 0.8, y, i / RATE);
			if (points.length > 1) flips++;
			out.push(...points);
		}
		expect(flips).toBe(0);
		expect(out.length).toBe(300);
	});
});

// B16 final (the brush verifier): the corners held, but a flick's diagonal legs still bent, 20 to
// 30 px at 2 samples a leg, a kink just before each corner: the filter lags each axis on its own,
// so a quick diagonal step leaves the line. Written to fail on the filter before the fix.
/** The farthest the line strays from the polyline `path`, in px */
function strayFrom(line, path) {
	const toSegment = ([px, py], [ax, ay], [bx, by]) => {
		const dx = bx - ax;
		const dy = by - ay;
		const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
		return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
	};
	let worst = 0;
	for (const point of line) {
		let near = Infinity;
		for (let k = 1; k < path.length; k++)
			near = Math.min(near, toSegment(point, path[k - 1], path[k]));
		worst = Math.max(worst, near);
	}
	return worst;
}

describe('a fast flick keeps its legs straight', () => {
	for (const n of [2, 5]) {
		for (const [name, path] of [
			['V', V],
			['M', M],
		]) {
			it(`${name} with ${n} samples a leg: the line stays on the legs the hand drew`, () => {
				const { line } = brushed(legs(path, n));
				expect(strayFrom(line, path)).toBeLessThan(4);
			});
		}
	}

	it('a slow shaky hand is still smoothed', () => {
		const filter = makeStrokeFilter();
		const out = [];
		for (let i = 0; i < 300; i++) out.push(...filter.take(i * 0.8, i % 2 ? 1.5 : -1.5, i / RATE));
		const spread = Math.max(...out.slice(20).map(({ y }) => Math.abs(y)));
		expect(spread).toBeLessThan(1);
	});
});
