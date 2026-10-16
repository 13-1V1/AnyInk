// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 finalize (written to fail first): a letter with sketch pieces and no ink yet (S2 draws the
	sketch; S3 builds its ink) is not an empty letter on screen, with the 'sketch' flag on:
	  - the empty-letter box steps aside, so it never covers the sketch;
	  - the letter opens on the Line tool, not the opening Brush;
	  - the Next line's facts count the sketch as shapes, so it never says "empty, use the brush".
	With the flag off nothing changes (the box, the Brush and "empty" as before). The card's
	"Empty" goes with S3's ink (docs/SKETCH.md section 11).
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { letterFacts } from '../../coach/font_facts.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { toolForOpenedLetter } from '../../nib/default_tool.js';
import { addPiece, addPoint, newSketch, setSketch } from '../../sketch/model.js';
import { hasSketchPieces } from '../../sketch/sketched.js';
import { overlayShows } from '../empty_overlay.js';
import { resetLetterViewForTests } from '../view_switches.js';

/** n's stem as one stored piece */
function stemSketch() {
	const sketch = newSketch({ thickness: 99 });
	const a = addPoint(sketch, { x: 300, y: 50, kind: 'corner' });
	const b = addPoint(sketch, { x: 300, y: 1050, kind: 'corner' });
	addPiece(sketch, { parts: [{ type: 'line', from: a, to: b }] });
	return sketch;
}

function openB({ sketch = true, sketched = true } = {}) {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, sketch });
	const editor = twoLetterEditor();
	editor.selectedGlyphID = B;
	editor.selectedTool = 'resize';
	if (sketched) setSketch(editor.selectedGlyph, stemSketch());
	return editor;
}

beforeEach(() => resetLetterViewForTests());
afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('a sketched letter with no ink yet', () => {
	it('hasSketchPieces: pieces and the flag on', () => {
		const editor = openB();
		expect(hasSketchPieces(editor.selectedGlyph)).toBe(true);
		setSketch(editor.selectedGlyph, newSketch());
		expect(hasSketchPieces(editor.selectedGlyph)).toBe(false);
		setSketch(editor.selectedGlyph, { ...stemSketch(), setAside: true });
		expect(hasSketchPieces(editor.selectedGlyph)).toBe(false);
		setSketch(editor.selectedGlyph, stemSketch());
		expect(hasSketchPieces(editor.selectedGlyph, { isOn: () => false })).toBe(false);
	});

	it('the empty-letter box steps aside', () => {
		expect(overlayShows(openB())).toBe(false);
	});

	it('opens on the Line tool', () => {
		const editor = openB();
		expect(toolForOpenedLetter(editor.selectedGlyph)).toBe('sketchLine');
	});

	it("the Next line's facts count the sketch as shapes (no ink, not Ready)", () => {
		const editor = openB();
		expect(letterFacts(editor.selectedGlyph, 'B')).toMatchObject({
			ink: false,
			shapes: true,
			ready: false,
		});
	});

	it('with the flag off: the box, the Brush and "empty" as before', () => {
		const editor = openB({ sketch: false });
		expect(overlayShows(editor)).toBe(true);
		expect(toolForOpenedLetter(editor.selectedGlyph)).toBe('nib');
		expect(letterFacts(editor.selectedGlyph, 'B').shapes).toBe(false);
	});

	it('guard: an empty letter with no sketch is empty with the flag on (S3: it opens on the Line)', () => {
		const editor = openB({ sketched: false });
		expect(overlayShows(editor)).toBe(true);
		expect(toolForOpenedLetter(editor.selectedGlyph)).toBe('sketchLine');
		expect(letterFacts(editor.selectedGlyph, 'B').shapes).toBe(false);
	});
});
