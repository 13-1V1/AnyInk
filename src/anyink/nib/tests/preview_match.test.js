// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 (UX-BEGINNER.md 10 B8, RESEARCH 2.3): while the button is down the brush shows a quick
	live picture of the stroke (perfect-freehand); on release the real ink is made (the nib swept
	along the fitted skeleton, D-015). The two must match within 2 % of the stroke width, so the
	ink never jumps when he lets go. Measured as the farthest any edge of one is from the edge of
	the other (both read as the nonzero rule fills them).
*/
import { describe, expect, it } from 'vitest';
import { makeStrokeFilter } from '../filter.js';
import { inkStroke } from '../ink.js';
import { flattenContour, outlineGap } from '../match.js';
import { previewShapes } from '../preview.js';
import { arc, asMouse, line, loop, sCurve, vee, wobble } from './strokes.js';

const SIZE = 99;
const LIMIT = 0.02 * SIZE;

const finalShapes = (points, size = SIZE, pixel = 0) =>
	inkStroke(points, { size, pixel }).contours.map((contour) =>
		flattenContour(contour.segments, 0.1)
	);

/** The points as the brush hands them on: a hand's jitter, then the 1 euro filter (pixels at
 * 1 font unit each, 120 samples a second), then the settle to where the pen stopped */
function filtered(points) {
	const filter = makeStrokeFilter();
	const out = [];
	points.forEach(([x, y], i) => out.push(filter.push(x, y, i / 120)));
	const [x, y] = points.at(-1);
	out.push(...filter.settle(x, y, (points.length - 1) / 120));
	return out.map(({ x: fx, y: fy }) => [fx, fy]);
}

describe('the live picture matches the ink within 2 % of the stroke width', () => {
	it.each([
		['a straight line', line([0, 0], [600, 250])],
		['an arc', arc(500, 400, 260, 200, 20)],
		['a tight arc', arc(300, 300, 70, 0, 250, 2)],
		['an S', sCurve(200, 0, 300, 700)],
		['an o in one stroke', loop(500, 500, 300, 25)],
		['a V with a sharp turn', vee(100, 0, 500)],
		['a short flick', line([0, 0], [30, 12], 3)],
		['a click', [[250, 250]]],
		['a shaky hand, filtered', filtered(wobble(sCurve(0, 0, 400, 800, 3), 1.5))],
		['a shaky loop, filtered', filtered(wobble(loop(400, 400, 250, 30, 3), 1.5))],
	])('%s', (_, points) => {
		const gap = outlineGap(previewShapes(points, SIZE), finalShapes(points));
		expect(gap).toBeLessThanOrEqual(LIMIT);
	});

	it.each([
		['an S at 40 % zoom', sCurve(200, 0, 300, 700), 0.4],
		['an o at 40 % zoom', loop(500, 500, 300, 25), 0.4],
		['a V at 40 % zoom', vee(100, 0, 500), 0.4],
		['an S at 100 % zoom', sCurve(200, 0, 300, 700), 1],
		[
			'an a-like hook at 25 % zoom',
			[...arc(400, 400, 200, 30, 330), ...line([573, 300], [600, 0]).slice(1)],
			0.25,
		],
	])('a mouse: %s', (_, path, dz) => {
		const points = asMouse(path, { dz });
		const pixel = 1 / dz;
		const gap = outlineGap(
			previewShapes(points, SIZE, { pixel }),
			finalShapes(points, SIZE, pixel)
		);
		expect(gap).toBeLessThanOrEqual(LIMIT);
	});

	it.each([30, 160])('at a %s-unit nib too', (size) => {
		const points = sCurve(200, 0, 300, 700);
		const gap = outlineGap(previewShapes(points, size), finalShapes(points, size));
		// whole-unit rounding is the floor for a thin nib
		expect(gap).toBeLessThanOrEqual(Math.max(0.02 * size, 1.5));
	});

	it('the measure itself sees a real difference', () => {
		const points = arc(500, 400, 260, 200, 20);
		const wider = previewShapes(points, SIZE * 1.1);
		expect(outlineGap(wider, finalShapes(points))).toBeGreaterThan(LIMIT);
	});
});
