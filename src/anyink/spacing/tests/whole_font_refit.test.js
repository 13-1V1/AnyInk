// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 fix (UX-BEGINNER 7.2, 7.3; D-034 "whole-font actions fit what they change"): in Simple, every
// whole-font step ends with every automatic letter at its fit, inside that one step.
//   - Use it with 'replace' on a letter that holds a part made from another letter (a component)
//     takes the whole-font path; the letter is refit like any item step, and the ink stays still
//     on screen.
//   - A letter given its first ink by a whole-font step starts automatic, as on an item step.
//   - Moving the small-letter line (or the grid size) changes every gap, so in Simple that settings
//     change becomes one whole-font step, about no letter, that refits every automatic letter.
// All tools never refits (it marks moved automatic letters "set by you", history_hook.test.js).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertComponentInstance } from '../../../project_editor/cross_item_actions.js';
import { applyAutoTrace } from '../../autotrace/apply.js';
import { B, R, square, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFontMetric } from '../../metrics/font_metrics.js';
import { METRIC_LABELS } from '../../metrics/metrics_math.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { sitsAtFit } from '../auto_space.js';
import { inkBounds } from '../measure.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	document.title = 'ANY-INK';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	// editor.navigate() without an #app__wrapper only warns; keep test output quiet
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

const VIEW = { dx: 100, dy: 500, dz: 0.5 };
const glyphOf = (editor, id) => editor.project.glyphs[id];
const ownerOf = (item) => item?.anyink?.spacing;
const queueOf = (editor) => editor.history.queue;
const atFit = (editor, id) => sitsAtFit(glyphOf(editor, id), editor.project);

/** Simple: B traced (automatic, fitted), then r made from B (its first ink), fitted too. */
function rMadeFromB(mode = 'simple') {
	setModeForTests('simple');
	const editor = twoLetterEditor();
	showItem(editor, B);
	expect(traceInto(editor, 100)).toBe(true);
	showItem(editor, R);
	expect(insertComponentInstance(B, R)).toBe(true);
	editor.history.addState('r from B');
	expect(atFit(editor, R)).toBe(true);
	setModeForTests(mode);
	return editor;
}

/** Use it on r, replacing what is there: a wide square far to the right. */
function retraceR(editor) {
	const ok = applyAutoTrace({
		editor,
		item: editor.selectedItem,
		shapes: [square(700, 900)],
		mode: 'replace',
	});
	expect(ok).toBe(true);
}

describe('Simple: a whole-font step on the open letter refits it', () => {
	it("Use it with 'replace' on a letter that holds a component is refit in the same step", () => {
		const editor = rMadeFromB();
		const before = { width: glyphOf(editor, R).advanceWidth, steps: editor.history.length };
		editor.view = { ...VIEW };
		retraceR(editor);

		expect(queueOf(editor)[0].wholeProjectSave).toBe(true); // the whole-font path
		expect(editor.history.length).toBe(before.steps + 1);
		const r = glyphOf(editor, R);
		expect(ownerOf(r)).toBe('auto');
		expect(atFit(editor, R)).toBe(true);
		const ink = inkBounds(r);
		expect(ink.xMin).toBeLessThan(700);
		expect(r.advanceWidth).toBeGreaterThan(ink.xMax); // never overlapping the next letter
		// The ink stays where it was drawn on screen: the view moved by what the refit moved
		expect(editor.view.dx).toBeCloseTo(VIEW.dx - (ink.xMin - 700) * VIEW.dz, 6);

		// One press: r is the letter made from B again, as it was
		const undone = editor.history.restoreState();
		expect(undone.done).toBe(true);
		expect(glyphOf(editor, R).shapes[0].objType).toBe('ComponentInstance');
		expect(glyphOf(editor, R).advanceWidth).toBe(before.width);
		// Redo gives back the refit letter
		editor.history.redoState();
		expect(atFit(editor, R)).toBe(true);
		expect(inkBounds(glyphOf(editor, R)).xMin).toBe(ink.xMin);
	});

	it('a letter given its first ink by a whole-font step starts automatic and is fitted', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, R);
		editor.history.addWholeProjectChangePreState('copied shapes into r');
		editor.selectedItem.addOneShape(square(600, 300).save());
		editor.history.addWholeProjectChangePostState();
		const r = glyphOf(editor, R);
		expect(ownerOf(r)).toBe('auto');
		expect(atFit(editor, R)).toBe(true);
		// The after-copy holds the fitted letter, so Redo gives back exactly this
		expect(queueOf(editor)[0].itemState.glyphs[R].advanceWidth).toBe(r.advanceWidth);
	});

	it('a letter set by hand is left exactly as the step made it', () => {
		const editor = rMadeFromB();
		glyphOf(editor, R).anyink.spacing = 'manual';
		retraceR(editor);
		expect(ownerOf(glyphOf(editor, R))).toBe('manual');
		expect(inkBounds(glyphOf(editor, R)).xMin).toBe(700);
	});

	it('All tools: the same step never refits; the moved automatic letter becomes "set by you"', () => {
		const editor = rMadeFromB('all');
		retraceR(editor);
		expect(ownerOf(glyphOf(editor, R))).toBe('manual');
		expect(inkBounds(glyphOf(editor, R)).xMin).toBe(700);
		expect(atFit(editor, R)).toBe(false);
	});
});

