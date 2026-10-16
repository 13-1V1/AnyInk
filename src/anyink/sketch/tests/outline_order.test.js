// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S1 (docs/SKETCH.md section 4 steps 1 and 2, S1 step 9): solid or hole by nesting among sketch
// loops only, and the direction each depth needs (+1 counterclockwise for solid, -1 for a hole).
import { describe, expect, it } from 'vitest';
import {
	directionForDepth,
	flattenCubics,
	loopInside,
	orientLoop,
	outlineOrder,
	pointInLoop,
	roleForDepth,
	signedArea,
	windingOf,
} from '../outline_order.js';

/** A circle as 4 cubics, counterclockwise (or clockwise) */
function circle(cx, cy, r, clockwise = false) {
	const k = 0.5523 * r;
	const ccw = [
		[[cx + r, cy], [cx + r, cy + k], [cx + k, cy + r], [cx, cy + r]],
		[[cx, cy + r], [cx - k, cy + r], [cx - r, cy + k], [cx - r, cy]],
		[[cx - r, cy], [cx - r, cy - k], [cx - k, cy - r], [cx, cy - r]],
		[[cx, cy - r], [cx + k, cy - r], [cx + r, cy - k], [cx + r, cy]],
	];
	return clockwise ? ccw.reverse().map((cubic) => [...cubic].reverse()) : ccw;
}

/** A box as a point list, counterclockwise unless asked */
function box(x0, y0, x1, y1, clockwise = false) {
	const points = [
		[x0, y0],
		[x1, y0],
		[x1, y1],
		[x0, y1],
	];
	return clockwise ? points.reverse() : points;
}

const summary = (order) =>
	Object.fromEntries(order.map(({ id, depth, role, reverse }) => [id, { depth, role, reverse }]));

describe('basics', () => {
	it('signed area is positive counterclockwise (y up)', () => {
		expect(signedArea(box(0, 0, 10, 10))).toBe(100);
		expect(signedArea(box(0, 0, 10, 10, true))).toBe(-100);
		expect(windingOf(box(0, 0, 10, 10))).toBe(1);
		expect(windingOf(box(0, 0, 10, 10, true))).toBe(-1);
		expect(windingOf([[0, 0], [5, 5], [10, 10]])).toBe(0);
	});

	it('flattens a circle into a closed ring without repeating its start', () => {
		const ring = flattenCubics(circle(0, 0, 100));
		expect(ring).toHaveLength(64);
		ring.forEach(([x, y]) => expect(Math.abs(Math.hypot(x, y) - 100)).toBeLessThan(0.05));
		expect(windingOf(ring)).toBe(1);
		expect(windingOf(flattenCubics(circle(0, 0, 100, true)))).toBe(-1);
		expect(flattenCubics([[[0, 0], [1, 0], [2, 0], [3, 0]]], 3)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
	});

	it('says inside, outside or on the line', () => {
		const square = box(0, 0, 10, 10);
		expect(pointInLoop([5, 5], square)).toBe('inside');
		expect(pointInLoop([15, 5], square)).toBe('outside');
		expect(pointInLoop([10, 5], square)).toBe('on');
	});

	it('roles and directions alternate with depth', () => {
		expect([0, 1, 2, 3].map(roleForDepth)).toEqual(['solid', 'hole', 'solid', 'hole']);
		expect([0, 1, 2, 3].map(directionForDepth)).toEqual([1, -1, 1, -1]);
	});
});

describe('outlineOrder', () => {
	it('o: the inner ring is a hole, both drawn the same way, so the inner one turns round', () => {
		const order = outlineOrder([
			{ id: 'outer', cubics: circle(300, 250, 260) },
			{ id: 'inner', cubics: circle(300, 250, 180) },
		]);
		expect(summary(order)).toEqual({
			outer: { depth: 0, role: 'solid', reverse: false },
			inner: { depth: 1, role: 'hole', reverse: true },
		});
		expect(order[1].inside).toEqual(['outer']);
	});

	it('o drawn inside first and clockwise still comes out right', () => {
		const order = outlineOrder([
			{ id: 'inner', cubics: circle(300, 250, 180, true) },
			{ id: 'outer', cubics: circle(300, 250, 260, true) },
		]);
		expect(summary(order)).toEqual({
			inner: { depth: 1, role: 'hole', reverse: false },
			outer: { depth: 0, role: 'solid', reverse: true },
		});
	});

	it('B: one outer loop, two holes side by side', () => {
		const order = outlineOrder([
			{ id: 'B', points: box(0, 0, 500, 700) },
			{ id: 'upper', points: box(100, 400, 380, 600) },
			{ id: 'lower', points: box(100, 100, 400, 320) },
		]);
		expect(summary(order)).toEqual({
			B: { depth: 0, role: 'solid', reverse: false },
			upper: { depth: 1, role: 'hole', reverse: true },
			lower: { depth: 1, role: 'hole', reverse: true },
		});
	});

	it('an island in a hole is solid again, and its own island a hole', () => {
		const order = outlineOrder([
			{ id: 'dot', cubics: circle(300, 250, 60) },
			{ id: 'outer', cubics: circle(300, 250, 260) },
			{ id: 'speck', cubics: circle(300, 250, 20, true) },
			{ id: 'hole', cubics: circle(300, 250, 180) },
		]);
		expect(summary(order)).toEqual({
			dot: { depth: 2, role: 'solid', reverse: false },
			outer: { depth: 0, role: 'solid', reverse: false },
			speck: { depth: 3, role: 'hole', reverse: false },
			hole: { depth: 1, role: 'hole', reverse: true },
		});
		expect(order[0].inside).toEqual(['hole', 'outer']);
	});

	it('loops side by side, touching, or crossing are not nested', () => {
		const apart = outlineOrder([
			{ id: 'a', points: box(0, 0, 100, 100) },
			{ id: 'b', points: box(200, 0, 300, 100) },
		]);
		expect(apart.map((loop) => loop.depth)).toEqual([0, 0]);
		const touching = outlineOrder([
			{ id: 'a', points: box(0, 0, 100, 100) },
			{ id: 'b', points: box(100, 0, 200, 100) },
		]);
		expect(touching.map((loop) => loop.depth)).toEqual([0, 0]);
		const crossing = outlineOrder([
			{ id: 'a', points: box(0, 0, 100, 100) },
			{ id: 'b', points: box(60, 20, 160, 80) },
		]);
		expect(crossing.map((loop) => loop.depth)).toEqual([0, 0]);
	});

	it('a loop with an edge on its outer loop still counts as inside it', () => {
		const order = outlineOrder([
			{ id: 'outer', points: box(0, 0, 100, 100) },
			{ id: 'notch', points: box(0, 20, 40, 60) },
		]);
		expect(order[1].depth).toBe(1);
	});

	it('orientLoop turns a loop round only when its depth needs it, as a copy', () => {
		const loop = box(0, 0, 10, 10);
		expect(orientLoop(loop, 0)).toEqual(loop);
		expect(orientLoop(loop, 0)).not.toBe(loop);
		expect(windingOf(orientLoop(loop, 1))).toBe(-1);
		expect(windingOf(orientLoop(box(0, 0, 10, 10, true), 2))).toBe(1);
		expect(loop).toEqual(box(0, 0, 10, 10));
		expect(loopInside(loop, loop)).toBe(false);
	});
});
