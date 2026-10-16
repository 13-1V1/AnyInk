// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3: what the Next line reads about the open letter's sketch (sketch_facts.js), and that
	font_facts.js deriveEditorState hands it to the rules only with the 'sketch' flag on, in the
	letter view. Built Centerline shapes are Centerline ink; a sketch with no built shapes is not;
	an Outline piece finished open is a gap, a 1-point piece never is; the other sketched letters
	whose thickness differs are counted; the action names say which buttons can answer. Reading
	never writes a sketch. Written to fail first (none of it existed).
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { B, R, twoLetterEditor } from '../../history/tests/two_letters.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { addPiece, addPoint, newSketch, setSketch } from '../../sketch/model.js';
import { tagBuilt } from '../../sketch/sketch_record.js';
import { resetUndoGateForTests, setOpenPiece } from '../../sketch/tools/undo_gate.js';
import { deriveEditorState } from '../font_facts.js';
import { hasCenterPiece, sketchFacts } from '../sketch_facts.js';

const corner = (x, y) => ({ p: { coord: { x, y } } });
const box = () =>
	new Path({
		name: 'Built',
		pathPoints: [corner(250, 0), corner(350, 0), corner(350, 700), corner(250, 700)],
	});

/** A stem sketch (use 'center' or 'outline'); built: its shape on the letter, tagged */
function sketchOn(item, { use = 'center', thickness = 99, built = true, closed = false } = {}) {
	const sketch = newSketch({ way: use, thickness });
	const a = addPoint(sketch, { x: 300, y: 50 });
	const b = addPoint(sketch, { x: 300, y: 650 });
	const piece = addPiece(sketch, { use, closed, parts: [{ type: 'line', from: a, to: b }] });
	setSketch(item, sketch);
	if (built) {
		item.addOneShape(box());
		tagBuilt(item.shapes.at(-1), { id: piece.id, key: sketch.key });
	}
	return sketch;
}

let editor;
beforeEach(() => {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, sketch: true });
	editor = twoLetterEditor();
	editor.selectedGlyphID = B;
	editor.selectedTool = 'resize';
	resetUndoGateForTests();
});
afterEach(() => {
	resetUndoGateForTests();
	resetFeaturesForTests();
	setModeForTests('all');
});

describe('sketchFacts', () => {
	it('a built Centerline stem: Centerline ink, its thickness, no font thickness yet', () => {
		const item = editor.project.getItem(B);
		sketchOn(item);
		expect(sketchFacts(item, editor.project)).toMatchObject({
			pieceOpen: false,
			gap: false,
			centerInk: true,
			thickness: 99,
			fontThickness: null,
			differ: 0,
			sketched: 1,
			canUseOnAll: false,
			canClose: false,
		});
	});

	it('a sketch not built yet is no Centerline ink; an Outline piece is none either', () => {
		const item = editor.project.getItem(B);
		sketchOn(item, { built: false });
		expect(sketchFacts(item, editor.project).centerInk).toBe(false);
		item.shapes = [];
		sketchOn(item, { use: 'outline' });
		expect(sketchFacts(item, editor.project).centerInk).toBe(false);
	});

	it('an Outline piece finished open is a gap; a closed one or a dot is not', () => {
		const item = editor.project.getItem(B);
		sketchOn(item, { use: 'outline', built: false });
		expect(sketchFacts(item, editor.project).gap).toBe(true);
		const sketch = sketchOn(item, { use: 'outline', built: false, closed: true });
		expect(sketchFacts(item, editor.project).gap).toBe(false);
		sketch.pieces[0].closed = false;
		sketch.pieces[0].parts = [{ type: 'spline', points: ['p1'] }];
		expect(sketchFacts(item, editor.project).gap).toBe(false);
	});

	it('a set-aside sketch says nothing', () => {
		const item = editor.project.getItem(B);
		const sketch = sketchOn(item, { use: 'outline', built: false });
		sketch.setAside = true;
		expect(sketchFacts(item, editor.project)).toMatchObject({ gap: false, centerInk: false, thickness: 0 });
	});

	it('the other sketched letters whose thickness differs, and the font thickness', () => {
		const b = editor.project.getItem(B);
		const r = editor.project.getItem(R);
		sketchOn(b, { thickness: 120 });
		sketchOn(r, { thickness: 99 });
		editor.project.settings.anyink = { ...(editor.project.settings.anyink || {}), sketchThickness: 120 };
		expect(sketchFacts(b, editor.project)).toMatchObject({
			thickness: 120,
			fontThickness: 120,
			differ: 1,
			sketched: 2,
		});
		sketchOn(r, { thickness: 120 });
		expect(sketchFacts(b, editor.project)).toMatchObject({ differ: 0, sketched: 2 });
	});

	it('which buttons can answer, from the action names', () => {
		const item = editor.project.getItem(B);
		const facts = sketchFacts(item, editor.project, {
			pieceOpen: true,
			actions: (name) => name === 'sketchUseOnAll',
		});
		expect(facts).toMatchObject({ pieceOpen: true, canUseOnAll: true, canClose: false });
		expect(hasCenterPiece(null)).toBe(false);
	});
});

describe('deriveEditorState hands it to the rules', () => {
	it('the letter view with the flag on: the open letter\'s sketch, a piece open from the Undo gate', () => {
		sketchOn(editor.project.getItem(B));
		setOpenPiece({ pointCount: () => 2, removeLastPoint() {}, cancel() {}, finish() {} });
		const state = deriveEditorState(editor);
		expect(state.sketch).toMatchObject({ pieceOpen: true, centerInk: true, thickness: 99 });
	});

	it('guard: null with the flag off, and off the letter view', () => {
		sketchOn(editor.project.getItem(B));
		expect(deriveEditorState(editor, { isOn: (name) => name !== 'sketch' }).sketch).toBeNull();
		editor.nav.page = 'Overview';
		expect(deriveEditorState(editor).sketch).toBeNull();
	});

	it('a letter with no sketch: nothing to say', () => {
		const state = deriveEditorState(editor);
		expect(state.sketch).toMatchObject({ centerInk: false, gap: false, pieceOpen: false });
		expect(editor.project.getItem(B).anyink?.sketch).toBeUndefined();
	});
});
