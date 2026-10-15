// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 fix (letter tools): auto-hole by what shows under a new shape, through the real
	Rectangle and Point pen tools in Simple (the letter view on). Each case is one Undo step for
	the Rectangle ("Added path"), or the Point pen's own step when its shape is finished:
	  - the inside of an o drawn first, then the outside: the inside becomes a hole
	  - a hole drawn across a hole: one hole; the tool picks the joined shape; the toast says it
	    was merged (no [Make it solid]: that would fill both)
	  - a hole drawn where two shapes overlap: those two become one, and the toast says so
	  - when joining them would change what shows elsewhere: it stays solid, and the toast says so
	  - the Point pen closing a shape across a hole: the press on the first point bends nothing
	    (the shape it would bend was joined into the hole)
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { Tool_NewBasicPath } from '../../../edit_canvas/tools/new_basic_path.js';
import { Tool_NewPath } from '../../../edit_canvas/tools/new_path.js';
import { Tool_PathEdit } from '../../../edit_canvas/tools/path_edit.js';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { setSpacingOwner } from '../../spacing/owner.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { shapeRole } from '../auto_hole.js';
import { windingAt } from './auto_hole_shapes.js';

let editor;
let warn;

const at = (x, y) => ({ x: 100 + x, y: 900 - y });

function setUp() {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true });
	editor = twoLetterEditor();
	showItem(editor, B);
	// spacing set by him: no refit slides the letter between steps, so a spot stays a spot
	setSpacingOwner(editor.selectedItem, 'manual');
	editor.view = { dx: 100, dy: 900, dz: 1 };
	editor.editCanvas = { redraw: () => {} };
	editor.eventHandlers.tool_addPath = new Tool_NewPath();
	editor.eventHandlers.tool_pathEdit = new Tool_PathEdit();
	eventHandlerData.isShiftDown = false;
	eventHandlerData.undoQueueHasChanged = false;
	eventHandlerData.toolHandoff = false;
}

/** A Rectangle drag, corner to corner (font units) */
function rectangle([x1, y1], [x2, y2]) {
	editor.selectedTool = 'newRectangle';
	const tool = new Tool_NewBasicPath();
	eventHandlerData.mousePosition = at(x1, y1);
	tool.mousedown();
	eventHandlerData.mousePosition = at((x1 + x2) / 2, (y1 + y2) / 2);
	tool.mousemove();
	eventHandlerData.mousePosition = at(x2, y2);
	tool.mousemove();
	tool.mouseup();
}

/** Point pen clicks, then a press on its first point (the release is the test's) */
function penShape(points) {
	editor.selectedTool = 'newPath';
	const pen = editor.eventHandlers.tool_addPath;
	points.forEach(([x, y]) => {
		eventHandlerData.mousePosition = at(x, y);
		pen.mousedown();
		pen.mouseup();
	});
	eventHandlerData.mousePosition = at(...points[0]);
	pen.mousedown();
}

const inkAt = (x, y) => windingAt(editor.selectedItem, x, y) !== 0;
const titles = () => editor.history.queue.map((entry) => entry.title);
const lastToast = () => toastLog().at(-1);
/** The button of the toast showing now (one leaving may still be in the page) */
const toastButton = () =>
	document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving]) .anyink-toast__action');

beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '<div><div id="editor-page__edit-canvas"></div></div>';
	resetToastsForTests();
	setUp();
});
afterEach(() => {
	warn.mockRestore();
	resetToastsForTests();
	document.body.innerHTML = '';
	eventHandlerData.toolHandoff = false;
	setModeForTests('all');
});

describe('Simple: the inside of an o drawn first', () => {
	it('the Rectangle drawn around it makes it a hole, in its one "Added path" step', () => {
		rectangle([300, 300], [700, 700]);
		const steps = titles().length;
		rectangle([0, 0], [1000, 1000]);
		expect(inkAt(500, 500)).toBe(false);
		expect(inkAt(100, 100)).toBe(true);
		expect(titles().length).toBe(steps + 1);
		expect(lastToast()).toMatchObject({ key: 'letterTools.madeHole', text: 'Made shape 1 a hole' });
		// [Make it solid] acts on the inside shape
		toastButton().click();
		expect(shapeRole(editor.selectedItem, editor.selectedItem.shapes[0])).toBe('solid');
		expect(titles()[0]).toBe('made shape 1 solid');
		// Undo, then Undo again: the outside goes, and the inside is solid as it was drawn
		editor.history.restoreState();
		editor.history.restoreState();
		expect(editor.selectedItem.shapes).toHaveLength(1);
		expect(shapeRole(editor.selectedItem, editor.selectedItem.shapes[0])).toBe('solid');
	});

	it('the Point pen drawn around it, the same way round: it is turned, as the pen’s own step', () => {
		rectangle([300, 300], [700, 700]); // clockwise, as the Rectangle draws
		penShape([
			[0, 0],
			[0, 1000],
			[1000, 1000],
			[1000, 0],
		]);
		expect(inkAt(500, 500)).toBe(false);
		expect(titles()[0]).toBe('made shape 1 a hole');
		expect(lastToast()).toMatchObject({ key: 'letterTools.madeHole', text: 'Made shape 1 a hole' });
	});

	it('the Point pen drawn around it the other way round: a hole already, said, no extra step', () => {
		rectangle([300, 300], [700, 700]);
		penShape([
			[0, 0],
			[1000, 0],
			[1000, 1000],
			[0, 1000],
		]);
		expect(inkAt(500, 500)).toBe(false);
		expect(titles()[0]).toMatch(/^New path: added point/);
		expect(lastToast()).toMatchObject({ key: 'letterTools.madeHole', text: 'Made shape 1 a hole' });
	});
});

