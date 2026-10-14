// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2 "Undo that never surprises" (UX-BEGINNER 7.3, section 10 B2): in Simple, one press undoes the
// newest change wherever it is; looking around is never an Undo step; creation-only steps are
// passed over and never toasted.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertComponentInstance } from '../../../project_editor/cross_item_actions.js';
import { applyAutoTrace } from '../../autotrace/apply.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { B, R, shapeCount, square, traceInto, twoLetterEditor } from './two_letters.js';

let warn;
beforeEach(() => {
	document.title = 'ANY-INK';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	// editor.navigate() without an #app__wrapper only warns; keep test output quiet
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	document.querySelectorAll('#toast').forEach((element) => element.remove());
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

const titles = (editor) => editor.history.queue.map((entry) => entry.title);
// Every toast message this test showed, in order. (Mocking showToast misses history.js: dialogs.js
// reaches it through main.js while the mock is still being made, so history.js keeps the real one.)
const seenToasts = [];
let toastWatch;
function collectToast(record) {
	if (record.type !== 'childList' || record.target?.id !== 'toast') return;
	const text = [...record.addedNodes].map((node) => node.textContent).join('');
	if (text) seenToasts.push(text);
}
function toastTexts() {
	toastWatch.takeRecords().forEach(collectToast);
	return seenToasts.slice();
}
beforeEach(() => {
	seenToasts.length = 0;
	toastWatch = new MutationObserver((records) => records.forEach(collectToast));
	toastWatch.observe(document.body, { childList: true, subtree: true });
});
afterEach(() => toastWatch.disconnect());

/** Simple: open B, trace it, open r, trace it. */
function traceBThenR() {
	setModeForTests('simple');
	const editor = twoLetterEditor();
	showItem(editor, B);
	expect(traceInto(editor)).toBe(true);
	showItem(editor, R);
	expect(traceInto(editor, 60)).toBe(true);
	return editor;
}

describe('Simple undo: one press undoes the newest change, wherever it is', () => {
	it('trace B, go to r, trace r: Undo twice restores both, one view jump per press, no "navigated" press', () => {
		const editor = traceBThenR();
		expect(titles(editor)).toHaveLength(2);
		expect(titles(editor).some((title) => title.startsWith('Navigated'))).toBe(false);
		const navigate = vi.spyOn(editor, 'navigate');

		// Press 1: r is the newest change and r is open; nothing to move
		const first = editor.history.restoreState();
		expect(shapeCount(editor, R)).toBe(0);
		expect(shapeCount(editor, B)).toBe(1);
		expect(editor.selectedGlyphID).toBe(R);
		expect(navigate).toHaveBeenCalledTimes(0);
		expect(first).toMatchObject({ done: true, itemID: R, moved: false, showMe: null });

		// Press 2: B's change, on another letter: the view moves there and undoes it, same press
		const second = editor.history.restoreState();
		expect(shapeCount(editor, B)).toBe(0);
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedGlyphID).toBe(B);
		expect(navigate).toHaveBeenCalledTimes(1);
		expect(second).toMatchObject({ done: true, itemID: B, moved: true, showMe: null });

		expect(editor.history.queue).toHaveLength(0);
		expect(toastTexts().some((text) => text.includes('Navigated'))).toBe(false);
	});

	it('redo puts both back in order, moving the view the same way', () => {
		const editor = traceBThenR();
		editor.history.restoreState();
		editor.history.restoreState();
		const navigate = vi.spyOn(editor, 'navigate');

		const first = editor.history.redoState();
		expect(shapeCount(editor, B)).toBe(1);
		expect(shapeCount(editor, R)).toBe(0);
		expect(first).toMatchObject({ done: true, itemID: B, moved: false });
		expect(navigate).toHaveBeenCalledTimes(0);

		const second = editor.history.redoState();
		expect(shapeCount(editor, R)).toBe(1);
		expect(editor.selectedGlyphID).toBe(R);
		expect(second).toMatchObject({ done: true, itemID: R, moved: true });
		expect(navigate).toHaveBeenCalledTimes(1);

		// and undo still works after a redo (no aliasing between the queue and the font)
		editor.history.restoreState();
		expect(shapeCount(editor, R)).toBe(0);
		expect(shapeCount(editor, B)).toBe(1);
	});

	it('from a third letter, the first press moves to r and undoes r', () => {
		const editor = traceBThenR();
		showItem(editor, 'glyph-0x61');
		expect(editor.history.queue).toHaveLength(2);
		const navigate = vi.spyOn(editor, 'navigate');

		const result = editor.history.restoreState();
		expect(editor.selectedGlyphID).toBe(R);
		expect(shapeCount(editor, R)).toBe(0);
		expect(shapeCount(editor, B)).toBe(1);
		expect(navigate).toHaveBeenCalledTimes(1);
		expect(result).toMatchObject({ itemID: R, moved: true });
	});

	it('away from the letters (the board) the view stays and the press returns a Show me target', () => {
		const editor = traceBThenR();
		editor.nav.page = 'Overview';
		const navigate = vi.spyOn(editor, 'navigate');

		const result = editor.history.restoreState();
		expect(shapeCount(editor, R)).toBe(0);
		expect(editor.nav.page).toBe('Overview');
		expect(navigate).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			done: true,
			itemID: R,
			moved: false,
			showMe: { itemID: R, page: 'Characters' },
		});
		expect(result.title).toBe(editor.history.redoQueue[0][0].title);

		const next = editor.history.restoreState();
		expect(shapeCount(editor, B)).toBe(0);
		expect(editor.nav.page).toBe('Overview');
		expect(next.showMe).toEqual({ itemID: B, page: 'Characters' });
		expect(navigate).not.toHaveBeenCalled();
	});

	it('a whole-project step names the letter that was open, so undo shows that letter', () => {
		const editor = traceBThenR();
		// r is open and r's trace is the newest step; the step under it is B's
		editor.history.addWholeProjectChangePreState('moved all letters closer');
		editor.project.glyphs[B].advanceWidth = 640;
		editor.project.glyphs[R].advanceWidth = 420;
		editor.history.addWholeProjectChangePostState();
		expect(editor.history.queue[0].itemID).toBe(R);
		expect(editor.history.queue[1].itemID).toBe(R);

		showItem(editor, B);
		const result = editor.history.restoreState();
		expect(editor.project.glyphs[B].advanceWidth).not.toBe(640);
		expect(editor.project.glyphs[R].advanceWidth).not.toBe(420);
		expect(result).toMatchObject({ itemID: R, moved: true });
		expect(editor.selectedGlyphID).toBe(R);
	});

	it('the whole-project step takes the open letter in All tools too, not the step below it', () => {
		const editor = twoLetterEditor();
		editor.selectedGlyphID = B;
		traceInto(editor);
		// opened without a "Navigated to" step (B1's Show me path skips it when already open)
		editor.selectedGlyphID = R;
		editor.history.addWholeProjectChangePreState('Bulk');
		editor.history.addWholeProjectChangePostState();
		expect(editor.history.queue[1].itemID).toBe(R);
		expect(editor.history.queue[0].itemID).toBe(R);
	});

	it('a settings step undoes in place: no view move, no Show me', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor);
		editor.project.settings.font.xHeight = 520;
		editor.history.addSettingsState('moved the small-letter line');
		showItem(editor, R);
		const navigate = vi.spyOn(editor, 'navigate');

		const result = editor.history.restoreState();
		expect(editor.project.settings.font.xHeight).toBe(500);
		expect(editor.selectedGlyphID).toBe(R);
		expect(navigate).not.toHaveBeenCalled();
		expect(result).toMatchObject({ done: true, itemID: false, moved: false, showMe: null });
	});

	it('an empty list says so and changes nothing', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		const result = editor.history.restoreState();
		expect(result).toMatchObject({ done: false });
		expect(editor.history.redoQueue).toHaveLength(0);
	});
});

