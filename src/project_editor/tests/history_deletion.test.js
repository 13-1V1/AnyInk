// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2 + B3 finalize (UX-BEGINNER 7.3, D-033): deleting a letter and letters opened with no step.
//   - Simple records no "Automatically navigated to" step (the Delete buttons), so one Undo press
//     brings a deleted letter back; an All tools list's step of that kind is passed over.
//   - All tools never drops an edit that sits right over a deletion (a list made in Simple), and a
//     deletion on top with another letter under it puts its own letter back.
//   - All tools: a letter opened with no "Navigated to" step (the item links) has its step undone,
//     not dropped (D-033 records this change from upstream).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	B,
	R,
	shapeCount,
	square,
	traceInto,
	twoLetterEditor,
} from '../../anyink/history/tests/two_letters.js';
import { setModeForTests } from '../../anyink/mode/mode.js';
import { actionInAllTools } from '../../anyink/mode/tests/all_tools_action.js';
import { showItem } from '../../anyink/preview/show_item.js';

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

/**
 * The real Delete Glyph button (panels/actions.js): the deletion, then its own navigation step.
 * B5: Simple doesn't draw the icon (6.2), so it is taken as All tools draws it and pressed in the
 * test's own mode.
 */
function pressDeleteGlyph() {
	const action = actionInAllTools('glyphActions', 'deleteGlyph');
	action.onClick();
}

/** Trace B, open r, trace r. */
function traceBThenR() {
	const editor = twoLetterEditor();
	showItem(editor, B);
	expect(traceInto(editor)).toBe(true);
	showItem(editor, R);
	expect(traceInto(editor, 60)).toBe(true);
	return editor;
}

describe('deleting a letter', () => {
	it('Simple: Delete, then one Undo press brings the letter back', () => {
		setModeForTests('simple');
		const editor = traceBThenR();
		pressDeleteGlyph();
		expect(editor.project.glyphs[R]).toBeUndefined();
		// looking around is never a step: no "Automatically navigated to" step
		expect(editor.history.queue.some((entry) => /^Automatically/.test(entry.title))).toBe(false);

		const result = editor.history.restoreState();
		expect(result.done).toBe(true);
		expect(result.title).toMatch(/^Deleted/);
		expect(shapeCount(editor, R)).toBe(1);
		expect(editor.selectedItemID).toBe(R);
		// and Redo deletes it again
		editor.history.redoState();
		expect(editor.project.glyphs[R]).toBeUndefined();
	});

	it("Simple: an All tools list's \"Automatically navigated to\" step is passed over in the same press", () => {
		const editor = traceBThenR();
		pressDeleteGlyph(); // All tools: the deletion plus "Automatically navigated to"
		expect(editor.history.queue[0].title).toMatch(/^Automatically navigated to/);
		setModeForTests('simple');
		const result = editor.history.restoreState();
		expect(result.title).toMatch(/^Deleted/);
		expect(shapeCount(editor, R)).toBe(1);
	});

	it('All tools on its own: Delete, then one Undo press brings the letter back (upstream)', () => {
		const editor = traceBThenR();
		pressDeleteGlyph();
		editor.history.restoreState();
		expect(shapeCount(editor, R)).toBe(1);
	});

	it('All tools, a list made in Simple: an edit right over a deletion is undone, never dropped', () => {
		setModeForTests('simple');
		const editor = traceBThenR();
		pressDeleteGlyph(); // r
		showItem(editor, B);
		editor.selectedItem.addOneShape(square(700, 100).save());
		editor.history.addState('Added a second shape to B');
		expect(shapeCount(editor, B)).toBe(2);
		const snapshot = editor.history.serializeForStorage();
		setModeForTests('all');
		expect(editor.history.adoptSnapshot(snapshot)).toBe(true);

		editor.history.restoreState(); // B's second shape, from B's own earlier state
		expect(shapeCount(editor, B)).toBe(1);
		expect(editor.project.glyphs[R]).toBeUndefined();
		expect(editor.history.redoQueue).toHaveLength(1);
		editor.history.redoState(); // and it is one Redo away
		expect(shapeCount(editor, B)).toBe(2);
		editor.history.restoreState();
		editor.history.restoreState(); // the deletion: r comes back
		expect(shapeCount(editor, R)).toBe(1);
		expect(shapeCount(editor, B)).toBe(1);
	});

	it('All tools: a deletion on top with another letter under it puts its letter back', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, R);
		expect(traceInto(editor, 60)).toBe(true);
		showItem(editor, B);
		expect(traceInto(editor)).toBe(true);
		showItem(editor, R);
		pressDeleteGlyph(); // the list: [Deleted r, traced B, traced r]
		expect(editor.history.queue.map((entry) => entry.itemID)).toEqual([R, B, R]);
		setModeForTests('all');

		editor.history.restoreState();
		expect(shapeCount(editor, R)).toBe(1);
		expect(shapeCount(editor, B)).toBe(1);
		expect(editor.selectedItemID).toBe(R);
	});
});

describe('All tools: a letter opened with no "Navigated to" step (D-033)', () => {
	it("trace B, open r by an item link, trace r: Undo undoes r's trace and Redo brings it back", () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(traceInto(editor)).toBe(true);
		// the item-link rows (cards.js) and the context-character double-click: no step
		editor.nav.page = 'Characters';
		editor.selectedItemID = R;
		editor.navigate();
		expect(traceInto(editor, 60)).toBe(true);
		// r's trace right over B's: no step says r was opened
		expect(editor.history.queue.slice(0, 2).map((entry) => entry.itemID)).toEqual([R, B]);

		editor.history.restoreState();
		expect(shapeCount(editor, R)).toBe(0);
		expect(shapeCount(editor, B)).toBe(1);
		expect(editor.history.redoQueue).toHaveLength(1);
		editor.history.redoState();
		expect(shapeCount(editor, R)).toBe(1);
	});
});
