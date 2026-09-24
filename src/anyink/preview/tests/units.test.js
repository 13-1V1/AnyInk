// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PT,
	MAX_PT,
	MIN_PT,
	clampPt,
	formatPt,
	nudgePt,
	ptToPx,
	pxToPt,
	snapPt,
} from '../units.js';

describe('pt / px conversion', () => {
	it('converts at 96 px per 72 pt', () => {
		expect(ptToPx(48)).toBe(64);
		expect(ptToPx(72)).toBe(96);
		expect(pxToPt(64)).toBe(48);
		expect(pxToPt(96)).toBe(72);
	});

	it('round-trips whole points', () => {
		for (let pt = MIN_PT; pt <= MAX_PT; pt++) {
			expect(pxToPt(ptToPx(pt))).toBeCloseTo(pt, 10);
		}
	});

	it('keeps the upstream default (48 px) meaningful as 36 pt', () => {
		expect(pxToPt(48)).toBe(36);
	});
});

describe('clampPt', () => {
	it('rounds and clamps to the slider range', () => {
		expect(clampPt(47.6)).toBe(48);
		expect(clampPt(1)).toBe(MIN_PT);
		expect(clampPt(9999)).toBe(MAX_PT);
		expect(clampPt('72')).toBe(72);
	});

	it('falls back to the default for garbage', () => {
		expect(clampPt(NaN)).toBe(DEFAULT_PT);
		expect(clampPt(undefined)).toBe(DEFAULT_PT);
		expect(clampPt('twelve')).toBe(DEFAULT_PT);
	});
});

describe('snapPt', () => {
	it('snaps to the nearest 10', () => {
		expect(snapPt(44)).toBe(40);
		expect(snapPt(45)).toBe(50);
		expect(snapPt(48)).toBe(50);
		expect(snapPt(196)).toBe(200);
	});

	it('never leaves the range', () => {
		expect(snapPt(8)).toBe(10);
		expect(snapPt(3)).toBe(MIN_PT);
		expect(snapPt(204)).toBe(MAX_PT);
		expect(snapPt('x')).toBe(DEFAULT_PT);
	});
});

describe('nudgePt', () => {
	it('moves by 1, or by 10 with Shift', () => {
		expect(nudgePt(48, 1)).toBe(49);
		expect(nudgePt(48, -1)).toBe(47);
		expect(nudgePt(48, 1, true)).toBe(58);
		expect(nudgePt(48, -1, true)).toBe(38);
	});

	it('stops at the ends', () => {
		expect(nudgePt(MAX_PT, 1)).toBe(MAX_PT);
		expect(nudgePt(MIN_PT, -1, true)).toBe(MIN_PT);
	});
});

describe('formatPt', () => {
	it('reads NN pt', () => {
		expect(formatPt(48)).toBe('48 pt');
		expect(formatPt(47.6)).toBe('48 pt');
		expect(formatPt(undefined)).toBe('0 pt');
	});
});