describe('Simple: moving the small-letter line refits every automatic letter in one step', () => {
	/** Simple: B and r traced (automatic, fitted). */
	function twoTraced() {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(traceInto(editor)).toBe(true);
		showItem(editor, R);
		expect(traceInto(editor, 60)).toBe(true);
		return editor;
	}

	it('is one whole-font step about no letter; one Undo puts the line and the gaps back', () => {
		const editor = twoTraced();
		const before = {
			B: glyphOf(editor, B).advanceWidth,
			r: glyphOf(editor, R).advanceWidth,
			steps: editor.history.length,
		};
		expect(setFontMetric('xHeight', 400, { verb: 'Moved' })).toBe(400);

		expect(atFit(editor, B)).toBe(true);
		expect(atFit(editor, R)).toBe(true);
		expect(glyphOf(editor, B).advanceWidth).not.toBe(before.B); // G is 8 % of the line
		expect(editor.history.length).toBe(before.steps + 1);
		const [post, pre] = queueOf(editor);
		expect(post.wholeProjectSave).toBe(true);
		expect(pre.wholeProjectSave).toBe(true);
		expect(pre.title).toBe(`Moved ${METRIC_LABELS.xHeight} to 400`);
		expect(pre.itemID).toBe(false);
		expect(post.itemID).toBe(false);
		// The before-copy holds the line where it was
		expect(pre.itemState.settings.font.xHeight).toBe(500);
		expect(post.itemState.settings.font.xHeight).toBe(400);

		showItem(editor, B);
		const undone = editor.history.restoreState();
		expect(undone.title).toBe(`Moved ${METRIC_LABELS.xHeight} to 400`);
		expect(undone.moved).toBe(false);
		expect(editor.project.settings.font.xHeight).toBe(500);
		expect(glyphOf(editor, B).advanceWidth).toBe(before.B);
		expect(glyphOf(editor, R).advanceWidth).toBe(before.r);
		expect(atFit(editor, B)).toBe(true);
		expect(atFit(editor, R)).toBe(true);

		editor.history.redoState();
		expect(editor.project.settings.font.xHeight).toBe(400);
		expect(atFit(editor, B)).toBe(true);
		expect(atFit(editor, R)).toBe(true);
	});

	it('the grid size (upm) works the same way', () => {
		const editor = twoTraced();
		editor.project.settings.font.xHeight = 0; // no usable line: the gap comes from the grid
		editor.history.addSettingsState('no small-letter line');
		expect(atFit(editor, B)).toBe(true);
		editor.project.settings.font.upm = 2000;
		editor.history.addSettingsState('grid 2000');
		expect(queueOf(editor)[0].wholeProjectSave).toBe(true);
		expect(atFit(editor, B)).toBe(true);
		expect(atFit(editor, R)).toBe(true);
	});

	it('a change that moves no gap stays a settings step: the capitals line, the font name', () => {
		const editor = twoTraced();
		expect(setFontMetric('capHeight', 650, { verb: 'Moved' })).toBe(650);
		expect(queueOf(editor)[0].settingsSave).toBe(true);
		editor.project.settings.project.name = 'Brennan Hand';
		editor.history.addSettingsState('named the font Brennan Hand');
		expect(queueOf(editor)[0].settingsSave).toBe(true);
	});

	it('a letter set by hand keeps its spacing when the line moves', () => {
		const editor = twoTraced();
		const r = glyphOf(editor, R);
		r.anyink.spacing = 'manual';
		const width = r.advanceWidth;
		setFontMetric('xHeight', 400, { verb: 'Moved' });
		expect(glyphOf(editor, R).advanceWidth).toBe(width);
		expect(atFit(editor, B)).toBe(true);
	});

	it('All tools: still a settings step that refits nothing', () => {
		const editor = twoTraced();
		setModeForTests('all');
		const width = glyphOf(editor, B).advanceWidth;
		setFontMetric('xHeight', 400, { verb: 'Moved' });
		expect(queueOf(editor)[0].settingsSave).toBe(true);
		expect(glyphOf(editor, B).advanceWidth).toBe(width);
		expect(atFit(editor, B)).toBe(false);
	});
});
