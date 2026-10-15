// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B7 auto-hole in the drawing tools (UX-BEGINNER.md 7.1 #5, section 10 B7 "new_basic_path.js /
// new_path.js call autoHole after a shape is created, in Simple only"): the real Rectangle, Oval
// and Point pen tools, driven the way the canvas drives them (eventHandlerData.mousePosition in
// canvas pixels). A Rectangle or Oval hole is part of its "Added path" step; a Point pen shape is
// judged when it is finished (its first point clicked, or Done), with its own step when it
// changed. All tools draws exactly as today. Also the tools' 'components' page check (B7).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { Tool_NewBasicPath } from '../../../edit_canvas/tools/new_basic_path.js';
import { Glyph } from '../../../project_data/glyph.js';
import { removeStopCreatingNewPathButton, Tool_NewPath } from '../../../edit_canvas/tools/new_path.js';
import { Tool_PathEdit } from '../../../edit_canvas/tools/path_edit.js';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { scanTexts } from '../../words/banned.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { shapeRole } from '../auto_hole.js';
import { windingAt } from './auto_hole_shapes.js';

const VIEW = Object.freeze({ dx: 100, dy: 900, dz: 1 }); // font x 0 at px 100, y 0 at px 900

let editor;
let warn;

/** Font units to the canvas pixels the tools read */
const at = (x, y) => ({ x: VIEW.dx + x * VIEW.dz, y: VIEW.dy - y * VIEW.dz });

function setUp() {
	editor = twoLetterEditor();
	showItem(editor, B);
	editor.view = { ...VIEW };
	editor.editCanvas = { redraw: () => {} };
	editor.eventHandlers.tool_addPath = new Tool_NewPath();
	editor.eventHandlers.tool_pathEdit = new Tool_PathEdit();
	eventHandlerData.isShiftDown = false;
	eventHandlerData.undoQueueHasChanged = false;
}

/** A drag with the Rectangle or Oval tool, from one corner to the other (font units) */
function dragShape(tool, from, to) {
	editor.selectedTool = tool;
	const basic = new Tool_NewBasicPath();
	eventHandlerData.mousePosition = at(...from);
	basic.mousedown();
	eventHandlerData.mousePosition = at((from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
	basic.mousemove();
	eventHandlerData.mousePosition = at(...to);
	basic.mousemove();
	basic.mouseup();
	return editor.selectedItem.shapes.at(-1);
}

/** Point pen clicks; the last click on the first point finishes the shape */
function penClicks(points, { close = true } = {}) {
	editor.selectedTool = 'newPath';
	const pen = editor.eventHandlers.tool_addPath;
	const clicks = close ? [...points, points[0]] : points;
	clicks.forEach((point) => {
		eventHandlerData.mousePosition = at(...point);
		pen.mousedown();
		if (editor.selectedTool !== 'newPath') {
			// the closing click hands the press to Edit points (toolHandoff): its release
			editor.eventHandlers.tool_pathEdit?.mouseup?.();
			return;
		}
		pen.mousemove(); // the pointer shivers on a click: the point is recorded
		pen.mouseup();
	});
	return editor.selectedItem.shapes.at(-1);
}

const titles = () => editor.history.queue.map((entry) => entry.title);

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
	setModeForTests('all');
});

describe('Rectangle and Oval', () => {
	it('Simple: a rectangle drawn inside a rectangle is a hole, in its one "Added path" step', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		dragShape('newRectangle', [0, 0], [600, 700]);
		const steps = titles().length;
		const inner = dragShape('newRectangle', [150, 150], [450, 550]);

		expect(shapeRole(editor.selectedItem, inner)).toBe('hole');
		expect(windingAt(editor.selectedItem, 300, 350)).toBe(0);
		expect(titles().length).toBe(steps + 1);
		expect(titles()[0]).toMatch(/^Added path: Rectangle/);
		expect(toastLog().at(-1)).toMatchObject({ key: 'letterTools.madeHole', text: 'Made shape 2 a hole' });

		// the step holds the hole: Undo takes the whole rectangle away, Redo brings it back a hole
		editor.history.restoreState();
		expect(editor.selectedItem.shapes).toHaveLength(1);
		editor.history.redoState();
		const item = editor.selectedItem;
		expect(item.shapes).toHaveLength(2);
		expect(shapeRole(item, item.shapes[1])).toBe('hole');
	});

	it('Simple: an oval inside a rectangle is a hole; a dot inside that hole stays ink', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		dragShape('newRectangle', [0, 0], [600, 700]);
		const oval = dragShape('newOval', [100, 100], [500, 600]);
		expect(shapeRole(editor.selectedItem, oval)).toBe('hole');
		const dot = dragShape('newRectangle', [250, 300], [350, 400]);
		expect(shapeRole(editor.selectedItem, dot)).toBe('solid');
		expect(windingAt(editor.selectedItem, 300, 350)).not.toBe(0);
		expect(windingAt(editor.selectedItem, 300, 200)).toBe(0);
	});

	it('All tools: the same two rectangles draw exactly as today (both ink, nothing said)', () => {
		dragShape('newRectangle', [0, 0], [600, 700]);
		const inner = dragShape('newRectangle', [150, 150], [450, 550]);
		expect(windingAt(editor.selectedItem, 300, 350)).not.toBe(0);
		expect(inner.pathPoints.map((point) => [point.p.x, point.p.y])).toEqual([
			[150, 550],
			[450, 550],
			[450, 150],
			[150, 150],
		]);
		expect(toastLog().some((entry) => entry.key === 'letterTools.madeHole')).toBe(false);
	});

	it('Simple before the letter view lands: no hole', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: false }); // on in the app since B7
		dragShape('newRectangle', [0, 0], [600, 700]);
		dragShape('newRectangle', [150, 150], [450, 550]);
		expect(windingAt(editor.selectedItem, 300, 350)).not.toBe(0);
	});
});

