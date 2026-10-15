// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6 (UX-BEGINNER.md 4.0 Toasts, 7.3, principle 6): every Undo and Redo press in Simple is named
// in a toast, through historyText: "Undid: traced Capital B [Redo]" in a letter view; on the board
// (or Help, About) the view stays and the toast offers [Show me]: "Undid: traced small r [Show
// me]". A change that doesn't name its letter says which when the letter isn't the one in front
// of him ("Undid: added a rectangle on small r"). "Redid: traced Capital B". A press that changed
// nothing says nothing. With the 'coach' flag off, B5's toast stays as it was.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { arriveAt } from '../../mode/band.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { getVisit, setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import {
	pressRedo,
	pressUndo,
	sayUndone,
	stillGoodAfterPress,
	undoToastWords,
} from '../undo_toast.js';
import { B, R, square, traceInto, twoLetterEditor } from './two_letters.js';

const showing = () =>
	document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])');
const shownText = () => showing()?.querySelector('.anyink-toast__text')?.textContent ?? null;
const shownButton = () => showing()?.querySelector('button')?.textContent ?? null;
const textOf = (words) => (words ? word(words.key, words.vars) : null);

let warn;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetToastsForTests();
	document.body.innerHTML = '';
});
afterEach(() => {
	resetToastsForTests();
	warn.mockRestore();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('the toast text map (pure)', () => {
	const project = twoLetterEditor().project;
	const done = (extra) => ({
		done: true,
		title: 'traced Capital B',
		itemID: B,
		page: 'Characters',
		moved: false,
		showMe: null,
		...extra,
	});

	it('a press that changed nothing: no toast', () => {
		expect(undoToastWords(null, { project })).toBeNull();
		expect(undoToastWords({ done: false }, { project })).toBeNull();
	});

	it('Undo on the letter in front of him: "Undid: traced Capital B" [Redo]', () => {
		const words = undoToastWords(done(), { project });
		expect(textOf(words)).toBe('Undid: traced Capital B');
		expect(words.button).toBe('redo');
	});

	it("Undo that moved the view to another letter names it when the change doesn't", () => {
		const moved = done({ title: 'Added path: Rectangle 1', itemID: R, moved: true });
		expect(textOf(undoToastWords(moved, { project }))).toBe('Undid: added a rectangle on small r');
		expect(undoToastWords(moved, { project }).button).toBe('redo');
		// the change already names it: said once
		expect(textOf(undoToastWords(done({ moved: true }), { project }))).toBe(
			'Undid: traced Capital B'
		);
	});

	it('on the board the view stays: [Show me] instead of [Redo]', () => {
		const board = done({
			title: 'traced small r',
			itemID: R,
			showMe: { itemID: R, page: 'Characters' },
		});
		const words = undoToastWords(board, { project });
		expect(textOf(words)).toBe('Undid: traced small r');
		expect(words.button).toBe('showMe');
		const shape = done({ title: 'Added path: Oval 2', showMe: { itemID: B, page: 'Characters' } });
		expect(textOf(undoToastWords(shape, { project }))).toBe('Undid: added an oval on Capital B');
	});

	it('a font-wide step names no letter; a title no rule knows is "your last change"', () => {
		const wide = done({ title: 'moved all letters closer', itemID: false, page: false });
		expect(textOf(undoToastWords(wide, { project }))).toBe('Undid: moved all letters closer');
		const odd = done({ title: '', itemID: false, page: false });
		expect(textOf(undoToastWords(odd, { project }))).toBe('Undid: your last change');
	});

	it('upstream titles are said in house words, with the letter from its record', () => {
		const traced = done({ title: 'Auto-traced 3 shapes (120 points)' });
		expect(textOf(undoToastWords(traced, { project }))).toBe('Undid: traced Capital B');
	});

	it('Redo: "Redid: traced Capital B" with no button; on the board [Show me]', () => {
		const redo = undoToastWords(done(), { project, redo: true });
		expect(textOf(redo)).toBe('Redid: traced Capital B');
		expect(redo.button).toBeNull();
		const board = undoToastWords(done({ showMe: { itemID: B, page: 'Characters' } }), {
			project,
			redo: true,
		});
		expect(board.button).toBe('showMe');
		const moved = done({ title: 'Added path: Rectangle 1', itemID: R, moved: true });
		expect(textOf(undoToastWords(moved, { project, redo: true }))).toBe(
			'Redid: added a rectangle on small r'
		);
	});
});

describe('Simple with the top bar on: the toast every press shows', () => {
	beforeEach(() => setFeaturesForTests({ coach: true }));

	function tracedB(page = 'Characters') {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor);
		editor.nav.page = page;
		return editor;
	}

	it('Undo in the letter: "Undid: traced Capital B" [Redo]; Redo puts it back and says so', () => {
		const editor = tracedB();
		const result = pressUndo(editor);
		expect(result).toMatchObject({ done: true, itemID: B });
		expect(editor.project.glyphs[B].shapes).toHaveLength(0);
		expect(shownText()).toBe('Undid: traced Capital B');
		expect(shownButton()).toBe(word('topbar.redo'));
		expect(showing().dataset.kind).toBe('undo');

		showing().querySelector('button').click();
		expect(editor.project.glyphs[B].shapes).toHaveLength(1);
		expect(shownText()).toBe('Redid: traced Capital B');
		expect(showing().querySelector('button')).toBeNull();
	});

	it('on the board: "Undid: traced Capital B" [Show me], which opens it', () => {
		const editor = tracedB('Overview');
		pressUndo(editor);
		expect(editor.nav.page).toBe('Overview');
		expect(shownText()).toBe('Undid: traced Capital B');
		expect(shownButton()).toBe(word('check.showMe'));
		showing().querySelector('button').click();
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedItemID).toBe(B);
	});

	it('Ctrl+Z and Ctrl+Y (history.js calls sayUndone with its result) say the same words', () => {
		const editor = tracedB();
		sayUndone(editor.history.restoreState(), editor);
		expect(shownText()).toBe('Undid: traced Capital B');
		sayUndone(editor.history.redoState(), editor, { redo: true });
		expect(shownText()).toBe('Redid: traced Capital B');
	});

	// B6 + B7 integration (topbar track's hand-off): Ctrl+Z and Ctrl+Y reach History directly, and
	// History names every press itself; before, a press in the letter said nothing
	it('Ctrl+Z / Ctrl+Y alone (History restoreState / redoState) name the press in the letter', () => {
		const editor = tracedB();
		resetToastsForTests();
		editor.history.restoreState();
		expect(shownText()).toBe('Undid: traced Capital B');
		expect(shownButton()).toBe(word('topbar.redo'));
		editor.history.redoState();
		expect(shownText()).toBe('Redid: traced Capital B');
		expect(toastLog().filter((record) => record.key?.startsWith('undo.'))).toHaveLength(2);
	});

	// B6 + B7 integration: history.js says the press itself (Ctrl+Z), so the bar's button, or
	// anyone else saying the same result again, adds nothing
	it('one press, one toast: the same result said twice shows once', () => {
		const editor = tracedB();
		resetToastsForTests();
		const result = editor.history.restoreState();
		sayUndone(result, editor);
		sayUndone(result, editor);
		expect(toastLog().filter((record) => record.key === 'undo.undid')).toHaveLength(1);
	});

	it('nothing to undo: no toast at all', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(pressUndo(editor)).toMatchObject({ done: false });
		expect(pressRedo(editor)).toMatchObject({ done: false });
		expect(showing()).toBeNull();
		expect(toastLog().filter((record) => record.key?.startsWith('undo.'))).toEqual([]);
	});

	it('a shape drawn on r, undone from B: the view moves to r and the toast names it', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, R);
		editor.selectedItem.addOneShape(square());
		editor.history.addState('Added path: Rectangle 1');
		showItem(editor, B);
		pressUndo(editor);
		expect(editor.selectedItemID).toBe(R);
		expect(shownText()).toBe('Undid: added a rectangle on small r');
	});

	it('the buttons press Undo and Redo as the landing rule needs (cause undo / redo)', () => {
		setModeForTests('simple');
		const causes = [];
		const editor = {
			project: twoLetterEditor().project,
			history: {
				restoreState: () => causes.push(arriveAt('Kerning') && getVisit()?.cause),
				redoState: () => causes.push(arriveAt('Kerning') && getVisit()?.cause),
			},
		};
		pressUndo(editor);
		setModeForTests('simple');
		pressRedo(editor);
		expect(causes).toEqual(['undo', 'redo']);
	});
});

