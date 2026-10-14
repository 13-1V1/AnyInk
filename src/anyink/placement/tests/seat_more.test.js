// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 finalize (hostile pass on the placement fix): three seats that came out wrong.
// - A photo turned 5 or 6 degrees: the bottom "held square" sits under the middle of the
//   letter, but the traced letter keeps the photo's turn, so a letter whose feet end up level
//   floated by the turn (an A +56 units at 5 degrees, past B11's 41). The square bottom is now
//   held within 1 % of the letter box of the lowest ink.
// - A g or p whose bowl closes above the writing line dropped by the gap (p's top at 820
//   against n's 1068), its tail past the tail line. In a row with a writing line, a bowl that
//   disagrees with the line by more than BOWL_AGREE_SHARE of the body, and by more than
//   LINE_TRUST_SPREADS times how far his letters usually sit off their lines, gives way to
//   the line; in a messy row a whole letter written low keeps its bowl.
// - A Q, J or f whose tail dips less than the tail guess sat its tail end on the line and
//   floated by the whole tail. With a row or partner line, one whose ink hangs under the line
//   sits on the line instead.
import { describe, expect, it } from 'vitest';
import { lineTargets } from '../classes.js';
import { placePart } from '../fit_lines.js';
import { partGeometry } from '../seat.js';
import { arc, drawPart } from './raster.js';
import { photoOf, turner } from './letters.js';

const FONT = { upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };
const BOX = 2048;
const O = 0.015 * BOX;
const TWO_PI = Math.PI * 2;
const W = 1600;
const H = 700;
// photoOf: 2 px per cap unit, a 12 px pen; a stroke on the writing line ends at 306 px.
const LINE_PX = 306;

const fontY = (placed, px) => placed.y - px * placed.scale;

/** A part drawn from strokes in cap units, placed and turned like photoOf's letters */
function customPart(strokes, { id, x0, base = 300, unit = 2, pen = 12, tilt = 0 }) {
	const turn = turner(tilt, W, H);
	const pixels = strokes.map((stroke) =>
		stroke.map(([x, y]) => turn([x0 + x * unit, base + y * unit]))
	);
	return drawPart(pixels, pen, { width: W, height: H, id });
}

/** photoOf, with some parts swapped for custom strokes (same id and name) */
function photoWith(specs, custom, { tilt = 0 } = {}) {
	const photo = photoOf(specs, { width: W, height: H, tilt });
	for (const [index, strokes] of Object.entries(custom)) {
		const spec = specs[index];
		const id = `p${Number(index) + 1}`;
		photo.parts[index] = customPart(strokes, { id, x0: spec.x0, base: spec.base, tilt });
	}
	return photo;
}

describe('a photo turned 5 or 6 degrees: no letter floats off the line', () => {
	// An A whose left leg he wrote longer: turned 5 degrees, both feet end up level
	const longLeftLeg = [
		[
			[0, 5],
			[28, -100],
			[56, 0],
		],
		[
			[12, -40],
			[44, -40],
		],
	];
	const specs = [
		{ char: 'B', x0: 60 },
		{ char: 'a', x0: 220 },
		{ char: 'A', x0: 340 },
		{ char: 'n', x0: 500 },
		{ char: 'H', x0: 620 },
		{ char: 'e', x0: 780 },
	];

	it.each([5, 6, -5])(
		'turned %i degrees: every lowest ink within 1 % of the box of its line',
		(tilt) => {
			const photo = photoWith(specs, { 2: longLeftLeg }, { tilt });
			for (const part of photo.parts) {
				const placed = placePart(photo, part.id, FONT);
				const target = lineTargets(photo.uses[part.id].char, FONT).bottom;
				const bottom = fontY(placed, partGeometry(part).bottom);
				expect(Math.abs(bottom - target), part.id).toBeLessThanOrEqual(0.01 * BOX + 1);
			}
		}
	);
});

