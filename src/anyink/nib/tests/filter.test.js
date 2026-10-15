// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 (RESEARCH 2.3): the pointer's samples go through the 1 euro filter (1eurofilter, one per
	channel, timestamps in seconds) before anything else: the hand's jitter goes, quick moves
	keep up. When the pen stops the filter is let settle on the last real sample, so a stroke
	ends where the pen did, not short of it.
*/
import { describe, expect, it } from 'vitest';
import { makeStrokeFilter } from '../filter.js';
import { line, wobble } from './strokes.js';

/** Farthest a point is from the line y = 0 */
const spread = (points) => Math.max(...points.map(([, y]) => Math.abs(y)));

describe('the 1 euro filter', () => {
	it('takes most of a hand’s jitter out of a slow line', () => {
		const raw = wobble(line([0, 0], [300, 0], 1), 2);
		const filter = makeStrokeFilter();
		const out = raw.map(([x, y], i) => filter.push(x, y, i / 120));
		const smoothed = out.map(({ x, y }) => [x, y]);
		expect(spread(smoothed.slice(10))).toBeLessThan(spread(raw) / 2);
	});

	it('the first sample is the first point, as it was', () => {
		const filter = makeStrokeFilter();
		expect(filter.push(12.5, 40, 0)).toEqual({ x: 12.5, y: 40 });
	});

	it('settles on where the pen stopped', () => {
		const filter = makeStrokeFilter();
		const raw = line([0, 0], [400, 200], 8);
		raw.forEach(([x, y], i) => filter.push(x, y, i / 120));
		const tail = filter.settle(400, 200, raw.length / 120);
		expect(tail.length).toBeGreaterThan(0);
		const end = tail.at(-1);
		expect(Math.hypot(end.x - 400, end.y - 200)).toBeLessThanOrEqual(0.05);
	});

	it('two samples at the same moment never break it', () => {
		const filter = makeStrokeFilter();
		filter.push(0, 0, 1);
		const next = filter.push(10, 0, 1);
		expect(Number.isFinite(next.x) && Number.isFinite(next.y)).toBe(true);
	});
});
