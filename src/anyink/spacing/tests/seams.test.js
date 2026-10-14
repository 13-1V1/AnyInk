// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2 + B3 integration: the seams between the mode switch, Simple undo, the spacing hook inside
// History, the font check and the older callers that change a letter's spacing.
//   - Simple: a letter made from the letter that changed (a component) is refit in the same
//     Undo step, and one press puts both back.
//   - All tools: a letter whose ink comes only from another letter is measured with that
//     letter's ink, so a step that didn't move it never marks it "set by you".
//   - [Fix it] (B1) fits an automatic letter instead of guessing a width, and it stays automatic.
//   - A dropped or pasted SVG is placed before its step is recorded, so the step holds what the
//     letter ends as and the Simple refit is not undone by the placing.
//   - The font check has nothing to say about a refit letter.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importSVGtoCurrentItem } from '../../../edit_canvas/events_drag_drop_paste.js';
import { insertComponentInstance } from '../../../project_editor/cross_item_actions.js';
import { Path } from '../../../project_data/path.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { applyAutoTrace } from '../../autotrace/apply.js';
import { PROBLEM, validateItem } from '../../fontcheck/validate.js';
import {
	B,
	R,
	square,
	traceInto,
	twoLetterEditor,
	twoLetterProject,
} from '../../history/tests/two_letters.js';
import { setModeForTests } from '../../mode/mode.js';
import { fixProblem } from '../../preview/fix_it.js';
import { showItem } from '../../preview/show_item.js';
import { sitsAtFit } from '../auto_space.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	document.title = 'ANY-INK';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

const glyphOf = (editor, id) => editor.project.glyphs[id];
const ownerOf = (item) => item?.anyink?.spacing;
/** G at the two-letter font's grid: 8 % of its 500-unit small-letter height */
const G = 40;

/** Simple: B traced (automatic, fitted), then r made from B (its first ink), fitted too. */
function rMadeFromB() {
	setModeForTests('simple');
	const editor = twoLetterEditor();
	showItem(editor, B);
	expect(traceInto(editor, 100)).toBe(true);
	showItem(editor, R);
	expect(insertComponentInstance(B, R)).toBe(true);
	editor.history.addState('Inserted Capital B into small r');
	const r = glyphOf(editor, R);
	expect(ownerOf(r)).toBe('auto');
	expect(sitsAtFit(r, editor.project)).toBe(true);
	return editor;
}

describe('Simple: letters made from the letter that changed', () => {
	it('are refit in the same Undo step, and one press puts both back', () => {
		const editor = rMadeFromB();
		const rWidth = glyphOf(editor, R).advanceWidth;
		const steps = editor.history.length;
		showItem(editor, B);
		// B gets a much wider shape: B is refit by its own step, r (made from B) is now too narrow
		const added = applyAutoTrace({
			editor,
			item: editor.selectedItem,
			shapes: [square(100, 900)],
			mode: 'add',
		});
		expect(added).toBe(true);
		const b = glyphOf(editor, B);
		const r = glyphOf(editor, R);
		expect(sitsAtFit(b, editor.project)).toBe(true);
		expect(sitsAtFit(r, editor.project)).toBe(true);
		expect(r.advanceWidth).toBeGreaterThan(rWidth);
		// One item step, named for what he did, about B; r is a part of it (step_parts.test.js)
		expect(editor.history.length).toBe(steps + 1);
		const [own, part] = editor.history.queue;
		expect(own.title).toMatch(/^Auto-traced/);
		expect(own.itemID).toBe(B);
		expect(own.wholeProjectSave).toBe(false);
		expect(part.itemID).toBe(R);
		expect(part.step).toBe(own.step);

		const undone = editor.history.restoreState();
		expect(undone.done).toBe(true);
		expect(undone.itemID).toBe(B);
		expect(glyphOf(editor, B).shapes).toHaveLength(1);
		expect(glyphOf(editor, R).advanceWidth).toBe(rWidth);
		expect(sitsAtFit(glyphOf(editor, R), editor.project)).toBe(true);
		expect(editor.history.length).toBe(steps);

		editor.history.redoState();
		expect(glyphOf(editor, B).shapes).toHaveLength(2);
		expect(glyphOf(editor, R).advanceWidth).toBeGreaterThan(rWidth);
		expect(sitsAtFit(glyphOf(editor, R), editor.project)).toBe(true);
	});

	it('a step that leaves the letters made from it where they are stays an item step', () => {
		const editor = rMadeFromB();
		showItem(editor, B);
		const b = editor.selectedItem;
		// Moving B's ink up changes neither its sides nor r's
		b.shapes[0].updateShapePosition(0, 30);
		editor.history.addState('Nudged shape(s) by 0, 30');
		expect(editor.history.queue[0].wholeProjectSave).toBe(false);
		expect(editor.history.queue[0].itemID).toBe(B);
	});
});

