// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6 + B7 fix: how two outlines lie (letter/outlines.js), the ground auto-hole stands on. The
// cases a corner-in-shape test gets wrong: a plus sign of two bars (no corner of either is
// inside the other), a box with its corners in a C and a side across the C's gap, two
// rectangles on shared top and bottom lines, and a box drawn against the inside edge of another.
import { describe, expect, it } from 'vitest';
import { outlineOf, relation, signOf, windingOf } from '../outlines.js';
import { box, polygon } from './auto_hole_shapes.js';

const lie = (a, b) => relation(outlineOf(a), outlineOf(b));

describe('relation', () => {
	it('apart, inside, around', () => {
		expect(lie(box(0, 0, 100, 100), box(200, 0, 300, 100))).toBe('apart');
		expect(lie(box(100, 100, 200, 200), box(0, 0, 400, 400))).toBe('inside');
		expect(lie(box(0, 0, 400, 400), box(100, 100, 200, 200))).toBe('around');
	});

	it('a plus sign of two bars crosses, though no corner of either is inside the other', () => {
		expect(lie(box(0, 400, 1000, 600), box(400, 0, 600, 1000))).toBe('cross');
	});

	it('a box with every corner inside a C but a side across its gap is not inside it', () => {
		const c = polygon([
			[0, 0],
			[600, 0],
			[600, 200],
			[200, 200],
			[200, 400],
			[600, 400],
			[600, 600],
			[0, 600],
		]);
		// corners at (100, 100), (500, 100), (500, 500), (100, 500): all inside the C's ink
		const across = polygon([
			[100, 100],
			[500, 100],
			[500, 500],
			[100, 500],
		]);
		expect(lie(across, c)).toBe('cross');
	});

	it('two rectangles on shared top and bottom lines cross (their sides only meet at corners)', () => {
		expect(lie(box(0, 0, 400, 400), box(200, 0, 600, 400))).toBe('cross');
	});

	it('a box drawn against the inside edge of another sits inside it', () => {
		expect(lie(box(0, 0, 200, 300), box(0, 0, 600, 700))).toBe('inside');
		expect(lie(box(100, 0, 300, 300), box(0, 0, 600, 700))).toBe('inside');
	});

	it('the same outline twice crosses itself', () => {
		expect(lie(box(0, 0, 100, 100), box(0, 0, 100, 100, 'ccw'))).toBe('cross');
	});
});

describe('outlineOf', () => {
	it('keeps a shape’s outline until a point moves', () => {
		const shape = box(0, 0, 100, 100);
		const first = outlineOf(shape);
		expect(outlineOf(shape)).toBe(first);
		shape.pathPoints[0].p.x = -50;
		const moved = outlineOf(shape);
		expect(moved).not.toBe(first);
		expect(moved.box.xMin).toBe(-50);
	});

	it('directions: counter-clockwise +1, clockwise -1, and their sum', () => {
		const ccw = outlineOf(box(0, 0, 10, 10, 'ccw'));
		const cw = outlineOf(box(0, 0, 10, 10, 'cw'));
		expect([signOf(ccw), signOf(cw)]).toEqual([1, -1]);
		expect(windingOf([cw, cw, ccw])).toBe(-1);
		expect(outlineOf({ objType: 'ComponentInstance' })).toBeNull();
		expect(
			outlineOf(
				polygon([
					[0, 0],
					[10, 10],
				])
			)
		).toBeNull();
	});
});
