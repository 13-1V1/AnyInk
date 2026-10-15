// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 fix (letter tools): auto-hole decides by what shows under a new shape, not by counting
	the shapes around it, and makes it show exactly that. Counting went wrong when shapes overlap
	or were drawn inside-out:
	  - two holes drawn inside one shape that overlap each other: both were holes, and where they
	    crossed the ink came back (a lens of ink inside the hole)
	  - a shape drawn where two solid shapes overlap counted two shapes around it, so it stayed
	    solid, and the Solid / Hole switch was never offered for it
	  - the inner shape drawn first, the outer around it: both stayed solid, no hole, no toast
	Ink is read the way the canvas and the font file fill (nonzero): windingAt() 0 is paper.
	Every case also checks that nothing outside the new shape changes how it looks.
*/
import { describe, expect, it } from 'vitest';
import { autoHole, canBeHole, setShapeRole, shapeRole } from '../auto_hole.js';
import { box, letterWith, polygon, windingAt } from './auto_hole_shapes.js';

/** Ink or paper on a 25-unit grid over the letter, leaving out the inside of one box */
function inkOutside(glyph, [x1, y1, x2, y2] = [0, 0, 0, 0]) {
	const marks = [];
	for (let x = -12.5; x <= 1012.5; x += 25) {
		for (let y = -12.5; y <= 1012.5; y += 25) {
			if (x > x1 && x < x2 && y > y1 && y < y2) continue;
			marks.push(windingAt(glyph, x, y) !== 0);
		}
	}
	return marks;
}

const whole = (glyph) =>
	glyph.shapes.every((shape) =>
		shape.pathPoints.every((point) =>
			[point.p.x, point.p.y, point.h1.x, point.h1.y, point.h2.x, point.h2.y].every(Number.isInteger)
		)
	);

describe('two holes drawn inside one shape that overlap each other', () => {
	it('become one hole: paper where they cross, the ring around them still ink', () => {
		const { glyph, shapes } = letterWith(
			box(0, 0, 1000, 1000),
			box(200, 200, 600, 600),
			box(400, 400, 800, 800)
		);
		expect(autoHole(glyph, shapes[1]).role).toBe('hole');
		const outside = inkOutside(glyph, [200, 200, 800, 800]);

		const result = autoHole(glyph, glyph.shapes[2]);

		expect(result).toMatchObject({ role: 'hole', number: 2, merged: 'holes' });
		expect(glyph.shapes).toHaveLength(2);
		expect(result.shape).toBe(glyph.shapes[1]);
		expect(shapeRole(glyph, glyph.shapes[1])).toBe('hole');
		expect(windingAt(glyph, 500, 500)).toBe(0); // where they cross: no lens of ink
		expect(windingAt(glyph, 300, 300)).toBe(0);
		expect(windingAt(glyph, 700, 700)).toBe(0);
		expect(windingAt(glyph, 300, 700)).not.toBe(0); // between them, still ink
		expect(inkOutside(glyph, [200, 200, 800, 800])).toEqual(outside);
		expect(whole(glyph)).toBe(true);
	});

	it('two bars crossing as a plus sign make one plus-shaped hole', () => {
		const { glyph, shapes } = letterWith(box(0, 0, 1000, 1000), box(100, 400, 900, 600));
		autoHole(glyph, shapes[1]);
		const result = autoHole(glyph, glyph.addOneShape(box(400, 100, 600, 900)));
		expect(result).toMatchObject({ role: 'hole', merged: 'holes' });
		expect(glyph.shapes).toHaveLength(2);
		expect(windingAt(glyph, 500, 500)).toBe(0); // the middle of the plus
		expect(windingAt(glyph, 200, 500)).toBe(0);
		expect(windingAt(glyph, 500, 200)).toBe(0);
		expect(windingAt(glyph, 200, 200)).not.toBe(0);
	});

	it('a hole drawn across two holes joins all three', () => {
		const { glyph, shapes } = letterWith(
			box(0, 0, 1000, 1000),
			box(100, 400, 300, 600),
			box(700, 400, 900, 600)
		);
		autoHole(glyph, shapes[1]);
		autoHole(glyph, glyph.shapes[2]);
		const bar = glyph.addOneShape(box(200, 450, 800, 550));
		const result = autoHole(glyph, bar);
		expect(result).toMatchObject({ role: 'hole', number: 2, merged: 'holes' });
		expect(glyph.shapes).toHaveLength(2);
		[150, 250, 500, 750, 850].forEach((x) => expect(windingAt(glyph, x, 500)).toBe(0));
		expect(windingAt(glyph, 500, 300)).not.toBe(0);
	});
});

