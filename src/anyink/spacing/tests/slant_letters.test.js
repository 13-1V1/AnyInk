// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 finalize (hostile pass on the spacing fix, new problem 2 and finding 1's leftovers): one
// slant for the whole font measured every letter with it, so a tall letter that leaned more or
// less than the rest stood apart from its neighbors ("he llo": ll 334 units against 176 when
// the font leans 20 and the l 25; an upright l in a hand whose other stems lean 5 pushed nl to
// 215). A letter with stems of its own is now measured with its own lean when that differs
// from the font's by more than OWN_LEAN_STEP degrees. And a hand leaning more than 35 degrees
// was not read as slanted at all (ll 1,387 at 38 degrees): stems up to SLANT_LIMIT (50) count.
// The price of never touching (hang.test.js: the hang limit holds in the font's frame, which
// every letter shares): a letter leaning 5 degrees off the rest gets a little more room on the
// side its top leans toward, so the bounds here are 30 % and 20 %, not exact.
// Uses only fitAllAutomatic, estimateSlant and the fixtures, so it fails on the numbers.
import { describe, expect, it } from 'vitest';
import { fitAllAutomatic } from '../auto_space.js';
import { rowExtent } from '../measure.js';
import { itemContours } from '../outline.js';
import { estimateSlant } from '../slant.js';
import {
	GRIDS,
	closestGap,
	letter,
	letterShapes,
	shearShapes,
	spacingProject,
} from './fixtures.js';

const AUTO = { spacing: 'auto' };
const CHARS = ['l', 'n', 'H', 't', 'i', 'o', 'v'];

/** Letters leaning `degrees` (about the writing line), some leaning their own way */
function hand(grid, degrees, own = {}) {
	const font = GRIDS[grid];
	const letters = {};
	CHARS.forEach((char) => {
		const lean = own[char] ?? degrees;
		letters[char] = { anyink: AUTO, shapes: shearShapes(letterShapes(char, font), lean, 0) };
	});
	const project = spacingProject(grid, letters);
	fitAllAutomatic(project);
	return project;
}

/**
 * The mean gap between two letters set side by side over the small-letter band: what the eye
 * reads as their spacing when their sides don't run parallel.
 */
function bandGap(project, a, b) {
	const first = letter(project, a);
	const second = letter(project, b);
	const left = itemContours(first);
	const right = itemContours(second);
	const xHeight = project.settings.font.xHeight;
	let sum = 0;
	let rows = 0;
	for (let y = 0.5; y < xHeight; y += 1) {
		const one = rowExtent(left, y);
		const two = rowExtent(right, y);
		if (!one || !two) continue;
		sum += first.advanceWidth + two.left - one.right;
		rows++;
	}
	return sum / rows;
}

describe.each([1000, 2048])('letters that lean their own way at %i units', (grid) => {
	const G = GRIDS[grid].xHeight * 0.08;
	const gap = (project, pair) => closestGap(letter(project, pair[0]), letter(project, pair[1]));

	it('a hand at 20 degrees whose l leans 25: ll stays within 30% of 2 G (it was 90% over)', () => {
		const project = hand(grid, 20, { l: 25 });
		expect(Math.abs(gap(project, 'll') - 2 * G) / (2 * G)).toBeLessThan(0.3);
	});

	it('stems leaning 5 degrees and an upright l: nl and ln read within 20% of upright', () => {
		const upright = hand(grid, 0);
		const project = hand(grid, 5, { l: 0 });
		['nl', 'ln', 'll', 'Hl'].forEach((pair) => {
			const want = bandGap(upright, pair[0], pair[1]);
			const got = bandGap(project, pair[0], pair[1]);
			expect(Math.abs(got - want) / want, `${pair}: ${got} vs ${want}`).toBeLessThan(0.2);
			expect(gap(project, pair), pair).toBeGreaterThan(0);
		});
	});

	it('letters that lean the same as the font are measured with the font slant, as before', () => {
		const project = hand(grid, 20);
		const upright = hand(grid, 0);
		['ll', 'nl', 'on', 'vo'].forEach((pair) => {
			expect(Math.abs(gap(project, pair) - gap(upright, pair)), pair).toBeLessThanOrEqual(
				Math.max(2, 0.1 * gap(upright, pair))
			);
		});
	});

	it.each([38, 45])(
		'a hand leaning %i degrees is read as slanted and spaced like upright',
		(deg) => {
			const project = hand(grid, deg);
			expect(estimateSlant(project)).toBeCloseTo(deg, 0);
			const upright = hand(grid, 0);
			['ll', 'nl', 'ln', 'Hn'].forEach((pair) => {
				const want = gap(upright, pair);
				expect(Math.abs(gap(project, pair) - want), pair).toBeLessThanOrEqual(
					Math.max(2, 0.1 * want)
				);
			});
		}
	);
});
