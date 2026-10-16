// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 integration: All tools' left-edge move (metrics/guides_layer.js nudgeLine, the arrow keys on
	the left edge line; the drag goes through the same follow) moves a sketched letter's sketch
	with its shapes, so the step keeps the sketch active and its ink in sync. The photo stays
	where it was in All tools, as before (B3).
	Written to fail first: the follow ran only in Simple, so the step set the sketch aside.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nudgeLine } from '../../metrics/guides_layer.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { isSketchActive, sketchOf } from '../model.js';
import { builtMatches } from '../sketch_record.js';
import { storedSketch } from './fixtures/stored_sketches.js';
import { FOLLOW_IDS, builtLetter, followEditor, freshInk, outlinesApart } from './follow_helpers.js';

beforeEach(() => {
	setModeForTests('all');
	setFeaturesForTests({ sketch: true });
});
afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
});

describe("All tools' left edge", () => {
	it('moving the left edge line moves the sketch with the shapes; the step keeps it active', () => {
		const editor = followEditor();
		const item = builtLetter(editor, FOLLOW_IDS.n, storedSketch('n'));
		editor.selectedGlyphID = FOLLOW_IDS.n;
		editor.history.initialize(editor.project);
		const x0 = Object.values(sketchOf(item).points)[0].x;
		const lsb = item.leftSideBearing;
		nudgeLine(editor, { kind: 'sideBearing', side: 'lsb', orientation: 'v' }, -10);
		const now = editor.project.getItem(FOLLOW_IDS.n);
		expect(now.leftSideBearing).toBe(lsb + 10);
		const sketch = sketchOf(now);
		expect(isSketchActive(sketch)).toBe(true);
		expect(Object.values(sketch.points)[0].x).toBe(x0 + 10);
		expect(builtMatches(now, sketch)).toBe(true);
		expect(outlinesApart(now.shapes, freshInk(now, editor.project))).toBeLessThan(1);
	});
});