// B6 fix (hostile probe 7): after Ctrl+Z, a new change empties the Redo list, so the toast's
// [Redo] has nothing left to put back, yet the toast stayed, and its kind (undo, the highest) held
// back the "Cleared small b [Undo]" toast for 6 s. Each press's toast now says how long it is good
// (toast.js stillGood): an Undo toast while the step it took back is first on the Redo list, a
// Redo toast while the step it put back is the newest change; both only while its font is open.
describe('an undo or redo toast is good only while it speaks for the newest change', () => {
	beforeEach(() => setFeaturesForTests({ coach: true }));

	function tracedB() {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor);
		return editor;
	}

	it('Undo: good while its step is first on the Redo list; a new change ends it', () => {
		const editor = tracedB();
		pressUndo(editor);
		const good = stillGoodAfterPress(editor);
		expect(good()).toBe(true);
		traceInto(editor, 200); // a new change: the Redo list is emptied
		expect(editor.history.redoQueue).toHaveLength(0);
		expect(good()).toBe(false);
	});

	it('Undo: a second Undo puts a newer step first: the first toast is over', () => {
		const editor = tracedB();
		traceInto(editor, 200);
		pressUndo(editor);
		const first = stillGoodAfterPress(editor);
		pressUndo(editor);
		expect(first()).toBe(false);
		expect(stillGoodAfterPress(editor)()).toBe(true);
	});

	it('Redo: good while the step it put back is the newest change; Undo or a new change ends it', () => {
		const editor = tracedB();
		pressUndo(editor);
		pressRedo(editor);
		const good = stillGoodAfterPress(editor, { redo: true });
		expect(good()).toBe(true);
		traceInto(editor, 200);
		expect(good()).toBe(false);
		const again = tracedB();
		pressUndo(again);
		pressRedo(again);
		const redid = stillGoodAfterPress(again, { redo: true });
		pressUndo(again);
		expect(redid()).toBe(false);
	});

	it('another font opened: over', () => {
		const editor = tracedB();
		pressUndo(editor);
		const good = stillGoodAfterPress(editor);
		twoLetterEditor(); // the current editor is another font now
		expect(good()).toBe(false);
	});

	it("the toast's [Redo] does nothing once another font is open (it would redo a font out of sight)", () => {
		const editor = tracedB();
		pressUndo(editor);
		expect(shownButton()).toBe(word('topbar.redo'));
		const button = showing().querySelector('button');
		const other = twoLetterEditor();
		button.click();
		expect(editor.project.glyphs[B].shapes).toHaveLength(0);
		expect(editor.history.redoQueue).toHaveLength(1);
		expect(other.project.glyphs[B].shapes).toHaveLength(0);
	});

	it('Ctrl+Z and Ctrl+Y (History says the press) carry the same rule', () => {
		const editor = tracedB();
		resetToastsForTests();
		editor.history.restoreState();
		const button = showing().querySelector('button');
		twoLetterEditor();
		button.click();
		expect(editor.project.glyphs[B].shapes).toHaveLength(0);
	});

	it('a press that did nothing, or no editor: never good, and no error', () => {
		expect(stillGoodAfterPress(null)()).toBe(false);
		expect(stillGoodAfterPress({})()).toBe(false);
		setModeForTests('simple');
		const editor = twoLetterEditor();
		expect(stillGoodAfterPress(editor)()).toBe(false); // nothing on the Redo list
		expect(stillGoodAfterPress(editor, { redo: true })()).toBe(false); // nothing changed yet
	});
});

describe('with the top bar off (B5): only a letter changed away from its page is said', () => {
	beforeEach(() => setFeaturesForTests({ coach: false }));

	it('on Help: "Undid: ... on Capital B [Show Capital B]", as before', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		editor.selectedItem.addOneShape(square());
		editor.history.addState('Added path: Rectangle 1');
		editor.nav.page = 'Help';
		resetToastsForTests();
		const result = editor.history.restoreState(); // history.js says it (sayUndone)
		sayUndone(result, editor); // said once already: nothing more
		expect(shownText()).toBe('Undid: added a rectangle on Capital B');
		expect(toastLog().filter((record) => record.key?.startsWith('undo.'))).toHaveLength(1);
		expect(shownButton()).toBe(word('undo.goToLetter', { letter: 'Capital B' }));
	});

	it('in the letter: nothing, as before', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor);
		const result = editor.history.restoreState();
		resetToastsForTests();
		sayUndone(result, editor);
		expect(showing()).toBeNull();
	});
});