describe('a shape drawn where two solid shapes overlap', () => {
	/** Two solids drawn one after the other, overlapping; then a box in their overlap */
	function overlapThenBox() {
		const { glyph, shapes } = letterWith(box(0, 0, 400, 400), box(200, 0, 600, 400));
		expect(autoHole(glyph, shapes[1]).role).toBe('solid'); // as the tool left it
		return glyph;
	}

	it('is a hole: the two shapes around it become one, so it can cancel their ink', () => {
		const glyph = overlapThenBox();
		const outside = inkOutside(glyph, [250, 150, 350, 250]);

		const result = autoHole(glyph, glyph.addOneShape(box(250, 150, 350, 250)));

		expect(result).toMatchObject({ role: 'hole', number: 2, merged: 'around' });
		expect(glyph.shapes).toHaveLength(2);
		expect(windingAt(glyph, 300, 200)).toBe(0);
		expect(inkOutside(glyph, [250, 150, 350, 250])).toEqual(outside);
		expect(whole(glyph)).toBe(true);
	});

	it('its Solid / Hole switch is offered and works both ways', () => {
		const glyph = overlapThenBox();
		const { shape } = autoHole(glyph, glyph.addOneShape(box(250, 150, 350, 250)));
		expect(canBeHole(glyph, shape)).toBe(true);
		expect(setShapeRole(glyph, shape, 'solid')).toBe(true);
		expect(windingAt(glyph, 300, 200)).not.toBe(0);
		expect(setShapeRole(glyph, shape, 'hole')).toBe(true);
		expect(windingAt(glyph, 300, 200)).toBe(0);
	});

	it('inside a solid drawn inside a solid (ink on ink): a hole too', () => {
		const { glyph } = letterWith(
			box(0, 0, 800, 800),
			box(100, 100, 700, 700) // drawn solid inside, in All tools
		);
		const outside = inkOutside(glyph, [200, 200, 600, 600]);
		expect(autoHole(glyph, glyph.addOneShape(box(200, 200, 600, 600)))).toMatchObject({
			role: 'hole',
		});
		expect(windingAt(glyph, 400, 400)).toBe(0);
		expect(inkOutside(glyph, [200, 200, 600, 600])).toEqual(outside);
	});

	it('stays solid, as it was, when joining the shapes around it would change what shows elsewhere', () => {
		// a hole in the right shape reaches into the overlap: joining the two would open it there
		const glyph = overlapThenBox();
		autoHole(glyph, glyph.addOneShape(box(300, 30, 500, 120)));
		const before = inkOutside(glyph);
		const result = autoHole(glyph, glyph.addOneShape(box(250, 200, 350, 300)));
		expect(result).toMatchObject({ role: 'solid', blocked: true });
		expect(glyph.shapes).toHaveLength(4);
		expect(inkOutside(glyph)).toEqual(before);
		expect(canBeHole(glyph, glyph.shapes[3])).toBe(false);
	});
});

