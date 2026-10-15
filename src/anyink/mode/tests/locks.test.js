// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 (UX-BEGINNER.md 7.6 "Guide lines are locked in Simple mode"): only the horizontal kinds
// 'metric' and 'baseline' lock, at guides_layer.js's two gates (a drag, an arrow nudge); the side
// edges on the same layer stay draggable. Move the guide lines (4.8, B15) unlocks the horizontal
// lines; the writing line stays locked. All tools locks nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { setModeForTests } from '../mode.js';
import { isGuideLineLocked } from '../locks.js';

afterEach(() => setModeForTests('all'));

const KINDS = ['metric', 'baseline', 'sideBearing', 'guide'];
const locked = (options) => KINDS.filter((kind) => isGuideLineLocked({ kind }, options));

describe('guide line locks', () => {
	it('All tools locks nothing', () => {
		expect(locked({ mode: 'all' })).toEqual([]);
		expect(locked({ mode: 'all', moving: true })).toEqual([]);
	});

	it('Simple locks the horizontal lines and leaves the edges (and his own guides) draggable', () => {
		expect(locked({ mode: 'simple' })).toEqual(['metric', 'baseline']);
	});

	it('Move the guide lines unlocks them, except the writing line', () => {
		expect(locked({ mode: 'simple', moving: true })).toEqual(['baseline']);
	});

	it('reads the real mode by default, and takes a kind on its own', () => {
		expect(isGuideLineLocked('metric')).toBe(false);
		setModeForTests('simple');
		expect(isGuideLineLocked('metric')).toBe(true);
		expect(isGuideLineLocked({ kind: 'sideBearing', id: 'rsb' })).toBe(false);
		expect(isGuideLineLocked(null)).toBe(false);
		expect(isGuideLineLocked({})).toBe(false);
	});
});

// B4 + B5 finalize (verdict "Dragging the left edge of an empty letter ... the edge moves the wrong
// way", the All tools variant): an empty letter's left space is measured from ink it doesn't
// have, so its left edge can't move; pushed left, upstream grew the width and moved the right
// edge instead. The left edge of a letter with no shapes is locked in both modes; its right edge
// (the width, e.g. a space) stays draggable in All tools.
describe('the left edge of a letter with no shapes', () => {
	const empty = { shapes: [] };
	const inked = { shapes: [{}] };
	const lsb = { kind: 'sideBearing', side: 'lsb' };
	const rsb = { kind: 'sideBearing', side: 'rsb' };

	it('is locked in both modes', () => {
		expect(isGuideLineLocked(lsb, { mode: 'all', item: empty })).toBe(true);
		expect(isGuideLineLocked(lsb, { mode: 'simple', item: empty })).toBe(true);
	});

	it('All tools: its right edge (the width) still moves', () => {
		expect(isGuideLineLocked(rsb, { mode: 'all', item: empty })).toBe(false);
	});

	it('a letter with ink: both edges move in All tools, as before', () => {
		expect(isGuideLineLocked(lsb, { mode: 'all', item: inked })).toBe(false);
		expect(isGuideLineLocked(rsb, { mode: 'all', item: inked })).toBe(false);
	});
});
