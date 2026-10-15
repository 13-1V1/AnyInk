// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 fix (hostile finding "nextStrokeId reads only the stroke records, not the ids already
	on shapes, so a pasted brush shape shares its id with another stroke"). Shapes keep their
	stroke tags now (path.js), so upstream's Copy and Paste carries them. Through the real
	clipboard (project_editor/actions.js clipboardCopy / clipboardPaste) in All tools:
	  - pasted into its own letter, a whole stroke becomes a stroke of its own: a new id no shape
	    has, its own record, its skeleton where the copy's ink is; the next stroke's id is new too
	  - pasted into another letter, the same, with the first letter's record
	  - only some of a stroke's shapes pasted (the hole of an o): no stroke, an ordinary shape
	  - a new id is one more than any id on the letter's shapes, record or not
	  - the name rule: a shape renamed "Brush stroke 1" while stroke 1 has its shapes stays
	    ordinary (no tag, so Merge and auto-hole treat it as any shape)
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { B, R, twoLetterEditor } from '../../history/tests/two_letters.js';
import { isBrushStroke } from '../../letter/auto_hole.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { clipboardCopy, clipboardPaste } from '../../../project_editor/actions.js';
import { Path } from '../../../project_data/path.js';
import { resetBrushForTests } from '../brush_size.js';
import { makeNibTool } from '../nib_tool.js';
import {
	nextStrokeId,
	reconcileStrokes,
	strokeIdOf,
	strokeRecords,
	strokeShapes,
	strokeSkeleton,
	tagStroke,
} from '../stroke_record.js';
import { line, loop } from './strokes.js';

let editor;
let canvas;
let tool;
let clock = 1000;

const event = (type, [x, y]) => {
	clock += 8;
	return {
		type,
		pointerId: 1,
		pointerType: 'mouse',
		isPrimary: true,
		button: type === 'pointermove' ? -1 : 0,
		buttons: type === 'pointerup' ? 0 : 1,
		clientX: editor.view.dx + x * editor.view.dz,
		clientY: editor.view.dy - y * editor.view.dz,
		timeStamp: clock,
		preventDefault: () => {},
	};
};
function drag(path) {
	tool.down(event('pointerdown', path[0]));
	path.slice(1).forEach((point) => tool.move(event('pointermove', point)));
	return tool.up(event('pointerup', path.at(-1)));
}
const letter = () => editor.selectedItem;
const ids = (item = letter()) => item.shapes.map(strokeIdOf);
const recordIds = (item = letter()) => strokeRecords(item).map((record) => record.id);
/** Copy some shapes of the open letter, as Ctrl+C does with them picked */
function copy(shapes) {
	editor.multiSelect.shapes.clear();
	shapes.forEach((shape) => editor.multiSelect.shapes.add(shape));
	clipboardCopy();
}
const moved = (skeleton, [dx, dy]) =>
	skeleton.map((curve) => curve.map(([x, y]) => [x + dx, y + dy]));

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '';
	resetToastsForTests();
	resetBrushForTests();
	setModeForTests('all');
	setFeaturesForTests({ brush: true });
	editor = twoLetterEditor();
	showItem(editor, B);
	editor.view = { dx: 100, dy: 900, dz: 1 };
	editor.editCanvas = { redraw: () => {} };
	editor.selectedTool = 'nib';
	canvas = document.createElement('canvas');
	document.body.appendChild(canvas);
	tool = makeNibTool(canvas, { getEditor: () => editor });
});
afterEach(() => {
	vi.restoreAllMocks();
	resetToastsForTests();
	document.body.innerHTML = '';
});

