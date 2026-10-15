// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 fix pass (the B8 + B9 first-timer): the traced outlines no pen made (trace_region.js
// keepPenShapes, through keepShapesInPart and keepShapesFor). A part of nothing but ruled-line
// bits traced to four dots that replaced his H; a bit of blue rule came into the font beside
// his F. Shapes are font units through a photo at 2 font units per pixel, with a 12-pixel pen.
import { afterEach, describe, expect, it } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { setModeForTests } from '../../mode/mode.js';
import {
	SPECK_PEN_SHARE,
	THIN_PEN_SHARE,
	keepPenShapes,
	keepShapesFor,
	keepShapesInPart,
	outlineMeasure,
} from '../trace_region.js';

const SCALE = 2;
const PEN = 12;
// A 1000 x 600 photo, its top-left corner at (0, 1200): pixel (x, y) is (2x, 1200 - 2y)
const TRACE = { asset: 'img-pen00001', x: 0, y: 1200, width: 1000, height: 600, scale: SCALE };
// A part at pixels 100..200 across, 100..250 down
const PART = { id: 'p1', left: 100, top: 100, right: 200, bottom: 250, row: 0 };

/** A closed box at pixels (l, t)..(r, b), in font units. */
function px(l, t, r, b, name = 'Box') {
	const corner = (x, y) => ({ p: { coord: { x: TRACE.x + x * SCALE, y: TRACE.y - y * SCALE } } });
	return new Path({ name, pathPoints: [corner(l, b), corner(r, b), corner(r, t), corner(l, t)] });
}

/** A stem of the pen: 12 x 120 pixels, inside PART. */
const stem = () => px(140, 110, 152, 230, 'stem');
/** Four dashes of a dotted ruled line: 4 x 2 pixels each (the H's "four dots"). */
const dots = () => [0, 1, 2, 3].map((i) => px(110 + i * 20, 240, 114 + i * 20, 242, `dot${i}`));
/** A bit of a ruled line: 20 x 3 pixels (the gray dot beside the F). */
const ruleBit = () => px(170, 236, 190, 239, 'rule');
/** A dot of the pen (a period): 12 x 12 pixels. */
const penDot = () => px(160, 200, 172, 212, 'dot');

afterEach(() => setModeForTests('all'));

describe('keepPenShapes: specks and ruled-line bits alone are no letter', () => {
	it('the rule is B11 speck (a quarter of the pen squared) or under a third of the pen thick', () => {
		expect(SPECK_PEN_SHARE).toBe(0.25);
		expect(THIN_PEN_SHARE).toBe(0.35);
		// A box measures as itself: area and length
		const m = outlineMeasure(px(0, 0, 10, 5));
		expect(m.area).toBeCloseTo(10 * 5 * SCALE * SCALE, 6);
		expect(m.perimeter).toBeCloseTo(30 * SCALE, 6);
	});

	it('four tiny dots and nothing else: nothing at all, with or without Remove specks', () => {
		expect(keepPenShapes(dots(), { pen: PEN, scale: SCALE })).toEqual([]);
		expect(keepPenShapes(dots(), { pen: PEN, scale: SCALE, specks: false })).toEqual([]);
		expect(keepPenShapes([ruleBit()], { pen: PEN, scale: SCALE })).toEqual([]);
	});

	it('a letter with a ruled-line bit and specks beside it: the letter only, while Remove specks is on', () => {
		const shapes = [stem(), ruleBit(), ...dots()];
		const kept = keepPenShapes(shapes, { pen: PEN, scale: SCALE });
		expect(kept.map((s) => s.name)).toEqual(['stem']);
		// Remove specks off: he asked for everything
		const all = keepPenShapes(shapes, { pen: PEN, scale: SCALE, specks: false });
		expect(all).toHaveLength(shapes.length);
	});

	it("a period alone is a pen's dot, not a speck; a hole goes with its letter", () => {
		expect(keepPenShapes([penDot()], { pen: PEN, scale: SCALE }).map((s) => s.name)).toEqual([
			'dot',
		]);
		const ring = px(110, 110, 190, 190, 'o');
		const hole = px(122, 122, 178, 178, 'o hole');
		const kept = keepPenShapes([ring, hole, ruleBit()], { pen: PEN, scale: SCALE });
		expect(kept.map((s) => s.name)).toEqual(['o', 'o hole']);
	});

	it("a bit of rule in the empty corner of the F's box is no hole of the F: it goes", () => {
		// An F's outline, its box 130..190 across, 110..230 down; the bit sits at its lower right
		const at = ([x, y]) => ({ p: { coord: { x: TRACE.x + x * SCALE, y: TRACE.y - y * SCALE } } });
		const f = new Path({
			name: 'F',
			pathPoints: [
				[130, 230],
				[142, 230],
				[142, 172],
				[175, 172],
				[175, 160],
				[142, 160],
				[142, 122],
				[190, 122],
				[190, 110],
				[130, 110],
			].map(at),
		});
		const bit = px(176, 224, 190, 227, 'rule');
		expect(keepPenShapes([f, bit], { pen: PEN, scale: SCALE }).map((s) => s.name)).toEqual(['F']);
		expect(keepShapesInPart([f, bit], PART, TRACE, { pen: PEN }).map((s) => s.name)).toEqual(['F']);
	});

	it('without the pen (or the scale) the shapes come back as they are', () => {
		const shapes = dots();
		expect(keepPenShapes(shapes, { pen: 0, scale: SCALE })).toBe(shapes);
		expect(keepPenShapes(shapes, { pen: PEN })).toBe(shapes);
	});
});

describe('keepShapesInPart and keepShapesFor take the pen in Simple', () => {
	it("a part of nothing but specks keeps nothing; a letter's part drops the bits beside it", () => {
		expect(keepShapesInPart(dots(), PART, TRACE, { pen: PEN })).toEqual([]);
		const kept = keepShapesInPart([stem(), ruleBit()], PART, TRACE, { pen: PEN });
		expect(kept.map((s) => s.name)).toEqual(['stem']);
		// No pen given: as before (every whole shape of the part)
		expect(keepShapesInPart(dots(), PART, TRACE)).toHaveLength(4);
	});

	it('keepShapesFor hands the pen on in Simple; All tools keeps the glyph box exactly', () => {
		setModeForTests('simple');
		const font = { upm: 1000, ascent: 800, descent: -200 };
		const item = { advanceWidth: 600 };
		expect(keepShapesFor(dots(), item, font, { part: PART, trace: TRACE, pen: PEN })).toEqual([]);
		setModeForTests('all');
		const inBox = [px(10, 300, 14, 302, 'speck in the glyph box')];
		expect(keepShapesFor(inBox, item, font, { part: PART, trace: TRACE, pen: PEN })).toHaveLength(
			1
		);
	});
});
