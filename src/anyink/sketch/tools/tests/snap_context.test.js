// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 integration: snap_context.js, the letter's part of the snap context (docs/SKETCH.md 6,
	Datums): edges and middle only while the spacing is his; while it is automatic the middle of
	the ink (or of the sketch, with no ink yet) as a hint; a letter no one has decided follows the
	mode. Written with the module.
*/
import { describe, expect, it } from 'vitest';
import { letterSnapContext, snapContextOf } from '../snap_context.js';

const letter = (extra = {}) => ({ advanceWidth: 600, shapes: [], anyink: {}, ...extra });

describe("the letter's snap context", () => {
	it('spacing set by him: edges and middle snap, no ink hint', () => {
		const item = letter({ anyink: { spacing: 'manual' } });
		expect(letterSnapContext(item, { simple: true })).toEqual({
			manual: true,
			edges: { left: 0, right: 600 },
			inkMiddle: null,
		});
	});

	it("automatic spacing: no edges; the sketch's middle is the hint while there is no ink", () => {
		const item = letter({
			anyink: {
				spacing: 'auto',
				sketch: { v: 1, points: { p1: { x: 100, y: 0 }, p2: { x: 500, y: 0 } }, pieces: [] },
			},
		});
		expect(letterSnapContext(item, { simple: true })).toMatchObject({
			manual: false,
			inkMiddle: 300,
		});
	});

	it('nothing to measure: no hint', () => {
		expect(
			letterSnapContext(letter({ anyink: { spacing: 'auto' } }), { simple: true }).inkMiddle
		).toBe(null);
	});

	it('a letter no one has decided: Simple spaces it (no edges), All tools leaves it as he set it', () => {
		expect(letterSnapContext(letter(), { simple: true }).manual).toBe(false);
		expect(letterSnapContext(letter(), { simple: false }).manual).toBe(true);
	});

	it('no letter: nothing added', () => {
		expect(letterSnapContext(null)).toEqual({});
		expect(snapContextOf({})).toEqual({});
	});
});
