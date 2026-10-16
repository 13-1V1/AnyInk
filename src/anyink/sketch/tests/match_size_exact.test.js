// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 integration (found by tests/sketch_build.verify.mjs): [Match size] on a Centerline letter
	drawn much too small at a thick stroke. B16's weightPlan limits how much a letter is thinned
	(MAX_THIN of its stroke) because Brush ink is pushed, not rebuilt; a Centerline sketch is
	rebuilt at its own thickness after the scale, so the limit must not apply: the letter lands
	exactly from the writing line to the small-letter line (round tops and bottoms with their
	overshoot), still in sync with its sketch.
	Written to fail first: with the limit, a small x at 147 units grew to 20 units inside both
	lines.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { matchSize } from '../../checks/fixes.js';
import { weightPlan } from '../../checks/keep_weight.js';
import { setModeForTests } from '../../mode/mode.js';
import { guideLines } from '../../placement/classes.js';
import { showItem } from '../../preview/show_item.js';
import { addPiece, addPoint, newSketch } from '../model.js';
import { builtMatches, builtShapes } from '../sketch_record.js';
import { storedSketch } from './fixtures/stored_sketches.js';
import { FOLLOW_IDS, builtLetter, followEditor, freshInk, outlinesApart } from './follow_helpers.js';

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
});
afterEach(() => setModeForTests('all'));

/** small x: two crossing Lines, ink from the writing line to `top`, at `thickness` */
function smallX(thickness, top) {
	const sketch = newSketch({ thickness, key: 'sk_test_x' });
	const r = thickness / 2;
	const a = addPoint(sketch, { x: 150, y: r });
	const b = addPoint(sketch, { x: 450, y: top - r });
	const c = addPoint(sketch, { x: 450, y: r });
	const d = addPoint(sketch, { x: 150, y: top - r });
	addPiece(sketch, { use: 'center', parts: [{ type: 'line', from: a, to: b }] });
	addPiece(sketch, { use: 'center', parts: [{ type: 'line', from: c, to: d }] });
	return sketch;
}

/** The sketch built on small n (a small-letter-line letter, as x is) */
function editorWithX(sketch) {
	const editor = followEditor();
	const item = builtLetter(editor, FOLLOW_IDS.n, sketch);
	return { editor, item };
}

describe('Match size on a Centerline sketch keeps its thickness exactly', () => {
	it('weightPlan: exact skips the thinning limit', () => {
		const limited = weightPlan({ height: 660, line: 1100, stroke: 147 });
		const exact = weightPlan({ height: 660, line: 1100, stroke: 147, exact: true });
		expect(limited.k).toBeCloseTo((1100 + 2 * 0.25 * 147) / 660, 9);
		expect(exact.k).toBeCloseTo((1100 - 147) / (660 - 147), 9);
		expect(exact.k * (660 - 147) + 147).toBeCloseTo(1100, 9);
	});

	it('a 0.6-tall n at 147 grows onto both lines and stays in sync', () => {
		const sketch = storedSketch('n');
		sketch.thickness = 147;
		for (const point of Object.values(sketch.points)) {
			point.x = Math.round(point.x * 0.6);
			point.y = Math.round(point.y * 0.6);
			delete point.on;
			delete point.inset;
		}
		const { editor, item } = editorWithX(sketch);
		showItem(editor, FOLLOW_IDS.n);
		editor.history.addState('Sketched');
		const lines = guideLines(editor.project.settings.font);
		expect(item.maxes.yMax).toBeLessThan(lines.small * 0.7);
		const result = matchSize(editor, FOLLOW_IDS.n, { needsALook: null });
		expect(result.done).toBe(true);
		const now = editor.project.glyphs[FOLLOW_IDS.n];
		expect(Math.abs(now.maxes.yMin - lines.writing)).toBeLessThanOrEqual(1.5);
		const top = now.maxes.yMax;
		expect(
			Math.min(Math.abs(top - lines.small), Math.abs(top - lines.small - lines.overshoot))
		).toBeLessThanOrEqual(1.5);
		expect(builtMatches(now)).toBe(true);
		expect(outlinesApart(builtShapes(now), freshInk(now, editor.project))).toBeLessThanOrEqual(1);
	});

	it('small x (two Lines, in small n) lands from the writing line to the small-letter line', () => {
		const { editor } = editorWithX(smallX(147, 660));
		showItem(editor, FOLLOW_IDS.n);
		editor.history.addState('Sketched');
		const result = matchSize(editor, FOLLOW_IDS.n, { needsALook: null });
		expect(result.done).toBe(true);
		const now = editor.project.glyphs[FOLLOW_IDS.n];
		const lines = guideLines(editor.project.settings.font);
		expect(Math.abs(now.maxes.yMin - lines.writing)).toBeLessThanOrEqual(1);
		expect(Math.abs(now.maxes.yMax - lines.small)).toBeLessThanOrEqual(1);
		expect(builtMatches(now)).toBe(true);
	});
});
