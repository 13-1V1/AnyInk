// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 fix (first-timer lens, finding 5): diagonal pairs nearly touched. Open or slanted sides
// got 0.2 G each, so where two open sides meet at the same height ('ty': t's bar and y's arm,
// both at the small-letter line) the inks came within 0.4 G (35 units at 2,048) and touched at
// text sizes. Open sides now get 0.4 G: such a pair sits 0.8 G apart, near a round pair's
// 1.2 G once the white under the arms is counted.
import { describe, expect, it } from 'vitest';
import { fitAllAutomatic } from '../auto_space.js';
import { GRIDS, closestGap, letter, spacingProject } from './fixtures.js';

const AUTO = { spacing: 'auto' };

describe.each([1000, 2048])('diagonal pairs at %i units', (grid) => {
	const G = GRIDS[grid].xHeight * 0.08;
	const project = spacingProject(grid, {
		t: { anyink: AUTO },
		y: { anyink: AUTO },
		A: { anyink: AUTO },
		v: { anyink: AUTO },
		o: { anyink: AUTO },
	});
	fitAllAutomatic(project);
	const gap = (pair) => closestGap(letter(project, pair[0]), letter(project, pair[1]));

	it.each(['ty', 'vy', 'Ay', 'yo', 'vv', 'yv'])(
		'%s: the inks come no closer than 0.7 G',
		(pair) => {
			expect(gap(pair)).toBeGreaterThanOrEqual(0.7 * G);
		}
	);

	it('two open sides meeting at the same height sit 0.8 G apart', () => {
		expect(gap('ty')).toBeCloseTo(2 * Math.round(0.4 * G), 0);
		expect(gap('vy')).toBeCloseTo(2 * Math.round(0.4 * G), 0);
	});
});
