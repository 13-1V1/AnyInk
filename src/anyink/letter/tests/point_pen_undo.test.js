// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 fix (letter tools): Undo or Redo while a Point pen shape is still open. In Simple every
	point is an Undo step, so Ctrl+Z mid-shape is the natural move, and Simple's undo writes the
	letter back as new objects (history/item_state.js writeItemState). The Point pen used to keep
	the old shape: later clicks went into a shape the letter no longer had (nothing showed, yet
	each made an Undo step that changed nothing), "Finish the shape" stayed green, and the closing
	click finished the hidden shape. Now the pen follows the letter:
	  - Undo of a point: the pen keeps drawing the shape the letter shows (the one at the same
	    place in its list, now a point shorter); the next click adds to it
	  - Undo of the first point (the shape is gone): the shape is over, "Finish the shape" goes,
	    the font check stops waiting, and the next click starts a new shape
	  - Redo: the pen keeps drawing the shape Redo brought back
	All tools keeps upstream's Point pen as it is.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import {
	Tool_NewPath,
	removeStopCreatingNewPathButton,
} from '../../../edit_canvas/tools/new_path.js';
import { Tool_PathEdit } from '../../../edit_canvas/tools/path_edit.js';
import { B, square, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests } from '../../toast/toast.js';

const VIEW = Object.freeze({ dx: 100, dy: 900, dz: 1 });
/** Font units to canvas pixels through the view as it is now: the view pans with each refit, so
 * the drawing stays put on screen (B7) */
const at = (x, y) => {
	const { dx, dy, dz } = editor.view;
	return { x: dx + x * dz, y: dy - y * dz };
};

let editor;
let warn;

function setUp(mode) {
	setModeForTests(mode);
	editor = twoLetterEditor();
	showItem(editor, B);
	editor.view = { ...VIEW };
	editor.editCanvas = { redraw: () => {} };
	editor.eventHandlers.tool_addPath = new Tool_NewPath();
	editor.eventHandlers.tool_pathEdit = new Tool_PathEdit();
	editor.selectedTool = 'newPath';
	eventHandlerData.isShiftDown = false;
	eventHandlerData.undoQueueHasChanged = false;
	eventHandlerData.toolHandoff = false;
}

/** A plain click with the Point pen: press and release, the pointer still */
function click([x, y]) {
	eventHandlerData.mousePosition = at(x, y);
	const pen = editor.eventHandlers.tool_addPath;
	pen.mousedown();
	if (editor.selectedTool === 'newPath') pen.mouseup();
	else editor.eventHandlers.tool_pathEdit.mouseup();
}

const corners = [
	[0, 0],
	[500, 0],
	[500, 600],
	[0, 600],
];
const pen = () => editor.eventHandlers.tool_addPath;
const shapes = () => editor.selectedItem.shapes;
/** A shape's points measured from its first point: automatic spacing slides the whole letter
 * sideways at each step, so where a shape sits changes but its own outline doesn't */
const pointsOf = (shape) => {
	const [first] = shape.pathPoints;
	return shape.pathPoints.map((point) => [point.p.x - first.p.x, point.p.y - first.p.y]);
};
const countOf = (shape) => shape.pathPoints.length;
const finishButton = () => document.querySelector('#done-creating-path-button');
/** The points of the open letter's first shape as each Undo step holds it, newest first */
const stepPoints = () =>
	editor.history.queue
		.filter((entry) => entry.itemID === B)
		.map((entry) => entry.itemState?.shapes?.[0]?.pathPoints?.length ?? 0);

beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '<div><div id="editor-page__edit-canvas"></div></div>';
	resetToastsForTests();
});
afterEach(() => {
	warn.mockRestore();
	resetToastsForTests();
	document.body.innerHTML = '';
	eventHandlerData.toolHandoff = false;
});

