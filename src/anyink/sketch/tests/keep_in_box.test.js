// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	keep_in_box.js: a curve that bulges past the outline's box gets its handles shortened along
	their own directions (its tangents kept), until it is inside; a round top whose handles stand
	past the box but whose curve does not is left alone; nothing passing gives the same array.
*/
import { describe, expect, it } from 'vitest';
import { cubicExtremes } from '../extremes.js';
import { keepInBox, outlineBox } from '../keep_in_box.js';

const dir = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]);
const lowest = (cubic) => Math.min(...cubicExtremes(cubic).map((e) => e.y));
const highest = (cubic) => Math.max(...cubicExtremes(cubic).map((e) => e.y));

describe('keepInBox', () => {
	it("the box is the outline's own extremes", () => {
		expect(outlineBox([[0.4, -0.4], [10.6, 0], [5, 20.2]])).toEqual({ lo: [0.4, -0.4], hi: [10.6, 20.2] });
	});

	it('a curve leaving an end on the edge at a slant, a hair past it, is not flattened', () => {
		const curves = [[[559, 170], [611, 292], [631, 429], [630, 560]]];
		expect(keepInBox(curves, { lo: [30, -31], hi: [630, 1131] })).toBe(curves);
	});

	it('leaves a round top alone when only its handles stand past the box (same array)', () => {
		const curves = [[[0, 90], [10, 103], [40, 103], [50, 90]]];
		expect(highest(curves[0])).toBeLessThanOrEqual(100);
		expect(keepInBox(curves, { lo: [0, 0], hi: [50, 100] })).toBe(curves);
	});

	it('shortens a curve that dips under the box along its handles, its tangents kept', () => {
		const box = { lo: [0, 0], hi: [100, 100] };
		const cubic = [[0, 50], [0, -30], [80, -30], [60, 5]];
		expect(lowest(cubic)).toBeLessThan(-5);
		const [kept] = keepInBox([cubic], box);
		expect(lowest(kept)).toBeGreaterThanOrEqual(-0.1);
		expect(Math.abs(dir(kept[0], kept[1]) - dir(cubic[0], cubic[1]))).toBeLessThan(0.02);
		expect(Math.abs(dir(kept[3], kept[2]) - dir(cubic[3], cubic[2]))).toBeLessThan(0.02);
		expect(kept[0]).toEqual(cubic[0]);
		expect(kept[3]).toEqual(cubic[3]);
	});
});
