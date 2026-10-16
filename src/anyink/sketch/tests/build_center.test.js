// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 build_center.js (docs/SKETCH.md section 3): a Centerline piece to ink. Round ends are the
	Brush's sweep; Flat ends keep their corners through the refit (within 1 unit); a Flat end
	pinned to a line is cut along the line (a slanted stem stands flat on it, nothing hangs past
	it); a joined end is always Round; a dot is the nib alone; a closed piece is a ring with its
	hole; the sweep uses the edge rule's thickness, never the raw stored one.
	Checked to fail: with the Flat branch taken out (every piece swept round) the four end tests
	fail.
*/
import { describe, expect, it } from 'vitest';
import { guideLines } from '../../placement/classes.js';
import { buildSketch, clearBuildCache } from '../build.js';
import { centerContours, centerWidth, endStyle } from '../build_center.js';
import { edgeThickness, placeEdgePoints } from '../edge_rule.js';
import { flattenCubics, signedArea } from '../outline_order.js';
import { flatStem, sketchOfPieces, spline } from './fixtures/build_letters.js';
import { STORED_FONT, storedSketch } from './fixtures/stored_sketches.js';

const FONT = STORED_FONT;
const LINES = guideLines(FONT);
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** every on-curve point of the built contours */
function corners(contours) {
	return contours.flatMap((contour) => contour.curves.map((curve) => curve[0]));
}

function inkPoints(contours) {
	return contours.flatMap((contour) => flattenCubics(contour.curves));
}

function build(sketch) {
	const placed = placeEdgePoints(sketch, FONT);
	const width = centerWidth(placed, FONT);
	return placed.pieces.flatMap((piece) => centerContours(piece, placed, { font: FONT, width }));
}

describe('ends', () => {
	it('a plumb stem with Flat ends pinned to two lines: four corners, ink edge on each line', () => {
		const contours = build(flatStem());
		expect(contours).toHaveLength(1);
		const r = 99 / 2;
		const want = [
			[300 - r, LINES.writing],
			[300 + r, LINES.writing],
			[300 - r, LINES.small],
			[300 + r, LINES.small],
		];
		const points = corners(contours);
		for (const corner of want) {
			const miss = Math.min(...points.map((p) => near(p, corner)));
			expect(miss, `${corner}`).toBeLessThanOrEqual(1);
		}
		const ys = inkPoints(contours).map(([, y]) => y);
		expect(Math.abs(Math.min(...ys) - LINES.writing)).toBeLessThanOrEqual(1);
		expect(Math.abs(Math.max(...ys) - LINES.small)).toBeLessThanOrEqual(1);
	});

	it('a slanted Flat stem stands flat on the writing line: two corners on it, nothing below', () => {
		const contours = build(flatStem({ slant: 400 }));
		const ink = inkPoints(contours);
		const lowest = Math.min(...ink.map(([, y]) => y));
		expect(Math.abs(lowest - LINES.writing)).toBeLessThanOrEqual(1);
		const onLine = corners(contours).filter(([, y]) => Math.abs(y - LINES.writing) <= 1);
		expect(onLine.length).toBeGreaterThanOrEqual(2);
		const xs = onLine.map(([x]) => x);
		// the cut runs along the line, wider than the stroke (it is slanted)
		expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(99);
		// the top is cut along the small-letter line the same way
		expect(Math.abs(Math.max(...ink.map(([, y]) => y)) - LINES.small)).toBeLessThanOrEqual(1);
	});

	it('an unpinned Flat end is square to the stroke, its corners kept within 1 unit', () => {
		const sketch = sketchOfPieces(
			'sk_t_free',
			{ a: { x: 300, y: 300, kind: 'corner' }, b: { x: 600, y: 700, kind: 'corner' } },
			[{ use: 'center', closed: false, parts: [{ type: 'line', from: 'a', to: 'b' }] }],
			{ ends: 'flat' }
		);
		const contours = build(sketch);
		const r = 99 / 2;
		const n = [-0.8, 0.6]; // the left normal of (0.6, 0.8)
		const want = [
			[300 + n[0] * r, 300 + n[1] * r],
			[300 - n[0] * r, 300 - n[1] * r],
			[600 + n[0] * r, 700 + n[1] * r],
			[600 - n[0] * r, 700 - n[1] * r],
		];
		const points = corners(contours);
		for (const corner of want) {
			expect(Math.min(...points.map((p) => near(p, corner))), `${corner}`).toBeLessThanOrEqual(1);
		}
	});

	it('one end Flat, one Round: the foot has corners, the top is round', () => {
		const contours = build(flatStem({ ends: 'round', start: 'flat' }));
		const points = corners(contours);
		const r = 99 / 2;
		expect(Math.min(...points.map((p) => near(p, [300 - r, 0])))).toBeLessThanOrEqual(1);
		// no corner at the top's sides: the round end's top is the stem's center top
		const ys = inkPoints(contours).map(([, y]) => y);
		expect(Math.abs(Math.max(...ys) - LINES.small)).toBeLessThanOrEqual(1);
		expect(Math.min(...points.map((p) => near(p, [300 - r, LINES.small])))).toBeGreaterThan(5);
	});

	it('an end joined to another piece is always Round, whatever the ends say', () => {
		const sketch = storedSketch('A');
		sketch.ends = 'flat';
		expect(endStyle(sketch, 'leftFoot')).toBe('flat');
		expect(endStyle(storedSketch('n'), 'join')).toBe('round'); // onPiece
		const shared = flatStem();
		shared.pieces.push({
			id: 2,
			key: 'pc_more',
			use: 'center',
			closed: false,
			parts: [{ type: 'line', from: 'top', to: 'foot' }],
		});
		expect(endStyle(shared, 'top')).toBe('round');
		shared.points.foot.end = 'flat';
		expect(endStyle(shared, 'foot')).toBe('round');
	});
});

describe('dots, rings, thickness', () => {
	it('a one-point piece is a dot: the round nib alone', () => {
		const sketch = sketchOfPieces('sk_t_dot', { d: { x: 400, y: 1300, kind: 'smooth' } }, [
			{ use: 'center', closed: false, parts: [spline('d')] },
		]);
		const contours = build(sketch);
		expect(contours).toHaveLength(1);
		for (const [x, y] of inkPoints(contours)) {
			expect(Math.abs(Math.hypot(x - 400, y - 1300) - 49.5)).toBeLessThan(1.5);
		}
	});

	it('a closed Centerline piece is a ring: an outline and its hole', () => {
		const contours = build(storedSketch('o'));
		expect(contours).toHaveLength(2);
		expect(contours.filter((contour) => contour.hole)).toHaveLength(1);
		const areas = contours.map((contour) => signedArea(flattenCubics(contour.curves)));
		expect(areas.filter((area) => area > 0)).toHaveLength(1);
		expect(areas.filter((area) => area < 0)).toHaveLength(1);
	});

	it('the sweep uses the edge rule thickness: a stored 600 is kept to the slider thick end', () => {
		const sketch = flatStem({ ends: 'round' });
		sketch.thickness = 600;
		const width = centerWidth(sketch, FONT);
		expect(width).toBe(Math.round(edgeThickness(FONT, 600)));
		expect(width).toBeLessThan(600);
		clearBuildCache();
		const { shapes } = buildSketch(sketch, { font: FONT });
		const xs = shapes.flatMap((shape) => flattenCubics(shape.curves)).map(([x]) => x);
		// the 24-sided nib sits a little outside the circle at its corners
		expect(Math.abs(Math.max(...xs) - Math.min(...xs) - width)).toBeLessThanOrEqual(3);
	});
});
