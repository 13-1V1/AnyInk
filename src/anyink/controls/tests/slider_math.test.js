// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import {
	additiveDelta,
	clamp,
	decimalsForStep,
	formatValue,
	maxFromUpm,
	nudge,
	skewAngleDelta,
	snapToMultiple,
	snapToStep,
	toNumber,
} from '../slider_math.js';

describe('toNumber', () => {
	it('parses numbers and strings, falls back on junk', () => {
		expect(toNumber(5)).toBe(5);
		expect(toNumber('12.5')).toBe(12.5);
		expect(toNumber('abc', 7)).toBe(7);
		expect(toNumber(undefined, 1)).toBe(1);
		expect(toNumber(NaN, 3)).toBe(3);
		expect(toNumber(Infinity, 3)).toBe(3);
	});
});

describe('clamp', () => {
	it('keeps values inside the range', () => {
		expect(clamp(50, 0, 100)).toBe(50);
		expect(clamp(-5, 0, 100)).toBe(0);
		expect(clamp(500, 0, 100)).toBe(100);
	});
	it('tolerates a swapped range', () => {
		expect(clamp(50, 100, 0)).toBe(50);
		expect(clamp(-5, 100, 0)).toBe(0);
	});
});

describe('decimalsForStep', () => {
	it('derives decimals from the step', () => {
		expect(decimalsForStep(1)).toBe(0);
		expect(decimalsForStep(10)).toBe(0);
		expect(decimalsForStep(0.5)).toBe(1);
		expect(decimalsForStep(0.01)).toBe(2);
		expect(decimalsForStep(0.001)).toBe(3);
		expect(decimalsForStep(1e-7)).toBe(7);
		expect(decimalsForStep(0)).toBe(0);
	});
});

describe('snapToStep', () => {
	it('rounds to the step grid from min and clamps', () => {
		expect(snapToStep(12.4, 1, -45, 45)).toBe(12);
		expect(snapToStep(12.5, 1, -45, 45)).toBe(13);
		expect(snapToStep(99, 1, -45, 45)).toBe(45);
		expect(snapToStep(-99, 1, -45, 45)).toBe(-45);
	});
	it('handles fractional steps without float dust', () => {
		expect(snapToStep(1.234, 0.01, 0.25, 4)).toBe(1.23);
		expect(snapToStep(0.3, 0.1, 0, 1)).toBe(0.3);
		expect(snapToStep(0.1 + 0.2, 0.1, 0, 1)).toBe(0.3);
	});
	it('counts the grid from min when min is not on the grid', () => {
		expect(snapToStep(0.26, 0.05, 0.25, 4)).toBe(0.25);
		expect(snapToStep(0.29, 0.05, 0.25, 4)).toBe(0.3);
	});
});

describe('snapToMultiple', () => {
	it('snaps to multiples of 10 counted from zero', () => {
		expect(snapToMultiple(14, 10, -45, 45)).toBe(10);
		expect(snapToMultiple(15, 10, -45, 45)).toBe(20);
		expect(snapToMultiple(-14, 10, -45, 45)).toBe(-10);
		expect(snapToMultiple(44, 10, -45, 45)).toBe(40);
		expect(snapToMultiple(-44, 10, -45, 45)).toBe(-40);
	});
	it('works for scale factors with a 0.1 snap', () => {
		expect(snapToMultiple(1.26, 0.1, 0.25, 4)).toBe(1.3);
		expect(snapToMultiple(0.97, 0.1, 0.25, 4)).toBe(1);
		expect(snapToMultiple(0.26, 0.1, 0.25, 4)).toBe(0.3);
	});
	it('falls back to 10 for a bad multiple', () => {
		expect(snapToMultiple(14, 0, -45, 45)).toBe(10);
	});
});

describe('nudge', () => {
	const o = { step: 1, min: -45, max: 45 };
	it('moves one step, ten with big', () => {
		expect(nudge(0, 1, o)).toBe(1);
		expect(nudge(0, -1, o)).toBe(-1);
		expect(nudge(0, 1, { ...o, big: true })).toBe(10);
		expect(nudge(0, -1, { ...o, big: true })).toBe(-10);
	});
	it('clamps at the ends', () => {
		expect(nudge(45, 1, o)).toBe(45);
		expect(nudge(-40, -1, { ...o, big: true })).toBe(-45);
	});
	it('respects fractional steps', () => {
		expect(nudge(1, 1, { step: 0.01, min: 0.25, max: 4 })).toBe(1.01);
		expect(nudge(1, 1, { step: 0.01, min: 0.25, max: 4, big: true })).toBe(1.1);
		expect(nudge(0.3, -1, { step: 0.1, min: 0, max: 1 })).toBe(0.2);
	});
});

describe('formatValue', () => {
	it('uses the step decimals and never shows -0', () => {
		expect(formatValue(12, 1)).toBe('12');
		expect(formatValue(12.7, 1)).toBe('13');
		expect(formatValue(1, 0.01)).toBe('1.00');
		expect(formatValue(1.256, 0.01)).toBe('1.26');
		expect(formatValue(-0.001, 1)).toBe('0');
		expect(formatValue('abc', 1)).toBe('0');
	});
});

describe('skewAngleDelta', () => {
	it('is the plain angle from zero', () => {
		expect(skewAngleDelta(0, 30)).toBeCloseTo(30, 9);
		expect(skewAngleDelta(0, -45)).toBeCloseTo(-45, 9);
	});
	it('returns exactly to zero', () => {
		expect(skewAngleDelta(30, 0)).toBeCloseTo(-30, 9);
		expect(skewAngleDelta(30, 30)).toBe(0);
	});
	it('composes in tan space: two deltas land on the target', () => {
		const a = skewAngleDelta(0, 20);
		const b = skewAngleDelta(20, 35);
		const tan = (d) => Math.tan((d * Math.PI) / 180);
		expect(tan(a) + tan(b)).toBeCloseTo(tan(35), 12);
		// and the delta is not simply 15 degrees
		expect(b).not.toBeCloseTo(15, 2);
	});
});

describe('additiveDelta', () => {
	it('is the plain difference, with float dust removed', () => {
		expect(additiveDelta(0, 25)).toBe(25);
		expect(additiveDelta(25, 10)).toBe(-15);
		expect(additiveDelta(0.1 + 0.2, 0.3)).toBe(0);
	});
});

describe('maxFromUpm', () => {
	it('uses upm when readable, else the fallback', () => {
		expect(maxFromUpm(2048, 1000)).toBe(1000);
		expect(maxFromUpm(2048, '2048')).toBe(2048);
		expect(maxFromUpm(2048, undefined)).toBe(2048);
		expect(maxFromUpm(2048, 0)).toBe(2048);
		expect(maxFromUpm(2048, 'nope')).toBe(2048);
	});
});
