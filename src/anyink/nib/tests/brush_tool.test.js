// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 (UX-BEGINNER.md 4.3 Tools, 7.1 #5, 7.2, 7.3, 10 B8; D-014): the Brush on a letter, driven
	through its pointer handlers as Chrome would call them (jsdom has no PointerEvent).
	  - one drag is one stroke: its own shape(s), tagged with the stroke's id, the skeleton kept in
	    glyph.anyink.nib.strokes, and one Undo step "drew a stroke on Capital B"
	  - Undo takes away the last stroke only; Redo brings it back, still a brush stroke
	  - every point, handle and width is a whole number
	  - strokes stay separate from traced shapes (never merged, never made holes)
	  - only a primary press with the Brush picked draws; a cancelled press leaves nothing
	  - every sample Chrome coalesced between frames is used
	All tools draws the same way (the Brush is in both modes once 'brush' is on, 7.6).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { traceInto, B, R, twoLetterEditor } from '../../history/tests/two_letters.js';
import { isBrushStroke } from '../../letter/auto_hole.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { signedArea } from '../geometry.js';
import { brushSize, resetBrushForTests } from '../brush_size.js';
import { flattenContour } from '../match.js';
import { makeNibTool } from '../nib_tool.js';
import {
	retagStrokes,
	strokeIdOf,
	strokeRecords,
	strokeShapes,
	strokeSkeleton,
} from '../stroke_record.js';
import { Glyph } from '../../../project_data/glyph.js';
import { arc, line, loop } from './strokes.js';

const VIEW = Object.freeze({ dx: 100, dy: 900, dz: 1 });
let editor;
let canvas;
let tool;
let warn;

/** Font units to the pointer's place on the page, through the view as it is now */
const client = (x, y) => ({
	x: editor.view.dx + x * editor.view.dz,
	y: editor.view.dy - y * editor.view.dz,
});

let clock = 1000;
function event(type, [x, y], extra = {}) {
	const { x: clientX, y: clientY } = client(x, y);
	clock += 8;
	return {
		type,
		pointerId: 1,
		pointerType: 'mouse',
		isPrimary: true,
		button: type === 'pointermove' ? -1 : 0,
		buttons: type === 'pointerup' ? 0 : 1,
		clientX,
		clientY,
		timeStamp: clock,
		target: canvas,
		currentTarget: canvas,
		preventDefault: vi.fn(),
		...extra,
	};
}

/** One drag along a path (font units) */
function drag(path, extra = {}) {
	tool.down(event('pointerdown', path[0], extra));
	path.slice(1).forEach((point) => tool.move(event('pointermove', point, extra)));
	return tool.up(event('pointerup', path.at(-1), extra));
}

const letter = () => editor.selectedItem;
const steps = () => editor.history.queue.length;
const allPoints = (item) =>
	item.shapes.flatMap((shape) =>
		shape.pathPoints.flatMap((point) => [point.p, point.h1, point.h2].map((c) => [c.x, c.y]))
	);
/** A shape's outline measured from its first point (spacing may slide a letter sideways) */
const relative = (shape) => {
	const [first] = shape.pathPoints;
	return shape.pathPoints.map((point) => [point.p.x - first.p.x, point.p.y - first.p.y]);
};
const outlineOf = (shape) =>
	flattenContour(
		shape.pathPoints.map((point, i) => {
			const next = shape.pathPoints[(i + 1) % shape.pathPoints.length];
			return [
				[point.p.x, point.p.y],
				[point.h2.x, point.h2.y],
				[next.h1.x, next.h1.y],
				[next.p.x, next.p.y],
			];
		}),
		0.5
	);

function setUp(mode = 'simple') {
	setModeForTests(mode);
	setFeaturesForTests({ brush: true });
	editor = twoLetterEditor();
	showItem(editor, B);
	editor.view = { ...VIEW };
	editor.editCanvas = { redraw: () => {} };
	editor.selectedTool = 'nib';
	canvas = document.createElement('canvas');
	document.body.appendChild(canvas);
	tool = makeNibTool(canvas, { getEditor: () => editor });
}

beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '';
	resetToastsForTests();
	resetBrushForTests();
	clock = 1000;
});
afterEach(() => {
	resetToastsForTests();
	warn.mockRestore();
	document.body.innerHTML = '';
});