describe('a pasted brush stroke is a stroke of its own', () => {
	it('in its own letter: a new id, its own record, and the next stroke is new again', () => {
		drag(line([100, 100], [400, 100]));
		const original = strokeSkeleton(letter(), 1);
		copy(letter().shapes);
		clipboardPaste(); // upstream moves a paste into the same letter 20 right, 20 down
		expect(ids()).toEqual([1, 2]);
		expect(recordIds()).toEqual([1, 2]);
		expect(strokeShapes(letter(), 1)).toEqual([letter().shapes[0]]);
		expect(strokeShapes(letter(), 2)).toEqual([letter().shapes[1]]);
		expect(strokeSkeleton(letter(), 2)).toEqual(moved(original, [20, -20]));
		expect(strokeSkeleton(letter(), 1)).toEqual(original);
		const next = drag(line([100, 400], [400, 400]));
		expect(next.strokeId).toBe(3);
		expect(ids()).toEqual([1, 2, 3]);
		expect(strokeShapes(letter(), 1)).toHaveLength(1);
	});

	it('an o (its ink and its hole) pasted whole is one new stroke of two shapes', () => {
		drag(loop(300, 300, 120, 25));
		expect(strokeShapes(letter(), 1)).toHaveLength(2);
		copy(letter().shapes);
		clipboardPaste();
		expect(ids()).toEqual([1, 1, 2, 2]);
		expect(strokeShapes(letter(), 2)).toEqual(letter().shapes.slice(2));
	});

	it('only the hole of an o pasted: an ordinary shape, not part of any stroke', () => {
		drag(loop(300, 300, 120, 25));
		const [, hole] = letter().shapes;
		copy([hole]);
		clipboardPaste();
		expect(letter().shapes).toHaveLength(3);
		expect(isBrushStroke(letter().shapes[2])).toBe(false);
		expect(letter().shapes[2].save().anyink).toBeUndefined();
		expect(recordIds()).toEqual([1]);
		expect(strokeShapes(letter(), 1)).toHaveLength(2);
	});

	it('into another letter: a stroke there, with the first letter’s center line', () => {
		drag(line([100, 100], [400, 100]));
		const fromB = strokeSkeleton(letter(), 1);
		copy(letter().shapes);
		showItem(editor, R);
		drag(line([100, 500], [100, 100])); // r's own stroke 1
		clipboardPaste();
		const r = editor.project.getItem(R);
		expect(ids(r)).toEqual([1, 2]);
		expect(recordIds(r)).toEqual([1, 2]);
		expect(strokeSkeleton(r, 2)).toEqual(fromB);
		expect(strokeShapes(r, 1)).toEqual([r.shapes[0]]);
		expect(drag(line([300, 500], [300, 100])).strokeId).toBe(3);
	});

	it('into a letter with no strokes yet: the next stroke never takes the pasted id', () => {
		drag(line([100, 100], [400, 100]));
		copy(letter().shapes);
		showItem(editor, R);
		clipboardPaste();
		const next = drag(line([100, 500], [100, 100]));
		const r = editor.project.getItem(R);
		expect(new Set(ids(r)).size).toBe(2);
		expect(ids(r)).toContain(next.strokeId);
		expect(strokeShapes(r, next.strokeId)).toHaveLength(1);
	});
});

describe('ids and names', () => {
	it('a new id is one more than any id on the letter’s shapes, even one with no record', () => {
		const shape = letter().addOneShape(new Path({ name: 'x' }));
		tagStroke(shape, 5);
		expect(nextStrokeId(letter())).toBe(6);
		expect(drag(line([100, 100], [400, 100])).strokeId).toBe(6);
	});

	it('a shape renamed "Brush stroke 1" while stroke 1 has its shape stays ordinary', () => {
		drag(line([100, 100], [400, 100]));
		const plain = letter().addOneShape(new Path({ name: 'Brush stroke 1' }));
		reconcileStrokes(letter());
		editor.publish('currentItem', letter());
		expect(isBrushStroke(plain)).toBe(false);
		drag(line([100, 400], [400, 400]));
		expect(isBrushStroke(plain)).toBe(false);
		expect(strokeShapes(letter(), 1)).toHaveLength(1);
	});
});
