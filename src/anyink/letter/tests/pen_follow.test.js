// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6 + B7 fix: which shape is the Point pen's after Undo or Redo wrote the letter back as new
// objects (letter/pen_follow.js). Same place in the list, a point shorter or longer, the rest of
// the points where they were, measured from the first point (automatic spacing slides the
// whole letter sideways at each step).
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { shapeAtPlace, shapePlace } from '../pen_follow.js';
import { polygon } from './auto_hole_shapes.js';

const letter = (...shapes) => new Glyph({ id: 'glyph-0x61', shapes });
const points = [
	[0, 0],
	[500, 0],
	[500, 600],
];

describe('shapePlace / shapeAtPlace', () => {
	const held = letter(polygon([[900, 900], [950, 900], [950, 950]]), polygon(points)).shapes[1];
	const place = shapePlace(held);

	it('knows the letter and the place in its list', () => {
		expect(place).toMatchObject({ itemID: 'glyph-0x61', index: 1 });
		expect(place.outline).toEqual(points);
	});

	it('finds the same shape a point shorter, a point longer, or slid sideways', () => {
		const shorter = letter(polygon([[900, 900], [950, 900], [950, 950]]), polygon(points.slice(0, 2)));
		expect(shapeAtPlace(shorter, place)).toBe(shorter.shapes[1]);
		const longer = letter(polygon([[900, 900], [950, 900], [950, 950]]), polygon([...points, [0, 600]]));
		expect(shapeAtPlace(longer, place)).toBe(longer.shapes[1]);
		const slid = letter(
			polygon([[900, 900], [950, 900], [950, 950]]),
			polygon(points.map(([x, y]) => [x - 66, y]))
		);
		expect(shapeAtPlace(slid, place)).toBe(slid.shapes[1]);
	});

	it('takes nothing else: another letter, another place, other points, two points off', () => {
		const other = new Glyph({ id: 'glyph-0x62', shapes: [polygon([[1, 1]]), polygon(points)] });
		expect(shapeAtPlace(other, place)).toBeNull();
		expect(shapeAtPlace(letter(polygon(points)), place)).toBeNull();
		const moved = letter(polygon([[900, 900]]), polygon([[0, 0], [500, 50], [500, 600]]));
		expect(shapeAtPlace(moved, place)).toBeNull();
		const short = letter(polygon([[900, 900]]), polygon(points.slice(0, 1)));
		expect(shapeAtPlace(short, place)).toBeNull();
	});

	it('exact: only the very same points (a shape Redo brings back whole)', () => {
		const same = letter(polygon([[900, 900]]), polygon(points));
		expect(shapeAtPlace(same, place, { exact: true })).toBe(same.shapes[1]);
		const longer = letter(polygon([[900, 900]]), polygon([...points, [0, 600]]));
		expect(shapeAtPlace(longer, place, { exact: true })).toBeNull();
	});
});
