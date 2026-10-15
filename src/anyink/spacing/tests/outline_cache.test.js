// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B8 + B9 finalize (second hostile pass: in Simple a brush stroke's step slowed as the strokes
// on one letter piled up: 63 ms at the first, 483 ms at the 250th, 2 s at the 499th; the spacing
// hook measured every shape's outline from scratch at every step, and matched every outline
// against every other to find the holes). Each shape's flat outline is kept until the shape
// changes, and an outline is only tested against those whose box holds it. Written to fail on
// outline.js before the pass (no cache: a new outline object every time).
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { Path } from '../../../project_data/path.js';
import { inkPieces, itemContours, pathContour } from '../outline.js';

const corner = (x, y) => ({ p: { coord: { x, y } } });
const square = (x, y, size, { hole = false } = {}) => {
	const points = [
		corner(x, y),
		corner(x + size, y),
		corner(x + size, y + size),
		corner(x, y + size),
	];
	return new Path({ name: 'Square', pathPoints: hole ? points.reverse() : points });
};

describe("a shape's outline is kept until the shape changes", () => {
	it('the same shape gives the same outline object; moving a point gives a new one', () => {
		const path = square(0, 0, 100);
		const first = pathContour(path);
		expect(pathContour(path)).toBe(first);
		path.pathPoints[1].p.x = 140;
		const moved = pathContour(path);
		expect(moved).not.toBe(first);
		expect(Math.max(...moved.points.map(([x]) => x))).toBe(140);
		expect(pathContour(path)).toBe(moved);
	});

	it('the pieces of ink are as before: holes found in the ink round them, and only there', () => {
		const item = new Glyph({
			shapes: [square(0, 0, 300), square(100, 100, 100, { hole: true }), square(1000, 0, 300)],
		});
		const pieces = inkPieces(itemContours(item));
		expect(pieces).toHaveLength(2);
		expect(pieces[0].area).toBe(300 * 300 - 100 * 100);
		expect(pieces[0].contours).toHaveLength(2);
		expect(pieces[1].area).toBe(300 * 300);
	});

	it('500 rings (an outline and its hole each, 64 sides): measured again quickly', () => {
		const polygon = (cx, cy, r, { hole = false } = {}) => {
			const points = Array.from({ length: 64 }, (_, k) => {
				const a = (2 * Math.PI * k) / 64;
				return corner(cx + r * Math.cos(a), cy + r * Math.sin(a));
			});
			return new Path({ name: 'Ring', pathPoints: hole ? points.reverse() : points });
		};
		const shapes = [];
		for (let i = 0; i < 500; i++) {
			const [cx, cy] = [(i % 25) * 100, Math.floor(i / 25) * 100];
			shapes.push(polygon(cx, cy, 45), polygon(cx, cy, 25, { hole: true }));
		}
		const item = new Glyph({ shapes });
		inkPieces(itemContours(item));
		const t0 = performance.now();
		const pieces = inkPieces(itemContours(item));
		const ms = performance.now() - t0;
		expect(pieces).toHaveLength(500);
		expect(pieces.every((piece) => piece.contours.length === 2)).toBe(true);
		// before: 1121 ms on the test machine; now about 50
		expect(ms).toBeLessThan(200);
	});
});
