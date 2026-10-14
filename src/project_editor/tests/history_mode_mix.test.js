// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2 + B3 fixes in History (UX-BEGINNER 7.3, 4.6):
//   - A font-wide step recorded with { itemID: null } is about no letter, so Undo from another
//     letter never jumps to the letter that happened to be open (the slider, gap fixes, guide
//     lines pass null).
//   - An Undo list made in Simple (it holds no "Navigated to" steps) and then used in All tools
//     (a crash restore under the default launch, or B5's mode switch) undoes every real step:
//     All tools takes only a real navigation step as "navigated without undoing" (or upstream's
//     "Automatically navigated to" step after a deletion, so All tools' own undo is unchanged).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	B,
	R,
	shapeCount,
	traceInto,
	twoLetterEditor,
} from '../../anyink/history/tests/two_letters.js';
import { setModeForTests } from '../../anyink/mode/mode.js';
import { showItem } from '../../anyink/preview/show_item.js';
import { insertComponentInstance } from '../cross_item_actions.js';

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

const widthOf = (editor, id) => editor.project.glyphs[id].advanceWidth;

/** A font-wide step the way the letter-spacing slider records it (B12): about no letter. */
function fontWideStep(editor, title = 'moved all letters closer') {
	editor.history.addWholeProjectChangePreState(title, { itemID: null });
	editor.project.glyphs[B].advanceWidth += 20;
	editor.project.glyphs[R].advanceWidth += 20;
	editor.history.addWholeProjectChangePostState();
}

describe('a font-wide step recorded with itemID: null names no letter', () => {
	it('Simple: Undo from another letter undoes it and the view stays on that letter', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(traceInto(editor)).toBe(true);
		const widths = { B: widthOf(editor, B), r: widthOf(editor, R) };
		fontWideStep(editor); // made while B is open
		expect(editor.history.queue[0].itemID).toBe(false);
		expect(editor.history.queue[1].itemID).toBe(false);

		showItem(editor, R);
		const result = editor.history.restoreState();
		expect(result.done).toBe(true);
		expect(result.title).toBe('moved all letters closer');
		expect(result.itemID).toBe(false);
		expect(result.moved).toBe(false);
		expect(result.showMe).toBeNull();
		expect(editor.selectedItemID).toBe(R);
		expect(widthOf(editor, B)).toBe(widths.B);
		expect(widthOf(editor, R)).toBe(widths.r);

		// Redo stays put too
		const redone = editor.history.redoState();
		expect(redone.itemID).toBe(false);
		expect(redone.moved).toBe(false);
		expect(editor.selectedItemID).toBe(R);
	});

	it('All tools: an explicit null wins over the open letter and the step on top', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		fontWideStep(editor);
		expect(editor.history.queue[0].itemID).toBe(false);
		expect(editor.history.queue[1].itemID).toBe(false);
		editor.history.restoreState();
		expect(editor.history.queue[0].title).toMatch(/^Navigated to/);
	});

	it('leaving itemID out still names the open letter, as before', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		editor.history.addWholeProjectChangePreState('changed B and r');
		editor.project.glyphs[B].advanceWidth += 20;
		editor.history.addWholeProjectChangePostState();
		expect(editor.history.queue[1].itemID).toBe(B);
		showItem(editor, R);
		const result = editor.history.restoreState();
		expect(result.itemID).toBe(B);
		expect(result.moved).toBe(true);
	});
});

describe('an Undo list made in Simple, used in All tools', () => {
	/** Simple: trace B, open r, trace r. The list: [traced r, traced B], no navigation steps. */
	function builtInSimple() {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(traceInto(editor)).toBe(true);
		showItem(editor, R);
		expect(traceInto(editor, 60)).toBe(true);
		expect(editor.history.queue.map((entry) => entry.itemID)).toEqual([R, B]);
		return editor;
	}

	/** Two presses of All tools' Undo restore both letters, then Redo brings both back. */
	function expectBothUndone(editor) {
		editor.history.restoreState();
		expect(shapeCount(editor, R)).toBe(0);
		expect(shapeCount(editor, B)).toBe(1);
		expect(editor.history.queue.map((entry) => entry.itemID)).toEqual([B]);
		expect(editor.history.redoQueue).toHaveLength(1);

		editor.history.restoreState();
		expect(shapeCount(editor, B)).toBe(0);
		expect(shapeCount(editor, R)).toBe(0);
		expect(editor.history.queue).toHaveLength(0);
		expect(editor.selectedItemID).toBe(B);

		editor.history.redoState();
		expect(shapeCount(editor, B)).toBe(1);
		editor.history.redoState();
		expect(shapeCount(editor, R)).toBe(1);
		expect(editor.history.queue.map((entry) => entry.itemID)).toEqual([R, B]);
	}

	it('after a crash restore under the default launch (All tools), both letters undo', () => {
		const editor = builtInSimple();
		const snapshot = editor.history.serializeForStorage();
		setModeForTests('all');
		expect(editor.history.adoptSnapshot(snapshot)).toBe(true);
		expectBothUndone(editor);
	});

	it('after a mode switch in the middle of a session (B5), both letters undo', () => {
		const editor = builtInSimple();
		setModeForTests('all');
		expectBothUndone(editor);
	});

	it('a real "Navigated to" step on top still only moves the view (upstream)', () => {
		const editor = builtInSimple();
		setModeForTests('all');
		showItem(editor, B); // All tools records "Navigated to" B
		expect(editor.history.queue[0].navigation).toBe(true);
		editor.history.restoreState();
		expect(editor.selectedItemID).toBe(R);
		expect(shapeCount(editor, R)).toBe(1);
		expect(shapeCount(editor, B)).toBe(1);
		expect(editor.history.queue.map((entry) => entry.itemID)).toEqual([R, B]);
	});

	it('All tools: after deleting a letter another is made from, the first press only moves the view (upstream)', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(traceInto(editor)).toBe(true);
		showItem(editor, R);
		expect(insertComponentInstance(B, R)).toBe(true);
		editor.history.addState('r from B');
		showItem(editor, B);
		// The Delete button: a whole-font step (B is used in r), then upstream's own
		// "Automatically navigated to" step for the letter it opens next
		editor.deleteSelectedItemFromProject();
		editor.history.addState(`Automatically navigated to ${editor.selectedItem.name}`);
		expect(editor.project.glyphs[B]).toBeUndefined();
		const length = editor.history.queue.length;

		editor.history.restoreState();
		expect(document.querySelector('#toast')?.textContent).toMatch(/Navigated without undo-ing/);
		expect(editor.history.redoQueue).toHaveLength(0);
		expect(editor.history.queue).toHaveLength(length - 1);
		expect(editor.selectedItemID).toBe(B);

		editor.history.restoreState(); // the deletion
		expect(shapeCount(editor, B)).toBe(1);
		expect(editor.project.glyphs[R].shapes[0].objType).toBe('ComponentInstance');
	});

	it('All tools on its own keeps upstream undo: a step, its navigation, the step before', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(traceInto(editor)).toBe(true);
		showItem(editor, R);
		expect(traceInto(editor, 60)).toBe(true);
		editor.history.restoreState(); // r's trace
		expect(shapeCount(editor, R)).toBe(0);
		editor.history.restoreState(); // "Navigated to" r: back to B, nothing undone
		expect(editor.selectedItemID).toBe(B);
		expect(shapeCount(editor, B)).toBe(1);
		editor.history.restoreState(); // B's trace
		expect(shapeCount(editor, B)).toBe(0);
	});
});
