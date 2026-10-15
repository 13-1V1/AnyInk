// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6 (UX-BEGINNER.md 4.0 Top bar, principle 6): the Undo and Redo buttons in the Simple top bar.
// Undo can act exactly when Simple's undo has a step to take back (looking around never counts),
// its tooltip names that step in plain words ("Undo: traced Capital B"), and with nothing to
// take back it says why ("Nothing to undo yet"). Redo the same over the Redo list.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { word } from '../../words/words.js';
import { B, R, square, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { nextRedoStep, nextUndoStep, stepChange, undoButtonsState } from '../undo_buttons.js';

let warn;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
	document.body.innerHTML = '';
});

function simpleEditor() {
	setModeForTests('simple');
	const editor = twoLetterEditor();
	showItem(editor, B);
	return editor;
}

describe('Undo and Redo: enabled only when there is a step to act on', () => {
	it('a new font: both say why they do nothing', () => {
		const editor = simpleEditor();
		const state = undoButtonsState(editor.history, editor.project);
		expect(state.undo).toEqual({ enabled: false, change: '', tip: word('undo.nothing') });
		expect(state.redo).toEqual({ enabled: false, change: '', tip: word('undo.nothingToRedo') });
		expect(state.undo.tip).toBe('Nothing to undo yet');
	});

	it('after a trace: Undo names it ("Undo: traced Capital B"), Redo still nothing', () => {
		const editor = simpleEditor();
		traceInto(editor);
		const state = undoButtonsState(editor.history, editor.project);
		expect(state.undo.enabled).toBe(true);
		expect(state.undo.change).toBe('traced Capital B');
		expect(state.undo.tip).toBe('Undo: traced Capital B');
		expect(state.redo.enabled).toBe(false);
	});

	it('after Undo: Redo names the same step; Undo has nothing left', () => {
		const editor = simpleEditor();
		traceInto(editor);
		editor.history.restoreState();
		const state = undoButtonsState(editor.history, editor.project);
		expect(state.undo.enabled).toBe(false);
		expect(state.undo.tip).toBe('Nothing to undo yet');
		expect(state.redo.enabled).toBe(true);
		expect(state.redo.tip).toBe('Redo: traced Capital B');
	});

	it('names the newest change wherever it is: B traced, then r', () => {
		const editor = simpleEditor();
		traceInto(editor);
		showItem(editor, R);
		traceInto(editor, 60);
		expect(undoButtonsState(editor.history, editor.project).undo.tip).toBe('Undo: traced small r');
		editor.history.restoreState();
		const state = undoButtonsState(editor.history, editor.project);
		expect(state.undo.tip).toBe('Undo: traced Capital B');
		expect(state.redo.tip).toBe('Redo: traced small r');
	});

	it('looking around never enables Undo: "Navigated to" and creation-only entries are passed over', () => {
		const queue = [
			{ title: 'Navigated to Latin Capital Letter B', itemID: B, navigation: true },
			{ title: '_whole_project_change_post_state_', wholeProjectSave: true, creationOnly: true },
			{ title: 'Created Latin Small Letter A', wholeProjectSave: true, creationOnly: true },
		];
		expect(nextUndoStep(queue)).toBeNull();
		const state = undoButtonsState({ queue, redoQueue: [] }, null);
		expect(state.undo.enabled).toBe(false);
		// ...but a real step under them is what Undo takes back (Simple passes over them)
		queue.push({ title: 'Added path: Rectangle 1', itemID: B });
		expect(nextUndoStep(queue)).toEqual({ title: 'Added path: Rectangle 1', itemID: B });
		expect(undoButtonsState({ queue, redoQueue: [] }, null).undo.tip).toBe(
			'Undo: added a rectangle'
		);
	});

	it("a whole-font step is named by its pre entry's title, never upstream's internal marker", () => {
		const queue = [
			{ title: '_whole_project_change_post_state_', wholeProjectSave: true, itemID: B },
			{ title: 'moved all letters closer', wholeProjectSave: true, itemID: B },
		];
		expect(nextUndoStep(queue)).toEqual({ title: 'moved all letters closer', itemID: B });
		const redo = [[queue[0], queue[1]]];
		expect(nextRedoStep(redo)).toEqual({ title: 'moved all letters closer', itemID: B });
		const state = undoButtonsState({ queue, redoQueue: redo }, null);
		expect(state.undo.tip).toBe('Undo: moved all letters closer');
		expect(state.redo.tip).toBe('Redo: moved all letters closer');
	});

	it('a title no rule knows says "your last change"; a lone post entry too', () => {
		expect(stepChange({ title: 'Something upstream wrote', itemID: false })).toBe(
			word('history.unknown')
		);
		const lone = [{ title: '_whole_project_change_post_state_', wholeProjectSave: true }];
		expect(undoButtonsState({ queue: lone, redoQueue: [] }, null).undo.tip).toBe(
			'Undo: your last change'
		);
	});

	it("a letter-less title names the letter from its record (upstream's auto-trace title)", () => {
		const editor = simpleEditor();
		editor.selectedItem.addOneShape(square());
		editor.history.addState('Auto-traced 1 shape (4 points)');
		expect(undoButtonsState(editor.history, editor.project).undo.change).toBe('traced Capital B');
	});
});

