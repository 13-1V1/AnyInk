// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 (walkthrough p2, p8): the font check line said what was wrong but not what to do, and Show me
// led to an unlabeled icon. [Fix it] fixes what can be fixed safely, as one Undo step on the letter
// it names: a width (ink with no width, or a width the font file can't hold) and stray shapes
// (fewer than 3 points and no curve: no ink, and the font file can't hold them).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentProjectEditor, setCurrentProjectEditor } from '../../../app/main.js';
import { Glyph } from '../../../project_data/glyph.js';
import { removeStopCreatingNewPathButton } from '../../../edit_canvas/tools/new_path.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { PROBLEM, validateItem } from '../../fontcheck/validate.js';
import { FIX_IT, canFix, canFixProblem, fittedWidth, fixProblem } from '../fix_it.js';

const at = (x, y) => ({ p: { coord: { x, y } } });
const box = (x1, x2, y1 = 0, y2 = 500) => ({
	pathPoints: [at(x1, y1), at(x2, y1), at(x2, y2), at(x1, y2)],
});
const line = (x1, x2) => ({ pathPoints: [at(x1, 0), at(x2, 300)] });

let previous;
let editor;

/** A real editor on the sample, open on small b, which has `shapes` and width 0. */
function openLetter(id, shapes, width = 0) {
	editor.nav.page = 'Characters';
	editor.selectedItemID = id;
	const item = editor.selectedItem;
	shapes.forEach((shape) => item.addOneShape(shape));
	item.advanceWidth = width;
	editor.history.addState(`setup ${id}`);
	return item;
}

beforeEach(() => {
	previous = getCurrentProjectEditor();
	editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(simpleExampleProject);
	editor.navigate = vi.fn();
});

afterEach(() => {
	setCurrentProjectEditor(previous);
});

const problemsOf = (item) => validateItem(item).map((p) => p.problem);

describe('canFix', () => {
	it('fixes widths and stray shapes, nothing else', () => {
		expect(FIX_IT).toBe('Fix it');
		expect(canFix(PROBLEM.inkNoWidth)).toBe(true);
		expect(canFix(PROBLEM.width)).toBe(true);
		expect(canFix(PROBLEM.shape)).toBe(true);
		expect(canFix(PROBLEM.point)).toBe(false);
		expect(canFix(PROBLEM.kern)).toBe(false);
		expect(canFix(undefined)).toBe(false);
	});

	it('fixes a space with no width too (B1 fix pass)', () => {
		expect(canFix(PROBLEM.spaceNoWidth)).toBe(true);
	});
});

describe('canFixProblem: only when Fix it would really change something (B1 fix pass)', () => {
	it('stray shapes in the letter itself: yes', () => {
		openLetter('glyph-0x62', [box(100, 400), line(500, 600)], 500);
		expect(canFixProblem(editor.project, { itemId: 'glyph-0x62', problem: PROBLEM.shape })).toBe(true);
	});

	it('stray shapes inside a letter this one is made from: no (Fix it would do nothing)', () => {
		// small l holds a 2-point stray line; small b is made from small l
		openLetter('glyph-0x6C', [box(100, 200), line(500, 600)], 300);
		const b = openLetter('glyph-0x62', [], 500);
		b.addOneShape({ objType: 'ComponentInstance', link: 'glyph-0x6C' });
		expect(b.shapes[0].objType).toBe('ComponentInstance');
		expect(problemsOf(b)).toEqual([PROBLEM.shape]);
		expect(canFixProblem(editor.project, { itemId: 'glyph-0x62', problem: PROBLEM.shape })).toBe(false);
		expect(canFixProblem(editor.project, { itemId: 'glyph-0x6C', problem: PROBLEM.shape })).toBe(true);
	});

	it('the other kinds follow canFix; a gap or a missing letter never', () => {
		openLetter('glyph-0x62', [box(100, 400)]);
		expect(canFixProblem(editor.project, { itemId: 'glyph-0x62', problem: PROBLEM.inkNoWidth })).toBe(true);
		expect(canFixProblem(editor.project, { itemId: 'glyph-0x62', problem: PROBLEM.point })).toBe(false);
		expect(canFixProblem(editor.project, { itemId: 'kern-0', problem: PROBLEM.kern })).toBe(false);
		expect(canFixProblem(editor.project, null)).toBe(false);
		expect(canFixProblem(null, { itemId: 'glyph-0x62', problem: PROBLEM.inkNoWidth })).toBe(false);
	});
});