describe('Simple: Undo while a Point pen shape is open', () => {
	it('a click after Undo goes into the shape the letter shows, as a step that changes it', () => {
		setUp('simple');
		click(corners[0]);
		click(corners[1]);
		click(corners[2]);
		editor.history.restoreState();
		expect(pointsOf(shapes()[0])).toEqual([corners[0], corners[1]]);
		expect(shapes()).toContain(pen().newPath);

		click(corners[3]);
		expect(shapes()).toHaveLength(1);
		expect(countOf(shapes()[0])).toBe(3);
		expect(pointsOf(shapes()[0]).slice(0, 2)).toEqual([corners[0], corners[1]]);
		expect(shapes()).toContain(pen().newPath);
		// every step holds one more point than the one under it: none of them changes nothing
		expect(stepPoints()).toEqual([3, 2, 1]);
		expect(finishButton()).not.toBeNull();
	});

	it('the closing click after Undo closes the shape the letter shows, and finishes it', () => {
		setUp('simple');
		click(corners[0]);
		click(corners[1]);
		click(corners[2]);
		editor.history.restoreState();
		click(corners[3]);
		const first = shapes()[0].pathPoints[0].p;
		click([first.x, first.y]); // the first point: closes the shape
		expect(shapes()).toHaveLength(1);
		expect(countOf(shapes()[0])).toBe(3);
		expect(pen().newPath).toBe(false);
		expect(finishButton()).toBeNull();
	});

	it('Undo of the only point ends the shape: the button goes, nothing waits, the next click starts a new shape', () => {
		setUp('simple');
		click(corners[0]);
		expect(finishButton()).not.toBeNull();
		editor.history.restoreState();
		expect(shapes()).toHaveLength(0);
		// the font check waits while the pen has a shape open (fontcheck/font_check.js)
		expect(pen().newPath).toBe(false);
		expect(pen().firstPoint).toBe(true);
		expect(finishButton()).toBeNull();

		click(corners[1]);
		expect(shapes()).toHaveLength(1);
		expect(countOf(shapes()[0])).toBe(1);
		expect(shapes()).toContain(pen().newPath);
	});

	it('Redo brings the point back and the pen keeps drawing that shape', () => {
		setUp('simple');
		click(corners[0]);
		click(corners[1]);
		click(corners[2]);
		editor.history.restoreState();
		editor.history.redoState();
		expect(pointsOf(shapes()[0])).toEqual([corners[0], corners[1], corners[2]]);
		expect(shapes()).toContain(pen().newPath);
		click(corners[3]);
		expect(countOf(shapes()[0])).toBe(4);
		expect(stepPoints()).toEqual([4, 3, 2, 1]);
	});

	it('Redo of the first point opens that shape again: the next click adds to it, not a new shape', () => {
		setUp('simple');
		click(corners[0]);
		editor.history.restoreState();
		expect(finishButton()).toBeNull();
		editor.history.redoState();
		expect(shapes()).toHaveLength(1);
		expect(shapes()).toContain(pen().newPath);
		expect(finishButton()).not.toBeNull();
		click(corners[1]);
		expect(shapes()).toHaveLength(1);
		expect(countOf(shapes()[0])).toBe(2);
		expect(stepPoints()).toEqual([2, 1]);
	});

	it('a shape another tool drew where the open one was is never taken for it', () => {
		setUp('simple');
		click(corners[0]);
		editor.history.restoreState(); // the shape is gone; the pen remembers it for Redo
		// a new step at the same place in the list: Redo is gone, and so is the memory
		const square = editor.selectedItem.addOneShape({
			name: 'Rectangle 1',
			pathPoints: corners.map(([x, y]) => ({ p: { coord: { x, y } } })),
		});
		editor.history.addState('Added path: Rectangle 1');
		editor.publish('currentItem', editor.selectedItem);
		expect(pen().newPath).toBe(false);
		expect(shapes()).toEqual([square]);
	});
});

// B6 + B7 finalize (verdicts: "the pen lost its shape in 5 of 12 letters", "Ctrl+Z pressed while
// the mouse is held leaves the pen dead", "Finish on a shape that merges leaves a ghost picked")
describe('Simple: Undo with points placed between whole font units', () => {
	it('spacing rounds the points at the first step with an area; a click after Undo still goes into the shape', () => {
		setUp('simple');
		const fractional = [
			[0.4, 0.3],
			[299.55, 0.2],
			[300.4, 500.6],
			[0.3, 500.4],
		];
		click(fractional[0]);
		click(fractional[1]);
		click(fractional[2]);
		editor.history.restoreState();
		expect(shapes()).toContain(pen().newPath);
		expect(finishButton()).not.toBeNull();
		click(fractional[3]);
		expect(shapes()).toHaveLength(1);
		expect(countOf(shapes()[0])).toBe(3);
		expect(shapes()).toContain(pen().newPath);
	});
});

describe('Simple: Ctrl+Z while the mouse is held on a new point', () => {
	it('the pen keeps the shape the letter shows; the next click places a point; no step that changes nothing', () => {
		setUp('simple');
		click(corners[0]);
		click(corners[1]);
		// press on the third spot and hold
		eventHandlerData.mousePosition = at(...corners[2]);
		pen().mousedown();
		editor.history.restoreState();
		pen().mouseup();
		const titles = editor.history.queue.map((entry) => entry.title);
		expect(titles.some((title) => /undefined/.test(title))).toBe(false);
		click(corners[3]);
		expect(shapes()).toHaveLength(1);
		expect(countOf(shapes()[0])).toBe(2);
		expect(shapes()).toContain(pen().newPath);
		// each step holds one more or one fewer point than the one under it: none changes nothing
		const counts = stepPoints();
		counts.slice(0, -1).forEach((count, i) => expect(count).not.toBe(counts[i + 1]));
	});
});

describe('Simple: "Finish the shape" on a shape that merges into a hole', () => {
	it('every picked shape is in the letter: the merged hole is picked, no ghost', () => {
		setUp('simple');
		const item = editor.selectedItem;
		const outer = item.addOneShape(square(0, 1000));
		outer.pathPoints.forEach((point) => (point.p.y -= 0));
		const hole = item.addOneShape(square(200, 300));
		hole.reverseWinding();
		editor.history.addState('drew an o');
		click([400, 150]);
		click([700, 150]);
		click([700, 400]);
		click([400, 400]);
		removeStopCreatingNewPathButton();
		const picked = editor.multiSelect.shapes.members;
		expect(picked.length).toBeGreaterThan(0);
		picked.forEach((shape) => expect(editor.selectedItem.shapes).toContain(shape));
		expect(editor.multiSelect.points.members.every((point) => editor.selectedItem.shapes.includes(point.parent))).toBe(true);
	});
});

describe('All tools: the Point pen is left as upstream has it', () => {
	it('Undo does not touch the shape the pen holds', () => {
		setUp('all');
		click(corners[0]);
		const held = pen().newPath;
		editor.history.restoreState();
		expect(pen().newPath).toBe(held);
	});
});
