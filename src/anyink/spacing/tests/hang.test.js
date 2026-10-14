// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 finalize (hostile pass on the spacing fix, new problem 1): once dots, accents and tails
// stopped setting a side, nothing limited how far they reached into the next letter's space.
// Tails ran into each other (gj, jj, yj and gg overlapped in the exported fonts) and an i dot
// drifted right sat on the l beside it. A mark or tail may now reach into the space beside its
// letter, but stops HANG_CLEAR x G short of the letter's own width; any ink further out widens
// the letter on that side. So no automatic letter's ink ever leaves its own width, and two
// hangs meeting at the same height keep at least 0.2 G of paper between them, even with the
// letter-spacing slider at its far left end.
// Also: an i dot written low (its bottom just under the stem top) is still a mark, not body.
// Uses only fitAllAutomatic, setExtra and the fixtures, so it fails on the numbers.
import { describe, expect, it } from 'vitest';
import { fitAllAutomatic, setExtra } from '../auto_space.js';
import { inkBounds } from '../measure.js';
import {
	GRIDS,
	closestGap,
	dottedI,
	letter,
	letterShapes,
	rect,
	shearShapes,
	spacingProject,
	tailedG,
} from './fixtures.js';

const AUTO = { spacing: 'auto' };

/** A j: a stem from the small-letter line down below the writing line, a hook at its foot
 * reaching `hook` units left of the stem, and a dot */
function hookedJ(font, x0, hook) {
	const x = font.xHeight;
	const w = Math.round(x * 0.12);
	const bottom = Math.round(font.descent * 0.8);
	return [
		rect(x0, bottom, x0 + w, x),
		rect(x0 - hook, bottom, x0 + w, bottom + w),
		rect(x0, x + w * 1.5, x0 + w, x + w * 2.5),
	];
}

/** A y whose tail hooks `hook` units left past the left arm */
function hookedY(font, x0, hook) {
	const x = font.xHeight;
	const w = Math.round(x * 0.12);
	const bottom = Math.round(font.descent * 0.8);
	return [...letterShapes('y', font, x0), rect(x0 - hook, bottom, x0 + w, bottom + w)];
}

/** Every letter automatic and fitted */
function fittedFont(grid, letters) {
	const project = spacingProject(grid, letters);
	fitAllAutomatic(project);
	return project;
}

describe.each([1000, 2048])('marks and tails at %i units', (grid) => {
	const font = GRIDS[grid];
	const G = font.xHeight * 0.08;
	const stroke = Math.round(font.xHeight * 0.12);
	// The fixture hooks of the hostile pass: 0.3 of the small-letter height
	const hook = Math.round(0.3 * font.xHeight);
	const tails = () =>
		fittedFont(grid, {
			g: { shapes: tailedG(font, 300, { hook }), anyink: AUTO },
			j: { shapes: hookedJ(font, 300, hook), anyink: AUTO },
			y: { shapes: hookedY(font, 300, hook), anyink: AUTO },
		});
	const gap = (project, pair) => closestGap(letter(project, pair[0]), letter(project, pair[1]));

	it.each(['gg', 'gj', 'jj', 'yj', 'jg', 'yg', 'gy', 'yy'])(
		'%s with long hooks: the tails never meet (at least 0.2 G apart)',
		(pair) => {
			expect(gap(tails(), pair)).toBeGreaterThanOrEqual(0.2 * G - 1);
		}
	);

	it.each([
		['il', 2],
		['li', -2],
		['ih', 2],
		['ii', 2],
	])('%s with the i dot drifted %i strokes: the dot never sits on the neighbor', (pair, shift) => {
		const project = fittedFont(grid, {
			i: { shapes: dottedI(font, 400, shift * stroke), anyink: AUTO },
			l: { anyink: AUTO },
			h: { shapes: letterShapes('l', font), anyink: AUTO },
		});
		expect(gap(project, pair)).toBeGreaterThanOrEqual(0.2 * G - 1);
	});

	it("no automatic letter's ink leaves its own width", () => {
		const project = tails();
		['g', 'j', 'y'].forEach((char) => {
			const item = letter(project, char);
			const ink = inkBounds(item);
			expect(ink.xMin, char).toBeGreaterThanOrEqual(0);
			expect(ink.xMax, char).toBeLessThanOrEqual(item.advanceWidth);
		});
	});

	it('a hook longer than the space beside it widens the letter just enough', () => {
		// g's left side is round: 0.6 G of space; the hook may reach 0.5 G into it
		const g = letter(tails(), 'g');
		expect(inkBounds(g).xMin).toBeCloseTo(0.1 * G, -0.5);
	});

	it('a short hook or a little drift stays inside the space: the side stays at the body', () => {
		const project = fittedFont(grid, {
			g: { shapes: tailedG(font, 300, { hook: Math.floor(0.4 * G) }), anyink: AUTO },
			i: { shapes: dottedI(font, 400, Math.floor(0.5 * G)), anyink: AUTO },
		});
		const plain = fittedFont(grid, {
			g: { shapes: tailedG(font, 300, { hook: 0 }), anyink: AUTO },
			i: { shapes: dottedI(font, 400, 0), anyink: AUTO },
		});
		const bodyLeft = (p, char) => letter(p, char).shapes[0].maxes.xMin;
		['g', 'i'].forEach((char) => {
			expect(bodyLeft(project, char), char).toBe(bodyLeft(plain, char));
			expect(letter(project, char).advanceWidth, char).toBe(letter(plain, char).advanceWidth);
		});
	});

	it('with the letter-spacing slider at its far left, long hooks touch at most, never overlap', () => {
		const project = tails();
		setExtra(project, -G * 2);
		['gg', 'gj', 'jj', 'yj', 'yy'].forEach((pair) => {
			expect(gap(project, pair), pair).toBeGreaterThanOrEqual(0);
		});
	});

	it('an i dot written low, its bottom just under the stem top, is still a mark', () => {
		const low = (shift) => {
			const x = font.xHeight;
			return [
				rect(400, 0, 400 + stroke, x),
				rect(400 + shift, x - 2, 400 + shift + stroke, x - 2 + stroke),
			];
		};
		const project = fittedFont(grid, { i: { shapes: low(Math.floor(0.5 * G)), anyink: AUTO } });
		const straight = fittedFont(grid, { i: { shapes: low(0), anyink: AUTO } });
		expect(letter(project, 'i').advanceWidth).toBe(letter(straight, 'i').advanceWidth);
	});

	it('letters measured by their own lean still never meet: an upright l beside a slanted i', () => {
		// The font leans 9 degrees; the l stands upright (measured by its own lean), the i's dot
		// drifted 2 strokes right, high above the turning height where their frames part most
		const lean = (char, degrees, shapes = letterShapes(char, font)) => ({
			anyink: AUTO,
			shapes: shearShapes(shapes, degrees, 0),
		});
		const project = fittedFont(grid, {
			n: lean('n', 9),
			H: lean('H', 9),
			t: lean('t', 9),
			i: lean('i', 9, dottedI(font, 400, 2 * stroke)),
			l: lean('l', 0),
		});
		for (const pair of ['il', 'li', 'ii', 'll']) {
			expect(gap(project, pair), pair).toBeGreaterThanOrEqual(0.1 * G - 1);
		}
	});
});