describe('a g or p whose bowl closes above the writing line, in a row', () => {
	// The bowl's bottom 15 % of the body (9 cap units) above the line; the stem runs on down
	const highBowlP = [
		[
			[0, -60],
			[0, 44],
		],
		arc(22, -34.5, 22, 25.5, 0, TWO_PI),
	];
	const highBowlG = [
		arc(22, -34.5, 22, 25.5, 0, TWO_PI),
		[
			[44, -60],
			[44, 26],
		],
		arc(24, 26, 20, 18, 0, Math.PI),
	];
	const specs = [
		{ char: 'a', x0: 60 },
		{ char: 'n', x0: 200 },
		{ char: 'p', x0: 330 },
		{ char: 'o', x0: 460 },
		{ char: 'g', x0: 600 },
		{ char: 'm', x0: 740 },
	];

	it('its pen line lands on the writing line, so its body is as tall as its neighbors', () => {
		const photo = photoWith(specs, { 2: highBowlP, 4: highBowlG });
		for (const id of ['p3', 'p5']) {
			const placed = placePart(photo, id, FONT);
			expect(placed.bodyFrom, id).toBe('row');
			expect(Math.abs(fontY(placed, LINE_PX)), id).toBeLessThanOrEqual(0.005 * BOX);
		}
	});

	it('in a messy row (letters scattered about the line), a whole p written low keeps its bowl', () => {
		const bases = [300, 311, 315, 289, 309, 293];
		const photo = photoOf(
			specs.map((spec, index) => ({ ...spec, base: bases[index] })),
			{ width: W, height: H }
		);
		const placed = placePart(photo, 'p3', FONT);
		expect(placed.bodyFrom).toBe('counter');
		expect(Math.abs(fontY(placed, 315 + 6))).toBeLessThanOrEqual(0.005 * BOX);
	});

	it('a bowl that reaches the line still seats by its bowl', () => {
		const photo = photoOf(specs, { width: W, height: H });
		for (const id of ['p3', 'p5']) expect(placePart(photo, id, FONT).bodyFrom, id).toBe('counter');
	});
});

describe('a Q, J or f whose tail dips less than the tail guess', () => {
	// The tail ends 8 cap units under the line: 8 % of a capital, under the 15 % guess
	const shortTailQ = [
		arc(34, -50, 34, 50, 0, TWO_PI, 120),
		[
			[40, -16],
			[70, 8],
		],
	];
	const dippingF = [
		[[16, 8], [16, -90], ...arc(28, -90, 12, 14, Math.PI, TWO_PI)],
		[
			[2, -60],
			[34, -60],
		],
	];

	it('a Q in a row of capitals sits its bowl on the line, not its tail end', () => {
		const specs = [
			{ char: 'A', x0: 60 },
			{ char: 'Y', x0: 200 },
			{ char: 'Q', x0: 340 },
			{ char: 'H', x0: 520 },
			{ char: 'B', x0: 660 },
		];
		const photo = photoWith(specs, { 2: shortTailQ });
		const placed = placePart(photo, 'p3', FONT);
		expect(placed.tail).toBe(false);
		// The bowl's ink bottom (on the pen line) lands where a round letter's bottom goes
		expect(Math.abs(fontY(placed, LINE_PX) - -O)).toBeLessThanOrEqual(0.005 * BOX);
	});

	it('an f in a row of small letters sits on the line, not on its dip', () => {
		const specs = [
			{ char: 'a', x0: 60 },
			{ char: 'n', x0: 200 },
			{ char: 'f', x0: 330 },
			{ char: 'm', x0: 430 },
			{ char: 'u', x0: 570 },
		];
		const photo = photoWith(specs, { 2: dippingF });
		const placed = placePart(photo, 'p3', FONT);
		expect(placed.tail).toBe(false);
		expect(Math.abs(fontY(placed, LINE_PX))).toBeLessThanOrEqual(0.005 * BOX);
	});

	it('his [No tail] wins: the Q then sits on its ink bottom', () => {
		const specs = [
			{ char: 'A', x0: 60 },
			{ char: 'Y', x0: 200 },
			{ char: 'Q', x0: 340, use: { tail: false } },
			{ char: 'H', x0: 520 },
			{ char: 'B', x0: 660 },
		];
		const photo = photoWith(specs, { 2: shortTailQ });
		const placed = placePart(photo, 'p3', FONT);
		expect(placed.bodyFrom).toBe('ink');
		expect(Math.abs(fontY(placed, partGeometry(photo.parts[2]).bottom) - -O)).toBeLessThanOrEqual(
			0.005 * BOX
		);
	});

	it('an f beside one a (a partner line) sits on that line too', () => {
		const specs = [
			{ char: 'a', x0: 60 },
			{ char: 'f', x0: 220 },
		];
		const photo = photoWith(specs, { 1: dippingF });
		const placed = placePart(photo, 'p2', FONT);
		expect(Math.abs(fontY(placed, LINE_PX))).toBeLessThanOrEqual(0.005 * BOX);
	});
});