describe('Simple: a press names the step by its own title, never the internal marker', () => {
	const MARKER = '_whole_project_change_post_state_';

	it('a whole-font step: undo and redo both return the title it was recorded with', () => {
		const editor = traceBThenR();
		editor.history.addWholeProjectChangePreState('moved all letters closer');
		editor.project.glyphs[B].advanceWidth = 640;
		editor.project.glyphs[R].advanceWidth = 420;
		editor.history.addWholeProjectChangePostState();

		const undone = editor.history.restoreState();
		expect(undone.title).toBe('moved all letters closer');
		const redone = editor.history.redoState();
		expect(redone.title).toBe('moved all letters closer');
		expect(editor.history.restoreState().title).toBe('moved all letters closer');
	});

	it('a trace that replaces a part made from another letter (a whole-font step) is named for the trace', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(traceInto(editor, 100)).toBe(true);
		showItem(editor, R);
		expect(insertComponentInstance(B, R)).toBe(true);
		editor.history.addState('Inserted Capital B into small r');
		// Replace on a letter that holds a part takes the part out of B's "used in" list too, so
		// apply.js records it as a whole-font pre / post pair
		expect(traceInto(editor, 60)).toBe(true);
		expect(editor.history.queue[0].title).toBe(MARKER);
		expect(editor.history.queue[0].wholeProjectSave).toBe(true);
		const named = editor.history.queue[1].title;
		expect(named).toMatch(/^Auto-traced/);

		expect(editor.history.restoreState().title).toBe(named);
		expect(editor.history.redoState().title).toBe(named);
		expect(editor.history.restoreState().title).toBe(named);
	});

	it('a trace that refits the letters made from it (an item step with parts) is named for the trace', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(traceInto(editor, 100)).toBe(true);
		showItem(editor, R);
		expect(insertComponentInstance(B, R)).toBe(true);
		editor.history.addState('Inserted Capital B into small r');
		showItem(editor, B);
		// A much wider B moves r (made from B) off its fit: r is refit as a part of B's step
		const added = applyAutoTrace({
			editor,
			item: editor.selectedItem,
			shapes: [square(100, 900)],
			mode: 'add',
		});
		expect(added).toBe(true);
		const [own, part] = editor.history.queue;
		expect(own.wholeProjectSave).toBe(false);
		expect(part.itemID).toBe(R);
		expect(part.step).toBe(own.step);
		const named = own.title;
		expect(named).toMatch(/^Auto-traced/);

		expect(editor.history.restoreState().title).toBe(named);
		expect(editor.history.redoState().title).toBe(named);
		expect(editor.history.restoreState().title).toBe(named);
	});

	it('a lone whole-font after-copy (no partner) never shows the marker', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		editor.selectedGlyphID = B;
		editor.history.addWholeProjectChangePostState();
		expect(editor.history.queue).toHaveLength(1);
		const undone = editor.history.restoreState();
		expect(undone.done).toBe(true);
		expect(undone.title).not.toBe(MARKER);
		expect(editor.history.redoState().title).not.toBe(MARKER);
	});
});