describe.each(['simple', 'all'])('the Brush in %s', (mode) => {
	beforeEach(() => setUp(mode));

	it('one drag is one stroke: tagged shapes, the skeleton kept, one Undo step', () => {
		const before = steps();
		const result = drag([...line([100, 0], [100, 450]), ...arc(200, 450, 100, 180, 0).slice(1)]);
		expect(result?.strokeId).toBe(1);
		expect(steps()).toBe(before + 1);
		expect(editor.history.queue[0].title).toBe('drew a stroke on Capital B');
		const shapes = letter().shapes;
		expect(shapes.length).toBeGreaterThanOrEqual(1);
		shapes.forEach((shape) => {
			expect(isBrushStroke(shape)).toBe(true);
			expect(strokeIdOf(shape)).toBe(1);
		});
		const [record] = strokeRecords(letter());
		expect(record).toMatchObject({ id: 1, nib: 'round', size: brushSize(editor.project) });
		expect(record.skeleton.length).toBeGreaterThan(0);
		// the Undo step holds the stroke and its record
		const saved = editor.history.queue[0].itemState;
		expect(saved.anyink.nib.strokes).toHaveLength(1);
		expect(saved.shapes.length).toBe(shapes.length);
	});

	it('the default nib is 9 % of the small-letter height, whole units', () => {
		expect(brushSize(editor.project)).toBe(45); // small-letter line at 500
		drag(line([100, 100], [400, 100]));
		const ys = outlineOf(letter().shapes[0]).map(([, y]) => y);
		expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(45, -0.5);
	});

	it('two strokes are two steps; Undo takes away only the last, Redo brings it back', () => {
		const before = steps();
		drag(line([100, 0], [100, 500]));
		const firstOutline = relative(letter().shapes[0]);
		drag(line([300, 0], [300, 500]));
		expect(steps()).toBe(before + 2);
		expect(strokeShapes(letter(), 1)).toHaveLength(1);
		expect(strokeShapes(letter(), 2)).toHaveLength(1);

		editor.history.restoreState();
		expect(letter().shapes).toHaveLength(1);
		expect(strokeRecords(letter()).map((record) => record.id)).toEqual([1]);
		expect(relative(letter().shapes[0])).toEqual(firstOutline);
		// a letter written back from the Undo list is still brush ink
		expect(isBrushStroke(letter().shapes[0])).toBe(true);

		editor.history.redoState();
		expect(letter().shapes).toHaveLength(2);
		letter().shapes.forEach((shape) => expect(isBrushStroke(shape)).toBe(true));
		expect(strokeRecords(letter()).map((record) => record.id)).toEqual([1, 2]);
		// written back from the Undo list (upstream's points re-line smooth handles as they load):
		// still whole numbers
		allPoints(letter()).forEach(([x, y]) => {
			expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
		});
	});

	it('every point, handle and width it writes is a whole number', () => {
		drag(loop(300, 300, 160, 25).map(([x, y]) => [x + 0.37, y - 0.61]));
		expect(letter().shapes.length).toBe(2); // an o: its ink and its hole
		allPoints(letter()).forEach(([x, y]) => {
			expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
		});
		strokeRecords(letter())[0]
			.skeleton.flat()
			.forEach(([x, y]) => {
				expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
			});
		if (mode === 'simple') expect(Number.isInteger(letter().advanceWidth)).toBe(true);
	});

	it('a closed loop keeps its hole: the inner outline runs the other way', () => {
		drag(loop(300, 300, 160, 25));
		const areas = letter().shapes.map((shape) => signedArea(outlineOf(shape)));
		expect(areas.filter((area) => area > 0)).toHaveLength(1);
		expect(areas.filter((area) => area < 0)).toHaveLength(1);
	});

	it('strokes stay separate from traced shapes: never merged into them, never made holes', () => {
		traceInto(editor, 100); // a 400-unit square, one step
		const traced = letter().shapes[0];
		const tracedOutline = relative(traced);
		// a loop drawn right on the traced ink
		drag(loop(300, 200, 100, 25));
		const shapes = letter().shapes;
		expect(shapes).toHaveLength(3);
		expect(isBrushStroke(shapes[0])).toBe(false);
		expect(relative(shapes[0])).toEqual(tracedOutline);
		const stroke = strokeShapes(letter(), 1);
		expect(stroke).toHaveLength(2);
		// its ink still runs counterclockwise: on ink, it is ink, not a hole
		const areas = stroke.map((shape) => signedArea(outlineOf(shape)));
		expect(areas.some((area) => area > 0)).toBe(true);
		expect(areas.find((area) => area > 0)).toBeGreaterThan(
			Math.abs(areas.find((area) => area < 0))
		);
	});

	it('the skeleton follows its stroke when spacing slides the letter', () => {
		drag(line([150, 0], [150, 500]));
		const shape = strokeShapes(letter(), 1)[0];
		const xMin = Math.round(shape.maxes.xMin);
		const skeleton = strokeSkeleton(letter(), 1);
		const center = skeleton[0][0][0];
		// the nib's half width from the center to the ink's left edge, wherever it now sits
		expect(Math.abs(center - 22.5 - xMin)).toBeLessThanOrEqual(1);
	});
});

