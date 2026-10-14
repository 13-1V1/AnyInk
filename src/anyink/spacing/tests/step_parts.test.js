// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 fix: in Simple an edit to a letter that automatic letters are made from (components) refits
// those letters in the same step, and the step stays what UX-BEGINNER 7.3 says shape edits are:
// an item step. The letter he changed has its entry on top; each letter refit with it has an
// item entry of its own right under it, all sharing one step key, so one Undo press puts every
// one of them back and each letter's newest state is where every reader of the list looks.
// No whole-font copies: 31 nudges of a base letter never push older steps out (the 30
// whole-font limit), and the crash copy stays small. A step and its parts count once for the
// 200-step limit, so a base letter many letters are made from never shortens the list either.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertComponentInstance } from '../../../project_editor/cross_item_actions.js';
import { applyAutoTrace } from '../../autotrace/apply.js';
import {
	B,
	R,
	shapeCount,
	square,
	traceInto,
	twoLetterEditor,
} from '../../history/tests/two_letters.js';
import { countSteps } from '../../history/undo_cap.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { sitsAtFit } from '../auto_space.js';

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

const A = 'glyph-0x61';
const C = 'glyph-0x63';
const glyphOf = (editor, id) => editor.project.glyphs[id];
const ownerOf = (item) => item?.anyink?.spacing;
const queueOf = (editor) => editor.history.queue;

/** Simple: B traced (automatic, fitted), then r made from B (its first ink), fitted too. */
function rMadeFromB() {
	setModeForTests('simple');
	const editor = twoLetterEditor();
	showItem(editor, B);
	expect(traceInto(editor, 100)).toBe(true);
	showItem(editor, R);
	expect(insertComponentInstance(B, R)).toBe(true);
	editor.history.addState('r from B');
	expect(ownerOf(glyphOf(editor, R))).toBe('auto');
	expect(sitsAtFit(glyphOf(editor, R), editor.project)).toBe(true);
	return editor;
}

/** B gets a much wider shape: B is refit by its own step, r (made from B) by the same step. */
function widenB(editor) {
	showItem(editor, B);
	const added = applyAutoTrace({
		editor,
		item: editor.selectedItem,
		shapes: [square(100, 900)],
		mode: 'add',
	});
	expect(added).toBe(true);
}

/** Moves B's right side out by 3 units, as a point drag does, and records the step. */
function nudgeB(editor) {
	const points = editor.selectedItem.shapes[0].pathPoints;
	points[1].p.coord.x += 3;
	points[2].p.coord.x += 3;
	editor.selectedItem.shapes[0].changed();
	editor.history.addState('Nudged a point of B');
}

function undoAll(editor) {
	let presses = 0;
	while (queueOf(editor).length && presses < 500) {
		editor.history.restoreState();
		presses++;
	}
	return presses;
}

