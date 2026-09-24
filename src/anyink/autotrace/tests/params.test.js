// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8: auto-trace options (src/anyink/autotrace/params.js). Covers normalizing raw
// options (clamping, dropping unknown keys, 'auto' threshold), the slider-to-potrace mapping
// at both ends of each slider, and the Detail speck filter's independence from image
// resolution (the same font-unit speck gives a turdsize proportional to 1 / scale^2), with
// its floor of one preview pixel (a full-size trace never keeps specks the preview hid).
import { describe, expect, it } from 'vitest';
import {
	ALPHAMAX_MAX,
	AUTOTRACE_DEFAULTS,
	SPECK_SIDE_EM,
	normalizeOptions,
	speckAreaFontUnits,
	toPotraceOptions,
	turdsizeFor,
} from '../params.js';

describe('normalizeOptions', () => {
	it('fills every default for nothing, or for junk', () => {
		expect(normalizeOptions()).toEqual({ ...AUTOTRACE_DEFAULTS });
		expect(normalizeOptions(null)).toEqual({ ...AUTOTRACE_DEFAULTS });
		expect(normalizeOptions('photo')).toEqual({ ...AUTOTRACE_DEFAULTS });
		expect(normalizeOptions({})).not.toBe(AUTOTRACE_DEFAULTS);
	});

	it('keeps valid values, clamps numbers, and drops unknown keys', () => {
		const out = normalizeOptions({
			mode: 'photo',
			threshold: 300.4,
			smoothing: -2,
			detail: 7,
			despeckle: false,
			invert: true,
			insideBoxOnly: false,
			extra: 'x',
		});
		expect(out).toEqual({
			mode: 'photo',
			threshold: 255,
			smoothing: 0,
			detail: 1,
			despeckle: false,
			invert: true,
			insideBoxOnly: false,
		});
	});

	it('rounds a numeric threshold and turns anything else into auto', () => {
		expect(normalizeOptions({ threshold: 99.6 }).threshold).toBe(100);
		expect(normalizeOptions({ threshold: -5 }).threshold).toBe(0);
		expect(normalizeOptions({ threshold: 'auto' }).threshold).toBe('auto');
		expect(normalizeOptions({ threshold: '128' }).threshold).toBe('auto');
		expect(normalizeOptions({ threshold: NaN }).threshold).toBe('auto');
	});

	it('ignores a bad mode, NaN sliders, and non-boolean toggles', () => {
		const out = normalizeOptions({ mode: 'fax', smoothing: NaN, detail: '1', invert: 1 });
		expect(out.mode).toBe('scan');
		expect(out.smoothing).toBe(AUTOTRACE_DEFAULTS.smoothing);
		expect(out.detail).toBe(AUTOTRACE_DEFAULTS.detail);
		expect(out.invert).toBe(false);
	});
});

