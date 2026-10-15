// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize (verdict "Ctrl+Z on Help, About or the Overview silently undoes a letter change
// Brennan can't see"): UX-BEGINNER.md principle 6 ("If an action changes a letter he isn't looking
// at, a toast says which") and 7.3 ("the board stays and the toast offers [Show me]"). In Simple,
// an Undo or Redo that changes a letter while a page that isn't a letter shows says so: "Undid:
// added a rectangle on small b [Show small b]". The button opens that letter. On the letter's
// own page the view moves to it as before (B2), and B6 brings the general undo toasts. All
// tools: as before (no toast from this).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { historyText } from '../../words/history_text.js';
import { word } from '../../words/words.js';
import { B, square, twoLetterEditor } from './two_letters.js';

const showing = () =>
	document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])');

beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetToastsForTests();
	document.body.innerHTML = '';
});
afterEach(() => {
	resetToastsForTests();
	vi.restoreAllMocks();
	setModeForTests('all');
	document.body.innerHTML = '';
});

/** A rectangle drawn on Capital B, then Help opened. */
function rectangleThenHelp(mode) {
	setModeForTests(mode);
	const editor = twoLetterEditor();
	showItem(editor, B);
	editor.selectedItem.addOneShape(square());
	editor.history.addState('Added path: Rectangle 1');
	editor.nav.page = 'Help';
	return editor;
}

describe('Simple: Undo away from the letter it changes', () => {
	it('says which letter, with [Show Capital B]', () => {
		const editor = rectangleThenHelp('simple');
		editor.history.restoreState();
		expect(editor.selectedItem.shapes ?? editor.project.glyphs[B].shapes).toBeTruthy();
		expect(editor.project.glyphs[B].shapes).toHaveLength(0);
		const toast = showing();
		expect(toast.querySelector('.anyink-toast__text').textContent).toBe(
			word('undo.undidOn', {
				change: historyText('Added path: Rectangle 1'),
				letter: 'Capital B',
			})
		);
		expect(toast.dataset.kind).toBe('undo');
		expect(toast.querySelector('button').textContent).toBe(
			word('undo.goToLetter', { letter: 'Capital B' })
		);
	});

	it('[Show Capital B] opens it', () => {
		const editor = rectangleThenHelp('simple');
		editor.history.restoreState();
		showing().querySelector('button').click();
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedItemID).toBe(B);
	});

	it('Redo says it too', () => {
		const editor = rectangleThenHelp('simple');
		editor.history.restoreState();
		resetToastsForTests();
		editor.history.redoState();
		expect(showing().querySelector('.anyink-toast__text').textContent).toBe(
			word('undo.redidOn', {
				change: historyText('Added path: Rectangle 1'),
				letter: 'Capital B',
			})
		);
	});

	it("on the letter's own page: the view is the answer (no toast from this)", () => {
		const editor = rectangleThenHelp('simple');
		editor.nav.page = 'Characters';
		editor.history.restoreState();
		expect(toastLog().filter((record) => record.key === 'undo.undidOn')).toEqual([]);
	});
});

describe('All tools', () => {
	it('no toast from this (as before)', () => {
		const editor = rectangleThenHelp('all');
		editor.history.restoreState();
		expect(toastLog().filter((record) => String(record.key).startsWith('undo.'))).toEqual([]);
	});
});
