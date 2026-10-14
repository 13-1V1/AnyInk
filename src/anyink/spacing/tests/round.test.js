// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 (UX-BEGINNER 7.2 "Whole numbers"): spacing writes whole-unit points and widths.
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { isWhole, roundItem, roundItemPoints, roundWidth, whole } from '../round.js';
import { oval, rect } from './fixtures.js';

const coordsOf = (item) =>
	item.shapes.flatMap((shape) =>
		shape.pathPoints.flatMap((point) => [
			point.p.x,
			point.p.y,
			point.h1.x,
			point.h1.y,
			point.h2.x,
			point.h2.y,
		])
	);

describe('whole', () => {
	it('rounds to a whole number, never -0, and turns a non-number into 0', () => {
		expect(whole(2.4)).toBe(2);
		expect(whole(2.5)).toBe(3);
		expect(Object.is(whole(-0.2), 0)).toBe(true);
		expect(whole(NaN)).toBe(0);
		expect(whole(Infinity)).toBe(0);
		expect(whole('12.6')).toBe(13);
	});

	it('knows a whole number', () => {
		expect(isWhole(4)).toBe(true);
		expect(isWhole(4.5)).toBe(false);
		expect(isWhole(NaN)).toBe(false);
	});
});

describe('roundItemPoints', () => {
	it('rounds every point and curve handle to whole units, and says how many moved', () => {
		const item = new Glyph({ id: 'glyph-0x6F', shapes: [oval(300.4, 250.6, 200.25, 249.7)] });
		const moved = roundItemPoints(item);
		expect(moved).toBeGreaterThan(0);
		coordsOf(item).forEach((value) => expect(isWhole(value), String(value)).toBe(true));
		// The curve keeps its shape within a unit
		expect(item.maxes.xMin).toBeCloseTo(100, -1);
		expect(item.maxes.xMax).toBeCloseTo(501, -1);
	});

	it('leaves a whole letter alone and keeps handles that are off, off', () => {
		const item = new Glyph({ id: 'glyph-0x48', shapes: [rect(10, 0, 110, 700)] });
		const before = JSON.stringify(item.save());
		expect(roundItemPoints(item)).toBe(0);
		expect(JSON.stringify(item.save())).toBe(before);
		item.shapes[0].pathPoints[0].p.x = 10.4;
		expect(roundItemPoints(item)).toBe(1);
		expect(item.shapes[0].pathPoints[0].h1.use).toBe(false);
		expect(item.shapes[0].pathPoints[0].p.x).toBe(10);
	});

	it('marks the letter changed so its box is measured again', () => {
		const item = new Glyph({ id: 'glyph-0x48', shapes: [rect(10.6, 0, 110, 700)] });
		expect(item.maxes.xMin).toBeCloseTo(10.6, 6);
		roundItemPoints(item);
		expect(item.maxes.xMin).toBe(11);
	});
});

describe('roundWidth and roundItem', () => {
	it('rounds the width the way the font file stores it', () => {
		const item = new Glyph({
			id: 'glyph-0x48',
			shapes: [rect(0, 0, 10, 10)],
			advanceWidth: 654.338,
		});
		expect(roundWidth(item)).toBe(true);
		expect(item.advanceWidth).toBe(654);
		expect(roundWidth(item)).toBe(false);
	});

	it('rounds both, and reports whether anything changed', () => {
		const item = new Glyph({
			id: 'glyph-0x48',
			shapes: [rect(0.5, 0, 10, 10)],
			advanceWidth: 20.2,
		});
		expect(roundItem(item)).toBe(true);
		expect(item.advanceWidth).toBe(20);
		expect(roundItem(item)).toBe(false);
	});
});