describe('fittedWidth', () => {
	const glyph = (shapes) => new Glyph({ shapes });

	it('gives the right side the same space as the left, in whole units', () => {
		expect(fittedWidth(glyph([box(100, 400.4)]))).toBe(500);
	});

	it('ends at the ink when the ink starts at or left of the left edge', () => {
		expect(fittedWidth(glyph([box(0, 300.6)]))).toBe(301);
		expect(fittedWidth(glyph([box(-50, 300)]))).toBe(300);
	});

	it('is never 0 for ink, even ink left of the left edge', () => {
		expect(fittedWidth(glyph([box(-400, -100)]))).toBe(300);
	});

	it('uses the default width for a letter with no ink', () => {
		expect(fittedWidth(glyph([]), 512.6)).toBe(513);
		expect(fittedWidth(glyph([]))).toBe(0);
	});

	it('measures the ink only, not stray shapes', () => {
		expect(fittedWidth(glyph([box(100, 400), line(500, 800)]))).toBe(500);
		expect(fittedWidth(glyph([line(500, 800)]), 512)).toBe(512);
	});

	it('stays inside what the font file can hold', () => {
		expect(fittedWidth(glyph([box(100, 70000)]))).toBe(65535);
	});
});

describe('fixProblem', () => {
	it('gives the open letter a width, as one Undo step, and the check passes', () => {
		const b = openLetter('glyph-0x62', [box(100, 400.4)]);
		expect(problemsOf(b)).toEqual([PROBLEM.inkNoWidth]);
		const steps = editor.history.queue.length;
		const published = [];
		editor.subscribe({
			topic: 'currentItem',
			subscriberID: 'anyink.previewTest.fixed',
			callback: (item) => published.push(item),
		});

		expect(fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.inkNoWidth })).toBe(true);
		expect(b.advanceWidth).toBe(500);
		expect(problemsOf(b)).toEqual([]);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('gave small b a width');
		expect(editor.history.queue[0].itemID).toBe('glyph-0x62');
		expect(editor.navigate).not.toHaveBeenCalled();
		expect(published).toContain(b);
	});

	it('Undo takes the width back off and leaves the ink', () => {
		const b = openLetter('glyph-0x62', [box(100, 400.4)]);
		fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.inkNoWidth });
		editor.history.restoreState();
		const restored = editor.project.getItem('glyph-0x62');
		expect(restored.advanceWidth).toBe(0);
		expect(restored.shapes.length).toBe(1);
		expect(b.shapes.length).toBe(1);
	});

	it('opens a letter that is not open, then fixes it there', () => {
		openLetter('glyph-0x62', [box(100, 400)]);
		editor.selectedItemID = 'glyph-0x41';
		expect(fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.inkNoWidth })).toBe(true);
		expect(editor.navigate).toHaveBeenCalledTimes(1);
		expect(editor.selectedItemID).toBe('glyph-0x62');
		expect(editor.project.getItem('glyph-0x62').advanceWidth).toBe(500);
		expect(editor.history.queue[0].itemID).toBe('glyph-0x62');
	});

	it('Undo after a Fix it that opened the letter takes the width back off', () => {
		openLetter('glyph-0x62', [box(100, 400)]);
		openLetter('glyph-0x63', [box(100, 400)]);
		editor.selectedItemID = 'glyph-0x41';
		fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.inkNoWidth });
		expect(editor.project.getItem('glyph-0x62').advanceWidth).toBe(500);

		editor.history.restoreState();
		expect(editor.selectedItemID).toBe('glyph-0x62');
		expect(editor.project.getItem('glyph-0x62').advanceWidth).toBe(0);
		expect(editor.project.getItem('glyph-0x62').shapes.length).toBe(1);
	});

	it('opening the letter changes nothing; the fix is the one change, and Undo takes it back', () => {
		// The Characters page's selection handler gives a one-shape letter with no width a width
		// of its own (new_path.js removeStopCreatingNewPathButton), with no Undo step. Here it
		// would land on exactly the width Fix it gives, so only the steps can tell.
		editor.project.settings.app.autoRightBearingOnFirstShape = 100;
		openLetter('glyph-0x62', [box(100, 400)]);
		editor.selectedItemID = 'glyph-0x41';
		editor.subscribe({
			topic: 'whichGlyphIsSelected',
			subscriberID: 'editCanvas.selectedGlyph',
			callback: () => removeStopCreatingNewPathButton(),
		});
		const steps = editor.history.queue.length;

		expect(fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.inkNoWidth })).toBe(true);
		expect(editor.project.getItem('glyph-0x62').advanceWidth).toBe(500);
		expect(editor.history.queue.length).toBe(steps + 2); // the move, then the fix
		expect(editor.history.queue[0].title).toBe('gave small b a width');
		expect(editor.history.queue[1].itemState.advanceWidth).toBe(0);

		editor.history.restoreState();
		expect(editor.project.getItem('glyph-0x62').advanceWidth).toBe(0);
	});

	it('brings a width the font file cannot hold back in range', () => {
		const b = openLetter('glyph-0x62', [box(100, 400)], 70000);
		expect(problemsOf(b)).toEqual([PROBLEM.width]);
		fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.width });
		expect(b.advanceWidth).toBe(500);
		expect(editor.history.queue[0].title).toBe('fixed the width of small b');
	});

	it('removes stray shapes and keeps the ink', () => {
		const b = openLetter('glyph-0x62', [box(100, 400), line(500, 600), line(700, 800)], 500);
		expect(problemsOf(b)).toEqual([PROBLEM.shape]);
		fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.shape });
		expect(b.shapes.length).toBe(1);
		expect(b.shapes[0].pathPoints.length).toBe(4);
		expect(b.advanceWidth).toBe(500);
		expect(problemsOf(b)).toEqual([]);
		expect(editor.history.queue[0].title).toBe('removed 2 stray shapes from small b');
	});

	it('names one stray shape in the singular', () => {
		openLetter('glyph-0x62', [box(100, 400), line(500, 600)], 500);
		fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.shape });
		expect(editor.history.queue[0].title).toBe('removed a stray shape from small b');
	});

	it('changes nothing for a problem it cannot fix, or a letter that is gone', () => {
		const b = openLetter('glyph-0x62', [box(100, 400)]);
		const steps = editor.history.queue.length;
		expect(fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.point })).toBe(false);
		expect(fixProblem(editor, { itemId: 'kern-0', problem: PROBLEM.inkNoWidth })).toBe(false);
		expect(fixProblem(null, { itemId: 'glyph-0x62', problem: PROBLEM.inkNoWidth })).toBe(false);
		expect(b.advanceWidth).toBe(0);
		expect(editor.history.queue.length).toBe(steps);
	});

	it('gives the space the default width, as one Undo step (B1 fix pass)', () => {
		editor.nav.page = 'Characters';
		editor.selectedItemID = 'glyph-0x20';
		const space = editor.selectedItem;
		space.advanceWidth = 0;
		editor.history.addState('setup space');
		expect(problemsOf(space)).toEqual([PROBLEM.spaceNoWidth]);
		const steps = editor.history.queue.length;

		expect(fixProblem(editor, { itemId: 'glyph-0x20', problem: PROBLEM.spaceNoWidth })).toBe(true);
		expect(space.advanceWidth).toBe(Math.round(editor.project.defaultAdvanceWidth));
		expect(space.advanceWidth).toBeGreaterThan(0);
		expect(problemsOf(space)).toEqual([]);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('gave the space a width');

		editor.history.restoreState();
		expect(editor.project.getItem('glyph-0x20').advanceWidth).toBe(0);
	});

	it('acts only on a problem that is still there: never on a check up to 2 s old (B1 fix pass)', () => {
		// The line says small b has no width; he types a width of 350 himself, then presses Fix
		// it before the next check. Fix it must not overwrite his 350.
		const b = openLetter('glyph-0x62', [box(100, 400)]);
		b.advanceWidth = 350;
		expect(problemsOf(b)).toEqual([]);
		const steps = editor.history.queue.length;
		expect(fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.inkNoWidth })).toBe(false);
		expect(b.advanceWidth).toBe(350);
		expect(editor.history.queue.length).toBe(steps);
	});

	it('does not open a letter whose problem is already gone', () => {
		openLetter('glyph-0x62', [box(100, 400)], 350);
		editor.selectedItemID = 'glyph-0x41';
		expect(fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.inkNoWidth })).toBe(false);
		expect(editor.selectedItemID).toBe('glyph-0x41');
		expect(editor.navigate).not.toHaveBeenCalled();
	});

	it('adds no Undo step when there is nothing left to fix', () => {
		const b = openLetter('glyph-0x62', [box(100, 400)], 500);
		const steps = editor.history.queue.length;
		expect(fixProblem(editor, { itemId: 'glyph-0x62', problem: PROBLEM.inkNoWidth })).toBe(false);
		expect(b.advanceWidth).toBe(500);
		expect(editor.history.queue.length).toBe(steps);
	});
});
