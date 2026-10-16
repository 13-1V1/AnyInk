// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 undo-tips, on the real Simple letter page with the real coach: picking a sketch tool (the
	'whichToolIsSelected' topic every tool pick sends) puts its tip beside the Next line's
	sentence; the coach's own tips keep it through an open piece's clicks and let it go after.
	With the 'sketch' flag off a pick of the same name shows nothing.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCoach } from '../coach_state.js';
import { notePickedTool } from '../../nib/default_tool.js';
import { letterPage, setUpScreenTests, settle, shownEl } from '../../letter/tests/simple_screen.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import {
	clearOpenPiece,
	resetUndoGateForTests,
	setOpenPiece,
} from '../../sketch/tools/undo_gate.js';
import { word } from '../../words/words.js';

setUpScreenTests();

const nextTip = () => {
	const tip = document.querySelector('anyink-coach .anyink-coach__tip');
	return shownEl(tip) ? tip.querySelector('.anyink-coach__tip-text')?.textContent || '' : '';
};

beforeEach(() => {
	resetUndoGateForTests();
	setFeaturesForTests({ sketch: true });
});
afterEach(() => {
	resetUndoGateForTests();
	resetFeaturesForTests();
});

describe('a sketch tool picked on the letter page', () => {
	it("Line's first pick: its tip beside the Next line; it stays while a piece is open", async () => {
		const editor = letterPage({ id: 'glyph-0x6E' });
		await settle();
		// S3: an empty letter opens on the Line by itself (no tip); his own pick starts from
		// another tool, as tools.js switchToolTo notes it
		editor.selectedTool = 'resize';
		notePickedTool(editor);
		editor.selectedTool = 'sketchLine';
		editor.publish('whichToolIsSelected', 'sketchLine');
		await settle();
		expect(nextTip()).toBe(word('sketch.tip.line'));

		const piece = { n: 2, pointCount: () => piece.n, removeLastPoint() {}, cancel() {}, finish() {} };
		setOpenPiece(piece);
		const tips = getCoach().tips;
		tips.noteAction();
		tips.noteAction();
		await settle();
		expect(nextTip()).toBe(word('sketch.tip.line'));
		clearOpenPiece(piece);
		tips.noteAction();
		await settle();
		expect(nextTip()).toBe('');
	});

	it('Spline, then Circle: each its own tip, once', async () => {
		const editor = letterPage({ id: 'glyph-0x6E' });
		await settle();
		editor.publish('whichToolIsSelected', 'sketchSpline');
		await settle();
		expect(nextTip()).toBe('Fewer points, smoother curve.');
		getCoach().tips.noteAction();
		editor.publish('whichToolIsSelected', 'sketchCircle');
		await settle();
		expect(nextTip()).toBe(word('sketch.tip.circle'));
		getCoach().tips.noteAction();
		editor.publish('whichToolIsSelected', 'sketchSpline');
		await settle();
		expect(nextTip()).toBe('');
	});

	it("with the 'sketch' flag off: no tip", async () => {
		setFeaturesForTests({ sketch: false });
		const editor = letterPage({ id: 'glyph-0x6E' });
		await settle();
		editor.publish('whichToolIsSelected', 'sketchLine');
		await settle();
		expect(nextTip()).toBe('');
	});
});
