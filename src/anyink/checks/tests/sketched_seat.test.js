// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 follow fix track: Sit on the line on a Centerline sketch, and the size check on a sketched
	letter that stands over its line (docs/SKETCH.md section 3's edge rule: the ink edges sit on
	the lines). The critic's B: a stem sketched 6 px inside both lines (neither end snapped) at
	thickness 160, so its ink ran -52..1530; [Sit on the line] moved the whole stem up 52 and it
	stood 102 units over the capitals line (1480) and 32 over the top line, and no check said so.
	Written to fail first: Sit on the line left the ink at 0..1582; checkLetter returned [].
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { CHECK, checkLetter, FIX, LINE_SHARE } from '../checks.js';
import { TOP_SHARE } from '../sketch_top.js';
import { matchSize, sitOnLine } from '../fixes.js';
import { seatPlan } from '../fix_shapes.js';
import { setModeForTests } from '../../mode/mode.js';
import { guideLines } from '../../placement/classes.js';
import { showItem } from '../../preview/show_item.js';
import { addPiece, addPoint, newSketch, setSketchThickness } from '../../sketch/model.js';
import { builtMatches, builtShapes } from '../../sketch/sketch_record.js';
import {
	FOLLOW_IDS,
	builtLetter,
	followEditor,
	freshInk,
	outlinesApart,
} from '../../sketch/tests/follow_helpers.js';

const THICK = 160;

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
});
afterEach(() => setModeForTests('all'));

/** B's stem alone: one Line from (150, bottom) to (150, top), no point pinned */
function stem(bottom, top) {
	const sketch = newSketch({ thickness: THICK, key: 'sk_test_stem' });
	const a = addPoint(sketch, { x: 150, y: bottom });
	const b = addPoint(sketch, { x: 150, y: top });
	addPiece(sketch, { use: 'center', parts: [{ type: 'line', from: a, to: b }] });
	return sketch;
}

function editorWithStem(bottom, top) {
	const editor = followEditor();
	setSketchThickness(editor.project, THICK);
	const item = builtLetter(editor, FOLLOW_IDS.B, stem(bottom, top));
	showItem(editor, FOLLOW_IDS.B);
	editor.history.addState('Sketched');
	return { editor, item, font: editor.project.settings.font };
}

/** The checks on where it sits and its size (a lone stem is also too narrow: not this file's) */
const lineChecks = (item, font) =>
	checkLetter(item, { font })
		.map((check) => check.id)
		.filter((id) => id === CHECK.offLine || id === CHECK.size);

/** How far the stem's round ends reach past its end points (half the built thickness) */
function reachOf() {
	const { item } = editorWithStem(500, 1000);
	return 500 - item.maxes.yMin;
}

describe('Sit on the line on a Centerline sketch keeps a top near its line on it', () => {
	it('the stem 28..1450 at 160 (ink about -52..1530) lands 0..1480, in sync with its sketch', () => {
		const { editor, item, font } = editorWithStem(28, 1450);
		const lines = guideLines(font);
		expect(item.maxes.yMin).toBeLessThan(-45);
		expect(item.maxes.yMax).toBeGreaterThan(lines.capitals + 45);
		const result = sitOnLine(editor, FOLLOW_IDS.B, { needsALook: null });
		expect(result.done).toBe(true);
		const now = editor.project.glyphs[FOLLOW_IDS.B];
		expect(Math.abs(now.maxes.yMin - lines.writing)).toBeLessThanOrEqual(1.5);
		expect(Math.abs(now.maxes.yMax - lines.capitals)).toBeLessThanOrEqual(1.5);
		// the thickness never changes: the stem is still 160 wide
		expect(Math.round(now.maxes.xMax - now.maxes.xMin)).toBe(THICK);
		expect(builtMatches(now)).toBe(true);
		expect(outlinesApart(builtShapes(now), freshInk(now, editor.project))).toBeLessThanOrEqual(2);
		expect(lineChecks(now, font)).toEqual([]);
	});

	it('a top already far under its line is only moved (the stem stays its own height)', () => {
		const reach = reachOf();
		const { item, font } = editorWithStem(28, 1000);
		expect(seatPlan(item, font)).toEqual({ k: 1, ox: 0, oy: 0, dx: 0, dy: Math.round(reach - 28) });
	});

	it('a sketch sitting low whose top a plain move takes onto its line is only moved', () => {
		const reach = reachOf();
		// the move up puts the top 2 under the capitals line
		const { item, font } = editorWithStem(28, 1480 - 2 - reach - (reach - 28));
		expect(seatPlan(item, font)).toEqual({ k: 1, ox: 0, oy: 0, dx: 0, dy: Math.round(reach - 28) });
	});
});

describe('the size check: a sketched letter standing over its line needs a look', () => {
	it('the stem on the writing line, 98 over the capitals line, is too big, with [Match size]', () => {
		const reach = reachOf();
		const { editor, item, font } = editorWithStem(reach, 1480 + 98 - reach);
		expect(Math.abs(item.maxes.yMin)).toBeLessThanOrEqual(1);
		expect(Math.abs(item.maxes.yMax - 1578)).toBeLessThanOrEqual(1);
		const found = checkLetter(item, { font });
		const size = found.find((check) => check.id === CHECK.size);
		expect(size?.fix).toBe(FIX.matchSize);
		expect(size?.args).toMatchObject({ way: 'big', line: 'capHeight' });
		// and the fix clears it
		expect(matchSize(editor, FOLLOW_IDS.B, { needsALook: null }).done).toBe(true);
		const now = editor.project.glyphs[FOLLOW_IDS.B];
		expect(Math.abs(now.maxes.yMax - guideLines(font).capitals)).toBeLessThanOrEqual(1.5);
		expect(lineChecks(now, font)).toEqual([]);
	});

	it('a sketched top within the off-line share of its line is fine', () => {
		// 38 over, under 2 % of the letter box (41)
		const reach = reachOf();
		const { item, font } = editorWithStem(reach, 1480 + 38 - reach);
		expect(lineChecks(item, font)).toEqual([]);
	});

	it('a handwritten (not sketched) letter the same size is judged as before', () => {
		const reach = reachOf();
		const { item, font } = editorWithStem(reach, 1480 + 98 - reach);
		const plain = item.shapes.map((shape) => new Path({ ...shape.save(), anyink: undefined }));
		item.shapes = [];
		plain.forEach((shape) => item.addOneShape(shape));
		delete item.anyink.sketch;
		expect(Math.abs(item.maxes.yMax - 1578)).toBeLessThanOrEqual(1);
		expect(lineChecks(item, font)).toEqual([]);
	});
});

it('sketch_top.js TOP_SHARE is checks.js LINE_SHARE', () => {
	expect(TOP_SHARE).toBe(LINE_SHARE);
});
