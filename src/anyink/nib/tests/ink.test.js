// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 (UX-BEGINNER.md 10 B8, D-015): a stroke's center line becomes ink the way a round felt-tip
	makes it. The points are simplified, fitted with curves (the skeleton), a round nib is swept
	along the skeleton (one hull per step, all hulls unioned with clipper2-ts) and the outline is
	fitted with curves again. Every number written is whole (7.2).
	  - stroke to outline: a straight stroke is a capsule, a click is a round dot, a curve keeps
	    the nib's width all along
	  - a closed loop keeps its hole, running the other way
	  - whole numbers, in the outline and in the skeleton
*/
import { describe, expect, it } from 'vitest';
import { flattenCurves } from '../geometry.js';
import { inkStroke } from '../ink.js';
import { flattenContour, pointToPolyline, signedArea } from '../match.js';
import { skeletonTolerance } from '../skeleton.js';
import { allWhole, arc, boundsOf, line, loop, sCurve, vee, wobble } from './strokes.js';

const SIZE = 99; // 9 % of the default small-letter height, 1,100
const R = SIZE / 2;
const TOLERANCE = 0.02 * SIZE;

const outlineOf = (contour) => flattenContour(contour.segments, 0.25);
const solids = (contours) => contours.filter((contour) => !contour.hole);
const holes = (contours) => contours.filter((contour) => contour.hole);

describe('stroke to outline', () => {
	it('a straight stroke is one solid shape: as long as the stroke plus the nib, as wide as the nib', () => {
		const { contours } = inkStroke(line([100, 200], [600, 200]), { size: SIZE });
		expect(contours).toHaveLength(1);
		expect(contours[0].hole).toBe(false);
		const box = boundsOf(outlineOf(contours[0]));
		expect(Math.abs(box.xMin - (100 - R))).toBeLessThanOrEqual(1.5);
		expect(Math.abs(box.xMax - (600 + R))).toBeLessThanOrEqual(1.5);
		expect(Math.abs(box.yMin - (200 - R))).toBeLessThanOrEqual(1.5);
		expect(Math.abs(box.yMax - (200 + R))).toBeLessThanOrEqual(1.5);
	});

	it('a click is a round dot the size of the nib', () => {
		const { contours } = inkStroke([[300, 300]], { size: SIZE });
		expect(contours).toHaveLength(1);
		expect(contours[0].hole).toBe(false);
		outlineOf(contours[0]).forEach(([x, y]) => {
			expect(Math.abs(Math.hypot(x - 300, y - 300) - R)).toBeLessThanOrEqual(TOLERANCE);
		});
	});

	it.each([
		['an arc', arc(500, 400, 260, 200, 20)],
		['an S', sCurve(200, 0, 300, 700)],
		['a V with a sharp turn', vee(100, 0, 500)],
		['a shaky line', wobble(line([0, 0], [700, 300]), 1.5)],
	])(
		'%s keeps the nib width all along: every edge point is half the nib from the skeleton',
		(_, points) => {
			const { contours, skeleton } = inkStroke(points, { size: SIZE });
			expect(solids(contours)).toHaveLength(1);
			const center = flattenCurves(skeleton, 0.1);
			contours.forEach((contour) => {
				outlineOf(contour).forEach((point) => {
					expect(Math.abs(pointToPolyline(point, center) - R)).toBeLessThanOrEqual(TOLERANCE);
				});
			});
		}
	);

	it('the outline runs counterclockwise (font units point up), like every solid shape in the font', () => {
		const { contours } = inkStroke(arc(500, 400, 260, 200, 20), { size: SIZE });
		expect(signedArea(outlineOf(contours[0]))).toBeGreaterThan(0);
	});

	it('the skeleton is curves from the first point to the last', () => {
		const points = sCurve(200, 0, 300, 700);
		const { skeleton } = inkStroke(points, { size: SIZE });
		expect(skeleton.length).toBeGreaterThan(0);
		skeleton.forEach((segment) => expect(segment).toHaveLength(4));
		expect(skeleton[0][0]).toEqual(points[0].map(Math.round));
		expect(skeleton.at(-1)[3]).toEqual(points.at(-1).map(Math.round));
		// it follows the line he drew, within its tolerances (and whole-unit rounding)
		const { simplify, fit } = skeletonTolerance(SIZE);
		flattenCurves(skeleton, 0.1).forEach((point) => {
			expect(pointToPolyline(point, points)).toBeLessThanOrEqual(simplify + fit + 0.75);
		});
	});
});