describe('Simple: a hole drawn across a hole', () => {
	it('joins it: one hole, one step, the joined shape picked, a toast with no button', () => {
		rectangle([0, 0], [1000, 1000]);
		rectangle([200, 200], [600, 600]);
		const steps = titles().length;
		rectangle([400, 400], [800, 800]);
		const item = editor.selectedItem;
		expect(item.shapes).toHaveLength(2);
		[
			[500, 500],
			[300, 300],
			[700, 700],
		].forEach(([x, y]) => expect(inkAt(x, y)).toBe(false));
		expect(inkAt(300, 700)).toBe(true);
		expect(titles().length).toBe(steps + 1);
		expect(editor.multiSelect.shapes.singleton).toBe(item.shapes[1]);
		expect(lastToast()).toMatchObject({
			key: 'letterTools.joinedHole',
			text: 'Made it a hole, merged with shape 2',
		});
		expect(toastButton()).toBeNull();
		// one Undo: the first hole as it was, the second one gone
		editor.history.restoreState();
		expect(editor.selectedItem.shapes).toHaveLength(2);
		expect(inkAt(300, 300)).toBe(false);
		expect(inkAt(700, 700)).toBe(true);
	});

	it('the Point pen closing a shape across a hole: joined, and the closing press bends nothing', () => {
		rectangle([0, 0], [1000, 1000]);
		rectangle([200, 200], [600, 600]);
		penShape([
			[400, 400],
			[800, 400],
			[800, 800],
			[400, 800],
		]);
		const item = editor.selectedItem;
		expect(item.shapes).toHaveLength(2);
		expect(inkAt(700, 700)).toBe(false);
		expect(inkAt(500, 500)).toBe(false);
		expect(titles()[0]).toBe('made shape 2 a hole');
		expect(editor.selectedTool).toBe('pathEdit');
		expect(editor.multiSelect.shapes.singleton).toBe(item.shapes[1]);
		// the pointer moves before the release: no step, nothing bent
		const steps = titles().length;
		const edit = editor.eventHandlers.tool_pathEdit;
		eventHandlerData.mousePosition = at(900, 900);
		expect(() => edit.mousemove()).not.toThrow();
		edit.mouseup();
		expect(titles().length).toBe(steps);
		expect(editor.selectedItem.shapes).toHaveLength(2);
	});
});

describe('Simple: a hole drawn where two shapes overlap', () => {
	it('is a hole; the two shapes around it become one, and the toast says so', () => {
		rectangle([0, 0], [400, 400]);
		rectangle([200, 0], [600, 400]);
		rectangle([250, 150], [350, 250]);
		const item = editor.selectedItem;
		expect(item.shapes).toHaveLength(2);
		expect(inkAt(300, 200)).toBe(false);
		expect(inkAt(100, 200)).toBe(true);
		expect(inkAt(500, 200)).toBe(true);
		expect(lastToast()).toMatchObject({
			key: 'letterTools.madeHoleJoined',
			text: 'Made shape 2 a hole and merged the shapes around it',
		});
		expect(editor.multiSelect.shapes.singleton).toBe(item.shapes[1]);
		toastButton().click();
		expect(inkAt(300, 200)).toBe(true);
	});

	it('stays solid when joining them would change what shows elsewhere, and says so', () => {
		rectangle([0, 0], [400, 400]);
		rectangle([200, 0], [600, 400]);
		rectangle([300, 30], [500, 120]); // a hole in the right one, reaching into the overlap
		rectangle([250, 200], [350, 300]);
		expect(editor.selectedItem.shapes).toHaveLength(4);
		expect(inkAt(300, 250)).toBe(true);
		expect(lastToast()).toMatchObject({
			key: 'letterTools.stayedSolid',
			text: 'Shape 4 stays solid. Merge overlapping shapes, then draw it again to cut a hole.',
		});
		expect(toastButton()).toBeNull();
	});
});

describe('All tools: as today', () => {
	it('the inside drawn first stays solid; a hole across a hole is its own shape', () => {
		setModeForTests('all');
		rectangle([300, 300], [700, 700]);
		rectangle([0, 0], [1000, 1000]);
		expect(inkAt(500, 500)).toBe(true);
		rectangle([100, 100], [200, 200]);
		expect(editor.selectedItem.shapes).toHaveLength(3);
		expect(toastLog().some((entry) => /^letterTools\./.test(entry.key || ''))).toBe(false);
	});
});

scanSimpleScreen('auto-hole: an o drawn inside first, a hole across a hole, a hole on overlapping shapes', () => {
	setUp();
	document.body.innerHTML = '<div><div id="editor-page__edit-canvas"></div></div>';
	rectangle([300, 300], [700, 700]);
	rectangle([0, 0], [1000, 1000]);
	rectangle([100, 100], [400, 200]);
	rectangle([300, 150], [500, 250]);
	return document.body;
});

scanSimpleScreen('auto-hole: a shape that stays solid', () => {
	setUp();
	document.body.innerHTML = '<div><div id="editor-page__edit-canvas"></div></div>';
	rectangle([0, 0], [400, 400]);
	rectangle([200, 0], [600, 400]);
	rectangle([300, 30], [500, 120]);
	rectangle([250, 200], [350, 300]);
	return document.body;
});
