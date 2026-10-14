// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1: how far the guide lines reach. A letter with no width yet borrows the default letter
// width (so a first-timer sees where to draw), and keeps it while he draws: a new letter stays
// at width 0 until it is spaced, so the first pen click must not shrink the lines to stubs.
// A letter with a width keeps its own box, as before B1 (small l at 440.7 and small t at 654.3
// used to get 1,024-unit lines).
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { KernGroup } from '../../../project_data/kern_group.js';
import { guideLineLength, hasNoWidthYet } from '../guide_span.js';

const DEFAULT_WIDTH = 1024; // a 2,048 grid

describe('hasNoWidthYet', () => {
	it('a letter with width 0 has no width yet, with or without shapes', () => {
		expect(hasNoWidthYet(new Glyph({ id: 'glyph-0x65' }))).toBe(true);
		expect(hasNoWidthYet({ objType: 'Glyph', advanceWidth: 0, shapes: [] })).toBe(true);
		expect(hasNoWidthYet({ objType: 'Glyph', advanceWidth: 0, shapes: [{}] })).toBe(true);
	});

	it('a width makes it a letter with its own box', () => {
		expect(hasNoWidthYet({ objType: 'Glyph', advanceWidth: 440.7, shapes: [] })).toBe(false);
		expect(hasNoWidthYet({ objType: 'Glyph', advanceWidth: 1, shapes: [{}] })).toBe(false);
	});

	it('a kern pair, or no item at all, never counts', () => {
		expect(hasNoWidthYet(new KernGroup({ id: 'kern-0' }))).toBe(false);
		expect(hasNoWidthYet(undefined)).toBe(false);
		expect(hasNoWidthYet(null)).toBe(false);
	});
});

describe('guideLineLength', () => {
	it('an empty letter gets the default letter width', () => {
		const empty = { objType: 'Glyph', advanceWidth: 0, shapes: [] };
		expect(guideLineLength(empty, 0, DEFAULT_WIDTH)).toBe(DEFAULT_WIDTH);
	});

	it('the first pen click (one point, width still 0) keeps the default letter width', () => {
		const firstClick = { objType: 'Glyph', advanceWidth: 0, shapes: [{}] };
		expect(guideLineLength(firstClick, 10, DEFAULT_WIDTH)).toBe(DEFAULT_WIDTH);
		expect(guideLineLength(firstClick, 0, DEFAULT_WIDTH)).toBe(DEFAULT_WIDTH); // a path with no points
	});

	it('ink past the default width with width 0 reaches the ink', () => {
		const wideInk = { objType: 'Glyph', advanceWidth: 0, shapes: [{}] };
		expect(guideLineLength(wideInk, 1500, DEFAULT_WIDTH)).toBe(1500);
	});

	it('narrow letters keep lines as long as themselves (small l and small t)', () => {
		const l = { objType: 'Glyph', advanceWidth: 440.7, shapes: [{}] };
		const t = { objType: 'Glyph', advanceWidth: 654.3, shapes: [{}] };
		expect(guideLineLength(l, 440.7, DEFAULT_WIDTH)).toBe(440.7);
		expect(guideLineLength(t, 654.3, DEFAULT_WIDTH)).toBe(654.3);
	});

	it('a width with no shapes yet keeps its own length', () => {
		const widthOnly = { objType: 'Glyph', advanceWidth: 200, shapes: [] };
		expect(guideLineLength(widthOnly, 200, DEFAULT_WIDTH)).toBe(200);
	});

	it('a wide letter keeps lines as long as itself', () => {
		const wide = { objType: 'Glyph', advanceWidth: 1500, shapes: [{}] };
		expect(guideLineLength(wide, 1500, DEFAULT_WIDTH)).toBe(1500);
	});

	it('a kern pair keeps its own span', () => {
		expect(guideLineLength(new KernGroup({ id: 'kern-0' }), 0, DEFAULT_WIDTH)).toBe(0);
	});

	it('a missing default width leaves the length as it is', () => {
		const empty = { objType: 'Glyph', advanceWidth: 0, shapes: [] };
		expect(guideLineLength(empty, 0, undefined)).toBe(0);
		expect(guideLineLength(empty, 0, NaN)).toBe(0);
	});
});
