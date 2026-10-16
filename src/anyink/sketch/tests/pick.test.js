// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md section 5, "Picking"): what Select on a sketch picks. A point wins over the
	piece it is on; a piece hit names its part and the stretch under the pointer; Ctrl adds and
	takes out; a window left to right picks only what is fully inside, right to left everything it
	touches; a pick loses ids the sketch no longer has.
*/
import { describe, expect, it } from 'vitest';
import {
	emptyPick,
	hitTest,
	isEmptyPick,
	pickBox,
	pickedPointIds,
	pickHas,
	pickOnly,
	pointOnCubics,
	prunePick,
	togglePick,
	windowPick,
	nearestOnCubics,
} from '../pick.js';
import { storedSketch } from './fixtures/stored_sketches.js';

const RADIUS = 20;

describe('hitTest', () => {
	it('a point first: the apex of A, not the legs it joins', () => {
		const hit = hitTest(storedSketch('A'), { x: 525, y: 1425 }, RADIUS);
		expect(hit).toMatchObject({ type: 'point', id: 'apex' });
	});

	it('a piece: the left leg, its part and the stretch between its points', () => {
		const hit = hitTest(storedSketch('A'), { x: 290, y: 745 }, RADIUS);
		expect(hit).toMatchObject({ type: 'piece', id: 1, part: 0, a: 'leftFoot', b: 'apex' });
		expect(hit.t).toBeGreaterThan(0.3);
		expect(hit.t).toBeLessThan(0.7);
	});

	it('the right leg is part 1 of the same piece', () => {
		const hit = hitTest(storedSketch('A'), { x: 750, y: 740 }, RADIUS);
		expect(hit).toMatchObject({ type: 'piece', id: 1, part: 1, a: 'apex', b: 'rightFoot' });
	});

	it('a Spline stretch of n: between join and archTop', () => {
		const sketch = storedSketch('n');
		const hit = hitTest(sketch, { x: 200, y: 1020 }, 60);
		expect(hit?.type).toBe('piece');
		expect(hit).toMatchObject({ id: 2, part: 0, a: 'join', b: 'archTop' });
	});

	it('nothing past the radius; nothing on a set-aside sketch', () => {
		expect(hitTest(storedSketch('A'), { x: 520, y: 200 }, RADIUS)).toBe(null);
		const aside = { ...storedSketch('A'), setAside: true };
		expect(hitTest(aside, { x: 525, y: 1425 }, RADIUS)).toBe(null);
	});
});

describe('picks', () => {
	it('pickOnly and Ctrl (togglePick) add and take out', () => {
		const a = { type: 'point', id: 'apex' };
		const leg = { type: 'piece', id: 1 };
		let pick = pickOnly(a);
		expect(pick).toEqual({ points: ['apex'], pieces: [] });
		pick = togglePick(pick, leg);
		expect(pick).toEqual({ points: ['apex'], pieces: [1] });
		expect(pickHas(pick, leg)).toBe(true);
		pick = togglePick(pick, a);
		expect(pick).toEqual({ points: [], pieces: [1] });
		expect(isEmptyPick(emptyPick())).toBe(true);
	});

	it('a picked piece moves its points; the box holds them all', () => {
		const sketch = storedSketch('A');
		expect(pickedPointIds(sketch, { points: ['barLeft'], pieces: [1] })).toEqual([
			'barLeft',
			'leftFoot',
			'apex',
			'rightFoot',
		]);
		expect(pickBox(sketch, { points: [], pieces: [2] })).toEqual({
			xMin: 203,
			yMin: 480,
			xMax: 837,
			yMax: 480,
		});
	});

	it('a pick loses ids the sketch no longer has', () => {
		const sketch = storedSketch('A');
		expect(prunePick(sketch, { points: ['apex', 'gone'], pieces: [1, 9] })).toEqual({
			points: ['apex'],
			pieces: [1],
		});
	});
});

describe('window picks', () => {
	const sketch = storedSketch('A');
	// a box round the crossbar and the lower half of both legs
	const box = { x0: 0, y0: 0, x1: 1100, y1: 600 };

	it('left to right: only what is fully inside (the bar and the two feet, not the legs)', () => {
		const pick = windowPick(sketch, box, { crossing: false });
		expect(pick.pieces).toEqual([2]);
		expect(pick.points.sort()).toEqual(['barLeft', 'barRight', 'leftFoot', 'rightFoot']);
	});

	it('right to left: everything it touches (the legs too)', () => {
		const pick = windowPick(
			sketch,
			{ x0: box.x1, y0: box.y1, x1: box.x0, y1: box.y0 },
			{ crossing: true }
		);
		expect(pick.pieces.sort()).toEqual([1, 2]);
	});

	it('a crossing window across a leg with no point inside still picks the leg', () => {
		const pick = windowPick(sketch, { x0: 250, y0: 700, x1: 330, y1: 780 }, { crossing: true });
		expect(pick).toEqual({ points: [], pieces: [1] });
		const inside = windowPick(sketch, { x0: 250, y0: 700, x1: 330, y1: 780 }, { crossing: false });
		expect(inside).toEqual({ points: [], pieces: [] });
	});

	it('the stem of n alone: its two ends, not the arch', () => {
		const n = storedSketch('n');
		const pick = windowPick(n, { x0: 60, y0: 0, x1: 180, y1: 1100 }, { crossing: false });
		expect(pick.pieces).toEqual([1]);
		expect(pick.points.sort()).toEqual(['foot', 'join', 'stemTop']);
	});
});

describe('along a piece', () => {
	it('pointOnCubics and nearestOnCubics agree on a share', () => {
		const line = [
			[
				[0, 0],
				[100, 0],
				[200, 0],
				[300, 0],
			],
		];
		expect(pointOnCubics(line, 0.5)).toEqual({ x: 150, y: 0 });
		const near = nearestOnCubics({ x: 75, y: 10 }, line);
		expect(near.t).toBeCloseTo(0.25, 5);
		expect(near.distance).toBeCloseTo(10, 5);
	});
});
