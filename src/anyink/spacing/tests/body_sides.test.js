// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 fix (first-timer lens, finding 2): a drifted i dot or a tail that hooks left widened the
// letter's box and opened holes in words ("mi n i mum"). Side gaps and measured side kinds now
// come from the letter's body: the ink between the writing line and the letter's own top line.
// Dots, accents above and tails below never set a side by themselves. B3 finalize: they may hang
// into the space beside the letter, but stop 0.1 G short of its width (hang.test.js); further
// out, the side moves out just enough. Punctuation is measured whole, and a letter drawn far off
// its lines is measured on all of its ink.
// Uses only fitSpacing, measuredSides and the fixtures, so it fails on the numbers.
import { describe, expect, it } from 'vitest';
import { fitSpacing } from '../auto_space.js';
import { inkBounds, measuredSides } from '../measure.js';
import {
	GRIDS,
	closestGap,
	dottedI,
	letter,
	oval,
	polygon,
	rect,
	ring,
	spacingProject,
	tailedG,
} from './fixtures.js';

const AUTO = { spacing: 'auto' };

/** One automatic letter, fitted; returns the letter */
function fitted(grid, char, shapes) {
	const project = spacingProject(grid, { [char]: { shapes, anyink: AUTO } });
	const item = letter(project, char);
	fitSpacing(item, project);
	return item;
}

/** Where a letter's first shape (its body) starts, and the width */
const bodyOf = (item) => ({ left: item.shapes[0].maxes.xMin, width: item.advanceWidth });

describe.each([1000, 2048])('sides come from the body at %i units', (grid) => {
	const font = GRIDS[grid];
	const G = font.xHeight * 0.08;
	const S = Math.round(G);
	const R = Math.round(0.6 * G);
	const stroke = Math.round(font.xHeight * 0.12);

	it('an i whose dot drifted right, within the space beside the stem, gets the same gaps as a straight-dotted i', () => {
		const straight = fitted(grid, 'i', dottedI(font, 100, 0));
		const drifted = fitted(grid, 'i', dottedI(font, 100, Math.floor(0.8 * G)));
		expect(bodyOf(straight)).toEqual({ left: S, width: stroke + 2 * S });
		expect(bodyOf(drifted)).toEqual(bodyOf(straight));
		expect(closestGap(drifted, drifted)).toBe(closestGap(straight, straight));
	});

	it('a dot drifted a whole stroke right widens the i only as far as it must', () => {
		const drifted = fitted(grid, 'i', dottedI(font, 100, stroke));
		// The stem keeps its left space; the dot ends 0.1 G inside the width
		expect(bodyOf(drifted).left).toBe(S);
		expect(drifted.advanceWidth - inkBounds(drifted).xMax).toBeCloseTo(0.1 * G, -0.5);
		expect(drifted.advanceWidth).toBeLessThan(2 * stroke + 2 * S);
	});

	it('a dot drifted left of the stem never pushes the stem right by more than it must', () => {
		const near = fitted(grid, 'i', dottedI(font, 400, -Math.floor(0.8 * G)));
		expect(bodyOf(near)).toEqual({ left: S, width: stroke + 2 * S });
		const far = fitted(grid, 'i', dottedI(font, 400, -2 * stroke));
		expect(inkBounds(far).xMin).toBeCloseTo(0.1 * G, -0.5);
		expect(far.advanceWidth - far.shapes[0].maxes.xMax).toBe(S);
	});

	it("a g's tail hooking left reaches into the space before it, up to 0.1 G short of the letter's edge", () => {
		const plain = fitted(grid, 'g', tailedG(font, 300, { hook: 0 }));
		const short = fitted(grid, 'g', tailedG(font, 300, { hook: Math.floor(0.4 * G) }));
		const long = fitted(grid, 'g', tailedG(font, 300, { hook: 150 }));
		// The bowl is the body's left: a round side
		expect(bodyOf(plain).left).toBe(R);
		// A short hook hangs into the space before the bowl, as a hanging f's arm does
		expect(bodyOf(short)).toEqual(bodyOf(plain));
		expect(inkBounds(short).xMin).toBeLessThan(R);
		// A long one moves the bowl right until the hook stops 0.1 G inside the letter
		expect(inkBounds(long).xMin).toBeCloseTo(0.1 * G, -0.5);
	});

	it('an accent wider than its letter hangs into the space on both sides, never out of the width', () => {
		const e = (accent) => [
			...ring(300 + font.xHeight / 2, font.xHeight / 2, font.xHeight / 2, font.xHeight / 2, stroke),
			...(accent
				? [rect(100, font.xHeight + stroke, 500 + font.xHeight, font.xHeight + 2 * stroke)]
				: []),
		];
		const plain = fitted(grid, 'é', e(false));
		const accented = fitted(grid, 'é', e(true));
		const ink = inkBounds(accented);
		expect(ink.xMin).toBeCloseTo(0.1 * G, -0.5);
		expect(accented.advanceWidth - ink.xMax).toBeCloseTo(0.1 * G, -0.5);
		// The accent stands out past the letter's own sides: the letter is wider, by less than
		// the accent's overhang on both sides
		expect(accented.advanceWidth).toBeGreaterThan(plain.advanceWidth);
	});

	it("a Q's tail below the writing line hangs into the space after it, never out of the width", () => {
		const cap = font.capHeight;
		const q = (tail, reach) => [
			...ring(100 + cap / 2, cap / 2, cap / 2, cap / 2, stroke),
			...(tail ? [rect(100 + cap / 2, -stroke * 2, 100 + cap + reach, -stroke)] : []),
		];
		const plain = fitted(grid, 'Q', q(false));
		// A tail reaching 0.4 G past the bowl hangs into the space: the bowl's spacing stays
		expect(bodyOf(fitted(grid, 'Q', q(true, Math.floor(0.4 * G))))).toEqual(bodyOf(plain));
		// One reaching 0.4 of the capital height past it stops 0.1 G inside the width
		const long = fitted(grid, 'Q', q(true, 0.4 * cap));
		expect(long.advanceWidth - inkBounds(long).xMax).toBeCloseTo(0.1 * G, -0.5);
	});

	it("punctuation is measured whole: a comma's tail sets its left side", () => {
		const comma = fitted(grid, ',', [
			oval(300, stroke, stroke, stroke),
			polygon([
				[300 + stroke * 0.2, stroke],
				[300 + stroke, stroke],
				[300 - stroke * 2, -stroke * 4],
				[300 - stroke * 3, -stroke * 4],
			]),
		]);
		expect(inkBounds(comma).xMin).toBe(R);
	});

	it('a letter drawn far above its lines is measured on all of its ink', () => {
		const high = fitted(grid, 'n', [rect(100, font.ascent * 2, 100 + stroke, font.ascent * 3)]);
		expect(inkBounds(high).xMin).toBe(S);
		expect(high.advanceWidth).toBe(stroke + 2 * S);
	});

	it("a measured letter's side kinds come from its body too: a drifted mark is not a side", () => {
		// ɩ (iota) is not in the side table: a stem, with a mark drifted well right above it
		const project = spacingProject(grid, { ɩ: { shapes: dottedI(font, 100, 3 * stroke) } });
		expect(measuredSides(letter(project, 'ɩ'), font)).toEqual({ left: 'S', right: 'S' });
	});
});
