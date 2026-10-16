// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 (docs/SKETCH.md section 7, S1 step 11): beforeSketchStep, beside the brush's
	beforeStrokeStep, inside every History item step: a pasted copy of built shapes loses its tags
	in the step itself, and built shapes changed behind the sketch's back set the sketch aside, so
	Undo brings back the sketch as it was. The tests through History.addState were written to fail
	first (run with the call left out of history.js: 3 failed).
	S3: the hook also rebuilds the open letter's ink from its sketch inside the step, so the two
	stand-in squares are replaced by the full sketch's real ink; a pasted copy stays plain, last.
*/
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { B, R, square, twoLetterEditor } from '../../history/tests/two_letters.js';
import { showItem } from '../../preview/show_item.js';
import { beforeSketchStep } from '../history_hook.js';
import { setSketch, sketchOf } from '../model.js';
import { builtMatches, isBuiltShape, markBuilt, tagBuilt } from '../sketch_record.js';
import { fullSketch, FULL_KEY } from './fixtures/full_sketch.js';

let editor;

/** Capital B gets the full sketch and two built shapes (pieces 1 and 3), hashed */
function sketchB() {
	const item = editor.project.glyphs[B];
	setSketch(item, fullSketch());
	const one = item.addOneShape(square(100, 200));
	const three = item.addOneShape(square(400, 200));
	tagBuilt(one, { id: 1, key: FULL_KEY });
	tagBuilt(three, { id: 3, key: FULL_KEY });
	markBuilt(item);
	return item;
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	editor = twoLetterEditor();
	showItem(editor, B);
});

describe('beforeSketchStep on its own', () => {
	it('does nothing on a letter with no sketch and no built shape', () => {
		editor.selectedItem.addOneShape(square());
		expect(beforeSketchStep(editor)).toEqual({ untagged: 0, setAside: false });
		expect(beforeSketchStep(null)).toEqual({ untagged: 0, setAside: false });
		expect(beforeSketchStep({ get selectedItem() { throw new Error('none'); } })).toEqual({
			untagged: 0,
			setAside: false,
		});
	});

	it('strips a pasted copy and keeps the sketch when the built shapes are unchanged', () => {
		const item = sketchB();
		item.addOneShape(item.shapes[0].save());
		expect(beforeSketchStep(editor)).toEqual({ untagged: 1, setAside: false });
		const built = item.shapes.map(isBuiltShape);
		expect(built.at(-1)).toBe(false);
		expect(built.slice(0, -1).every(Boolean)).toBe(true);
		expect(built.length).toBeGreaterThan(3);
		expect(sketchOf(item).setAside).toBe(false);
		expect(builtMatches(item)).toBe(true);
	});

	it('sets the sketch aside when a built shape was changed, once', () => {
		const item = sketchB();
		item.shapes[1].pathPoints[0].p.x -= 25;
		expect(beforeSketchStep(editor)).toEqual({ untagged: 0, setAside: true });
		expect(sketchOf(item).setAside).toBe(true);
		expect(beforeSketchStep(editor)).toEqual({ untagged: 0, setAside: false });
	});

	it('leaves a sketch from a newer app alone', () => {
		const item = sketchB();
		item.anyink.sketch = { v: 5, key: FULL_KEY };
		item.shapes[0].pathPoints[0].p.x += 100;
		expect(beforeSketchStep(editor)).toEqual({ untagged: 0, setAside: false });
		expect(item.anyink.sketch).toEqual({ v: 5, key: FULL_KEY });
	});
});

describe('inside History.addState', () => {
	it("a paste's step holds the copy as plain ink, through Undo and Redo", () => {
		const item = sketchB();
		editor.history.addState('Sketched');
		item.addOneShape(item.shapes[0].save());
		const count = item.shapes.length - 1;
		editor.history.addState('Pasted shapes');
		const pasted = [...Array(count).fill(true), false];
		expect(editor.selectedItem.shapes.map(isBuiltShape)).toEqual(pasted);
		editor.history.restoreState();
		expect(editor.selectedItem.shapes.map(isBuiltShape)).toEqual(Array(count).fill(true));
		editor.history.redoState();
		expect(editor.selectedItem.shapes.map(isBuiltShape)).toEqual(pasted);
		expect(sketchOf(editor.selectedItem).setAside).toBe(false);
	});

	it('a built shape edited behind the sketch sets it aside inside that step; Undo brings it back', () => {
		const item = sketchB();
		editor.history.addState('Sketched');
		item.shapes[1].pathPoints[2].p.y += 60;
		editor.history.addState('Moved a point');
		expect(sketchOf(editor.selectedItem).setAside).toBe(true);
		editor.history.restoreState();
		const back = editor.selectedItem;
		expect(sketchOf(back).setAside).toBe(false);
		expect(builtMatches(back)).toBe(true);
	});

	it('a copy of built shapes pasted into another letter is plain ink there', () => {
		const item = sketchB();
		const saved = item.shapes.map((shape) => shape.save());
		showItem(editor, R);
		const r = editor.selectedItem;
		saved.forEach((shape) => r.addOneShape(shape));
		editor.history.addState('Pasted shapes');
		expect(r.shapes.map(isBuiltShape)).toEqual([false, false]);
		expect(r.shapes.every((shape) => shape.anyink === undefined)).toBe(true);
	});
});
