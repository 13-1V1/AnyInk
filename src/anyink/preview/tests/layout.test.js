// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { centeringLineGap, nativeFirstLineView } from '../layout.js';
import { metricLineYs } from '../metric_lines.js';

describe('centeringLineGap', () => {
	it('fills the area around a single line', () => {
		// 150 px strip, 10 px padding, 48 pt = 64 px -> 150 - 20 - 64
		expect(centeringLineGap(150, 10, 64)).toBe(66);
	});

	it('never goes negative when the text is taller than the area', () => {
		expect(centeringLineGap(150, 10, 266)).toBe(0);
	});

	it('rounds to whole pixels and tolerates garbage', () => {
		expect(centeringLineGap(150.4, 10, 64)).toBe(66);
		expect(centeringLineGap(NaN, 10, 64)).toBe(0);
	});
});

describe('nativeFirstLineView', () => {
	const font = { upm: 1000, ascent: 800, descent: -200, capHeight: 700, xHeight: 500 };

	it('centers the em box in the strip when the gap comes from centeringLineGap', () => {
		const px = 64;
		const gap = centeringLineGap(150, 10, px);
		const view = nativeFirstLineView({
			fontSizePx: px,
			lineGap: gap,
			pagePadding: 10,
			upm: font.upm,
			ascent: font.ascent,
			descent: font.descent,
		});
		const lines = metricLineYs(view, font);
		const top = lines[0].y; // ascender
		const bottom = lines[4].y; // descender
		expect(view.dz).toBeCloseTo(0.064, 10);
		expect((top + bottom) / 2).toBeCloseTo(75, 6); // centered in 150 px
		expect(bottom - top).toBeCloseTo(64, 6); // ascent + |descent| = 1 em
	});

	it('puts the baseline at padding + half leading + ascent for a plain line box', () => {
		const view = nativeFirstLineView({
			fontSizePx: 100,
			lineGap: 20,
			pagePadding: 0,
			upm: 1000,
			ascent: 800,
			descent: -200,
		});
		// line box 120, content 100 -> 10 px half leading, then 80 px of ascent
		expect(view.dy).toBe(90);
		expect(view.dz).toBe(0.1);
	});
});