describe('a closed loop keeps its hole', () => {
	const ringRadius = 300;

	it('an o drawn in one stroke is a solid ring with a hole that runs the other way', () => {
		const { contours } = inkStroke(loop(500, 500, ringRadius, 25), { size: SIZE });
		expect(solids(contours)).toHaveLength(1);
		expect(holes(contours)).toHaveLength(1);
		const outer = signedArea(outlineOf(solids(contours)[0]));
		const hole = signedArea(outlineOf(holes(contours)[0]));
		expect(outer).toBeGreaterThan(0);
		expect(hole).toBeLessThan(0);
		const holeArea = Math.PI * (ringRadius - R) ** 2;
		expect(Math.abs(-hole - holeArea) / holeArea).toBeLessThan(0.02);
		const outerArea = Math.PI * (ringRadius + R) ** 2;
		expect(Math.abs(outer - outerArea) / outerArea).toBeLessThan(0.02);
	});

	it('the middle of the o is paper under the nonzero rule the canvas and the font file use', () => {
		const { contours } = inkStroke(loop(500, 500, ringRadius, 25), { size: SIZE });
		const winding = windingAt([500, 500], contours.map(outlineOf));
		expect(winding).toBe(0);
		const onRing = windingAt([500 + ringRadius, 500], contours.map(outlineOf));
		expect(onRing).not.toBe(0);
	});

	it('a stroke that crosses itself keeps the paper it closes in', () => {
		// a loop like a cursive l: up, round, down across itself
		const points = [
			...line([0, 0], [300, 600]),
			...arc(250, 600, 50 + R, 0, 180).slice(1),
			...line([250 - 50 - R, 600], [500, 0]).slice(1),
		];
		const { contours } = inkStroke(points, { size: SIZE });
		expect(solids(contours)).toHaveLength(1);
		expect(holes(contours).length).toBeGreaterThanOrEqual(1);
	});
});

describe('whole numbers', () => {
	it.each([
		['a line', line([10.3, 20.7], [400.2, 310.9])],
		['a loop', loop(500.5, 500.25, 280, 30)],
		['a dot', [[123.45, 678.9]]],
		['an S', sCurve(12.5, 7.25, 300, 700)],
	])(
		'%s: every point and handle of the outline and the skeleton is a whole number',
		(_, points) => {
			const { contours, skeleton } = inkStroke(points, { size: 98.6 });
			expect(contours.length).toBeGreaterThan(0);
			expect(allWhole(contours)).toBe(true);
			expect(allWhole([{ segments: skeleton }])).toBe(true);
		}
	);

	it('each outline closes: every curve starts where the one before it ends', () => {
		const { contours } = inkStroke(loop(500, 500, 300, 25), { size: SIZE });
		contours.forEach(({ segments }) => {
			segments.forEach((segment, i) => {
				const before = segments[(i - 1 + segments.length) % segments.length];
				expect(segment[0]).toEqual(before[3]);
			});
		});
	});
});

describe('sizes', () => {
	it.each([20, 60, 150])('a %s-unit nib draws a %s-unit wide line', (size) => {
		const { contours } = inkStroke(line([0, 0], [500, 0]), { size });
		const box = boundsOf(outlineOf(contours[0]));
		expect(Math.abs(box.yMax - box.yMin - size)).toBeLessThanOrEqual(2);
	});

	it('no points, no ink', () => {
		expect(inkStroke([], { size: SIZE }).contours).toEqual([]);
	});
});

/** The nonzero winding number of the outlines at a point */
function windingAt([px, py], outlines) {
	let winding = 0;
	outlines.forEach((points) => {
		points.forEach(([x0, y0], i) => {
			const [x1, y1] = points[(i + 1) % points.length];
			if (y0 <= py) {
				if (y1 > py && (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) > 0) winding += 1;
			} else if (y1 <= py && (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) < 0) {
				winding -= 1;
			}
		});
	});
	return winding;
}