describe('drawn the other way round: the inner shape first, then the outer one around it', () => {
	it('the inner shape becomes a hole, in the same go', () => {
		const { glyph, shapes } = letterWith(box(300, 300, 700, 700));
		expect(autoHole(glyph, shapes[0]).role).toBe('solid');
		const outer = glyph.addOneShape(box(0, 0, 1000, 1000));

		const result = autoHole(glyph, outer);

		expect(result).toMatchObject({ role: 'solid', number: 2 });
		expect(result.also).toEqual([
			expect.objectContaining({ number: 1, role: 'hole', shape: glyph.shapes[0] }),
		]);
		expect(windingAt(glyph, 500, 500)).toBe(0);
		expect(windingAt(glyph, 100, 100)).not.toBe(0);
		expect(shapeRole(glyph, glyph.shapes[0])).toBe('hole');
	});

	it('a bullseye drawn from the inside out alternates like one drawn from the outside in', () => {
		const rings = [
			box(300, 300, 500, 500),
			box(200, 200, 600, 600),
			box(100, 100, 700, 700),
			box(0, 0, 800, 800),
		];
		const { glyph } = letterWith(rings[0]);
		autoHole(glyph, glyph.shapes[0]);
		rings.slice(1).forEach((ring) => autoHole(glyph, glyph.addOneShape(ring)));
		// ink, paper, ink, paper from the outside in
		const ink = [50, 150, 250, 400].map((x) => windingAt(glyph, x, 400) !== 0);
		expect(ink).toEqual([true, false, true, false]);
	});

	it('a shape drawn around shapes that are already right leaves them be', () => {
		const { glyph, shapes } = letterWith(box(0, 0, 400, 400), box(100, 100, 300, 300));
		autoHole(glyph, shapes[1]); // a hole in the first
		const big = glyph.addOneShape(box(500, 0, 900, 400)); // beside them, around nothing
		expect(autoHole(glyph, big).also).toEqual([]);
	});
});

// B6 + B7 finalize (verifier variants VD and VE)
describe('two holes whose overlap rings an island (a U, then an upside-down U across its arms)', () => {
	it('become one hole with the island kept as ink: paper at both overlaps, ink in the island', () => {
		const { glyph } = letterWith(box(0, 0, 1000, 1000));
		const u = polygon(
			[
				[200, 800],
				[300, 800],
				[300, 300],
				[700, 300],
				[700, 800],
				[800, 800],
				[800, 200],
				[200, 200],
			],
			'U'
		);
		autoHole(glyph, glyph.addOneShape(u));
		const n = polygon(
			[
				[150, 900],
				[850, 900],
				[850, 700],
				[750, 700],
				[750, 850],
				[250, 850],
				[250, 700],
				[150, 700],
			],
			'n'
		);
		const before = inkOutside(glyph, [140, 190, 860, 910]);
		const result = autoHole(glyph, glyph.addOneShape(n));
		expect(result.role).toBe('hole');
		expect(result.merged).toBe('holes');
		expect(windingAt(glyph, 225, 750)).toBe(0); // overlap, left
		expect(windingAt(glyph, 775, 750)).toBe(0); // overlap, right
		expect(windingAt(glyph, 500, 250)).toBe(0); // the U alone
		expect(windingAt(glyph, 500, 875)).toBe(0); // the cap alone
		expect(windingAt(glyph, 500, 500)).not.toBe(0); // the island
		expect(windingAt(glyph, 50, 50)).not.toBe(0); // the outer shape's ink
		expect(inkOutside(glyph, [140, 190, 860, 910])).toEqual(before);
		expect(whole(glyph)).toBe(true);
	});
});

describe('a shape drawn where three solid shapes overlap', () => {
	it('is a hole: the three become one shape, nothing outside the new shape changes', () => {
		const { glyph } = letterWith(box(0, 0, 500, 500));
		autoHole(glyph, glyph.addOneShape(box(200, 0, 700, 500)));
		autoHole(glyph, glyph.addOneShape(box(100, 200, 600, 700)));
		const before = inkOutside(glyph, [300, 250, 400, 350]);
		const result = autoHole(glyph, glyph.addOneShape(box(300, 250, 400, 350)));
		expect(result.blocked).toBe(false);
		expect(result.role).toBe('hole');
		expect(result.merged).toBe('around');
		expect(windingAt(glyph, 350, 300)).toBe(0);
		expect(canBeHole(glyph, result.shape)).toBe(true);
		expect(inkOutside(glyph, [300, 250, 400, 350])).toEqual(before);
		expect(whole(glyph)).toBe(true);
	});
});