describe('Simple: looking around is never an Undo step', () => {
	const tenLetters = [
		'0x43',
		'0x44',
		'0x45',
		'0x61',
		'0x62',
		'0x63',
		'0x64',
		'0x65',
		'0x66',
		'0x67',
	];

	it('opening 10 empty letters adds 0 steps', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor({ fileHandle: { kind: 'file', name: 'Two Letters.gs2' } });
		tenLetters.forEach((hex, index) => {
			const id = `glyph-${hex}`;
			if (index % 2) {
				showItem(editor, id); // the Overview / letter chooser path, with its "Navigated to"
			} else {
				editor._selectedGlyphID = id; // the on-demand path in the selectedGlyph getter
				expect(editor.selectedGlyph.id).toBe(id);
			}
			expect(editor.project.glyphs[id]).toBeDefined();
		});
		expect(editor.history.queue).toHaveLength(0);
		expect(editor.history.length).toBe(0);
		expect(document.title).toBe('ANY-INK');
		expect(editor.history.isAtSavedState()).toBe(true);
	});

	it('the selectedGlyph getter creates an empty letter with no history entries', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		editor._selectedGlyphID = 'glyph-0x43';
		const created = editor.selectedGlyph;
		expect(created.shapes).toHaveLength(0);
		expect(editor.project.glyphs['glyph-0x43']).toBe(created);
		expect(editor.history.queue).toHaveLength(0);
	});
});

describe('Simple: steps that only looked around are passed over', () => {
	it('a creation step is never toasted: the press passes over it and undoes the change under it', () => {
		const editor = twoLetterEditor();
		editor.selectedGlyphID = B;
		traceInto(editor);
		// All tools records an on-demand creation as its own step
		editor._selectedGlyphID = 'glyph-0x43';
		void editor.selectedGlyph;
		expect(editor.history.queue[1].title.startsWith('Created ')).toBe(true);

		setModeForTests('simple');
		const result = editor.history.restoreState();
		expect(shapeCount(editor, B)).toBe(0);
		expect(result.title).toBe(editor.history.redoQueue[0][0].title);
		expect(result.title.startsWith('Created')).toBe(false);
		expect(result.itemID).toBe(B);
		expect(editor.history.queue).toHaveLength(0);
		expect(toastTexts().some((text) => text.includes('Created'))).toBe(false);
		// the letter record it made stays: an empty letter is never an Undo step in Simple
		expect(editor.project.glyphs['glyph-0x43']).toBeDefined();
	});

	it('a "Navigated to" step left from All tools is passed over in the same press', () => {
		const editor = twoLetterEditor();
		editor.selectedGlyphID = B;
		traceInto(editor);
		showItem(editor, R);
		expect(titles(editor)[0].startsWith('Navigated to')).toBe(true);

		setModeForTests('simple');
		const result = editor.history.restoreState();
		expect(shapeCount(editor, B)).toBe(0);
		expect(result).toMatchObject({ done: true, itemID: B, moved: true });
		expect(toastTexts()).toEqual([]);
	});

	it('only creation steps left: nothing to undo, and the records stay', () => {
		const editor = twoLetterEditor();
		editor._selectedGlyphID = 'glyph-0x43';
		void editor.selectedGlyph;
		setModeForTests('simple');
		const result = editor.history.restoreState();
		expect(result.done).toBe(false);
		expect(editor.history.queue).toHaveLength(0);
		expect(editor.project.glyphs['glyph-0x43']).toBeDefined();
	});
});

describe('All tools keeps its own undo', () => {
	it("'all' still takes upstream's navigation press", () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor);
		showItem(editor, R);
		traceInto(editor, 60);
		expect(titles(editor).filter((title) => title.startsWith('Navigated to'))).toHaveLength(2);
		editor.history.restoreState(); // r
		editor.history.restoreState(); // only moves to B
		expect(shapeCount(editor, B)).toBe(1);
		expect(toastTexts()).toContain('Navigated without undo-ing');
	});
});
