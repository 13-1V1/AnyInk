// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 finalize: a toast whose button no longer acts is over (UX-BEGINNER.md 4.0 Toasts, 7.3,
	7.4, principle 6). The undo toast's [Redo] belongs to the newest change; once a new change
	empties the Redo list it does nothing, so:
	  - a toast that is over keeps no place in the queue: "Cleared small b. [Undo]", the toast that
	    stands in for a confirm box, shows at once, never ~6 s later behind a dead "Undid ..."
	  - it goes as soon as a step tells the save status (sweep), not after its full 6 s
	  - two Undo presses that read the same ("Undid: added a rectangle" twice) keep the newest
	    press's button: its [Redo] puts back the step the second press took back
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { B, square, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { pressUndo } from '../../history/undo_toast.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { word } from '../../words/words.js';
import { createQueue } from '../queue.js';
import { dropStaleToasts, resetToastsForTests, toast } from '../toast.js';

const showing = () =>
	document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])');
const shownText = () => showing()?.querySelector('.anyink-toast__text')?.textContent ?? null;

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

describe('the queue (pure): a toast that is over keeps no place', () => {
	const isLive = (entry) => entry.live?.() !== false;

	it('an undo toast that went stale gives way at once to a destructive toast, and never waits', () => {
		let good = true;
		const queue = createQueue({ isLive });
		const undo = { name: 'undo', kind: 'undo', group: 'undo', action: {}, live: () => good };
		queue.add(undo);
		good = false;
		const cleared = { name: 'cleared', kind: 'destructive', action: {} };
		const { show, hide } = queue.add(cleared);
		expect(show).toBe(cleared);
		expect(hide).toBe(undo);
		expect(queue.waiting).toEqual([]);
		expect(queue.current).toBe(cleared);
	});

	it('while it is still good it keeps its place, as before (a higher kind holds)', () => {
		const queue = createQueue({ isLive });
		const undo = { name: 'undo', kind: 'undo', group: 'undo', action: {}, live: () => true };
		queue.add(undo);
		const cleared = { name: 'cleared', kind: 'destructive', action: {} };
		expect(queue.add(cleared).show).toBe(null);
		expect(queue.waiting.map((entry) => entry.name)).toEqual(['cleared']);
	});

	it('an offer that is over is not put back in the line when pushed aside', () => {
		let good = true;
		const queue = createQueue({ isLive });
		const offer = { name: 'offer', kind: 'info', action: {}, live: () => good };
		queue.add(offer);
		good = false;
		queue.add({ name: 'undo', kind: 'undo', group: 'undo' });
		expect(queue.waiting).toEqual([]);
	});

	it('sweep(): the toast showing is over: it goes, and the next live one shows', () => {
		let good = true;
		const queue = createQueue({ isLive });
		const undo = { name: 'undo', kind: 'undo', group: 'undo', action: {}, live: () => good };
		queue.add(undo);
		const note = { name: 'note', kind: 'info' };
		queue.add(note);
		expect(queue.sweep()).toEqual({ hide: null, show: null });
		good = false;
		expect(queue.sweep()).toEqual({ hide: undo, show: note });
		expect(queue.current).toBe(note);
	});
});

describe('Simple: a stale undo toast goes at the next step', () => {
	beforeEach(() => setFeaturesForTests({ coach: true }));

	function tracedB() {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor);
		return editor;
	}

	it('Ctrl+Z, then a new change: the "Undid ..." toast is gone; a destructive toast shows at once', () => {
		const editor = tracedB();
		traceInto(editor, 200);
		editor.history.restoreState();
		expect(shownText()).toMatch(/^Undid: /);
		editor.selectedItem.addOneShape(square(600, 100));
		editor.history.addState('Added path: Rectangle 1');
		expect(shownText()).toBe(null);
		toast('letter.toast.cleared', { name: 'Capital B' }, { kind: 'destructive' });
		expect(shownText()).toBe(word('letter.toast.cleared', { name: 'Capital B' }));
	});

	it('dropStaleToasts: a toast whose stillGood says no goes, the next in line shows', () => {
		setModeForTests('simple');
		let good = true;
		toast('letter.toast.cleared', { name: 'Capital B' }, {
			kind: 'destructive',
			action: { key: 'letter.toast.undo', run: () => {} },
			stillGood: () => good,
		});
		toast('toast.drawingEmpty', {}, {});
		expect(shownText()).toBe(word('letter.toast.cleared', { name: 'Capital B' }));
		good = false;
		dropStaleToasts();
		expect(shownText()).toBe(word('toast.drawingEmpty'));
	});

	it('two Undo presses that read the same: [Redo] puts back the step the newest press took', () => {
		const editor = tracedB();
		traceInto(editor, 200); // the same words: "traced Capital B" twice
		pressUndo(editor);
		pressUndo(editor);
		expect(editor.selectedItem.shapes).toHaveLength(0);
		expect(editor.history.redoQueue).toHaveLength(2);
		showing().querySelector('button').click();
		expect(editor.selectedItem.shapes).toHaveLength(1);
		expect(editor.history.redoQueue).toHaveLength(1);
	});
});
