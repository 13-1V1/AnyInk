// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 undo-tips: the Undo gate at every entry point (docs/SKETCH.md section 7), on the real Simple
	letter page with the 'sketch' flag on and a stand-in for a sketch tool's open piece:
	  Ctrl+Z (the app's own key handler), the top bar's Undo button, simple_undo.js undoNewest,
	  undo_toast.js pressUndo: take back the last click, the history and the letter untouched,
	  no toast; the first point alone: the piece goes, and the next press undoes as before.
	  Ctrl+Y, the top bar's Redo, the named toast's [Redo], redoNewest: refused, nothing moves.
	  A destructive toast's [Undo] (an older step): that step is undone, then the piece is
	  finished as its own step ("sketched a line on small n").
	  The top bar's tooltips while open: "Take back the last point", Redo greyed with "Finish
	  the line first"; back to the named step once the piece is finished.
	  With the flag off, the same piece changes nothing: Ctrl+Z undoes the history as before.
	Finished pieces get named Undo toasts from their S1 titles: "Undid: sketched a line on small
	n" [Redo], on the board [Show me], from another letter named once.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleKeyPress } from '../../../../edit_canvas/events_keyboard.js';
import { redoNewest, undoNewest } from '../../../history/simple_undo.js';
import { pressRedo, pressUndo, undoOffer } from '../../../history/undo_toast.js';
import {
	letterPage,
	setUpScreenTests,
	showing,
	shownText,
	square,
} from '../../../letter/tests/simple_screen.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../../mode/features.js';
import { toast, toastLog } from '../../../toast/toast.js';
import { undoButtonsState } from '../../../topbar/undo_buttons.js';
import { refreshSimpleTopBar } from '../../../topbar/simple_top_bar.js';
import { word } from '../../../words/words.js';
import {
	clearOpenPiece,
	isPieceOpen,
	pieceChanged,
	resetUndoGateForTests,
	setOpenPiece,
} from '../undo_gate.js';

setUpScreenTests();

const N = 'glyph-0x6E';
const LINE_TITLE = 'sketched a line on small n';

beforeEach(() => {
	resetUndoGateForTests();
	setFeaturesForTests({ sketch: true });
});
afterEach(() => {
	resetUndoGateForTests();
	resetFeaturesForTests();
});

function key(keyName, init = {}) {
	const event = new KeyboardEvent('keydown', {
		key: keyName,
		bubbles: true,
		cancelable: true,
		...init,
	});
	handleKeyPress(event);
	return event;
}

/** small n open in Simple, with one older step (a traced square) */
function smallN() {
	const editor = letterPage({ id: N });
	editor.selectedItem.addOneShape(square(100, 0, 400));
	editor.history.addState('traced small n');
	return editor;
}

/**
 * A stand-in for a sketch tool's open piece on small n: n clicks; finish stores one shape as
 * one step with the piece's S1 title, as the Line tool will.
 */
function openLine(editor, n = 3) {
	const piece = {
		itemID: N,
		clicks: Array.from({ length: n }, (_, i) => ({ x: 100 + i * 50, y: 0 })),
		cancelled: 0,
		pointCount() {
			return this.clicks.length;
		},
		removeLastPoint() {
			this.clicks.pop();
		},
		cancel() {
			this.cancelled++;
			this.clicks = [];
			clearOpenPiece(this);
		},
		finish() {
			editor.project.getItem(N).addOneShape(square(600, 0, 50));
			editor.history.addState(LINE_TITLE);
			clearOpenPiece(this);
		},
	};
	setOpenPiece(piece);
	return piece;
}

const undoToasts = () => toastLog().filter((record) => record.key?.startsWith('undo.'));
const shapesOfN = (editor) => editor.project.getItem(N).shapes.length;
const bar = () => document.querySelector('#app__top-bar');
const barButton = (kind) => bar()?.querySelector(`[data-anyink-control="${kind}"]`);

describe('Undo with a piece open takes back the last click, at every entry', () => {
	const entries = {
		'Ctrl+Z': () => key('z', { ctrlKey: true }),
		"the top bar's Undo": (editor) => pressUndo(editor),
		'simple_undo undoNewest': (editor) => undoNewest(editor.history, editor),
		"History's restoreState": (editor) => editor.history.restoreState(),
	};
	Object.entries(entries).forEach(([name, press]) => {
		it(`${name}: one click back, history and letter untouched, no toast`, () => {
			const editor = smallN();
			const piece = openLine(editor, 3);
			const queue = editor.history.queue.length;
			press(editor);
			expect(piece.clicks).toHaveLength(2);
			expect(editor.history.queue.length).toBe(queue);
			expect(editor.history.redoQueue).toHaveLength(0);
			expect(shapesOfN(editor)).toBe(1);
			expect(undoToasts()).toEqual([]);
			expect(showing()).toBeNull();
		});
	});

	it('the first point alone: the piece goes; the next Ctrl+Z undoes the older step as before', () => {
		const editor = smallN();
		const piece = openLine(editor, 2);
		key('z', { ctrlKey: true });
		key('z', { ctrlKey: true });
		expect(piece.cancelled).toBe(1);
		expect(isPieceOpen()).toBe(false);
		expect(shapesOfN(editor)).toBe(1);
		key('z', { ctrlKey: true });
		expect(shapesOfN(editor)).toBe(0);
		expect(shownText()).toBe(word('undo.undid', { change: 'traced small n' }));
	});

	it("the top bar's Undo button, clicked", () => {
		const editor = smallN();
		const piece = openLine(editor, 3);
		const button = barButton('undo');
		expect(button).toBeTruthy();
		button.dispatchEvent(new Event('pointerenter'));
		button.click();
		expect(piece.clicks).toHaveLength(2);
		expect(shapesOfN(editor)).toBe(1);
		expect(undoToasts()).toEqual([]);
	});
});

describe('Redo with a piece open is refused, at every entry', () => {
	/** small n with a step on the Redo list, then a piece opened */
	function withRedo() {
		const editor = smallN();
		editor.history.restoreState();
		expect(editor.history.redoQueue).toHaveLength(1);
		const piece = openLine(editor, 2);
		return { editor, piece };
	}
	const entries = {
		'Ctrl+Y': () => key('y', { ctrlKey: true }),
		'Ctrl+Shift+Z': () => key('z', { ctrlKey: true, shiftKey: true }),
		"the top bar's Redo": (editor) => pressRedo(editor),
		'simple_undo redoNewest': (editor) => redoNewest(editor.history, editor),
	};
	Object.entries(entries).forEach(([name, press]) => {
		it(`${name}: nothing moves`, () => {
			const { editor, piece } = withRedo();
			const before = toastLog().length;
			const result = press(editor);
			if (result && 'done' in result) expect(result).toMatchObject({ done: false });
			expect(editor.history.redoQueue).toHaveLength(1);
			expect(shapesOfN(editor)).toBe(0);
			expect(piece.clicks).toHaveLength(2);
			expect(toastLog().length).toBe(before);
		});
	});

	it("the named Undo toast's [Redo]: nothing moves", () => {
		const editor = smallN();
		editor.history.restoreState();
		expect(shownText()).toBe(word('undo.undid', { change: 'traced small n' }));
		const piece = openLine(editor, 2);
		showing().querySelector('button').click();
		expect(editor.history.redoQueue).toHaveLength(1);
		expect(shapesOfN(editor)).toBe(0);
		expect(piece.clicks).toHaveLength(2);
	});
});

describe("an older step's [Undo] under an open piece", () => {
	it('the older step is undone, then the piece is finished as its own step', () => {
		const editor = smallN();
		const offer = undoOffer(editor);
		const piece = openLine(editor, 3);
		expect(offer.stillGood()).toBe(true);
		offer.action.run();
		expect(isPieceOpen()).toBe(false);
		expect(piece.cancelled).toBe(0);
		// the traced square is gone, the piece's shape is there, as the newest step
		const shapes = editor.project.getItem(N).shapes;
		expect(shapes).toHaveLength(1);
		// the piece's 50-unit square (Simple's spacing may have moved it)
		expect(Math.round(shapes[0].maxes.xMax - shapes[0].maxes.xMin)).toBe(50);
		expect(editor.history.queue[0].title).toBe(LINE_TITLE);
	});

	it('the toast button itself does the same', () => {
		const editor = smallN();
		const offer = undoOffer(editor);
		toast('letter.toast.cleared', { name: 'small n' }, { kind: 'destructive', ...offer });
		openLine(editor, 2);
		const button = showing()?.querySelector('button');
		expect(button).toBeTruthy();
		button.click();
		const shapes = editor.project.getItem(N).shapes;
		expect(shapes).toHaveLength(1);
		expect(editor.history.queue[0].title).toBe(LINE_TITLE);
	});
});

describe("the top bar's tooltips while a piece is open", () => {
	it('Undo: "Take back the last point"; Redo greyed: "Finish the line first"', () => {
		const editor = smallN();
		openLine(editor, 2);
		const state = undoButtonsState(editor.history, editor.project, { openItemID: N });
		expect(state.undo).toEqual({ enabled: true, change: '', tip: 'Take back the last point' });
		expect(state.redo).toEqual({ enabled: false, change: '', tip: 'Finish the line first' });
	});

	it('Undo is live on a letter with no step yet, while a piece is open', () => {
		const editor = letterPage({ id: N });
		openLine(editor, 2);
		expect(undoButtonsState(editor.history, editor.project).undo.enabled).toBe(true);
	});

	it('the bar says it: tooltips change as the piece opens and finishes', () => {
		const editor = smallN();
		refreshSimpleTopBar();
		expect(barButton('undo').title).toBe(word('topbar.undoTip', { change: 'traced small n' }));
		const piece = openLine(editor, 2);
		pieceChanged();
		barButton('undo').dispatchEvent(new Event('pointerenter'));
		expect(barButton('undo').title).toBe('Take back the last point');
		barButton('redo').dispatchEvent(new Event('pointerenter'));
		expect(barButton('redo').title).toBe('Finish the line first');
		expect(barButton('redo').getAttribute('aria-disabled')).toBe('true');
		piece.finish();
		barButton('undo').dispatchEvent(new Event('pointerenter'));
		expect(barButton('undo').title).toBe(`Undo: ${LINE_TITLE}`);
	});

	it("an explicit pieceOpen: false is the old behavior (the bar's state without the gate)", () => {
		const editor = smallN();
		openLine(editor, 2);
		const state = undoButtonsState(editor.history, editor.project, {
			openItemID: N,
			pieceOpen: false,
		});
		expect(state.undo.tip).toBe(word('topbar.undoTip', { change: 'traced small n' }));
	});
});

describe("with the 'sketch' flag off: exactly as before", () => {
	it('Ctrl+Z undoes the older step; the stand-in piece is never asked', () => {
		setFeaturesForTests({ sketch: false });
		const editor = smallN();
		const piece = openLine(editor, 3);
		key('z', { ctrlKey: true });
		expect(piece.clicks).toHaveLength(3);
		expect(shapesOfN(editor)).toBe(0);
		expect(shownText()).toBe(word('undo.undid', { change: 'traced small n' }));
		const state = undoButtonsState(editor.history, editor.project, { openItemID: N });
		expect(state.undo.tip).toBe(word('undo.nothing'));
	});
});

describe('finished pieces: named Undo toasts from their S1 titles', () => {
	function finishedLine({ page = 'Characters' } = {}) {
		const editor = smallN();
		openLine(editor, 3).finish();
		editor.nav.page = page;
		return editor;
	}

	it('Ctrl+Z: "Undid: sketched a line on small n" [Redo]; the bar named it first', () => {
		const editor = finishedLine();
		const state = undoButtonsState(editor.history, editor.project, { openItemID: N });
		expect(state.undo.tip).toBe(`Undo: ${LINE_TITLE}`);
		key('z', { ctrlKey: true });
		expect(shapesOfN(editor)).toBe(1);
		expect(shownText()).toBe(`Undid: ${LINE_TITLE}`);
		expect(showing().querySelector('button').textContent).toBe(word('topbar.redo'));
		showing().querySelector('button').click();
		expect(shapesOfN(editor)).toBe(2);
		expect(shownText()).toBe(`Redid: ${LINE_TITLE}`);
	});

	it('on the board: [Show me]; from another letter the letter is named once', () => {
		const board = finishedLine({ page: 'Overview' });
		pressUndo(board);
		expect(shownText()).toBe(`Undid: ${LINE_TITLE}`);
		expect(showing().querySelector('button').textContent).toBe(word('check.showMe'));
		const elsewhere = finishedLine();
		const state = undoButtonsState(elsewhere.history, elsewhere.project, {
			openItemID: 'glyph-0x61',
		});
		expect(state.undo.tip).toBe(`Undo: ${LINE_TITLE}`);
	});

	const titles = {
		'sketch.step.arc': 'sketched an arc on small n',
		'sketch.step.spline': 'sketched a spline on small n',
		'sketch.step.circle': 'sketched a circle on small n',
		'sketch.step.rectangle': 'sketched a rectangle on small n',
	};
	Object.entries(titles).forEach(([stepKey, title]) => {
		it(`${stepKey}: "Undid: ${title}"`, () => {
			expect(word(stepKey, { letter: 'small n' })).toBe(title);
			const editor = smallN();
			editor.project.getItem(N).addOneShape(square(600, 0, 50));
			editor.history.addState(title);
			pressUndo(editor);
			expect(shownText()).toBe(`Undid: ${title}`);
		});
	});
});
