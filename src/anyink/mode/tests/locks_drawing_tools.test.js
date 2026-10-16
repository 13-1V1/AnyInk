// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 (found in Chrome, All tools): a Pen click on the writing line placed no point, and a
// Rectangle started on an edge dragged the edge (width 1252 -> 1672) instead of drawing. Upstream
// had no draggable lines on the edit canvas, so a drawing tool always got the press. With a
// drawing tool picked, every line kind locks in both modes; Select and Edit points still drag.
import { afterEach, describe, expect, it } from 'vitest';
import { setFeaturesForTests } from '../features.js';
import { setModeForTests } from '../mode.js';
import { isGuideLineLocked } from '../locks.js';

afterEach(() => setModeForTests('all'));

const KINDS = ['metric', 'baseline', 'sideBearing', 'guide'];
const DRAWING = ['newPath', 'newRectangle', 'newOval', 'nib'];
const inked = { shapes: [{}] };
const locked = (options) =>
	KINDS.filter((kind) => isGuideLineLocked({ kind, side: 'rsb' }, options));

describe("a drawing tool picked: the press is the tool's, never a line's", () => {
	it('the examples from the bug report', () => {
		expect(isGuideLineLocked({ kind: 'baseline' }, { mode: 'all', tool: 'newPath' })).toBe(true);
		expect(
			isGuideLineLocked(
				{ kind: 'sideBearing', side: 'rsb' },
				{ mode: 'all', tool: 'newRectangle', item: inked }
			)
		).toBe(true);
		expect(
			isGuideLineLocked(
				{ kind: 'sideBearing', side: 'lsb' },
				{ mode: 'all', tool: 'newRectangle', item: inked }
			)
		).toBe(true);
	});

	it.each(DRAWING)('All tools, %s: every line kind locks', (tool) => {
		expect(locked({ mode: 'all', tool, item: inked })).toEqual(KINDS);
		expect(locked({ mode: 'all', tool, item: inked, moving: true })).toEqual(KINDS);
	});

	it.each(DRAWING)('Simple, %s: every line kind locks, with or without the letter view', (tool) => {
		expect(locked({ mode: 'simple', tool, item: inked, moving: true })).toEqual(KINDS);
		setFeaturesForTests({ letterView: false });
		expect(locked({ mode: 'simple', tool, item: inked, moving: true })).toEqual(KINDS);
	});

	it.each(['resize', 'pathEdit', 'pathAddPoint', 'kern', undefined])(
		'All tools, %s: the lines still drag, as M5 intended',
		(tool) => {
			expect(locked({ mode: 'all', tool, item: inked })).toEqual([]);
		}
	);
});