describe('All tools: a letter whose ink comes only from another letter', () => {
	it('is not marked "set by you" by steps that did not move its spacing', () => {
		const editor = rMadeFromB();
		setModeForTests('all');
		showItem(editor, R);
		const r = editor.selectedItem;
		r.shapes[0].name = 'Capital B, renamed';
		editor.history.addState('Renamed a shape');
		expect(ownerOf(r)).toBe('auto');
		editor.history.addState('Renamed a shape');
		expect(ownerOf(r)).toBe('auto');
		// ...and still is when the step did move it
		r.shapes[0].updateShapePosition(25, 0);
		editor.history.addState('Nudged shape(s) by 25, 0');
		expect(ownerOf(r)).toBe('manual');
	});

	it('stays automatic when the letter it is made from moved it, and a step on it moves nothing', () => {
		const editor = rMadeFromB();
		setModeForTests('all');
		// B's ink moves right in All tools: r (made from B) moves with it, off its fit
		showItem(editor, B);
		editor.selectedItem.shapes[0].updateShapePosition(60, 0);
		editor.history.addState('Nudged shape(s) by 60, 0');
		const r = glyphOf(editor, R);
		// r's cached outline is read again from the moved B
		r.shapes[0].cache = {};
		r.cache = {};
		expect(sitsAtFit(r, editor.project)).toBe(false);
		// A step on r that changes neither its left space nor its width: its recorded copy is
		// measured with the font's B, so it reads as unmoved and r stays automatic
		showItem(editor, R);
		r.shapes[0].name = 'Capital B, renamed';
		editor.history.addState('Renamed a shape');
		expect(ownerOf(r)).toBe('auto');
	});
});

describe.each(['simple', 'all'])('[Fix it] on an automatic letter (%s)', (mode) => {
	it('fits its spacing instead of guessing a width, and the letter stays automatic', () => {
		// An automatic letter with ink and no width, as a work file can hold one
		const project = twoLetterProject();
		const b = project.glyphs[B];
		b.addOneShape(square(100).save());
		b.anyink = { spacing: 'auto' };
		b.advanceWidth = 0;
		setModeForTests(mode);
		const editor = new ProjectEditor();
		editor.project = project;
		setCurrentProjectEditor(editor);
		editor.nav.page = 'Characters';
		expect(validateItem(b).map((found) => found.problem)).toContain(PROBLEM.inkNoWidth);

		expect(fixProblem(editor, { itemId: B, problem: PROBLEM.inkNoWidth })).toBe(true);
		const fixed = glyphOf(editor, B);
		expect(ownerOf(fixed)).toBe('auto');
		expect(fixed.leftSideBearing).toBe(G);
		expect(sitsAtFit(fixed, editor.project)).toBe(true);
		expect(validateItem(fixed)).toEqual([]);
		expect(editor.history.queue[0].title).toBe('gave Capital B a width');
	});
});

describe('a dropped or pasted SVG', () => {
	const SVG =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">' +
		'<path d="M0 0 L300 0 L300 300 L0 300 Z"/></svg>';

	it('Simple: the first ink is fitted, and the placing after it does not undo the fit', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		importSVGtoCurrentItem(SVG);
		const b = glyphOf(editor, B);
		expect(b.shapes).toHaveLength(1);
		expect(ownerOf(b)).toBe('auto');
		expect(sitsAtFit(b, editor.project)).toBe(true);
		expect(b.leftSideBearing).toBe(G);
		expect(editor.history.queue).toHaveLength(1);
		expect(editor.history.queue[0].itemState.advanceWidth).toBe(b.advanceWidth);
	});

	it('All tools: the step holds the letter as placed, so Redo gives back exactly that', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		importSVGtoCurrentItem(SVG);
		const b = glyphOf(editor, B);
		const placed = JSON.stringify(b.save());
		expect(b.leftSideBearing).toBe(50);
		expect(ownerOf(b)).toBeUndefined();
		editor.history.restoreState();
		expect(glyphOf(editor, B).shapes).toHaveLength(0);
		editor.history.redoState();
		expect(JSON.stringify(glyphOf(editor, B).save())).toBe(placed);
	});
});

describe('the font check after a refit (B1 x B3)', () => {
	it('has nothing to say about a letter traced in Simple', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		// A fractional trace: the refit rounds every point and gives a whole width
		const shape = new Path({
			pathPoints: [
				{ p: { coord: { x: 100.4, y: 0.3 } } },
				{ p: { coord: { x: 480.6, y: 0 } } },
				{ p: { coord: { x: 480.2, y: 690.7 } } },
				{ p: { coord: { x: 99.9, y: 700.2 } } },
			],
		});
		expect(
			applyAutoTrace({ editor, item: editor.selectedItem, shapes: [shape], mode: 'replace' })
		).toBe(true);
		const b = glyphOf(editor, B);
		expect(validateItem(b)).toEqual([]);
		expect(Number.isInteger(b.advanceWidth) && b.advanceWidth > 0).toBe(true);
		const coords = b.shapes[0].pathPoints.flatMap((point) => [point.p.x, point.p.y]);
		expect(coords.every(Number.isInteger)).toBe(true);
	});
});
