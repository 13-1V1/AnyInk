// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 7): with the 'sketch' flag on, an empty letter opens on the Line (the
	door's [Sketch it] tool), a letter with ink on Select. The Line picked this way is an opening
	tool, as the Brush is: the door stays and the Next line gives no tool for it; his own pick of
	the Line (or anything) makes it his. With the flag off: the Brush, as before. Written to fail
	first (the Line opened only a letter that already had sketch pieces; nothing knew an opening
	Line).
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { switchToolTo } from '../../../edit_canvas/tools/tools.js';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { flagsOn, resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import {
	isOpeningBrush,
	isOpeningTool,
	OPENING_TOOLS,
	resetOpeningToolForTests,
	toolForOpenedLetter,
} from '../../nib/default_tool.js';
import { deriveEditorState } from '../../coach/font_facts.js';
import { applyOpenTool } from '../open_tool.js';
import { overlayShows } from '../empty_overlay.js';
import { resetLetterViewForTests } from '../view_switches.js';
import { addPiece, addPoint, newSketch, setSketch } from '../../sketch/model.js';
import { tagBuilt } from '../../sketch/sketch_record.js';

const corner = (x, y) => ({ p: { coord: { x, y } } });
const square = () =>
	new Path({
		name: 'Square',
		pathPoints: [corner(0, 0), corner(400, 0), corner(400, 400), corner(0, 400)],
	});

let editor;
function open({ sketch = true } = {}) {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, sketch });
	editor = twoLetterEditor();
	editor.eventHandlers.tool_addPath = {};
	editor.selectedTool = 'resize';
	editor.selectedGlyphID = B;
	editor.selectedGlyph.shapes = [];
	return editor;
}

beforeEach(() => {
	resetOpeningToolForTests();
	resetLetterViewForTests();
});
afterEach(() => {
	resetOpeningToolForTests();
	resetFeaturesForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('toolForOpenedLetter with the sketch flag', () => {
	it('an empty letter: the Line; with ink: Select; no record: the Line', () => {
		const isOn = flagsOn('brush', 'sketch');
		open();
		expect(toolForOpenedLetter(editor.selectedGlyph, { isOn })).toBe('sketchLine');
		editor.selectedGlyph.addOneShape(square());
		expect(toolForOpenedLetter(editor.selectedGlyph, { isOn })).toBe('resize');
		expect(toolForOpenedLetter(null, { isOn })).toBe('sketchLine');
	});

	it('the Line even with the Brush flag off; nothing with both off', () => {
		open();
		expect(toolForOpenedLetter(editor.selectedGlyph, { isOn: flagsOn('sketch') })).toBe(
			'sketchLine'
		);
		expect(toolForOpenedLetter(editor.selectedGlyph, { isOn: flagsOn() })).toBeNull();
	});

	it('guard, the flag off: the Brush, as before', () => {
		open({ sketch: false });
		expect(toolForOpenedLetter(editor.selectedGlyph, { isOn: flagsOn('brush') })).toBe('nib');
		expect(OPENING_TOOLS).toEqual(['nib', 'sketchLine']);
	});
});

describe('the letter view opens an empty letter on the Line', () => {
	it('picked as an opening tool: the door stays, the Next line gives no tool', () => {
		open();
		expect(applyOpenTool(editor)).toBe('sketchLine');
		expect(editor.selectedTool).toBe('sketchLine');
		expect(isOpeningTool(editor)).toBe(true);
		expect(isOpeningBrush(editor)).toBe(false);
		expect(overlayShows(editor)).toBe(true);
		expect(deriveEditorState(editor).tool).toBe('');
	});

	it('his own pick of the Line makes it his: the door steps aside, the line names the tool', () => {
		open();
		applyOpenTool(editor);
		switchToolTo('sketchLine');
		expect(isOpeningTool(editor)).toBe(false);
		expect(overlayShows(editor)).toBe(false);
		expect(deriveEditorState(editor).tool).toBe('sketchLine');
	});

	it('opening it again on the same letter tells nothing new', () => {
		open();
		applyOpenTool(editor);
		expect(applyOpenTool(editor)).toBe('sketchLine');
		expect(isOpeningTool(editor)).toBe(true);
	});

	it("another letter: the opening Line is not that letter's until it opens there", () => {
		open();
		applyOpenTool(editor);
		editor.selectedGlyphID = 'glyph-0x72';
		expect(isOpeningTool(editor)).toBe(false);
	});

	it('a letter with ink opens on Select', () => {
		open();
		editor.selectedGlyph.addOneShape(square());
		editor.selectedTool = 'sketchLine';
		expect(applyOpenTool(editor)).toBe('resize');
		expect(editor.selectedTool).toBe('resize');
	});

	it('guard, the flag off: the opening Brush, as before', () => {
		open({ sketch: false });
		expect(applyOpenTool(editor)).toBe('nib');
		expect(isOpeningBrush(editor)).toBe(true);
		expect(isOpeningTool(editor)).toBe(true);
	});
});

describe('S4: a sketched letter with ink opens on Select, which edits its sketch', () => {
	// S3 fix pass found in Chrome: Capital B, sketched, opened on Select; one drag of a bowl moved a
	// built shape and the sketch was set aside, so S3 opened it on the Line. S4's Select on the
	// sketch (sketch/select_tool.js) never touches the built shapes, so the S3 rule is lifted.
	function sketchedB({ aside = false } = {}) {
		open();
		const sketch = newSketch({ thickness: 99 });
		const a = addPoint(sketch, { x: 300, y: 50, kind: 'corner' });
		const b = addPoint(sketch, { x: 300, y: 1400, kind: 'corner' });
		const pieceId = addPiece(sketch, { parts: [{ type: 'line', from: a, to: b }] }).id;
		if (aside) sketch.setAside = true;
		setSketch(editor.selectedGlyph, sketch);
		editor.selectedGlyph.addOneShape(square());
		tagBuilt(editor.selectedGlyph.shapes[0], { id: pieceId, key: sketch.key });
		editor.selectedTool = 'resize';
		return editor;
	}

	it('toolForOpenedLetter: Select for a sketched letter with built ink', () => {
		sketchedB();
		expect(toolForOpenedLetter(editor.selectedGlyph, { isOn: flagsOn('brush', 'sketch') })).toBe(
			'resize'
		);
	});

	it('applyOpenTool picks Select; no empty-letter box over the ink', () => {
		sketchedB();
		editor.selectedTool = 'sketchLine';
		expect(applyOpenTool(editor)).toBe('resize');
		expect(editor.selectedTool).toBe('resize');
		expect(overlayShows(editor)).toBe(false);
	});

	it('a sketch set aside: Select, as any letter with ink', () => {
		sketchedB({ aside: true });
		expect(applyOpenTool(editor)).toBe('resize');
	});

	it('guard, the flag off: Select on a letter with ink, as before', () => {
		sketchedB();
		setFeaturesForTests({ sketch: false });
		expect(toolForOpenedLetter(editor.selectedGlyph, { isOn: flagsOn('brush') })).toBe('resize');
	});
});