// B6 fix (first-timer 48 / 49): the last change was on small r, small B is open. Undo goes to r,
// and its toast says "Undid: added a rectangle on small r"; the tooltip said only "Undo: added a
// rectangle", so the jump came with no warning. It names the letter, in the toast's words.
describe('Undo and Redo name the letter when it is not the one open', () => {
	function rectangleOnR() {
		const editor = simpleEditor();
		showItem(editor, R);
		editor.selectedItem.addOneShape(square());
		editor.history.addState('Added path: Rectangle 1');
		showItem(editor, B);
		return editor;
	}

	it('small B open, the newest change on small r: "Undo: added a rectangle on small r"', () => {
		const editor = rectangleOnR();
		const state = undoButtonsState(editor.history, editor.project, { openItemID: B });
		expect(state.undo.tip).toBe('Undo: added a rectangle on small r');
		expect(state.undo.change).toBe('added a rectangle');
	});

	it('on the letter it was made on: no letter named', () => {
		const editor = rectangleOnR();
		expect(undoButtonsState(editor.history, editor.project, { openItemID: R }).undo.tip).toBe(
			'Undo: added a rectangle'
		);
	});

	it('on the board (no letter open): named, as the board toast names it', () => {
		const editor = rectangleOnR();
		expect(undoButtonsState(editor.history, editor.project, { openItemID: false }).undo.tip).toBe(
			'Undo: added a rectangle on small r'
		);
	});

	it('a change that already names its letter says it once ("Undo: traced small r")', () => {
		const editor = simpleEditor();
		showItem(editor, R);
		traceInto(editor);
		showItem(editor, B);
		expect(undoButtonsState(editor.history, editor.project, { openItemID: B }).undo.tip).toBe(
			'Undo: traced small r'
		);
	});

	it('Redo too: "Redo: added a rectangle on small r" from small B', () => {
		const editor = rectangleOnR();
		editor.history.restoreState(); // the view moves to r
		showItem(editor, B);
		const state = undoButtonsState(editor.history, editor.project, { openItemID: B });
		expect(state.redo.tip).toBe('Redo: added a rectangle on small r');
		expect(
			undoButtonsState(editor.history, editor.project, { openItemID: R }).redo.tip
		).toBe('Redo: added a rectangle');
	});

	it('a font-wide step names no letter', () => {
		const queue = [{ title: 'moved all letters closer', settingsSave: true, itemID: false }];
		expect(
			undoButtonsState({ queue, redoQueue: [] }, null, { openItemID: B }).undo.tip
		).toBe('Undo: moved all letters closer');
	});

	it('the same rule as the toast: the toast after the press says the same letter', () => {
		const editor = rectangleOnR();
		const tip = undoButtonsState(editor.history, editor.project, { openItemID: B }).undo.tip;
		expect(tip.replace(/^Undo: /, '')).toBe('added a rectangle on small r');
	});
});