describe('what draws and what does not', () => {
	beforeEach(() => setUp('simple'));

	it('a click makes a round dot the size of the nib', () => {
		const at = [200, 300];
		tool.down(event('pointerdown', at));
		tool.up(event('pointerup', at));
		expect(letter().shapes).toHaveLength(1);
		const points = outlineOf(letter().shapes[0]);
		const xs = points.map(([x]) => x);
		const ys = points.map(([, y]) => y);
		expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(45, -0.5);
		expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(45, -0.5);
	});

	it('only the Brush draws', () => {
		editor.selectedTool = 'resize';
		const before = steps();
		expect(tool.down(event('pointerdown', [100, 100]))).toBe(false);
		tool.move(event('pointermove', [300, 300]));
		tool.up(event('pointerup', [300, 300]));
		expect(letter().shapes).toHaveLength(0);
		expect(steps()).toBe(before);
	});

	it('the press stops the mouse events (D-014): preventDefault on the pointer down', () => {
		const down = event('pointerdown', [100, 100]);
		tool.down(down);
		expect(down.preventDefault).toHaveBeenCalled();
		tool.up(event('pointerup', [100, 100]));
	});

	it.each([
		['the middle button (it pans)', { button: 1, buttons: 4 }],
		['the right button', { button: 2, buttons: 2 }],
		['a pen eraser', { button: 5, buttons: 32, pointerType: 'pen' }],
		['a second finger', { isPrimary: false, pointerType: 'touch' }],
	])('%s draws nothing and is left to the page', (_, extra) => {
		const down = event('pointerdown', [100, 100], extra);
		expect(tool.down(down)).toBe(false);
		expect(down.preventDefault).not.toHaveBeenCalled();
		expect(letter().shapes).toHaveLength(0);
	});

	it('Space held (panning) draws nothing', () => {
		editor.selectedTool = 'pan';
		expect(tool.down(event('pointerdown', [100, 100]))).toBe(false);
	});

	it('a cancelled press leaves nothing and no step', () => {
		const before = steps();
		tool.down(event('pointerdown', [100, 100]));
		tool.move(event('pointermove', [200, 200]));
		tool.cancel(event('pointercancel', [200, 200]));
		expect(tool.active()).toBe(false);
		tool.up(event('pointerup', [200, 200]));
		expect(letter().shapes).toHaveLength(0);
		expect(steps()).toBe(before);
	});

	it('another letter opened mid-press: the stroke goes nowhere', () => {
		tool.down(event('pointerdown', [100, 100]));
		tool.move(event('pointermove', [200, 200]));
		showItem(editor, R);
		tool.up(event('pointerup', [200, 200]));
		expect(editor.project.getItem(B).shapes).toHaveLength(0);
		expect(editor.project.getItem(R).shapes).toHaveLength(0);
	});

	it('a letter saved and opened again finds its strokes and their skeletons', () => {
		drag(line([100, 0], [100, 500]));
		drag(loop(300, 300, 120, 25));
		const saved = letter().save();
		// B8 + B9 integration: Path keeps its anyink data through save() and the constructor, so
		// the tags come back with the shapes and nothing needs putting back
		const copy = new Glyph(structuredClone(saved));
		expect(copy.shapes.filter((shape) => isBrushStroke(shape))).toHaveLength(3);
		expect(retagStrokes(copy)).toBe(0);
		expect(strokeShapes(copy, 1)).toHaveLength(1);
		expect(strokeShapes(copy, 2)).toHaveLength(2);
		expect(strokeSkeleton(copy, 2)).toEqual(strokeSkeleton(letter(), 2));
		// a work file written before that kept no tags: they are put back by the strokes' names
		const old = structuredClone(saved);
		old.shapes.forEach((shape) => delete shape.anyink);
		const reopened = new Glyph(old);
		expect(reopened.shapes.some((shape) => isBrushStroke(shape))).toBe(false);
		expect(retagStrokes(reopened)).toBe(3);
		expect(strokeShapes(reopened, 2)).toHaveLength(2);
	});

	it('every sample Chrome coalesced between two frames is used', () => {
		const detour = [
			[100, 100],
			[150, 300],
			[200, 500],
			[250, 300],
		];
		tool.down(event('pointerdown', [100, 100]));
		const last = event('pointermove', [300, 100]);
		last.getCoalescedEvents = () =>
			[...detour.slice(1), [300, 100]].map((p) => event('pointermove', p));
		tool.move(last);
		tool.up(event('pointerup', [300, 100]));
		const ys = letter().shapes.flatMap((shape) => outlineOf(shape).map(([, y]) => y));
		// the top of the detour is in the ink (it never was an event of its own)
		expect(Math.max(...ys)).toBeGreaterThan(450);
	});
});