describe('Point pen', () => {
	const triangle = [
		[200, 200],
		[300, 450],
		[400, 200],
	];

	it('Simple: clicking the first point again finishes the shape, and inside a rectangle it is a hole (its own step)', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		dragShape('newRectangle', [0, 0], [600, 700]);
		const shape = penClicks(triangle);
		expect(shape.pathPoints).toHaveLength(3);
		expect(shapeRole(editor.selectedItem, shape)).toBe('hole');
		expect(windingAt(editor.selectedItem, 300, 260)).toBe(0);
		expect(titles()[0]).toBe('made shape 2 a hole');
		expect(toastLog().at(-1)).toMatchObject({ key: 'letterTools.madeHole' });
		// one press undoes the hole, not the shape
		editor.history.restoreState();
		const item = editor.selectedItem;
		expect(item.shapes).toHaveLength(2);
		expect(shapeRole(item, item.shapes[1])).toBe('solid');
	});

	it('Simple: Done finishes the shape the same way', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		dragShape('newRectangle', [0, 0], [600, 700]);
		penClicks(triangle, { close: false });
		expect(document.querySelector('#done-creating-path-button')).not.toBeNull();
		removeStopCreatingNewPathButton();
		const item = editor.selectedItem;
		expect(shapeRole(item, item.shapes[1])).toBe('hole');
		expect(titles()[0]).toBe('made shape 2 a hole');
	});

	it('the button beside the canvas while a shape is drawn: house words in Simple, upstream’s in All tools', () => {
		penClicks(triangle.slice(0, 1), { close: false });
		let done = document.querySelector('#done-creating-path-button');
		expect([done.textContent, done.title]).toEqual(['Done creating path', 'Done creating path']);
		removeStopCreatingNewPathButton();

		setModeForTests('simple');
		setUp();
		penClicks(triangle.slice(0, 1), { close: false });
		done = document.querySelector('#done-creating-path-button');
		expect(done.textContent).toBe('Finish the shape');
		expect(done.title).toBe('Or click the first point again.');
		expect(scanTexts([done.textContent, done.title])).toEqual([]);
	});

	it('All tools: the Point pen draws exactly as today (no extra step, no hole)', () => {
		dragShape('newRectangle', [0, 0], [600, 700]);
		penClicks(triangle);
		expect(titles()[0]).toMatch(/^New path: added point/);
		expect(windingAt(editor.selectedItem, 300, 260)).not.toBe(0);
	});
});

describe("the tools' page check (UX-BEGINNER.md section 10 B7)", () => {
	it('on the Components page a new rectangle is named after the open part’s own shapes', () => {
		// three parts in the font, so the font-wide count (3) and the part's own (0, 1, 2) differ
		['comp-0', 'comp-1', 'comp-2'].forEach((id) => {
			editor.project.components[id] = new Glyph({
				id,
				name: 'Part',
				objType: 'Component',
				parent: editor.project,
			});
		});
		editor.nav.page = 'Components';
		editor.selectedComponentID = 'comp-0';
		expect(editor.selectedItem?.shapes).toEqual([]);
		const first = dragShape('newRectangle', [0, 0], [100, 100]);
		const second = dragShape('newOval', [0, 0], [100, 100]);
		expect([first.name, second.name]).toEqual(['Rectangle 0', 'Oval 1']);
		const pen = penClicks(
			[
				[0, 0],
				[50, 100],
				[100, 0],
			],
			{ close: false }
		);
		expect(pen.name).toBe('Path 3');
	});
});

scanSimpleScreen(
	'auto-hole: a rectangle drawn inside a rectangle, its toast, [Make it solid], the Point pen button',
	() => {
		setFeaturesForTests({ letterView: true });
		document.body.innerHTML = '<div><div id="editor-page__edit-canvas"></div></div>';
		setUp();
		dragShape('newRectangle', [0, 0], [600, 700]);
		dragShape('newRectangle', [150, 150], [450, 550]);
		document.querySelector('[data-anyink-toast] .anyink-toast__action')?.click();
		penClicks([[100, 100]], { close: false });
		return document.body;
	}
);
