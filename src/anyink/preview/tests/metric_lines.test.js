// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { METRIC_LINE_NAMES, metricLineYs } from '../metric_lines.js';

const font = { ascent: 800, capHeight: 700, xHeight: 500, descent: -200 };

describe('metricLineYs', () => {
	it('places every line relative to the baseline at the given scale', () => {
		const lines = metricLineYs({ dy: 100, dz: 0.1 }, font);
		expect(lines.map((l) => l.name)).toEqual(METRIC_LINE_NAMES);
		expect(lines.map((l) => l.y)).toEqual([20, 30, 50, 100, 120]);
	});

	it('runs top to bottom', () => {
		const ys = metricLineYs({ dy: 300, dz: 0.25 }, font).map((l) => l.y);
		for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
	});

	it('treats a positive descent like a negative one', () => {
		const neg = metricLineYs({ dy: 100, dz: 0.1 }, font);
		const pos = metricLineYs({ dy: 100, dz: 0.1 }, { ...font, descent: 200 });
		expect(pos).toEqual(neg);
	});

	it('accepts string settings and survives missing data', () => {
		const lines = metricLineYs({ dy: 100, dz: 0.1 }, { ascent: '800', descent: '-200' });
		expect(lines[0].y).toBe(20);
		expect(lines[4].y).toBe(120);
		expect(lines[1].y).toBe(100); // no cap height: sits on the baseline instead of NaN
		expect(metricLineYs(undefined, undefined).every((l) => l.y === 0)).toBe(true);
	});
});
