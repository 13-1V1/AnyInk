// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 finalize (second hostile pass on the stroke ids, the real clipboard in All tools):
	  - an o copied whole, then its hole deleted (filling it in), then pasted: the copy's hole
	    went to the original stroke and the copy's ink became an ordinary shape (ids [1, null, 1]);
	    with the ink deleted instead, [1, 1, null]
	  - the paste's Undo step held the ids from before they were sorted out, so every Undo or Redo
	    across it gave the pasted stroke a new key, and a copy taken earlier then pasted as an
	    ordinary shape
	Written to fail on the brush and history code before the pass.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { clipboardCopy, clipboardPaste } from '../../../project_editor/actions.js';
import { resetBrushForTests } from '../brush_size.js';
import { makeNibTool } from '../nib_tool.js';
import { strokeIdOf, strokeKeyOf, strokeRecords, strokeShapes } from '../stroke_record.js';
import { loop } from './strokes.js';

let editor;
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
function copy(shapes) {
	editor.multiSelect.shapes.clear();
	shapes.forEach((shape) => editor.multiSelect.shapes.add(shape));
	clipboardCopy();
}
/** Deletes one shape of the open letter, as the Delete key does (one item step). */
function remove(shape) {
	letter().shapes.splice(letter().shapes.indexOf(shape), 1);
	editor.publish('currentItem', letter());
	editor.history.addState('Deleted shape');
}

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
	const canvas = document.createElement('canvas');
	document.body.appendChild(canvas);
	tool = makeNibTool(canvas, { getEditor: () => editor });
});
afterEach(() => {
	vi.restoreAllMocks();
	resetToastsForTests();
	document.body.innerHTML = '';
});

describe("a copy pasted after the original lost a part stays the copy's own stroke", () => {
	it('the hole deleted (the o filled in), then a whole o pasted: [1, 2, 2]', () => {
		drag(loop(300, 300, 120, 25));
		const [ink, hole] = letter().shapes;
		copy([ink, hole]);
		remove(hole);
		clipboardPaste();
		expect(ids()).toEqual([1, 2, 2]);
		expect(strokeShapes(letter(), 1)).toEqual([ink]);
		expect(strokeShapes(letter(), 2)).toEqual(letter().shapes.slice(1));
	});

	it('the ink deleted, the hole kept, then a whole o pasted: [1, 2, 2]', () => {
		drag(loop(300, 300, 120, 25));
		const [ink, hole] = letter().shapes;
		copy([ink, hole]);
		remove(ink);
		clipboardPaste();
		expect(ids()).toEqual([1, 2, 2]);
		expect(strokeShapes(letter(), 1)).toEqual([hole]);
		expect(strokeShapes(letter(), 2)).toHaveLength(2);
	});
});

describe('the paste step holds the sorted-out ids, so Undo and Redo keep the keys', () => {
	it('the newest Undo step already has the copy as stroke 2', () => {
		drag(loop(300, 300, 120, 25));
		copy(letter().shapes);
		clipboardPaste();
		const saved = editor.history.queue[0].itemState;
		expect(saved.shapes.map(strokeIdOf)).toEqual([1, 1, 2, 2]);
		expect(strokeRecords(saved).map((record) => record.id)).toEqual([1, 2]);
		const key = strokeKeyOf(letter().shapes[2]);
		expect(strokeKeyOf(saved.shapes[2])).toBe(key);
	});
});