describe('Simple: letters made from the changed letter are refit inside its item step', () => {
	it('records an item step on top and one item entry per refit letter, no whole-font copy', () => {
		const editor = rMadeFromB();
		const steps = editor.history.length;
		widenB(editor);
		expect(sitsAtFit(glyphOf(editor, B), editor.project)).toBe(true);
		expect(sitsAtFit(glyphOf(editor, R), editor.project)).toBe(true);

		const [top, part] = queueOf(editor);
		expect(queueOf(editor).some((entry) => entry.wholeProjectSave)).toBe(false);
		expect(top.itemID).toBe(B);
		expect(top.title).toMatch(/^Auto-traced/);
		expect(part.itemID).toBe(R);
		expect(part.title).toBe(top.title);
		expect(part.step).toBeTruthy();
		expect(part.step).toBe(top.step);
		// The entries hold copies of the letters as the step left them
		expect(part.itemState.advanceWidth).toBe(glyphOf(editor, R).advanceWidth);
		expect(part.itemState).not.toBe(glyphOf(editor, R));
		// One change for the History panel and the size limit's whole-font count
		expect(editor.history.length).toBe(steps + 1);
		expect(countSteps(queueOf(editor)).wholeProject).toBe(0);
	});

	it('one press puts the letter and the letters made from it back; Redo brings both again', () => {
		const editor = rMadeFromB();
		const before = { r: glyphOf(editor, R).advanceWidth, queue: queueOf(editor).length };
		widenB(editor);
		const after = glyphOf(editor, R).advanceWidth;
		expect(after).toBeGreaterThan(before.r);

		showItem(editor, R); // looking at r, not B
		const undone = editor.history.restoreState();
		expect(undone.done).toBe(true);
		expect(undone.itemID).toBe(B);
		expect(undone.title).toMatch(/^Auto-traced/);
		expect(editor.selectedItemID).toBe(B); // one view jump, to the letter he changed
		expect(glyphOf(editor, B).shapes).toHaveLength(1);
		expect(glyphOf(editor, R).advanceWidth).toBe(before.r);
		expect(sitsAtFit(glyphOf(editor, R), editor.project)).toBe(true);
		expect(queueOf(editor)).toHaveLength(before.queue);
		expect(editor.history.redoQueue[0]).toHaveLength(2);

		const redone = editor.history.redoState();
		expect(redone.itemID).toBe(B);
		expect(glyphOf(editor, B).shapes).toHaveLength(2);
		expect(glyphOf(editor, R).advanceWidth).toBe(after);
		expect(queueOf(editor)[0].itemID).toBe(B);
		expect(queueOf(editor)[1].itemID).toBe(R);
		expect(editor.history.redoQueue).toHaveLength(0);
	});

	it('31 nudges of a letter another automatic letter is made from keep every earlier step', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, A);
		expect(traceInto(editor, 100)).toBe(true);
		showItem(editor, C);
		expect(traceInto(editor, 100)).toBe(true);
		showItem(editor, B);
		expect(traceInto(editor, 100)).toBe(true);
		showItem(editor, R);
		expect(insertComponentInstance(B, R)).toBe(true);
		editor.history.addState('r from B');
		const widthR = glyphOf(editor, R).advanceWidth;

		showItem(editor, B);
		for (let k = 0; k < 31; k++) nudgeB(editor);
		// Every nudge moved r off its fit and refit it in the same step
		expect(glyphOf(editor, R).advanceWidth).toBe(widthR + 93);
		expect(sitsAtFit(glyphOf(editor, R), editor.project)).toBe(true);
		expect(countSteps(queueOf(editor)).wholeProject).toBe(0);
		expect(editor.history.undoFloor).toBeNull(); // nothing dropped off the old end
		expect(editor.history.length).toBe(4 + 31);

		const presses = undoAll(editor);
		expect(presses).toBe(4 + 31);
		expect(shapeCount(editor, A)).toBe(0);
		expect(shapeCount(editor, C)).toBe(0);
		expect(shapeCount(editor, B)).toBe(0);
		expect(shapeCount(editor, R)).toBe(0);
	});

	it('a step and its parts count once for the 200-step limit: 40 nudges of a letter five are made from keep every earlier step', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, A);
		expect(traceInto(editor, 100)).toBe(true);
		showItem(editor, B);
		expect(traceInto(editor, 100)).toBe(true);
		// r, s, t, u, v are each made from B (like accented letters made from their base)
		const madeFromB = [0x72, 0x73, 0x74, 0x75, 0x76].map((code) => `glyph-0x${code.toString(16)}`);
		madeFromB.forEach((id) => {
			showItem(editor, id);
			expect(insertComponentInstance(B, id)).toBe(true);
			editor.history.addState(`${id} from B`);
		});
		const earlier = editor.history.length;
		expect(earlier).toBe(7);

		showItem(editor, B);
		for (let k = 0; k < 40; k++) nudgeB(editor);
		// Every nudge refit the five letters made from B inside its own step
		expect(queueOf(editor).length).toBe(earlier + 40 * 6);
		madeFromB.forEach((id) => expect(sitsAtFit(glyphOf(editor, id), editor.project)).toBe(true));
		expect(editor.history.length).toBe(earlier + 40);
		expect(editor.history.undoFloor).toBeNull(); // nothing dropped off the old end

		expect(undoAll(editor)).toBe(earlier + 40);
		[A, B, ...madeFromB].forEach((id) => expect(shapeCount(editor, id)).toBe(0));
	});

	it('a later step on the letter made from it goes back to that letter as the refit left it', () => {
		const editor = rMadeFromB();
		widenB(editor);
		const refit = glyphOf(editor, R).advanceWidth;
		showItem(editor, R);
		// A wide piece added to r: r is refit by its own step, wider than the refit left it
		const added = applyAutoTrace({
			editor,
			item: editor.selectedItem,
			shapes: [square(900, 300)],
			mode: 'add',
		});
		expect(added).toBe(true);
		expect(glyphOf(editor, R).advanceWidth).toBeGreaterThan(refit);

		editor.history.restoreState();
		expect(glyphOf(editor, R).advanceWidth).toBe(refit);
		expect(sitsAtFit(glyphOf(editor, R), editor.project)).toBe(true);
		expect(glyphOf(editor, B).shapes).toHaveLength(2);
	});

	it('a crash restore keeps the step whole: All tools undoes and redoes it in one press', () => {
		const editor = rMadeFromB();
		const widthR = glyphOf(editor, R).advanceWidth;
		widenB(editor);
		const after = glyphOf(editor, R).advanceWidth;
		const snapshot = JSON.parse(JSON.stringify(editor.history.serializeForStorage()));
		expect(snapshot.queue[0].step).toBe(snapshot.queue[1].step);

		setModeForTests('all');
		expect(editor.history.adoptSnapshot(snapshot)).toBe(true);
		const length = queueOf(editor).length;
		editor.history.restoreState();
		expect(glyphOf(editor, B).shapes).toHaveLength(1);
		expect(glyphOf(editor, R).advanceWidth).toBe(widthR);
		expect(queueOf(editor)).toHaveLength(length - 2);
		expect(editor.selectedItemID).toBe(B);

		editor.history.redoState();
		expect(glyphOf(editor, B).shapes).toHaveLength(2);
		expect(glyphOf(editor, R).advanceWidth).toBe(after);
		expect(queueOf(editor)).toHaveLength(length);
	});

	it('the History panel counts the step as one row: jumping past it lands right under it', () => {
		const editor = rMadeFromB();
		widenB(editor);
		showItem(editor, B);
		nudgeB(editor);
		setModeForTests('all');
		// Rows: [nudge B, nudge's r], [Auto-traced B, its r], [r from B] ... ; the panel's index
		// counts every row it shows, and one press undoes a whole step
		const rows = queueOf(editor).filter(
			(entry) => entry.title !== '_whole_project_change_post_state_'
		);
		const target = rows.findIndex((entry) => entry.title === 'r from B');
		editor.history.jumpToState(target);
		expect(queueOf(editor)[0].title).toBe('r from B');
		expect(glyphOf(editor, B).shapes).toHaveLength(1);
	});

	it('the size limit drops a step and its parts together', () => {
		const editor = rMadeFromB();
		widenB(editor); // the oldest step with parts
		const key = queueOf(editor)[0].step;
		expect(key).toBeTruthy();
		const refit = {
			B: glyphOf(editor, B).advanceWidth,
			r: glyphOf(editor, R).advanceWidth,
		};
		// Fill the list with item steps on another letter until the step's oldest part drops
		showItem(editor, A);
		expect(traceInto(editor, 100)).toBe(true);
		let guard = 0;
		const partsLeft = () => queueOf(editor).filter((entry) => entry.step === key).length;
		while (partsLeft() && guard++ < 400) {
			glyphOf(editor, A).shapes[0].updateShapePosition(0, 1);
			editor.history.addState('Nudged a up');
			// Never only part of it: the letter he changed and r leave together
			expect([0, 2]).toContain(partsLeft());
		}
		expect(guard).toBeLessThan(400);
		expect(queueOf(editor).some((entry) => entry.step === key)).toBe(false);
		// What the dropped step did is in the floor for both letters, so they still agree
		expect(editor.history.undoFloor.glyphs[B].advanceWidth).toBe(refit.B);
		expect(editor.history.undoFloor.glyphs[R].advanceWidth).toBe(refit.r);
		undoAll(editor);
		expect(glyphOf(editor, B).shapes).toHaveLength(2);
		expect(glyphOf(editor, R).advanceWidth).toBe(refit.r);
		expect(sitsAtFit(glyphOf(editor, R), editor.project)).toBe(true);
	});
});
