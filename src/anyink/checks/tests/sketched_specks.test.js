// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 integration: a sketched piece is never a speck. A sketched dot clear of small n (a piece
	of the sketch's built ink) is left out of checks.js speckPieces and measureLetter, so the
	"Remove N specks" check counts only what Remove specks (fix_shapes.js) can take out. The same
	dot as plain ink is still a speck.
	Written to fail first: speckPieces counted the built dot, and Remove specks skipped it.
*/
import { describe, expect, it } from 'vitest';
import { addPiece, addPoint } from '../../sketch/model.js';
import { storedSketch } from '../../sketch/tests/fixtures/stored_sketches.js';
import { builtLetter, followEditor, FOLLOW_IDS } from '../../sketch/tests/follow_helpers.js';
import { checkLetter, speckPieces } from '../checks.js';
import { removeSpeckShapes } from '../fix_shapes.js';

/** small n with a sketched dot well clear of it, to the right at mid height */
function nWithDot() {
	const editor = followEditor();
	const sketch = storedSketch('n');
	const id = addPoint(sketch, { x: 1100, y: 500, kind: 'smooth' });
	addPiece(sketch, { use: 'center', parts: [{ type: 'spline', points: [id] }] });
	const item = builtLetter(editor, FOLLOW_IDS.n, sketch);
	return { editor, item };
}

describe('sketched specks', () => {
	it('the built dot is no speck; the check and Remove specks agree', () => {
		const { editor, item } = nWithDot();
		expect(item.shapes.length).toBeGreaterThanOrEqual(3);
		expect(speckPieces(item)).toHaveLength(0);
		const problems = checkLetter(item, { font: editor.project.settings.font }) || [];
		expect(problems.map((problem) => problem.id)).not.toContain('specks');
		expect(removeSpeckShapes(item)).toBe(0);
	});

	it('the same dot as plain ink (tags gone) is a speck, and Remove specks takes it', () => {
		const { item } = nWithDot();
		const dot = item.shapes.at(-1);
		delete dot.anyink;
		expect(speckPieces(item)).toHaveLength(1);
		expect(removeSpeckShapes(item)).toBe(1);
	});
});
