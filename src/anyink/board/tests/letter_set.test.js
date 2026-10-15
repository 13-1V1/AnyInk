// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 finalize: one rule for "ink", "Ready" and "empty" (UX-BEGINNER.md 4.2 Ready, 4.3 Empty
	letter), shared by the rail's count, the Next line, the letter card's chip and the empty
	overlay, so they never disagree:
	  ink      the letter's finished shapes that hold ink: an area (a stray line of one or two
	           clicked points holds none), never the shape the Point pen is still drawing
	  Ready    has ink (B11 adds its checks)
	  empty    no finished shape at all: a letter whose only shape is a stray line is neither
	           empty nor Ready (the font check names its shape, and its Fix it takes it away)
*/
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { Path } from '../../../project_data/path.js';
import { finishedShapes, hasInk, inkOf, isEmptyLetter } from '../letter_set.js';

const corner = (x, y) => ({ p: { coord: { x, y } } });
const square = () =>
	new Path({ name: 'Square', pathPoints: [corner(0, 0), corner(400, 0), corner(400, 400), corner(0, 400)] });
const line = () => new Path({ name: 'Line', pathPoints: [corner(0, 0), corner(300, 0)] });
const dot = () => new Path({ name: 'Dot', pathPoints: [corner(0, 0)] });

function letter(...paths) {
	const item = new Glyph({ id: 'glyph-0x61' });
	return { item, shapes: paths.map((path) => item.addOneShape(path)) };
}

describe('one rule for ink, Ready and empty', () => {
	it('a finished square: ink, Ready, not empty', () => {
		const { item } = letter(square());
		expect(inkOf(item)).toHaveLength(1);
		expect(hasInk(item)).toBe(true);
		expect(isEmptyLetter(item)).toBe(false);
	});

	it('a stray line of two clicked points: no ink, not Ready, and not empty either', () => {
		const { item } = letter(line());
		expect(hasInk(item)).toBe(false);
		expect(isEmptyLetter(item)).toBe(false);
		expect(finishedShapes(item)).toHaveLength(1);
	});

	it('the shape the Point pen is still drawing is no ink and no finished shape', () => {
		const { item, shapes } = letter(dot());
		expect(hasInk(item, { open: shapes[0] })).toBe(false);
		expect(isEmptyLetter(item, { open: shapes[0] })).toBe(true);
		expect(finishedShapes(item, { open: shapes[0] })).toEqual([]);
		// three points: an area, still open
		const { item: three, shapes: drawn } = letter(
			new Path({ pathPoints: [corner(0, 0), corner(400, 0), corner(400, 400)] })
		);
		expect(hasInk(three, { open: drawn[0] })).toBe(false);
		expect(hasInk(three)).toBe(true);
	});

	it('a square and an open shape beside it: Ready (the square), the open one left out', () => {
		const { item, shapes } = letter(square(), dot());
		expect(hasInk(item, { open: shapes[1] })).toBe(true);
		expect(inkOf(item, { open: shapes[1] })).toEqual([shapes[0]]);
		expect(finishedShapes(item, { open: shapes[1] })).toEqual([shapes[0]]);
	});

	it('no letter, or no shapes: empty, no ink', () => {
		expect(hasInk(null)).toBe(false);
		expect(isEmptyLetter(null)).toBe(true);
		expect(isEmptyLetter(new Glyph({ id: 'glyph-0x62' }))).toBe(true);
	});
});
