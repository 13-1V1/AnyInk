// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 (UX-BEGINNER.md 7.6 "Guide lines are locked in Simple mode"): only the horizontal kinds
// 'metric' and 'baseline' lock, at guides_layer.js's two gates (a drag, an arrow nudge); the side
// edges on the same layer stay draggable. Move the guide lines (4.8, B15) unlocks the horizontal
// lines; the writing line stays locked. All tools locks nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { setFineTuneOpen } from '../../letter/view_switches.js';
import { setFeaturesForTests } from '../features.js';
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
		setFeaturesForTests({ letterView: false }); // B5; B7's letter view: below
		expect(locked({ mode: 'simple' })).toEqual(['metric', 'baseline']);
	});

	it('Move the guide lines unlocks them, except the writing line', () => {
		setFeaturesForTests({ letterView: false });
		expect(locked({ mode: 'simple', moving: true })).toEqual(['baseline']);
	});

	it('reads the real mode by default, and takes a kind on its own', () => {
		setFeaturesForTests({ letterView: false });
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

// B6 + B7 integration (letter-canvas track's hand-off, UX-BEGINNER.md 4.3 "Edges and spaces (only
// while Fine-tune is open)"): with Fine-tune closed the letter view draws no edges, so they must
// not move either: no cursor change, no drag, no arrow nudge changing the spacing unseen.
describe('the letter view (B7): the side edges move only while Fine-tune shows them', () => {
	const inked = { shapes: [{}] };
	const lsb = { kind: 'sideBearing', side: 'lsb' };
	const rsb = { kind: 'sideBearing', side: 'rsb' };

	it('Fine-tune closed: both edges of a letter with ink are locked', () => {
		setModeForTests('simple');
		expect(isGuideLineLocked(lsb, { item: inked })).toBe(true);
		expect(isGuideLineLocked(rsb, { item: inked })).toBe(true);
		expect(isGuideLineLocked(rsb, { mode: 'simple', item: inked })).toBe(true);
	});

	it('Fine-tune open: both move, as B3 and B5 left them', () => {
		setModeForTests('simple');
		setFineTuneOpen(true, null);
		expect(isGuideLineLocked(lsb, { item: inked })).toBe(false);
		expect(isGuideLineLocked(rsb, { item: inked })).toBe(false);
	});

	it('the horizontal lines stay as they were, open or closed', () => {
		setModeForTests('simple');
		expect(locked({ mode: 'simple', item: inked })).toEqual(['metric', 'baseline', 'sideBearing']);
		setFineTuneOpen(true, null);
		expect(locked({ mode: 'simple', item: inked })).toEqual(['metric', 'baseline']);
	});

	it('All tools, and Simple before the letter view: unchanged', () => {
		expect(isGuideLineLocked(rsb, { mode: 'all', item: inked })).toBe(false);
		setModeForTests('simple');
		setFeaturesForTests({ letterView: false });
		expect(isGuideLineLocked(rsb, { item: inked })).toBe(false);
	});
});

// B6 + B7 integration (found in Chrome, tests/b67.verify.mjs): with Fine-tune open and a drawing
// tool picked, a click meant for a point landed on the left edge (automatic spacing had moved the
// ink across it) and dragged the edge instead. In Simple a drawing tool's press always draws.
describe('the letter view (B7): a drawing tool picked, the edges never take the press', () => {
	const inked = { shapes: [{}] };
	const rsb = { kind: 'sideBearing', side: 'rsb' };

	it.each(['newPath', 'newRectangle', 'newOval', 'nib'])('%s: both edges locked', (tool) => {
		setModeForTests('simple');
		setFineTuneOpen(true, null);
		expect(isGuideLineLocked(rsb, { item: inked, tool })).toBe(true);
		expect(isGuideLineLocked({ kind: 'sideBearing', side: 'lsb' }, { item: inked, tool })).toBe(true);
	});

	it('Select and Edit points: the edges move, as before', () => {
		setModeForTests('simple');
		setFineTuneOpen(true, null);
		expect(isGuideLineLocked(rsb, { item: inked, tool: 'resize' })).toBe(false);
		expect(isGuideLineLocked(rsb, { item: inked, tool: 'pathEdit' })).toBe(false);
	});

	it('All tools: a drawing tool changes nothing', () => {
		expect(isGuideLineLocked(rsb, { mode: 'all', item: inked, tool: 'newPath' })).toBe(false);
	});
});
