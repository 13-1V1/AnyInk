// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 fix (first-timer lens, finding 1): slanted handwriting came out letter-spaced ("h e l l o").
// The sides were measured on the leaning ink's box, so a tall letter's overhang landed on top
// of the gap on both sides (ll 701 units against 201 for the same hand upright). Sides are now
// measured with the font's slant taken out, so a leaning font is spaced like the same font
// upright: the gap at every height is the same as the upright pair's.
// Uses only fitAllAutomatic and the fixtures, so it fails on the numbers, not on an import.
import { describe, expect, it } from 'vitest';
import { fitAllAutomatic } from '../auto_space.js';
import { inkBounds } from '../measure.js';
import {
	GRIDS,
	closestGap,
	letter,
	letterShapes,
	shearShapes,
	spacingProject,
} from './fixtures.js';

const AUTO = { spacing: 'auto' };
/** Letters with stems (l n H t i), round (o) and open (v): every side kind */
const CHARS = ['l', 'n', 'H', 't', 'i', 'o', 'v'];

/** The fixture letters, all automatic, leaning `degrees` (about the writing line) */
function hand(grid, degrees, chars = CHARS) {
	const font = GRIDS[grid];
	const letters = {};
	chars.forEach((char) => {
		letters[char] = { anyink: AUTO, shapes: shearShapes(letterShapes(char, font), degrees, 0) };
	});
	const project = spacingProject(grid, letters);
	fitAllAutomatic(project);
	return project;
}

const pairGap = (project, a, b) => closestGap(letter(project, a), letter(project, b));

describe.each([1000, 2048])('a slanted hand at %i units', (grid) => {
	const G = GRIDS[grid].xHeight * 0.08;

	it("two parallel slanted l's sit as far apart as two upright l's (within 10%)", () => {
		const upright = pairGap(hand(grid, 0), 'l', 'l');
		const slanted = pairGap(hand(grid, 20), 'l', 'l');
		expect(upright).toBeCloseTo(2 * G, -1);
		expect(Math.abs(slanted - upright) / upright).toBeLessThan(0.1);
	});

	it.each([10, 20, -12])(
		'every pair of a font leaning %i degrees sits as close as the same pair upright',
		(degrees) => {
			const upright = hand(grid, 0);
			const slanted = hand(grid, degrees);
			CHARS.forEach((a) => {
				CHARS.forEach((b) => {
					const want = pairGap(upright, a, b);
					const got = pairGap(slanted, a, b);
					// Points are rounded to whole units when fitted: a unit or two either way
					expect(Math.abs(got - want), `${a}${b}: ${got} vs upright ${want}`).toBeLessThanOrEqual(
						Math.max(2, 0.1 * want)
					);
				});
			});
		}
	);

	it('a slanted letter never overlaps its neighbor', () => {
		const slanted = hand(grid, 25);
		CHARS.forEach((a) => {
			CHARS.forEach((b) => {
				expect(pairGap(slanted, a, b), `${a}${b}`).toBeGreaterThan(0);
			});
		});
	});

	it('a hand within a degree or so of upright is spaced on its box, exactly as before', () => {
		const project = hand(grid, 1);
		const l = letter(project, 'l');
		expect(inkBounds(l).xMin).toBe(Math.round(G));
		expect(l.advanceWidth - inkBounds(l).xMax).toBe(Math.round(G));
	});
});
