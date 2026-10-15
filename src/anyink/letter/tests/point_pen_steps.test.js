// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 integration (the letter-card and letter-tools tracks' hand-offs): the Point pen driven
	the way a real click drives it, a press and a release with no pointer move between them.
	  - Simple: every point placed is its own Undo step ("added a point"), so the work file is
	    marked changed (the status pill, the leave warning, the backup copy), automatic spacing
	    runs, and Undo takes the shape back a point at a time. Upstream recorded a point only
	    when the pointer moved while it was pressed, so a shape placed by plain clicks left no
	    step at all. All tools keeps upstream's way.
	  - Both modes: closing the shape on its first point with the pointer moving hands the press
	    to Edit points, which bends the closing curve; upstream threw there (path_edit.js read
	    the point it had not been given).
	  - Simple: "Finish the shape" is the screen's green button while a shape is open (so the
	    Next line's button is outlined, principle 1), and closing the shape on its first point
	    finishes it: the button goes. Upstream left it on screen after the shape was closed.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { Tool_NewPath } from '../../../edit_canvas/tools/new_path.js';
import { Tool_PathEdit } from '../../../edit_canvas/tools/path_edit.js';
import { getSaveStatus } from '../../files/save_status.js';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { getDirtyGeneration } from '../../recovery/recovery.js';
import { resetToastsForTests } from '../../toast/toast.js';

const VIEW = Object.freeze({ dx: 100, dy: 900, dz: 1 });
const at = (x, y) => ({ x: VIEW.dx + x * VIEW.dz, y: VIEW.dy - y * VIEW.dz });

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
function click(x, y) {
	eventHandlerData.mousePosition = at(x, y);
	const pen = editor.eventHandlers.tool_addPath;
	pen.mousedown();
	if (editor.selectedTool === 'newPath') pen.mouseup();
	else editor.eventHandlers.tool_pathEdit.mouseup();
}

const pointSteps = () =>
	editor.history.queue.filter((entry) => /^New path: added point/.test(entry.title));
const shapes = () => editor.selectedItem.shapes;

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

describe('Simple: a point placed by a plain click is one Undo step', () => {
	it('three clicks: three steps, the work file marked changed', () => {
		setUp('simple');
		const generation = getDirtyGeneration();
		click(100, 0);
		click(500, 0);
		click(300, 600);
		expect(pointSteps()).toHaveLength(3);
		expect(getDirtyGeneration()).toBeGreaterThan(generation);
		// B6 + B7 finalize (verdict: this check could never fail: getSaveStatus() with no editor
		// has no state): the open font's work file is behind, and a revision was counted per step
		const status = getSaveStatus(editor);
		expect(status.file).not.toBe('saved');
		expect(status.revision).toBeGreaterThanOrEqual(3);
	});

	it('Undo takes the shape back a point at a time, then the shape', () => {
		setUp('simple');
		click(100, 0);
		click(500, 0);
		click(300, 600);
		expect(shapes()[0].pathPoints).toHaveLength(3);
		editor.history.restoreState();
		expect(shapes()[0].pathPoints).toHaveLength(2);
		editor.history.restoreState();
		editor.history.restoreState();
		expect(shapes()).toHaveLength(0);
		// and a click after it starts a new shape, one point, one step
		click(200, 0);
		expect(shapes()).toHaveLength(1);
		expect(shapes()[0].pathPoints).toHaveLength(1);
		expect(pointSteps()).toHaveLength(1);
	});

	it('All tools: plain clicks record no step, as upstream', () => {
		setUp('all');
		click(100, 0);
		click(500, 0);
		expect(pointSteps()).toHaveLength(0);
		expect(shapes()[0].pathPoints).toHaveLength(2);
	});
});

// B6 + B7 integration (found in Chrome): in Simple the points are already steps, so the step a
// closing drag makes only bends the closing curve; upstream named it "Added new path" (in All
// tools it is the step that holds the whole shape), and Undo then said "Undid: added a shape"
// while the shape stayed on screen
describe('the step a closing drag makes', () => {
	const closeMoving = () => {
		click(100, 0);
		click(500, 0);
		click(300, 600);
		eventHandlerData.mousePosition = at(100, 0);
		editor.eventHandlers.tool_addPath.mousedown();
		eventHandlerData.mousePosition = at(130, -20);
		editor.eventHandlers.tool_pathEdit.mousemove();
		editor.eventHandlers.tool_pathEdit.mouseup();
		return editor.history.queue[0].title;
	};

	it('Simple: "bent a curve"', () => {
		setUp('simple');
		expect(closeMoving()).toBe('bent a curve');
	});

	it('All tools: "Added new path", as upstream', () => {
		setUp('all');
		expect(closeMoving()).toBe('Added new path: Path 1');
	});
});

describe('closing the shape with the pointer moving (both modes)', () => {
	it.each(['simple', 'all'])('%s: no error; the closing curve bends', (mode) => {
		setUp(mode);
		click(100, 0);
		click(500, 0);
		click(300, 600);
		eventHandlerData.mousePosition = at(100, 0);
		editor.eventHandlers.tool_addPath.mousedown(); // on the first point: hands off
		expect(editor.selectedTool).toBe('pathEdit');
		const edit = editor.eventHandlers.tool_pathEdit;
		eventHandlerData.mousePosition = at(130, -20);
		expect(() => edit.mousemove()).not.toThrow();
		expect(() => edit.mouseup()).not.toThrow();
		const first = shapes()[0].pathPoints[0];
		expect(first.h2.use).toBe(true);
		expect(first.h2.x).not.toBe(first.p.x);
	});
});

describe('Simple: "Finish the shape" while a shape is open', () => {
	const finish = () => document.querySelector('#done-creating-path-button');

	it('is the green button while drawing, and goes when the shape is closed on its first point', () => {
		setUp('simple');
		click(100, 0);
		expect(finish()).not.toBeNull();
		expect(finish().classList.contains('anyink-primary')).toBe(true);
		click(500, 0);
		click(300, 600);
		click(100, 0); // the first point: closes the shape
		expect(editor.selectedTool).toBe('pathEdit');
		expect(finish()).toBeNull();
	});

	it('All tools: as upstream (no green mark; it stays after a close)', () => {
		setUp('all');
		click(100, 0);
		expect(finish().classList.contains('anyink-primary')).toBe(false);
		click(500, 0);
		click(300, 600);
		click(100, 0);
		expect(finish()).not.toBeNull();
	});
});
