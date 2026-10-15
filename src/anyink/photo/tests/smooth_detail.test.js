// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-core: the one Smooth --o-- Detailed slider (docs/UX-BEGINNER.md 4.4 step C: "one
// slider. It moves potrace's smoothing and detail settings together along one curve (the mapping
// table is part of B9); More tools keeps the two separate sliders"). Written before
// smooth_detail.js existed (failed on the missing module).
import { describe, expect, it } from 'vitest';
import { AUTOTRACE_DEFAULTS, toPotraceOptions } from '../../autotrace/params.js';
import {
	SMOOTH_DETAIL_DEFAULT,
	SMOOTH_DETAIL_TABLE,
	optionsForSlider,
	sliderForOptions,
} from '../smooth_detail.js';

describe('the mapping table', () => {
	it('runs from Smooth (0) to Detailed (1): smoothing only falls, detail only rises', () => {
		expect(SMOOTH_DETAIL_TABLE[0].at).toBe(0);
		expect(SMOOTH_DETAIL_TABLE.at(-1).at).toBe(1);
		for (let i = 1; i < SMOOTH_DETAIL_TABLE.length; i++) {
			const a = SMOOTH_DETAIL_TABLE[i - 1];
			const b = SMOOTH_DETAIL_TABLE[i];
			expect(b.at).toBeGreaterThan(a.at);
			expect(b.smoothing).toBeLessThan(a.smoothing);
			expect(b.detail).toBeGreaterThan(a.detail);
		}
		for (const row of SMOOTH_DETAIL_TABLE) {
			expect(row.smoothing).toBeGreaterThanOrEqual(0);
			expect(row.smoothing).toBeLessThanOrEqual(1);
			expect(row.detail).toBeGreaterThanOrEqual(0);
			expect(row.detail).toBeLessThanOrEqual(1);
		}
		expect(Object.isFrozen(SMOOTH_DETAIL_TABLE)).toBe(true);
	});

	it("the slider starts in the middle, at auto-trace's own defaults", () => {
		expect(SMOOTH_DETAIL_DEFAULT).toBe(0.5);
		expect(optionsForSlider(SMOOTH_DETAIL_DEFAULT)).toEqual({
			smoothing: AUTOTRACE_DEFAULTS.smoothing,
			detail: AUTOTRACE_DEFAULTS.detail,
		});
		expect(sliderForOptions(AUTOTRACE_DEFAULTS)).toBeCloseTo(0.5, 6);
	});

	it('the ends never reach potrace extremes: Smooth keeps some corners, Detailed keeps the speck floor', () => {
		const smooth = optionsForSlider(0);
		const detailed = optionsForSlider(1);
		expect(smooth.smoothing).toBeLessThan(1);
		expect(detailed.smoothing).toBeGreaterThan(0.3);
		expect(detailed.detail).toBeLessThan(1);
		expect(smooth.detail).toBeGreaterThan(0);
	});
});

describe('optionsForSlider', () => {
	it('reads the table between its rows in a straight line', () => {
		const [a, b] = SMOOTH_DETAIL_TABLE;
		const mid = optionsForSlider((a.at + b.at) / 2);
		expect(mid.smoothing).toBeCloseTo((a.smoothing + b.smoothing) / 2, 9);
		expect(mid.detail).toBeCloseTo((a.detail + b.detail) / 2, 9);
	});

	it('clamps out-of-range and unusable values', () => {
		expect(optionsForSlider(-3)).toEqual(optionsForSlider(0));
		expect(optionsForSlider(7)).toEqual(optionsForSlider(1));
		expect(optionsForSlider(NaN)).toEqual(optionsForSlider(SMOOTH_DETAIL_DEFAULT));
		expect(optionsForSlider('0.2')).toEqual(optionsForSlider(SMOOTH_DETAIL_DEFAULT));
	});

	it('moving toward Detailed gives potrace sharper corners, a tighter fit and smaller kept specks', () => {
		let last = null;
		for (let v = 0; v <= 1.0001; v += 0.05) {
			const p = toPotraceOptions(optionsForSlider(v), { scale: 2, upm: 2048 });
			if (last) {
				expect(p.alphamax).toBeLessThan(last.alphamax);
				expect(p.opttolerance).toBeLessThan(last.opttolerance);
				expect(p.turdsize).toBeLessThanOrEqual(last.turdsize);
			}
			last = p;
		}
	});
});

describe('sliderForOptions: where the slider sits for two settings (More tools moves them apart)', () => {
	it('every point on the curve comes back to its own slider value', () => {
		for (let v = 0; v <= 1.0001; v += 0.1) {
			expect(sliderForOptions(optionsForSlider(v))).toBeCloseTo(Math.min(1, v), 3);
		}
	});

	it('settings off the curve sit at the nearest point of it', () => {
		const near = sliderForOptions({ smoothing: 0.74, detail: 0.62 });
		expect(near).toBeGreaterThan(0.45);
		expect(near).toBeLessThan(0.6);
		expect(sliderForOptions({ smoothing: 1, detail: 0 })).toBe(0);
		expect(sliderForOptions({ smoothing: 0, detail: 1 })).toBe(1);
	});

	it('missing values take the auto-trace defaults', () => {
		expect(sliderForOptions({})).toBeCloseTo(0.5, 6);
		expect(sliderForOptions(null)).toBeCloseTo(0.5, 6);
		expect(sliderForOptions({ smoothing: AUTOTRACE_DEFAULTS.smoothing })).toBeCloseTo(0.5, 6);
	});
});
