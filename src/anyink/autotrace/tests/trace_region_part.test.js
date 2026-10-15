// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 (UX-BEGINNER 4.4 "Never greyed out", section 10 B9): Simple traces the part of the photo he
// picked, not the glyph box (trace_region.js regionForPart, partBoxFontUnits, keepShapesInPart,
// and the two that choose: regionFor, keepShapesFor). All tools keeps the glyph box exactly.
import { afterEach, describe, expect, it } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { setModeForTests } from '../../mode/mode.js';
import {
	PART_MARGIN_MIN_PX,
	PART_MARGIN_SHARE,
	keepShapesFor,
	keepShapesInGlyphBox,
	keepShapesInPart,
	partBoxFontUnits,
	partMarginPx,
	regionFor,
	regionForGlyph,
	regionForPart,
} from '../trace_region.js';

const FONT = { upm: 1000, ascent: 800, descent: -200 };
const ITEM = { advanceWidth: 600 };
// A 1000 x 600 photo, 2 font units per pixel, its top-left corner at (-100, 900)
const TRACE = { asset: 'img-part0001', x: -100, y: 900, width: 1000, height: 600, scale: 2 };
// A part at pixels 200..260 across, 100..200 down
const PART = { id: 'p2', left: 200, top: 100, right: 260, bottom: 200, row: 0 };

/** A closed box in font units (counterclockwise when reversed is false). */
function box(x0, y0, x1, y1, name = 'Box') {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	return new Path({
		name,
		pathPoints: [corner(x0, y0), corner(x1, y0), corner(x1, y1), corner(x0, y1)],
	});
}

/** The font-unit box of pixel box (l, t, r, b) on TRACE. */
function fu(l, t, r, b) {
	return [TRACE.x + l * 2, TRACE.y - b * 2, TRACE.x + r * 2, TRACE.y - t * 2];
}

afterEach(() => setModeForTests('all'));

describe('regionForPart: the part, with paper round it', () => {
	it('grows the part by a quarter of its long side (at least 8 px), clamped to the photo', () => {
		// 60 x 100 part: margin 25 px
		expect(partMarginPx(PART)).toBe(25);
		expect(PART_MARGIN_SHARE).toBe(0.25);
		expect(regionForPart(PART, TRACE)).toEqual({ x: 175, y: 75, width: 110, height: 150 });
	});

	it('a period gets at least PART_MARGIN_MIN_PX of paper', () => {
		const dot = { id: 'p9', left: 500, top: 300, right: 510, bottom: 310 };
		expect(partMarginPx(dot)).toBe(PART_MARGIN_MIN_PX);
		expect(regionForPart(dot, TRACE)).toEqual({ x: 492, y: 292, width: 26, height: 26 });
	});

	it('a part at the edge of the photo is clamped; an explicit margin wins', () => {
		const corner = { id: 'p1', left: 0, top: 0, right: 40, bottom: 40 };
		expect(regionForPart(corner, TRACE)).toEqual({ x: 0, y: 0, width: 50, height: 50 });
		expect(regionForPart(PART, TRACE, { margin: 0 })).toEqual({
			x: 200,
			y: 100,
			width: 60,
			height: 100,
		});
	});

	it('nothing usable gives null', () => {
		expect(regionForPart(null, TRACE)).toBeNull();
		expect(regionForPart({ left: 5, top: 5, right: 5, bottom: 9 }, TRACE)).toBeNull();
		expect(regionForPart({ left: 2000, top: 0, right: 2100, bottom: 50 }, TRACE)).toBeNull();
		expect(regionForPart(PART, { width: 0, height: 10 })).toBeNull();
	});
});

describe('partBoxFontUnits', () => {
	it('maps the pixel box through the photo placement (y up)', () => {
		// x: -100 + 200 * 2 = 300 .. -100 + 260 * 2 = 420; y: 900 - 200 * 2 = 500 .. 900 - 100 * 2 = 700
		expect(partBoxFontUnits(PART, TRACE)).toEqual({ xMin: 300, xMax: 420, yMin: 500, yMax: 700 });
	});

	it('null without a usable part or placement', () => {
		expect(partBoxFontUnits(PART, { ...TRACE, scale: 0 })).toBeNull();
		expect(partBoxFontUnits(undefined, TRACE)).toBeNull();
	});
});

describe('keepShapesInPart: the whole shapes of the picked part', () => {
	it("keeps the part's outline and its hole; drops a neighbor reaching into the margin", () => {
		const outline = box(...fu(202, 102, 258, 198), 'outline');
		const hole = box(...fu(215, 120, 245, 150), 'hole');
		const neighbor = box(...fu(255, 110, 330, 190), 'neighbor'); // middle at px 292: outside
		const neighborHole = box(...fu(280, 130, 300, 150), 'neighbor hole');
		const kept = keepShapesInPart([outline, hole, neighbor, neighborHole], PART, TRACE);
		expect(kept.map((s) => s.name)).toEqual(['outline', 'hole']);
	});

	it('keeps a dot that is part of the part (an i dot inside its box)', () => {
		const stem = box(...fu(220, 140, 240, 200), 'stem');
		const dot = box(...fu(222, 100, 238, 116), 'dot');
		expect(keepShapesInPart([stem, dot], PART, TRACE).map((s) => s.name)).toEqual(['stem', 'dot']);
	});

	it('never rescues a mark above the part (the part already holds its own marks)', () => {
		const letter = box(...fu(202, 120, 258, 198), 'letter');
		// A period of the row above, in the margin over the part
		const mark = box(...fu(225, 80, 235, 92), 'mark');
		expect(keepShapesInPart([letter, mark], PART, TRACE).map((s) => s.name)).toEqual(['letter']);
	});

	it('no shapes, no part: nothing kept', () => {
		expect(keepShapesInPart([], PART, TRACE)).toEqual([]);
		expect(keepShapesInPart([box(0, 0, 10, 10)], null, TRACE)).toEqual([]);
	});
});

describe('regionFor / keepShapesFor: Simple takes the part, All tools the glyph box', () => {
	it('Simple with a part: the part rectangle and the part rule', () => {
		setModeForTests('simple');
		expect(regionFor(TRACE, ITEM, FONT, { part: PART })).toEqual(regionForPart(PART, TRACE));
		const outline = box(...fu(202, 102, 258, 198), 'outline');
		const neighbor = box(...fu(270, 110, 330, 190), 'neighbor');
		expect(
			keepShapesFor([outline, neighbor], ITEM, FONT, { part: PART, trace: TRACE }).map(
				(s) => s.name
			)
		).toEqual(['outline']);
	});

	it('All tools ignores the part: exactly the glyph box rule as before', () => {
		setModeForTests('all');
		expect(regionFor(TRACE, ITEM, FONT, { part: PART })).toEqual(regionForGlyph(TRACE, ITEM, FONT));
		expect(regionFor(TRACE, ITEM, FONT, { part: PART, margin: 250, marginTop: 500 })).toEqual(
			regionForGlyph(TRACE, ITEM, FONT, { margin: 250, marginTop: 500 })
		);
		const shapes = [box(100, 0, 300, 600, 'in box'), box(700, 0, 900, 600, 'past the box')];
		expect(keepShapesFor(shapes, ITEM, FONT, { part: PART, trace: TRACE })).toEqual(
			keepShapesInGlyphBox(shapes, ITEM, FONT)
		);
	});

	it('Simple with no part: the glyph box (the letter card has nothing picked)', () => {
		setModeForTests('simple');
		expect(regionFor(TRACE, ITEM, FONT)).toEqual(regionForGlyph(TRACE, ITEM, FONT));
	});
});