describe('toPotraceOptions', () => {
	it('always asks for a full SVG with the minority turn policy', () => {
		const out = toPotraceOptions(AUTOTRACE_DEFAULTS, { scale: 1 });
		expect(out).toMatchObject({ turnpolicy: 'minority', pathonly: false, extractcolors: false });
		expect(Object.keys(out).sort()).toEqual(
			['alphamax', 'extractcolors', 'opttolerance', 'pathonly', 'turdsize', 'turnpolicy'].sort()
		);
	});

	it('Smoothing maps onto alphamax 0 .. 1.3334', () => {
		expect(toPotraceOptions({ smoothing: 0 }).alphamax).toBe(0);
		expect(toPotraceOptions({ smoothing: 1 }).alphamax).toBe(ALPHAMAX_MAX);
		expect(ALPHAMAX_MAX).toBe(1.3334);
		// The default lands on potrace's own default corner threshold
		expect(toPotraceOptions({ smoothing: 0.75 }).alphamax).toBeCloseTo(1, 3);
	});

	it('Detail: opttolerance falls from 0.5 to 0.05, the speck filter from 30 fu square to 1 px', () => {
		const low = toPotraceOptions({ detail: 0 }, { scale: 1 });
		const high = toPotraceOptions({ detail: 1 }, { scale: 1 });
		expect(low.opttolerance).toBeCloseTo(0.5, 10);
		expect(high.opttolerance).toBeCloseTo(0.05, 10);
		expect(toPotraceOptions({ detail: 0.5 }).opttolerance).toBeCloseTo(0.275, 10);

		expect(SPECK_SIDE_EM).toBe(0.03);
		expect(low.turdsize).toBe(900); // (0.03 * 1000 fu)^2 at 1 fu per pixel
		expect(high.turdsize).toBe(1); // the one-pixel floor (see the speck floor tests)
		// Rising detail never keeps fewer shapes
		let previous = Infinity;
		for (let d = 0; d <= 1.0001; d += 0.1) {
			const t = toPotraceOptions({ detail: d }, { scale: 1 }).turdsize;
			expect(t).toBeLessThanOrEqual(previous);
			previous = t;
		}
	});

	it('the speck filter does not depend on image resolution (turdsize ~ 1 / scale^2)', () => {
		const detail = 0.2;
		const fuArea = speckAreaFontUnits(detail);
		expect(fuArea).toBeCloseTo((0.03 * 1000 * 0.8) ** 2, 6); // 576 square font units
		const at1 = toPotraceOptions({ detail }, { scale: 1 }).turdsize;
		const atHalf = toPotraceOptions({ detail }, { scale: 0.5 }).turdsize; // 2x the pixels
		const atQuarter = toPotraceOptions({ detail }, { scale: 0.25 }).turdsize; // 4x
		const at2 = toPotraceOptions({ detail }, { scale: 2 }).turdsize; // half the pixels
		expect(at1).toBe(576);
		expect(atHalf).toBe(at1 * 4);
		expect(atQuarter).toBe(at1 * 16);
		expect(at2).toBe(at1 / 4);
		// Same speck in font units whatever the scale: px area * scale^2 is constant
		for (const [t, s] of [
			[at1, 1],
			[atHalf, 0.5],
			[atQuarter, 0.25],
			[at2, 2],
		]) {
			expect(t * s * s).toBeCloseTo(fuArea, 6);
		}
	});

	it('scales the speck with the em size and survives a missing or bad scale', () => {
		expect(turdsizeFor(0, 1, 2048)).toBe(Math.round((0.03 * 2048) ** 2));
		expect(turdsizeFor(0, undefined)).toBe(900);
		expect(turdsizeFor(0, -3)).toBe(900);
		expect(turdsizeFor(0, 0)).toBe(900);
		expect(toPotraceOptions({ detail: 0 }).turdsize).toBe(900);
		expect(turdsizeFor(0.99, 100)).toBe(1); // far below a pixel: the one-pixel floor
	});
});

describe('speck floor: never below one preview pixel (fix: speck explosion at Detail 100 %)', () => {
	it('at Detail 100 % a full-size trace still drops specks smaller than one preview pixel', () => {
		// Apply traces at 0.5 fu per pixel what the preview showed at 1 fu per pixel: one
		// preview pixel is 2 x 2 = 4 full-size pixels, so specks up to 4 px go
		expect(toPotraceOptions({ detail: 1 }, { scale: 0.5, previewScale: 1 }).turdsize).toBe(4);
		// A preview shrunk to 0.4: one preview pixel is 2.5 x 2.5 = 6.25 px
		expect(toPotraceOptions({ detail: 1 }, { scale: 0.4, previewScale: 1 }).turdsize).toBe(6);
		expect(turdsizeFor(1, 0.5, 1000, 1)).toBe(4);
	});

	it('at the preview size itself the floor is one pixel', () => {
		expect(toPotraceOptions({ detail: 1 }, { scale: 1 }).turdsize).toBe(1);
		expect(toPotraceOptions({ detail: 1 }, { scale: 1, previewScale: 1 }).turdsize).toBe(1);
		// A previewScale finer than the traced image means nothing: still one pixel
		expect(toPotraceOptions({ detail: 1 }, { scale: 1, previewScale: 0.25 }).turdsize).toBe(1);
	});

	it('the font-unit speck still wins when it is bigger than the floor', () => {
		const opts = toPotraceOptions({ detail: 0.2 }, { scale: 0.5, previewScale: 1 });
		expect(opts.turdsize).toBe(turdsizeFor(0.2, 0.5)); // 2304, far above 4
	});
});
